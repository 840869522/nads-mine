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
use Illuminate\Support\Facades\File; // 引入File Facade
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class DrillController extends Controller
{
    private CommandLineService $cliService;
    private array $vmImageOsMap = []; // 用于存储镜像操作系统映射

    public function __construct(CommandLineService $cliService)
    {
        $this->cliService = $cliService;
        // 在构造函数中加载并解析JSON映射文件
        $this->loadVmImageOsMap();
    }

    /**
     * 加载 vmImageOverrides.json 文件内容到类属性
     */
    private function loadVmImageOsMap(): void
    {
        try {
            // ★★★ 核心修复：修正文件路径 ★★★
            // base_path() -> /var/www/nads/back
            // .. -> /var/www/nads
            // 最终路径 -> /var/www/nads/src/data/vmImageOverrides.json
            $path = base_path('../src/data/vmImageOverrides.json');
            
            Log::info("正在尝试从以下路径加载虚拟机镜像操作系统映射: {$path}");

            if (File::exists($path)) {
                $jsonContent = File::get($path);
                $this->vmImageOsMap = json_decode($jsonContent, true);
                Log::info('成功加载虚拟机镜像操作系统映射。');
                Log::debug('加载到的 vmImageOsMap 内容:', $this->vmImageOsMap);
            } else {
                Log::warning('虚拟机镜像操作系统映射文件 (vmImageOverrides.json) 不存在。', ['path' => $path]);
            }
        } catch (\Exception $e) {
            Log::error('加载虚拟机镜像操作系统映射失败: ' . $e->getMessage());
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

            if ($memoryUsage > 75) {
                Log::warning("启动场景失败：内存使用率过高 ({$memoryUsage}%)");
                return response()->json(['message' => "启动失败：系统内存使用率 ({$memoryUsage}%) 超过 75% 的阈值。请联系管理员清理"], 503); // 503 Service Unavailable
            }

            // 检查CPU使用率
            $cpuCommand = "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'";
            $processCpu = Process::fromShellCommandline($cpuCommand);
            $processCpu->run();
            if (!$processCpu->isSuccessful()) {
                throw new ProcessFailedException($processCpu);
            }
            $cpuUsage = round((float) $processCpu->getOutput(), 2);

            if ($cpuUsage > 75) {
                Log::warning("启动场景失败：CPU使用率过高 ({$cpuUsage}%)");
                return response()->json(['message' => "启动失败：系统CPU使用率 ({$cpuUsage}%) 超过 75% 的阈值。请联系管理员清理"], 503);
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
     * 接受指令启动一个演练场景.
     *
     * @param Request $request
     * @param SceneConfig $scenario
     * @return \Illuminate\Http\JsonResponse
     */
    public function startDrill(Request $request, SceneConfig $scenario)
    {
        // 在执行任何操作前，首先检查系统资源
        $resourceCheckResponse = $this->checkSystemResources();
        if ($resourceCheckResponse !== null) {
            return $resourceCheckResponse;
        }
        
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
                $this->cliService->createSwitch($switchName, null, true);
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
                
                $flagUuid = null;
                if ($containerData['isTarget']) {
                    $flagUuid = Str::uuid()->toString();
                    $options['env'][] = ['key' => 'FLAG', 'value' => $flagUuid];
                }

                 $containerId = $this->cliService->createContainer($options);
                 $containerIp = $containerIps[$containerData['id']] ?? null;
                 SceneContainerInstance::create([
                     'c_container_id' => $containerId,
                     'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                     'c_flag' => $flagUuid,
                     'c_ip' => $containerIp,
                     'c_container_name' => $containerName,
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

                $imageFileName = Str::endsWith($correctImageName, '.qcow2') ? $correctImageName : $correctImageName . '.qcow2';

                $osData = $this->vmImageOsMap[$imageFileName] ?? null;
                $osType = strtolower($osData['osType'] ?? 'ubuntu'); // 默认为ubuntu
                Log::info("正在为镜像 '{$imageFileName}' 查找操作系统类型", [
                    'found_data' => $osData,
                    'determined_os_type' => $osType
                ]);
                
                $vmName = str_replace([' '], '_', $itemNode['label']) . '_' . $instanceShortId;
                
                $flagUuid = null;
                if ($parsedVmNode['isTarget'] ?? false) {
                    $flagUuid = Str::uuid()->toString();
                }
                
                $vmInstance = SceneVmInstance::create([
                    'c_vm_name'            => $vmName,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                    'c_ip'                 => $ip,
                    'c_flag'               => $flagUuid,
                ]);
                $vmDbId = $vmInstance->c_vm_id;
                Log::info("VM 记录已创建，ID: {$vmDbId}", ['name' => $vmName]);

                $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];

                if ($osType === 'win7') {
                    $this->cliService->createVmWin7([
                        'id'                  => $vmDbId,
                        'vm_name'             => $vmName, 
                        'image'               => $correctImageName,
                        'ip'                  => $ip,
                        'scene_instance_id'   => $sceneInstance->c_scene_instances_id,
                        'flag'                => $flagUuid ?? 'NULL',
                        'switch_name'         => $actualSwitchName,
                        'image_dir'           => $imageDir,
                        'instance_base_dir'   => $instanceBaseDir,
                    ]);
                } elseif ($osType === 'win7_1') {
                    $this->cliService->createVmWin7_1([
                        'id'                  => $vmDbId,
                        'vm_name'             => $vmName, 
                        'image'               => $correctImageName,
                        'switch_name'         => $actualSwitchName,
                        'image_dir'           => $imageDir,
                        'instance_base_dir'   => $instanceBaseDir,
                    ]);
                } elseif ($osType === 'win2003') {
                    $this->cliService->createVmWin2003([
                        'id'                  => $vmDbId,
                        'vm_name'             => $vmName, 
                        'image'               => $correctImageName,
                        'switch_name'         => $actualSwitchName,
                        'image_dir'           => $imageDir,
                        'instance_base_dir'   => $instanceBaseDir,
                    ]);
                } else { // 默认为 ubuntu
                    $this->cliService->createVm([
                        'id'                  => $vmDbId,
                        'vm_name'             => $vmName, 
                        'image'               => $correctImageName,
                        'ip'                  => $ip,
                        'scene_instance_id'   => $sceneInstance->c_scene_instances_id,
                        'flag'                => $flagUuid ?? 'NULL',
                        'switch_name'         => $actualSwitchName,
                        'image_dir'           => $imageDir,
                        'instance_base_dir'   => $instanceBaseDir,
                    ]);
                }
                
                $createdItemsInfo[$itemNode['id']] = [
                    'id' => $vmDbId, 'actual_name' => $vmName, 'type' => 'virtual_machine'
                ];
            }
            
            Log::info("================== 开始建立剩余网络连接 ==================");
            foreach ($connections as $conn) {
                $source = $conn['source'];
                $target = $conn['target'];

                if ($source['type'] === 'switch' && $target['type'] === 'switch') {
                    $this->cliService->connectSwitchToSwitch(
                        $createdSwitchesInfo[$source['id']]['actual_name'],
                        $createdSwitchesInfo[$target['id']]['actual_name']
                    );
                } 
                elseif (($source['type'] === 'container' && $target['type'] === 'switch') || ($source['type'] === 'switch' && $target['type'] === 'container')) {
                    $containerNode = $source['type'] === 'container' ? $source : $target;
                    $switchNode = $source['type'] === 'switch' ? $source : $target;
                    
                    $this->cliService->connectContainerToSwitch(
                        $createdSwitchesInfo[$switchNode['id']]['actual_name'],
                        $createdItemsInfo[$containerNode['id']]['actual_name'],
                        $containerNode['ip']
                    );
                }
                elseif (($source['type'] === 'switch' && $target['type'] === 'nat_bridge') || ($source['type'] === 'nat_bridge' && $target['type'] === 'switch')) {
                    $switchNode = $source['type'] === 'switch' ? $source : $target;
                    $bridgeNode = $source['type'] === 'nat_bridge' ? $source : $target;

                    $actualSwitchName = $createdSwitchesInfo[$switchNode['id']]['actual_name'];
                    $bridgeName = $bridgeNode['label'];
                    
                    Log::info("正在连接 OVS 交换机 '{$actualSwitchName}' 到 Linux Bridge '{$bridgeName}'");

                    $this->cliService->connectSwitchToBr0($actualSwitchName, $bridgeName);
                }
            }
            //添加iptables转发
            if (!empty($parsedTopology['iptablesRules'])) {
                Log::info("================== Applying iptables rules ==================");
                $this->cliService->applyIptablesRules($parsedTopology['iptablesRules'], $createdItemsInfo, $connections);
            }
            // 配置网关IP和所有容器的路由
            $gatewayIp = '10.100.0.254/16'; // 定义一个固定的网关IP

            $containersToRoute = [];

            $switchesConnectedToBridge = [];
            foreach ($connections as $conn) {
                if ($conn['source']['type'] === 'nat_bridge' && $conn['target']['type'] === 'switch') {
                    $switchesConnectedToBridge[$conn['target']['id']] = true;
                } elseif ($conn['target']['type'] === 'nat_bridge' && $conn['source']['type'] === 'switch') {
                    $switchesConnectedToBridge[$conn['source']['id']] = true;
                }
            }

            if (!empty($switchesConnectedToBridge)) {
                foreach ($connections as $conn) {
                    $containerNode = null;
                    $switchNode = null;

                    if ($conn['source']['type'] === 'container' && $conn['target']['type'] === 'switch') {
                        $containerNode = $conn['source'];
                        $switchNode = $conn['target'];
                    } elseif ($conn['target']['type'] === 'container' && $conn['source']['type'] === 'switch') {
                        $containerNode = $conn['target'];
                        $switchNode = $conn['source'];
                    }

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
