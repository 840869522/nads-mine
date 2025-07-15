<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
// ★ 关键：只引入你自定义的 UserModel，因为这是你项目中实际操作用户数据的方式
use App\Models\Users\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Exception;

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
    public function availableUsers(): JsonResponse
    {
        try {
            // ★ 核心逻辑：调用你在 UserModel 中自定义的静态方法来获取所有用户数据。
            // 我们假设这个方法叫 `getAllAvailableUsers`，并且只返回前端需要的字段。
            $users = UserModel::getAllAvailableUsers();

            // 成功时，返回符合 JSend 规范的成功响应
            return response()->json([
                'status' => 'success',
                'data' => $users
            ]);

        } catch (Exception $e) {
            // 如果在获取数据过程中发生任何异常，记录详细错误日志
            Log::error('Failed to fetch available users for referee assignment: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            // 返回一个标准的服务器错误响应
            return response()->json([
                'status' => 'error',
                'message' => '获取可用用户列表失败，请联系管理员。'
            ], 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | 已废弃的方法
    |--------------------------------------------------------------------------
    |
    | 在新的业务模型中，裁判是通过 "c_referees" 中间表与演练关联的。
    | 因此，独立的 "创建/读取/更新/删除" 裁判的操作已不再适用。
    | 相关的指派逻辑已全部移至 AdConfigController 的 store 和 update 方法中。
    |
    | 为了保持代码整洁和逻辑清晰，旧的 `index`, `store`, `show`, `update`,
    | `destroy` 方法已被彻底移除。
    |
    */
}
