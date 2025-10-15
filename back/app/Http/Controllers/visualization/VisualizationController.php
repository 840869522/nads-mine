<?php

namespace App\Http\Controllers\visualization;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\Flag\FlagSubmissionModel;
use App\Models\scenario\SceneContainerInstanceModel;
use App\Models\scenario\SceneVmInstanceModel;

class VisualizationController extends Controller{
    private $vms;
    private $containers;
    private $trueTargetList;
    private $falseTargetList;

    private function getInstances(string $instance_id){
        $this->vms = SceneVmInstanceModel::where('c_scene_instances_id', $instance_id)
            ->select('c_vm_name as name', 'c_ip as ip', 'c_flag', 'c_team_id')
            ->get();
        $this->containers = SceneContainerInstanceModel::where('c_scene_instances_id', $instance_id)
            ->select('c_container_name as name', 'c_ip as ip', 'c_flag', 'c_team_id')
            ->get();

        $this->trueTargetList = collect();
        $this->falseTargetList = collect();

        foreach ($this->vms as $vm) {
            $ip = explode('/', $vm->ip)[0];
            $item = [
                'name' => $vm->name,
                'ip'   => $ip,
            ];

            if (!empty($vm->c_flag)) {
                $this->trueTargetList->push($item);
            } else {
                $this->falseTargetList->push($item);
            }
        }

        foreach ($this->containers as $container) {
            $ip = explode('/', $container->ip)[0];
            $item = [
                'name' => $container->name,
                'ip'   => $ip,
            ];

            if (!empty($container->c_flag)) {
                $this->trueTargetList->push($item);
            } else {
                $this->falseTargetList->push($item);
            }
        }
    }

    public function getListVms(string $instance_id)
    {
        try {
            $this->getInstances($instance_id);

            return response()->json([
                'code'    => 200,
                'message' => '成功',
                'data'    => [
                    'trueTargetList'  => $this->trueTargetList->toArray(),
                    'falseTargetList' => $this->falseTargetList->toArray(),
                ],
            ]);

        } catch (\Throwable $e) {
            Log::error("Database query for scene instances failed for instance {$instance_id}: {$e->getMessage()}");

            return response()->json([
                'code'    => 500,
                'message' => '数据库查询失败: ' . $e->getMessage(),
                'data'    => null,
            ], 500);
        }
    }

    public function getTeamUsers(string $instance_id){
        try{
            $containerUsers = DB::table('c_scene_container_instances as sci')
                ->leftJoin('c_teams_users as tu', 'sci.c_team_id', '=', 'tu.team_id') // 关联唯一标识
                ->leftJoin('c_users as u', 'tu.user_id', '=', 'u.c_username')
                ->where('sci.c_scene_instances_id', $instance_id)
                ->select('u.c_username as userId', 'u.c_name as userName')   // 返回对象数组
                ->get();
            
            $vmUsers = DB::table('c_scene_vm_instances as svi')
                ->leftJoin('c_teams_users as tu', 'svi.c_team_id', '=', 'tu.team_id') // 关联唯一标识
                ->leftJoin('c_users as u', 'tu.user_id', '=', 'u.c_username')
                ->where('svi.c_scene_instances_id', $instance_id)
                ->select('u.c_username as userId', 'u.c_name as userName')   // 返回对象数组
                ->get();
            
            $users = $containerUsers
                ->merge($vmUsers)
                ->unique('userId')
                ->values()
                ->toArray();

            return response()->json([
                'code'    => 200,
                'message' => '成功',
                'data'    => $users
            ]);
        } catch (\Throwable $e){
            Log::error("Failed to obtain {$instance_id} team members: {$e->getMessage()}");
            return response()->json([
                'code'    => 500,
                'message' => '数据库查询失败: ' . $e->getMessage(),
                'data'    => null,
            ], 500);
        }
    }

    public function getTeams(string $instance_id){
        try{
            $containerTeams = DB::table('c_scene_container_instances as sci')
                ->leftJoin('c_teams as t', 'sci.c_team_id', '=', 't.c_id') // 关联唯一标识
                ->where('sci.c_scene_instances_id', $instance_id)
                ->select('t.c_id as teamId', 't.c_name as teamName')   // 返回对象数组
                ->get();
            
            $vmTeams = DB::table('c_scene_vm_instances as svi')
                ->leftJoin('c_teams as t', 'svi.c_team_id', '=', 't.c_id') // 关联唯一标识
                ->where('svi.c_scene_instances_id', $instance_id)
                ->select('t.c_id as teamId', 't.c_name as teamName')   // 返回对象数组
                ->get();
            
            $teams = $containerTeams
                ->merge($vmTeams)
                ->unique('teamId')
                ->values()
                ->toArray();
            
            return response()->json([
                'code'    => 200,
                'message' => '成功',
                'data'    => $teams
            ]);
        } catch (\Throwable $e){
            Log::error("Failed to obtain {$instance_id} teams: {$e->getMessage()}");
            return response()->json([
                'code'    => 500,
                'message' => '数据库查询失败: ' . $e->getMessage(),
                'data'    => null,
            ], 500);
        }
    }

    public function getFlagLogs(string $instance_id){
        $flags = FlagSubmissionModel::with(['containerInstance', 'vmInstance'])
            ->where('c_scene_instances_id', $instance_id)
            ->get()
            ->map(function ($flag) {
                return (object)[
                    'c_submission_id' => $flag->c_submission_id,
                    'c_username'      => $flag->c_username,
                    'c_submitted_at'  => $flag->c_submitted_at,
                    'c_is_correct'    => $flag->c_is_correct,
                    // 判断容器 ID 是否有值，有就取容器名，否则取虚拟机名
                    'name'            => $flag->c_container_instance_id
                                ? optional($flag->containerInstance)->c_container_name
                                : optional($flag->vmInstance)->c_vm_name,
                ];
            })
            ->sortBy('c_submitted_at') // 按提交时间倒序
            ->values();                    // 重新索引

        $logList = [];
        foreach($flags as $f){
            $logMessage = $f->c_is_correct == 1 ? "{$f->c_username}提交{$f->name}的flag正确"
                :"{$f->c_username}提交{$f->name}的flag错误";
            $item = [
                'logId' => $f->c_submission_id,
                'logTime' => $f->c_submitted_at,
                'logContent' => $logMessage,
            ];
            $logList[] = $item;
        }

        return response()->json([
            'code'    => 200,
            'message' => '成功',
            'data'    => $logList
        ]);
    }

}