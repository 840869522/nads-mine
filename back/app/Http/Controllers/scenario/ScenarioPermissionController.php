<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneConfig;
use App\Models\Users\UserModel;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse; // 引入 JsonResponse 类型提示
use Illuminate\Support\Facades\Log;

class ScenarioPermissionController extends Controller
{
    /**
     * 获取所有可用于权限分配的用户列表。
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getAllUsers(): JsonResponse // 推荐为方法返回值添加类型提示
    {
        // ▼▼▼ 这里是主要修改区域 ▼▼▼
        try {
            // 1. 使用 Eloquent 模型进行查询，而不是原生 SQL
            // 这样做更安全（防止SQL注入）、更易读、更易维护。
            $users = UserModel::where('c_is_login', 1) // 业务逻辑：只选择允许登录的用户
            ->select('c_username as id', 'c_username as name') // 选择并重命名字段以匹配前端需求
            ->orderBy('c_username', 'asc') // 推荐按用户名排序，让前端列表有序
            ->get();

            // 2. 直接返回 Eloquent 集合，Laravel 会自动将其转换为 JSON 数组。
            //    HTTP 状态码默认为 200，对于 GET 请求是正确的。
            return response()->json($users);

        } catch (\Exception $e) {
            // 3. 健壮的错误处理：记录详细日志，返回通用错误信息
            Log::error('Failed to get all users for permission assignment: ' . $e->getMessage());

            // 向前端返回一个标准的 500 内部服务器错误
            return response()->json([
                'message' => '获取用户列表时发生服务器内部错误。'
            ], 500);
        }
        // ▲▲▲ 修改结束 ▲▲▲
    }

    /**
     * 获取指定场景已授权的用户列表。
     *
     * @param string $scenarioId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPermissions(string $scenarioId): JsonResponse
    {
        // 这部分代码已经写得很好，无需修改。
        if (!is_numeric($scenarioId) || $scenarioId <= 0) {
            return response()->json(['success' => false, 'message' => '无效的场景ID'], 400);
        }

        try {
            $permissionedUsernames = SceneConfig::getPermissionedUsers($scenarioId);
            return response()->json($permissionedUsernames);
        } catch (\Exception $e) {
            Log::error("Failed to get permissions for scenario {$scenarioId}: " . $e->getMessage());
            return response()->json(['message' => '获取场景权限时发生错误。'], 500);
        }
    }

    /**
     * 保存对指定场景权限的修改。
     *
     * @param \Illuminate\Http\Request $request
     * @param string $scenarioId
     * @return \Illuminate\Http\JsonResponse
     */
    public function savePermissions(Request $request, string $scenarioId): JsonResponse
    {
        // 这部分代码也已经写得很好，唯一的优化是统一错误响应格式。
        $validated = $request->validate([
            'users'   => 'nullable|array',
            'users.*' => 'string',
        ]);

        if (!is_numeric($scenarioId) || $scenarioId <= 0) {
            return response()->json(['success' => false, 'message' => '无效的场景ID'], 400);
        }

        $userIds = $validated['users'] ?? [];

        try {
            // 这里假设 syncPermissions 成功时返回 true，失败时抛出异常或返回 false
            $success = SceneConfig::syncPermissions($scenarioId, $userIds);

            if ($success) {
                return response()->json([
                    'success' => true,
                    'message' => '权限保存成功！',
                ]);
            } else {
                // 如果 syncPermissions 返回 false，可以认为是一个业务逻辑上的失败
                return response()->json([
                    'success' => false,
                    'message' => '权限保存失败，请稍后重试。',
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error("[PERMISSION_SAVE_CONTROLLER] for scenario {$scenarioId}: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => '发生内部错误，权限保存失败。',
            ], 500);
        }
    }
}
