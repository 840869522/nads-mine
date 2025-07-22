<?php
// file: app/Http/Controllers/ad/TeamController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\Team;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;

class TeamController extends Controller
{
    /**
     * 获取队伍列表
     */
    public function index(Request $request)
    {
        $searchQuery = $request->query('search');
        $query = Team::query()->with('users');

        if ($searchQuery) {
            $query->where(function ($q) use ($searchQuery) {
                $q->where('c_name', 'LIKE', '%' . $searchQuery . '%')
                    ->orWhere('c_description', 'LIKE', '%' . $searchQuery . '%');
            });
        }
        $teams = $query->latest('c_id')->get();

        return response()->json(['status' => 'success', 'data' => $teams]);
    }

    /**
     * 创建一个新队伍，并关联成员。
     */
    public function store(Request $request)
    {
        // ★★★ 核心修复：将验证规则中的 'members' 修改为 'users' ★★★
        $validatedData = $request->validate([
            'c_name'        => 'required|string|max:255|unique:c_teams,c_name',
            'c_color'       => ['required', 'string', Rule::in(['red', 'blue'])],
            'c_description' => 'nullable|string|max:1000',
            'users'         => 'nullable|array', // 期望接收 'users' 键
            'users.*'       => 'string|exists:c_users,c_username',
        ]);

        DB::beginTransaction();
        try {
            $team = Team::create([
                'c_name'        => $validatedData['c_name'],
                'c_color'       => $validatedData['c_color'],
                'c_description' => $validatedData['c_description'],
            ]);

            // ★★★ 核心修复：检查 'users' 键并同步 ★★★
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
     * 更新指定的队伍信息，并同步成员关系。
     */
    public function update(Request $request, Team $team)
    {
        // ★★★ 核心修复：将验证规则中的 'members' 修改为 'users' ★★★
        $validatedData = $request->validate([
            'c_name' => [
                'required', 'string', 'max:255',
                Rule::unique('c_teams', 'c_name')->ignore($team->c_id, 'c_id'),
            ],
            'c_color'       => ['required', 'string', Rule::in(['red', 'blue'])],
            'c_description' => 'nullable|string|max:1000',
            'users'         => 'nullable|array', // 期望接收 'users' 键
            'users.*'       => 'string|exists:c_users,c_username',
        ]);

        DB::beginTransaction();
        try {
            $team->update([
                'c_name'        => $validatedData['c_name'],
                'c_color'       => $validatedData['c_color'],
                'c_description' => $validatedData['c_description'],
            ]);

            // ★★★ 核心修复：检查 'users' 键并同步 ★★★
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
}
