<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneConfig;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class ScenarioController extends Controller
{
    /**
     * Fetches the list of all scenarios from the database.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    /**
     * 获取所有场景的列表，并包含完整的拓扑数据.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        try {
            // 从数据库获取所有场景，按最新创建的排序
            $scenarios = SceneConfig::latest()->get();

            // 使用 map 方法来转换数据结构，以匹配前端的需求
            $scenariosData = $scenarios->map(function ($scenario) {
                return [
                    'id'          => $scenario->config_id,
                    'name'        => $scenario->name,
                    'description' => $scenario->description ?? '无描述',
                    'uploadDate'  => $scenario->created_at->toIso8601String(),
                    'nodeCount'   => isset($scenario->topology_json['nodes']) ? count($scenario->topology_json['nodes']) : 0,
                    
                    // --- 核心修改点在这里 ---
                    // 将完整的 topology_json 对象直接添加到返回数据中
                    'topology_json' => $scenario->topology_json, 
                ];
            });

            // 返回包含完整拓扑的场景数据数组
            return response()->json($scenariosData);

        } catch (\Exception $e) {
            Log::error('获取场景列表时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，获取列表失败。'], 500);
        }
    }

    /**
     * Creates a new scenario and saves it to the database.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        // --- 关键修改点在这里 ---
        // 我们在验证规则中加入了 'topology.edges'。
        // 'present|array' 规则确保 'edges' 这个键必须存在（即使它是一个空数组），且其值必须是数组。
        $validator = Validator::make($request->all(), [
            'name'          => 'required|string|max:100',
            'description'   => 'nullable|string',
            'topology'      => 'required|array',
            'topology.nodes' => 'present|array',
            'topology.edges' => 'present|array', // <-- 新增的验证规则
        ]);

        // 如果验证失败，返回详细的错误信息
        if ($validator->fails()) {
            return response()->json(['message' => '数据验证失败', 'errors' => $validator->errors()], 422);
        }

        // 获取所有通过验证的数据。
        // 因为我们现在验证了 'topology.edges'，所以 $validatedData['topology'] 会同时包含 nodes 和 edges。
        $validatedData = $validator->validated();

        try {
            // 使用验证后的数据创建记录。
            // 这里的 'topology_json' 字段将会接收包含 nodes 和 edges 的完整 topology 对象。
            $scenario = SceneConfig::create([
                'name'          => $validatedData['name'],
                'description'   => $validatedData['description'] ?? null,
                'topology_json' => $validatedData['topology'], // 此处数据现在是完整的
            ]);

            Log::info('新场景已存入数据库', ['id' => $scenario->id]); // 假设主键是 id
            return response()->json(['message' => '拓扑场景已成功保存！', 'data' => $scenario], 201);

        } catch (\Exception $e) {
            Log::error('保存新场景到数据库时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，保存失败。'], 500);
        }
    }

    /**
     * Deletes a specified scenario from the database.
     *
     * @param \Illuminate\Http\Request $request
     * @param int|null $id The ID from the route parameter (optional).
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, $id = null)
    {
        // 【关键修复】优先从URL路径中获取ID，如果不存在，则尝试从查询字符串中获取。
        // 这使得该方法同时兼容 DELETE /api/scenarios/{id} 和 DELETE /api/scenarios?id={id} 两种请求方式。
        $scenarioId = $id ?? $request->query('id');

        if (!$scenarioId) {
            return response()->json(['message' => '未提供要删除的场景ID'], 400);
        }

        try {
            // Find the scenario by its primary key or fail with a 404 error.
            $scenario = SceneConfig::findOrFail($scenarioId);
            
            // Delete the model instance.
            $scenario->delete();
            
            Log::info('场景已从数据库删除', ['id' => $scenarioId]);
            return response()->json(['message' => '场景删除成功'], 200);

        } catch (ModelNotFoundException $e) {
            Log::warning('尝试删除不存在的场景', ['id' => $scenarioId]);
            return response()->json(['message' => '要删除的场景不存在'], 404);
        } catch (\Exception $e) {
            Log::error('删除场景时发生错误: ' . $e->getMessage(), ['id' => $scenarioId]);
            return response()->json(['message' => '服务器内部错误，删除失败。'], 500);
        }
    }

    /**
     * 更新指定的场景资源.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\SceneConfig  $scenario  // <-- 使用了路由模型绑定
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, SceneConfig $scenario)
    {
        // 1. 数据验证
        // 规则与 store 方法类似
        $validator = Validator::make($request->all(), [
            'name'          => 'required|string|max:100',
            'description'   => 'nullable|string',
            'topology'      => 'required|array',
            'topology.nodes' => 'present|array',
            'topology.edges' => 'present|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '数据验证失败', 'errors' => $validator->errors()], 422);
        }

        $validatedData = $validator->validated();

        // 2. 更新数据库记录
        try {
            $scenario->update([
                'name'          => $validatedData['name'],
                'description'   => $validatedData['description'] ?? null,
                // 注意：数据库字段名是 topology_json
                'topology_json' => $validatedData['topology'],
            ]);

            Log::info('场景已更新', ['id' => $scenario->id]);
            // 3. 返回成功响应
            return response()->json(['message' => '场景更新成功！', 'data' => $scenario]);

        } catch (\Exception $e) {
            Log::error('更新场景时发生错误: ' . $e->getMessage(), ['id' => $scenario->id]);
            return response()->json(['message' => '服务器内部错误，更新失败。'], 500);
        }
    }
}
