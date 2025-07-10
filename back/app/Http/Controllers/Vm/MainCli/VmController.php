<?php
namespace App\Http\Controllers\Vm\MainCli;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

class VmController extends Controller
{
    private string $python;
    private string $script;

    public function __construct()
    {
        $root = dirname(base_path());
        $this->python = $root . '/src/.venv/bin/python3';
        $this->script = $root . '/src/main_cli_local.py';
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
        return $this->runCli(['list-vms']);
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
        return $this->runCli(['guac-info', $vmName]);
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
