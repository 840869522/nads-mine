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
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Redis; // 添加 Cache facade 用于 Redis

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
        // 1. 直接从请求头中验证JWT token
        $authHeader = $request->header('Authorization');
        
        if (!$authHeader) {
            Log::warning("Flag提交失败：Authorization头缺失", [
                'request_ip' => $request->ip(),
                'all_headers' => $request->headers->all()
            ]);
            
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                '请先登录后再提交Flag。如果已登录，请刷新页面重试。'
            );
        }
        
        // 直接使用Authorization头作为token（项目原有逻辑）
        $token = $authHeader;
        
        // 解码JWT token
        try {
            $jwtResult = \App\Utils\JWTControll::decodeJWT($token);
            
            if ($jwtResult['err'] !== null) {
                Log::warning("Flag提交失败：JWT token无效", [
                    'jwt_error' => $jwtResult['err'],
                    'request_ip' => $request->ip()
                ]);
                
                return $this->_response(
                    GlobalResponse::$HTTP_TOKEN_ERROR_CODE,
                    'Token已过期或无效，请重新登录。'
                );
            }
            
            $tokenData = $jwtResult['data'];
            if (!isset($tokenData['id']) || empty($tokenData['id'])) {
                Log::error("Flag提交失败：JWT token中缺少用户ID", [
                    'token_data' => $tokenData
                ]);
                
                return $this->_response(
                    GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                    'Token数据异常，请重新登录。'
                );
            }
            
            $username = $tokenData['id'];
            
        } catch (\Exception $e) {
            Log::error("Flag提交失败：JWT解码异常", [
                'error' => $e->getMessage(),
                'auth_header' => substr($authHeader, 0, 20) . '...'
            ]);
            
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                'Token解码失败，请重新登录。'
            );
        }
        
        // 验证用户是否在数据库中存在
        try {
            $userExists = \App\Models\Users\UserModel::getUserById($username);
            if ($userExists['code'] !== \App\Utils\GlobalResponse::$DATABASE_SUCCESS_CODE || !$userExists['data']) {
                Log::error("Flag提交失败：用户不存在", [
                    'username' => $username,
                    'user_check_result' => $userExists
                ]);
                
                return $this->_response(
                    GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                    '用户账户不存在或已被禁用，请联系管理员。'
                );
            }
        } catch (\Exception $e) {
            Log::error("Flag提交失败：用户验证异常", [
                'username' => $username,
                'error' => $e->getMessage()
            ]);
            
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                '系统错误，请稍后重试。'
            );
        }

        // 2. 参数校验 - 简化正则表达式验证防止语法错误
        $validator = Validator::make($request->all(), [
            'c_scene_instances_id' => 'required|string|exists:c_scene_instances,c_scene_instances_id',
            'instance_id' => 'required|string',
            'instance_type' => 'required|string|in:docker,vm',
            'flag' => 'required|string|min:40|max:50', // 简化验证，稍后在代码中进行正则验证
        ], [
            'c_scene_instances_id.exists' => '场景实例不存在',
            'instance_type.in' => '实例类型不合法',
            'flag.min' => 'Flag格式不正确'
        ]);

        if ($validator->fails()) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, $validator->errors()->first());
        }

        $c_scene_instances_id = $request->input('c_scene_instances_id');
        $instance_id = $request->input('instance_id');
        $instance_type = $request->input('instance_type');
        $submittedFlag = $request->input('flag');
        
        // 在代码中进行Flag格式验证，防止转义问题
        $flagPattern = '/^flag\\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\}$/';
        if (!preg_match($flagPattern, $submittedFlag)) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, 'Flag格式不正确，应为flag{UUID}格式');
        }
        $correctFlag = null;
        $instance = null; // 确保实例变量在任何情况下都已定义
        $actualDbId = null; // 存储实际的数据库ID

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

        // 3. 多层级关联校验（增强版）
        $instance = null;
        $correctFlag = null;

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
                $actualDbId = $instance->c_container_id; // 容器ID就是数据库ID
                Log::info("找到容器实例", [
                    'container_name' => $instance->c_container_name,
                    'has_flag' => !empty($correctFlag)
                ]);
            } else {
                // 调试信息：查找是否存在该容器但场景不匹配
                $anyContainer = SceneContainerInstanceModel::where('c_container_id', $instance_id)->first();
                if ($anyContainer) {
                    Log::warning("容器存在但场景不匹配", [
                        'expected_scene' => $c_scene_instances_id,
                        'actual_scene' => $anyContainer->c_scene_instances_id
                    ]);
                } else {
                    Log::warning("容器实例不存在", ['container_id' => $instance_id]);
                }
            }
        } elseif ($instance_type === 'vm') {
            Log::info("VM实例查找开始", [
                'instance_id' => $instance_id,
                'is_numeric' => is_numeric($instance_id),
                'is_uuid' => preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $instance_id)
            ]);

            $actualDbId = null; // 存储实际的数据库ID

            // 方法1：尝试作为数字ID查找（数据库c_vm_id）
            if (is_numeric($instance_id)) {
                $vmId = (int)$instance_id;
                Log::info("尝试按数字ID查找", ['vm_id' => $vmId]);

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
            if (!$instance && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $instance_id)) {
                Log::info("数字ID没找到，尝试作为UUID查找", ['uuid' => $instance_id]);

                try {
                    // 通过virsh获取VM名称
                    $vmNameOutput = shell_exec("virsh -c qemu:///system domname '{$instance_id}' 2>/dev/null");
                    $vmName = trim($vmNameOutput ?? '');

                    if (!empty($vmName)) {
                        Log::info("通过UUID找到VM名称", ['uuid' => $instance_id, 'vm_name' => $vmName]);

                        // 通过VM名称在数据库中查找
                        $instance = SceneVmInstanceModel::where('c_vm_name', $vmName)
                                                        ->where('c_scene_instances_id', $c_scene_instances_id)
                                                        ->first();
                        if ($instance) {
                            $correctFlag = $instance->c_flag;
                            $actualDbId = $instance->c_vm_id;
                            Log::info("通过UUID找到VM实例", [
                                'vm_id' => $instance->c_vm_id,
                                'vm_name' => $instance->c_vm_name,
                                'uuid' => $instance_id,
                                'has_flag' => !empty($correctFlag)
                            ]);
                        } else {
                            Log::warning("通过VM名称没找到数据库记录", [
                                'vm_name' => $vmName,
                                'scene_id' => $c_scene_instances_id
                            ]);
                        }
                    } else {
                        Log::warning("UUID无效，无法获取VM名称", ['uuid' => $instance_id]);
                    }
                } catch (\Exception $e) {
                    Log::error("UUID查找失败", ['uuid' => $instance_id, 'error' => $e->getMessage()]);
                }
            }

            // 如果前两种都没找到，记录错误信息
            if (!$instance) {
                Log::error("VM实例查找完全失败", [
                    'instance_id' => $instance_id,
                    'scene_id' => $c_scene_instances_id,
                    'is_numeric' => is_numeric($instance_id),
                    'is_uuid' => preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $instance_id),
                    'available_vms_in_scene' => SceneVmInstanceModel::where('c_scene_instances_id', $c_scene_instances_id)
                        ->select('c_vm_id', 'c_vm_name', 'c_flag')
                        ->get()->toArray()
                ]);
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

        // 4. Flag比对、得分计算与数据保存
        // 处理数据库中flag格式问题：如果数据库中只存储UUID，需要加上flag{}包装
        $normalizedCorrectFlag = $correctFlag;
        if (!empty($correctFlag) && !str_starts_with($correctFlag, 'flag{')) {
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
            'submitted_flag_hex' => bin2hex($submittedFlag),
            'correct_flag_hex' => bin2hex($normalizedCorrectFlag ?? '')
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

            Log::info("💾 数据库事务提交成功", [
                'submission_id' => $submission->c_submission_id,
                'username' => $submission->c_username,
                'is_correct' => $submission->c_is_correct,
                'points_earned' => $submission->c_points_earned
            ]);

            // WebSocket消息发送已移除，现在使用轮询机制

            // 发送 Redis 消息
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

            // 返回更详细的错误信息用于调试
            return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '系统错误: ' . $e->getMessage());
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
        // 1. 直接从请求头中验证JWT token
        $authHeader = $request->header('Authorization');
        
        if (!$authHeader) {
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                '请先登录后再查看历史记录。'
            );
        }
        
        // 直接使用Authorization头作为token（项目原有逻辑）
        $token = $authHeader;
        
        // 解码JWT token
        try {
            $jwtResult = \App\Utils\JWTControll::decodeJWT($token);
            if ($jwtResult['err'] !== null || !isset($jwtResult['data']['id'])) {
                return $this->_response(
                    GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                    'Token已过期，请重新登录。'
                );
            }
            $username = $jwtResult['data']['id'];
        } catch (\Exception $e) {
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                '身份验证失败，请重新登录。'
            );
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
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, $validator->errors()->first());
        }

        $scope = $request->input('scope');
        $targetScope = $request->input('target_scope');
        $sceneInstanceId = $request->input('c_scene_instances_id');
        $instanceId = $request->input('instance_id');

        try {
            // 3. 动态构建查询 - 明确指定需要加载的字段
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
                ->with([
                    'containerInstance:c_container_id,c_container_name,c_ip,c_scene_instances_id',
                    'vmInstance:c_vm_id,c_vm_name,c_ip,c_scene_instances_id'
                ])
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

            // 4. 数据格式化 - 显示靶机IP而不是ID
            $formattedHistory = $history->map(function ($record) {
                $instanceId = $record->c_container_instance_id ?? $record->c_vm_instance_id;
                $instanceType = $record->c_container_instance_id ? 'docker' : 'vm';
                
                // 获取靶机IP地址和名称
                $instanceIp = 'Unknown IP';
                $instanceName = 'Unknown Instance';
                $sceneId = null;
                
                if ($record->containerInstance) {
                    $instanceIp = $record->containerInstance->c_ip ?? 'Unknown IP';
                    $instanceName = $record->containerInstance->c_container_name ?? 'Unknown Container';
                    $sceneId = $record->containerInstance->c_scene_instances_id;
                    
                    // 调试日志
                    Log::info('Container Instance Debug', [
                        'container_id' => $record->c_container_instance_id,
                        'container_data' => $record->containerInstance ? $record->containerInstance->toArray() : 'null',
                        'extracted_ip' => $instanceIp,
                        'extracted_name' => $instanceName
                    ]);
                } elseif ($record->vmInstance) {
                    $instanceIp = $record->vmInstance->c_ip ?? 'Unknown IP';
                    $instanceName = $record->vmInstance->c_vm_name ?? 'Unknown VM';
                    $sceneId = $record->vmInstance->c_scene_instances_id;
                    
                    // 调试日志
                    Log::info('VM Instance Debug', [
                        'vm_id' => $record->c_vm_instance_id,
                        'vm_data' => $record->vmInstance ? $record->vmInstance->toArray() : 'null',
                        'extracted_ip' => $instanceIp,
                        'extracted_name' => $instanceName
                    ]);
                }

                return [
                    'c_submission_id' => $record->c_submission_id,
                    'c_username' => $record->c_username,
                    'c_submitted_at' => $record->c_submitted_at,
                    'c_is_correct' => $record->c_is_correct,
                    'c_attempt_count' => $record->c_attempt_count,
                    'c_points_earned' => $record->c_points_earned,
                    'instance_id' => $instanceId, // 保留ID用于内部逻辑
                    'instance_ip' => $instanceIp, // 新增：显示IP地址
                    'instance_name' => $instanceName, // 新增：显示实例名称
                    'instance_type' => $instanceType,
                    'c_scene_instances_id' => $sceneId,
                ];
            });

            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '历史记录获取成功', $formattedHistory);

        } catch (\Exception $e) {
            Log::error("获取历史记录失败: " . $e->getMessage());
            return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, '查询历史记录失败');
        }
    }

    /**
     * 获取最新的Flag提交记录（用于轮询）
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getLatestSubmissions(Request $request)
    {
        // 1. JWT token验证
        $authHeader = $request->header('Authorization');
        
        if (!$authHeader) {
            return $this->_response(
                GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                '请先登录后再查看最新提交记录。'
            );
        }
        
        $token = str_replace('Bearer ', '', $authHeader);
        
        try {
            $jwtResult = \App\Utils\JWTControll::decodeJWT($token);
            if ($jwtResult['err'] !== null || !isset($jwtResult['data']['id'])) {
                return $this->_response(
                    GlobalResponse::$HTTP_STATUS_ERROR_CODE,
                    'Token已过期，请重新登录。'
                );
            }
            $username = $jwtResult['data']['id'];
        } catch (\Exception $e) {
            return $this->_response(
                GlobalResponse::$HTTP_SERVER_ERROR_CODE,
                '身份验证失败，请重新登录。'
            );
        }

        // 2. 参数验证
        $validator = Validator::make($request->all(), [
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
            'since' => ['nullable', 'string'], // 时间戳，获取此时间之后的记录
            'scene_instance_id' => ['nullable', 'string', 'exists:c_scene_instances,c_scene_instances_id'],
        ]);

        if ($validator->fails()) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, $validator->errors()->first());
        }

        $limit = $request->input('limit', 10); // 默认返回最新10条
        $since = $request->input('since'); // 可选的时间戳
        $sceneInstanceId = $request->input('scene_instance_id'); // 可选的场景实例ID

        try {
            // 3. 构建查询
            $query = FlagSubmissionModel::query()
                ->select([
                    'c_submission_id',
                    'c_username', 
                    'c_submitted_at',
                    'c_is_correct',
                    'c_points_earned',
                    'c_container_instance_id',
                    'c_vm_instance_id',
                    'c_scene_instances_id',
                    'c_attempt_count'
                ])
                ->with([
                    'containerInstance:c_container_id,c_container_name,c_ip',
                    'vmInstance:c_vm_id,c_vm_name,c_ip'
                ])
                ->orderBy('c_submitted_at', 'desc')
                ->limit($limit);

            // 如果指定了时间戳，只返回此时间之后的记录
            if ($since) {
                $query->where('c_submitted_at', '>', $since);
            }

            // 如果指定了场景实例ID，只返回该场景的记录
            if ($sceneInstanceId) {
                $query->where('c_scene_instances_id', $sceneInstanceId);
            }

            $submissions = $query->get();

            // 4. 格式化数据
            $formattedSubmissions = $submissions->map(function ($record) {
                $instanceType = $record->c_container_instance_id ? 'docker' : 'vm';
                $instanceName = 'Unknown Instance';
                
                if ($record->containerInstance) {
                    $instanceName = $record->containerInstance->c_container_name ?? 'Unknown Container';
                } elseif ($record->vmInstance) {
                    $instanceName = $record->vmInstance->c_vm_name ?? 'Unknown VM';
                }

                return [
                    'submission_id' => $record->c_submission_id,
                    'c_username' => $record->c_username,
                    'c_is_correct' => $record->c_is_correct,
                    'c_points_earned' => $record->c_points_earned,
                    'c_submitted_at' => $record->c_submitted_at->toDateTimeString(),
                    'c_scene_instances_id' => $record->c_scene_instances_id,
                    'c_container_instance_id' => $record->c_container_instance_id,
                    'c_vm_instance_id' => $record->c_vm_instance_id,
                    'instance_type' => $instanceType,
                    'instance_name' => $instanceName,
                    'attempt_count' => $record->c_attempt_count,
                ];
            });

            // 5. 返回统计信息
            $stats = [
                'total_returned' => $formattedSubmissions->count(),
                'latest_timestamp' => $formattedSubmissions->isNotEmpty() ? 
                    $formattedSubmissions->first()['c_submitted_at'] : null,
                'server_time' => now()->toDateTimeString(),
            ];

            return $this->_response(GlobalResponse::$HTTP_STATUS_OK_CODE, '最新提交记录获取成功', [
                'submissions' => $formattedSubmissions,
                'stats' => $stats
            ]);

        } catch (\Exception $e) {
            Log::error("获取最新提交记录失败: " . $e->getMessage());
            return $this->_response(GlobalResponse::$HTTP_SERVER_ERROR_CODE, '查询最新提交记录失败');
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
        // 1. 用户身份验证（可选，允许匿名访问）
        $authHeader = $request->header('Authorization');
        
        if ($authHeader) {
            // 直接使用Authorization头作为token（项目原有逻辑）
            $token = $authHeader;
            
            try {
                $jwtResult = \App\Utils\JWTControll::decodeJWT($token);
                if ($jwtResult['err'] === null && isset($jwtResult['data']['id'])) {
                    $username = $jwtResult['data']['id'];
                } else {
                    $username = 'anonymous';
                }
            } catch (\Exception $e) {
                $username = 'anonymous';
            }
        } else {
            $username = 'anonymous';
            Log::info("匿名用户访问场景实例列表", [
                'request_ip' => $request->ip()
            ]);
        }

        try {
            // 2. 获取场景实例列表（可以根据业务需求进行权限过滤）
            $sceneInstances = SceneInstanceModel::select('c_scene_instances_id')
                ->orderBy('created_at', 'desc')
                ->get();

            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                '场景实例获取成功',
                $sceneInstances
            );

        } catch (\Exception $e) {
            Log::error("获取场景实例失败: " . $e->getMessage());
            return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, '获取场景实例失败');
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
        // 1. 用户身份验证（可选，允许匿名访问）
        $authHeader = $request->header('Authorization');
        
        if ($authHeader) {
            // 直接使用Authorization头作为token（项目原有逻辑）
            $token = $authHeader;
            
            try {
                $jwtResult = \App\Utils\JWTControll::decodeJWT($token);
                if ($jwtResult['err'] === null && isset($jwtResult['data']['id'])) {
                    $username = $jwtResult['data']['id'];
                } else {
                    $username = 'anonymous';
                }
            } catch (\Exception $e) {
                $username = 'anonymous';
            }
        } else {
            $username = 'anonymous';
            Log::info("匿名用户访问鼠机实例列表", [
                'request_ip' => $request->ip()
            ]);
        }

        // 2. 参数校验
        $validator = Validator::make($request->all(), [
            'scene_id' => ['required', 'string', 'exists:c_scene_instances,c_scene_instances_id'],
        ], [
            'scene_id.exists' => '场景实例不存在',
        ]);

        if ($validator->fails()) {
            return $this->_response(GlobalResponse::$HTTP_STATUS_ERROR_CODE, $validator->errors()->first());
        }

        $sceneId = $request->input('scene_id');

        try {
            // 3. 获取Docker容器实例（只返回有flag的目标靶机）
            $containerInstances = SceneContainerInstanceModel::where('c_scene_instances_id', $sceneId)
                ->whereNotNull('c_flag') // 只返回有flag的目标靶机
                ->select('c_container_id as id', 'c_container_name as name', 'c_flag', 'c_ip')
                ->get()
                ->map(function ($instance) {
                    return [
                        'id' => $instance->id,
                        'name' => $instance->name,
                        'ip' => $instance->c_ip ?? 'Unknown IP', // 新增：显示IP地址
                        'type' => 'docker',
                        'has_flag' => !empty($instance->c_flag)
                    ];
                });

            // 4. 获取VM实例（只返回有flag的目标靶机）
            $vmInstances = SceneVmInstanceModel::where('c_scene_instances_id', $sceneId)
                ->whereNotNull('c_flag') // 只返回有flag的目标靶机
                ->select('c_vm_id as id', 'c_vm_name as name', 'c_flag', 'c_ip')
                ->get()
                ->map(function ($instance) {
                    return [
                        'id' => (string)$instance->id,
                        'name' => $instance->name,
                        'ip' => $instance->c_ip ?? 'Unknown IP', // 新增：显示IP地址
                        'type' => 'vm',
                        'has_flag' => !empty($instance->c_flag)
                    ];
                });

            // 5. 合并结果
            $targetInstances = $containerInstances->merge($vmInstances);

            Log::info("获取到的目标靶机实例", [
                'scene_id' => $sceneId,
                'container_count' => $containerInstances->count(),
                'vm_count' => $vmInstances->count(),
                'total_count' => $targetInstances->count()
            ]);

            return $this->_response(
                GlobalResponse::$HTTP_STATUS_OK_CODE,
                '靶机实例获取成功',
                $targetInstances
            );

        } catch (\Exception $e) {
            Log::error("获取靶机实例失败: " . $e->getMessage(), [
                'scene_id' => $sceneId,
                'trace' => $e->getTraceAsString()
            ]);
            return $this->_response(GlobalResponse::$HTTP_DATABASE_ERROR_CODE, '获取靶机实例失败');
        }
    }

    /**
     * 临时调试接口 - 检查场景和靶机数据完整性
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function debugSceneData(Request $request)
    {
        $sceneId = $request->input('scene_id');

        try {
            $result = [
                'scene_instance' => SceneInstanceModel::where('c_scene_instances_id', $sceneId)
                    ->select('c_scene_instances_id', 'c_status', 'c_username', 'created_at')
                    ->first(),
                'containers' => SceneContainerInstanceModel::where('c_scene_instances_id', $sceneId)
                    ->select('c_container_id', 'c_scene_instances_id', 'c_flag', 'c_container_name', 'c_ip')
                    ->get(),
                'vms' => SceneVmInstanceModel::where('c_scene_instances_id', $sceneId)
                    ->select('c_vm_id', 'c_scene_instances_id', 'c_flag', 'c_vm_name', 'c_ip')
                    ->get(),
                'all_scenes' => SceneInstanceModel::select('c_scene_instances_id', 'c_status', 'c_username', 'created_at')
                    ->orderBy('created_at', 'desc')
                    ->limit(10)
                    ->get(),
                'target_containers' => SceneContainerInstanceModel::where('c_scene_instances_id', $sceneId)
                    ->whereNotNull('c_flag')
                    ->count(),
                'target_vms' => SceneVmInstanceModel::where('c_scene_instances_id', $sceneId)
                    ->whereNotNull('c_flag')
                    ->count(),
            ];

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error("调试数据获取失败: " . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 500);
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
            $redis = Redis::connection();

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
}
