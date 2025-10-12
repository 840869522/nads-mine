<?php
// file: app/Http/Controllers/ad/AdConfigController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdConfigResource;
use App\Models\ad\AdConfig;
use App\Models\ad\Referee;
use App\Models\ad\SceneUsersModel;
use App\Models\ad\TeamUsers;
use App\Rules\NoTeamMemberConflict;
use App\Rules\NotInTeams;
use Exception;
use App\Models\scenario\SceneInstance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use App\Http\Controllers\ad\AdController;
use App\Models\scenario\SceneConfig;
use Illuminate\Support\Facades\Log;

class AdConfigController extends Controller
{
    public function __construct()
    {
        // 构造函数留空
    }

    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);

        $query = AdConfig::query()->with([
            // 加载队伍本身的 c_id 和 c_name
            'redTeam:c_id,c_name',
            'blueTeam:c_id,c_name',
            // 额外加载队伍关联的 users，并只选择需要的字段
            'redTeam.users:c_username,c_name',
            'blueTeam.users:c_username,c_name',
            'sceneConfig:c_config_id,c_name,c_scene',
            'referees.user:c_username,c_name'
        ]);

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('c_drill_name', 'like', '%' . $search . '%')
                    ->orWhereHas('redTeam', fn($tq) => $tq->where('c_name', 'like', '%' . $search . '%'))
                    ->orWhereHas('blueTeam', fn($tq) => $tq->where('c_name', 'like', '%' . $search . '%'));
            });
        }

        $adConfigs = $query->latest('c_create_at')->paginate($perPage);

        return AdConfigResource::collection($adConfigs);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'c_drill_name'      => 'required|string|max:255|unique:c_ad_configs,c_drill_name',
            'c_description'     => 'nullable|string',
            'c_red_team_id'     => ['required', 'integer', 'exists:c_teams,c_id', new NoTeamMemberConflict((int)$request->input('c_blue_team_id', 0))],
            'c_blue_team_id'    => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            'c_type'            => 'nullable|integer|in:1,2', // 1=无人机, 2=科幻
            'c_show_attack'     => 'nullable|integer|in:0,1', // 0=不显示, 1=显示
            'referees'          => ['required', 'array', 'min:1', new NotInTeams((int)$request->input('c_red_team_id', 0), (int)$request->input('c_blue_team_id', 0))],
            'referees.*.c_user_id' => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'   => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
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
                'c_scene_instance_id' => null,
                'c_start_time'        => $validated['c_start_time'] ?? null,
                'c_end_time'          => $validated['c_end_time'] ?? null,
                // ★★★ START: 添加新字段到创建数组 ★★★
                'c_type'              => $validated['c_type'] ?? null,
                'c_show_attack'       => $validated['c_show_attack'] ?? null,
                // ★★★ END: 添加新字段到创建数组 ★★★
                'c_status'            => 'pending',
            ]);

            $refereesToInsert = [];
            foreach ($validated['referees'] as $refereeData) {
                $refereesToInsert[] = [
                    'c_ad_config_id' => $adConfig->c_id,
                    'c_user_id'      => $refereeData['c_user_id'],
                    'c_level'        => $refereeData['c_level'],
                    'c_create_at'    => now(),
                    'c_update_at'    => now(),
                ];
            }
            if (!empty($refereesToInsert)) {
                Referee::insert($refereesToInsert);
            }

            try {
                if (isset($validated['c_scene_config_id'])) {
                    $team_user_mod = new TeamUsers();
                    $team_user_list  = $team_user_mod->get_teams_users($validated['c_red_team_id'],$validated['c_blue_team_id']);
                    $scene_user_mod = new SceneUsersModel();
                    foreach($team_user_list as $v){
                        $valid_users = $scene_user_mod->get_scene_users_info($validated['c_scene_config_id'],$v);
                        if(!$valid_users){
                            $ins_scene_user = $scene_user_mod->create_scene_users_info($validated['c_scene_config_id'],$v);
                            if(!$ins_scene_user){
                                throw new Exception("权限插入失败");
                            }
                        }
                    }
                }
            } catch (\Throwable $th) {
                Log::warning('在创建演练配置时，分配场景用户权限失败: ' . $th->getMessage());
            }

            return $adConfig;
        });

        $adConfig->load(['redTeam', 'blueTeam', 'referees.user', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    public function show(AdConfig $adConfig)
    {
        $adConfig->load(['redTeam', 'blueTeam', 'referees.user', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    public function update(Request $request, AdConfig $adConfig)
    {
        $validated = $request->validate([
            'c_drill_name'      => ['required', 'string', 'max:255', Rule::unique('c_ad_configs')->ignore($adConfig->c_id, 'c_id')],
            'c_description'     => 'nullable|string',
            'c_red_team_id'     => ['required', 'integer', 'exists:c_teams,c_id', new NoTeamMemberConflict((int)$request->input('c_blue_team_id', 0))],
            'c_blue_team_id'    => 'required|integer|exists:c_teams,c_id|different:c_red_team_id',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            // ★★★ START: 添加新字段的验证规则 ★★★
            'c_type'            => 'nullable|integer|in:1,2',
            'c_show_attack'     => 'nullable|integer|in:0,1',
            // ★★★ END: 添加新字段的验证规则 ★★★
            'referees'          => ['required', 'array', 'min:1', new NotInTeams((int)$request->input('c_red_team_id', 0), (int)$request->input('c_blue_team_id', 0))],
            'referees.*.c_user_id' => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'   => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
        ]);

        DB::transaction(function () use ($adConfig, $validated) {
            $adConfig->update($validated); // update() 方法会自动处理 $fillable 中的所有字段

            $adConfig->referees()->delete();

            $refereesToInsert = [];
            foreach ($validated['referees'] as $refereeData) {
                $refereesToInsert[] = [
                    'c_ad_config_id' => $adConfig->c_id,
                    'c_user_id'      => $refereeData['c_user_id'],
                    'c_level'        => $refereeData['c_level'],
                    'c_create_at'    => now(),
                    'c_update_at'    => now(),
                ];
            }
            if (!empty($refereesToInsert)) {
                Referee::insert($refereesToInsert);
            }
        });

        $adConfig->load(['redTeam', 'blueTeam', 'referees.user', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    // ... destroy, start, stop 等其他方法保持不变 ...
    public function stop(AdConfig $adConfig)
    {
        if ($adConfig->c_status !== 'running') {
            return response()->json(['message' => '演练不在运行状态，无法停止。'], 400);
        }

        if (!$adConfig->c_scene_instance_id) {
            $adConfig->update(['c_status' => 'finished']);
            return response()->json(['message' => '演练记录状态异常，已强制标记为结束。'], 200);
        }

        try {
            $this->tearDownInstanceResources($adConfig->c_scene_instance_id);

            $adConfig->update([
                'c_status' => 'finished',
                'c_end_time' => now(),
            ]);

            return response()->json(['message' => '演练 "' . $adConfig->c_drill_name . '" 已成功停止。']);

        } catch (\Exception $e) {
            $adConfig->update(['c_status' => 'failed']);
            Log::error('停止演练并清理资源时失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '停止演练时发生错误: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(AdConfig $adConfig)
    {
        try {
            DB::transaction(function () use ($adConfig) {
                if (in_array($adConfig->c_status, ['running', 'failed', 'creating']) && $adConfig->c_scene_instance_id) {
                    Log::info("演练 '{$adConfig->c_drill_name}' 处于 {$adConfig->c_status} 状态，开始清理资源...");
                    $this->tearDownInstanceResources($adConfig->c_scene_instance_id);
                }

                $sceneId = $adConfig->c_scene_config_id;
                if ($sceneId) {
                    Log::info("正在为演练 '{$adConfig->c_drill_name}' 清理场景权限...");
                    $teamUserMod = new TeamUsers();
                    $userList = $teamUserMod->get_teams_users($adConfig->c_red_team_id, $adConfig->c_blue_team_id);
                    if (!empty($userList)) {
                        SceneUsersModel::revokePermissions($sceneId, $userList);
                        Log::info("场景权限清理完毕。");
                    }
                }

                Log::info("正在删除演练配置记录 '{$adConfig->c_drill_name}' (ID: {$adConfig->c_id})...");
                $adConfig->delete();
                Log::info("演练配置记录已删除。");
            });
            return response()->json(['message' => '演练 "' . $adConfig->c_drill_name . '" 已成功删除，并清理了所有相关资源和权限。']);
        } catch (\Exception $e) {
            Log::error("删除演练 '{$adConfig->c_drill_name}' (ID: {$adConfig->c_id}) 时发生严重错误: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '删除演练失败: ' . $e->getMessage()], 500);
        }
    }

    private function tearDownInstanceResources(string $instanceId)
    {
        $instance = SceneInstance::with(['vms', 'containers', 'switches'])->find($instanceId);
        if (!$instance) {
            Log::warning("尝试清理一个不存在的场景实例 (ID: {$instanceId})，操作跳过。");
            return;
        }

        foreach ($instance->vms as $vm) {
            Log::info("清理虚拟机: {$vm->c_vm_name}");
            $vm->delete();
        }

        foreach ($instance->containers as $container) {
            Log::info("清理容器: {$container->c_container_id}");
            $container->delete();
        }

        foreach ($instance->switches as $switch) {
            Log::info("清理交换机: {$switch->c_switch_name}");
            DB::table('c_scene_switch_instances')
                ->where('c_switch_name', $switch->c_switch_name)
                ->where('c_scene_instances_id', $switch->c_scene_instances_id)
                ->delete();
        }

        $instance->delete();
        Log::info("场景实例 {$instanceId} 的所有资源及数据库记录已成功清理。");
    }

    public function start(Request $request, AdConfig $adConfig)
    {
        if ($adConfig->c_status === 'running' && $adConfig->c_scene_instance_id) {
            return response()->json(['message' => '演练已经在进行中，无法重复启动。'], 400);
        }

        if (!$adConfig->c_scene_config_id) {
            return response()->json(['message' => '此演练未配置有效的场景模板，无法启动。'], 400);
        }

        $scenario = SceneConfig::find($adConfig->c_scene_config_id);
        if (!$scenario) {
            return response()->json(['message' => '找不到关联的场景模板(ID: '.$adConfig->c_scene_config_id.')，无法启动。'], 404);
        }

        $user = $request->user();
        if (!$user || !property_exists($user, 'c_username')) {
            $username = $request->input('username', 'unknown');
            if ($username === 'unknown') {
                return response()->json(['message' => '无法获取有效的用户信息，请重新登录。'], 401);
            }
        } else {
            $username = $user->c_username;
        }

        try {
            $adController = app(AdController::class);
            $startDrillRequest = new Request([
                'username' => $username,
                'ad_config_id' => $adConfig->c_id,
            ]);
            return $adController->startDrill($startDrillRequest, $scenario);

        } catch (\Exception $e) {
            Log::error('在 AdConfigController@start 中调用 AdController@startDrill 失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '启动演练时发生内部错误。'], 500);
        }
    }
}
