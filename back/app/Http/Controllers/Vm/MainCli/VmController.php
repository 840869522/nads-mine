<?php
namespace App\Http\Controllers\Vm\MainCli;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class VmController extends Controller
{
    private Client $client;

    public function __construct()
    {
        $host = env('PYTHON_API_HOST', '127.0.0.1');
        $port = env('PYTHON_API_PORT', '3010');
        $base = "http://{$host}:{$port}";
        $this->client = new Client(['base_uri' => $base]);
    }

    private function forward(string $method, string $uri, array $options = [])
    {
        try {
            $res = $this->client->request($method, $uri, $options);
            $body = $res->getBody()->getContents();
            return response($body, $res->getStatusCode())
                ->header('Content-Type', $res->getHeaderLine('Content-Type'));
        } catch (RequestException $e) {
            $response = $e->getResponse();
            if ($response) {
                $body = $response->getBody()->getContents();
                return response($body, $response->getStatusCode())
                    ->header('Content-Type', $response->getHeaderLine('Content-Type'));
            }
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    // GET /vms
    public function listVms()
    {
        return $this->forward('GET', '/api/vms');
    }

    // GET /vms/images
    public function listVmImages()
    {
        return $this->forward('GET', '/api/vms/images');
    }

    // POST /vms/create
    public function createVm(Request $request)
    {
        return $this->forward('POST', '/api/vms/create', [
            'json' => $request->all(),
        ]);
    }

    // GET /vms/{vm_name}/guac
    public function getGuacInfo($vmName, Request $request)
    {
        return $this->forward('GET', "/api/vms/{$vmName}/guac", [
            'query' => $request->query(),
        ]);
    }

    // GET /vms/{vm_id}
    public function getVmInfo($vmId)
    {
        return $this->forward('GET', "/api/vms/{$vmId}");
    }

    // POST /vms/{vm_id}/actions/{action}
    public function manageVmLifecycle($vmId, $action)
    {
        return $this->forward('POST', "/api/vms/{$vmId}/actions/{$action}");
    }

    // GET /vms/{vm_id}/snapshots
    public function listVmSnapshots($vmId)
    {
        return $this->forward('GET', "/api/vms/{$vmId}/snapshots");
    }

    // POST /vms/{vm_id}/snapshots
    public function createVmSnapshot($vmId, Request $request)
    {
        return $this->forward('POST', "/api/vms/{$vmId}/snapshots", [
            'json' => $request->all(),
        ]);
    }

    // POST /vms/{vm_id}/snapshots/{snapshot_id}/revert
    public function revertVmSnapshot($vmId, $snapshotId)
    {
        return $this->forward('POST', "/api/vms/{$vmId}/snapshots/{$snapshotId}/revert");
    }

    // DELETE /vms/{vm_id}/snapshots/{snapshot_id}
    public function deleteVmSnapshot($vmId, $snapshotId)
    {
        return $this->forward('DELETE', "/api/vms/{$vmId}/snapshots/{$snapshotId}");
    }

    // GET /vms/{vm_id}/storage/disks
    public function listVmDisks($vmId)
    {
        return $this->forward('GET', "/api/vms/{$vmId}/storage/disks");
    }

    // GET /vms/{vm_id}/storage/cdroms
    public function listVmCdroms($vmId)
    {
        return $this->forward('GET', "/api/vms/{$vmId}/storage/cdroms");
    }

    // GET /vms/{vm_id}/network/vnics
    public function listVmVnics($vmId)
    {
        return $this->forward('GET', "/api/vms/{$vmId}/network/vnics");
    }

    // GET /vms/{vm_id}/metrics
    public function getVmRealtimeMetrics($vmId)
    {
        return $this->forward('GET', "/api/vms/{$vmId}/metrics");
    }

    // GET /vms/{vm_id}/events
    public function listVmEvents($vmId)
    {
        return $this->forward('GET', "/api/vms/{$vmId}/events");
    }
}
