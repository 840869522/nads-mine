<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
// ★ 关键：只引入你自定义的 UserModel，因为这是你项目中实际操作用户数据的方式
use App\Models\Users\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Exception;
use App\Models\ad\Referee;
use Illuminate\Http\Request;

/**
 * RefereeController
 *
 * 在新的业务模型下，此控制器的主要职责已变更为提供辅助数据。
 * 其核心功能是为演练配置模块提供一个完整的用户列表，以便在创建或编辑演练时指派裁判。
 * 旧的独立裁判CRUD操作已被废弃，相关逻辑已整合到 AdConfigController 中。
 */
class RefereeController extends Controller
{
    /**
     * 获取所有可用的用户列表作为裁判候选人。
     *
     * 这个方法是前端“指派裁判”功能下拉选择框的数据源。
     * 它调用 UserModel 中自定义的静态方法来获取所有用户，
     * 不再关心用户是否已被分配到其他演练中，因为一个用户可以担任多个演练的裁判。
     *
     * 路由: GET /api/ad/users
     *
     * @return \Illuminate\Http\JsonResponse
     */
//    public function availableUsers(): JsonResponse
//    {
//        try {
//            // ★ 核心逻辑：调用你在 UserModel 中自定义的静态方法来获取所有用户数据。
//            // 我们假设这个方法叫 `getAllAvailableUsers`，并且只返回前端需要的字段。
//            $users = UserModel::getAllAvailableUsers();
//
//            // 成功时，返回符合 JSend 规范的成功响应
//            return response()->json([
//                'status' => 'success',
//                'data' => $users
//            ]);
//
//        } catch (Exception $e) {
//            // 如果在获取数据过程中发生任何异常，记录详细错误日志
//            Log::error('Failed to fetch available users for referee assignment: ' . $e->getMessage(), [
//                'trace' => $e->getTraceAsString()
//            ]);
//
//            // 返回一个标准的服务器错误响应
//            return response()->json([
//                'status' => 'error',
//                'message' => '获取可用用户列表失败，请联系管理员。'
//            ], 500);
//        }
//    }
    public function availableUsers(Request $request): JsonResponse
    {
        try {
            // 优化：如果提供了演练ID，则排除该演练已有的裁判
            if ($request->has('ad_config_id')) {
                $adConfigId = $request->query('ad_config_id');
                // 1. 获取已是该演练裁判的所有用户ID
                $assignedUserIds = Referee::where('c_ad_config_id', $adConfigId)->pluck('c_user_id');
                // 2. 从 c_users 表中找出不包含这些ID的所有用户
                $users = UserModel::whereNotIn('c_username', $assignedUserIds)->select('c_username')->get();
            } else {
                // 如果没有提供演练ID，则返回所有用户 (根据您原有的逻辑)
                // 假设 UserModel::getAllAvailableUsers() 是您自定义的方法
                $users = UserModel::getAllAvailableUsers();
            }

            return response()->json([
                'status' => 'success',
                'data' => $users
            ]);

        } catch (Exception $e) {
            Log::error('Failed to fetch available users for referee assignment: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'status' => 'error',
                'message' => '获取可用用户列表失败，请联系管理员。'
            ], 500);
        }
    }

    public function index(): JsonResponse
    {
        try {
            // 获取所有裁判记录，并预加载关联的用户和演练信息
            $referees = Referee::with([
                'user:c_username',
                'adConfig:c_id,c_drill_name' // 假设 AdConfig 模型有 c_name 字段
            ])
                ->latest('c_create_at')
                ->get();

            return response()->json([
                'status' => 'success',
                'data' => $referees
            ]);

        } catch (Exception $e) {
            Log::error('Failed to fetch global referee list: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'status' => 'error',
                'message' => '获取裁判总览列表失败，请联系管理员。'
            ], 500);
        }
    }

}
