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
     * 获取裁判总览列表 (已支持搜索、分页和丰富的关联数据)
     * [防御性编程版]: 手动构建响应数据结构以确保正确性。
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $perPage = $request->query('per_page', 10);
            $searchQuery = $request->query('search');

            $query = Referee::query()
                ->with([
                    'user:c_username,c_name',
                    'adConfig',
                    'adConfig.redTeam:c_id,c_name',
                    'adConfig.blueTeam:c_id,c_name',
                    'adConfig.sceneConfig:c_config_id,c_name'
                ])
                ->latest('c_create_at');

            // --- 搜索逻辑 ---
            if ($searchQuery) {
                $query->where(function ($q) use ($searchQuery) {
                    // 搜索关联的用户名
                    $q->whereHas('user', function ($userQuery) use ($searchQuery) {
                        $userQuery->where('c_username', 'LIKE', '%' . $searchQuery . '%')
                            ->orWhere('c_name', 'LIKE', '%' . $searchQuery . '%');
                    })
                        // 或者搜索关联的演练名称
                        ->orWhereHas('adConfig', function ($adConfigQuery) use ($searchQuery) {
                            $adConfigQuery->where('c_drill_name', 'LIKE', '%' . $searchQuery . '%');
                        });
                });
            }
            // --- 搜索逻辑结束 ---

            $referees = $query->paginate($perPage);

            // ★★★ 核心修改点 ★★★
            // 手动转换分页数据，确保数据结构绝对正确
            $referees->getCollection()->transform(function($referee) {

                $adConfigData = null;
                if ($referee->adConfig) {

                    // 动态注入实例ID
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

                    // 手动构建 ad_config 的数据结构
                    $adConfigData = [
                        'c_id' => $referee->adConfig->c_id,
                        'c_drill_name' => $referee->adConfig->c_drill_name,
                        'c_status' => $referee->adConfig->c_status,
                        'c_scene_config_id' => $referee->adConfig->c_scene_config_id,
                        'c_scene_instance_id' => $referee->adConfig->c_scene_instance_id,
                        // 显式地从加载的关系中获取数据
                        'redTeam' => $referee->adConfig->redTeam ? ['c_name' => $referee->adConfig->redTeam->c_name] : null,
                        'blueTeam' => $referee->adConfig->blueTeam ? ['c_name' => $referee->adConfig->blueTeam->c_name] : null,
                        'sceneConfig' => $referee->adConfig->sceneConfig ? ['c_name' => $referee->adConfig->sceneConfig->c_name] : null,
                    ];
                }

                // 返回一个全新的、干净的对象结构
                return [
                    'c_user_id' => $referee->c_user_id,
                    'c_ad_config_id' => $referee->c_ad_config_id,
                    'c_level' => $referee->c_level,
                    'c_create_at' => $referee->c_create_at->toDateTimeString(), // 转换为标准字符串格式
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
