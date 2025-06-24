<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ScenarioController extends Controller
{
    /**
     * 获取所有场景列表。
     * 对应前端的 fetchScenarios 功能。
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        try {
            $files = Storage::files('scenarios'); // 获取 scenarios 目录下的所有文件
            $scenariosData = [];

            foreach ($files as $filePath) {
                // 跳过非 JSON 文件或隐藏文件
                if (pathinfo($filePath, PATHINFO_EXTENSION) !== 'json') {
                    continue;
                }

                $jsonContent = Storage::get($filePath);
                $data = json_decode($jsonContent, true);

                // 如果JSON解析失败或缺少关键数据，则跳过此文件
                if ($data === null || !isset($data['name']) || !isset($data['topology']['nodes'])) {
                    Log::warning('跳过无效的场景文件', ['path' => $filePath]);
                    continue;
                }

                // 按照前端需要的数据结构进行组装
                $scenariosData[] = [
                    'id'          => basename($filePath), // 文件名作为唯一ID
                    'name'        => $data['name'],
                    'description' => $data['description'] ?? '无描述', // 如果没有描述则提供默认值
                    // 使用文件的最后修改时间作为上传日期
                    'uploadDate'  => date('c', Storage::lastModified($filePath)), // 'c' 格式是 ISO 8601 标准
                    'nodeCount'   => count($data['topology']['nodes']),
                ];
            }

            return response()->json($scenariosData);

        } catch (\Exception $e) {
            Log::error('获取场景列表时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，获取列表失败。'], 500);
        }
    }

    /**
     * 删除一个指定的场景文件。
     * 对应前端的 handleConfirmDelete 功能。
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request)
    {
        // 1. 从URL查询参数中获取要删除的文件ID（即文件名）
        $fileId = $request->query('id');

        // 2. 验证ID是否存在
        if (!$fileId) {
            return response()->json(['message' => '未提供要删除的场景ID'], 400); // Bad Request
        }

        // 3. 【安全措施】防止目录遍历攻击，只处理文件名部分
        $safeFileId = basename($fileId);
        $filePath = 'scenarios/' . $safeFileId;

        try {
            // 4. 检查文件是否存在于我们的存储中
            if (Storage::exists($filePath)) {
                // 5. 如果存在，则删除文件
                Storage::delete($filePath);
                Log::info('场景文件已删除', ['path' => $filePath]);
                return response()->json(['message' => '场景删除成功'], 200);
            } else {
                // 6. 如果文件不存在，返回404错误
                Log::warning('尝试删除不存在的场景文件', ['path' => $filePath]);
                return response()->json(['message' => '要删除的场景不存在'], 404); // Not Found
            }
        } catch (\Exception $e) {
            Log::error('删除场景文件时发生错误: ' . $e->getMessage(), ['path' => $filePath]);
            return response()->json(['message' => '服务器内部错误，删除失败。'], 500);
        }
    }

    /**
     * 创建一个新的场景并保存为JSON文件。(此方法保持不变)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'topology' => 'required|array',
            'topology.nodes' => 'present|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '数据验证失败', 'errors' => $validator->errors()], 422);
        }
        $validatedData = $validator->validated();

        try {
            $directory = 'scenarios';
            Storage::makeDirectory($directory);

            $safeName = Str::slug($validatedData['name']);
            $fileName = $safeName . '_' . time() . '.json';
            $filePath = $directory . '/' . $fileName;

            $fileContents = json_encode($validatedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            Storage::put($filePath, $fileContents);

            Log::info('新场景文件已保存', ['path' => $filePath]);
            return response()->json(['message' => '拓扑场景已成功保存！', 'file_path' => $filePath], 201);

        } catch (\Exception $e) {
            Log::error('保存新场景文件时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，保存失败。'], 500);
        }
    }
}