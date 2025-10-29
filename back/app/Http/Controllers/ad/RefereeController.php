<?php
// file: app/Http/Controllers/ad/RefereeController.php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\Referee;
use App\Models\scenario\SceneInstance;
use App\Models\Users\UserModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;

class RefereeController extends Controller
{
    /**
     * 获取裁判总览列表。
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $perPage = $request->query('per_page', 10);
            $searchQuery = $request->query('search');

            // 预加载逻辑保持不变，访问器不能通过 with() 预加载
            $query = Referee::query()
                ->with([
                    'user:c_username,c_name',
                    'adConfig',
                    'adConfig.sceneConfig:c_config_id,c_name'
                ])
                ->latest('c_create_at');

            // --- 搜索逻辑 (保持不变) ---
            if ($searchQuery) {
                $query->where(function ($q) use ($searchQuery) {
                    $q->whereHas('user', function ($userQuery) use ($searchQuery) {
                        $userQuery->where('c_username', 'LIKE', '%' . $searchQuery . '%')
                            ->orWhere('c_name', 'LIKE', '%' . $searchQuery . '%');
                    })
                        ->orWhereHas('adConfig', function ($adConfigQuery) use ($searchQuery) {
                            $adConfigQuery->where('c_drill_name', 'LIKE', '%' . $searchQuery . '%');
                        });
                });
            }

            $referees = $query->paginate($perPage);

            // 使用 transform 方法重塑返回给前端的数据结构
            $referees->getCollection()->transform(function($referee) {

                $adConfigData = null;
                if ($referee->adConfig) {

                    // 动态注入实例ID的逻辑保持不变
                    if (empty($referee->adConfig->c_scene_instance_id) && $referee->adConfig->c_scene_config_id) {
                        $instance = SceneInstance::where('c_config_id', $referee->adConfig->c_scene_config_id)
                            ->where('c_status', 'RUNNING')
                            ->select('c_scene_instances_id')
                            ->first();
                        if ($instance) {
                            $referee->adConfig->c_scene_instance_id = $instance->c_scene_instances_id;
                            $referee->adConfig->c_status = 'running';
                        }
                    }

                    // ★ 核心修改：构建 adConfig 数据时，通过访问器获取并添加 teams 数据 ★
                    $adConfigData = [
                        'c_id' => $referee->adConfig->c_id,
                        'c_drill_name' => $referee->adConfig->c_drill_name,
                        'c_status' => $referee->adConfig->c_status,
                        'c_scene_config_id' => $referee->adConfig->c_scene_config_id,
                        'c_scene_instance_id' => $referee->adConfig->c_scene_instance_id,
                        'sceneConfig' => $referee->adConfig->sceneConfig ? ['c_name' => $referee->adConfig->sceneConfig->c_name] : null,
                        'teams' => $referee->adConfig->teams, // <-- 这里会触发 AdConfig 模型中 getTeamsAttribute 方法
                    ];
                }

                // 确保返回的结构与前端期望的 RefereeEntry 类型一致
                return [
                    'c_user_id' => $referee->c_user_id,
                    'c_ad_config_id' => $referee->c_ad_config_id,
                    'c_level' => $referee->c_level,
                    'c_create_at' => $referee->c_create_at->toDateTimeString(),
                    'user' => $referee->user,
                    'ad_config' => $adConfigData,
                ];
            });

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
     * (此方法无需修改)
     */
    public function availableUsers(Request $request): JsonResponse
    {
        try {
            if ($request->has('ad_config_id')) {
                $adConfigId = $request->query('ad_config_id');
                $assignedUsernames = Referee::where('c_ad_config_id', $adConfigId)->pluck('c_user_id');
                $users = UserModel::whereNotIn('c_username', $assignedUsernames)->select('c_username', 'c_name')->get();
            } else {
                $users = UserModel::select('c_username', 'c_name')->get();
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
