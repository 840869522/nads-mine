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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class AdController extends Controller
{
    private CommandLineService $cliService;

    public function __construct(Request $request, CommandLineService $cliService)
    {
        parent::__construct($request);
        $this->cliService = $cliService;
    }

    public function startDrill(Request $request, SceneConfig $scenario)
    {
        $validator = Validator::make($request->all(), ['username' => 'required|string|max:50', 'ad_config_id' => 'required|string|exists:c_ad_configs,c_id']);
        if ($validator->fails()) {
            return response()->json(['message' => '请求格式不正确，必须包含有效的用户名和演练配置ID', 'errors' => $validator->errors()], 422);
        }
        $userName = $request->input('username');
        $adConfigId = $request->input('ad_config_id');
        $topologyJson = is_string($scenario->c_scene) ? json_decode($scenario->c_scene, true) : $scenario->c_scene;

        $parsedTopology = TopologyParser::parse($topologyJson);
        $nodesById = collect($topologyJson['nodes'])->keyBy('id');
        $connections = &$parsedTopology['connections'];
        $vmsParsed = collect($parsedTopology['vms'])->keyBy('id');
        $containersParsed = collect($parsedTopology['containers'])->keyBy('id');
        $createdSwitchesInfo = [];
        $createdItemsInfo = [];
        $sceneInstance = null;

        try {
            $this->assignIpAddresses($connections);
        } catch (\Exception $e) {
            Log::error("IP地址自动分配失败: " . $e->getMessage());
            return response()->json(['message' => 'IP地址分配失败：' . $e->getMessage()], 500);
        }

        $containerIps = [];
        foreach ($connections as $conn) {
            if ($conn['source']['type'] === 'container' && !empty($conn['source']['ip'])) {
                $containerIps[$conn['source']['id']] = $conn['source']['ip'];
            }
            if ($conn['target']['type'] === 'container' && !empty($conn['target']['ip'])) {
                $containerIps[$conn['target']['id']] = $conn['target']['ip'];
            }
        }

        DB::beginTransaction();
        try {
            $sceneInstance = SceneInstance::create([
                'c_config_id' => $scenario->c_config_id, 'c_username' => $userName, 'c_status' => 'CREATING',
            ]);
            Log::info("创建场景实例记录成功", ['instance_id' => $sceneInstance->c_scene_instances_id]);

            $adConfig = AdConfig::find($adConfigId);
            if ($adConfig) {
                $adConfig->update([
                    'c_scene_instance_id' => $sceneInstance->c_scene_instances_id,
                    'c_status' => 'running',
                ]);
            } else {
                throw new \Exception("启动场景时未找到有效的演练配置记录: " . $adConfigId);
            }

            $instanceShortId = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -8);
            $switchIdSuffix = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -5);

            foreach ($parsedTopology['switches'] as $switchData) {
                $switchName = str_replace([' '], '_', $switchData['label']) . '_' . $switchIdSuffix;
                $this->cliService->createSwitch($switchName);
                $this->cliService->connectSwitchToSwitch($switchName, 'ovs-switch');
                $createdSwitchesInfo[$switchData['id']] = ['actual_name' => $switchName, 'label' => $switchData['label']];
                SceneSwitchInstance::create([
                    'c_switch_name' => $switchName, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                ]);
            }

            foreach ($parsedTopology['containers'] as $containerData) {
                $containerName = str_replace([' '], '_', $containerData['label']) . '_' . $instanceShortId;
                $nodeInfo = $nodesById->get($containerData['id']);
                $isTarget = $nodeInfo['config']['isTarget'] ?? false;
                $flag = $isTarget ? 'flag{' . Str::uuid()->toString() . '}' : null;
                $options = [
                    'image' => $containerData['image'], 'name'  => $containerName,
                    'ports' => $containerData['portMappings'], 'env'   => $containerData['env'],
                    'scene_instance_id' => $sceneInstance->c_scene_instances_id,
                ];
                if ($flag) { $options['env'][] = ['key' => 'FLAG', 'value' => $flag]; }
                $containerId = $this->cliService->createContainer($options);
                $containerIp = $containerIps[$containerData['id']] ?? null;
                SceneContainerInstance::create([
                    'c_container_id' => $containerId,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                    'c_flag' => $flag,
                    'c_ip' => $containerIp,
                    'c_container_name' => $containerData['label'],
                ]);
                $createdItemsInfo[$containerData['id']] = [
                    'id' => $containerId, 'actual_name' => $containerName, 'type' => 'container'
                ];
            }

            Log::info("================== 开始创建虚拟机并建立连接 ==================");
            $baseDir = $this->_get_global_directory();
            $imageDir = $baseDir . '/virsh/images';
            $instanceBaseDir = $baseDir . '/virsh/instances/' . $sceneInstance->c_scene_instances_id;

            foreach ($connections as $conn) {
                $itemNode = null; $switchNode = null; $ip = null;
                if ($conn['source']['type'] === 'virtual_machine' && $conn['target']['type'] === 'switch') {
                    $itemNode = $nodesById[$conn['source']['id']];
                    $switchNode = $nodesById[$conn['target']['id']];
                    $ip = $conn['source']['ip'];
                } elseif ($conn['target']['type'] === 'virtual_machine' && $conn['source']['type'] === 'switch') {
                    $itemNode = $nodesById[$conn['target']['id']];
                    $switchNode = $nodesById[$conn['source']['id']];
                    $ip = $conn['target']['ip'];
                }
                if (!$itemNode || !$switchNode) continue;
                $nodeInfo = $nodesById->get($itemNode['id']);
                $isTarget = $nodeInfo['config']['isTarget'] ?? false;
                $flag = $isTarget ? 'flag{' . Str::uuid()->toString() . '}' : null;
                $parsedVmNode = $vmsParsed[$itemNode['id']];
                $correctImageName = $parsedVmNode['image'];
                if (empty($correctImageName) || $correctImageName === 'vm-qemu:latest') {
                    $correctImageName = 'v_att_tcpScanning';
                }
                $vmName = str_replace([' '], '_', $itemNode['label']) . '_' . $instanceShortId;
                $vmInstance = SceneVmInstance::create([
                    'c_vm_name'            => $vmName,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                    'c_ip'                 => $ip,
                    'c_flag'               => $flag,
                ]);
                $vmDbId = $vmInstance->c_vm_id;
                $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];
                $this->cliService->createVm([
                    'id'                  => $vmDbId, 'vm_name'             => $vmName,
                    'image'               => $correctImageName, 'ip'                  => $ip,
                    'scene_instance_id'   => $sceneInstance->c_scene_instances_id,
                    'flag'                => $flag ?? 'NULL', 'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir, 'instance_base_dir'   => $instanceBaseDir,
                ]);
                $createdItemsInfo[$itemNode['id']] = ['id' => $vmDbId, 'actual_name' => $vmName, 'type' => 'virtual_machine'];
            }
            // ... (网络连接和路由配置)

            $sceneInstance->c_status = 'RUNNING';
            $sceneInstance->save();
            DB::commit();
            return response()->json([
                'message' => '演练场景已成功启动！', 'scene_instance_id' => $sceneInstance->c_scene_instances_id,
                'created_items' => $createdItemsInfo, 'created_switches' => $createdSwitchesInfo,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            if ($sceneInstance) {
                $sceneInstance->c_status = 'FAILED';
                $sceneInstance->save();
            }
            Log::error("启动场景时发生严重错误: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '启动场景时发生错误：' . $e->getMessage()], 500);
        }
    }

    private function assignIpAddresses(array &$connections): void
    {
        $vmIps = DB::table('c_scene_vm_instances')->whereNotNull('c_ip')->pluck('c_ip');
        $containerIps = DB::table('c_scene_container_instances')->whereNotNull('c_ip')->pluck('c_ip');
        $existingIps = $vmIps->merge($containerIps)->map(function ($ip) {
            return explode('/', $ip)[0];
        })->unique()->flip();
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
