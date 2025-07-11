<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneConfig;
use App\Models\scenario\SceneInstance; 
use App\Models\scenario\SceneContainerInstance;
use App\Models\scenario\SceneSwitchInstance;
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
        // 1. 验证请求者信息
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '请求中必须包含用户名。', 'errors' => $validator->errors()], 422);
        }
        
        $userName = $request->input('username');

        // 2. 获取并解析拓扑数据
        $topologyJson = $scenario->c_scene;
        if (empty($topologyJson)) {
            return response()->json(['message' => '场景拓扑数据为空。'], 422);
        }
        
        $parsedTopology = TopologyParser::parse($topologyJson);
        $containers = $parsedTopology['containers']; // 获取需要创建的容器列表
        $switches = $parsedTopology['switches'];     // 获取需要创建的交换机列表
        $connections = $parsedTopology['connections']; // 获取需要建立的连接

        $createdSwitchesInfo = []; // 用于存储已创建交换机的信息
        $createdItemsInfo = []; 
        $sceneInstance = null; 

        try {
            // 3. 首先创建场景实例，以获得唯一的 c_scene_instances_id
            $sceneInstance = SceneInstance::create([
                'c_config_id' => $scenario->c_config_id,
                'c_username'  => $userName,
                'c_status'    => 'CREATING',
            ]);
            Log::info("创建场景实例记录成功", ['instance_id' => $sceneInstance->c_scene_instances_id, 'user' => $userName]);

            // 【修改】从完整的场景实例UUID中截取后8位，生成一个简短且高概率唯一的标识符。
            // 这样做可以避免名称过长，同时保证了在同一时间创建的多个实例不会重名。
            $instanceShortId = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -8);
            // 为交换机生成一个更短的4位ID后缀
            $switchIdSuffix = substr(str_replace('-', '', $sceneInstance->c_scene_instances_id), -5);
            // 4. 创建交换机，并应用新的命名规则
            Log::info("开始创建 OVS 网桥...", ['count' => count($switches)]);
            foreach ($switches as $switchData) {
                //  应用新的12字符命名规则
                // 清理并截取原始标签，确保其长度不超过7个字符
                $shortLabel = str_replace([' '], '_', $switchData['label']);
                // 拼接成最终名称，总长度不超过 7 + 1 + 4 = 12 个字符
                $switchName = $shortLabel . '_' . $switchIdSuffix;
                $this->cliService->createSwitch($switchName);

                // >> 将创建的交换机信息存起来
                $createdSwitchesInfo[$switchData['id']] = [
                    'actual_name' => $switchName,
                    'label'       => $switchData['label'],
                ];

                Log::info("OVS 网桥 '{$switchName}' 创建成功。");
                // 在创建交换机后，立即使用新模型将关联记录存入数据库
                SceneSwitchInstance::create([
                    'c_switch_name'        => $switchName,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                ]);
                Log::info("交换机实例关联记录已创建", ['instance_id' => $sceneInstance->c_scene_instances_id, 'switch_name' => $switchName]);
            }

            // 5. 创建容器，并应用新的命名规则
            Log::info("开始创建 Docker 容器...");
            foreach ($containers as $containerData) {
                // 【修改】新的命名规则: <容器原始名称>_<场景实例ID简写>
                $containerName = str_replace([' '], '_', $containerData['label']) . '_' . $instanceShortId;
                
                $options = [
                    'image' => $containerData['image'],
                    'name'  => $containerName, // 使用新的、唯一的容器名称
                    'ports' => $containerData['portMappings'],
                    'env'   => $containerData['env'],
                ];

                $flag = null;
                if ($containerData['isTarget']) {
                    $flag = 'flag{' . Str::uuid()->toString() . '}';
                    $options['env'][] = ['key' => 'FLAG', 'value' => $flag];
                }

                $containerId = $this->cliService->createContainer($options);
                $pid = $this->cliService->getContainerPid($containerId);

                // 插入容器id到容器实例场景实例关联表
                SceneContainerInstance::create([
                    'c_container_id'       => $containerId,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                    'c_flag'               => $flag,
                ]);
                Log::info("容器实例关联记录已创建", ['instance_id' => $sceneInstance->c_scene_instances_id, 'container_id' => $containerId, 'flag' => $flag]);
                
                // 记录创建成功的信息，并返回给前端
                $createdItemsInfo[$containerData['id']] = [
                    'container_id' => $containerId, 
                    'pid' => $pid, 
                    'label' => $containerData['label'],
                    'actual_name' => $containerName
                ];
                
                Log::info("容器创建并启动成功", ['name' => $options['name'], 'id' => $containerId, 'pid' => $pid]);
            }


            // 6. 建立网络连接
            Log::info("================== 开始建立网络连接  ==================", ['connection_count' => count($connections)]);

        foreach ($connections as $conn) {
            $sourceNode = $conn['source'];
            $targetNode = $conn['target'];

            // 情况1: 连接的两端都是交换机
            if ($sourceNode['type'] === 'switch' && $targetNode['type'] === 'switch') {
                $switch1Info = $createdSwitchesInfo[$sourceNode['id']] ?? null;
                $switch2Info = $createdSwitchesInfo[$targetNode['id']] ?? null;

                if ($switch1Info && $switch2Info) {
                    Log::info("检测到交换机到交换机的连接: '{$switch1Info['actual_name']}' <--> '{$switch2Info['actual_name']}'");
                    $this->cliService->connectSwitchToSwitch(
                        $switch1Info['actual_name'],
                        $switch2Info['actual_name']
                    );
                    Log::info("成功执行交换机连接命令。");
                } else {
                    Log::error('无法找到连接所需的交换机节点信息，跳过连接。', ['connection' => $conn]);
                }
                continue; // 处理完后继续下一个循环
            }
            // 情况2: 连接的一端是容器，另一端是交换机 
            if ($sourceNode['type'] === 'container' && $targetNode['type'] === 'switch') {
                $containerInfo = $createdItemsInfo[$sourceNode['id']] ?? null;
                $switchInfo = $createdSwitchesInfo[$targetNode['id']] ?? null;
                $ip = $sourceNode['ip'] ?? null;
            } elseif ($sourceNode['type'] === 'switch' && $targetNode['type'] === 'container') {
                $containerInfo = $createdItemsInfo[$targetNode['id']] ?? null;
                $switchInfo = $createdSwitchesInfo[$sourceNode['id']] ?? null;
                $ip = $targetNode['ip'] ?? null;
            } else {
                Log::warning('跳过未知类型的连接', ['source' => $sourceNode['type'], 'target' => $targetNode['type']]);
                continue;
            }

            if (!$containerInfo || !$switchInfo) {
                Log::error('无法找到连接所需的 容器-交换机 节点信息，跳过连接。', ['connection' => $conn]);
                continue;
            }
            
            
            // 服务层将自动处理交换机上的端口名
            $this->cliService->connectContainerToSwitch(
                $switchInfo['actual_name'],
                $containerInfo['actual_name'],
                $ip
            );
            
            Log::info("成功执行 容器-交换机 连接命令: '{$containerInfo['actual_name']}' <--> '{$switchInfo['actual_name']}'");
        }

        Log::info("================== 所有网络连接处理完毕 ==================");
            // 7. 更新场景实例状态并返回成功响应
            $sceneInstance->c_status = 'RUNNING';
            $sceneInstance->save();
            Log::info("场景实例状态更新为 RUNNING", ['instance_id' => $sceneInstance->c_scene_instances_id]);

            return response()->json([
                'message'           => '演练场景已成功启动，所有节点和网络已配置完毕！下一步处理交换机与交换机之间的连接',
                'scene_instance_id' => $sceneInstance->c_scene_instances_id,
                'created_items'     => $createdItemsInfo,
                'created_switches'  => $createdSwitchesInfo,
            ]);

        } catch (\Exception $e) {
            // 异常处理
            if ($sceneInstance) {
                $sceneInstance->c_status = 'FAILED';
                $sceneInstance->save();
            }
            $errorMessage = $e->getMessage();
            if (!mb_check_encoding($errorMessage, 'UTF-8')) {
                $errorMessage = mb_convert_encoding($errorMessage, 'UTF-8', 'auto');
            }
            Log::error("启动场景 '{$scenario->c_name}' 时发生严重错误: " . $errorMessage);
            
            // TODO: 错误回滚逻辑，例如删除已创建的容器和网桥
            
            return response()->json(['message' => '启动场景时发生错误：' . $errorMessage], 500);
        }
    }
}