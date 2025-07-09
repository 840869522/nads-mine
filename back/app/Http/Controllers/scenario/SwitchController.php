<?php

namespace App\Http\Controllers\scenario;

use App\Http\Controllers\Controller;
use App\Models\scenario\SceneInstance;
use App\RunTool\CommandLineService; // 【修改点 1】: 引入命令行服务
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SwitchController extends Controller
{
    /**
     * 声明一个私有属性用于存放命令行服务实例
     */
    private CommandLineService $cliService;

    /**
     * 【使用构造函数依赖注入，获取 CommandLineService 实例
     */
    public function __construct(CommandLineService $cliService)
    {
        $this->cliService = $cliService;
    }

    /**
     * 重写 index 方法的逻辑
     * 获取系统上所有正在运行的 OVS 网桥列表，反映系统实时状态。
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        try {
            // 调用服务层方法，执行 `ovs-vsctl list-br`
            $switches = $this->cliService->listSwitches();

            // 将命令行返回的纯文本列表，格式化为更标准的前端JSON格式
            $data = array_map(function ($switchName) {
                return [
                    'switch_name' => $switchName,
                    'source'      => 'system_realtime' // 添加一个来源字段，方便前端区分
                ];
            }, $switches);

            return response()->json($data);

        } catch (\Exception $e) {
            Log::error('通过命令行获取 OVS 网桥列表时发生错误: ' . $e->getMessage());
            return response()->json(['message' => '服务器内部错误，获取列表失败。'], 500);
        }
    }

    /**
     *
     * 获取指定场景实例下记录的交换机，反映应用记录状态。
     *
     * @param  \App\Models\scenario\SceneInstance  $instance (通过路由模型绑定自动注入)
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(SceneInstance $instance)
    {
        try {
            // 此处逻辑保持不变，依然从数据库中查询与该实例关联的交换机
            $switches = $instance->switches; 

            $data = $switches->map(function ($switch) {
                return [
                    'switch_name' => $switch->c_switch_name,
                    'instance_id' => $switch->c_scene_instances_id,
                    'source'      => 'database_record' // 添加来源字段
                ];
            });

            return response()->json($data);

        } catch (\Exception $e) {
            Log::error("获取实例 {$instance->c_scene_instances_id} 的交换机列表时发生错误: " . $e->getMessage());
            return response()->json(['message' => '获取交换机列表失败。'], 500);
        }
    }
    
}
