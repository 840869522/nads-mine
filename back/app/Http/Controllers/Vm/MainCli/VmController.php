<?php
namespace App\Http\Controllers\Vm\MainCli;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class VmController extends Controller
{
    // GET /vms
    public function listVms()
    {
        // TODO: implement actual virsh list logic
        return response()->json([]);
    }

    // GET /vms/images
    public function listVmImages()
    {
        // TODO: implement image listing via virsh/virt-inspector
        return response()->json([]);
    }

    // POST /vms/create
    public function createVm(Request $request)
    {
        // TODO: implement VM creation logic
        return response()->json(['ok' => true]);
    }

    // GET /vms/{vm_name}/guac
    public function getGuacInfo($vmName)
    {
        return response()->json(['token' => '', 'ds' => '', 'connections' => []]);
    }

    // GET /vms/{vm_id}
    public function getVmInfo($vmId)
    {
        return response()->json(['status' => 'unknown']);
    }

    // POST /vms/{vm_id}/actions/{action}
    public function manageVmLifecycle($vmId, $action)
    {
        return response()->json(['message' => 'ok', 'vm_id' => $vmId, 'action' => $action, 'state' => 'unknown']);
    }

    // GET /vms/{vm_id}/snapshots
    public function listVmSnapshots($vmId)
    {
        return response()->json([]);
    }

    // POST /vms/{vm_id}/snapshots
    public function createVmSnapshot($vmId, Request $request)
    {
        return response()->json([]);
    }

    // POST /vms/{vm_id}/snapshots/{snapshot_id}/revert
    public function revertVmSnapshot($vmId, $snapshotId)
    {
        return response()->json(['message' => 'reverted']);
    }

    // DELETE /vms/{vm_id}/snapshots/{snapshot_id}
    public function deleteVmSnapshot($vmId, $snapshotId)
    {
        return response()->json(null, 204);
    }

    // GET /vms/{vm_id}/storage/disks
    public function listVmDisks($vmId)
    {
        return response()->json([]);
    }

    // GET /vms/{vm_id}/storage/cdroms
    public function listVmCdroms($vmId)
    {
        return response()->json([]);
    }

    // GET /vms/{vm_id}/network/vnics
    public function listVmVnics($vmId)
    {
        return response()->json([]);
    }

    // GET /vms/{vm_id}/metrics
    public function getVmRealtimeMetrics($vmId)
    {
        return response()->json([]);
    }

    // GET /vms/{vm_id}/events
    public function listVmEvents($vmId)
    {
        return response()->json([]);
    }
}
