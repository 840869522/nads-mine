<?php

namespace App\Http\Controllers\Docker;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\DockerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ContainersController extends Controller
{
    private $docker;

    public function __construct(DockerService $docker, Request $req)
    {
        // 加载父类的构造方法
        parent::__construct($req);

        $this->docker = $docker;
    }

    private function mapStatus(?string $state): string
    {
        return match ($state) {
            'running' => 'running',
            'paused' => 'paused',
            'created', 'exited', 'dead' => 'stopped',
            'restarting' => 'starting',
            default => 'error',
        };
    }

    public function create(Request $request)
    {
        $userId = $request->token_data['id'] ?? null;
        $id = $this->docker->createContainer($request->all(), $userId);
        return response()->json(['id' => $id]);
    }

    public function action(Request $request, string $id)
    {
        $action = $request->query('action');
        switch ($action) {
            case 'start':
                $this->docker->startContainer($id); break;
            case 'stop':
                $this->docker->stopContainer($id); break;
            case 'pause':
                $this->docker->pauseContainer($id); break;
            case 'unpause':
                $this->docker->unpauseContainer($id); break;
            case 'delete':
                $this->docker->removeContainer($id); break;
        }
        return response()->json(['ok'=>true]);
    }

    public function get(Request $request, string $id)
    {
        $action = $request->query('action');
        return match ($action) {
            'logs' => response()->json(['logs' => $this->docker->containerLogs($id)]),
            'binds' => response()->json($this->docker->listBindMounts($id)),
            default => response()->json(['error' => 'unknown action'], 400),
        };
    }

    public function inspect(string $id)
    {
        logger()->info("Inspecting container: $id");
        $res = $this->docker->docker->ContainerInspect($id,[],'response');
        $raw  = (string) $res->getBody();                 // 纯 JSON 字符串
        $data = json_decode($raw, true);                  // 可选：转数组// 对象
        logger()->info('Container info', $data);
        return response()->json($data);
    }

    public function info(string $id)
    {
        try {
            $detail = $this->docker->containerInspect($id);
        } catch (\Exception $e) {
            return response()->json(['error' => 'container not found'], 404);
        }

        try {
            $stats = $this->docker->containerStats($detail->getId());
            $cpuDelta = ($stats->cpu_stats->cpu_usage->total_usage ?? 0) - ($stats->precpu_stats->cpu_usage->total_usage ?? 0);
            $sysDelta = ($stats->cpu_stats->system_cpu_usage ?? 0) - ($stats->precpu_stats->system_cpu_usage ?? 0);
            $cpus = $stats->cpu_stats->online_cpus ?? (is_array($stats->cpu_stats->cpu_usage->percpu_usage ?? null) ? count($stats->cpu_stats->cpu_usage->percpu_usage) : 1);
            $cpuPercent = $sysDelta > 0 ? ($cpuDelta / $sysDelta) * $cpus * 100 : 0;
            $memUsage = $stats->memory_stats->usage ?? 0;
            $memLimit = $stats->memory_stats->limit ?? 0;
        } catch (\Exception $e) {
            $cpuPercent = 0;
            $memUsage = 0;
            $memLimit = 0;
        }

        $ports = [];
        $bindings = $detail->getHostConfig()->getPortBindings();
        foreach ($bindings ?? [] as $portKey => $bindingList) {
            foreach ($bindingList ?? [] as $b) {
                $hostPort = $b->getHostPort();
                $private = strtok($portKey, '/');
                $ports[] = "{$hostPort}:{$private}";
            }
        }

        $infoExtra = null;
        try {
            $infoExtra = DB::table('c_scene_container_instances as ci')
                ->leftJoin('c_scene_instances as si', DB::raw('ci.c_scene_instances_id COLLATE utf8mb4_unicode_ci'), '=', 'si.c_scene_instances_id')
                ->leftJoin('c_scene_configs as sc', 'si.c_config_id', '=', 'sc.c_config_id')
                ->select('ci.c_container_id', 'ci.c_scene_instances_id', 'ci.c_ip', 'ci.c_flag', 'sc.c_name as scene_name')
                ->where('ci.c_container_id', $detail->getId())
                ->first();
        } catch (\Throwable $e) {
            $infoExtra = null;
        }

        return response()->json([
            'id' => $detail->getId(),
            'name' => ltrim($detail->getName() ?? substr($detail->getId(), 0, 12), '/'),
            'type' => 'container',
            'ipAddress' => $infoExtra->c_ip ?? ($detail->getNetworkSettings()->getIPAddress() ?? null),
            'scene_instance_id' => $infoExtra->c_scene_instances_id ?? null,
            'scene_name' => $infoExtra->scene_name ?? null,
            'is_target' => !empty($infoExtra->c_flag ?? null),
            'status' => $this->mapStatus($detail->getState()?->getStatus()),
            'ports' => implode(', ', $ports),
            'imageName' => $detail->getConfig()->getImage(),
            'cpuUsage' => sprintf('%.1f%%', $cpuPercent),
            'memoryUsage' => sprintf('%.1fMB/%.1fMB', $memUsage/1024/1024, $memLimit/1024/1024),
            'diskUsage' => '-',
            'uptime' => $detail->getState()?->getStatus() ?? '',
            'nodeId' => null,
            'createdAt' => date('c', $detail->getCreated() ? strtotime($detail->getCreated()) : time()),
        ]);
    }

