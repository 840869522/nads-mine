<?php

// 1. 确保命名空间与您的文件目录完全匹配
namespace App\Http\Controllers\scenario;

// 2. 引入所有需要的类
use App\Http\Controllers\Controller;
use App\Models\scenario\SceneInstance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Services\DockerService;

// 3. 确保类名与文件名完全匹配
class InstanceController extends Controller
{
    protected DockerService $docker;

    public function __construct(DockerService $docker)
    {
        $this->docker = $docker;
    }
    /**
     * 获取所有场景实例的列表.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        try {
            // 使用 with() 预加载关联的场景配置信息，避免 N+1 查询问题
            // 使用 latest() 按最新的启动时间排序
            $instances = SceneInstance::with('sceneConfig')->latest('c_runtime')->get();

            // 格式化数据以匹配前端需求
            $data = $instances->map(function ($instance) {
                return [
                    'instance_id'   => $instance->c_scene_instances_id,
                    'scenario_name' => $instance->sceneConfig->c_name ?? '未知场景', // 从关联关系中获取场景名
                    'username'      => $instance->c_username,
                    // 添加了对 null 值的检查，使代码更健壮
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
     * 获取单个场景实例及其下所有容器的详细信息.
     *
     * @param  \App\Models\scenario\SceneInstance  $instance
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(SceneInstance $instance)
    {
        try {
            // 1. 预加载关联的容器ID列表
            $instance->load('containers');
            
            $runningInstances = [];

            // 2. 遍历该场景实例下的所有容器关联记录
            foreach ($instance->containers as $containerInstance) {
                $containerId = $containerInstance->c_container_id;
                
                try {
                    // 3. 使用 inspect 获取每个容器的实时、详细信息
                    $details = $this->docker->containerInspect($containerId);

                    // 4. 获取容器的统计信息
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
                        'status' => $this->mapStatus($details->getState()->getStatus()),
                        'ports' => implode(', ', $ports),
                        'imageName' => $details->getConfig()->getImage(),
                        'cpuUsage' => sprintf('%.1f%%', $cpuPercent),
                        'memoryUsage' => sprintf('%.1fMB / %.1fMB', $memUsage / 1048576, $memLimit / 1048576),
                        'uptime' => $details->getState()->getStartedAt(),
                        'createdAt' => $details->getCreated(),
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
     * 辅助函数，将 Docker 状态映射为前端所需的状态
     */
    private function mapStatus(string $dockerStatus): string
    {
        if ($dockerStatus === 'running') {
            return 'running';
        }
        if ($dockerStatus === 'exited') {
            return 'stopped';
        }
        return $dockerStatus; // paused, restarting, etc.
    }
}
