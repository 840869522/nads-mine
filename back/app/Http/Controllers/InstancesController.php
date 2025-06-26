<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerService;
use App\Models\Instance;
use Illuminate\Support\Str;

class InstancesController extends Controller
{
    private DockerService $docker;

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
            default => 'error',
        };
    }

    public function index(Request $request)
    {
        $role = $request->query('role', 'student');
        $userId = $request->query('userId');
        $containers = $this->docker->listContainers();
        $result = [];
        foreach ($containers as $info) {
            $labels = $info->getLabels() ?? [];
            if ($role !== 'admin' && ($labels['creatorId'] ?? null) !== $userId) {
                continue;
            }
            try {
                $stats = $this->docker->containerStats($info->getId());
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
            foreach ($info->getPorts() ?? [] as $p) {
                $private = $p->getPrivatePort();
                $public = $p->getPublicPort();
                $ports[] = $public ? "$private->$public" : "$private";
            }
            $result[] = [
                'id' => $info->getId(),
                'name' => ltrim($info->getNames()[0] ?? substr($info->getId(),0,12), '/'),
                'type' => 'container',
                'status' => $this->mapStatus($info->getState()),
                'ports' => implode(', ', $ports),
                'imageName' => $info->getImage(),
                'cpuUsage' => sprintf('%.1f%%', $cpuPercent),
                'memoryUsage' => sprintf('%.1fMB/%.1fMB', $memUsage/1024/1024, $memLimit/1024/1024),
                'diskUsage' => '-',
                'uptime' => $info->getStatus() ?? '',
                'nodeId' => null,
                'createdAt' => date('c', $info->getCreated() ?? time()),
            ];
        }
        return response()->json($result);
    }

    public function store(Request $request)
    {
        $data = $request->all();
        $data['id'] = Str::uuid()->toString();
        Instance::create($data);
        return response()->json(['ok' => true, 'id' => $data['id']]);
    }

    public function update(Request $request)
    {
        $data = $request->all();
        $inst = Instance::findOrFail($data['id']);
        $inst->fill($data);
        $inst->save();
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        $id = $request->query('id');
        if ($id) Instance::where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }
}
