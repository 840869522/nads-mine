<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneConfig;
use App\Models\scenario\SceneInstance;
use App\Models\scenario\SceneContainerInstance;
use App\Models\scenario\SceneSwitchInstance;
use App\Models\scenario\SceneVmInstance;
use App\RunTool\CommandLineService;
use App\RunTool\TopologyParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
//为了完成上述功能，DrillController 依赖于以下几个关键组件：

// CommandLineService: 这是一个服务类，专门负责执行底层的命令行工具（如 docker）。DrillController 通过它来创建容器和获取容器信息，实现了业务逻辑与底层命令执行的分离。

// // TopologyParser: 一个工具类，用于解析前端传来的或数据库中存储的复杂拓扑数据。
// Eloquent 模型:

// SceneConfig: 读取场景的静态配置。

// SceneInstance: 创建和管理场景的运行时实例。

// SceneContainerInstance: 记录场景实例与容器之间的关联。
// ovs启动
// sudo ovsdb-server --remote=punix:/usr/local/var/run/openvswitch/db.sock --remote=db:Open_vSwitch,Open_vSwitch,manager_options --pidfile --detach

// sudo ovs-vswitchd --pidfile --detach

// ps aux | grep ovs

//journalctl -f | grep ovs-vswitchd
use Illuminate\Support\Facades\DB;

class DrillController extends Controller
{
    private CommandLineService $cliService;

    public function __construct(CommandLineService $cliService)
    {
        $this->cliService = $cliService;
    }

