<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerService;

class InstancesController extends Controller
{
    private DockerService $docker;

    public function __construct(DockerService $docker)
    {
        $this->docker = $docker;
    }

    public function index()
    {
        $list = $this->docker->listContainers();
        $data = [];
        foreach ($list as $c) {
            $ports = [];
            if (!empty($c['Ports'])) {
                foreach ($c['Ports'] as $p) {
                    $ports[] = isset($p['PublicPort'])
                        ? $p['PrivatePort'] . '->' . $p['PublicPort']
                        : (string)$p['PrivatePort'];
                }
            }
            $state = $c['State'] ?? '';
            $status = match ($state) {
                'running' => 'running',
                'paused'  => 'paused',
                'created', 'exited', 'dead' => 'stopped',
                default => 'error',
            };
            $data[] = [
                'id' => $c['Id'],
                'name' => ltrim($c['Names'][0] ?? substr($c['Id'],0,12), '/'),
                'type' => 'container',
                'status' => $status,
                'ports' => implode(', ', $ports),
                'imageName' => $c['Image'],
                'cpuUsage' => '-',
                'memoryUsage' => '-',
                'diskUsage' => '-',
                'uptime' => $c['Status'] ?? '',
                'createdAt' => date('c', $c['Created'] ?? time()),
            ];
        }
        return response()->json($data);
    }

    public function store(Request $request)
    {
        return response()->json(['ok' => true]);
    }

    public function update(Request $request)
    {
        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request)
    {
        return response()->json(['ok' => true]);
    }
}
