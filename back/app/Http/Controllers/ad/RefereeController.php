<?php
// file: app/Http/Controllers/ad/RefereeController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\Referee;
use App\Models\ad\SceneInstances;
use App\Models\Users\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;

class RefereeController extends Controller
{
    /**
     * 获取裁判总览列表 (已支持搜索和分页)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $perPage = $request->query('per_page', 10);
            $searchQuery = $request->query('search');

            $query = Referee::query()
                ->with(['user:c_username,c_name', 'adConfig']) // 建议同时获取 c_name 以便未来显示
                ->latest('c_create_at');

            // --- 新增搜索逻辑 ---
            if ($searchQuery) {
                $query->where(function ($q) use ($searchQuery) {
                    // 搜索关联的用户名
                    $q->whereHas('user', function ($userQuery) use ($searchQuery) {
                        $userQuery->where('c_username', 'LIKE', '%' . $searchQuery . '%')
                            ->orWhere('c_name', 'LIKE', '%' . $searchQuery . '%'); // 如果有真实姓名，也加入搜索
                    })
                        // 或者搜索关联的演练名称
                        ->orWhereHas('adConfig', function ($adConfigQuery) use ($searchQuery) {
                            $adConfigQuery->where('c_drill_name', 'LIKE', '%' . $searchQuery . '%');
                        });
                });
            }
            // --- 搜索逻辑结束 ---

            // 使用 paginate()
            $referees = $query->paginate($perPage);

            // 动态注入实例ID的逻辑保持不变，它将作用于当前页的数据
            $sceneInstancesModel = new SceneInstances();
            $referees->getCollection()->transform(function($referee) use ($sceneInstancesModel) {
                if ($referee->adConfig && $referee->adConfig->c_scene_config_id) {
                    $instance_id = $sceneInstancesModel->get_c_scene_instances_id(
                        $referee->adConfig->c_scene_config_id
                    );
                    if ($instance_id) {
                        $referee->adConfig->c_scene_instance_id = $instance_id;
                        $referee->adConfig->c_status = 'running';
                    }
                }
                return $referee;
            });

            // Laravel 的 paginate() 结果可以直接返回，Resource 会自动处理
            return response()->json($referees);

        } catch (Exception $e) {
            Log::error('获取裁判总览列表失败: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'status'  => 'error',
                'message' => '获取裁判总览列表失败，请联系管理员。'
            ], 500);
        }
    }

    /**
     * 获取可用的用户列表作为裁判候选人。
     */
    public function availableUsers(Request $request): JsonResponse
    {
        try {
            if ($request->has('ad_config_id')) {
                $adConfigId = $request->query('ad_config_id');
                $assignedUsernames = Referee::where('c_ad_config_id', $adConfigId)->pluck('c_user_id');
                $users = UserModel::whereNotIn('c_username', $assignedUsernames)->select('c_username')->get();
            } else {
                $users = UserModel::select('c_username')->get();
            }

            return response()->json([
                'status' => 'success',
                'data'   => $users
            ]);

        } catch (Exception $e) {
            Log::error('获取可用裁判用户列表失败: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'status'  => 'error',
                'message' => '获取可用裁判用户列表失败，请联系管理员。'
            ], 500);
        }
    }
}