        /**
     * 接受指令启动一个演练场景.
     *
     * @param Request $request
     * @param SceneConfig $scenario
     * @return \Illuminate\Http\JsonResponse
     */
    public function startDrill(Request $request, SceneConfig $scenario)
    {
        $validator = Validator::make($request->all(), ['username' => 'required|string|max:50']);
        if ($validator->fails()) {
            return response()->json(['message' => '请求中必须包含用户名。', 'errors' => $validator->errors()], 422);
        }
        $userName = $request->input('username');
        $topologyJson = $scenario->c_scene;

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

        try {
            $sceneInstance = SceneInstance::create([
                'c_config_id' => $scenario->c_config_id, 'c_username' => $userName, 'c_status' => 'CREATING',
            ]);
            Log::info("创建场景实例记录成功", ['instance_id' => $sceneInstance->c_scene_instances_id]);
            
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
                 $options = [
                    'image' => $containerData['image'], 
                    'name'  => $containerName,
                    'ports' => $containerData['portMappings'], 
                    'env'   => $containerData['env'],
                    'scene_instance_id' => $sceneInstance->c_scene_instances_id,
                 ];
                 $flag = $containerData['isTarget'] ? 'flag{' . Str::uuid()->toString() . '}' : null;
                 if ($flag) $options['env'][] = ['key' => 'FLAG', 'value' => $flag];

                 $containerId = $this->cliService->createContainer($options);
                $containerIp = $containerIps[$containerData['id']] ?? null;
                SceneContainerInstance::create([
                    'c_container_id' => $containerId,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                    'c_flag' => $flag,
                    'c_ip' => $containerIp,
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
                
                $parsedVmNode = $vmsParsed[$itemNode['id']];
                $correctImageName = $parsedVmNode['image'];
                
                if (empty($correctImageName) || $correctImageName === 'vm-qemu:latest') {
                    $correctImageName = 'v_att_tcpScanning'; 
                    Log::info("节点 {$itemNode['label']} 未指定镜像或镜像无效, 将使用默认镜像: {$correctImageName}");
                }
                
                $vmName = str_replace([' '], '_', $itemNode['label']) . '_' . $instanceShortId;
                $flag = ($parsedVmNode['isTarget'] ?? false) ? 'flag{' . Str::uuid()->toString() . '}' : null;
                
                $vmInstance = SceneVmInstance::create([
                    'c_vm_name'            => $vmName,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                    'c_ip'                 => $ip,
                    'c_flag'               => $flag,
                ]);
                $vmDbId = $vmInstance->c_vm_id;
                Log::info("VM 记录已创建，ID: {$vmDbId}", ['name' => $vmName]);

                $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];

                $this->cliService->createVm([
                    'id'                  => $vmDbId,
                    'vm_name'             => $vmName, 
                    'image'               => $correctImageName,
                    'ip'                  => $ip,
                    'scene_instance_id'   => $sceneInstance->c_scene_instances_id,
                    'flag'                => $flag ?? 'NULL',
                    'switch_name'         => $actualSwitchName,
                    'image_dir'           => $imageDir,
                    'instance_base_dir'   => $instanceBaseDir,
                ]);
                
                $createdItemsInfo[$itemNode['id']] = [
                    'id' => $vmDbId, 'actual_name' => $vmName, 'type' => 'virtual_machine'
                ];
            }
            
            Log::info("================== 开始建立剩余网络连接 ==================");
            foreach ($connections as $conn) {
                $source = $conn['source'];
                $target = $conn['target'];

                // a. 交换机-交换机连接
                if ($source['type'] === 'switch' && $target['type'] === 'switch') {
                    $this->cliService->connectSwitchToSwitch(
                        $createdSwitchesInfo[$source['id']]['actual_name'],
                        $createdSwitchesInfo[$target['id']]['actual_name']
                    );
                } 
                // b. 容器-交换机连接 (VM连接已由脚本处理，此处只处理容器)
                elseif (($source['type'] === 'container' && $target['type'] === 'switch') || ($source['type'] === 'switch' && $target['type'] === 'container')) {
                    $containerNode = $source['type'] === 'container' ? $source : $target;
                    $switchNode = $source['type'] === 'switch' ? $source : $target;
                    
                    $this->cliService->connectContainerToSwitch(
                        $createdSwitchesInfo[$switchNode['id']]['actual_name'],
                        $createdItemsInfo[$containerNode['id']]['actual_name'],
                        $containerNode['ip']
                    );
                }
                //新增逻辑：处理 OVS 交换机到 Linux Bridge (br0) 的连接 ★★★
                elseif (($source['type'] === 'switch' && $target['type'] === 'nat_bridge') || ($source['type'] === 'nat_bridge' && $target['type'] === 'switch')) {
                    $switchNode = $source['type'] === 'switch' ? $source : $target;
                    $bridgeNode = $source['type'] === 'nat_bridge' ? $source : $target;

                    // 获取真实的 OVS 交换机名称
                    $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];
                    // 获取网桥名称，通常就是 'br0'
                    $bridgeName = $bridgeNode['label'];
                    
                    Log::info("正在连接 OVS 交换机 '{$actualSwitchName}' 到 Linux Bridge '{$bridgeName}'");

                    // 调用专门的服务方法
                    // 注意：这个方法在之前的对话中已添加至 CommandLineService.php
                    // 它会使用 `brctl addif` 而不是 `ovs-vsctl add-port` 来操作 br0
                    $this->cliService->connectSwitchToBr0($actualSwitchName, $bridgeName);
                }
            }
            // 配置网关IP和所有容器的路由 
            $gatewayIp = '10.100.0.254/16'; // 定义一个固定的网关IP
            $containersToRoute = [];
            foreach ($parsedTopology['containers'] as $containerData) {
                // 从之前创建的 items 信息中获取容器的真实名称
                $actualContainerName = $createdItemsInfo[$containerData['id']]['actual_name'];
                $containersToRoute[] = ['name' => $actualContainerName];
            }

            // 如果有需要配置路由的容器，则执行配置
            if (!empty($containersToRoute)) {
                $this->cliService->configureBridgeAndRoutes('br0', $gatewayIp, $containersToRoute);
                Log::info("================== 网关和路由配置完成 ==================");
            }
            $sceneInstance->c_status = 'RUNNING';
            $sceneInstance->save();
            return response()->json([
                'message' => '演练场景已成功启动！', 'scene_instance_id' => $sceneInstance->c_scene_instances_id,
                'created_items' => $createdItemsInfo, 'created_switches' => $createdSwitchesInfo,
            ]);

        } catch (\Exception $e) {
            if ($sceneInstance) {
                $sceneInstance->c_status = 'FAILED';
                $sceneInstance->save();
            }
            $errorMessage = $e->getMessage();
            Log::error("启动场景时发生严重错误: " . $errorMessage, ['trace' => $e->getTraceAsString()]);
            return response()->json(['message' => '启动场景时发生错误：' . $errorMessage], 500);
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

        $octet3 = 0;
        $octet4 = 0;

        $getNextIp = function() use (&$octet3, &$octet4, &$existingIps) {
            do {
                if ($octet4 >= 254) {
                    $octet4 = 1;
                    $octet3++;
                } else {
                    $octet4++;
                }

                if ($octet3 >= 255) {
                    throw new \Exception("IP地址池 10.100.0.0/16 已耗尽。");
                }

                $newIp = "10.100.{$octet3}.{$octet4}";

            } while (isset($existingIps[$newIp]));

            $existingIps[$newIp] = true;
            
            Log::info("Assigned new IP: {$newIp}");
            return $newIp . "/16";
        };

        foreach ($connections as &$connection) {
            // ★★★ 新增：为bridge类型的节点跳过IP分配 ★★★
            if ($connection['source']['type'] === 'nat_bridge' || $connection['target']['type'] === 'nat_bridge') {
                continue;
            }

            if (empty($connection['source']['ip'])) {
                $connection['source']['ip'] = $getNextIp();
            }
            if (empty($connection['target']['ip'])) {
                $connection['target']['ip'] = $getNextIp();
            }
        }
    }
}