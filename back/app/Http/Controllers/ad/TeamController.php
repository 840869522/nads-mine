<?php
// file: app/Http/Controllers/ad/TeamController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\AdConfig;
use App\Models\ad\Team;
use App\Models\scenario\SceneInstances; // <-- 新增: 引入 SceneInstances 模型
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TeamController extends Controller
{
    // ... (index, store, show, update, destroy 方法保持不变)

    /**
     * 获取队伍列表
     */
    public function index(Request $request)
    {
        $searchQuery = $request->query('search');
        $perPage = $request->query('per_page', 10);
        $query = Team::query()->with('users');
        if ($searchQuery) {
            $query->where(function ($q) use ($searchQuery) {
                $q->where('c_name', 'LIKE', '%' . $searchQuery . '%')
                    ->orWhere('c_description', 'LIKE', '%' . $searchQuery . '%');
            });
        }
        $teams = $query->latest('c_id')->paginate($perPage);
        return response()->json($teams);
    }

    /**
     * 创建一个新队伍
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'c_name'        => 'required|string|max:255|unique:c_teams,c_name',
            'c_description' => 'nullable|string|max:1000',
            'users'         => 'nullable|array',
            'users.*'       => 'string|exists:c_users,c_username',
        ]);

        DB::beginTransaction();
        try {
            $team = Team::create([
                'c_name'        => $validatedData['c_name'],
                'c_description' => $validatedData['c_description'] ?? null,
            ]);
            if (isset($validatedData['users'])) {
                $team->users()->sync($validatedData['users']);
            }
            DB::commit();
            $team->load('users');
            return response()->json([
                'status' => 'success',
                'message' => '队伍 "' . $team->c_name . '" 已成功创建！',
                'data' => $team
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status'  => 'error',
                'message' => '创建失败: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * 显示指定的队伍信息。
     */
    public function show(Team $team)
    {
        $team->load('users');
        return response()->json(['status' => 'success', 'data' => $team]);
    }

    /**
     * 更新指定的队伍信息
     */
    public function update(Request $request, Team $team)
    {
        $validatedData = $request->validate([
            'c_name' => [
                'required', 'string', 'max:255',
                Rule::unique('c_teams', 'c_name')->ignore($team->c_id, 'c_id'),
            ],
            'c_description' => 'nullable|string|max:1000',
            'users'         => 'nullable|array',
            'users.*'       => 'string|exists:c_users,c_username',
        ]);
        DB::beginTransaction();
        try {
            $team->update([
                'c_name'        => $validatedData['c_name'],
                'c_description' => $validatedData['c_description'] ?? null,
            ]);
            $team->users()->sync($validatedData['users'] ?? []);
            DB::commit();
            $team->load('users');
            return response()->json([
                'status' => 'success',
                'message' => '队伍 "' . $team->c_name . '" 已成功更新！',
                'data' => $team
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status'  => 'error',
                'message' => '更新失败: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * 删除指定的队伍。
     */
    public function destroy(Team $team)
    {
        $teamName = $team->c_name;
        $team->delete();
        return response()->json(['status' => 'success', 'message' => '队伍 "' . $teamName . '" 已成功删除。']);
    }

    /**
     * 获取指定队伍参与的所有演练。
     *
     * @param  \App\Models\ad\Team  $team
     * @return \Illuminate\Http\JsonResponse
     */
    public function getDrills(Team $team)
    {
        // ★★★ 核心修改点 (1/2) ★★★
        // 在 select() 语句中添加 'c_scene_instance_id' 字段
        $drills = AdConfig::query()
            ->with(['sceneConfig:c_config_id,c_name'])
            ->where(function ($query) use ($team) {
                $query->where('c_red_team_id', $team->c_id)
                    ->orWhere('c_blue_team_id', $team->c_id);
            })
            ->select('c_id', 'c_drill_name', 'c_status', 'c_red_team_id', 'c_blue_team_id', 'c_scene_config_id', 'c_scene_instance_id') // <-- 修改点
            ->latest('c_create_at')
            ->get();

        // ★★★ 核心修改点 (2/2) ★★★
        // 添加与 AdConfigController@index 相同的动态注入逻辑，以保证状态一致性
        $sceneInstancesModel = new SceneInstances();
        $drills->transform(function($drill) use ($sceneInstancesModel) {
            // 如果数据库中 instance_id 为空，但场景已配置，则尝试查找实时实例
            if (empty($drill->c_scene_instance_id) && $drill->c_scene_config_id) {
                $instance_id = $sceneInstancesModel->get_c_scene_instances_id($drill->c_scene_config_id);
                if ($instance_id) {
                    // 动态注入实例ID和修正状态
                    $drill->c_scene_instance_id = $instance_id;
                    $drill->c_status = 'running';
                }
            }
            return $drill;
        });

        // 返回 JSON 响应
        return response()->json([
            'status' => 'success',
            'data' => $drills,
        ]);
    }
}
