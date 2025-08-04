<?php

namespace App\Http\Controllers\Docker;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\DockerService;
use Illuminate\Support\Facades\DB;

class ContainersController extends Controller
{
    private $docker;

    public function __construct(DockerService $docker)
    {
        $this->docker = $docker;
    }

    private function mapStatus(?string $state): string
    {
        return match ($state) {
            'running' => 'running',
            'paused' => 'paused',
            'created', 'exited', 'dead' => 'stopped',
            'restarting' => 'starting',
            default => 'error',
        };
    }

    public function create(Request $request)
    {
        $userId = $request->token_data['id'] ?? null;
        $id = $this->docker->createContainer($request->all(), $userId);
        return response()->json(['id' => $id]);
    }

    public function action(Request $request, string $id)
    {
        $action = $request->query('action');
        switch ($action) {
            case 'start':
                $this->docker->startContainer($id); break;
            case 'stop':
                $this->docker->stopContainer($id); break;
            case 'pause':
                $this->docker->pauseContainer($id); break;
            case 'unpause':
                $this->docker->unpauseContainer($id); break;
            case 'delete':
                $this->docker->removeContainer($id); break;
        }
        return response()->json(['ok'=>true]);
    }

    public function get(Request $request, string $id)
    {
        $action = $request->query('action');
        return match ($action) {
            'logs' => response()->json(['logs' => $this->docker->containerLogs($id)]),
            'binds' => response()->json($this->docker->listBindMounts($id)),
            default => response()->json(['error' => 'unknown action'], 400),
        };
    }

    public function inspect(string $id)
    {
        logger()->info("Inspecting container: $id");
        $res = $this->docker->docker->ContainerInspect($id,[],'response');
        $raw  = (string) $res->getBody();                 // 纯 JSON 字符串
        $data = json_decode($raw, true);                  // 可选：转数组// 对象
        logger()->info('Container info', $data);
        return response()->json($data);
    }

    public function info(string $id)
    {
        try {
            $detail = $this->docker->containerInspect($id);
        } catch (\Exception $e) {
            return response()->json(['error' => 'container not found'], 404);
        }

        try {
            $stats = $this->docker->containerStats($detail->getId());
            $cpuDelta = ($stats->cpu_stats->cpu_usage->total_usage ?? 0) - ($stats->precpu_stats->cpu_usage->total_usage ?? 0);
            $sysDelta = ($stats->cpu_stats->system_cpu_usage ?? 0) - ($stats->precpu_stats->system_cpu_usage ?? 0);
            $cpus = $stats->cpu_stats->online_cpus ?? (is_array($stats->cpu_stats->cpu_usage->percpu_usage ?? null) ? count($stats->cpu_stats->cpu_usage->percpu_usage) : 1);
            $cpuPercent = $sysDelta > 0 ? ($cpuDelta / $sysDelta) * $cpus * 100 : 0;
            $memUsage = $stats->memory_stats->usage ?? 0;
            $memLimit = $stats->memory_stats->limit ?? 0;
        } catch (\Exception $e) {
            $cpuPercent = 0;
            $memUsage = 0;
            $memLimit = 0;
        }

        $ports = [];
        $bindings = $detail->getHostConfig()->getPortBindings();
        foreach ($bindings ?? [] as $portKey => $bindingList) {
            foreach ($bindingList ?? [] as $b) {
                $hostPort = $b->getHostPort();
                $private = strtok($portKey, '/');
                $ports[] = "{$hostPort}:{$private}";
            }
        }

        $infoExtra = null;
        try {
            $infoExtra = DB::table('c_scene_container_instances as ci')
                ->leftJoin('c_scene_instances as si', DB::raw('ci.c_scene_instances_id COLLATE utf8mb4_unicode_ci'), '=', 'si.c_scene_instances_id')
                ->leftJoin('c_scene_configs as sc', 'si.c_config_id', '=', 'sc.c_config_id')
                ->select('ci.c_container_id', 'ci.c_scene_instances_id', 'ci.c_ip', 'sc.c_name as scene_name')
                ->where('ci.c_container_id', $detail->getId())
                ->first();
        } catch (\Throwable $e) {
            $infoExtra = null;
        }

        return response()->json([
            'id' => $detail->getId(),
            'name' => ltrim($detail->getName() ?? substr($detail->getId(), 0, 12), '/'),
            'type' => 'container',
            'ipAddress' => $infoExtra->c_ip ?? ($detail->getNetworkSettings()->getIPAddress() ?? null),
            'scene_instance_id' => $infoExtra->c_scene_instances_id ?? null,
            'scene_name' => $infoExtra->scene_name ?? null,
            'status' => $this->mapStatus($detail->getState()?->getStatus()),
            'ports' => implode(', ', $ports),
            'imageName' => $detail->getConfig()->getImage(),
            'cpuUsage' => sprintf('%.1f%%', $cpuPercent),
            'memoryUsage' => sprintf('%.1fMB/%.1fMB', $memUsage/1024/1024, $memLimit/1024/1024),
            'diskUsage' => '-',
            'uptime' => $detail->getState()?->getStatus() ?? '',
            'nodeId' => null,
            'createdAt' => date('c', $detail->getCreated() ? strtotime($detail->getCreated()) : time()),
        ]);
    }
}
