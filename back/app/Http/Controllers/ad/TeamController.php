<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\AdConfig;
use App\Models\ad\Team;
use App\Models\ad\TeamUsers; // ★ 1. 导入 TeamUsers 服务类
use App\Models\scenario\SceneInstance;
use App\Models\Users\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TeamController extends Controller
{
    // index, store, show, update, destroy 方法与演练结构解耦，无需修改
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
            return response()->json(['status' => 'success','message' => '队伍 "' . $team->c_name . '" 已成功创建！','data' => $team], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['status'  => 'error','message' => '创建失败: ' . $e->getMessage(),], 500);
        }
    }

    public function show(Team $team)
    {
        $team->load('users');
        return response()->json(['status' => 'success', 'data' => $team]);
    }

    public function update(Request $request, Team $team)
    {
        $validatedData = $request->validate([
            'c_name' => ['required', 'string', 'max:255', Rule::unique('c_teams', 'c_name')->ignore($team->c_id, 'c_id'),],
            'c_description' => 'nullable|string|max:1000',
            'users'         => 'nullable|array',
            'users.*'       => 'string|exists:c_users,c_username',
        ]);
        DB::beginTransaction();
        try {
            $team->update(['c_name' => $validatedData['c_name'], 'c_description' => $validatedData['c_description'] ?? null,]);
            $team->users()->sync($validatedData['users'] ?? []);
            DB::commit();
            $team->load('users');
            return response()->json(['status' => 'success','message' => '队伍 "' . $team->c_name . '" 已成功更新！','data' => $team]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['status'  => 'error','message' => '更新失败: ' . $e->getMessage(),], 500);
        }
    }

    public function destroy(Team $team)
    {
        $teamName = $team->c_name;
        $team->delete();
        return response()->json(['status' => 'success', 'message' => '队伍 "' . $teamName . '" 已成功删除。']);
    }

    // toggleUserBanStatus 方法与演练结构解耦，无需修改
    public function toggleUserBanStatus(Team $team, UserModel $user)
    {
        $pivot = DB::table('c_teams_users')
            ->where('team_id', $team->c_id)
            ->where('user_id', $user->c_username)
            ->first();

        if (!$pivot) {
            return response()->json(['message' => '用户 ' . $user->c_username . ' 不属于队伍 ' . $team->c_name], 404);
        }

        $newStatus = !$pivot->is_banned;

        DB::table('c_teams_users')
            ->where('team_id', $team->c_id)
            ->where('user_id', $user->c_username)
            ->update(['is_banned' => $newStatus]);

        $actionText = $newStatus ? "禁用" : "解除禁用";
        $message = "已成功{$actionText}用户 '{$user->c_username}'。";

        return response()->json([
            'status' => 'success',
            'message' => $message,
            'data' => [
                'is_banned' => $newStatus,
            ]
        ]);
    }

    /**
     * 获取指定队伍参与的所有演练。
     *
     * @param  Team  $team
     * @return JsonResponse
     */
    public function getDrills(Team $team): JsonResponse
    {
        // MODIFIED: 查询逻辑被简化为直接使用模型中定义好的 'drills' 多对多关系
        $drills = $team->drills()
            ->with(['sceneConfig:c_config_id,c_name']) // 继续预加载场景信息
            ->latest('c_create_at')
            ->get();

        // 动态注入实时实例状态的逻辑保持不变，因为它很有用
        $drills->transform(function($drill) {
            if (empty($drill->c_scene_instance_id) && $drill->c_scene_config_id) {
                $instance = SceneInstance::where('c_config_id', $drill->c_scene_config_id)
                    ->where('c_status', 'RUNNING')
                    ->select('c_scene_instances_id')
                    ->first();

                if ($instance) {
                    $drill->c_scene_instance_id = $instance->c_scene_instances_id;
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

    /**
     * ★★★ 新增：获取多个队伍的所有成员ID ★★★
     * 这个方法用于支持前端在指派裁判时进行角色冲突检查。
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getMembersByTeamIds(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'team_ids'   => 'required|array',
            'team_ids.*' => 'integer|exists:c_teams,c_id',
        ]);

        $memberIds = TeamUsers::get_teams_users($validated['team_ids']);

        return response()->json(['data' => $memberIds]);
    }
}
