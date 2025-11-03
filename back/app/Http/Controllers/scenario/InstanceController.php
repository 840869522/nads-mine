<?php
// file: app/Http/Controllers/scenario/InstanceController.php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneInstance;
use App\Models\scenario\SceneContainerInstance;
use App\Models\scenario\SceneSwitchInstance;
use App\Models\scenario\SceneVmInstance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Services\DockerService;
use App\RunTool\CommandLineService;
use App\RunTool\TopologyParser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;
use App\Utils\JWTControll;      // ★ 1. 确保导入 JWTControll
use Illuminate\Support\Facades\Cache;  // ★ 1. 确保导入 Cache
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use App\Models\ad\Team;
use App\Models\ad\AdConfig;


class InstanceController extends Controller
{
    protected DockerService $docker;
    protected CommandLineService $cliService;
    private array $vmImageOsMap = [];

    public function __construct(DockerService $docker, CommandLineService $cliService, Request $req)
    {
        // 加载父类的构造方法
        parent::__construct($req);

        $this->docker = $docker;
        $this->cliService = $cliService;
        $this->loadVmImageOsMap();
    }


    public function index()
    {
        try {
            $instances = SceneInstance::with('sceneConfig')->latest('c_runtime')->get();
            $data = $instances->map(function ($instance) {
                return [
                    'instance_id'   => $instance->c_scene_instances_id,
                    'scenario_name' => $instance->sceneConfig->c_name ?? '未知场景',
                    'scenario_description' => $instance->sceneConfig->c_description ?? '',
                    'username'      => $instance->c_username,
                    'runtime'       => $instance->c_runtime ? $instance->c_runtime->toIso8601String() : null,
                    'status'        => $instance->c_status,
                    // 新增：直接返回场景实例保存的场景配置 JSON
                    'c_scene_config'=> $instance->c_scene_config,
                ];
            });
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('获取场景实例列表时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，获取列表失败。'], 500);
        }
    }

    public function show(SceneInstance $instance, Request $request)
        {
            try {
                // --- START: 权限计算逻辑 (与 VmController 类似) ---
                $container_stop = 0;
                $container_restart = 0;
                $container_delete = 0;

                $auth = $request->header("Authorization", null);
                $jwtRes = JWTControll::decodeJWT($auth);
                if ($jwtRes["err"] != null) {
                    abort(401, '无效的令牌');
                }
                $tokenData = $jwtRes["data"];

                $permissions = Cache::get($tokenData["permission"]) ?? [];
                $permissionIds = array_map(fn($item) => $item->c_id, $permissions);

                // 假设权限ID为 'container_stop', 'container_restart', 'container_delete'
                if (in_array("container_stop", $permissionIds)) $container_stop = 1;
                if (in_array("container_restart", $permissionIds)) $container_restart = 1;
                if (in_array("container_delete", $permissionIds)) $container_delete = 1;
                // --- END: 权限计算逻辑 ---

                $instance->load('containers', 'sceneConfig');
                $runningInstances = [];
                foreach ($instance->containers as $containerInstance) {
                    $containerId = $containerInstance->c_container_id;
                    try {
                        $details = $this->docker->containerInspect($containerId);
                        $stats = $this->docker->containerStats($containerId);
                        $cpuDelta = ($stats->cpu_stats->cpu_usage->total_usage ?? 0) - ($stats->precpu_stats->cpu_usage->total_usage ?? 0);
                        $sysDelta = ($stats->cpu_stats->system_cpu_usage ?? 0) - ($stats->precpu_stats->system_cpu_usage ?? 0);
                        $cpus = $stats->cpu_stats->online_cpus ?? (is_array($stats->cpu_stats->cpu_usage->percpu_usage ?? null) ? count($stats->cpu_stats->cpu_usage->percpu_usage) : 1);
                        $cpuPercent = $sysDelta > 0 ? ($cpuDelta / $sysDelta) * $cpus * 100 : 0;
                        $memUsage = $stats->memory_stats->usage ?? 0;
                        $memLimit = $stats->memory_stats->limit ?? 0;

                        $ports = [];
                        foreach ($details->getHostConfig()->getPortBindings() ?? [] as $portKey => $bindingList) {
                            foreach ($bindingList ?? [] as $b) {
                                $ports[] = "{$b->getHostPort()}:" . strtok($portKey, '/');
                            }
                        }

                        // ★★★ START: 权限合并与编码 ★★★
                        // 调用模型进行对象级权限判断
                        $can_operate_object_level = $containerInstance->canBeOperatedByUser((object)["token_data" => $tokenData]);

                        // 合并全局和对象级权限
                        $permissionsPayload = [
                            "container_stop"     => $container_stop && $can_operate_object_level,
                            "container_restart"  => $container_restart && $can_operate_object_level,
                            "container_delete"   => $container_delete && $can_operate_object_level,
                            "can_operate"        => $can_operate_object_level, // 通用操作权限 (例如进入终端)
                        ];
                        // ★★★ END: 权限合并与编码 ★★★

                        $runningInstances[] = [
                            'id' => $details->getId(),
                            'name' => ltrim($details->getName() ?? '', '/'),
                            'type' => 'container',
                            'ipAddress' => $containerInstance->c_ip,
                            'team_id' => $containerInstance->c_team_id, // ★ 添加 team_id
                            'scene_instance_id' => $containerInstance->c_scene_instances_id,
                            'scene_name' => $instance->sceneConfig->c_name ?? null,
                            'status' => $this->mapStatus($details->getState()->getStatus()),
                            'ports' => implode(', ', $ports),
                            'imageName' => $details->getConfig()->getImage(),
                            'cpuUsage' => sprintf('%.1f%%', $cpuPercent),
                            'memoryUsage' => sprintf('%.1fMB / %.1fMB', $memUsage / 1048576, $memLimit / 1048576),
                            'uptime' => $details->getState()->getStartedAt(),
                            'createdAt' => $details->getCreated(),
                            'is_target' => !empty($containerInstance->c_flag),
                            'can_operate' => base64_encode(json_encode($permissionsPayload)), // ★ 添加编码后的权限对象
                        ];
                    } catch (\Exception $e) {
                        Log::warning("无法 inspect 容器 {$containerId}: " . $e->getMessage());
                    }
                }
                return response()->json($runningInstances);
            } catch (\Exception $e) {
                Log::error("获取实例详情时发生错误 for instance {$instance->c_scene_instances_id}: " . $e->getMessage());
                return response()->json(['message' => '获取实例详情失败。'], 500);
            }
        }
    /**
     * 获取指定场景实例的配置信息，特别是 c_scene_config 拓扑JSON。
     *
     * @param  string $instanceId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getConfig($instanceId): JsonResponse
        {
            try {
                $instance = SceneInstance::findOrFail($instanceId);

                return response()->json([
                    'c_scene_instances_id' => $instance->c_scene_instances_id,
                    'c_scene_config' => $instance->c_scene_config,
                ]);

            } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
                return response()->json(['message' => '场景实例配置未找到。'], 404);
            } catch (\Exception $e) {
                Log::error("获取场景实例配置时发生错误 (ID: {$instanceId}): " . $e->getMessage());
                return response()->json(['message' => '服务器内部错误'], 500);
            }
        }


    /**
     *  核心修复：添加了对关联表记录和虚拟机实例文件夹的删除
     */
    public function destroy(SceneInstance $instance)
    {
        $instanceId = $instance->c_scene_instances_id;
        Log::info("开始删除场景实例: {$instanceId}");

        // 先尝试根据场景配置JSON中的 iptablesRules 删除对应转发规则（按 hostPort 匹配）
        try {
            $instance->load('sceneConfig');
            $sceneConfig = $instance->sceneConfig;
            $topology = $sceneConfig?->c_scene ?? null;
            if (is_array($topology)) {
                $parsed = TopologyParser::parse($topology);
                $iptablesRules = $parsed['iptablesRules'] ?? [];
                if (!empty($iptablesRules)) {
                    Log::info('开始清理该实例的 iptables 转发规则（基于 hostPort 匹配）', [
                        'instance' => $instanceId,
                        'rule_count' => count($iptablesRules),
                    ]);
                    // 先删除回程规则（依赖 DNAT 反查时，确保DNAT尚在）
                    try {
                        $this->cliService->removePostroutingMasqueradeForRules($iptablesRules, $parsed['connections'] ?? [], 'br0');
                    } catch (\Throwable $e) {
                        Log::warning('删除 MASQUERADE 回程规则时出现警告: ' . $e->getMessage());
                    }

                    // 再删除 PREROUTING DNAT（按 hostPort 精确删除）
                    $this->cliService->removeIptablesRulesByHostPorts($iptablesRules, $instanceId);
                } else {
                    Log::info('该实例场景未配置 iptablesRules，跳过转发规则清理。');
                }
            } else {
                Log::warning('未获取到场景拓扑JSON，无法清理 iptables 转发规则。');
            }
        } catch (\Throwable $e) {
            Log::error('清理 iptables 转发规则时发生错误（将继续删除其他资源）: ' . $e->getMessage());
        }

        $instance->load(['containers', 'vms', 'switches']);
        $errors = [];

        // 将所有数据库操作包裹在一个事务中
        DB::beginTransaction();
        try {
            // 步骤 1: 清理物理资源 (虚拟机、容器、交换机)
            foreach ($instance->vms as $vm) {
                try {
                    $this->deleteVmAndStorage($vm->c_vm_name);
                } catch (\Exception $e) {
                    $errors[] = "删除虚拟机 '{$vm->c_vm_name}' 失败: " . $e->getMessage();
                    Log::error($errors[count($errors) - 1]);
                }
            }

            foreach ($instance->containers as $container) {
                try {
                    $this->docker->stopContainer($container->c_container_id);
                    $this->docker->removeContainer($container->c_container_id);
                } catch (\Exception $e) {
                    $errors[] = "删除容器 '{$container->c_container_id}' 失败: " . $e->getMessage();
                    Log::error($errors[count($errors) - 1]);
                }
            }

            foreach ($instance->switches as $switch) {
                try {
                    // 先断开与 ovs-switch 的连接，避免 OVS 残留
                    $this->cliService->disconnectSwitchToSwitch($switch->c_switch_name, 'ovs-switch');
                    Log::info("已断开交换机 '{$switch->c_switch_name}' 与 ovs-switch 的连接");
                } catch (\Exception $e) {
                    Log::warning("断开交换机 '{$switch->c_switch_name}' 连接时出现错误: " . $e->getMessage());
                    // 断开连接失败不影响后续删除操作
                }

                try {
                    $this->cliService->deleteSwitch($switch->c_switch_name);
                } catch (\Exception $e) {
                    $errors[] = "删除交换机 '{$switch->c_switch_name}' 失败: " . $e->getMessage();
                    Log::error($errors[count($errors) - 1]);
                }
            }

            // ★★★ 新增：删除虚拟机实例文件夹 ★★★
            $baseDir = $this->_get_global_directory();
            $instanceDirectory = $baseDir . '/virsh/instances/' . $instanceId;
            try {
                if (File::isDirectory($instanceDirectory)) {
                    File::deleteDirectory($instanceDirectory);
                    Log::info("已成功删除虚拟机实例目录: {$instanceDirectory}");
                } else {
                    Log::warning("虚拟机实例目录未找到，无需删除: {$instanceDirectory}");
                }
            } catch (\Exception $e) {
                $errors[] = "删除虚拟机实例目录 '{$instanceDirectory}' 失败: " . $e->getMessage();
                Log::error($errors[count($errors) - 1]);
            }


            //新增的数据库清理步骤
            // 步骤 2: 删除所有关联的数据库记录
            $instance->vms()->delete();
            Log::info("已删除实例 {$instanceId} 的所有虚拟机数据库记录。");

            $instance->containers()->delete();
            Log::info("已删除实例 {$instanceId} 的所有容器数据库记录。");

            $instance->switches()->delete();
            Log::info("已删除实例 {$instanceId} 的所有交换机数据库记录。");

            // 步骤 3: 最后删除场景实例自身的主记录
            $instance->delete();
            Log::info("已从数据库中删除场景实例主记录: {$instanceId}");

            // 如果所有操作都成功，提交事务
            DB::commit();

            if (!empty($errors)) {
                return response()->json([
                    'message' => '场景实例已删除，但部分物理资源清理失败。数据库记录已清理。',
                    'detail' => implode('; ', $errors),
                ], 207);
            }

            return response()->json(['message' => '场景实例及其所有关联资源已成功删除。'], 200);

        } catch (\Exception $e) {
            // 如果发生任何数据库错误，回滚所有操作
            DB::rollBack();
            Log::critical("删除场景实例 {$instanceId} 时发生严重数据库错误: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => '删除场景实例时发生严重错误，操作已回滚。',
                'detail' => $e->getMessage(),
            ], 500);
        }
    }

    public function getDetails(string $instanceId)
        {
            try {
                // 步骤 1: 手动查找模型，替代路由模型绑定
                $instance = SceneInstance::find($instanceId);

                // 步骤 2: 增加一个检查，如果找不到，返回一个明确的 404 错误
                if (!$instance) {
                    return response()->json(['message' => "场景实例 (ID: {$instanceId}) 不存在或已被删除。"], 404);
                }

                // 步骤 3: 使用 Eloquent 的预加载功能，一次性查询出所有关联的资源。
                $instance->load([
                    'vms:c_vm_name,c_scene_instances_id,c_ip,c_flag',
                    'containers:c_container_name,c_container_id,c_scene_instances_id,c_ip,c_flag',
                    'switches:c_switch_name,c_scene_instances_id',
                    'sceneConfig:c_config_id,c_name'
                ]);

                // 步骤 4: 将数据格式化为前端友好的结构
                $data = [
                    'instance_id'   => $instance->c_scene_instances_id,
                    'scenario_name' => $instance->sceneConfig->c_name ?? '未知场景',
                    'status'        => $instance->c_status,
                    'resources'     => [
                        // ★ 核心修复点 1 ★
                        // 在 map 之前调用 filter() 移除 null，然后调用 values() 重置数组索引
                        'vms' => $instance->vms
                            ->filter()
                            ->map(function ($vm) {
                                return [
                                    'name'      => $vm->c_vm_name,
                                    'id'        => $vm->c_vm_name, // 前端 key 需要 id，这里用 name 暂代
                                    'ip'        => $vm->c_ip,
                                    'is_target' => !empty($vm->c_flag),
                                ];
                            })
                            ->values(),

                        // ★ 核心修复点 2 ★
                        'containers' => $instance->containers
                            ->filter()
                            ->map(function ($container) {
                                return [
                                    'name'      => $container->c_container_name,
                                    'id'        => substr($container->c_container_id, 0, 12),
                                    'ip'        => $container->c_ip,
                                    'is_target' => !empty($container->c_flag),
                                ];
                            })
                            ->values(),

                        // ★ 核心修复点 3 ★
                        'switches' => $instance->switches
                            ->filter()
                            ->map(function ($switch) {
                                return [
                                    'name' => $switch->c_switch_name,
                                    'id'   => $switch->c_switch_name, // 前端 key 需要 id，这里用 name 暂代
                                ];
                            })
                            ->values(),
                    ]
                ];

                return response()->json(['status' => 'success', 'data' => $data]);

            } catch (\Exception $e) {
                Log::error("获取实例聚合详情时发生错误 for instance {$instanceId}: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
                return response()->json(['message' => '获取实例详情失败，请查看服务器日志。'], 500);
            }
        }

    /**
     * 步骤 3: 修改此函数以使用新的 runCommand 方法
     */
    private function deleteVmAndStorage(string $vmName): void
    {
        Log::info("开始处理虚拟机删除: {$vmName}");

        // 步骤1: 强制关机 (destroy)
        try {
            $this->runCommand(['virsh', 'destroy', $vmName]);
            Log::info("已强制关闭虚拟机: {$vmName}");
        } catch (ProcessFailedException $e) {
            $errorOutput = $e->getProcess()->getErrorOutput();
            // 如果错误是“找不到域”，则这是一个可接受的场景，我们只记录警告并继续。
            if (str_contains($errorOutput, 'failed to get domain') || str_contains($errorOutput, 'domain not found')) {
                Log::warning("虚拟机 '{$vmName}' 在关机时未找到，可能已被关闭或删除。");
            } else {
                // 如果是其他未知错误，则向上抛出异常，让上层处理。
                throw $e;
            }
        }

        // 步骤2: 取消定义并删除所有关联的存储卷
        try {
            $this->runCommand(['virsh', 'undefine', $vmName, '--remove-all-storage', '--snapshots-metadata']);
            Log::info("已取消定义虚拟机 '{$vmName}' 并移除其所有存储。");
        } catch (ProcessFailedException $e) {
            $errorOutput = $e->getProcess()->getErrorOutput();
            // 同样，如果在这里找不到域，也是正常的，因为可能上一步就没有这个域了。
            if (str_contains($errorOutput, 'failed to get domain') || str_contains($errorOutput, 'domain not found')) {
                Log::warning("虚拟机 '{$vmName}' 在取消定义时未找到，可能已被删除。");
            } else {
                throw $e;
            }
        }
    }

    /**
     * 步骤 2: 添加一个新的私有方法用于执行命令 ★★★
     */
    private function runCommand(array $command): string
    {
        $process = new Process($command);
        $process->run();

        if (!$process->isSuccessful()) {
            // 抛出异常，包含错误输出
            throw new ProcessFailedException($process);
        }

        // 返回命令的输出
        return $process->getOutput();
    }

    private function mapStatus(string $dockerStatus): string
    {
        if ($dockerStatus === 'running') return 'running';
        if ($dockerStatus === 'exited') return 'stopped';
        return $dockerStatus;
    }

    /**
     * 清理并删除指定场景实例的所有底层资源（VM、容器、交换机），
     * 但保留数据库中的所有相关记录，并将实例状态更新为 'STOPPED'。
     *
     * @param  \App\Models\scenario\SceneInstance  $instance
     * @return \Illuminate\Http\JsonResponse
     */
    public function tearDownResources(SceneInstance $instance)
    {
        $instanceId = $instance->c_scene_instances_id;
        Log::info("开始清理场景实例的底层资源: {$instanceId}");

        // 加载所有关联的资源模型
        $instance->load(['containers', 'vms', 'switches']);
        $errors = [];

        // 步骤 1: 清理物理资源 (虚拟机、容器、交换机)
        foreach ($instance->vms as $vm) {
            try {
                $this->deleteVmAndStorage($vm->c_vm_name);
            } catch (\Exception $e) {
                $errors[] = "删除虚拟机 '{$vm->c_vm_name}' 失败: " . $e->getMessage();
                Log::error($errors[count($errors) - 1]);
            }
        }

        foreach ($instance->containers as $container) {
            try {
                // 使用Docker服务停止容器
                $this->docker->stopContainer($container->c_container_id);
                // 直接调用Docker客户端删除容器，以绕过服务层中删除数据库记录的逻辑
                $this->docker->docker->containerDelete($container->c_container_id, ['force' => true]);
            } catch (\Exception $e) {
                $errors[] = "删除容器 '{$container->c_container_id}' 失败: " . $e->getMessage();
                Log::error($errors[count($errors) - 1]);
            }
        }

        foreach ($instance->switches as $switch) {
            try {
                // 先断开与 ovs-switch 的连接，避免 OVS 残留
                $this->cliService->disconnectSwitchToSwitch($switch->c_switch_name, 'ovs-switch');
                Log::info("已断开交换机 '{$switch->c_switch_name}' 与 ovs-switch 的连接");
            } catch (\Exception $e) {
                Log::warning("断开交换机 '{$switch->c_switch_name}' 连接时出现错误: " . $e->getMessage());
                // 断开连接失败不影响后续删除操作
            }

            try {
                $this->cliService->deleteSwitch($switch->c_switch_name);
            } catch (\Exception $e) {
                $errors[] = "删除交换机 '{$switch->c_switch_name}' 失败: " . $e->getMessage();
                Log::error($errors[count($errors) - 1]);
            }
        }

        // 步骤 2: 删除虚拟机实例文件夹
        $baseDir = $this->_get_global_directory();
        $instanceDirectory = $baseDir . '/virsh/instances/' . $instanceId;
        try {
            if (File::isDirectory($instanceDirectory)) {
                File::deleteDirectory($instanceDirectory);
                Log::info("已成功删除虚拟机实例目录: {$instanceDirectory}");
            } else {
                Log::warning("虚拟机实例目录未找到，无需删除: {$instanceDirectory}");
            }
        } catch (\Exception $e) {
            $errors[] = "删除虚拟机实例目录 '{$instanceDirectory}' 失败: " . $e->getMessage();
            Log::error($errors[count($errors) - 1]);
        }

        // 步骤 3: 更新实例状态为 'STOPPED'，但不删除记录
        try {
            $instance->c_status = 'STOPPED';
            $instance->save();
            Log::info("已将实例 {$instanceId} 的状态更新为 STOPPED。");
        } catch (\Exception $e) {
            $errors[] = "更新实例 {$instanceId} 的状态失败: " . $e->getMessage();
            Log::error($errors[count($errors) - 1]);
        }

        if (!empty($errors)) {
            return response()->json([
                'message' => '场景资源清理完成，但过程中出现部分错误。',
                'detail' => implode('; ', $errors),
            ], 207); // 207 Multi-Status
        }

        return response()->json(['message' => '场景实例的底层资源已成功清理，所有数据库记录已保留。'], 200);
    }

    /**
     * 新增：更新场景实例表的 c_scene_config JSON 字段
     * 请求体示例：
     * {
     *   "topology": { "nodes": [...], "edges": [...] }
     * }
     */
    public function updateSceneConfig(Request $request, SceneInstance $instance)
    {
        try {
            $validated = \Validator::make($request->all(), [
                'topology' => 'required|array',
                'topology.nodes' => 'present|array',
                'topology.edges' => 'present|array',
            ])->validate();

            $instance->c_scene_config = $validated['topology'];
            $instance->save();

            // 应用拓扑差异：按新增节点与连接进行资源创建与连接
            $applyResult = $this->applyTopologyDiff($instance, $instance->c_scene_config);

            return response()->json([
                'message' => '场景实例拓扑已更新并应用',
                'data' => [
                    'instance_id' => $instance->c_scene_instances_id,
                    'c_scene_config' => $instance->c_scene_config,
                ],
                'applied' => $applyResult,
            ], 200);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => '数据验证失败',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('更新场景实例拓扑失败: ' . $e->getMessage(), [
                'instance' => $instance->c_scene_instances_id,
            ]);
            return response()->json([
                'message' => '服务器内部错误，更新失败。'
            ], 500);
        }
    }

    /**
     * 解析并应用拓扑差异：创建新增的交换机、容器、虚拟机，并建立必要连接。
     * 仅处理新增，不删除既有资源。
     */
    private function applyTopologyDiff(SceneInstance $instance, array $topology): array
    {
        $parsed = TopologyParser::parse($topology);
        $connections = &$parsed['connections'];

        // 给未指定的连接分配 IP，避免冲突（基于 DB 中已有 IP）
        try {
            $this->assignIpAddresses($connections);
        } catch (\Exception $e) {
            Log::warning('为新拓扑连接分配IP失败: ' . $e->getMessage());
        }

        $nodesById = collect($topology['nodes'] ?? [])->keyBy('id');

        $instanceShortId = substr(str_replace('-', '', $instance->c_scene_instances_id), -8);
        $switchIdSuffix  = substr(str_replace('-', '', $instance->c_scene_instances_id), -5);

        $createdSwitchesInfo = []; // nodeId => ['actual_name' => ..., 'label' => ...]
        $actualSwitchNames = [];   // nodeId => actual switch name
        $newSwitchNodeIds = [];

        // 现有交换机映射
        $existingSwitchNames = SceneSwitchInstance::where('c_scene_instances_id', $instance->c_scene_instances_id)
            ->pluck('c_switch_name')->all();

        foreach ($parsed['switches'] as $sw) {
            $expectedName = $this->sanitizeName($sw['label']) . '_' . $switchIdSuffix;
            $actualSwitchNames[$sw['id']] = $expectedName;
            if (!in_array($expectedName, $existingSwitchNames, true)) {
                try {
                    $this->cliService->createSwitch($expectedName, null, true);
                    // 与总交换机相连
                    $this->cliService->connectSwitchToSwitch($expectedName, 'ovs-switch');
                    SceneSwitchInstance::create([
                        'c_switch_name' => $expectedName,
                        'c_scene_instances_id' => $instance->c_scene_instances_id,
                    ]);
                    $createdSwitchesInfo[$sw['id']] = ['actual_name' => $expectedName, 'label' => $sw['label']];
                    $newSwitchNodeIds[$sw['id']] = true;
                } catch (\Exception $e) {
                    Log::error('创建/连接交换机失败: ' . $e->getMessage(), ['switch' => $expectedName]);
                }
            } else {
                $createdSwitchesInfo[$sw['id']] = ['actual_name' => $expectedName, 'label' => $sw['label']];
            }
        }

        $createdItemsInfo = [];   // nodeId => ['id'=>..., 'actual_name'=>..., 'type'=>...]
        $newItemNodeIds = [];     // nodeId => true for new container/vm

        // 现有容器与虚拟机名称集合
        $existingContainerNames = SceneContainerInstance::where('c_scene_instances_id', $instance->c_scene_instances_id)
            ->pluck('c_container_name')->all();
        $existingVmNames = SceneVmInstance::where('c_scene_instances_id', $instance->c_scene_instances_id)
            ->pluck('c_vm_name')->all();

        // 预采集容器 IP（从连接中）
        $containerIps = [];
        foreach ($connections as $conn) {
            if ($conn['source']['type'] === 'container' && !empty($conn['source']['ip'])) {
                $containerIps[$conn['source']['id']] = $conn['source']['ip'];
            }
            if ($conn['target']['type'] === 'container' && !empty($conn['target']['ip'])) {
                $containerIps[$conn['target']['id']] = $conn['target']['ip'];
            }
        }

        // 创建容器
        foreach ($parsed['containers'] as $c) {
            $expectedName = $this->sanitizeName($c['label']) . '_' . $instanceShortId;
            if (!in_array($expectedName, $existingContainerNames, true)) {
                try {
                    $options = [
                        'image' => $c['image'],
                        'name'  => $expectedName,
                        'ports' => $c['portMappings'],
                        'env'   => $c['env'],
                        'scene_instance_id' => $instance->c_scene_instances_id,
                    ];
                    $flagUuid = null;
                    if (!empty($c['isTarget'])) {
                        $flagUuid = Str::uuid()->toString();
                        $options['env'][] = ['key' => 'FLAG', 'value' => $flagUuid];
                    }
                    $containerId = $this->cliService->createContainer($options);
                    $containerIp = $containerIps[$c['id']] ?? null;

                    SceneContainerInstance::create([
                        'c_container_id' => $containerId,
                        'c_scene_instances_id' => $instance->c_scene_instances_id,
                        'c_flag' => $flagUuid,
                        'c_ip' => $containerIp,
                        'c_container_name' => $expectedName,
                    ]);
                    $createdItemsInfo[$c['id']] = [
                        'id' => $containerId, 'actual_name' => $expectedName, 'type' => 'container'
                    ];
                    $newItemNodeIds[$c['id']] = true;
                } catch (\Exception $e) {
                    Log::error('创建容器失败: ' . $e->getMessage(), ['container' => $expectedName]);
                }
            } else {
                $createdItemsInfo[$c['id']] = [
                    'id' => null, 'actual_name' => $expectedName, 'type' => 'container'
                ];
            }
        }

        // 创建虚拟机并连接到交换机（按连接）
        $baseDir = $this->_get_global_directory();
        $imageDir = $baseDir . '/virsh/images';
        $instanceBaseDir = $baseDir . '/virsh/instances/' . $instance->c_scene_instances_id;

        $vmsParsed = collect($parsed['vms'])->keyBy('id');
        foreach ($connections as $conn) {
            $itemNode = null; $switchNode = null; $ip = null;
            if ($conn['source']['type'] === 'virtual_machine' && $conn['target']['type'] === 'switch') {
                $itemNode = $nodesById[$conn['source']['id']] ?? null;
                $switchNode = $nodesById[$conn['target']['id']] ?? null;
                $ip = $conn['source']['ip'] ?? null;
            } elseif ($conn['target']['type'] === 'virtual_machine' && $conn['source']['type'] === 'switch') {
                $itemNode = $nodesById[$conn['target']['id']] ?? null;
                $switchNode = $nodesById[$conn['source']['id']] ?? null;
                $ip = $conn['target']['ip'] ?? null;
            }

            if (!$itemNode || !$switchNode) continue;

            $expectedVmName = $this->sanitizeName($itemNode['label']) . '_' . $instanceShortId;
            $alreadyExists = in_array($expectedVmName, $existingVmNames, true);
            $actualSwitchName = $actualSwitchNames[$switchNode['id']] ?? null;
            if (!$actualSwitchName) continue;

            if (!$alreadyExists) {
                try {
                    $parsedVmNode = $vmsParsed[$itemNode['id']] ?? null;
                    $correctImageName = $parsedVmNode['image'] ?? null;
                    if (empty($correctImageName) || $correctImageName === 'vm-qemu:latest') {
                        $correctImageName = 'v_att_tcpScanning';
                        Log::info("节点 {$itemNode['label']} 未指定镜像或镜像无效, 使用默认镜像: {$correctImageName}");
                    }
                    $imageFileName = Str::endsWith($correctImageName, '.qcow2') ? $correctImageName : $correctImageName . '.qcow2';
                    $osData = $this->vmImageOsMap[$imageFileName] ?? null;
                    $osType = strtolower($osData['osType'] ?? 'ubuntu');

                    $flagUuid = null;
                    if (!empty($parsedVmNode['isTarget'])) {
                        $flagUuid = Str::uuid()->toString();
                    }

                    $vmInstance = SceneVmInstance::create([
                        'c_vm_name'            => $expectedVmName,
                        'c_scene_instances_id' => $instance->c_scene_instances_id,
                        'c_ip'                 => $ip,
                        'c_flag'               => $flagUuid,
                    ]);
                    $vmDbId = $vmInstance->c_vm_id;

                    if ($osType === 'win7') {
                        $this->cliService->createVmWin7([
                            'id'                => $vmDbId,
                            'vm_name'           => $expectedVmName,
                            'image'             => $correctImageName,
                            'ip'                => $ip,
                            'scene_instance_id' => $instance->c_scene_instances_id,
                            'flag'              => $flagUuid ?? 'NULL',
                            'switch_name'       => $actualSwitchName,
                            'image_dir'         => $imageDir,
                            'instance_base_dir' => $instanceBaseDir,
                        ]);
                    } elseif ($osType === 'win7_1') {
                        $this->cliService->createVmWin7_1([
                            'id'                => $vmDbId,
                            'vm_name'           => $expectedVmName,
                            'image'             => $correctImageName,
                            'switch_name'       => $actualSwitchName,
                            'image_dir'         => $imageDir,
                            'instance_base_dir' => $instanceBaseDir,
                        ]);
                    } elseif ($osType === 'win2003') {
                        $this->cliService->createVmWin2003([
                            'id'                => $vmDbId,
                            'vm_name'           => $expectedVmName,
                            'image'             => $correctImageName,
                            'switch_name'       => $actualSwitchName,
                            'image_dir'         => $imageDir,
                            'instance_base_dir' => $instanceBaseDir,
                        ]);
                    } else {
                        $this->cliService->createVm([
                            'id'                => $vmDbId,
                            'vm_name'           => $expectedVmName,
                            'image'             => $correctImageName,
                            'ip'                => $ip,
                            'scene_instance_id' => $instance->c_scene_instances_id,
                            'flag'              => $flagUuid ?? 'NULL',
                            'switch_name'       => $actualSwitchName,
                            'image_dir'         => $imageDir,
                            'instance_base_dir' => $instanceBaseDir,
                        ]);
                    }

                    $createdItemsInfo[$itemNode['id']] = [
                        'id' => $vmDbId, 'actual_name' => $expectedVmName, 'type' => 'virtual_machine'
                    ];
                    $newItemNodeIds[$itemNode['id']] = true;
                } catch (\Exception $e) {
                    Log::error('创建虚拟机失败: ' . $e->getMessage(), ['vm' => $expectedVmName]);
                }
            } else {
                $createdItemsInfo[$itemNode['id']] = [
                    'id' => null, 'actual_name' => $expectedVmName, 'type' => 'virtual_machine'
                ];
            }
        }

        // 建立连接：仅针对新增节点涉及的连接，避免重复
        foreach ($connections as $conn) {
            $source = $conn['source'];
            $target = $conn['target'];

            if ($source['type'] === 'switch' && $target['type'] === 'switch') {
                $srcNew = !empty($newSwitchNodeIds[$source['id']]);
                $tgtNew = !empty($newSwitchNodeIds[$target['id']]);
                if ($srcNew || $tgtNew) {
                    try {
                        $this->cliService->connectSwitchToSwitch(
                            $createdSwitchesInfo[$source['id']]['actual_name'] ?? ($actualSwitchNames[$source['id']] ?? ''),
                            $createdSwitchesInfo[$target['id']]['actual_name'] ?? ($actualSwitchNames[$target['id']] ?? '')
                        );
                    } catch (\Exception $e) {
                        Log::warning('连接交换机-交换机失败(可能已存在): ' . $e->getMessage());
                    }
                }
            }
            elseif (($source['type'] === 'container' && $target['type'] === 'switch') || ($source['type'] === 'switch' && $target['type'] === 'container')) {
                $containerNode = $source['type'] === 'container' ? $source : $target;
                $switchNode = $source['type'] === 'switch' ? $source : $target;
                $isNew = !empty($newItemNodeIds[$containerNode['id']]) || !empty($newSwitchNodeIds[$switchNode['id']]);
                if ($isNew) {
                    try {
                        $this->cliService->connectContainerToSwitch(
                            $createdSwitchesInfo[$switchNode['id']]['actual_name'] ?? ($actualSwitchNames[$switchNode['id']] ?? ''),
                            $createdItemsInfo[$containerNode['id']]['actual_name'] ?? $this->sanitizeName($containerNode['label']) . '_' . $instanceShortId,
                            $containerNode['ip'] ?? null
                        );
                    } catch (\Exception $e) {
                        Log::warning('连接容器-交换机失败(可能已存在): ' . $e->getMessage());
                    }
                }
            }
            elseif (($source['type'] === 'switch' && $target['type'] === 'nat_bridge') || ($source['type'] === 'nat_bridge' && $target['type'] === 'switch')) {
                $switchNode = $source['type'] === 'switch' ? $source : $target;
                $bridgeNode = $source['type'] === 'nat_bridge' ? $source : $target;
                $isNew = !empty($newSwitchNodeIds[$switchNode['id']]);
                if ($isNew) {
                    $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'] ?? ($actualSwitchNames[$switchNode['id']] ?? '');
                    $bridgeName = $bridgeNode['label'];
                    try {
                        $this->cliService->connectSwitchToBr0($actualSwitchName, $bridgeName);
                    } catch (\Exception $e) {
                        Log::warning('连接交换机到 Bridge 失败(可能已存在): ' . $e->getMessage());
                    }
                }
            }
        }

        // 若有 NAT 连接，为新容器设置路由
        $gatewayIp = '10.100.0.254/16';
        $switchesConnectedToBridge = [];
        foreach ($connections as $conn) {
            if ($conn['source']['type'] === 'nat_bridge' && $conn['target']['type'] === 'switch') {
                $switchesConnectedToBridge[$conn['target']['id']] = true;
            } elseif ($conn['target']['type'] === 'nat_bridge' && $conn['source']['type'] === 'switch') {
                $switchesConnectedToBridge[$conn['source']['id']] = true;
            }
        }

        $containersToRoute = [];
        if (!empty($switchesConnectedToBridge)) {
            foreach ($connections as $conn) {
                $containerNode = null;
                $switchNode = null;
                if ($conn['source']['type'] === 'container' && $conn['target']['type'] === 'switch') {
                    $containerNode = $conn['source'];
                    $switchNode = $conn['target'];
                } elseif ($conn['target']['type'] === 'container' && $conn['source']['type'] === 'switch') {
                    $containerNode = $conn['target'];
                    $switchNode = $conn['source'];
                }
                if ($containerNode && isset($switchesConnectedToBridge[$switchNode['id']]) && !empty($newItemNodeIds[$containerNode['id']])) {
                    $containersToRoute[] = ['name' => $createdItemsInfo[$containerNode['id']]['actual_name']];
                }
            }
        }
        if (!empty($containersToRoute)) {
            try {
                $this->cliService->configureBridgeAndRoutes('br0', $gatewayIp, $containersToRoute);
            } catch (\Exception $e) {
                Log::warning('配置网关和路由失败: ' . $e->getMessage());
            }
        }

        return [
            'new_switches'  => array_keys($newSwitchNodeIds),
            'new_items'     => array_keys($newItemNodeIds),
        ];
    }

    private function sanitizeName(string $label): string
    {
        return str_replace([' '], '_', $label);
    }

    /**
     * 复制 DrillController 的 IP 分配逻辑，避免与数据库中已有IP冲突。
     */
    private function assignIpAddresses(array &$connections): void
    {
        $vmIps = DB::table('c_scene_vm_instances')->whereNotNull('c_ip')->pluck('c_ip');
        $containerIps = DB::table('c_scene_container_instances')->whereNotNull('c_ip')->pluck('c_ip');

        $existingIps = $vmIps->merge($containerIps)->map(function ($ip) {
            return explode('/', $ip)[0];
        })->unique()->flip();

        $octet3 = 0;
        $octet4 = 0;

        $getNextIp = function() use (&$octet3, &$octet4, &$existingIps) {
            do {
                if ($octet4 >= 254) {
                    $octet4 = 1;
                    $octet3++;
                } else {
                    $octet4++;
                }

                if ($octet3 >= 255) {
                    throw new \Exception("IP地址池 10.100.0.0/16 已耗尽。");
                }

                $newIp = "10.100.{$octet3}.{$octet4}";

            } while (isset($existingIps[$newIp]));

            $existingIps[$newIp] = true;
            return $newIp . "/16";
        };

        foreach ($connections as &$connection) {
            if ($connection['source']['type'] === 'nat_bridge' || $connection['target']['type'] === 'nat_bridge') {
                continue;
            }
            if (empty($connection['source']['ip'])) {
                $connection['source']['ip'] = $getNextIp();
            }
            if (empty($connection['target']['ip'])) {
                $connection['target']['ip'] = $getNextIp();
            }
        }
        unset($connection);
    }

/**
     * 获取指定场景实例下的所有可分配节点（容器和虚拟机）。
     *
     * @param  \App\Models\scenario\SceneInstance  $instance
     * @return \Illuminate\Http\JsonResponse
     */
    public function getNodesForAssignment(SceneInstance $instance): JsonResponse
    {
        try {
            // --- 步骤 1: 获取系统中所有的队伍（用于下拉菜单） ---
            $allTeams = Team::all(['c_id', 'c_name']);

            // --- 步骤 2: 从节点实例表中直接获取所有唯一的 team_id ---
            $containerTeamIds = SceneContainerInstance::where('c_scene_instances_id', $instance->c_scene_instances_id)
                ->distinct()
                ->pluck('c_team_id');

            $vmTeamIds = SceneVmInstance::where('c_scene_instances_id', $instance->c_scene_instances_id)
                ->distinct()
                ->pluck('c_team_id');

            $currentTeamIds = $containerTeamIds->merge($vmTeamIds)->unique()->filter()->values();

            // --- 步骤 3: 根据找到的 team_id，获取这些队伍及其成员的详细信息 ---
            $currentTeamsWithMembers = collect([]);
            if ($currentTeamIds->isNotEmpty()) {
                $currentTeamsWithMembers = Team::whereIn('c_id', $currentTeamIds)
                    ->with(['users:c_username,c_name'])
                    ->get()
                    ->keyBy('c_id');
            }

            // --- 步骤 4: 获取所有节点（容器和虚拟机） ---
            $containers = $instance->containers()->get(['c_container_id', 'c_container_name', 'c_team_id']);
            $vms = $instance->vms()->get(['c_vm_id', 'c_vm_name', 'c_team_id']);

            // --- 步骤 5: 组合节点数据 ---
            $nodes = [];
            $nodeSources = $containers->concat($vms);

            foreach ($nodeSources as $nodeSource) {
                $isContainer = $nodeSource instanceof \App\Models\scenario\SceneContainerInstance;
                $teamId = $nodeSource->c_team_id ? (int)$nodeSource->c_team_id : null;
                $teamData = $teamId ? $currentTeamsWithMembers->get($teamId) : null;

                $nodes[] = [
                    'id'      => $isContainer ? $nodeSource->c_container_id : $nodeSource->c_vm_id,
                    'name'    => $isContainer ? $nodeSource->c_container_name : $nodeSource->c_vm_name,
                    'type'    => $isContainer ? 'container' : 'vm',
                    'team_id' => $teamId,
                    'team'    => $teamData ? [
                        'c_id'   => $teamData->c_id,
                        'c_name' => $teamData->c_name,
                        'users'  => $teamData->users->map(function ($user) {
                            return [
                                'c_username' => $user->c_username,
                                'c_name'     => $user->c_name,
                                'is_banned'  => (bool) $user->pivot->is_banned,
                            ];
                        })
                    ] : null,
                ];
            }

            // --- 步骤 6: 返回最终的复合响应 ---
            return response()->json([
                'status' => 'success',
                'data' => [
                    'nodes' => collect($nodes)->sortBy('name')->values(),
                    'all_teams' => $allTeams,
                    'current_teams' => $currentTeamsWithMembers->values()->map(function($team) {
                        return [
                            'c_id'   => $team->c_id,
                            'c_name' => $team->c_name,
                            'users'  => $team->users->map(function ($user) {
                                return [
                                    'c_username' => $user->c_username,
                                    'c_name'     => $user->c_name,
                                    'is_banned'  => (bool) $user->pivot->is_banned,
                                ];
                            })
                        ];
                    })
                ]
            ]);

        } catch (\Exception $e) {
            Log::error("获取实例节点及成员列表失败 (Instance ID: {$instance->c_scene_instances_id}): " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '获取节点列表时发生服务器错误。'], 500);
        }
    }

    /**
     * 批量更新指定场景实例下节点的队伍归属。
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\scenario\SceneInstance  $instance
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateNodeAssignments(Request $request, SceneInstance $instance): JsonResponse
    {
        // 1. 验证输入数据
        $validator = Validator::make($request->all(), [
            'assignments'          => 'required|array',
            'assignments.*.type'   => 'required|string|in:container,vm',
            'assignments.*.id'     => 'required', // ID 可以是字符串或整数
            'assignments.*.team_id'=> ['nullable', 'integer', 'exists:' . (new Team)->getTable() . ',c_id'],
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '数据验证失败', 'errors' => $validator->errors()], 422);
        }

        $assignments = $request->input('assignments');

        // 2. 使用数据库事务执行更新
        DB::beginTransaction();
        try {
            foreach ($assignments as $assignment) {
                $type   = $assignment['type'];
                $id     = $assignment['id'];
                $teamId = $assignment['team_id']; // 可以是 null

                if ($type === 'container') {
                    // 更新容器表，并确保该容器属于当前实例
                    SceneContainerInstance::where('c_container_id', $id)
                        ->where('c_scene_instances_id', $instance->c_scene_instances_id)
                        ->update(['c_team_id' => $teamId]);
                } elseif ($type === 'vm') {
                    // 更新虚拟机表，并确保该虚拟机属于当前实例
                    SceneVmInstance::where('c_vm_id', $id)
                        ->where('c_scene_instances_id', $instance->c_scene_instances_id)
                        ->update(['c_team_id' => $teamId]);
                }
            }

            DB::commit();

            return response()->json(['status' => 'success', 'message' => '节点队伍分配已成功更新。']);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("更新节点队伍分配失败 (Instance ID: {$instance->c_scene_instances_id}): " . $e->getMessage());
            return response()->json(['message' => '更新分配时发生服务器错误。'], 500);
        }
    }

    /**
     * 加载 vmImageOverrides.json 内容
     */
    private function loadVmImageOsMap(): void
    {
        try {
            $path = base_path('../src/data/vmImageOverrides.json');
            if (File::exists($path)) {
                $jsonContent = File::get($path);
                $this->vmImageOsMap = json_decode($jsonContent, true) ?: [];
            } else {
                Log::warning('vmImageOverrides.json 不存在', ['path' => $path]);
            }
        } catch (\Exception $e) {
            Log::error('加载 vmImageOverrides.json 失败: ' . $e->getMessage());
            $this->vmImageOsMap = [];
        }
    }
}
