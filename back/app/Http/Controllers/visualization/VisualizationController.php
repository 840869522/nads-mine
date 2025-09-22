<?php

namespace App\Http\Controllers\visualization;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\Flag\FlagSubmissionModel;

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
        $redLog = [];
        $blueLog = [];
        foreach($flags as $f){
            $logMessage = $f->c_is_correct == 1 ? "{$f->c_username}提交{$f->name}的flag正确"
                :"{$f->c_username}提交{$f->name}的flag错误";
            $item = [
                'logId' => $f->c_submission_id,
                'logTime' => $f->c_submitted_at,
                'logContent' => $logMessage,
            ];
            if($f->c_is_correct == 1)
                $redLog[] = $item;
            else
                $blueLog[] = $item;
        }

        return response()->json([
            'code'    => 200,
            'message' => '成功',
            'data'    => [
                'redLogList'  => $redLog,
                'blueLogList' => $blueLog,
            ],
        ]);
    }
}