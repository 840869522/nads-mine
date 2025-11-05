<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdConfigResource;
use App\Models\ad\AdConfig;
use App\Models\ad\Referee;
use Exception;
use App\Models\scenario\SceneInstance;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use App\Http\Controllers\ad\AdController;
use App\Models\scenario\SceneConfig;
use Illuminate\Support\Facades\Log;
use App\Models\scenario\SceneContainerInstance;
use App\Models\scenario\SceneVmInstance;
use App\Models\ad\Team;
use App\Utils\JWTControll;
use App\Http\Controllers\scenario\InstanceController; // ★ 新增：引入 InstanceController 以复用其方法
use Illuminate\Support\Facades\Validator;             // ★ 新增：引入 Validator 以便在新方法中使用

class AdConfigController extends Controller
{
    public function __construct(Request $req)
    {
        parent::__construct($req);
    }

    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);
        $search = $request->query('search');

        $currentUser = null;
        try {
            $authHeader = $request->header("Authorization");
            if ($authHeader) {
                $jwtResult = JWTControll::decodeJWT($authHeader);
                if ($jwtResult["err"] === null) {
                    $currentUser = $jwtResult["data"];
                }
            }
        } catch (Exception $e) {
            Log::warning('在 AdConfigController@index 中解析JWT失败: ' . $e->getMessage());
        }

        $query = AdConfig::query()->with([
            'sceneConfig:c_config_id,c_name',
            'referees.user:c_username,c_name',
        ]);

        if ($currentUser && isset($currentUser['c_username']) && $currentUser['c_username'] !== 'admin') {
            $currentUsername = $currentUser['c_username'];
            $teamIds = DB::table('c_teams_users')->where('user_id', $currentUsername)->pluck('team_id');
            $refereeAdConfigIds = DB::table('c_referees')->where('c_user_id', $currentUsername)->pluck('c_ad_config_id');
            $participantAdConfigIds = collect([]);
            if ($teamIds->isNotEmpty()) {
                $sceneInstanceIds = DB::table('c_scene_container_instances')
                    ->whereIn('c_team_id', $teamIds)
                    ->pluck('c_scene_instances_id')
                    ->merge(
                        DB::table('c_scene_vm_instances')
                            ->whereIn('c_team_id', $teamIds)
                            ->pluck('c_scene_instances_id')
                    )
                    ->unique();
                if($sceneInstanceIds->isNotEmpty()){
                    $participantAdConfigIds = AdConfig::whereIn('c_scene_instance_id', $sceneInstanceIds)->pluck('c_id');
                }
            }
            $allVisibleAdConfigIds = $participantAdConfigIds->merge($refereeAdConfigIds)->unique();
            if ($allVisibleAdConfigIds->isNotEmpty()) {
                $query->whereIn('c_id', $allVisibleAdConfigIds);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($search) {
            $query->where('c_drill_name', 'like', '%' . $search . '%');
        }

        $adConfigs = $query->latest('c_create_at')->paginate($perPage);

        return AdConfigResource::collection($adConfigs);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'c_drill_name'      => 'required|string|max:255|unique:c_ad_configs,c_drill_name',
            'c_description'     => 'nullable|string',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            'c_type'            => 'nullable|integer|in:1,2',
            'c_show_attack'     => 'nullable|integer|in:0,1',
            'referees'          => 'present|array',
            'referees.*.c_user_id' => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'   => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
        ], [
            'c_drill_name.unique' => '该演练名称已被使用。',
            'referees.*.c_user_id.exists' => '提供的一个或多个裁判用户不存在。',
        ]);

        $adConfig = DB::transaction(function () use ($validated) {
            $adConfig = AdConfig::create([
                'c_id'                => (string) Str::uuid(),
                'c_drill_name'        => $validated['c_drill_name'],
                'c_description'       => $validated['c_description'] ?? null,
                'c_scene_config_id'   => $validated['c_scene_config_id'] ?? null,
                'c_scene_instance_id' => null,
                'c_start_time'        => $validated['c_start_time'] ?? null,
                'c_end_time'          => $validated['c_end_time'] ?? null,
                'c_type'              => $validated['c_type'] ?? null,
                'c_show_attack'       => $validated['c_show_attack'] ?? null,
                'c_status'            => 'pending',
            ]);

            if (!empty($validated['referees'])) {
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
                Referee::insert($refereesToInsert);
            }

            return $adConfig;
        });

        $adConfig->load(['referees.user', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    public function show(AdConfig $adConfig)
    {
        $adConfig->load(['referees.user', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    public function update(Request $request, AdConfig $adConfig)
    {
        $validated = $request->validate([
            'c_drill_name'      => ['required', 'string', 'max:255', Rule::unique('c_ad_configs')->ignore($adConfig->c_id, 'c_id')],
            'c_description'     => 'nullable|string',
            'c_scene_config_id' => 'nullable|integer|exists:c_scene_configs,c_config_id',
            'c_start_time'      => 'nullable|date',
            'c_end_time'        => 'nullable|date|after_or_equal:c_start_time',
            'c_type'            => 'nullable|integer|in:1,2',
            'c_show_attack'     => 'nullable|integer|in:0,1',
            'referees'          => 'present|array',
            'referees.*.c_user_id' => 'required|string|exists:c_users,c_username',
            'referees.*.c_level'   => ['required', 'string', Rule::in(['主裁判', '普通裁判', '技术专家'])],
        ]);

        DB::transaction(function () use ($adConfig, $validated) {
            $adConfig->update($validated);

            $adConfig->referees()->delete();
            if (!empty($validated['referees'])) {
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
                Referee::insert($refereesToInsert);
            }
        });

        $adConfig->load(['referees.user', 'sceneConfig']);
        return new AdConfigResource($adConfig);
    }

    public function destroy(AdConfig $adConfig)
    {
        try {
            DB::transaction(function () use ($adConfig) {
                if (in_array($adConfig->c_status, ['running', 'failed', 'creating']) && $adConfig->c_scene_instance_id) {
                    $this->tearDownInstanceResources($adConfig->c_scene_instance_id);
                }
                $adConfig->delete();
            });
            return response()->json(['message' => '演练 "' . $adConfig->c_drill_name . '" 已成功删除。']);
        } catch (Exception $e) {
            Log::error("删除演练 '{$adConfig->c_drill_name}' 失败: " . $e->getMessage());
            return response()->json(['message' => '删除演练失败: ' . $e->getMessage()], 500);
        }
    }

    public function stop(AdConfig $adConfig): JsonResponse
    {
        if ($adConfig->c_status !== 'running') {
            return response()->json(['message' => '演练不在运行状态，无法停止。'], 400);
        }
        if (!$adConfig->c_scene_instance_id) {
            $adConfig->update(['c_status' => 'finished']);
            return response()->json(['message' => '演练记录状态异常，已强制标记为结束。']);
        }
        try {
            $this->tearDownInstanceResources($adConfig->c_scene_instance_id);
            $adConfig->update(['c_status' => 'finished', 'c_end_time' => now()]);
            return response()->json(['message' => '演练 "' . $adConfig->c_drill_name . '" 已成功停止。']);
        } catch (Exception $e) {
            $adConfig->update(['c_status' => 'failed']);
            Log::error('停止演练并清理资源时失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '停止演练时发生错误: ' . $e->getMessage()], 500);
        }
    }

    private function tearDownInstanceResources(string $instanceId): void
    {
        $instance = SceneInstance::find($instanceId);
        if (!$instance) {
            Log::warning("尝试清理一个不存在的场景实例 (ID: {$instanceId})，操作跳过。");
            return;
        }
        try {
             $instanceController = app(InstanceController::class);
             $instanceController->destroy($instance);
        } catch(Exception $e) {
             Log::error("在 tearDownInstanceResources 中调用 InstanceController@destroy 失败: " . $e->getMessage());
             $instance->delete();
        }
    }

    public function start(Request $request, AdConfig $adConfig): JsonResponse
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
        $username = $request->input('username');
        if (!$username) {
            return response()->json(['message' => '无法获取有效的用户信息，请重新登录。'], 401);
        }

        try {
            $adController = app(AdController::class);
            $startDrillRequest = new Request([
                'username' => $username,
                'ad_config_id' => $adConfig->c_id,
                'topology' => $scenario->c_scene,
            ]);
            return $adController->startDrill($startDrillRequest, $scenario);
        } catch (Exception $e) {
            Log::error('在 AdConfigController@start 中调用 AdController@startDrill 失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '启动演练时发生内部错误。'], 500);
        }
    }

    public function getTeamsWithMembers(AdConfig $adConfig): JsonResponse
    {
        try {
            if (!$adConfig->c_scene_instance_id) {
                return response()->json(['data' => []]);
            }

            $containerTeamIds = SceneContainerInstance::where('c_scene_instances_id', $adConfig->c_scene_instance_id)
                ->distinct()
                ->pluck('c_team_id');

            $vmTeamIds = SceneVmInstance::where('c_scene_instances_id', $adConfig->c_scene_instance_id)
                ->distinct()
                ->pluck('c_team_id');

            $allTeamIds = $containerTeamIds
                            ->merge($vmTeamIds)
                            ->unique()
                            ->filter()
                            ->values()
                            ->all();

            if (empty($allTeamIds)) {
                return response()->json(['data' => []]);
            }

            $teams = Team::whereIn('c_id', $allTeamIds)
                        ->with(['users:c_username,c_name'])
                        ->get();

            return response()->json(['data' => $teams]);

        } catch (Exception $e) {
            Log::error("获取演练成员列表失败 for ad_config_id: {$adConfig->c_id}: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '获取成员列表时发生服务器错误。'], 500);
        }
    }

    // =========================================================================
    // ★★★★★★★★★★★★★★★★★ 新增的功能代码 ★★★★★★★★★★★★★★★★★
    // =========================================================================

    /**
     * 动态更新一个正在运行的攻防演练的拓扑。
     *
     * @param Request $request
     * @param AdConfig $adConfig (通过路由模型绑定注入)
     * @return JsonResponse
     */
    public function updateTopology(Request $request, AdConfig $adConfig): JsonResponse
    {
        // 步骤 A: 检查演练状态
        if ($adConfig->c_status !== 'running' || !$adConfig->c_scene_instance_id) {
            return response()->json(['message' => '只有正在运行的演练才能更新拓扑。'], 400);
        }

        // 步骤 B: 验证前端发来的新拓扑数据
        try {
            $validated = Validator::make($request->all(), [
                'topology' => 'required|array',
                'topology.nodes' => 'present|array',
                'topology.edges' => 'present|array',
            ])->validate();
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => '数据验证失败', 'errors' => $e->errors()], 422);
        }

        // 步骤 C: 找到关联的场景实例
        $sceneInstance = SceneInstance::find($adConfig->c_scene_instance_id);
        if (!$sceneInstance) {
            return response()->json(['message' => '找不到关联的场景实例，无法应用变更。'], 404);
        }

        try {
            // 步骤 D: (核心) 创建 InstanceController 实例并调用其公共方法
            $instanceController = app(InstanceController::class);
            $applyResult = $instanceController->applyTopologyDiff($sceneInstance, $validated['topology']);

            // 步骤 E: 更新场景实例自己的拓扑配置快照，以反映最新状态
            $sceneInstance->c_scene_config = $validated['topology'];
            $sceneInstance->save();

            Log::info('攻防演练拓扑已动态更新并应用', [
                'ad_config_id' => $adConfig->c_id,
                'scene_instance_id' => $sceneInstance->c_scene_instances_id
            ]);

            return response()->json([
                'message' => '演练拓扑已成功更新并应用',
                'applied' => $applyResult,
            ]);

        } catch (Exception $e) {
            Log::error('动态更新攻防演练拓扑时失败: ' . $e->getMessage(), [
                'ad_config_id' => $adConfig->c_id,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => '应用拓扑变更时发生服务器错误：' . $e->getMessage()], 500);
        }
    }
}
