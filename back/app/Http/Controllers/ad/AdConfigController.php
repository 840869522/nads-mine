<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdConfigResource;
use App\Models\ad\AdConfig; // 确保模型路径正确
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdConfigController extends Controller
{
    /**
     * 获取演练列表 (支持搜索)
     */
    public function index(Request $request)
    {
        $query = AdConfig::query()
            ->with(['redTeam', 'blueTeam', 'referees', 'sceneConfig', 'sceneInstance']);

        // 如果有搜索参数
        if ($request->has('search') && !empty($request->search)) {
            // *** 修正点：使用 c_drill_name 进行搜索 ***
            $query->where('c_drill_name', 'like', '%' . $request->search . '%');
        }

        // *** 修正点：使用 c_create_at 进行排序 ***
        $adConfigs = $query->latest('c_create_at')->paginate(15);

        return AdConfigResource::collection($adConfigs);
    }

    /**
     * 创建新演练
     */
    public function store(Request $request)
    {
        // *** 修正点：所有验证字段名都已更新为 c_ 前缀 ***
        $validated = $request->validate([
            'c_drill_name' => 'required|string|max:255',
            'c_description' => 'nullable|string',
            'c_red_team_id' => 'required|integer|exists:c_teams,c_id',
            'c_blue_team_id' => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id', // 已设为 nullable
            'c_start_time' => 'nullable|date',
            'c_end_time' => 'nullable|date|after_or_equal:c_start_time',
            'referees' => 'required|array|min:1',
            'referees.*.user_id' => 'required|integer|exists:c_users,c_id', // 假设用户表主键是 c_id
            'referees.*.c_level' => 'required|string|max:50',
            'referees.*.c_expertise' => 'required|string|max:255',
        ]);

        $adConfig = DB::transaction(function () use ($validated) {
            // *** 修正点：所有创建字段名都已更新为 c_ 前缀 ***
            $adConfig = AdConfig::create([
                'c_id' => (string) Str::uuid(),
                'c_drill_name' => $validated['c_drill_name'],
                'c_description' => $validated['c_description'] ?? null,
                'c_red_team_id' => $validated['c_red_team_id'],
                'c_blue_team_id' => $validated['c_blue_team_id'],
                'c_scene_config_id' => $validated['c_scene_config_id'] ?? null,
                'c_start_time' => $validated['c_start_time'] ?? null,
                'c_end_time' => $validated['c_end_time'] ?? null,
                'c_status' => 'pending',
            ]);

            $refereesData = collect($validated['referees'])->keyBy('user_id')->map(function ($referee) {
                return ['c_level' => $referee['c_level'], 'c_expertise' => $referee['c_expertise']];
            });
            $adConfig->referees()->sync($refereesData);

            return $adConfig;
        });

        return new AdConfigResource($adConfig->load(['redTeam', 'blueTeam', 'referees', 'sceneConfig', 'sceneInstance']));
    }

    /**
     * 显示单个演练详情
     */
    public function show(AdConfig $adConfig)
    {
        return new AdConfigResource($adConfig->load(['redTeam', 'blueTeam', 'referees', 'sceneConfig', 'sceneInstance']));
    }

    /**
     * 更新演练
     */
    public function update(Request $request, AdConfig $adConfig)
    {
        // *** 修正点：所有验证字段名都已更新为 c_ 前缀 ***
        $validated = $request->validate([
            'c_drill_name' => 'required|string|max:255',
            'c_description' => 'nullable|string',
            'c_red_team_id' => 'required|integer|exists:c_teams,c_id',
            'c_blue_team_id' => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id', // 已设为 nullable
            'c_start_time' => 'nullable|date',
            'c_end_time' => 'nullable|date|after_or_equal:c_start_time',
            'referees' => 'required|array|min:1',
            'referees.*.user_id' => 'required|integer|exists:c_users,c_id',
            'referees.*.c_level' => 'required|string|max:50',
            'referees.*.c_expertise' => 'required|string|max:255',
        ]);

        DB::transaction(function () use ($adConfig, $validated) {
            $adConfig->update($validated);

            $refereesData = collect($validated['referees'])->keyBy('user_id')->map(function ($referee) {
                return ['c_level' => $referee['c_level'], 'c_expertise' => $referee['c_expertise']];
            });
            $adConfig->referees()->sync($refereesData);
        });

        return new AdConfigResource($adConfig->load(['redTeam', 'blueTeam', 'referees', 'sceneConfig', 'sceneInstance']));
    }

    /**
     * 删除演练
     */
    public function destroy(AdConfig $adConfig)
    {
        // *** 修正点：使用 c_status 进行判断 ***
        if ($adConfig->c_status !== 'pending') {
            return response()->json(['message' => '只能删除未开始的演练'], 403);
        }

        $adConfig->delete();

        return response()->noContent();
    }

    /**
     * 开始演练
     */
    public function start(AdConfig $adConfig)
    {
        // *** 修正点：更新 c_status 和 c_start_time ***
        $adConfig->update([
            'c_status' => 'running',
            'c_start_time' => now()
        ]);
        return response()->json(['message' => '演练已成功开始']);
    }

    /**
     * 停止演练
     */
    public function stop(AdConfig $adConfig)
    {
        // *** 修正点：更新 c_status 和 c_end_time ***
        $adConfig->update([
            'c_status' => 'finished',
            'c_end_time' => now()
        ]);
        return response()->json(['message' => '演练已成功停止']);
    }
}
