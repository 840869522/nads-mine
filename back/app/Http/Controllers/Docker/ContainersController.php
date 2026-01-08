<?php

namespace App\Http\Controllers\Docker;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\DockerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Utils\JWTControll; // 引入 JWT 工具
use Illuminate\Support\Facades\Cache;

class ContainersController extends Controller
{
    private $docker;

    public function __construct(DockerService $docker, Request $req)
    {
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
        // ★★★ 可以在这里也加入简单的禁赛检查，防止通过API直接开关机 ★★★
        // 暂时只在 terminalWithAuthority 中加了强拦截，这里作为可选增强

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
        $raw  = (string) $res->getBody();
        $data = json_decode($raw, true);
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

    /**
     * 检查当前用户是否有权访问容器终端，并执行禁赛检查。
     */
    public function terminalWithAuthority(string $containerId, Request $request)
        {
            // 0. 基础数据查询
            try {
                $record = DB::table('c_scene_container_instances')
                    ->where('c_container_id', $containerId)
                    ->select('c_team_id', 'c_scene_instances_id')
                    ->first();
            } catch (\Throwable $e) {
                Log::error('Failed to fetch container record for authority check: ' . $e->getMessage());
                return response()->json(['error' => '数据库查询失败', 'message' => '数据库查询失败'], 500);
            }

            if (!$record) {
                return response()->json(['error' => '未找到容器实例', 'message' => '未找到容器实例'], 404);
            }

            $teamId = $record->c_team_id ?? null;
            $normalizedTeamId = $teamId !== null ? trim((string) $teamId) : '';

            // 1. 健壮的 Token 解析逻辑
            $tokenData = $request->token_data; // 1. 优先尝试属性
            if (empty($tokenData)) {
                $tokenData = $request->input('token_data'); // 2. 尝试Input
            }

            $username = $tokenData['id'] ?? null;

            // 3. 兜底 Header 解析
            if (!$username) {
                $authHeader = $request->header('Authorization');
                if ($authHeader) {
                    try {
                        $jwtResult = JWTControll::decodeJWT($authHeader);
                        if ($jwtResult['err'] === null) {
                            $tokenData = $jwtResult['data'];
                            $username = $tokenData['id'] ?? null;
                        }
                    } catch (\Exception $e) {}
                }
            }

            if (!$username) {
                return response()->json(['error' => '无法识别当前用户', 'message' => '用户信息缺失'], 401);
            }

            // 2. 获取权限列表 (Cache)
            $permissions = [];
            if (isset($tokenData['permission'])) {
                $permissions = Cache::get($tokenData["permission"]) ?? [];
            }
            $permissionIds = array_map(fn($item) => is_object($item) ? $item->c_id : (is_array($item) ? ($item['c_id'] ?? '') : $item), $permissions);

            // 3. 角色特权检查 (保留管理员通道)
            try {
                $roles = DB::table('c_users_roles')
                    ->where('c_user_id', $username)
                    ->pluck('c_role_id')
                    ->map(fn ($role) => strtolower((string) $role))
                    ->toArray();
            } catch (\Throwable $e) {
                return response()->json(['error' => '查询失败'], 500);
            }

            $privilegedRoles = ['admin', 'guidance', 'operations', 'referee'];
            // 如果是特权角色，或者拥有全局管理权限，则放行
            $isPrivileged = !empty(array_intersect($roles, $privilegedRoles)) || in_array('container_manage_global', $permissionIds);

            if ($isPrivileged) {
                 return response()->json(['allowed' => true]);
            }

            // ================= 安全补丁 =================
            // 4. RBAC 功能权限检查
            // 非特权用户，必须拥有 'container_terminal' 权限
            if (!in_array('container_terminal', $permissionIds)) {
                return response()->json([
                    'allowed' => false,
                    'error' => 'Permission Denied',
                    'message' => '您的角色权限不足，无法访问容器终端 (container_terminal)。',
                ], 403);
            }
            // ==========================================

            // 5. 队伍归属检查
            if ($normalizedTeamId !== '') {
                 try {
                    $isMember = DB::table('c_teams_users')
                        ->where('team_id', $normalizedTeamId)
                        ->where('user_id', $username)
                        ->exists();
                 } catch (\Throwable $e) {
                    return response()->json(['error' => '查询失败'], 500);
                 }

                 if (!$isMember) {
                    return response()->json([
                        'allowed' => false,
                        'error' => '无权限',
                        'message' => '用户不在该容器所属队伍中，无法操作',
                    ], 403);
                 }
            }

            // 6. 禁赛检查
            $sceneInstanceId = $record->c_scene_instances_id ?? null;
            if (!empty($sceneInstanceId)) {
                try {
                    $adConfigId = DB::table('c_ad_configs')
                        ->where('c_scene_instance_id', $sceneInstanceId)
                        ->value('c_id');

                    if ($adConfigId) {
                        $isBanned = DB::table('c_ad_user_bans')
                            ->where('c_ad_config_id', $adConfigId)
                            ->where('c_user_id', $username)
                            ->exists();

                        if ($isBanned) {
                            Log::info("拦截容器操作：用户 {$username} 已被禁赛", ['container_id' => $containerId]);
                            return response()->json([
                                'allowed' => false,
                                'error' => '用户已被禁赛',
                                'message' => '您已被禁赛，无法操作容器！',
                            ], 403);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::error('Ban check failed: ' . $e->getMessage());
                }
            }

            return response()->json(['allowed' => true]);
        }
}
