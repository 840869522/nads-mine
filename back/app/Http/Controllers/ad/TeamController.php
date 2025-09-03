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
}
