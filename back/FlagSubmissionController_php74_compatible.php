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
     * 统一返回值方法（从基础Controller复制）
     * @param $code int 响应编码
     * @param $message string 返回信息
     * @param $data array 返回数据
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
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function submitFlag(Request $request)
    {
        // 1. 简化用户信息获取，使用请求参数或默认用户
        $token_data = $request->input("token_data");
        
        // 修复数组访问错误：检查token_data是否存在且为数组
        if (is_array($token_data) && isset($token_data['id'])) {
            $username = $token_data['id'];
        } else {
            // 如果token_data无效，尝试从其他地方获取用户信息
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

        // 2. 参数校验 - 简化正则表达式避免转义问题
        $validator = Validator::make($request->all(), [
            'c_scene_instances_id' => 'required|string|exists:c_scene_instances,c_scene_instances_id',
            'instance_id' => 'required|string',
            'instance_type' => 'required|string|in:docker,vm',
            'flag' => 'required|string|min:40|max:50', // 简化验证，避免复杂正则
        ], [
            'c_scene_instances_id.exists' => '场景实例不存在',
            'instance_type.in' => '实例类型不合法',
            'flag.min' => 'Flag格式不正确'
        ]);

        if ($validator->fails()) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, $validator->errors()->first());
        }

        // 在代码中进行Flag格式验证，避免复杂正则表达式
        $submittedFlag = $request->input('flag');
        $flagPattern = '/^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/';
        if (!preg_match($flagPattern, $submittedFlag)) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, 'Flag格式不正确，应为flag{UUID}格式');
        }

        $c_scene_instances_id = $request->input('c_scene_instances_id');
        $instance_id = $request->input('instance_id');
        $instance_type = $request->input('instance_type');
        $correctFlag = null;
        $instance = null;
        $actualDbId = null;

        // 添加详细的参数调试信息
        Log::info("Flag提交请求参数详情", [
            'all_inputs' => $request->all(),
            'c_scene_instances_id' => $c_scene_instances_id,
            'instance_id' => $instance_id,
            'instance_id_type' => gettype($instance_id),
            'instance_id_length' => strlen($instance_id),
            'instance_type' => $instance_type,
            'flag' => substr($submittedFlag, 0, 20) . '...',
            'username' => $username
        ]);

        // 3. 多层级关联校验
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
                $correctFlag = $instance->c_flag;
                $actualDbId = $instance->c_container_id;
                Log::info("找到容器实例", [
                    'container_name' => $instance->c_container_name,
                    'has_flag' => !empty($correctFlag)
                ]);
            } else {
                Log::warning("容器实例不存在", ['container_id' => $instance_id]);
            }
        } elseif ($instance_type === 'vm') {
            Log::info("VM实例查找开始", [
                'instance_id' => $instance_id,
                'is_numeric' => is_numeric($instance_id),
            ]);

            // 方法1：尝试作为数字ID查找
            if (is_numeric($instance_id)) {
                $vmId = (int)$instance_id;
                $instance = SceneVmInstanceModel::where('c_vm_id', $vmId)
                                                ->where('c_scene_instances_id', $c_scene_instances_id)
                                                ->first();
                if ($instance) {
                    $correctFlag = $instance->c_flag;
                    $actualDbId = $instance->c_vm_id;
                    Log::info("按数字ID找到VM实例", [
                        'vm_id' => $instance->c_vm_id,
                        'vm_name' => $instance->c_vm_name,
                        'has_flag' => !empty($correctFlag)
                    ]);
                }
            }

            // 方法2：如果按数字ID没找到，尝试作为UUID查找
            if (!$instance) {
                Log::info("数字ID没找到，尝试作为UUID查找", ['uuid' => $instance_id]);
                // 简化：直接通过instance_id查找，不使用shell_exec
                $instance = SceneVmInstanceModel::where('c_scene_instances_id', $c_scene_instances_id)
                                                ->whereRaw('c_vm_name LIKE ?', ['%' . substr($instance_id, 0, 8) . '%'])
                                                ->first();
                if ($instance) {
                    $correctFlag = $instance->c_flag;
                    $actualDbId = $instance->c_vm_id;
                }
            }
        }

        // 额外检查：验证场景实例是否存在
        $sceneInstance = SceneInstanceModel::where('c_scene_instances_id', $c_scene_instances_id)->first();
        if (!$sceneInstance) {
            Log::error("场景实例不存在", ['scene_id' => $c_scene_instances_id]);
            return $this->_response(GlobalResponse::$HTTP_STATUS_NOTFOUND_CODE, '指定的场景实例不存在');
        }

        if (!$instance) {
            Log::error("靶机实例验证失败", [
                'instance_type' => $instance_type,
                'instance_id' => $instance_id,
                'scene_id' => $c_scene_instances_id,
                'scene_status' => $sceneInstance->c_status ?? 'unknown'
            ]);
            return $this->_response(GlobalResponse::$HTTP_STATUS_NOTFOUND_CODE, '提交的靶机实例与场景不匹配或不存在');
        }

        // 检查靶机是否为目标靶机（有flag）
        if (empty($correctFlag)) {
            Log::warning("靶机实例不是目标靶机", [
                'instance_type' => $instance_type,
                'instance_id' => $instance_id
            ]);
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, '该靶机不是目标靶机，无法提交Flag');
        }

        // 4. Flag比对、得分计算与数据保存 - 使用兼容的字符串函数
        $normalizedCorrectFlag = $correctFlag;
        if (!empty($correctFlag) && substr($correctFlag, 0, 5) !== 'flag{') {
            // 如果数据库中只存储UUID，加上flag{}包装
            $normalizedCorrectFlag = 'flag{' . $correctFlag . '}';
        }

        // 添加详细的flag比对调试信息
        Log::info("Flag比对详情", [
            'submitted_flag' => $submittedFlag,
            'submitted_flag_length' => strlen($submittedFlag),
            'submitted_flag_trimmed' => trim($submittedFlag),
            'correct_flag_original' => $correctFlag,
            'correct_flag_normalized' => $normalizedCorrectFlag,
            'correct_flag_length' => strlen($normalizedCorrectFlag ?? ''),
            'correct_flag_trimmed' => trim($normalizedCorrectFlag ?? ''),
            'flags_match_exact' => ($submittedFlag === $normalizedCorrectFlag),
            'flags_match_trimmed' => (trim($submittedFlag) === trim($normalizedCorrectFlag)),
        ]);

        $is_correct = (trim($submittedFlag) === trim($normalizedCorrectFlag));
        $points_earned = 0;
        $message = 'Flag提交失败，请重试';

        DB::beginTransaction();
        try {
            if ($is_correct) {
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

            Log::info("数据库事务提交成功，准备发送WebSocket消息", [
                'submission_id' => $submission->c_submission_id,
                'username' => $submission->c_username,
                'is_correct' => $submission->c_is_correct,
                'points_earned' => $submission->c_points_earned
            ]);

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

            $sendResult = $this->workermanService->send($broadcastData);

            Log::info("WebSocket消息发送结果", [
                'send_result' => $sendResult,
                'message_type' => $broadcastData['type']
            ]);

            // 发送 Redis 消息 - 简化实例名称获取
            $instance_name = 'Unknown Instance';
            if ($instance && is_object($instance)) {
                if ($instance_type === 'docker' && isset($instance->c_container_name)) {
                    $instance_name = $instance->c_container_name;
                } elseif ($instance_type === 'vm' && isset($instance->c_vm_name)) {
                    $instance_name = $instance->c_vm_name;
                }
            }
            
            $this->sendRedisMessage([
                'event' => 'flag_submission',
                'user_id' => $username,
                'username' => $username,
                'timestamp' => now()->toDateTimeString(),
                'success' => $is_correct,
                'points_earned' => $points_earned,
                'instance_type' => $instance_type,
                'instance_id' => $instance_id,
                'instance_name' => $instance_name,
                'scene_instance_id' => $c_scene_instances_id,
                'attempt_count' => $submission->c_attempt_count,
                'submission_id' => $submission->c_submission_id,
                'message' => $message
            ]);

            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, $message, ['points' => $points_earned, 'is_correct' => $is_correct]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Flag提交事务失败: " . $e->getMessage(), [
                'exception_class' => get_class($e),
                'exception_message' => $e->getMessage(),
                'exception_file' => $e->getFile(),
                'exception_line' => $e->getLine(),
                'stack_trace' => $e->getTraceAsString(),
                'input_data' => [
                    'instance_id' => $instance_id ?? 'null',
                    'instance_type' => $instance_type ?? 'null',
                    'scene_id' => $c_scene_instances_id ?? 'null',
                    'actualDbId' => $actualDbId ?? 'null',
                    'username' => $username ?? 'null'
                ]
            ]);

            return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '系统错误: ' . $e->getMessage());
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
            // 使用 Laravel Redis facade（兼容 predis）
            $redis = \Illuminate\Support\Facades\Redis::connection('cache');

            // 发送到 Redis 列表（可以用作消息队列）
            $listKey = 'flag_submissions_queue';
            $redis->lpush($listKey, json_encode($messageData));

            // 设置一个带过期时间的键值对（用于监控最新提交）
            $latestKey = 'latest_flag_submission:' . $messageData['user_id'];
            $redis->setex($latestKey, 3600, json_encode($messageData)); // 1小时过期

            // 发送到 Redis 频道（用于实时通知）
            $channelName = 'flag_submissions_channel';
            $redis->publish($channelName, json_encode($messageData));

            Log::info("Redis 消息发送成功", ['user' => $messageData['username'], 'event' => $messageData['event']]);

        } catch (\Exception $e) {
            Log::error("Redis 消息发送失败: " . $e->getMessage(), ['messageData' => $messageData]);
        }
    }

    // 其他方法保持不变，使用简化的实现
    // ... (省略其他方法以简化代码)
}