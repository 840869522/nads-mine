<?php
namespace App\Http\Controllers\Vm\MainCli;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Illuminate\Support\Str;

class VmController extends Controller
{
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

    private function sizeToMb(float $size, string $unit): float
    {
        $unit = strtolower($unit);
        if (str_starts_with($unit, 'b')) {
            return $size / (1024 * 1024);
        }
        if (str_starts_with($unit, 'g')) {
            return $size * 1024;
        }
        if (str_starts_with($unit, 'k')) {
            return $size / 1024;
        }
        return $size;
    }

    private function genMac(string $seed): string
    {
        $h = md5($seed);
        return '02:' . implode(':', [substr($h, 0, 2), substr($h, 2, 2), substr($h, 4, 2), substr($h, 6, 2), substr($h, 8, 2)]);
    }

    private function detectOs(string $imgPath): string
    {
        $xml = $this->runCommand(['virt-inspector', '--no-applications', '--no-icon', '-a', $imgPath]);
        $root = new \SimpleXMLElement($xml);
        $osNode = $root->xpath('.//operatingsystem')[0] ?? null;
        if (!$osNode) {
            throw new \RuntimeException('No <operatingsystem> node in inspector output');
        }
        $osType = strtolower(trim((string)($osNode->os_type ?? $osNode->{'os-type'} ?? '')));
        if (!$osType) {
            $osType = strtolower(trim((string)($osNode->name ?? $osNode->distro ?? '')));
        }
        if (str_contains($osType, 'windows')) {
            return 'windows';
        }
        if (str_contains($osType, 'linux')) {
            return 'linux';
        }
        $distro = strtolower((string)($osNode->distro ?? ''));
        foreach (['ubuntu','debian','centos','rhel','redhat','fedora','opensuse','suse','arch','alpine','oracle','rocky','alma'] as $kw) {
            if (str_contains($distro, $kw)) {
                return 'linux';
            }
        }
        throw new \RuntimeException('Cannot determine OS type from metadata');
    }

    private function detectVmOs(string $vmId): ?string
    {
        try {
            $xml = $this->runVirsh('dumpxml', $vmId);
        } catch (\RuntimeException $e) {
            return null;
        }
        $root = new \SimpleXMLElement($xml);
        $source = $root->xpath('.//devices/disk[@device="disk"]/source')[0] ?? null;
        if (!$source) {
            return null;
        }
        $imgPath = (string)($source['file'] ?? $source['dev']);
        if (!$imgPath) {
            return null;
        }
        try {
            return ucfirst($this->detectOs($imgPath));
        } catch (\Exception $e) {
            return null;
        }
    }

    private function parseVncPort(string $xml): ?int
    {
        if (preg_match("/<graphics[^>]*type='vnc'[^>]*port='(\d+)'/", $xml, $m)) {
            return (int)$m[1];
        }
        return null;
    }

    private function waitForState(string $name, string $target, int $timeout = 30): bool
    {
        $end = time() + $timeout;
        while (time() < $end) {
            try {
                $state = trim($this->runVirsh('domstate', $name));
                if ($state === $target) {
                    return true;
                }
            } catch (\RuntimeException $e) {
            }
            sleep(1);
        }
        return false;
    }

