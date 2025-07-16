<?php
namespace App\Http\Controllers\Vm\MainCli;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

class VmController extends Controller
{
    private string $python;
    private string $script;

    public function __construct()
    {
        $root = dirname(base_path());
        $this->python = $root . '/back/app/Services/vmservice/.venv/bin/python3';
        $this->script = $root . '/back/app/Services/vmservice/main_cli_local.py';
    }

    private function runCli(array $args)
    {
        $cmd = array_merge([$this->python, $this->script], $args);
        $process = new Process($cmd);
        $process->run();

        if (!$process->isSuccessful()) {
            $err = trim($process->getErrorOutput() ?: $process->getOutput());
            return response()->json(['error' => $err], 500);
        }

        $output = trim($process->getOutput());
        $data = json_decode($output, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $status = $data['status_code'] ?? 200;
            unset($data['status_code']);
            return response()->json($data, $status);
        }

        return response($output, 200)
            ->header('Content-Type', 'application/json');
    }

    // GET /vms
    public function listVms()
    {
        $cmd = [$this->python, $this->script, 'list-vms'];
        $process = new Process($cmd);
        $process->run();

        if (!$process->isSuccessful()) {
            $err = trim($process->getErrorOutput() ?: $process->getOutput());
            return response()->json(['error' => $err], 500);
        }

        $output = trim($process->getOutput());
        $data = json_decode($output, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return response($output, 200)->header('Content-Type', 'application/json');
        }

        $status = $data['status_code'] ?? 200;
        unset($data['status_code']);

        if (is_array($data)) {
            $names = array_column($data, 'name');
            $extra = DB::table('c_scene_vm_instances as v')
                ->leftJoin('c_scene_instances as si', DB::raw('v.c_scene_instances_id COLLATE utf8mb4_unicode_ci'), '=', 'si.c_scene_instances_id')
                ->leftJoin('c_scene_configs as sc', 'si.c_config_id', '=', 'sc.c_config_id')
                ->select(
                    'v.c_vm_name',
                    'v.c_scene_instances_id',
                    'v.c_ip',
                    'sc.c_name as scene_name'
                )
                ->whereIn('v.c_vm_name', $names)
                ->get()
                ->keyBy('c_vm_name');

            foreach ($data as &$vm) {
                $info = $extra[$vm['name']] ?? null;
                if ($info) {
                    $vm['scene_instance_id'] = $info->c_scene_instances_id;
                    $vm['scene_name'] = $info->scene_name;
                    $vm['ip'] = $info->c_ip;
                }
            }
        }

        return response()->json($data, $status);
    }

    // GET /vms/images
    public function listVmImages()
    {
        $cmd = [$this->python, $this->script, 'list-images'];
        $process = new Process($cmd);
        $process->run();

        if (!$process->isSuccessful()) {
            $err = trim($process->getErrorOutput() ?: $process->getOutput());
            return response()->json(['error' => $err], 500);
        }

        $output = trim($process->getOutput());
        $data = json_decode($output, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return response($output, 200)->header('Content-Type', 'application/json');
        }

        $status = $data['status_code'] ?? 200;
        unset($data['status_code']);

        if (is_array($data)) {
            foreach ($data as &$img) {
                unset($img['version'], $img['osType'], $img['architecture']);
            }
        }

        return response()->json($data, $status);
    }

    // POST /vms/create
    public function createVm(Request $request)
    {
        $data = $request->all();
        $args = ['create-vm'];
        foreach ([
            'vm_name' => '--vm-name',
            'base_image' => '--base-image',
            'memory' => '--memory',
            'vcpus' => '--vcpus',
            'disk_gb' => '--disk-gb',
            'os_variant' => '--os-variant',
            'ssh_key' => '--ssh-key',
            'admin_password' => '--admin-password',
            'static_ip' => '--static-ip',
        ] as $key => $flag) {
            if (isset($data[$key]) && $data[$key] !== null) {
                $args[] = $flag;
                $args[] = (string) $data[$key];
            }
        }
        return $this->runCli($args);
    }

    // GET /vms/{vm_name}/guac
    public function getGuacInfo($vmName, Request $request)
    {
        $method = $request->query('method', 'ssh');
        return $this->runCli(['guac-info', $vmName, '--method', $method]);
    }

    // GET /vms/{vm_id}
    public function getVmInfo($vmId)
    {
        return $this->runCli(['get-vm', $vmId]);
    }

    // POST /vms/{vm_id}/actions/{action}
    public function manageVmLifecycle($vmId, $action)
    {
        return $this->runCli(['lifecycle', $vmId, $action]);
    }

    // GET /vms/{vm_id}/snapshots
    public function listVmSnapshots($vmId)
    {
        return $this->runCli(['list-snapshots', $vmId]);
    }

    // POST /vms/{vm_id}/snapshots
    public function createVmSnapshot($vmId, Request $request)
    {
        $data = $request->all();
        $args = ['create-snapshot', $vmId];
        if (isset($data['name'])) {
            $args[] = $data['name'];
        }
        if (isset($data['description'])) {
            $args[] = '--description';
            $args[] = $data['description'];
        }
        return $this->runCli($args);
    }

    // POST /vms/{vm_id}/snapshots/{snapshot_id}/revert
    public function revertVmSnapshot($vmId, $snapshotId)
    {
        return $this->runCli(['revert-snapshot', $vmId, $snapshotId]);
    }

    // DELETE /vms/{vm_id}/snapshots/{snapshot_id}
    public function deleteVmSnapshot($vmId, $snapshotId)
    {
        return $this->runCli(['delete-snapshot', $vmId, $snapshotId]);
    }

    // GET /vms/{vm_id}/storage/disks
    public function listVmDisks($vmId)
    {
        return $this->runCli(['list-disks', $vmId]);
    }

    // GET /vms/{vm_id}/storage/cdroms
    public function listVmCdroms($vmId)
    {
        return $this->runCli(['list-cdroms', $vmId]);
    }

    // GET /vms/{vm_id}/network/vnics
    public function listVmVnics($vmId)
    {
        return $this->runCli(['list-vnics', $vmId]);
    }

    // GET /vms/{vm_id}/metrics
    public function getVmRealtimeMetrics($vmId)
    {
        return $this->runCli(['metrics', $vmId]);
    }

    // GET /vms/{vm_id}/events
    public function listVmEvents($vmId)
    {
        return $this->runCli(['events', $vmId]);
    }

    // DELETE /vms/{vm_id}
    public function deleteVm($vmId)
    {
        return $this->runCli(['delete-vm', $vmId]);
    }
}
