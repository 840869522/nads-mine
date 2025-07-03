<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
// --- 【关键】控制器只需要引入这两个我们自己创建的类 ---
use App\RunTool\TopologyParser;
use App\RunTool\CommandLineService;

class ScenarioController extends Controller
{
    // --- 【关键修改】注入新的服务 ---
    private CommandLineService $cliService;

    public function __construct(CommandLineService $cliService)
    {
        $this->cliService = $cliService;
    }

    public function startDrill(SceneConfig $scenario)
    {
        // 1. 解析拓扑 (这部分已确认工作正常)
        $parsedTopology = TopologyParser::parse($scenario->topology_json);
        $containers = $parsedTopology['containers'];
        $switches = $parsedTopology['switches'];

        $createdContainersInfo = [];

        try {
            $drillPrefix = 'drill_' . $scenario->config_id . '_' . time();

            Log::info("OVS 网桥创建步骤已跳过 (将在后续实现)。");

            // 2. 【阶段一】遍历并创建所有容器
            foreach ($containers as $containerData) {
                $options = [
                    'image' => $containerData['image'],
                    'name'  => $drillPrefix . '_' . str_replace([' '], '_', $containerData['label']),
                    'ports' => $containerData['portMappings'],
                    'env'   => $containerData['env'],
                ];

                Log::info("正在创建容器: {$options['name']} (镜像: {$options['image']})");

                // a. 调用服务创建容器
                $containerId = $this->cliService->createContainer($options);

                // b. 【阶段二】立即获取并记录PID
                $pid = $this->cliService->getContainerPid($containerId);

                $createdContainersInfo[$containerData['id']] = [
                    'container_id' => $containerId,
                    'pid' => $pid,
                    'label' => $containerData['label']
                ];
                Log::info("容器创建并启动成功: {$options['name']}, ID: {$containerId}, PID: {$pid}");
            }

            return response()->json([
                'message' => '所有容器已成功创建！下一步将进行网络连接。',
                'drill_prefix' => $drillPrefix,
                'created_containers' => $createdContainersInfo,
            ]);

        } catch (\Exception $e) {
            $errorMessage = $e->getMessage();
            if (!mb_check_encoding($errorMessage, 'UTF-8')) {
                $errorMessage = mb_convert_encoding($errorMessage, 'UTF-8', 'auto');
            }
            Log::error("启动场景 '{$scenario->name}' 时发生严重错误: " . $errorMessage);

            // 错误回滚逻辑 (未来需要实现)
            // foreach ($createdContainersInfo as $info) { ... }

            return response()->json(['message' => '启动场景时发生错误：' . $errorMessage], 500);
        }
    }

    // --- 您其他的 index, store, destroy, update 方法放在这里 ---
    public function index()
    {
        try {
            $scenarios = SceneConfig::latest()->get();
            $scenariosData = $scenarios->map(function ($scenario) {
                return [
                    'id'            => $scenario->config_id,
                    'name'          => $scenario->name,
                    'description'   => $scenario->description ?? '无描述',
                    'uploadDate'    => $scenario->created_at->toIso8601String(),
                    'nodeCount'     => isset($scenario->topology_json['nodes']) ? count($scenario->topology_json['nodes']) : 0,
                    'topology_json' => $scenario->topology_json,
                ];
            });
            return response()->json($scenariosData);
        } catch (\Exception $e) {
            Log::error('获取场景列表时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，获取列表失败。'], 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name'             => 'required|string|max:100',
            'description'      => 'nullable|string',
            'topology_json'    => 'required|array',
            'topology_json.nodes' => 'present|array',
            'topology_json.edges' => 'present|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '数据验证失败', 'errors' => $validator->errors()], 422);
        }

        try {
            $scenario = SceneConfig::create($validator->validated());
            return response()->json(['message' => '拓扑场景已成功保存！', 'data' => $scenario], 201);
        } catch (\Exception $e) {
            Log::error('保存新场景到数据库时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，保存失败。'], 500);
        }
    }

    public function destroy(Request $request, $id = null)
    {
        $scenarioId = $id ?? $request->query('id');
        if (!$scenarioId) {
            return response()->json(['message' => '未提供要删除的场景ID'], 400);
        }
        try {
            $scenario = SceneConfig::findOrFail($scenarioId);
            $scenario->delete();
            return response()->json(['message' => '场景删除成功'], 200);
        } catch (ModelNotFoundException $e) {
            return response()->json(['message' => '要删除的场景不存在'], 404);
        } catch (\Exception $e) {
            Log::error('删除场景时发生错误: ' . $e->getMessage(), ['id' => $scenarioId]);
            return response()->json(['message' => '服务器内部错误，删除失败。'], 500);
        }
    }

    public function update(Request $request, SceneConfig $scenario)
    {
        $validator = Validator::make($request->all(), [
            'name'             => 'required|string|max:100',
            'description'      => 'nullable|string',
            'topology_json'    => 'required|array',
            'topology_json.nodes' => 'present|array',
            'topology_json.edges' => 'present|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '数据验证失败', 'errors' => $validator->errors()], 422);
        }

        try {
            $scenario->update($validator->validated());
            return response()->json(['message' => '场景更新成功！', 'data' => $scenario]);
        } catch (\Exception $e) {
            Log::error('更新场景时发生错误: ' . $e->getMessage(), ['id' => $scenario->config_id]);
            return response()->json(['message' => '服务器内部错误，更新失败。'], 500);
        }
    }
}