    private function fetchVmInstances(): array
    {
        $host = trim($this->runCommand(['hostname']));
        $output = $this->runVirsh('list', '--all');
        $lines = array_slice(preg_split('/\n/', trim($output)), 2);
        $instances = [];
        foreach ($lines as $line) {
            if (!trim($line)) { continue; }
            $parts = preg_split('/\s+/', trim($line));
            if (count($parts) < 3) { continue; }
            $name = $parts[1];
            $state = implode(' ', array_slice($parts, 2));
            try {
                $uuid = trim($this->runVirsh('domuuid', $name));
                $infoOut = $this->runVirsh('dominfo', $name);
            } catch (\RuntimeException $e) {
                continue;
            }
            $vcpu = 0; $memKiB = 0;
            foreach (preg_split('/\n/', trim($infoOut)) as $l) {
                if (str_starts_with($l, 'CPU(s):')) {
                    $vcpu = (int)preg_split('/\s+/', $l)[1];
                } elseif (str_starts_with($l, 'Used memory:') || str_starts_with($l, 'Max memory:')) {
                    $partsInfo = preg_split('/\s+/', $l);
                    $memKiB = (int)($partsInfo[1] ?? $partsInfo[2] ?? 0);
                }
            }
            $instances[] = [
                'id' => $uuid,
                'name' => $name,
                'hostNode' => $host,
                'pool' => 'default',
                'state' => $state,
                'vcpu' => $vcpu,
                'vmem' => (int)($memKiB / 1024),
            ];
        }
        return $instances;
    }

    private function fetchVmImages(): array
    {
        $images = [];
        try {
            $output = $this->runVirsh('vol-list', 'default');
        } catch (\RuntimeException $e) {
            return $images;
        }
        $lines = array_slice(preg_split('/\n/', trim($output)), 2);
        foreach ($lines as $line) {
            if (!trim($line)) { continue; }
            $parts = preg_split('/\s+/', trim($line));
            if (count($parts) < 2) { continue; }
            $vol = $parts[0];
            $path = $parts[1];
            try {
                $infoOut = $this->runVirsh('vol-info', $vol, '--pool', 'default');
            } catch (\RuntimeException $e) {
                continue;
            }
            $sizeMb = 0.0;
            foreach (preg_split('/\n/', trim($infoOut)) as $l) {
                if (str_starts_with($l, 'Capacity:')) {
                    $infoParts = preg_split('/\s+/', $l);
                    if (count($infoParts) >= 3) {
                        $sizeMb = $this->sizeToMb((float)$infoParts[1], $infoParts[2]);
                    }
                    break;
                }
            }
            $mtime = @filemtime($path);
            $uploadDate = $mtime ? date('c', $mtime) : null;
            $images[] = [
                'id' => $vol,
                'name' => $vol,
                'pool' => 'default',
                'size' => sprintf('%.1f MB', $sizeMb),
                'path' => $path,
                'modifiedDate' => $uploadDate,
                'status' => 'available',
            ];
        }
        return $images;
    }

