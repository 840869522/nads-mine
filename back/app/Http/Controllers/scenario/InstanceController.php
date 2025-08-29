<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneInstance;
use App\Models\scenario\SceneContainerInstance; // ★ 新增：引入容器实例模型
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Services\DockerService;
use App\RunTool\CommandLineService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class InstanceController extends Controller
{
    protected DockerService $docker;
    protected CommandLineService $cliService;

    public function __construct(DockerService $docker, CommandLineService $cliService)
    {
        $this->docker = $docker;
        $this->cliService = $cliService;
    }


    public function index()
    {
        try {
            $instances = SceneInstance::with('sceneConfig')->latest('c_runtime')->get();
            $data = $instances->map(function ($instance) {
                return [
                    'instance_id'   => $instance->c_scene_instances_id,
                    'scenario_name' => $instance->sceneConfig->c_name ?? '未知场景',
                    'username'      => $instance->c_username,
                    'runtime'       => $instance->c_runtime ? $instance->c_runtime->toIso8601String() : null,
                    'status'        => $instance->c_status,
                ];
            });
            return response()->json($data);
        } catch (\Exception $e) {
            Log::error('获取场景实例列表时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，获取列表失败。'], 500);
        }
    }

    /**
     * ★ 替换：显示特定场景实例的详情（容器列表），并应用权限
     */
    public function show(SceneInstance $instance)
    {
        try {
            // ★ 核心改动：不再直接 load('containers')，而是使用带有权限作用域的查询
            $containersFromDb = $instance->containers() // 获取关联关系查询构造器
            ->forCurrentUser($instance->c_scene_instances_id) // 调用权限作用域
            ->get();

            $runningInstances = [];
            foreach ($containersFromDb as $containerInstance) {
                $containerId = $containerInstance->c_container_id;
                try {
                    // 后续的 Docker inspect 和 stats 逻辑保持不变
                    $details = $this->docker->containerInspect($containerId);
                    $stats = $this->docker->containerStats($containerId);

                    // ... (CPU 和内存计算逻辑保持不变) ...
                    $cpuDelta = ($stats->cpu_stats->cpu_usage->total_usage ?? 0) - ($stats->precpu_stats->cpu_usage->total_usage ?? 0);
                    $sysDelta = ($stats->cpu_stats->system_cpu_usage ?? 0) - ($stats->precpu_stats->system_cpu_usage ?? 0);
                    $cpus = $stats->cpu_stats->online_cpus ?? (is_array($stats->cpu_stats->cpu_usage->percpu_usage ?? null) ? count($stats->cpu_stats->cpu_usage->percpu_usage) : 1);
                    $cpuPercent = $sysDelta > 0 ? ($cpuDelta / $sysDelta) * $cpus * 100 : 0;
                    $memUsage = $stats->memory_stats->usage ?? 0;
                    $memLimit = $stats->memory_stats->limit ?? 0;

                    // ... (端口映射逻辑保持不变) ...
                    $ports = [];
                    if($details->getHostConfig()){
                        foreach ($details->getHostConfig()->getPortBindings() ?? [] as $portKey => $bindingList) {
                            foreach ($bindingList ?? [] as $b) {
                                $ports[] = "{$b->getHostPort()}:" . strtok($portKey, '/');
                            }
                        }
                    }


                    $runningInstances[] = [
                        'id' => $details->getId(),
                        'name' => ltrim($details->getName() ?? '', '/'),
                        'type' => 'container',
                        'ipAddress' => $containerInstance->c_ip,
                        'scene_instance_id' => $containerInstance->c_scene_instances_id,
                        // ★ 确保 sceneConfig 关系已加载或手动查询
                        'scene_name' => $instance->sceneConfig->c_name ?? SceneConfig::find($instance->c_config_id)->c_name ?? null,
                        'status' => $this->mapStatus($details->getState()->getStatus()),
                        'ports' => implode(', ', $ports),
                        'imageName' => $details->getConfig()->getImage(),
                        'cpuUsage' => sprintf('%.1f%%', $cpuPercent),
                        'memoryUsage' => sprintf('%.1fMB / %.1fMB', $memUsage / 1048576, $memLimit / 1048576),
                        'uptime' => $details->getState()->getStartedAt(),
                        'createdAt' => $details->getCreated(),
                        // ★ 核心改动：动态生成 is_target 字段 (不修改DB版)
                        'is_target' => !empty($containerInstance->c_flag),
                    ];
                } catch (\Exception $e) {
                    Log::warning("无法 inspect 容器 {$containerId} (可能已被删除): " . $e->getMessage());
                    // 即使容器物理上不存在了，也可以考虑返回一条带有错误状态的记录
                    $runningInstances[] = [
                        'id' => $containerId,
                        'name' => $containerInstance->c_container_name ?? "未知 (ID: " . substr($containerId, 0, 12) . ")",
                        'type' => 'container',
                        'ipAddress' => $containerInstance->c_ip,
                        'scene_instance_id' => $containerInstance->c_scene_instances_id,
                        'scene_name' => $instance->sceneConfig->c_name ?? null,
                        'status' => 'error',
                        'ports' => 'N/A',
                        'imageName' => 'N/A',
                        'cpuUsage' => 'N/A',
                        'memoryUsage' => 'N/A',
                        'uptime' => 'N/A',
                        'createdAt' => 'N/A',
                        'is_target' => !empty($containerInstance->c_flag),
                    ];
                }
            }
            return response()->json($runningInstances);
        } catch (\Exception $e) {
            Log::error("获取实例详情时发生错误 for instance {$instance->c_scene_instances_id}: " . $e->getMessage());
            return response()->json(['message' => '获取实例详情失败。'], 500);
        }
    }


    public function destroy(SceneInstance $instance)
    {
        $instanceId = $instance->c_scene_instances_id;
        Log::info("开始删除场景实例: {$instanceId}");

        $instance->load(['containers', 'vms', 'switches']);
        $errors = [];

        DB::beginTransaction();
        try {
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
                    $this->cliService->deleteSwitch($switch->c_switch_name);
                } catch (\Exception $e) {
                    $errors[] = "删除交换机 '{$switch->c_switch_name}' 失败: " . $e->getMessage();
                    Log::error($errors[count($errors) - 1]);
                }
            }

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

            $instance->vms()->delete();
            Log::info("已删除实例 {$instanceId} 的所有虚拟机数据库记录。");

            $instance->containers()->delete();
            Log::info("已删除实例 {$instanceId} 的所有容器数据库记录。");

            $instance->switches()->delete();
            Log::info("已删除实例 {$instanceId} 的所有交换机数据库记录。");

            $instance->delete();
            Log::info("已从数据库中删除场景实例主记录: {$instanceId}");

            DB::commit();

            if (!empty($errors)) {
                return response()->json([
                    'message' => '场景实例已删除，但部分物理资源清理失败。数据库记录已清理。',
                    'detail' => implode('; ', $errors),
                ], 207);
            }

            return response()->json(['message' => '场景实例及其所有关联资源已成功删除。'], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::critical("删除场景实例 {$instanceId} 时发生严重数据库错误: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => '删除场景实例时发生严重错误，操作已回滚。',
                'detail' => $e->getMessage(),
            ], 500);
        }
    }

    private function deleteVmAndStorage(string $vmName): void
    {
        Log::info("开始处理虚拟机删除: {$vmName}");

        try {
            $this->runCommand(['virsh', 'destroy', $vmName]);
            Log::info("已强制关闭虚拟机: {$vmName}");
        } catch (ProcessFailedException $e) {
            $errorOutput = $e->getProcess()->getErrorOutput();
            if (str_contains($errorOutput, 'failed to get domain') || str_contains($errorOutput, 'domain not found')) {
                Log::warning("虚拟机 '{$vmName}' 在关机时未找到，可能已被关闭或删除。");
            } else {
                throw $e;
            }
        }

        try {
            $this->runCommand(['virsh', 'undefine', $vmName, '--remove-all-storage', '--snapshots-metadata']);
            Log::info("已取消定义虚拟机 '{$vmName}' 并移除其所有存储。");
        } catch (ProcessFailedException $e) {
            $errorOutput = $e->getProcess()->getErrorOutput();
            if (str_contains($errorOutput, 'failed to get domain') || str_contains($errorOutput, 'domain not found')) {
                Log::warning("虚拟机 '{$vmName}' 在取消定义时未找到，可能已被删除。");
            } else {
                throw $e;
            }
        }
    }

    private function runCommand(array $command): string
    {
        $process = new Process($command);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new ProcessFailedException($process);
        }

        return $process->getOutput();
    }

    private function mapStatus(string $dockerStatus): string
    {
        if ($dockerStatus === 'running') return 'running';
        if ($dockerStatus === 'exited') return 'stopped';
        return $dockerStatus;
    }

    public function tearDownResources(SceneInstance $instance)
    {
        $instanceId = $instance->c_scene_instances_id;
        Log::info("开始清理场景实例的底层资源: {$instanceId}");

        $instance->load(['containers', 'vms', 'switches']);
        $errors = [];

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
                $this->docker->docker->containerDelete($container->c_container_id, ['force' => true]);
            } catch (\Exception $e) {
                $errors[] = "删除容器 '{$container->c_container_id}' 失败: " . $e->getMessage();
                Log::error($errors[count($errors) - 1]);
            }
        }

        foreach ($instance->switches as $switch) {
            try {
                $this->cliService->deleteSwitch($switch->c_switch_name);
            } catch (\Exception $e) {
                $errors[] = "删除交换机 '{$switch->c_switch_name}' 失败: " . $e->getMessage();
                Log::error($errors[count($errors) - 1]);
            }
        }

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
            ], 207);
        }

        return response()->json(['message' => '场景实例的底层资源已成功清理，所有数据库记录已保留。'], 200);
    }

    /**
     * 注意：这个函数 _get_global_directory() 在 AdController 中存在，
     * 这里假设它是一个可用的辅助函数，或者你应该把它移到服务层或辅助类中
     */
      private function _get_global_directory()
    {
        return env('GLOBAL_DIRECTORY', '/default/path');
    }
}
