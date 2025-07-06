<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\Team;
use Illuminate\Validation\Rule;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    /**
     * 获取队伍列表，支持服务端搜索。
     */
    public function index(Request $request)
    {
        $searchQuery = $request->query('search');

        $query = Team::query()->withCount('users as member_count');

        if ($searchQuery) {
            $query->where(function ($q) use ($searchQuery) {
                $q->where('c_name', 'LIKE', '%' . $searchQuery . '%')
                    ->orWhere('c_description', 'LIKE', '%' . $searchQuery . '%');
            });
        }

        $teams = $query->latest('c_id')->get();

        $teams->each(function ($team) {
            $team->score = 0; // 或从其他地方获取真实分数
        });

        return response()->json([
            'status' => 'success',
            'data' => $teams
        ]);
    }

    /**
     * 创建一个新队伍。
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'c_name'        => 'required|string|max:255|unique:c_teams,c_name',
            'c_color'       => 'required|string|max:50',
            'c_description' => 'nullable|string|max:1000',
        ]);

        $team = Team::create($validatedData);

        $team->loadCount('users as member_count');
        $team->score = 0;

        return response()->json([
            'status' => 'success',
            'message' => '队伍 "' . $team->c_name . '" 已成功创建！',
            'data' => $team
        ], 201);
    }

    /**
     * 显示指定的队伍信息。
     */
    public function show(Team $team)
    {
        $team->loadCount('users as member_count');
        $team->score = $team->score ?? 0;

        return response()->json([
            'status' => 'success',
            'data' => $team
        ]);
    }

    /**
     * 更新指定的队伍信息。
     */
    public function update(Request $request, Team $team)
    {
        $validatedData = $request->validate([
            'c_name' => [
                'required', 'string', 'max:255',
                Rule::unique('c_teams', 'c_name')->ignore($team->c_id, 'c_id'),
            ],
            'c_color'       => 'required|string|max:50',
            'c_description' => 'nullable|string|max:1000',
        ]);

        $team->update($validatedData);
        $team->loadCount('users as member_count');

        return response()->json([
            'status' => 'success',
            'message' => '队伍 "' . $team->c_name . '" 已成功更新！',
            'data' => $team
        ]);
    }

    /**
     * 删除指定的队伍。
     */
    public function destroy(Team $team)
    {
        $teamName = $team->c_name;
        $team->delete();

        return response()->json([
            'status' => 'success',
            'message' => '队伍 "' . $teamName . '" 已成功删除。'
        ]);
    }
}
