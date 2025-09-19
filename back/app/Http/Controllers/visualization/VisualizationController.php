<?php

namespace App\Http\Controllers\visualization;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VisualizationController extends Controller{
    public function getListVms(string $instance_id)
    {
        try {
            $vms = DB::table('c_scene_vm_instances')
                ->select('c_vm_name as name', 'c_ip as ip', 'c_flag')
                ->where('c_scene_instances_id', $instance_id)
                ->get();
            $containers = DB::table('c_scene_container_instances')
                ->select('c_container_name as name', 'c_ip as ip', 'c_flag')
                ->where('c_scene_instances_id', $instance_id)
                ->get();

            $trueTargetList = [];
            $falseTargetList = [];

            foreach ($vms as $vm) {
                $ip = explode('/', $vm->ip)[0];
                $item = [
                    'name' => $vm->name,
                    'ip'   => $ip,
                ];

                if (!empty($vm->c_flag)) {
                    $trueTargetList[] = $item;
                } else {
                    $falseTargetList[] = $item;
                }
            }

            foreach ($containers as $container) {
                $ip = explode('/', $container->ip)[0];
                $item = [
                    'name' => $container->name,
                    'ip'   => $ip,
                ];

                if (!empty($container->c_flag)) {
                    $trueTargetList[] = $item;
                } else {
                    $falseTargetList[] = $item;
                }
            }

            return response()->json([
                'code'    => 200,
                'message' => '成功',
                'data'    => [
                    'trueTargetList'  => $trueTargetList,
                    'falseTargetList' => $falseTargetList,
                ],
            ]);

        } catch (\Throwable $e) {
            Log::error("Database query for scene VMs failed for instance {$instance_id}: {$e->getMessage()}");

            return response()->json([
                'code'    => 500,
                'message' => '数据库查询失败: ' . $e->getMessage(),
                'data'    => null,
            ], 500);
        }
    }

    public function getTeamUsers(int $teamId){
        try{
            $users = DB::table('c_teams_users as tu')
                ->join('c_users as u', 'tu.user_id', '=', 'u.c_username') // 关联唯一标识
                ->where('tu.team_id', $teamId)
                ->select('u.c_username as userId', 'u.c_name as username')   // 返回对象数组
                ->get()
                ->all();
            
            return response()->json([
                'code'    => 200,
                'message' => '成功',
                'data'    => $users
            ]);
        } catch (\Throwable $e){
            Log::error("Failed to obtain {$teamId} team members: {$e->getMessage()}");
            return response()->json([
                'code'    => 500,
                'message' => '数据库查询失败: ' . $e->getMessage(),
                'data'    => null,
            ], 500);
        }
    }
}