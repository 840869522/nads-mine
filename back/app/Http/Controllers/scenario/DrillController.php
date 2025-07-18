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
        // ... (validator and initial setup is the same)
        $validator = Validator::make($request->all(), ['username' => 'required|string|max:50']);
        if ($validator->fails()) {
            return response()->json(['message' => '请求中必须包含用户名。', 'errors' => $validator->errors()], 422);
        }
        $userName = $request->input('username');
        $topologyJson = $scenario->c_scene;

        // 1. 解析拓扑
        $parsedTopology = TopologyParser::parse($topologyJson);
        $nodesById = collect($topologyJson['nodes'])->keyBy('id');
        $connections = $parsedTopology['connections'];
        $vmsParsed = collect($parsedTopology['vms'])->keyBy('id');
        $containersParsed = collect($parsedTopology['containers'])->keyBy('id');
        $createdSwitchesInfo = [];
        $createdItemsInfo = []; // 存放所有已创建的容器和VM
        $sceneInstance = null;

        try {
            // 2. 创建场景实例记录
            $sceneInstance = SceneInstance::create([
                'c_config_id' => $scenario->c_config_id, 'c_username' => $userName, 'c_status' => 'CREATING',
            ]);
            Log::info("创建场景实例记录成功", ['instance_id' => $sceneInstance->c_scene_instances_id]);
            
            $instanceShortId = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -8);
            $switchIdSuffix = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -5);

            // 3. 创建所有交换机
            foreach ($parsedTopology['switches'] as $switchData) {
                $switchName = str_replace([' '], '_', $switchData['label']) . '_' . $switchIdSuffix;
                $this->cliService->createSwitch($switchName);
                $this->cliService->connectSwitchToSwitch($switchName, 'ovs-switch'); // 连接到收集镜像的ovs

                $createdSwitchesInfo[$switchData['id']] = ['actual_name' => $switchName, 'label' => $switchData['label']];
                SceneSwitchInstance::create([
                    'c_switch_name' => $switchName, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                ]);
            }
            
            // 4. 创建所有容器
            foreach ($parsedTopology['containers'] as $containerData) {
                 $containerName = str_replace([' '], '_', $containerData['label']) . '_' . $instanceShortId;
                 // ... (Container creation logic remains the same)
                 $options = [
                    'image' => $containerData['image'], 'name'  => $containerName,
                    'ports' => $containerData['portMappings'], 'env'   => $containerData['env'],
                 ];
                 $flag = $containerData['isTarget'] ? 'flag{' . Str::uuid()->toString() . '}' : null;
                 if ($flag) $options['env'][] = ['key' => 'FLAG', 'value' => $flag];

                 $containerId = $this->cliService->createContainer($options);
                 SceneContainerInstance::create([
                    'c_container_id' => $containerId, 'c_scene_instances_id' => $sceneInstance->c_scene_instances_id, 'c_flag' => $flag,
                 ]);
                 $createdItemsInfo[$containerData['id']] = [
                    'id' => $containerId, 'actual_name' => $containerName, 'type' => 'container'
                 ];
            }

            // 3. 创建虚拟机并处理其直接网络连接
            Log::info("================== 开始创建虚拟机并建立连接 ==================");
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
                
                
                // 从解析好的虚拟机信息中获取正确的镜像名称
                $parsedVmNode = $vmsParsed[$itemNode['id']];
                $correctImageName = $parsedVmNode['image'];
                
    
                // 如果从节点信息中获取的镜像名称为空，或者为无效的 'vm-qemu:latest'，则使用默认镜像
                if (empty($correctImageName) || $correctImageName === 'vm-qemu:latest') {
                    // 设置一个真实存在的默认镜像
                    $correctImageName = 'v_att_tcpScanning'; 
                    
                    // 记录日志，说明使用了默认镜像
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
                    'vm_name'             => $vmName, // 
                    'image'               => $correctImageName, // 使用从解析结果中得到的正确镜像名
                   
                    'ip'                  => $ip,
                    'scene_instance_id' => $sceneInstance->c_scene_instances_id,
                    'flag'                => $flag ?? 'NULL',
                    'switch_name'         => $actualSwitchName,
                ]);
                
                $createdItemsInfo[$itemNode['id']] = [
                    'id' => $vmDbId, 'actual_name' => $vmName, 'type' => 'virtual_machine'
                ];
            }
            
            // 6. 处理剩余的网络连接 (交换机-交换机 和 容器-交换机)
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
            }

            // 7. 更新最终状态并返回
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
}