<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerService;

class ContainersController extends Controller
{
    private $docker;

    public function __construct(DockerService $docker)
    {
        $this->docker = $docker;
    }

    public function store(Request $request)
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
            'inspect' => response()->json($this->docker->containerInspect($id)),
            'binds' => response()->json($this->docker->listBindMounts($id)),
            default => response()->json(['error' => 'unknown action'], 400),
        };
    }

    public function logs(string $id)
    {
        return response()->json(['logs' => $this->docker->containerLogs($id)]);
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

    public function binds(string $id)
    {
        return response()->json($this->docker->listBindMounts($id));
    }
}
