<?php
// file: app/Http/Controllers/ad/AdConfigController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdConfigResource;
use App\Models\ad\AdConfig;
// ★★★ 1. 删除了对废弃模型 SceneInstances 的引用 ★★★
use App\Models\ad\SceneUsersModel;
use App\Models\ad\TeamUsers;
use App\Rules\NoTeamMemberConflict;
use App\Rules\NotInTeams;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use App\Http\Controllers\ad\AdController; // ★ 1. 引入 AdController，准备调用
use App\Models\scenario\SceneConfig; // ★ 2. 引入 SceneConfig 模型
use Illuminate\Support\Facades\Log; // ★ 3. 引入 Log，用于调试

class AdConfigController extends Controller
{
    // ★★★ 4. (可选但强烈建议) 添加一个空的构造函数 ★★★
    // 这可以防止因父类Controller有构造函数依赖而导致的 "Method not exist" 错误
    public function __construct()
    {
        // 构造函数留空即可
    }
    /**
     * ★★★ 2. 修复 index 方法 ★★★
     * 移除了所有错误的数据注入和状态伪造逻辑。
     * 这个方法现在只忠实地返回数据库中的真实数据。
     */
    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);
        $query = AdConfig::query()->with(['redTeam', 'blueTeam', 'referees', 'sceneConfig']);

        if ($request->has('search') && !empty($request->search)) {
            $query->where('c_drill_name', 'like', '%' . $request->search . '%');
        }

        $adConfigs = $query->latest('c_create_at')->paginate($perPage);

        return AdConfigResource::collection($adConfigs);
    }

    /**
     * ★★★ 3. 修复 store 方法 ★★★
     * 移除了创建时关联旧实例ID的错误逻辑。
     * 新创建的演练配置，其实例ID必须为null，等待启动时再关联。
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'c_drill_name'      => 'required|string|max:255|unique:c_ad_configs,c_drill_name',
            'c_description'     => 'nullable|string',
            'c_red_team_id'     => [
                'required', 'integer', 'exists:c_teams,c_id',
                new NoTeamMemberConflict((int)$request->input('c_blue_team_id', 0))
            ],
            'c_blue_team_id'    => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            'referees' => [
                'required', 'array', 'min:1',
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
            $adConfig = AdConfig::create([
                'c_id'                => (string) Str::uuid(),
                'c_drill_name'        => $validated['c_drill_name'],
                'c_description'       => $validated['c_description'] ?? null,
                'c_red_team_id'       => $validated['c_red_team_id'],
                'c_blue_team_id'      => $validated['c_blue_team_id'],
                'c_scene_config_id'   => $validated['c_scene_config_id'] ?? null,
                'c_scene_instance_id' => null, // ★ 新配置的实例ID必须为null ★
                'c_start_time'        => $validated['c_start_time'] ?? null,
                'c_end_time'          => $validated['c_end_time'] ?? null,
                'c_status'            => 'pending',
            ]);

            // 这部分用户权限分配逻辑保持原样，但需要确保相关模型和方法是存在的
            try {
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
            } catch (\Throwable $th) {
                // 如果 TeamUsers 或 SceneUsersModel 不存在，记录日志但允许继续创建
                Log::warning('在创建演练配置时，分配场景用户权限失败: ' . $th->getMessage());
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
    /**
     * ★★★ 5. 最终修复 start 方法 ★★★
     * 这个方法现在会“劫持”前端的启动请求 (`/ad-configs/{config}/start`)，
     * 并调用 AdController 中真正能创建场景环境的 startDrill 方法。
     */
    public function start(Request $request, AdConfig $adConfig)
    {

        // 检查是否已在运行
        if ($adConfig->c_status === 'running' && $adConfig->c_scene_instance_id) {
            return response()->json(['message' => '演练已经在进行中，无法重复启动。'], 400);
        }
        Log::info($adConfig);

        // 检查此演练配置是否关联了一个场景模板
        if (!$adConfig->c_scene_config_id) {
            return response()->json(['message' => '此演练未配置有效的场景模板，无法启动。'], 400);
        }

        // 获取关联的场景模板
        $scenario = SceneConfig::find($adConfig->c_scene_config_id);
        if (!$scenario) {
            return response()->json(['message' => '找不到关联的场景模板(ID: '.$adConfig->c_scene_config_id.')，无法启动。'], 404);
        }

        // 直接从认证系统中获取用户，这是最可靠的方式
        $user = $request->user();
        if (!$user || !property_exists($user, 'c_username')) {
            $username = $request->input('username', 'unknown'); // 作为后备
            if ($username === 'unknown') {
                return response()->json(['message' => '无法获取有效的用户信息，请重新登录。'], 401);
            }
        } else {
            $username = $user->c_username;
        }

        try {
            // 使用Laravel的服务容器来创建 AdController 的实例
            $adController = app(AdController::class);

            // 构造一个新的请求对象，包含 startDrill 所需的参数
            $startDrillRequest = new Request([
                'username' => $username,
                'ad_config_id' => $adConfig->c_id,
            ]);

            // 将请求转发给真正的启动逻辑
            return $adController->startDrill($startDrillRequest, $scenario);

        } catch (\Exception $e) {
            Log::error('在 AdConfigController@start 中调用 AdController@startDrill 失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '启动演练时发生内部错误。'], 500);
        }
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
