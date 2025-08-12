<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneInstance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Services\DockerService;
use App\RunTool\CommandLineService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File; 

// 步骤 1: 引入 Process 组件和相关异常类 
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

    public function show(SceneInstance $instance)
    {
        try {
            $instance->load('containers', 'vms', 'switches', 'sceneConfig');
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

                    $runningInstances[] = [
                    'id' => $details->getId(),
                    'name' => ltrim($details->getName() ?? '', '/'),
                    'type' => 'container',
                    'ipAddress' => $containerInstance->c_ip,
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
     *  核心修复：添加了对关联表记录和虚拟机实例文件夹的删除 
     */
    public function destroy(SceneInstance $instance)
    {
        $instanceId = $instance->c_scene_instances_id;
        Log::info("开始删除场景实例: {$instanceId}");

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
}