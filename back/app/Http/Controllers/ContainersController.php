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
        $id = $this->docker->createContainer($request->all());
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

    public function logs(string $id)
    {
        $logs = $this->docker->containerLogs($id);
        return response()->json(['logs'=>$logs]);
    }

    public function inspect(string $id)
    {
        return response()->json($this->docker->inspectContainer($id));
    }

    public function binds(string $id)
    {
        return response()->json($this->docker->listBindMounts($id));
    }
}
