<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\Team;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB; // << 1. 引入 DB Facade 用于事务

class TeamController extends Controller
{
    /**
     * 获取队伍列表，支持服务端搜索。
     */
    public function index(Request $request)
    {
        $searchQuery = $request->query('search');

        // << 2. 修改查询：现在预加载完整的 'users' 关系，而不仅仅是计数
        //    前端需要完整的成员信息来显示名字
        $query = Team::query()->with('users');

        if ($searchQuery) {
            $query->where(function ($q) use ($searchQuery) {
                $q->where('c_name', 'LIKE', '%' . $searchQuery . '%')
                    ->orWhere('c_description', 'LIKE', '%' . $searchQuery . '%');
            });
        }

        $teams = $query->latest('c_id')->get();

        // 为每个队伍添加 score 和 member_count 字段，以匹配前端期望
        $teams->each(function ($team) {
            $team->score = $team->score ?? 0;
            // member_count 可以直接从已加载的 users 关系中计算
            $team->member_count = $team->users->count();
        });

        // 注意：为了获得最佳性能和最规范的格式，
        // 推荐使用我们之前讨论的 API Resource。
        // 但为了直接修复，这里手动调整数据结构。
        return response()->json([
            'status' => 'success',
            'data' => $teams
        ]);
    }

    /**
     * 创建一个新队伍，并关联成员。
     */
    public function store(Request $request)
    {
        // << 3. 修改验证规则：增加对 members 字段的验证
        $validatedData = $request->validate([
            'c_name'        => 'required|string|max:255|unique:c_teams,c_name',
            'c_color'       => 'required|string|max:50',
            'c_description' => 'nullable|string|max:1000',
            'members'       => 'nullable|array', // members 是一个可选的数组
            'members.*'     => 'string|exists:c_users,c_username', // 数组中每个值都必须是 c_users 表中存在的用户名
        ]);

        // 使用数据库事务保证数据一致性
        DB::beginTransaction();
        try {
            // 创建队伍主体
            $team = Team::create([
                'c_name'        => $validatedData['c_name'],
                'c_color'       => $validatedData['c_color'],
                'c_description' => $validatedData['c_description'],
            ]);

            // << 4. 【核心】同步成员关系到中间表 c_teams_users
            if (isset($validatedData['members'])) {
                $team->users()->sync($validatedData['members']);
            }

            DB::commit(); // 提交事务

            // 加载新创建的队伍及其关联的用户，以返回给前端
            $team->load('users');
            $team->member_count = $team->users->count();
            $team->score = 0;

            return response()->json([
                'status' => 'success',
                'message' => '队伍 "' . $team->c_name . '" 已成功创建！',
                'data' => $team
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack(); // 如果出错，回滚所有操作
            return response()->json([
                'status'  => 'error',
                'message' => '创建失败，请重试。',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    /**
     * 显示指定的队伍信息。
     */
    public function show(Team $team)
    {
        // 加载完整的用户信息和计数
        $team->load('users');
        $team->member_count = $team->users->count();
        $team->score = $team->score ?? 0;

        return response()->json([
            'status' => 'success',
            'data' => $team
        ]);
    }

    /**
     * 更新指定的队伍信息，并同步成员关系。
     */
    public function update(Request $request, Team $team)
    {
        // << 5. 修改验证规则：同样增加对 members 字段的验证
        $validatedData = $request->validate([
            'c_name' => [
                'required', 'string', 'max:255',
                Rule::unique('c_teams', 'c_name')->ignore($team->c_id, 'c_id'),
            ],
            'c_color'       => 'required|string|max:50',
            'c_description' => 'nullable|string|max:1000',
            'members'       => 'nullable|array',
            'members.*'     => 'string|exists:c_users,c_username',
        ]);

        DB::beginTransaction();
        try {
            // 更新队伍主体信息
            $team->update([
                'c_name'        => $validatedData['c_name'],
                'c_color'       => $validatedData['c_color'],
                'c_description' => $validatedData['c_description'],
            ]);

            // << 6. 【核心】同步成员关系
            // 如果请求中有 members 字段，就用它来同步；如果没有，就传入空数组解绑所有成员。
            $team->users()->sync($validatedData['members'] ?? []);

            DB::commit();

            // 加载更新后的关系并返回
            $team->load('users');
            $team->member_count = $team->users->count();

            return response()->json([
                'status' => 'success',
                'message' => '队伍 "' . $team->c_name . '" 已成功更新！',
                'data' => $team
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status'  => 'error',
                'message' => '更新失败，请重试。',
                'error'   => $e->getMessage()
            ], 500);
        }
    }

    /**
     * 删除指定的队伍。
     */
    public function destroy(Team $team)
    {
        $teamName = $team->c_name;
        // 由于外键约束设置了 on delete cascade, Laravel 在调用 delete() 时
        // 会自动删除 c_teams_users 中相关的记录。无需手动处理。
        $team->delete();

        return response()->json([
            'status' => 'success',
            'message' => '队伍 "' . $teamName . '" 已成功删除。'
        ]);
    }
}
