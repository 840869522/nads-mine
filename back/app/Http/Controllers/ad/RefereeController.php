<?php

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
    public function index(): JsonResponse
    {
        try {
            $referees = Referee::with(['user:c_username', 'adConfig'])
                ->latest('c_create_at')
                ->get();

            $sceneInstancesModel = new SceneInstances();

            $referees->each(function($referee) use ($sceneInstancesModel) {
                if ($referee->adConfig && $referee->adConfig->c_scene_config_id) {

                    $instance_id = $sceneInstancesModel->get_c_scene_instances_id(
                        $referee->adConfig->c_scene_config_id
                    );

                    if ($instance_id) {
                        $referee->adConfig->c_scene_instance_id = $instance_id;
                        $referee->adConfig->c_status = 'running';
                    }
                }
            });

            return response()->json([
                'status' => 'success',
                'data'   => $referees
            ]);

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
            // 【★★★ 核心修改 开始 ★★★】
            // 不再查询不存在的 c_real_name 字段，只查询 c_username
            if ($request->has('ad_config_id')) {
                $adConfigId = $request->query('ad_config_id');
                $assignedUsernames = Referee::where('c_ad_config_id', $adConfigId)->pluck('c_user_id');
                // 只 select 'c_username'
                $users = UserModel::whereNotIn('c_username', $assignedUsernames)->select('c_username')->get();
            } else {
                // 只 select 'c_username'
                $users = UserModel::select('c_username')->get();
            }
            // 【★★★ 核心修改 结束 ★★★】

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
