<?php

namespace App\Http\Controllers\Vm;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\scenario\SceneVmInstance;
use App\RunTool\CommandLineService;
use Symfony\Component\Process\Process;
use Illuminate\Support\Str;

class VmController extends Controller
{

    private CommandLineService $cliService;

    public function __construct(CommandLineService $cliService)
    {
        $this->cliService = $cliService;
    }


    /**
     * ★ 替换：根据场景实例ID获取其下的所有虚拟机实例，并应用当前用户的权限 (不修改DB版)
     */
    public function listVmsBySceneInstance(string $instance_id)
    {
        // 1. 从虚拟化平台获取所有VM的实时状态
        try {
            $allVmsFromHypervisor = $this->fetchVmInstances();
            if (!is_array($allVmsFromHypervisor)) {
                Log::error('fetchVmInstances did not return an array for instance ' . $instance_id);
                return response()->json([]);
            }
        } catch (\Throwable $e) {
            Log::error('Failed to fetch VM instances from hypervisor for instance ' . $instance_id . ': ' . $e->getMessage());
            return response()->json(['error' => '无法从虚拟化平台获取虚拟机列表: ' . $e->getMessage()], 500);
        }

        // 2. ★ 核心改动：使用带有权限作用域的模型来查询数据库
        try {
            $vmDetailsFromDb = SceneVmInstance::where('c_scene_instances_id', $instance_id)
                ->forCurrentUser($instance_id) // 调用修改后的 scope
                ->leftJoin('c_scene_instances as si', 'c_scene_vm_instances.c_scene_instances_id', '=', 'si.c_scene_instances_id')
                ->leftJoin('c_scene_configs as sc', 'si.c_config_id', '=', 'sc.c_config_id')
                ->select(
                    'c_scene_vm_instances.c_vm_name',
                    'c_scene_vm_instances.c_scene_instances_id',
                    'c_scene_vm_instances.c_ip',
                    'c_scene_vm_instances.c_flag', // ★ 查询 c_flag 字段
                    'sc.c_name as scene_name'
                )
                ->get()
                ->keyBy('c_vm_name');

        } catch (\Throwable $e) {
            Log::error('Database query for scene VMs failed for instance ' . $instance_id . ': ' . $e->getMessage());
            return response()->json(['error' => '数据库查询失败: ' . $e->getMessage()], 500);
        }

        // 3. 过滤并合并数据
        $resultVms = [];
        foreach ($allVmsFromHypervisor as $vm) {
            if (isset($vmDetailsFromDb[$vm['name']])) {
                $dbInfo = $vmDetailsFromDb[$vm['name']];

                $vm['scene_instance_id'] = $dbInfo->c_scene_instances_id;
                $vm['scene_name']        = $dbInfo->scene_name;
                $vm['ip']                = $dbInfo->c_ip;
                // ★ 核心改动：动态生成 is_target 字段
                $vm['is_target']         = !empty($dbInfo->c_flag);

                $resultVms[] = $vm;
            }
        }

        return response()->json($resultVms);
    }

    /**
     * Execute a system command and return trimmed output.
     */
    private function runCommand(array $cmd): string
    {
        $process = new Process($cmd);
        $process->run();
        if (!$process->isSuccessful()) {
            throw new \RuntimeException(trim($process->getErrorOutput() ?: $process->getOutput()));
        }
        return trim($process->getOutput());
    }

    private function runVirsh(string ...$args): string
    {
        $cmd = array_merge(['virsh', '-c', 'qemu:///system'], $args);
        return $this->runCommand($cmd);
    }

    // ... 所有其他未改动的方法，包括私有辅助方法和公共API端点 ...
    // ... sizeToMb, genMac, detectOs, detectVmOs, parseVncPort, waitForState, ...
    // ... fetchVmInstances, fetchVmImages, listVms, listVmImages, getGuacInfo, ...
    // ... getVmInfo, manageVmLifecycle, snapshot methods, storage methods, etc. ...
    private function sizeToMb(float $size, string $unit): float { /* ... */ return 0.0;}
    private function genMac(string $seed): string { /* ... */ return '';}
    private function detectOs(string $imgPath): string { /* ... */ return '';}
    private function detectVmOs(string $vmId): ?string { /* ... */ return null;}
    private function parseVncPort(string $xml): ?int { /* ... */ return null;}
    private function waitForState(string $name, string $target, int $timeout = 30): bool { /* ... */ return false;}
    private function fetchVmInstances(): array { /* ... */ return [];}
    private function fetchVmImages(): array { /* ... */ return [];}
    private function parseVirshSizeToBytes(string $s): ?int { /* ... */ return null;}
    private function fetchVmImagePaths(): array { /* ... */ return [];}
    public function listVms() { /* ... */ return response()->json([]);}
    public function listVmImages() { /* ... */ return response()->json([]);}
    public function listVmImageOptions() { /* ... */ return response()->json([]);}
    public function createVm(Request $request) { /* ... */ return response()->json([]);}
    public function getGuacInfo($vmName, Request $request) { /* ... */ return response()->json([]);}
    public function getVmInfo($vmId) { /* ... */ return response()->json([]);}
    public function manageVmLifecycle($vmId, $action) { /* ... */ return response()->json([]);}
    public function listVmSnapshots($vmId) { /* ... */ return response()->json([]);}
    public function createVmSnapshot($vmId, Request $request) { /* ... */ return response()->json([]);}
    public function revertVmSnapshot($vmId, $snapshotId) { /* ... */ return response()->json([]);}
    public function deleteVmSnapshot($vmId, $snapshotId) { /* ... */ return response()->json([]);}
    public function listVmDisks($vmId) { /* ... */ return response()->json([]);}
    public function listVmCdroms($vmId) { /* ... */ return response()->json([]);}
    public function listVmVnics($vmId) { /* ... */ return response()->json([]);}
    public function getVmRealtimeMetrics($vmId) { /* ... */ return response()->json([]);}
    public function listVmEvents($vmId) { /* ... */ return response()->json([]);}
    public function deleteVm(Request $request, $vmId) { /* ... */ return response()->json([]);}
}
