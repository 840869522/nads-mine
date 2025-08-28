<?php
// file: app/Http/Controllers/ad/AdConfigController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdConfigResource;
use App\Models\ad\AdConfig;
use App\Models\ad\SceneInstances;
use App\Models\ad\SceneUsersModel;
use App\Models\ad\TeamUsers;
use App\Rules\NoTeamMemberConflict;
use App\Rules\NotInTeams;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdConfigController extends Controller
{
    /**
     * 获取演练列表 (已修改为支持灵活分页)
     */
    public function index(Request $request)
    {
        // 从请求中获取每页数量，默认为 10
        $perPage = $request->query('per_page', 10);

        $query = AdConfig::query()->with(['redTeam', 'blueTeam', 'referees', 'sceneConfig']);

        if ($request->has('search') && !empty($request->search)) {
            $query->where('c_drill_name', 'like', '%' . $request->search . '%');
        }

        // 使用可配置的 $perPage 进行分页
        $adConfigs = $query->latest('c_create_at')->paginate($perPage);

        // 这部分动态注入逻辑依然有效，但它只会处理当前页的数据
        $sceneInstancesModel = new SceneInstances();
        $adConfigs->getCollection()->transform(function($item) use ($sceneInstancesModel) {
            if ($item->c_scene_config_id) {
                $instance_id = $sceneInstancesModel->get_c_scene_instances_id($item->c_scene_config_id);
                if ($instance_id) {
                    // 不仅要动态注入实例ID，还要同步修正演练状态
                    $item->c_scene_instance_id = $instance_id;
                    $item->c_status = 'running'; // 强制将状态更新为 'running'
                }
            }
            return $item; // 确保返回 item
        });

        // AdConfigResource 会正确处理分页对象
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
                new NoTeamMemberConflict((int)$request->input('c_blue_team_id', 0))
            ],
            'c_blue_team_id'    => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            'referees' => [
                'required',
                'array',
                'min:1',
                new NotInTeams((int)$request->input('c_red_team_id', 0), (int)$request->input('c_blue_team_id', 0))
            ],
            'referees.*.c_user_id'       => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'         => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
        ], [
            'c_drill_name.unique' => '该演练名称已被使用。',
            'c_blue_team_id.different' => '红队和蓝队不能选择同一个队伍。',
            'referees.min' => '请至少指派一名裁判。',
            'referees.*.c_user_id.exists' => '提供的一个或多个裁判用户不存在。',

        ]);


        $adConfig = DB::transaction(function () use ($validated) {
            $SceneInstances_mod = new SceneInstances();
            $SceneInstances_id = $SceneInstances_mod->get_c_scene_instances_id($validated['c_scene_config_id']);
            $c_scene_instance_id = null;
            if($SceneInstances_id){
                $c_scene_instance_id = $SceneInstances_id;
            }
            $adConfig = AdConfig::create([
                'c_id'                => (string) Str::uuid(),
                'c_drill_name'        => $validated['c_drill_name'],
                'c_description'       => $validated['c_description'] ?? null,
                'c_red_team_id'       => $validated['c_red_team_id'],
                'c_blue_team_id'      => $validated['c_blue_team_id'],
                'c_scene_config_id'   => $validated['c_scene_config_id'] ?? null,
                'c_scene_instance_id'   => $c_scene_instance_id ?? null,
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
            'referees' => [
                'required',
                'array',
                'min:1',
                new NotInTeams((int)$request->input('c_red_team_id', 0), (int)$request->input('c_blue_team_id', 0))
            ],
            'referees.*.c_user_id' => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'   => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
        ]);

        DB::transaction(function () use ($adConfig, $validated) {
            $oldSceneId = $adConfig->c_scene_config_id;
            $oldRedTeamId = $adConfig->c_red_team_id;
            $oldBlueTeamId = $adConfig->c_blue_team_id;

            $teamUserMod = new TeamUsers();
            $oldUserList = [];
            if ($oldSceneId) {
                $oldUserList = $teamUserMod->get_teams_users($oldRedTeamId, $oldBlueTeamId);
            }

            $adConfig->update($validated);

            $refereesData = collect($validated['referees'])->keyBy('c_user_id')->map(fn($r) => ['c_level' => $r['c_level']]);
            $adConfig->referees()->sync($refereesData);

            $newSceneId = $validated['c_scene_config_id'] ?? null;

            if ($oldSceneId && !empty($oldUserList)) {
                SceneUsersModel::revokePermissions($oldSceneId, $oldUserList);
            }

            if ($newSceneId) {
                $newUserList = $teamUserMod->get_teams_users($validated['c_red_team_id'], $validated['c_blue_team_id']);

                foreach ($newUserList as $username) {
                    $permission_granted = SceneUsersModel::grantPermission($newSceneId, $username);
                    if (!$permission_granted) {
                        throw new Exception("为用户 {$username} 授予新场景权限失败。");
                    }
                }
            }
        });

        $adConfig->load(['redTeam', 'blueTeam', 'referees', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    /**
     * 删除演练
     */
    public function destroy(AdConfig $adConfig)
    {
        DB::transaction(function () use ($adConfig) {
            $sceneId = $adConfig->c_scene_config_id;
            $redTeamId = $adConfig->c_red_team_id;
            $blueTeamId = $adConfig->c_blue_team_id;

            if ($sceneId) {
                $teamUserMod = new TeamUsers();
                $userList = $teamUserMod->get_teams_users($redTeamId, $blueTeamId);

                if (!empty($userList)) {
                    SceneUsersModel::revokePermissions($sceneId, $userList);
                }
            }

            $adConfig->delete();
        });

        return response()->json(['message' => '演练删除成功，并已清理相关权限。']);
    }

    /**
     * 启动演练
     */
    public function start(AdConfig $adConfig)
    {
        if ($adConfig->c_status === 'running') {
            return response()->json(['message' => '演练已经在进行中，无法重复启动。'], 400);
        }
        $adConfig->c_status = 'running';
        $adConfig->save();
        return response()->json(['message' => '演练已启动']);
    }

    /**
     * 停止演练
     */
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
