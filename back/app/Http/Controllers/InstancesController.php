<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\DockerService;
use Illuminate\Support\Str;

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
            if (is_object($c)) {
                $c = json_decode(json_encode($c), true);
            }

            $get = function(array $arr, array $keys, $default = null) {
                foreach ($keys as $k) {
                    if (isset($arr[$k])) return $arr[$k];
                    $lk = strtolower($k);
                    foreach ($arr as $ak => $av) {
                        if (strtolower($ak) === $lk) return $av;
                    }
                }
                return $default;
            };

            $portsInfo = (array)$get($c, ['Ports', 'ports'], []);
            $ports = [];
            foreach ($portsInfo as $p) {
                if (is_array($p)) {
                    $private = $get($p, ['PrivatePort', 'privatePort']);
                    $public  = $get($p, ['PublicPort', 'publicPort']);
                    if ($private === null) continue;
                    $ports[] = $public !== null ? "$private->$public" : (string)$private;
                }
            }

            $state = $get($c, ['State', 'state'], '');
            $status = match ($state) {
                'running' => 'running',
                'paused'  => 'paused',
                'created', 'exited', 'dead' => 'stopped',
                default => 'error',
            };
            $cid = $get($c, ['Id', 'ID', 'id']);
            $names = (array)$get($c, ['Names', 'names'], []);
            $data[] = [
                'id' => $cid ? substr($cid, 0, 12) : Str::uuid()->toString(),
                'name' => ltrim($names[0] ?? ($cid ? substr($cid,0,12) : ''), '/'),
                'type' => 'container',
                'status' => $status,
                'ports' => implode(', ', $ports),
                'imageName' => (string)$get($c, ['Image', 'image', 'ImageName', 'imageName'], ''),
                'cpuUsage' => '-',
                'memoryUsage' => '-',
                'diskUsage' => '-',
                'uptime' => (string)$get($c, ['Status', 'status'], ''),
                'createdAt' => date('c', (int)$get($c, ['Created', 'created'], time())),
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
