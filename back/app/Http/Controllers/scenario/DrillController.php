<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneConfig;
use App\Models\scenario\SceneInstance; 
use App\Models\scenario\SceneContainerInstance;
use App\RunTool\CommandLineService;
use App\RunTool\TopologyParser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth; 
use Illuminate\Support\Str; 
use Illuminate\Support\Facades\Validator;

class DrillController extends Controller
{
    private CommandLineService $cliService;

    public function __construct(CommandLineService $cliService)
    {
        $this->cliService = $cliService;
    }

    public function startDrill(Request $request, SceneConfig $scenario)
    {

       
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => '请求中必须包含用户名。', 'errors' => $validator->errors()], 422);
        }
        
        $userName = $request->input('username');

        // 从模型中获取正确的属性 c_scene
        $topologyJson = $scenario->c_scene;
        if (empty($topologyJson)) {
            return response()->json(['message' => '场景拓扑数据为空。'], 422);
        }
        
        $parsedTopology = TopologyParser::parse($topologyJson);
        $containers = $parsedTopology['containers'];
        
        $createdContainersInfo = [];
        $sceneInstance = null;

        try {
            // 使用从请求中获取的 $userName
            $sceneInstance = SceneInstance::create([
                'c_config_id' => $scenario->c_config_id,
                'c_username'  => $userName,
                'c_status'    => 'CREATING',
            ]);
            Log::info("创建场景实例记录成功", ['instance_id' => $sceneInstance->c_scene_instances_id, 'user' => $userName]);

            $drillPrefix = 'drill_' . $scenario->c_config_id . '_' . time();
            
            Log::info("OVS 网桥创建步骤已跳过 (将在后续实现)。");

            foreach ($containers as $containerData) {
                $options = [
                    'image' => $containerData['image'],
                    'name'  => $drillPrefix . '_' . str_replace([' '], '_', $containerData['label']),
                    'ports' => $containerData['portMappings'],
                    'env'   => $containerData['env'],
                ];

                $containerId = $this->cliService->createContainer($options);
                $pid = $this->cliService->getContainerPid($containerId);

                //插入容器id到容器实例场景实例关联表
                SceneContainerInstance::create([
                    'c_container_id'       => $containerId,
                    'c_scene_instances_id' => $sceneInstance->c_scene_instances_id,
                ]);
                Log::info("容器实例关联记录已创建", ['instance_id' => $sceneInstance->c_scene_instances_id, 'container_id' => $containerId]);
                
                $createdContainersInfo[$containerData['id']] = [
                    'container_id' => $containerId, 'pid' => $pid, 'label' => $containerData['label']
                ];
                Log::info("容器创建并启动成功", ['name' => $options['name'], 'id' => $containerId, 'pid' => $pid]);
            }

            $sceneInstance->c_status = 'RUNNING';
            $sceneInstance->save();
            Log::info("场景实例状态更新为 RUNNING", ['instance_id' => $sceneInstance->c_scene_instances_id]);

            return response()->json([
                'message' => '所有容器已成功创建！下一步将进行网络连接。',
                'drill_prefix' => $drillPrefix,
                'created_containers' => $createdContainersInfo,
            ]);

        } catch (\Exception $e) {
            if ($sceneInstance) {
                $sceneInstance->c_status = 'FAILED';
                $sceneInstance->save();
            }
            $errorMessage = $e->getMessage();
            if (!mb_check_encoding($errorMessage, 'UTF-8')) {
                $errorMessage = mb_convert_encoding($errorMessage, 'UTF-8', 'auto');
            }
            Log::error("启动场景 '{$scenario->c_name}' 时发生严重错误: " . $errorMessage);
            
            // 错误回滚逻辑 (未来需要实现)
            
            return response()->json(['message' => '启动场景时发生错误：' . $errorMessage], 500);
        }
    }
}