    public function terminalWithAuthority(string $containerId, Request $request)
    {
        try {
            $record = DB::table('c_scene_container_instances')
                ->where('c_container_id', $containerId)
                ->select('c_team_id')
                ->first();
        } catch (\Throwable $e) {
            Log::error('Failed to fetch container record for authority check: ' . $e->getMessage());
            return response()->json([
                'error' => '数据库查询失败',
                'message' => '数据库查询失败',
            ], 500);
        }

        if (!$record) {
            return response()->json([
                'error' => '未找到容器实例',
                'message' => '未找到容器实例',
            ], 404);
        }

        $teamId = $record->c_team_id ?? null;
        $normalizedTeamId = $teamId !== null ? trim((string) $teamId) : '';

        if ($normalizedTeamId === '') {
            return response()->json([
                'allowed' => true,
            ]);
        }

        $tokenData = $request->input('token_data');
        $username = null;
        if (is_array($tokenData) && isset($tokenData['id'])) {
            $username = $tokenData['id'];
        } elseif ($request->has('username')) {
            $username = $request->input('username');
        } else {
            $userPayload = $request->input('user');
            if (is_array($userPayload) && isset($userPayload['c_username'])) {
                $username = $userPayload['c_username'];
            } elseif (is_object($userPayload) && isset($userPayload->c_username)) {
                $username = $userPayload->c_username;
            }
        }

        if (!$username) {
            return response()->json([
                'error' => '无法识别当前用户',
                'message' => '用户信息缺失',
            ], 401);
        }

        try {
            $roles = DB::table('c_users_roles')
                ->where('c_user_id', $username)
                ->pluck('c_role_id')
                ->map(fn ($role) => strtolower((string) $role));
        } catch (\Throwable $e) {
            Log::error('Failed to fetch user roles for container terminal authority check: ' . $e->getMessage());
            return response()->json([
                'error' => '数据库查询失败',
                'message' => '数据库查询失败',
            ], 500);
        }

        $privilegedRoles = ['admin', 'guidance', 'operations', 'referee'];
        foreach ($roles as $role) {
            if (in_array($role, $privilegedRoles, true)) {
                return response()->json([
                    'allowed' => true,
                    'message' => sprintf('用户角色 %s 拥有跨队伍访问权限', $role),
                ]);
            }
        }

        try {
            $isMember = DB::table('c_teams_users')
                ->where('team_id', $normalizedTeamId)
                ->where('user_id', $username)
                ->exists();
        } catch (\Throwable $e) {
            Log::error('Failed to verify team membership for container terminal authority: ' . $e->getMessage());
            return response()->json([
                'error' => '数据库查询失败',
                'message' => '数据库查询失败',
            ], 500);
        }

        if (!$isMember) {
            Log::warning('User lacks permission to access container terminal.', [
                'container_id' => $containerId,
                'team_id' => $normalizedTeamId,
                'username' => $username,
            ]);

            return response()->json([
                'allowed' => false,
                'error' => '无权限访问该容器',
                'message' => '用户不在该容器所属队伍中',
            ], 403);
        }

        return response()->json([
            'allowed' => true,
        ]);
    }

//    /**
//     * ★ 新增的方法 ★
//     * 检查当前认证的用户是否有权操作指定的容器。
//     *
//     * @param string $containerId 容器的 UUID
//     * @param Request $request
//     * @return \Illuminate\Http\JsonResponse
//     */
//    public function checkPermission(string $containerId, Request $request)
//    {
//        // 查找容器实例
//        $containerInstance = SceneContainerInstance::where('c_container_id', $containerId)->first();
//
//        if (!$containerInstance) {
//            return response()->json(['error' => '容器未找到'], 404);
//        }
//
//        // 从请求中获取用户信息 (JWT)
//        $auth = $request->header("Authorization", null);
//        $jwtRes = JWTControll::decodeJWT($auth);
//        $tokenData = $jwtRes["data"] ?? null;
//
//        // 调用模型方法来进行权限判断
//        $canOperate = $containerInstance->canBeOperatedByUser((object)["token_data" => $tokenData]);
//
//        // 返回一个简单的布尔值结果
//        return response()->json([
//            'can_operate' => $canOperate
//        ]);
//    }
}
