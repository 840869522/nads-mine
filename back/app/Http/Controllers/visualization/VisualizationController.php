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
    private $instaceMap;

    private function getInstances(string $instance_id){
        $this->vms = DB::table('c_scene_vm_instances as svi')
                ->leftJoin('c_teams as t', 'svi.c_team_id', '=', 't.c_id') // 关联唯一标识
                ->where('svi.c_scene_instances_id', $instance_id)
                ->select('svi.c_vm_name as name', 'svi.c_ip as ip', 'svi.c_flag', 't.c_name as teamName')   // 返回对象数组
                ->get();
        $this->containers = DB::table('c_scene_container_instances as sci')
                ->leftJoin('c_teams as t', 'sci.c_team_id', '=', 't.c_id') // 关联唯一标识
                ->where('sci.c_scene_instances_id', $instance_id)
                ->select('sci.c_container_name as name', 'sci.c_ip as ip', 'sci.c_flag', 't.c_name as teamName')   // 返回对象数组
                ->get();

        $this->trueTargetList = collect();
        $this->falseTargetList = collect();

        foreach ($this->vms as $vm) {
            $ip = explode('/', $vm->ip)[0];
            $item = [
                'name' => $vm->name,
                'ip'   => $ip,
                'teamName' => $vm->teamName,
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
                'teamName' => $container->teamName,
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

    public function getAttackLog(string $instance_id){
        $this->instaceMap ??= [];
        $this->getInstances($instance_id);
        $res = [];
        foreach($this->trueTargetList as $instance){
            $indexId = $instance_id . "_" . strtolower($instance['name']);
            $url = "http://127.0.0.1:9200/{$indexId}/_search";
            $data = [
                "query" => [
                    "bool" => [
                        "must" => [
                            ["term" => ["from.keyword" => "zeek"]],
                            ["term" => ["id.orig_h.keyword" => $instance['ip']]]
                        ]
                    ]
                ]
            ];
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                CURLOPT_CONNECTTIMEOUT => 1,  // 连接超时时间（比如 5 秒）
                CURLOPT_TIMEOUT        => 2, // 整个请求的最大执行时间（比如 10 秒）

            ]);
            $response = curl_exec($ch);
            if (curl_errno($ch) || curl_error($ch)) {
                Log::error('Elasticsearch 查询失败', [
                    'error' => curl_error($ch),
                    'index' => $indexId,
                    'ip' => $instance['ip'],
                    'url' => $url,
                ]);
                $response = null; // 避免继续处理错误响应
                return response()->json([
                    'code'    => 500,
                    'message' => '失败'
                ]);
            }else{
                $result = json_decode($response, true);
                $hits = $result['hits']['hits'] ?? [];
                $length = count($hits);
                if ($length != 0 && isset($this->instaceMap[$indexId]) && $this->instaceMap[$indexId] < $length) {
                    for($i = 0; $i < $this->instaceMap[$indexId] - $length; $i++){
                        $hit = $hits[$i];
                        $resp_h = $hit['_source']['id.resp_h'] ?? null;
                        if($resp_h != null && $this->trueTargetList->contains('ip', $resp_h)){
                            $res[] = [
                                $instance['name'], $resp_h
                            ];
                            $this->instaceMap[] = [
                                $indexId => $length
                            ];
                        }
                    }
                    // 键存在 且 值不等于 $length
                }
            }
        }
        return response()->json([
            'code'    => 200,
            'message' => '成功',
            'data'    => $res
        ]);
    }
}