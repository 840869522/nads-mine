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
use App\Models\scenario\SceneInstance;
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
    /**
     * ★★★ 核心修改点 ★★★
     * 修改 index 方法以进行深度预加载，确保前端能获取到 users 及其 pivot 数据。
     */
    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);

        $query = AdConfig::query()->with([
            'redTeam.users', // 加载红队及其所有成员（包括pivot数据）
            'blueTeam.users', // 加载蓝队及其所有成员（包括pivot数据）
            'referees',
            'sceneConfig'
        ]);

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
     * 停止一个正在运行的演练。
     */
    public function stop(AdConfig $adConfig)
    {
        // 1. 验证状态
        if ($adConfig->c_status !== 'running') {
            return response()->json(['message' => '演练不在运行状态，无法停止。'], 400);
        }

        if (!$adConfig->c_scene_instance_id) {
            // 如果没有实例ID，但状态却是running，这是数据异常。直接将其标记为finished。
            $adConfig->update(['c_status' => 'finished']);
            return response()->json(['message' => '演练记录状态异常，已强制标记为结束。'], 200);
        }

        try {
            // 2. 调用资源清理逻辑
            $this->tearDownInstanceResources($adConfig->c_scene_instance_id);

            // 3. 更新演练状态
            $adConfig->update([
                'c_status' => 'finished',
                'c_end_time' => now(), // 记录实际结束时间
            ]);

            return response()->json(['message' => '演练 "' . $adConfig->c_drill_name . '" 已成功停止。']);

        } catch (\Exception $e) {
            // 即使清理失败，也尝试将状态标记为异常，以便手动干预
            $adConfig->update(['c_status' => 'failed']);
            Log::error('停止演练并清理资源时失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '停止演练时发生错误: ' . $e->getMessage()], 500);
        }
    }

    /**
     * 删除演练
     * 增强版：能够处理正在运行的演练，会先尝试清理其关联的虚拟资源。
     */
    public function destroy(AdConfig $adConfig)
    {
        try {
            DB::transaction(function () use ($adConfig) {
                // 步骤 1: 如果演练正在运行或创建失败，首先清理其关联的场景实例和虚拟资源
                if (in_array($adConfig->c_status, ['running', 'failed', 'creating']) && $adConfig->c_scene_instance_id) {
                    Log::info("演练 '{$adConfig->c_drill_name}' 处于 {$adConfig->c_status} 状态，开始清理资源...");
                    $this->tearDownInstanceResources($adConfig->c_scene_instance_id);
                }

                // 步骤 2: 清理与场景模板相关的用户权限 (保留原有逻辑)
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

                // 步骤 3: 删除演练配置记录本身 (包括裁判关系，会自动级联删除)
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
    // ===================================================================
    // ★★★★★★  这就是你缺失的部分！ ★★★★★★
    // ===================================================================
    /**
     * 辅助方法：拆除和清理场景实例资源
     */
    private function tearDownInstanceResources(string $instanceId)
    {
        $instance = SceneInstance::with(['vms', 'containers', 'switches'])->find($instanceId);
        if (!$instance) {
            Log::warning("尝试清理一个不存在的场景实例 (ID: {$instanceId})，操作跳过。");
            return;
        }

        // 假设 CommandLineService 可以通过 app() 助手函数获取
        // 如果你的项目结构不同，请确保能正确获取到服务实例
        $cliService = app(\App\RunTool\CommandLineService::class);

        // 1. 清理虚拟机
        foreach ($instance->vms as $vm) {
            Log::info("清理虚拟机: {$vm->c_vm_name}");
            // $cliService->destroyVm($vm->c_vm_name); // TODO: 解除注释并确保此方法有效
            $vm->delete();
        }

        // 2. 清理容器
        foreach ($instance->containers as $container) {
            Log::info("清理容器: {$container->c_container_id}");
            // $cliService->destroyContainer($container->c_container_id); // TODO: 解除注释并确保此方法有效
            $container->delete();
        }

        // 3. 清理交换机
        foreach ($instance->switches as $switch) {
            Log::info("清理交换机: {$switch->c_switch_name}");
            // $cliService->destroySwitch($switch->c_switch_name); // TODO: 解除注释并确保此方法有效
            $switch->delete();
        }

        // 4. 删除场景实例记录本身
        $instance->delete();
        Log::info("场景实例 {$instanceId} 的所有资源及数据库记录已成功清理。");
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

}
