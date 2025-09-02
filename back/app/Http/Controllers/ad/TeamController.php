<?php
// file: app/Http/Controllers/ad/TeamController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\Team;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use App\Models\ad\AdConfig; // <-- 新增: 引入 AdConfig 模型

class TeamController extends Controller
{
    /**
     * 获取队伍列表 (已简化，移除颜色联动逻辑)
     */
    public function index(Request $request)
    {
        // 回归到最简单的查询逻辑
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
     * 创建一个新队伍 (已移除颜色字段)
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
     * 更新指定的队伍信息 (已移除颜色字段)
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
     * 新增: 获取指定队伍参与的所有演练。
     *
     * @param  \App\Models\ad\Team  $team
     * @return \Illuminate\Http\JsonResponse
     */
    public function getDrills(Team $team)
    {
        // ★★★ 核心修改点 ★★★
        // 使用 with() 预加载 sceneConfig 关系
        // 并且在 with 中只选择我们需要的字段 (c_config_id 和 c_name)
        // 这样可以提高效率并保持响应数据干净
        $drills = AdConfig::query()
            ->with(['sceneConfig:c_config_id,c_name']) // <-- 修改点
            ->where('c_red_team_id', $team->c_id)
            ->orWhere('c_blue_team_id', $team->c_id)
            // 确保查询了关联外键 c_scene_config_id
            ->select('c_id', 'c_drill_name', 'c_status', 'c_red_team_id', 'c_blue_team_id', 'c_scene_config_id') // <-- 修改点
            ->latest('c_create_at')
            ->get();

        // 返回 JSON 响应
        return response()->json([
            'status' => 'success',
            'data' => $drills,
        ]);
    }
}
