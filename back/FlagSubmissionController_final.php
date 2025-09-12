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
use App\Services\WorkermanService;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Cache;

class FlagSubmissionController extends BaseController
{
    protected $workermanService;

    public function __construct(WorkermanService $workermanService)
    {
        $this->workermanService = $workermanService;
    }

    /**
     * 统一返回值方法
     */
    public function _response($code = '', $message = '', $data = [])
    {
        $res = [
            'code' => $code,
            'message' => $message,
            'data' => $data
        ];

        return response()->json($res);
    }

    /**
     * 处理 Flag 提交
     */
    public function submitFlag(Request $request)
    {
        // 1. 获取用户信息
        $token_data = $request->input("token_data");
        
        if (is_array($token_data) && isset($token_data['id'])) {
            $username = $token_data['id'];
        } else {
            $username = $request->input('username', 'anonymous');
            if (empty($username)) {
                $username = 'anonymous';
            }
            
            Log::warning("Token data无效，使用备用用户名", [
                'token_data' => $token_data,
                'fallback_username' => $username,
                'request_all' => $request->all()
            ]);
        }

        // 2. 基础参数校验 - 避免复杂正则表达式
        $validator = Validator::make($request->all(), [
            'c_scene_instances_id' => 'required|string',
            'instance_id' => 'required|string',
            'instance_type' => 'required|string|in:docker,vm',
            'flag' => 'required|string|min:40|max:50',
        ], [
            'instance_type.in' => '实例类型不合法',
            'flag.min' => 'Flag长度不正确'
        ]);

        if ($validator->fails()) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, $validator->errors()->first());
        }

        // 3. 获取并验证参数
        $c_scene_instances_id = $request->input('c_scene_instances_id');
        $instance_id = $request->input('instance_id');
        $instance_type = $request->input('instance_type');
        $submittedFlag = $request->input('flag');
        
        // 4. Flag格式验证 - 使用简单的方法
        if (!$this->validateFlagFormat($submittedFlag)) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, 'Flag格式不正确，应为flag{UUID}格式');
        }

        // 5. 验证场景实例存在
        $sceneInstance = SceneInstanceModel::where('c_scene_instances_id', $c_scene_instances_id)->first();
        if (!$sceneInstance) {
            Log::error("场景实例不存在", ['scene_id' => $c_scene_instances_id]);
            return $this->_response(GlobalResponse::$HTTP_STATUS_NOTFOUND_CODE, '指定的场景实例不存在');
        }

        // 6. 查找靶机实例和正确的flag
        $result = $this->findTargetInstance($instance_type, $instance_id, $c_scene_instances_id);
        if (!$result['success']) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_NOTFOUND_CODE, $result['message']);
        }

        $instance = $result['instance'];
        $correctFlag = $result['correct_flag'];
        $actualDbId = $result['actual_db_id'];

        // 7. 检查靶机是否为目标靶机（有flag）
        if (empty($correctFlag)) {
            Log::warning("靶机实例不是目标靶机", [
                'instance_type' => $instance_type,
                'instance_id' => $instance_id
            ]);
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, '该靶机不是目标靶机，无法提交Flag');
        }

        // 8. Flag比对和评分
        $result = $this->processSubmission($username, $submittedFlag, $correctFlag, $instance_type, $actualDbId, $c_scene_instances_id);
        
        if ($result['success']) {
            // 9. 发送消息通知
            $this->sendNotifications($result['submission'], $instance_type, $instance_id, $instance, $result['message']);
            
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE, 
                $result['message'], 
                ['points' => $result['points'], 'is_correct' => $result['is_correct']]
            );
        } else {
            return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, $result['message']);
        }
    }

    /**
     * 验证Flag格式 - 简化版本避免转义问题
     */
    private function validateFlagFormat($flag)
    {
        // 基础格式检查
        if (strlen($flag) < 40 || strlen($flag) > 50) {
            return false;
        }
        
        // 检查基本格式 flag{...}
        if (substr($flag, 0, 5) !== 'flag{' || substr($flag, -1) !== '}') {
            return false;
        }
        
        // 提取UUID部分
        $uuid = substr($flag, 5, -1);
        
        // 验证UUID格式：8-4-4-4-12
        $pattern = '/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/';
        return preg_match($pattern, $uuid) === 1;
    }

    /**
     * 查找目标实例
     */
    private function findTargetInstance($instance_type, $instance_id, $c_scene_instances_id)
    {
        Log::info("开始验证靶机实例", [
            'instance_type' => $instance_type,
            'instance_id' => $instance_id,
            'scene_id' => $c_scene_instances_id
        ]);

        if ($instance_type === 'docker') {
            $instance = SceneContainerInstanceModel::where('c_container_id', $instance_id)
                                                    ->where('c_scene_instances_id', $c_scene_instances_id)
                                                    ->first();
            if ($instance) {
                return [
                    'success' => true,
                    'instance' => $instance,
                    'correct_flag' => $instance->c_flag,
                    'actual_db_id' => $instance->c_container_id
                ];
            } else {
                Log::warning("容器实例不存在", ['container_id' => $instance_id]);
                return ['success' => false, 'message' => '提交的容器实例与场景不匹配或不存在'];
            }
        } elseif ($instance_type === 'vm') {
            // 尝试作为数字ID查找
            if (is_numeric($instance_id)) {
                $vmId = (int)$instance_id;
                $instance = SceneVmInstanceModel::where('c_vm_id', $vmId)
                                                ->where('c_scene_instances_id', $c_scene_instances_id)
                                                ->first();
                if ($instance) {
                    return [
                        'success' => true,
                        'instance' => $instance,
                        'correct_flag' => $instance->c_flag,
                        'actual_db_id' => $instance->c_vm_id
                    ];
                }
            }
            
            Log::warning("VM实例不存在", ['vm_id' => $instance_id]);
            return ['success' => false, 'message' => '提交的VM实例与场景不匹配或不存在'];
        }

        return ['success' => false, 'message' => '不支持的实例类型'];
    }

    /**
     * 处理提交和评分
     */
    private function processSubmission($username, $submittedFlag, $correctFlag, $instance_type, $actualDbId, $c_scene_instances_id)
    {
        // 标准化正确的flag
        $normalizedCorrectFlag = $correctFlag;
        if (!empty($correctFlag) && substr($correctFlag, 0, 5) !== 'flag{') {
            $normalizedCorrectFlag = 'flag{' . $correctFlag . '}';
        }

        $is_correct = (trim($submittedFlag) === trim($normalizedCorrectFlag));
        $points_earned = 0;
        $message = 'Flag提交失败，请重试';

        DB::beginTransaction();
        try {
            if ($is_correct) {
                // 检查是否已经提交过正确答案
                $existing_correct_submission = FlagSubmissionModel::where('c_username', $username)
                    ->where(function ($query) use ($instance_type, $actualDbId) {
                        if ($instance_type === 'docker') {
                            $query->where('c_container_instance_id', $actualDbId);
                        } else {
                            $query->where('c_vm_instance_id', $actualDbId);
                        }
                    })
                    ->where('c_is_correct', 1)
                    ->first();

                if (!$existing_correct_submission) {
                    // 计算分数
                    $correct_submissions_count = FlagSubmissionModel::where(function ($query) use ($instance_type, $actualDbId) {
                        if ($instance_type === 'docker') {
                            $query->where('c_container_instance_id', $actualDbId);
                        } else {
                            $query->where('c_vm_instance_id', $actualDbId);
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

            // 保存提交记录
            $submission = new FlagSubmissionModel();
            $submission->c_submission_id = (string) Str::uuid();
            $submission->c_username = $username;
            $submission->c_scene_instances_id = $c_scene_instances_id;
            $submission->c_container_instance_id = ($instance_type === 'docker') ? $actualDbId : null;
            $submission->c_vm_instance_id = ($instance_type === 'vm') ? $actualDbId : null;
            $submission->c_submitted_flag = $submittedFlag;
            $submission->c_is_correct = $is_correct;
            $submission->c_points_earned = $points_earned;
            $submission->c_submitted_at = now();

            // 计算尝试次数
            $attempt_count = FlagSubmissionModel::where('c_username', $username)
                ->where(function ($query) use ($instance_type, $actualDbId) {
                    if ($instance_type === 'docker') {
                        $query->where('c_container_instance_id', $actualDbId);
                    } else {
                        $query->where('c_vm_instance_id', $actualDbId);
                    }
                })
                ->count();
            $submission->c_attempt_count = $attempt_count + 1;

            $submission->save();

            DB::commit();

            Log::info("Flag提交成功", [
                'submission_id' => $submission->c_submission_id,
                'username' => $username,
                'is_correct' => $is_correct,
                'points_earned' => $points_earned
            ]);

            return [
                'success' => true,
                'submission' => $submission,
                'points' => $points_earned,
                'is_correct' => $is_correct,
                'message' => $message
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Flag提交事务失败: " . $e->getMessage(), [
                'exception_message' => $e->getMessage(),
                'exception_file' => $e->getFile(),
                'exception_line' => $e->getLine()
            ]);

            return ['success' => false, 'message' => '系统错误: ' . $e->getMessage()];
        }
    }

    /**
     * 发送通知消息
     */
    private function sendNotifications($submission, $instance_type, $instance_id, $instance, $message)
    {
        try {
            // 发送 Workerman 消息
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
                'user_id' => $submission->c_username,
                'username' => $submission->c_username,
                'timestamp' => now()->toDateTimeString(),
                'success' => $submission->c_is_correct,
                'points_earned' => $submission->c_points_earned,
                'instance_type' => $instance_type,
                'instance_id' => $instance_id,
                'instance_name' => $this->getInstanceName($instance, $instance_type),
                'scene_instance_id' => $submission->c_scene_instances_id,
                'attempt_count' => $submission->c_attempt_count,
                'submission_id' => $submission->c_submission_id,
                'message' => $message
            ]);

        } catch (\Exception $e) {
            Log::error("发送通知失败: " . $e->getMessage());
        }
    }

    /**
     * 获取实例名称
     */
    private function getInstanceName($instance, $instance_type)
    {
        if (!$instance || !is_object($instance)) {
            return 'Unknown Instance';
        }

        if ($instance_type === 'docker' && isset($instance->c_container_name)) {
            return $instance->c_container_name;
        } elseif ($instance_type === 'vm' && isset($instance->c_vm_name)) {
            return $instance->c_vm_name;
        }

        return 'Unknown Instance';
    }

    /**
     * 发送 Redis 消息
     */
    private function sendRedisMessage(array $messageData)
    {
        try {
            $redis = \Illuminate\Support\Facades\Redis::connection('cache');

            // 发送到队列
            $listKey = 'flag_submissions_queue';
            $redis->lpush($listKey, json_encode($messageData));

            // 设置最新提交
            $latestKey = 'latest_flag_submission:' . $messageData['user_id'];
            $redis->setex($latestKey, 3600, json_encode($messageData));

            // 发送到频道
            $channelName = 'flag_submissions_channel';
            $redis->publish($channelName, json_encode($messageData));

            Log::info("Redis消息发送成功", ['user' => $messageData['username'], 'event' => $messageData['event']]);

        } catch (\Exception $e) {
            Log::error("Redis消息发送失败: " . $e->getMessage(), ['messageData' => $messageData]);
        }
    }

    /**
     * 获取 Flag 提交历史记录 - 简化版本
     */
    public function getSubmissionHistory(Request $request)
    {
        $token_data = $request->input("token_data");
        
        if (is_array($token_data) && isset($token_data['id'])) {
            $username = $token_data['id'];
        } else {
            $username = $request->input('username', 'anonymous');
        }

        $validator = Validator::make($request->all(), [
            'scope' => 'required|string|in:mine,all',
            'target_scope' => 'required|string|in:this_target,all_targets_in_scene,all_targets_in_all_scenes',
            'c_scene_instances_id' => 'nullable|string',
            'instance_id' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, $validator->errors()->first());
        }

        try {
            $scope = $request->input('scope');
            $targetScope = $request->input('target_scope');
            $sceneInstanceId = $request->input('c_scene_instances_id');

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
                ->orderBy('c_submitted_at', 'desc');

            if ($scope === 'mine') {
                $query->where('c_username', $username);
            }

            if ($targetScope === 'all_targets_in_scene' && $sceneInstanceId) {
                $containerIds = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                                                          ->pluck('c_container_id');
                $vmIds = SceneVmInstanceModel::where('c_scene_instances_id', $sceneInstanceId)
                                             ->pluck('c_vm_id');

                $query->where(function ($q) use ($containerIds, $vmIds) {
                    $q->whereIn('c_container_instance_id', $containerIds)
                      ->orWhereIn('c_vm_instance_id', $vmIds);
                });
            }

            $history = $query->get();

            $formattedHistory = $history->map(function ($record) {
                $instanceId = $record->c_container_instance_id ?? $record->c_vm_instance_id;
                $instanceType = $record->c_container_instance_id ? 'docker' : 'vm';

                return [
                    'c_submission_id' => $record->c_submission_id,
                    'c_username' => $record->c_username,
                    'c_submitted_at' => $record->c_submitted_at,
                    'c_is_correct' => $record->c_is_correct,
                    'c_attempt_count' => $record->c_attempt_count,
                    'c_points_earned' => $record->c_points_earned,
                    'instance_id' => $instanceId,
                    'instance_type' => $instanceType,
                ];
            });

            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '历史记录获取成功', $formattedHistory);

        } catch (\Exception $e) {
            Log::error("获取历史记录失败: " . $e->getMessage());
            return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, '查询历史记录失败');
        }
    }
}