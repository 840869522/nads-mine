<?php

namespace App\Http\Controllers\ad;

use App\Http\Controllers\Controller;
use App\Models\ad\AdConfig;
use App\Models\scenario\SceneConfig;
use App\Models\scenario\SceneInstance;
use App\Models\scenario\SceneContainerInstance;
use App\Models\scenario\SceneSwitchInstance;
use App\Models\scenario\SceneVmInstance;
use App\RunTool\CommandLineService;
use App\RunTool\TopologyParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\scenario\InstanceController;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class AdController extends Controller
{
    private CommandLineService $cliService;
    private array $vmImageOsMap = [];

    public function __construct(Request $request, CommandLineService $cliService)
    {
        parent::__construct($request);
        $this->cliService = $cliService;
        $this->loadVmImageOsMap();
    }

    /**
     * 加载 vmImageOverrides.json 文件内容到类属性
     */
    private function loadVmImageOsMap(): void
    {
        try {
            $path = base_path('../src/data/vmImageOverrides.json');
            if (File::exists($path)) {
                $jsonContent = File::get($path);
                $this->vmImageOsMap = json_decode($jsonContent, true) ?: [];
            } else {
                Log::warning('vmImageOverrides.json 文件 (AdController) 不存在。', ['path' => $path]);
            }
        } catch (\Exception $e) {
            Log::error('加载 vmImageOverrides.json (AdController) 失败: ' . $e->getMessage());
            $this->vmImageOsMap = [];
        }
    }

    /**
     * 将 TopologyParser 返回的环境变量数组转换为键值映射。
     */
    private function buildEnvLookup(array $envPairs): array
    {
        $lookup = [];
        foreach ($envPairs as $pair) {
            $key = trim($pair['key'] ?? '');
            if ($key === '') {
                continue;
            }
            $lookup[$key] = isset($pair['value']) ? (string) $pair['value'] : '';
        }
        return $lookup;
    }

    /**
     * 统一解析并补全 Elasticsearch 相关的环境变量。
     */
    private function resolveElasticsearchEnv(array $envLookup): array
    {
        $host = trim($envLookup['ELASTICSEARCH_HOST'] ?? '') ?: '10.100.88.88';
        $port = trim($envLookup['ELASTICSEARCH_PORT'] ?? '') ?: '9200';
        return [
            'ELASTICSEARCH_HOST' => $host,
            'ELASTICSEARCH_PORT' => $port,
        ];
    }

    /**
     * 启动对抗演练场景。
     */
    public function startDrill(Request $request, SceneConfig $scenario): JsonResponse
    {
        // --- 系统资源检查 ---
        $resourceCheckResponse = $this->checkSystemResources();
        if ($resourceCheckResponse !== null) {
            return $resourceCheckResponse;
        }

        // --- 验证输入 ---
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:50',
            'ad_config_id' => 'required|string|exists:c_ad_configs,c_id',
            'topology' => 'required|array',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => '请求格式不正确，必须包含有效的用户名、演练配置ID和拓扑数据', 'errors' => $validator->errors()], 422);
        }
        $userName = $request->input('username');
        $adConfigId = $request->input('ad_config_id');
        $topologyJson = $request->input('topology');

        // --- 预清理逻辑 ---
        $adConfig = AdConfig::find($adConfigId);
        if ($adConfig && $adConfig->c_scene_instance_id) {
            Log::info("演练 '{$adConfig->c_drill_name}' 存在旧的场景实例ID [{$adConfig->c_scene_instance_id}]，开始执行预清理...");
            try {
                $instanceToDelete = SceneInstance::find($adConfig->c_scene_instance_id);
                if ($instanceToDelete) {
                    $instanceController = app(InstanceController::class);
                    $instanceController->destroy($instanceToDelete);
                    Log::info("成功预清理旧的场景实例: " . $adConfig->c_scene_instance_id);
                }
            } catch (\Exception $e) {
                Log::warning("预清理旧场景实例时发生错误 (将继续尝试启动): " . $e->getMessage());
            }
            $adConfig->update(['c_scene_instance_id' => null, 'c_status' => 'pending']);
        }

        // --- 解析拓扑 ---
        $parsedTopology = TopologyParser::parse($topologyJson);

        // --- 队伍成员冲突校验 ---
        $teamValidation = $this->validateTeamAssignments(
            $parsedTopology['containers'] ?? [],
            $parsedTopology['vms'] ?? []
        );
        if ($teamValidation['has_conflict']) {
            return response()->json([
                'message' => '启动失败：存在队伍成员冲突。',
                'conflicts' => $teamValidation['conflicts'],
            ], 422);
        }

        $nodesById = collect($topologyJson['nodes'])->keyBy('id');
        $connections = &$parsedTopology['connections'];
        $vmsParsed = collect($parsedTopology['vms'])->keyBy('id');
        $containersParsed = collect($parsedTopology['containers'])->keyBy('id');

        // --- IP地址分配 ---
        try {
            $this->assignIpAddresses($connections);
        } catch (\Exception $e) {
            Log::error("IP地址自动分配失败: " . $e->getMessage());
            return response()->json(['message' => 'IP地址分配失败：' . $e->getMessage()], 500);
        }

        $sceneInstance = null;

        // --- 阶段一：创建核心数据库记录 ---
        DB::beginTransaction();
        try {
            $sceneInstance = SceneInstance::create([
                'c_config_id' => $scenario->c_config_id,
                'c_username' => $userName,
                'c_status' => 'CREATING',
                'c_scene_config' => $topologyJson, // 使用从请求中传递过来的拓扑数据
                'c_hostname' => SceneInstance::resolveHostname(),
            ]);

            $adConfig = AdConfig::find($adConfigId);
            if ($adConfig) {
                $adConfig->update([
                    'c_scene_instance_id' => $sceneInstance->c_scene_instances_id,
                    'c_status' => 'creating',
                ]);
            } else {
                throw new \Exception("启动场景时未找到有效的演练配置记录: " . $adConfigId);
            }

            DB::commit();
            Log::info("核心数据库记录已创建并提交", ['instance_id' => $sceneInstance->c_scene_instances_id, 'ad_config_id' => $adConfigId]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("创建核心数据库记录时失败: " . $e->getMessage());
            return response()->json(['message' => '无法创建场景实例记录，启动失败。'], 500);
        }

        // --- 阶段二：创建物理资源 ---
        try {
            $createdSwitchesInfo = [];
            $createdItemsInfo = [];
            $instanceShortId = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -8);
            $switchIdSuffix = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -5);

            foreach ($parsedTopology['switches'] as $switchData) {
                $switchName = str_replace([' '], '_', $switchData['label']) . '_' . $switchIdSuffix;
                $this->cliService->createSwitch($switchName, null, true);
                $this->cliService->connectSwitchToSwitch($switchName, 'ovs-switch');
                $createdSwitchesInfo[$switchData['id']] = ['actual_name' => $switchName, 'label' => $switchData['label']];
                SceneSwitchInstance::create(['c_switch_name' => $switchName, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id]);
            }

            $containerIps = [];
            foreach ($connections as $conn) {
                if ($conn['source']['type'] === 'container' && !empty($conn['source']['ip'])) { $containerIps[$conn['source']['id']] = $conn['source']['ip']; }
                if ($conn['target']['type'] === 'container' && !empty($conn['target']['ip'])) { $containerIps[$conn['target']['id']] = $conn['target']['ip']; }
            }

            // --- 容器与虚拟机创建（与 DrillController 保持一致的完整逻辑） ---
            $suricataToCreate = [];
            foreach ($parsedTopology['containers'] as $containerData) {
                 $containerName = str_replace([' '], '_', $containerData['label']) . '_' . $instanceShortId;
                 if ($this->cliService->isSuricataV2Image($containerData['image'])) {
                     $suricataToCreate[] = ['data' => $containerData, 'name' => $containerName];
                     continue;
                 }
                 $options = [ 'image' => $containerData['image'], 'name'  => $containerName, 'ports' => $containerData['portMappings'], 'env'   => $containerData['env'], 'scene_instance_id' => $sceneInstance->c_scene_instances_id ];
                 $teamId = $containerData['teamId'] ?? null;
                 if ($teamId !== null) { $teamId = trim((string) $teamId) ?: null; }
                 $flagUuid = null;
                 if ($containerData['isTarget']) {
                     $flagUuid = Str::uuid()->toString();
                     $options['env'][] = ['key' => 'FLAG', 'value' => $flagUuid];
                 }
                 $containerId = $this->cliService->createContainer($options);
                 $containerIp = $containerIps[$containerData['id']] ?? null;
                 SceneContainerInstance::create([ 'c_container_id' => $containerId, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id, 'c_flag' => $flagUuid, 'c_ip' => $containerIp, 'c_container_name' => $containerName, 'c_team_id' => $teamId ]);
                 $createdItemsInfo[$containerData['id']] = [ 'id' => $containerId, 'actual_name' => $containerName, 'type' => 'container' ];
            }

            Log::info("================== 开始创建虚拟机并建立连接 ==================");
            $baseDir = $this->_get_global_directory();
            $imageDir = $baseDir . '/virsh/images';
            $instanceBaseDir = $baseDir . '/virsh/instances/' . $sceneInstance->c_scene_instances_id;
            foreach ($connections as $conn) {
                $itemNode = null; $switchNode = null; $ip = null;
                if ($conn['source']['type'] === 'virtual_machine' && $conn['target']['type'] === 'switch') { $itemNode = $nodesById[$conn['source']['id']]; $switchNode = $nodesById[$conn['target']['id']]; $ip = $conn['source']['ip']; }
                elseif ($conn['target']['type'] === 'virtual_machine' && $conn['source']['type'] === 'switch') { $itemNode = $nodesById[$conn['target']['id']]; $switchNode = $nodesById[$conn['source']['id']]; $ip = $conn['target']['ip']; }
                if (!$itemNode || !$switchNode) continue;
                $parsedVmNode = $vmsParsed[$itemNode['id']];
                $vmEnvPairs = $parsedVmNode['env'] ?? [];
                $vmEnvLookup = $this->buildEnvLookup($vmEnvPairs);
                $elasticsearchEnv = $this->resolveElasticsearchEnv($vmEnvLookup);
                $vmEnvLookup = array_merge($vmEnvLookup, $elasticsearchEnv);
                $teamId = $parsedVmNode['teamId'] ?? null;
                if ($teamId !== null) { $teamId = trim((string) $teamId) ?: null; }
                $correctImageName = $parsedVmNode['image'];
                if (empty($correctImageName) || $correctImageName === 'vm-qemu:latest') { $correctImageName = 'v_att_tcpScanning'; }
                $imageFileName = Str::endsWith($correctImageName, '.qcow2') ? $correctImageName : $correctImageName . '.qcow2';
                $osData = $this->vmImageOsMap[$imageFileName] ?? null;
                $osType = strtolower($osData['osType'] ?? 'ubuntu');
                $vmName = str_replace([' '], '_', $itemNode['label']) . '_' . $instanceShortId;
                $flagUuid = null;
                if ($parsedVmNode['isTarget'] ?? false) { $flagUuid = Str::uuid()->toString(); }
                $vmInstance = SceneVmInstance::create([ 'c_vm_name' => $vmName, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id, 'c_ip' => $ip, 'c_flag' => $flagUuid, 'c_team_id' => $teamId ]);
                $vmDbId = $vmInstance->c_vm_id;
                $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];
                $vmOptionsBase = [ 'id' => $vmDbId, 'vm_name' => $vmName, 'image' => $correctImageName, 'ip' => $ip, 'scene_instance_id' => $sceneInstance->c_scene_instances_id, 'flag' => $flagUuid ?? 'NULL', 'switch_name' => $actualSwitchName, 'image_dir' => $imageDir, 'instance_base_dir' => $instanceBaseDir, 'memory' => $parsedVmNode['memory'] ?? null, 'cpu' => $parsedVmNode['cpu'] ?? null, 'env' => $vmEnvPairs, 'env_lookup' => $vmEnvLookup, 'elasticsearch_env' => $elasticsearchEnv ];
                if ($osType === 'win7') { $this->cliService->createVmWin7($vmOptionsBase); }
                elseif ($osType === 'win7_1') { $this->cliService->createVmWin7_1($vmOptionsBase); }
                elseif ($osType === 'win2003') { $this->cliService->createVmWin2003($vmOptionsBase); }
                elseif ($osType === 'win10') { $this->cliService->createVmWin10($vmOptionsBase); }
                elseif ($osType === 'kylin' || $osType === 'kylin10' || $osType === 'kylin_v10') { $this->cliService->createVmKylin($vmOptionsBase); }
                elseif ($osType === 'kali') { $this->cliService->createVmKali($vmOptionsBase); }
                else { $this->cliService->createVm($vmOptionsBase); }
                $createdItemsInfo[$itemNode['id']] = [ 'id' => $vmDbId, 'actual_name' => $vmName, 'type' => 'virtual_machine' ];
            }

            foreach ($suricataToCreate as $item) {
                $containerData = $item['data']; $containerName = $item['name'];
                $options = [ 'image' => $containerData['image'], 'name'  => $containerName, 'ports' => $containerData['portMappings'], 'env'   => $containerData['env'], 'scene_instance_id' => $sceneInstance->c_scene_instances_id ];
                $teamId = $containerData['teamId'] ?? null;
                if ($teamId !== null) { $teamId = trim((string) $teamId) ?: null; }
                $monitorInterfaces = [];
                foreach ($connections as $conn) {
                    if (($conn['source']['type'] === 'container' && $conn['source']['id'] === $containerData['id'] && $conn['target']['type'] === 'switch') || ($conn['target']['type'] === 'container' && $conn['target']['id'] === $containerData['id'] && $conn['source']['type'] === 'switch')) {
                        $switchNode = $conn['source']['type'] === 'switch' ? $conn['source'] : $conn['target'];
                        $switchInfo = $createdSwitchesInfo[$switchNode['id']] ?? null;
                        if ($switchInfo) { $monitorInterfaces[] = $this->cliService->generateOvsPortName($switchInfo['actual_name'], $containerName); }
                    }
                }
                $monitorInterfaces = array_values(array_unique(array_filter($monitorInterfaces)));
                if (!empty($monitorInterfaces)) { $options['monitorInterfaces'] = $monitorInterfaces; }
                $flagUuid = null;
                if ($containerData['isTarget']) {
                    $flagUuid = Str::uuid()->toString();
                    $options['env'][] = ['key' => 'FLAG', 'value' => $flagUuid];
                }
                $containerId = $this->cliService->createContainer($options);
                $containerIp = $containerIps[$containerData['id']] ?? null;
                SceneContainerInstance::create([ 'c_container_id' => $containerId, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id, 'c_flag' => $flagUuid, 'c_ip' => $containerIp, 'c_container_name' => $containerName, 'c_team_id' => $teamId ]);
                $createdItemsInfo[$containerData['id']] = [ 'id' => $containerId, 'actual_name' => $containerName, 'type' => 'container' ];
            }

            // --- 网络连接、iptables、路由配置 ---
            Log::info("================== 开始建立剩余网络连接 ==================");
            foreach ($connections as $conn) {
                $source = $conn['source']; $target = $conn['target'];
                if ($source['type'] === 'switch' && $target['type'] === 'switch') { $this->cliService->connectSwitchToSwitch($createdSwitchesInfo[$source['id']]['actual_name'], $createdSwitchesInfo[$target['id']]['actual_name']); }
                elseif (($source['type'] === 'container' && $target['type'] === 'switch') || ($source['type'] === 'switch' && $target['type'] === 'container')) {
                    $containerNode = $source['type'] === 'container' ? $source : $target;
                    $switchNode = $source['type'] === 'switch' ? $source : $target;
                    $this->cliService->connectContainerToSwitch($createdSwitchesInfo[$switchNode['id']]['actual_name'], $createdItemsInfo[$containerNode['id']]['actual_name'], $containerNode['ip']);
                    try {
                        $containerParsed = $containersParsed[$containerNode['id']] ?? null;
                        if ($containerParsed && $this->cliService->isSuricataV2Image($containerParsed['image'] ?? '')) {
                            $switchActualName = $createdSwitchesInfo[$switchNode['id']]['actual_name'] ?? null;
                            $containerActualName = $createdItemsInfo[$containerNode['id']]['actual_name'] ?? null;
                            if ($switchActualName && $containerActualName) {
                                $monitorPort = $this->cliService->resolveOvsPortNameForContainerOnBridge($switchActualName, $containerActualName) ?: $this->cliService->generateOvsPortName($switchActualName, $containerActualName);
                                $mirrorName = 'mirror-' . $containerActualName . '-' . $switchActualName;
                                $this->cliService->createOrReplaceMirrorAllToPort($switchActualName, $monitorPort, $mirrorName);
                                Log::info("已在 {$switchActualName} 上创建镜像 {$mirrorName} -> {$monitorPort}");
                            }
                        }
                    } catch (\Exception $ex) { Log::warning("创建 OVS Mirror 失败: " . $ex->getMessage()); }
                }
                elseif (($source['type'] === 'switch' && $target['type'] === 'nat_bridge') || ($source['type'] === 'nat_bridge' && $target['type'] === 'switch')) {
                    $switchNode = $source['type'] === 'switch' ? $source : $target;
                    $bridgeNode = $source['type'] === 'nat_bridge' ? $source : $target;
                    $this->cliService->connectSwitchToBr0($createdSwitchesInfo[$switchNode['id']]['actual_name'], $bridgeNode['label']);
                }
            }
            if (!empty($parsedTopology['iptablesRules'])) {
                Log::info("================== Applying iptables rules ==================");
                $this->cliService->applyIptablesRules($parsedTopology['iptablesRules'], $createdItemsInfo, $connections);
            }
            $gatewayIp = '10.100.0.254/16';
            $containersToRoute = [];
            $switchesConnectedToBridge = [];
            foreach ($connections as $conn) {
                if ($conn['source']['type'] === 'nat_bridge' && $conn['target']['type'] === 'switch') { $switchesConnectedToBridge[$conn['target']['id']] = true; }
                elseif ($conn['target']['type'] === 'nat_bridge' && $conn['source']['type'] === 'switch') { $switchesConnectedToBridge[$conn['source']['id']] = true; }
            }
            if (!empty($switchesConnectedToBridge)) {
                foreach ($connections as $conn) {
                    $containerNode = null; $switchNode = null;
                    if ($conn['source']['type'] === 'container' && $conn['target']['type'] === 'switch') { $containerNode = $conn['source']; $switchNode = $conn['target']; }
                    elseif ($conn['target']['type'] === 'container' && $conn['source']['type'] === 'switch') { $containerNode = $conn['target']; $switchNode = $conn['source']; }
                    if ($containerNode && isset($switchesConnectedToBridge[$switchNode['id']])) {
                        $actualContainerName = $createdItemsInfo[$containerNode['id']]['actual_name'];
                        $containersToRoute[] = ['name' => $actualContainerName];
                    }
                }
            }
            if (!empty($containersToRoute)) {
                $this->cliService->configureBridgeAndRoutes('br0', $gatewayIp, $containersToRoute);
                Log::info("================== 网关和路由配置完成 ==================");
            }

            // --- 最终状态更新 ---
            $sceneInstance->c_status = 'RUNNING';
            $sceneInstance->save();
            $adConfig = AdConfig::find($adConfigId);
            if ($adConfig) {
                $adConfig->c_status = 'running';
                $adConfig->save();
            }
            Log::info("所有物理资源创建成功，场景状态更新为 RUNNING。");
            return response()->json([
                'message' => '演练场景已成功启动！', 'scene_instance_id' => $sceneInstance->c_scene_instances_id,
                'created_items' => $createdItemsInfo, 'created_switches' => $createdSwitchesInfo,
            ]);

        } catch (\Exception $e) {
            Log::error("创建物理资源时发生严重错误: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            if ($sceneInstance) {
                $sceneInstance->c_status = 'FAILED';
                $sceneInstance->save();
            }
            $adConfigOnFail = AdConfig::find($adConfigId);
            if ($adConfigOnFail) {
                $adConfigOnFail->c_status = 'failed';
                $adConfigOnFail->save();
            }
            return response()->json(['message' => '场景启动失败'], 500);
        }
    }

    private function assignIpAddresses(array &$connections): void
    {
        $vmIps = DB::table('c_scene_vm_instances')->whereNotNull('c_ip')->pluck('c_ip');
        $containerIps = DB::table('c_scene_container_instances')->whereNotNull('c_ip')->pluck('c_ip');
        $existingIps = $vmIps->merge($containerIps)->map(function ($ip) { return explode('/', $ip)[0]; })->unique()->flip();
        Log::info('Found existing IPs in DB', $existingIps->keys()->toArray());
        $octet3 = 0; $octet4 = 0;
        $getNextIp = function() use (&$octet3, &$octet4, &$existingIps) {
            do {
                if ($octet4 >= 254) { $octet4 = 1; $octet3++; } else { $octet4++; }
                if ($octet3 >= 255) { throw new \Exception("IP地址池 10.100.0.0/16 已耗尽。"); }
                $newIp = "10.100.{$octet3}.{$octet4}";
            } while (isset($existingIps[$newIp]));
            $existingIps[$newIp] = true;
            Log::info("Assigned new IP: {$newIp}");
            return $newIp . "/16";
        };
        foreach ($connections as &$connection) {
            if ($connection['source']['type'] === 'nat_bridge' || $connection['target']['type'] === 'nat_bridge') { continue; }
            if (empty($connection['source']['ip'])) { $connection['source']['ip'] = $getNextIp(); }
            if (empty($connection['target']['ip'])) { $connection['target']['ip'] = $getNextIp(); }
        }
    }

    /**
     * 检查系统CPU和内存资源是否在可接受的范围内。
     *
     * @return \Illuminate\Http\JsonResponse|null 如果资源超限则返回JSON响应，否则返回null。
     */
    private function checkSystemResources()
    {
        try {
            // 检查内存使用率
            $memCommand = "free | grep Mem | awk '{print $3/$2 * 100.0}'";
            $processMem = Process::fromShellCommandline($memCommand);
            $processMem->run();
            if (!$processMem->isSuccessful()) {
                throw new ProcessFailedException($processMem);
            }
            $memoryUsage = round((float) $processMem->getOutput(), 2);

            if ($memoryUsage > 85) {
                Log::warning("启动场景失败：内存使用率过高 ({$memoryUsage}%)");
                return response()->json(['message' => "启动失败：系统内存使用率 ({$memoryUsage}%) 超过 85% 的阈值。请联系管理员清理"], 503); // 503 Service Unavailable
            }

            // 检查CPU使用率
            $cpuCommand = "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'";
            $processCpu = Process::fromShellCommandline($cpuCommand);
            $processCpu->run();
            if (!$processCpu->isSuccessful()) {
                throw new ProcessFailedException($processCpu);
            }
            $cpuUsage = round((float) $processCpu->getOutput(), 2);

            if ($cpuUsage > 85) {
                Log::warning("启动场景失败：CPU使用率过高 ({$cpuUsage}%)");
                return response()->json(['message' => "启动失败：系统CPU使用率 ({$cpuUsage}%) 超过 85% 的阈值。请联系管理员清理"], 503);
            }

            Log::info("系统资源检查通过", ['cpu_usage' => $cpuUsage, 'memory_usage' => $memoryUsage]);
            return null; //一切正常

        } catch (\Exception $e) {
            Log::error("检查系统资源时发生错误: " . $e->getMessage());
            // 如果检查过程出错，为安全起见，阻止场景启动
            return response()->json(['message' => '检查系统资源时发生错误，无法启动场景。'], 500);
        }
    }

    /**
     * 验证拓扑中的队伍成员是否存在冲突。
     *
     * @param array $containers Parsed container definitions including teamId.
     * @param array $vms Parsed VM definitions including teamId.
     * @return array{has_conflict: bool, conflicts?: array}
     */
    private function validateTeamAssignments(array $containers, array $vms): array
    {
        $teamIds = collect($containers)
            ->merge($vms)
            ->pluck('teamId')
            ->filter(function ($teamId) {
                return $teamId !== null && trim((string) $teamId) !== '';
            })
            ->map(fn($id) => trim((string) $id))
            ->unique()
            ->values();

        if ($teamIds->isEmpty()) {
            return ['has_conflict' => false];
        }

        $members = DB::table('c_teams_users')
            ->whereIn('team_id', $teamIds)
            ->get(['team_id', 'user_id']);

        $userTeams = [];
        foreach ($members as $member) {
            $teamId = trim((string) $member->team_id);
            $userId = trim((string) $member->user_id);
            if ($teamId === '' || $userId === '') {
                continue;
            }
            $userTeams[$userId][$teamId] = true;
        }

        $conflicts = [];
        foreach ($userTeams as $userId => $teams) {
            if (count($teams) > 1) {
                $conflicts[$userId] = array_keys($teams);
            }
        }

        if (empty($conflicts)) {
            return ['has_conflict' => false];
        }

        $flatTeamIds = collect($conflicts)->flatten()->unique()->values();
        $teamNames = DB::table('c_teams')
            ->whereIn('c_id', $flatTeamIds)
            ->pluck('c_name', 'c_id');

        $conflictDetails = [];
        foreach ($conflicts as $userId => $teamList) {
            $conflictDetails[] = [
                'user' => $userId,
                'teams' => array_map(function ($teamId) use ($teamNames) {
                    return [
                        'id' => $teamId,
                        'name' => $teamNames[$teamId] ?? null,
                    ];
                }, $teamList),
            ];
        }

        return [
            'has_conflict' => true,
            'conflicts' => $conflictDetails,
        ];
    }
}
