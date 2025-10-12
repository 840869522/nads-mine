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
// ★★★ MODIFICATION 1: Import the InstanceController ★★★
use App\Http\Controllers\scenario\InstanceController;

class AdController extends Controller
{
    private CommandLineService $cliService;

    public function __construct(Request $request, CommandLineService $cliService)
    {
        parent::__construct($request);
        $this->cliService = $cliService;
    }

    /**
     * 启动对抗演练场景。
     * 此方法确保所有退出路径都返回一个 JsonResponse。
     *
     * @param Request $request
     * @param SceneConfig $scenario
     * @return JsonResponse
     */
    public function startDrill(Request $request, SceneConfig $scenario): JsonResponse
    {
        // --- 验证输入 ---
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:50',
            'ad_config_id' => 'required|string|exists:c_ad_configs,c_id'
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => '请求格式不正确，必须包含有效的用户名和演练配置ID', 'errors' => $validator->errors()], 422);
        }
        $userName = $request->input('username');
        $adConfigId = $request->input('ad_config_id');

        // ★★★ START: MODIFICATION 2: Add pre-cleanup logic ★★★
        // 在创建任何新资源之前，先尝试清理与此演练关联的任何旧的、残留的场景实例
        $adConfig = AdConfig::find($adConfigId);
        if ($adConfig && $adConfig->c_scene_instance_id) {
            Log::info("演练 '{$adConfig->c_drill_name}' 存在旧的场景实例ID [{$adConfig->c_scene_instance_id}]，开始执行预清理...");
            try {
                $instanceToDelete = SceneInstance::find($adConfig->c_scene_instance_id);
                if ($instanceToDelete) {
                    // 复用 InstanceController 中的 destroy 方法，它可以彻底清理所有资源
                    $instanceController = app(InstanceController::class);
                    $instanceController->destroy($instanceToDelete);
                    Log::info("成功预清理旧的场景实例: " . $adConfig->c_scene_instance_id);
                }
            } catch (\Exception $e) {
                // 如果预清理失败，只记录一个警告，然后继续尝试启动。
                // 因为有些失败（比如记录存在但物理资源已删）是可接受的。
                Log::warning("预清理旧场景实例时发生错误 (将继续尝试启动): " . $e->getMessage());
            }
            // 清理后，重置 adConfig 中的 instance_id 和状态
            $adConfig->update(['c_scene_instance_id' => null, 'c_status' => 'pending']);
        }
        // ★★★ END: MODIFICATION 2 ★★★

        // --- 解析拓扑 ---
        $topologyJson = is_string($scenario->c_scene) ? json_decode($scenario->c_scene, true) : $scenario->c_scene;
        $parsedTopology = TopologyParser::parse($topologyJson);
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

        // =========================================================
        // 阶段一：创建并立即提交核心数据库记录
        // =========================================================
        DB::beginTransaction();
        try {
            $sceneInstance = SceneInstance::create([
                'c_config_id' => $scenario->c_config_id,
                'c_username' => $userName,
                'c_status' => 'CREATING',
            ]);

            // 重新查找 AdConfig 以确保状态最新
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

        // =========================================================
        // 阶段二：创建物理资源
        // =========================================================
        try {
            $createdSwitchesInfo = [];
            $createdItemsInfo = [];
            $instanceShortId = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -8);
            $switchIdSuffix = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -5);

            foreach ($parsedTopology['switches'] as $switchData) {
                $switchName = str_replace([' '], '_', $switchData['label']) . '_' . $switchIdSuffix;
                $this->cliService->createSwitch($switchName);
                $this->cliService->connectSwitchToSwitch($switchName, 'ovs-switch');
                $createdSwitchesInfo[$switchData['id']] = ['actual_name' => $switchName, 'label' => $switchData['label']];
                SceneSwitchInstance::create(['c_switch_name' => $switchName, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id]);
            }

            $containerIps = [];
            foreach ($connections as $conn) {
                if ($conn['source']['type'] === 'container' && !empty($conn['source']['ip'])) { $containerIps[$conn['source']['id']] = $conn['source']['ip']; }
                if ($conn['target']['type'] === 'container' && !empty($conn['target']['ip'])) { $containerIps[$conn['target']['id']] = $conn['target']['ip']; }
            }

            foreach ($parsedTopology['containers'] as $containerData) {
                $containerName = str_replace([' '], '_', $containerData['label']) . '_' . $instanceShortId;
                $nodeInfo = $nodesById->get($containerData['id']);
                $isTarget = $nodeInfo['config']['isTarget'] ?? false;
                $flag = $isTarget ? 'flag{' . Str::uuid()->toString() . '}' : null;
                $options = ['image' => $containerData['image'], 'name' => $containerName, 'ports' => $containerData['portMappings'], 'env' => $containerData['env'], 'scene_instance_id' => $sceneInstance->c_scene_instances_id];
                if ($flag) { $options['env'][] = ['key' => 'FLAG', 'value' => $flag]; }
                $containerId = $this->cliService->createContainer($options);
                $containerIp = $containerIps[$containerData['id']] ?? null;
                SceneContainerInstance::create(['c_container_id' => $containerId, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id, 'c_flag' => $flag, 'c_ip' => $containerIp, 'c_container_name' => $containerData['label']]);
                $createdItemsInfo[$containerData['id']] = ['id' => $containerId, 'actual_name' => $containerName, 'type' => 'container'];
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
                $nodeInfo = $nodesById->get($itemNode['id']);
                $isTarget = $nodeInfo['config']['isTarget'] ?? false;
                $flag = $isTarget ? 'flag{' . Str::uuid()->toString() . '}' : null;
                $parsedVmNode = $vmsParsed[$itemNode['id']];
                $correctImageName = $parsedVmNode['image'];
                if (empty($correctImageName) || $correctImageName === 'vm-qemu:latest') { $correctImageName = 'v_att_tcpScanning'; }
                $vmName = str_replace([' '], '_', $itemNode['label']) . '_' . $instanceShortId;
                $vmInstance = SceneVmInstance::create(['c_vm_name' => $vmName, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id, 'c_ip' => $ip, 'c_flag' => $flag]);
                $vmDbId = $vmInstance->c_vm_id;
                $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];
                $this->cliService->createVm(['id' => $vmDbId, 'vm_name' => $vmName, 'image' => $correctImageName, 'ip' => $ip, 'scene_instance_id' => $sceneInstance->c_scene_instances_id, 'flag' => $flag ?? 'NULL', 'switch_name' => $actualSwitchName, 'image_dir' => $imageDir, 'instance_base_dir' => $instanceBaseDir]);
                $createdItemsInfo[$itemNode['id']] = ['id' => $vmDbId, 'actual_name' => $vmName, 'type' => 'virtual_machine'];
            }

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
            return response()->json(['message' => '创建场景物理资源时发生错误：' . $e->getMessage()], 500);
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
}
