<?php

namespace App\Http\Controllers\FlagSubmission;

use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Utils\GlobalResponse;
use App\Models\Flag\FlagSubmissionModel;
use App\Models\scenario\SceneInstanceModel;
use App\Models\scenario\SceneContainerInstanceModel;
use App\Models\scenario\SceneVmInstanceModel;
use App\Services\WorkermanService; // 确保这个use语句正确
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Cache; // 添加 Cache facade 用于 Redis

class FlagSubmissionController extends Controller
{
    protected $workermanService;

    public function __construct(WorkermanService $workermanService)
    {
        $this->workermanService = $workermanService;
    }

    /**
     * 处理 Flag 提交
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function submitFlag(Request $request)
    {
        // 1. 获取 JWT 用户信息（适配 JWTCheckMiddleware）
        $tokenData = $request->input('token_data');
        $username = $tokenData['id'] ?? null;
        if (is_null($username)) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_FORBIDDEN_CODE, '用户身份验证失败');
        }

        // 2. 参数校验
        $validator = Validator::make($request->all(), [
            'c_scene_instances_id' => ['required', 'string', 'exists:c_scene_instances,c_scene_instances_id'],
            'instance_id' => ['required', 'string'],
            'instance_type' => ['required', 'string', 'in:docker,vm'],
            'flag' => ['required', 'string', 'regex:/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/'],
        ], [
            'c_scene_instances_id.exists' => '场景实例不存在',
            'instance_type.in' => '实例类型不合法',
            'flag.regex' => 'Flag格式不正确'
        ]);

        if ($validator->fails()) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_BAD_REQUEST_CODE, $validator->errors()->first());
        }

        $c_scene_instances_id = $request->input('c_scene_instances_id');
        $instance_id = $request->input('instance_id');
        $instance_type = $request->input('instance_type');
        $submittedFlag = $request->input('flag');
        $correctFlag = null;
        $instance = null; // 确保实例变量在任何情况下都已定义

        // 3. 多层级关联校验
        if ($instance_type === 'docker') {
            $instance = SceneContainerInstanceModel::where('c_container_id', $instance_id)
                                                    ->where('c_scene_instances_id', $c_scene_instances_id)
                                                    ->first();
            if ($instance) {
                $correctFlag = $instance->c_flag;
            }
        } elseif ($instance_type === 'vm') {
            $instance = SceneVmInstanceModel::where('c_vm_id', $instance_id)
                                            ->where('c_scene_instances_id', $c_scene_instances_id)
                                            ->first();
            if ($instance) {
                $correctFlag = $instance->c_flag;
            }
        }

        if (!$instance) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_NOTFOUND_CODE, '提交的靶机实例与场景不匹配或不存在');
        }

        // 4. Flag比对、得分计算与数据保存
        $is_correct = (trim($submittedFlag) === trim($correctFlag));
        $points_earned = 0;
        $message = 'Flag提交失败，请重试';

        DB::beginTransaction();
        try {
            if ($is_correct) {
                $existing_correct_submission = FlagSubmissionModel::where('c_username', $username)
                    ->where(function ($query) use ($instance_type, $instance_id) {
                        if ($instance_type === 'docker') {
                            $query->where('c_container_instance_id', $instance_id);
                        } else {
                            $query->where('c_vm_instance_id', $instance_id);
                        }
                    })
                    ->where('c_is_correct', 1)
                    ->first();

                if (!$existing_correct_submission) {
                    $correct_submissions_count = FlagSubmissionModel::where(function ($query) use ($instance_type, $instance_id) {
                        if ($instance_type === 'docker') {
                            $query->where('c_container_instance_id', $instance_id);
                        } else {
                            $query->where('c_vm_instance_id', $instance_id);
                        }
                    })
                    ->where('c_is_correct', 1)
                    ->count();

                    $points_earned = max(1, 100 - $correct_submissions_count);
                    $message = 'Flag提交成功！获得 ' . $points_earned . ' 分。';
                } else {
                    $message = '你已提交过正确的Flag，无法再次获得分数。';
                }
            } else {
                $message = 'Flag不正确，请继续尝试。';
            }

            $submission = new FlagSubmissionModel();
            $submission->c_submission_id = (string) Str::uuid();
            $submission->c_username = $username;
            $submission->c_scene_instances_id = $c_scene_instances_id;
            $submission->c_container_instance_id = ($instance_type === 'docker') ? $instance_id : null;
            $submission->c_vm_instance_id = ($instance_type === 'vm') ? $instance_id : null;
            $submission->c_submitted_flag = $submittedFlag;
            $submission->c_is_correct = $is_correct;
            $submission->c_points_earned = $points_earned;
            $submission->c_submitted_at = now();

            $attempt_count = FlagSubmissionModel::where('c_username', $username)
                ->where(function ($query) use ($instance_type, $instance_id) {
                    if ($instance_type === 'docker') {
                        $query->where('c_container_instance_id', $instance_id);
                    } else {
                        $query->where('c_vm_instance_id', $instance_id);
                    }
                })
                ->count();
            $submission->c_attempt_count = $attempt_count + 1;

            $submission->save();

            DB::commit();

            // 发送 Workerman 广播消息
            $broadcastData = [
                'type' => 'flag_submission',
                'submission_id' => $submission->c_submission_id,
                'c_username' => $submission->c_username,
                'c_is_correct' => $submission->c_is_correct,
                'c_points_earned' => $submission->c_points_earned,
                'c_submitted_at' => $submission->c_submitted_at->toDateTimeString(),
                'c_scene_instances_id' => $submission->c_scene_instances_id,
                'c_container_instance_id' => $submission->c_container_instance_id,
                'c_vm_instance_id' => $submission->c_vm_instance_id,
                'instance_type' => $instance_type,
            ];
            $this->workermanService->send($broadcastData);

            // 发送 Redis 消息
            $this->sendRedisMessage([
                'event' => 'flag_submission',
                'user_id' => $username,
                'username' => $username,
                'timestamp' => now()->toDateTimeString(),
                'success' => $is_correct,
                'points_earned' => $points_earned,
                'instance_type' => $instance_type,
                'instance_id' => $instance_id,
                'instance_name' => $instance_type === 'docker' 
                    ? ($instance->c_container_name ?? 'Unknown Container') 
                    : ($instance->c_vm_name ?? 'Unknown VM'),
                'scene_instance_id' => $c_scene_instances_id,
                'attempt_count' => $submission->c_attempt_count,
                'submission_id' => $submission->c_submission_id,
                'message' => $message
            ]);

            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_OK_CODE, $message, ['points' => $points_earned, 'is_correct' => $is_correct]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Flag提交事务失败: " . $e->getMessage());
            
            // 发送失败的 Redis 消息
            try {
                $this->sendRedisMessage([
                    'event' => 'flag_submission_error',
                    'user_id' => $username,
                    'username' => $username,
                    'timestamp' => now()->toDateTimeString(),
                    'success' => false,
                    'points_earned' => 0,
                    'instance_type' => $instance_type ?? 'unknown',
                    'instance_id' => $instance_id ?? 'unknown',
                    'instance_name' => 'Error',
                    'scene_instance_id' => $c_scene_instances_id ?? 'unknown',
                    'error_message' => '系统错误，提交失败',
                    'exception' => $e->getMessage()
                ]);
            } catch (\Exception $redisException) {
                Log::error("Redis消息发送失败: " . $redisException->getMessage());
            }
            
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '系统错误，提交失败');
        }
    }

    /**
     * 获取 Flag 提交历史记录
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSubmissionHistory(Request $request)
    {
        // 1. 获取 JWT 用户信息（适配 JWTCheckMiddleware）
        $tokenData = $request->input('token_data');
        $username = $tokenData['id'] ?? null;
        if (is_null($username)) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_FORBIDDEN_CODE, '用户身份验证失败');
        }

        // 2. 参数校验
        $validator = Validator::make($request->all(), [
            'scope' => ['required', 'string', 'in:mine,all'],
            'target_scope' => ['required', 'string', 'in:this_target,all_targets_in_scene,all_targets_in_all_scenes'],
            'c_scene_instances_id' => ['nullable', 'string', 'exists:c_scene_instances,c_scene_instances_id'],
            'instance_id' => ['nullable', 'string'],
        ], [
            'scope.in' => '提交者范围参数不合法',
            'target_scope.in' => '靶机范围参数不合法',
            'c_scene_instances_id.exists' => '场景实例不存在',
        ]);

        if ($validator->fails()) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_BAD_REQUEST_CODE, $validator->errors()->first());
        }

        $scope = $request->input('scope');
        $targetScope = $request->input('target_scope');
        $sceneInstanceId = $request->input('c_scene_instances_id');
        $instanceId = $request->input('instance_id');

        try {
            // 3. 动态构建查询
            $query = FlagSubmissionModel::query()
                ->select([
                    'c_submission_id',
                    'c_username',
                    'c_submitted_at',
                    'c_is_correct',
                    'c_attempt_count',
                    'c_points_earned',
                    'c_container_instance_id',
                    'c_vm_instance_id',
                ])
                ->with(['containerInstance', 'vmInstance'])
                ->orderBy('c_submitted_at', 'desc');

            // 根据提交者范围筛选
            if ($scope === 'mine') {
                $query->where('c_username', $username);
            }

            // 根据靶机范围筛选
            if ($targetScope === 'this_target') {
                $query->where(function ($q) use ($instanceId) {
                    $q->where('c_container_instance_id', $instanceId)
                      ->orWhere('c_vm_instance_id', $instanceId);
                });
            } elseif ($targetScope === 'all_targets_in_scene') {
                $containerIds = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                                                          ->pluck('c_container_id');
                $vmIds = SceneVmInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                                             ->pluck('c_vm_id');

                $query->where(function ($q) use ($containerIds, $vmIds) {
                    $q->whereIn('c_container_instance_id', $containerIds)
                      ->orWhereIn('c_vm_instance_id', $vmIds);
                });
            } // all_targets_in_all_scenes 模式下无需额外筛选

            $history = $query->get();

            // 4. 数据格式化
            $formattedHistory = $history->map(function ($record) {
                $instanceId = $record->c_container_instance_id ?? $record->c_vm_instance_id;
                $instanceType = $record->c_container_instance_id ? 'docker' : 'vm';

                $sceneId = null;
                if ($record->containerInstance) {
                    $sceneId = $record->containerInstance->c_scene_instances_id;
                } elseif ($record->vmInstance) {
                    $sceneId = $record->vmInstance->c_scene_instances_id;
                }

                return [
                    'c_submission_id' => $record->c_submission_id,
                    'c_username' => $record->c_username,
                    'c_submitted_at' => $record->c_submitted_at,
                    'c_is_correct' => $record->c_is_correct,
                    'c_attempt_count' => $record->c_attempt_count,
                    'c_points_earned' => $record->c_points_earned,
                    'instance_id' => $instanceId,
                    'instance_type' => $instanceType,
                    'c_scene_instances_id' => $sceneId,
                ];
            });

            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_OK_CODE, '历史记录获取成功', $formattedHistory);

        } catch (\Exception $e) {
            Log::error("获取历史记录失败: " . $e->getMessage());
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, '查询历史记录失败');
        }
    }

    /**
     * 获取场景实例列表
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSceneInstances(Request $request)
    {
        // 1. 获取 JWT 用户信息（适配 JWTCheckMiddleware）
        $tokenData = $request->input('token_data');
        $username = $tokenData['id'] ?? null;
        if (is_null($username)) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_FORBIDDEN_CODE, '用户身份验证失败');
        }

        try {
            // 2. 获取场景实例列表（可以根据业务需求进行权限过滤）
            $sceneInstances = SceneInstanceModel::select('c_scene_instances_id')
                ->orderBy('created_at', 'desc')
                ->get();

            return GlobalResponse::apiResponse(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                '场景实例获取成功',
                $sceneInstances
            );

        } catch (\Exception $e) {
            Log::error("获取场景实例失败: " . $e->getMessage());
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, '获取场景实例失败');
        }
    }

    /**
     * 获取靶机实例列表
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getTargetInstances(Request $request)
    {
        // 1. 获取 JWT 用户信息（适配 JWTCheckMiddleware）
        $tokenData = $request->input('token_data');
        $username = $tokenData['id'] ?? null;
        if (is_null($username)) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_FORBIDDEN_CODE, '用户身份验证失败');
        }

        // 2. 参数校验
        $validator = Validator::make($request->all(), [
            'scene_id' => ['required', 'string', 'exists:c_scene_instances,c_scene_instances_id'],
        ], [
            'scene_id.exists' => '场景实例不存在',
        ]);

        if ($validator->fails()) {
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_STATUS_BAD_REQUEST_CODE, $validator->errors()->first());
        }

        $sceneId = $request->input('scene_id');

        try {
            // 3. 获取Docker容器实例
            $containerInstances = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneId)
                ->select('c_container_id as id')
                ->get()
                ->map(function ($instance) {
                    return [
                        'id' => $instance->id,
                        'type' => 'docker'
                    ];
                });

            // 4. 获取VM实例
            $vmInstances = SceneVmInstanceModel::where('c_scene_instances_id', $sceneId)
                ->select('c_vm_id as id')
                ->get()
                ->map(function ($instance) {
                    return [
                        'id' => (string)$instance->id,
                        'type' => 'vm'
                    ];
                });

            // 5. 合并结果
            $targetInstances = $containerInstances->merge($vmInstances);

            return GlobalResponse::apiResponse(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                '靶机实例获取成功',
                $targetInstances
            );

        } catch (\Exception $e) {
            Log::error("获取靶机实例失败: " . $e->getMessage());
            return GlobalResponse::apiResponse(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, '获取靶机实例失败');
        }
    }

    /**
     * 发送 Redis 消息
     *
     * @param array $messageData
     * @return void
     */
    private function sendRedisMessage(array $messageData)
    {
        try {
            $redis = Cache::store('redis');
            
            // 发送到 Redis 列表（可以用作消息队列）
            $listKey = 'flag_submissions_queue';
            $redis->getRedis()->lpush($listKey, json_encode($messageData));
            
            // 设置一个带过期时间的键值对（用于监控最新提交）
            $latestKey = 'latest_flag_submission:' . $messageData['user_id'];
            $redis->put($latestKey, json_encode($messageData), 3600); // 1小时过期
            
            // 发送到 Redis 频道（用于实时通知）
            $channelName = 'flag_submissions_channel';
            $redis->getRedis()->publish($channelName, json_encode($messageData));
            
            Log::info("Redis 消息发送成功", ['user' => $messageData['username'], 'event' => $messageData['event']]);
            
        } catch (\Exception $e) {
            Log::error("Redis 消息发送失败: " . $e->getMessage(), ['messageData' => $messageData]);
        }
    }
}
