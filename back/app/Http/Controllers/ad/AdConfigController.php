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

class AdConfigController extends Controller
{
    public function __construct(Request $req)
    {
        // 构造函数留空
        parent::__construct($req);
    }

    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 10);

        $query = AdConfig::query()->with([
            'sceneConfig:c_config_id,c_name,c_scene',
            'referees.user:c_username,c_name',
        ]);
        Log::info($query->toSql());
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
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
        } catch (\Exception $e) {
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
        } catch (\Exception $e) {
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
        // 实际的资源清理逻辑...
        // 这里应该调用 InstanceController@destroy 来保证完整的资源清理
        try {
             $instanceController = app(InstanceController::class);
             $instanceController->destroy($instance);
        } catch(Exception $e) {
             // 记录清理失败的日志，但不中断主流程
             Log::error("在 tearDownInstanceResources 中调用 InstanceController@destroy 失败: " . $e->getMessage());
             // 即使物理资源清理失败，数据库记录仍然会被删除
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
                // 将从 $scenario 对象中获取的拓扑 JSON 添加到请求中
                        'topology' => $scenario->c_scene,
            ]);
            // 确保 AdController::startDrill 返回的是一个 JsonResponse
            return $adController->startDrill($startDrillRequest, $scenario);
        } catch (\Exception $e) {
            Log::error('在 AdConfigController@start 中调用 AdController@startDrill 失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '启动演练时发生内部错误。'], 500);
        }
    }

    /**
     * ★★★ 新增方法 ★★★
     * 获取指定演练下的所有队伍及其成员列表（包括禁赛状态）。
     *
     * @param AdConfig $adConfig
     * @return JsonResponse
     */
    public function getTeamsWithMembers(AdConfig $adConfig): JsonResponse
        {
            try {
                // 步骤 1: 检查演练是否已启动并有关联的场景实例
                if (!$adConfig->c_scene_instance_id) {
                    return response()->json(['data' => []]);
                }

                // 步骤 2: 从节点实例表中直接获取所有唯一的 team_id
                // 这是最可靠的数据源
                $containerTeamIds = SceneContainerInstance::where('c_scene_instances_id', $adConfig->c_scene_instance_id)
                    ->distinct()
                    ->pluck('c_team_id');

                $vmTeamIds = SceneVmInstance::where('c_scene_instances_id', $adConfig->c_scene_instance_id)
                    ->distinct()
                    ->pluck('c_team_id');

                // 合并并去重所有找到的 team_id
                $allTeamIds = $containerTeamIds
                                ->merge($vmTeamIds)
                                ->unique()
                                ->filter() // 过滤掉 null 或空值
                                ->values()
                                ->all();

                if (empty($allTeamIds)) {
                    return response()->json(['data' => []]);
                }

                // 步骤 3: 根据提取出的 team_id 列表，查询队伍及其成员信息
                $teams = Team::whereIn('c_id', $allTeamIds)
                            ->with(['users:c_username,c_name']) // 预加载成员信息
                            ->get();

                return response()->json(['data' => $teams]);

            } catch (\Exception $e) {
                Log::error("获取演练成员列表失败 for ad_config_id: {$adConfig->c_id}: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
                return response()->json(['message' => '获取成员列表时发生服务器错误。'], 500);
            }
        }
    }