    // GET /vms
    public function listVms()
    {
        try {
            $data = $this->fetchVmInstances();
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        if (is_array($data)) {
            $names = array_column($data, 'name');

            try {
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
            } catch (\Throwable $e) {
                // 查询失败，$extra 设置为空数组，下面将属性设为 null
                $extra = [];
            }

            foreach ($data as &$vm) {
                $info = $extra[$vm['name']] ?? null;
                $vm['scene_instance_id'] = $info->c_scene_instances_id ?? null;
                $vm['scene_name'] = $info->scene_name ?? null;
                $vm['ip'] = $info->c_ip ?? null;
            }
        }

        return response()->json($data, 200);
    }

    // GET /vms/images
    public function listVmImages()
    {
        try {
            $data = $this->fetchVmImages();
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        foreach ($data as &$img) {
            unset($img['version'], $img['osType'], $img['architecture']);
        }

        return response()->json($data, 200);
    }

    // POST /vms/create
    public function createVm(Request $request)
    {
        $req = $request->all();
        if (empty($req['base_image'])) {
            return response()->json(['error' => 'base_image required'], 400);
        }

        $vm = $req['vm_name'] ?? ('vm-' . Str::random(8));
        $mac = $this->genMac($vm);
        $poolDir = '//';
        $baseImagePath = $poolDir . '/' . $req['base_image'];

        try {
            $guestOs = $this->detectOs($baseImagePath);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        $osVariant = $req['os_variant'] ?? ($guestOs === 'linux' ? 'ubuntu24.04' : 'win10');
        if ($guestOs === 'windows' && empty($req['admin_password'])) {
            return response()->json(['error' => 'Windows VM requires admin_password'], 400);
        }

        $tmpDir = sys_get_temp_dir() . '/' . $vm . '-ci-' . uniqid();
        mkdir($tmpDir, 0700, true);

        if ($guestOs === 'windows') {
            $userData = "#cloud-config\n"
                . "password: {$req['admin_password']}\n"
                . "username: Administrator\n"
                . "runcmd:\n"
                . "  - powershell -Command \"Set-ItemProperty -Path 'HKLM:\\System\\CCS\\Control\\Terminal Server' -Name fDenyTSConnections -Value 0\"\n"
                . "  - powershell -Command \"Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'\"\n"
                . "  - powershell -Command \"Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0\"\n"
                . "  - powershell -Command \"Start-Service sshd\"\n";
        } else {
            $lines = [
                '#cloud-config',
                "hostname: {$vm}",
                'users:',
                '  - default',
                '  - name: ubuntu',
                '    sudo: ALL=(ALL) NOPASSWD:ALL',
            ];
            if (!empty($req['ssh_key'])) {
                $lines[] = '    ssh_authorized_keys:';
                $lines[] = '      - ' . $req['ssh_key'];
            }
            if (!empty($req['admin_password'])) {
                $lines[] = 'chpasswd:';
                $lines[] = '  list: |';
                $lines[] = '    ubuntu:' . $req['admin_password'];
                $lines[] = '  expire: False';
                $lines[] = 'ssh_pwauth: True';
            }
            $lines = array_merge($lines, [
                'packages:',
                '  - openssh-server',
                '  - xrdp',
                '  - tigervnc-standalone-server',
                'runcmd:',
                '  - systemctl enable --now xrdp',
            ]);
            $userData = implode("\n", $lines);
        }

        file_put_contents("$tmpDir/user-data", $userData);
        file_put_contents("$tmpDir/meta-data", "instance-id: {$vm}\nlocal-hostname: {$vm}\n");
        file_put_contents("$tmpDir/network-config", "");

        $overlayPath = $poolDir . '/' . $vm . '.qcow2';
        $diskOpts = [
            "path=$overlayPath",
            'size=' . ($req['disk_gb'] ?? 20),
            'format=qcow2',
            "backing_store=$baseImagePath,backing_format=qcow2",
        ];

        $cmd = [
            'virt-install',
            '--import',
            '--quiet',
            '--name', $vm,
            '--memory', (string)($req['memory'] ?? 2048),
            '--vcpus', (string)($req['vcpus'] ?? 2),
            '--os-variant', $osVariant,
            '--graphics', 'vnc,listen=0.0.0.0,port=0',
            '--noautoconsole',
            '--wait', '0',
            '--disk', implode(',', $diskOpts),
            '--network', "bridge=br0,model=virtio,mac={$mac}",
            '--cloud-init', "user-data=$tmpDir/user-data,meta-data=$tmpDir/meta-data,network-config=$tmpDir/network-config,disable=on",
        ];

        try {
            $this->runCommand($cmd);
            $xml = $this->runVirsh('dumpxml', $vm);
            $vncPort = $this->parseVncPort($xml) ?? 5900;
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        return response()->json([
            'vm' => $vm,
            'mac' => $mac,
            'vnc_port' => $vncPort,
        ], 200);
    }

    // GET /vms/{vm_name}/guac
    public function getGuacInfo($vmName, Request $request)
    {
        $method = strtolower($request->query('method', 'ssh'));

        try {
            $xml = $this->runVirsh('dumpxml', $vmName);
            $vncPort = $this->parseVncPort($xml) ?? 5900;
        } catch (\Throwable $e) {
            $vncPort = 5900;
        }

        $ip = null;
        if ($method === 'vnc') {
            $ip = '127.0.0.1';
            try {
                $disp = trim($this->runVirsh('vncdisplay', $vmName));
                if (preg_match('/:([0-9]+)$/', $disp, $m)) {
                    $vncPort = 5900 + (int)$m[1];
                }
            } catch (\Throwable $e) {
            }
        } else {
            try {
                $addrOut = $this->runVirsh('domifaddr', $vmName, '--source', 'agent');
                $lines = array_slice(preg_split('/\n/', trim($addrOut)), 2);
                foreach ($lines as $l) {
                    $parts = preg_split('/\s+/', trim($l));
                    if (count($parts) >= 4) {
                        $ip = $parts[3];
                        break;
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        return response()->json([
            'host' => $ip ?? '192.168.200.10',
            'ssh_port' => 22,
            'rdp_port' => 3389,
            'vnc_port' => $vncPort,
        ], 200);
    }

    // GET /vms/{vm_id}
    public function getVmInfo($vmId)
    {
        try {
            $infoOut = $this->runVirsh('dominfo', $vmId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 404);
        }

        $host = trim($this->runCommand(['hostname']));
        $state = 'unknown';
        $vcpu = 0;
        $totalMb = 0;
        $usedMb = 0;
        $persistent = null;
        $autostart = null;
        foreach (preg_split('/\n/', trim($infoOut)) as $line) {
            if (str_starts_with($line, 'State:')) {
                $state = preg_split('/\s+/', $line)[1] ?? 'unknown';
            } elseif (str_starts_with($line, 'CPU(s):')) {
                $vcpu = (int)preg_split('/\s+/', $line)[1];
            } elseif (str_starts_with($line, 'Max memory:')) {
                $parts = preg_split('/\s+/', $line);
                $totalMb = (int)$parts[2] / 1024;
            } elseif (str_starts_with($line, 'Used memory:')) {
                $parts = preg_split('/\s+/', $line);
                $usedMb = (int)$parts[2] / 1024;
            } elseif (str_starts_with($line, 'Persistent:')) {
                $val = strtolower(preg_split('/\s+/', $line)[1] ?? 'no');
                $persistent = $val === 'yes';
            } elseif (str_starts_with($line, 'Autostart:')) {
                $val = strtolower(preg_split('/\s+/', $line)[1] ?? 'no');
                $autostart = in_array($val, ['enable', 'yes'], true);
            }
        }
        $vram = [
            'total_mb' => $totalMb,
            'usage_mb' => $usedMb,
            'usage_percent' => $totalMb ? ($usedMb / $totalMb * 100) : 0.0,
        ];
        $vcpuInfo = [
            'count' => $vcpu,
            'usage_percent' => 0.0,
        ];

        $ip = '';
        try {
            $addrOut = $this->runVirsh('domifaddr', $vmId, '--source', 'agent');
            foreach (array_slice(preg_split('/\n/', trim($addrOut)), 2) as $l) {
                $parts = preg_split('/\s+/', trim($l));
                if (count($parts) >= 4) {
                    $ip = $parts[3];
                    break;
                }
            }
        } catch (\Throwable $e) {
        }

        $osType = $this->detectVmOs($vmId);

        return response()->json([
            'status' => $state,
            'hostNode' => $host,
            'pool' => 'default',
            'vcpu' => $vcpuInfo,
            'vram' => $vram,
            'osType' => $osType,
            'persistent' => $persistent,
            'autostart' => $autostart,
            'uuid' => $vmId,
            'ipAddress' => $ip,
        ], 200);
    }

    // POST /vms/{vm_id}/actions/{action}
    public function manageVmLifecycle($vmId, $action)
    {
        $map = [
            'start' => 'start',
            'pause' => 'suspend',
            'resume' => 'resume',
            'shutdown' => 'shutdown',
            'reboot' => 'reboot',
            'force-off' => 'destroy',
        ];
        if (!isset($map[$action])) {
            return response()->json(['error' => '未知操作'], 400);
        }
        try {
            $this->runVirsh($map[$action], $vmId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        $target = in_array($action, ['start', 'resume', 'reboot'], true) ? 'running' : ($action === 'pause' ? 'paused' : 'shut off');
        $this->waitForState($vmId, $target);
        return response()->json([
            'message' => 'ok',
            'vm_id' => $vmId,
            'action' => $action,
            'state' => $target,
        ], 200);
    }

    // GET /vms/{vm_id}/snapshots
    public function listVmSnapshots($vmId)
    {
        try {
            $output = $this->runVirsh('snapshot-list', $vmId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        $lines = array_slice(preg_split('/\n/', trim($output)), 2);
        $snaps = [];
        foreach ($lines as $line) {
            if (!trim($line)) { continue; }
            $name = preg_split('/\s+/', trim($line))[0];
            try {
                $xml = $this->runVirsh('snapshot-dumpxml', $vmId, $name);
                $tree = new \SimpleXMLElement($xml);
                $ctime = (string)$tree->creationTime;
                $created = $ctime ? date('c', (int)$ctime) : date('c');
            } catch (\Throwable $e) {
                $created = date('c');
                $xml = '';
            }
            $snaps[] = [
                'id' => $name,
                'name' => $name,
                'created' => $created,
                'xml' => $xml,
            ];
        }
        return response()->json($snaps, 200);
    }

    // POST /vms/{vm_id}/snapshots
    public function createVmSnapshot($vmId, Request $request)
    {
        $data = $request->all();
        $name = $data['name'] ?? ('snap-' . Str::random(6));
        $args = ['snapshot-create-as', $vmId, $name];
        if (!empty($data['description'])) {
            $args[] = '--description';
            $args[] = $data['description'];
        }
        try {
            $this->runVirsh(...$args);
            $xml = $this->runVirsh('snapshot-dumpxml', $vmId, $name);
            $tree = new \SimpleXMLElement($xml);
            $ctime = (string)$tree->creationTime;
            $created = $ctime ? date('c', (int)$ctime) : date('c');
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json([
            'id' => $name,
            'name' => $name,
            'description' => $data['description'] ?? null,
            'created' => $created,
            'xml' => $xml,
        ], 200);
    }

    // POST /vms/{vm_id}/snapshots/{snapshot_id}/revert
    public function revertVmSnapshot($vmId, $snapshotId)
    {
        try {
            $this->runVirsh('snapshot-revert', $vmId, $snapshotId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json(['message' => 'reverted'], 200);
    }

    // DELETE /vms/{vm_id}/snapshots/{snapshot_id}
    public function deleteVmSnapshot($vmId, $snapshotId)
    {
        try {
            $this->runVirsh('snapshot-delete', $vmId, $snapshotId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json(null, 200);
    }

    // GET /vms/{vm_id}/storage/disks
    public function listVmDisks($vmId)
    {
        try {
            $output = $this->runVirsh('domblklist', $vmId, '--details');
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        $lines = array_slice(preg_split('/\n/', trim($output)), 2);
        $disks = [];
        foreach ($lines as $line) {
            $parts = preg_split('/\s+/', trim($line));
            if (count($parts) < 4 || $parts[1] !== 'disk') { continue; }
            $target = $parts[2];
            $path = $parts[3];
            try {
                $infoOut = $this->runVirsh('domblkinfo', $vmId, $target);
            } catch (\Throwable $e) {
                continue;
            }
            $capacity = 0; $alloc = 0; $fmt = '';
            foreach (preg_split('/\n/', trim($infoOut)) as $l) {
                if (str_starts_with($l, 'Capacity:')) {
                    $p = preg_split('/\s+/', $l);
                    if (count($p) >= 3) {
                        $capacity = $this->sizeToMb((float)$p[1], $p[2]) / 1024;
                    } elseif (count($p) >= 2) {
                        $capacity = (float)$p[1] / (1024*1024*1024);
                    }
                } elseif (str_starts_with($l, 'Allocation:')) {
                    $p = preg_split('/\s+/', $l);
                    if (count($p) >= 3) {
                        $alloc = $this->sizeToMb((float)$p[1], $p[2]) / 1024;
                    } elseif (count($p) >= 2) {
                        $alloc = (float)$p[1] / (1024*1024*1024);
                    }
                } elseif (str_starts_with($l, 'Format:')) {
                    $p = preg_split('/\s+/', $l);
                    if (count($p) >= 2) { $fmt = $p[1]; }
                }
            }
            $disks[] = [
                'id' => $target,
                'target' => $target,
                'source' => $path,
                'format' => $fmt,
                'bus' => 'virtio',
                'capacity_gb' => (int)$capacity,
                'allocated_gb' => (int)$alloc,
            ];
        }
        return response()->json($disks, 200);
    }

    // GET /vms/{vm_id}/storage/cdroms
    public function listVmCdroms($vmId)
    {
        try {
            $xml = $this->runVirsh('dumpxml', $vmId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        $root = new \SimpleXMLElement($xml);
        $cds = [];
        foreach ($root->xpath('.//devices/disk[@device="cdrom"]') as $disk) {
            $target = (string)$disk->target['dev'];
            $source = $disk->source ? (string)$disk->source['file'] : null;
            $mounted = $source !== null;
            $cds[] = [
                'id' => $target,
                'target' => $target,
                'source_iso' => $source,
                'mounted' => $mounted,
            ];
        }
        return response()->json($cds, 200);
    }

    // GET /vms/{vm_id}/network/vnics
    public function listVmVnics($vmId)
    {
        try {
            $xml = $this->runVirsh('dumpxml', $vmId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        $root = new \SimpleXMLElement($xml);
        $nics = [];
        foreach ($root->xpath('.//devices/interface') as $iface) {
            $mac = (string)$iface->mac['address'];
            $bridge = $iface->source ? (string)$iface->source['bridge'] : '';
            $model = $iface->model ? (string)$iface->model['type'] : '';
            $targetElem = $iface->target;
            $target = $targetElem ? (string)$targetElem['dev'] : null;
            $rx = 0; $tx = 0;
            if ($target) {
                try {
                    $stat = $this->runVirsh('domifstat', $vmId, $target);
                    foreach (preg_split('/\n/', trim($stat)) as $l) {
                        if (str_starts_with($l, 'rx_bytes')) { $rx = (int)preg_split('/\s+/', $l)[1]; }
                        if (str_starts_with($l, 'tx_bytes')) { $tx = (int)preg_split('/\s+/', $l)[1]; }
                    }
                } catch (\Throwable $e) {
                }
            }
            $nics[] = [
                'id' => str_replace(':', '', $mac),
                'mac' => $mac,
                'bridge' => $bridge,
                'model' => $model,
                'pciAddress' => null,
                'rx_rate_kbps' => (int)($rx / 1024),
                'tx_rate_kbps' => (int)($tx / 1024),
                'status' => 'active',
            ];
        }
        return response()->json($nics, 200);
    }

    // GET /vms/{vm_id}/metrics
    public function getVmRealtimeMetrics($vmId)
    {
        try {
            $memOut = $this->runVirsh('dommemstat', $vmId);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        $rssKb = 0;
        foreach (preg_split('/\n/', trim($memOut)) as $line) {
            if (str_starts_with($line, 'rss')) {
                $rssKb = (int)preg_split('/\s+/', $line)[1];
                break;
            }
        }
        $memMb = (int)($rssKb / 1024);
        return response()->json([
            'cpu_percent' => 0.0,
            'memory_mb' => $memMb,
            'memory_percent' => 0.0,
            'disk_rw_mb_s' => 0.0,
            'network_mbps' => 0.0,
        ], 200);
    }

    // GET /vms/{vm_id}/events
    public function listVmEvents($vmId)
    {
        return response()->json([], 200);
    }

    // DELETE /vms/{vm_id}
    public function deleteVm($vmId)
    {
        try {
            try { $this->runVirsh('destroy', $vmId); } catch (\Throwable $e) {}
            $this->runVirsh('undefine', $vmId, '--remove-all-storage', '--snapshots-metadata');
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json(['message' => 'deleted'], 200);
    }
}
