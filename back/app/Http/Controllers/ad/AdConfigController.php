<?php
// file: app/Http/Controllers/ad/AdConfigController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdConfigResource;
use App\Models\ad\AdConfig;
use App\Models\ad\SceneUsersModel;
use App\Rules\NoTeamMemberConflict;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
// 【★★★ 核心修复 ★★★】在行尾添加分号
use Illuminate\Support\Str;
use App\Models\ad\TeamUsers;

class AdConfigController extends Controller
{
    /**
     * 获取演练列表 (支持搜索)
     */
    public function index(Request $request)
    {
        $query = AdConfig::query()->with(['redTeam', 'blueTeam', 'referees', 'sceneConfig']);

        if ($request->has('search') && !empty($request->search)) {
            $query->where('c_drill_name', 'like', '%' . $request->search . '%');
        }

        $adConfigs = $query->latest('c_create_at')->paginate(15);

        return AdConfigResource::collection($adConfigs);
    }

    /**
     * 创建新演练
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'c_drill_name'      => 'required|string|max:255|unique:c_ad_configs,c_drill_name',
            'c_description'     => 'nullable|string',
            'c_red_team_id'     => [
                'required',
                'integer',
                'exists:c_teams,c_id',
                // 创建规则实例，并将蓝队的ID作为参数传给它的构造函数。
                new NoTeamMemberConflict((int)$request->input('c_blue_team_id', 0))
            ],
            'c_blue_team_id'    => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            'referees'                   => 'required|array|min:1',
            'referees.*.c_user_id'       => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'         => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
        ], [
            'c_drill_name.unique' => '该演练名称已被使用。',
            'c_blue_team_id.different' => '红队和蓝队不能选择同一个队伍。',
            'referees.min' => '请至少指派一名裁判。',
            'referees.*.c_user_id.exists' => '提供的一个或多个裁判用户不存在。',

        ]);


        $adConfig = DB::transaction(function () use ($validated) {
            $adConfig = AdConfig::create([
                // 现在 Str::uuid() 会被正确识别
                'c_id'                => (string) Str::uuid(),
                'c_drill_name'        => $validated['c_drill_name'],
                'c_description'       => $validated['c_description'] ?? null,
                'c_red_team_id'       => $validated['c_red_team_id'],
                'c_blue_team_id'      => $validated['c_blue_team_id'],
                'c_scene_config_id'   => $validated['c_scene_config_id'] ?? null,
                'c_start_time'        => $validated['c_start_time'] ?? null,
                'c_end_time'          => $validated['c_end_time'] ?? null,
                'c_status'            => 'pending',
            ]);

            $team_user_mod = new TeamUsers();
            $team_user_list  = $team_user_mod->get_teams_users($validated['c_red_team_id'],$validated['c_blue_team_id']);
            $scene_user_mod = new SceneUsersModel();
            foreach($team_user_list as $k=>$v){
                $valid_users = $scene_user_mod->get_scene_users_info($validated['c_scene_config_id'],$v);
                if($valid_users){
                    $ins_scene_user = $scene_user_mod->create_scene_users_info($validated['c_scene_config_id'],$v);
                    if(!$ins_scene_user){
                        throw new Exception("权限插入失败");
                    }
                }
            }


            $refereesData = collect($validated['referees'])->keyBy('c_user_id')->map(function ($referee) {
                return ['c_level' => $referee['c_level']];
            });

            $adConfig->referees()->sync($refereesData);

            return $adConfig->load(['redTeam', 'blueTeam', 'referees', 'sceneConfig']);
        });

        return new AdConfigResource($adConfig);
    }

    /**
     * 显示单个演练详情
     */
    public function show(AdConfig $adConfig)
    {
        $adConfig->load(['redTeam', 'blueTeam', 'referees', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    /**
     * 更新演练
     */
    public function update(Request $request, AdConfig $adConfig)
    {
        $validated = $request->validate([
            'c_drill_name'      => ['required', 'string', 'max:255', Rule::unique('c_ad_configs')->ignore($adConfig->c_id, 'c_id')],
            'c_description'     => 'nullable|string',
            'c_red_team_id'     => [
                'required',
                'integer',
                'exists:c_teams,c_id',
                new NoTeamMemberConflict((int)$request->input('c_blue_team_id', 0))
            ],
            'c_blue_team_id'    => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            'referees'                   => 'required|array|min:1',
            'referees.*.c_user_id'       => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'         => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
        ]);

        DB::transaction(function () use ($adConfig, $validated) {
            $adConfig->update($validated);

            $refereesData = collect($validated['referees'])->keyBy('c_user_id')->map(function ($referee) {
                return ['c_level' => $referee['c_level']];
            });

            $adConfig->referees()->sync($refereesData);
        });

        $adConfig->load(['redTeam', 'blueTeam', 'referees', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    public function destroy(AdConfig $adConfig)
    {
        $adConfig->delete();
        return response()->json(['message' => '演练删除成功']);
    }

    public function start(AdConfig $adConfig)
    {
        if ($adConfig->c_status !== 'pending') {
            return response()->json(['message' => '演练必须处于待开始状态才能启动。'], 400);
        }
        $adConfig->c_status = 'running';
        $adConfig->save();
        return response()->json(['message' => '演练已启动']);
    }

    public function stop(AdConfig $adConfig)
    {
        if ($adConfig->c_status !== 'running') {
            return response()->json(['message' => '演练必须处于进行中状态才能停止。'], 400);
        }
        $adConfig->c_status = 'finished';
        $adConfig->save();
        return response()->json(['message' => '演练已停止']);
    }
}
