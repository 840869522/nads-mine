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
 * 根据场景实例ID获取其下的所有虚拟机实例。
 *
 * @param string $instance_id 场景实例的UUID
 * @return \Illuminate\Http\JsonResponse
 */
public function listVmsBySceneInstance(string $instance_id)
{
    // 1. 从虚拟化平台获取所有VM的实时状态
    try {
        $allVmsFromHypervisor = $this->fetchVmInstances();
        // 如果返回的不是数组，或获取失败，返回空列表
        if (!is_array($allVmsFromHypervisor)) {
            Log::error('fetchVmInstances did not return an array for instance ' . $instance_id);
            return response()->json([]);
        }
    } catch (\Throwable $e) {
        Log::error('Failed to fetch VM instances from hypervisor for instance ' . $instance_id . ': ' . $e->getMessage());
        return response()->json(['error' => '无法从虚拟化平台获取虚拟机列表: ' . $e->getMessage()], 500);
    }

    // 2. 从数据库查询与该场景实例ID关联的虚拟机的详细信息
    try {
        $vmDetailsFromDb = DB::table('c_scene_vm_instances as v')
            ->leftJoin('c_scene_instances as si', DB::raw('v.c_scene_instances_id COLLATE utf8mb4_unicode_ci'), '=', 'si.c_scene_instances_id')
            ->leftJoin('c_scene_configs as sc', 'si.c_config_id', '=', 'sc.c_config_id')
            ->select(
                'v.c_vm_name',
                'v.c_scene_instances_id',
                'v.c_ip',
                'v.c_flag', // ★★★ 1. 查询 c_flag 字段 ★★★
                'sc.c_name as scene_name'
            )
            // 核心筛选条件：只选择属于特定场景实例的VM
            ->where('v.c_scene_instances_id', $instance_id)
            ->get()
            // 使用VM名称作为Key，方便后续快速查找
            ->keyBy('c_vm_name');

    } catch (\Throwable $e) {
        Log::error('Database query for scene VMs failed for instance ' . $instance_id . ': ' . $e->getMessage());
        return response()->json(['error' => '数据库查询失败: ' . $e->getMessage()], 500);
    }

    // 3. 过滤并合并数据
    $resultVms = [];
    // 遍历从虚拟化平台获取的所有VM
    foreach ($allVmsFromHypervisor as $vm) {
        // 检查这个VM是否存在于我们从数据库查出的该场景的VM列表中
        if (isset($vmDetailsFromDb[$vm['name']])) {
            $dbInfo = $vmDetailsFromDb[$vm['name']];

            // 合并数据库信息到VM实时状态数据中
            $vm['scene_instance_id'] = $dbInfo->c_scene_instances_id;
            $vm['scene_name']        = $dbInfo->scene_name;
            $vm['ip']                = $dbInfo->c_ip;
            // ★★★ 2. 根据 c_flag 是否为空来设置 is_target ★★★
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

        // 1) 拿 pool 路径 & 类型（一次 virsh）
        $poolPath = '';
        $poolType = '';
        try {
            $poolXml = $this->runVirsh('pool-dumpxml', 'default');
            $poolRoot = new \SimpleXMLElement($poolXml);
            $poolPath = (string)($poolRoot->xpath('.//target/path')[0] ?? '');
            $poolType = (string)($poolRoot->xpath('string(/pool/@type)') ?: '');
        } catch (\RuntimeException $e) {
            // 如果连 pool 信息都拿不到，直接空返回
            return $images;
        }

        // 2) 优先：dir pool 直接扫目录（最快）
        if ($poolPath && is_dir($poolPath) && is_readable($poolPath) && ($poolType === '' || $poolType === 'dir')) {
            $it = new \FilesystemIterator(
                $poolPath,
                \FilesystemIterator::SKIP_DOTS | \FilesystemIterator::CURRENT_AS_FILEINFO
            );

            foreach ($it as $fi) {
                /** @var \SplFileInfo $fi */
                // 仅处理普通文件；隐藏/临时文件自己按需调整
                if (!$fi->isFile()) { continue; }

                $vol  = $fi->getFilename();
                $path = $fi->getPathname();

                // 这些信息在底层已缓存，基本不触发额外子进程
                $sizeBytes  = $fi->getSize();
                $mtime      = $fi->getMTime();

                $images[] = [
                    'id'           => $vol,
                    'name'         => $vol,
                    'pool'         => 'default',
                    'size'         => (int)ceil($sizeBytes / 1048576) . 'M',
                    'path'         => $path,
                    'modifiedDate' => $mtime ? date('c', $mtime) : null,
                    'status'       => '可用',
                ];
            }

            return $images;
        }

        // 3) 非 dir pool 或目录不可读时：一次 virsh --details（无逐卷命令）
        try {
            $cmd = ['virsh', '-r', '-q', 'vol-list', '--pool', 'default', '--details'];
            $output = $this->runCommand($cmd);
        } catch (\RuntimeException $e) {
            return $images;
        }

        $lines = explode("\n", trim($output));
        if (count($lines) <= 2) {
            return $images;
        }

        // 跳过表头两行
        $dataLines = array_slice($lines, 2);

        foreach ($dataLines as $line) {
            $line = rtrim($line);
            if ($line === '' || $line[0] === '-') { continue; }

            // virsh --details 通常是固定列宽，用 2+ 空格分割最稳
            // 列顺序一般为：Name  Path  Type  Capacity  Allocation
            $cols = preg_split('/\s{2,}/', $line);
            if (!$cols || count($cols) < 2) { continue; }

            // 尽量容错：从右往左拿 Capacity/Allocation；最左是 Name；中间合并为 Path
            $name = $cols[0];
            $capacityStr   = null;
            $allocationStr = null;

            if (count($cols) >= 5) {
                $allocationStr = $cols[count($cols) - 1];
                $capacityStr   = $cols[count($cols) - 2];
                // $type = $cols[count($cols) - 3]; // 若需要可取
                $pathParts     = array_slice($cols, 1, count($cols) - 4);
                $path          = implode('  ', $pathParts); // 保留单空格的情况
            } else {
                // 某些版本只输出 Name/Path
                $path = $cols[1];
            }

            // 用 Capacity 为主（更快且不触发 I/O）；没有就留空
            $bytes = $capacityStr ? $this->parseVirshSizeToBytes($capacityStr) : null;

            $images[] = [
                'id'           => $name,
                'name'         => $name,
                'pool'         => 'default',
                'size'         => $bytes !== null ? (int)ceil($bytes / 1048576) . 'M' : null,
                'path'         => isset($path) ? $path : null,
                'modifiedDate' => null, // 不做逐卷 I/O，保持极速
                'status'       => 'available',
            ];
        }

        return $images;
    }

    /**
     * 把 virsh 的容量字符串（如 "10.00 GiB" / "512.0 MiB" / "0.00 B"）转成字节数
     */
    private function parseVirshSizeToBytes(string $s): ?int
    {
        $s = trim($s);
        if ($s === '' || $s === '-') { return null; }

        if (!preg_match('/^\s*([\d.]+)\s*([KMGTPE]?i?B)\s*$/i', $s, $m)) {
            // 有些环境可能直接给字节数字符串
            if (ctype_digit($s)) { return (int)$s; }
            return null;
        }
        $num  = (float)$m[1];
        $unit = strtoupper($m[2]);

        $map = [
            'B'   => 1,
            'KIB' => 1024,
            'MIB' => 1024**2,
            'GIB' => 1024**3,
            'TIB' => 1024**4,
            'PIB' => 1024**5,
            // 兼容如果某些发行版返回十进制单位（很少见）
            'KB'  => 1000,
            'MB'  => 1000**2,
            'GB'  => 1000**3,
            'TB'  => 1000**4,
            'PB'  => 1000**5,
        ];

        $mul = $map[$unit] ?? 1;
        // 防止极大值溢出，用 round
        return (int)round($num * $mul);
    }



    private function fetchVmImagePaths(): array
    {
        $images = [];
        try {
            $poolXml = $this->runVirsh('pool-dumpxml', 'default');
        } catch (\RuntimeException $e) {
            return $images;
        }
        $poolRoot = new \SimpleXMLElement($poolXml);
        $poolPath = (string)($poolRoot->xpath('.//target/path')[0] ?? '');

        try {
            $output = $this->runVirsh('vol-list', 'default');
        } catch (\RuntimeException $e) {
            return $images;
        }

        $lines = array_slice(preg_split('/\n/', trim($output)), 2);
        foreach ($lines as $line) {
            if (!trim($line)) { continue; }
            $parts = preg_split('/\s+/', trim($line));
            if (count($parts) < 1) { continue; }
            $vol = $parts[0];
            $path = $parts[1] ?? rtrim($poolPath, '/') . '/' . $vol;
            $images[] = [
                'name' => $vol,
                'path' => $path,
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
                        // 'v.c_flag',
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
                // $vm['is_target'] = !empty($info->c_flag ?? null);
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

    // GET /vms/image-options
    public function listVmImageOptions()
    {
        try {
            $data = $this->fetchVmImagePaths();
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
        return response()->json($data, 200);
    }

    // POST /vms/create
    public function createVm(Request $request)
    {
        $req = $request->all();
        $image = $req['image'] ?? $req['base_image'] ?? null;
        if (empty($image)) {
            return response()->json(['error' => 'image required'], 400);
        }

        $vmName = $req['vm_name'] ?? ('vm-' . Str::random(8));
        $ip = $req['ip'] ?? null;
        $isTarget = !empty($req['is_target']);
        $flag = $isTarget ? 'flag{' . Str::uuid()->toString() . '}' : null;

        try {
            $vm = SceneVmInstance::create([
                'c_vm_name' => $vmName,
                'c_scene_instances_id' => 'standalone',
                'c_ip' => $ip,
                'c_flag' => $flag,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to create VM record: ' . $e->getMessage());
            return response()->json(['error' => 'database error'], 500);
        }

        $baseDir = $this->_get_global_directory();
        $imageDir = $baseDir . '/virsh/images';
        $instanceBaseDir = $baseDir . '/virsh/instances';

        try {
            $this->cliService->createVm([
                'id' => $vm->c_vm_id,
                'vm_name' => $vmName,
                'image' => $image,
                'ip' => $ip,
                'scene_instance_id' => 'standalone',
                'flag' => $flag ?? 'NULL',
                'switch_name' => 'ovs-network',
                'image_dir' => $imageDir,
                'instance_base_dir' => $instanceBaseDir,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to create VM via CLI: ' . $e->getMessage());
            return response()->json(['error' => 'vm creation failed'], 500);
        }

        return response()->json([
            'vm_id' => $vm->c_vm_id,
            'vm_name' => $vmName,
            'flag' => $flag,
        ], 200);
    }

    // GET /vms/{vm_name}/guac
    public function getGuacInfo($vmName, Request $request)
    {
        $method = strtolower($request->query('method', 'ssh'));
        $vmQueryName = $request->query('vm_name', $vmName);

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
                $record = DB::table('c_scene_vm_instances')
                    ->where('c_vm_name', $vmQueryName)
                    ->first();
                if ($record && $record->c_ip) {
                    $ip = explode('/', $record->c_ip)[0];
                }
            } catch (\Throwable $e) {
                Log::error('Failed to fetch VM IP from DB: ' . $e->getMessage());
            }
        }

        return response()->json([
            'host' => $ip ?? '无效',
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

        $image = null;
        $osType = null;
        try {
            $xml = $this->runVirsh('dumpxml', $vmId);
            $root = new \SimpleXMLElement($xml);
            $source = $root->xpath('.//devices/disk[@device="disk"]/source')[0] ?? null;
            if ($source) {
                $image = (string)($source['file'] ?? $source['dev']);
                if ($image) {
                    try {
                        //$osType = ucfirst($this->detectOs($image));
                        $osType = null;
                    } catch (\Exception $e) {
                        $osType = null;
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        // $flag = null;
        // try {
        //     $flag = DB::table('c_scene_vm_instances')
        //         ->where('c_vm_name', $vmId)
        //         ->value('c_flag');
        // } catch (\Throwable $e) {
        //     $flag = null;
        // }

        return response()->json([
            'status' => $state,
            'hostNode' => $host,
            'pool' => 'default',
            'vcpu' => $vcpuInfo,
            'vram' => $vram,
            'osType' => $osType,
            'image' => $image,
            'persistent' => $persistent,
            'autostart' => $autostart,
            'uuid' => $vmId,
            'ipAddress' => $ip,
            // 'is_target' => !empty($flag),
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
                $desc = (string)($tree->description ?? '');
                $parent = (string)($tree->parent->name ?? '');
            } catch (\Throwable $e) {
                $created = date('c');
                $xml = '';
                $desc = '';
                $parent = '';
            }
            $snaps[] = [
                'id' => $name,
                'name' => $name,
                'description' => $desc !== '' ? $desc : null,
                'parentId' => $parent !== '' ? $parent : null,
                'created' => $created,
                'size_mb' => 0,
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
        $desc = $data['description'] ?? (string)($tree->description ?? '');
        $parent = (string)($tree->parent->name ?? '');
        return response()->json([
            'id' => $name,
            'name' => $name,
            'description' => $desc !== '' ? $desc : null,
            'parentId' => $parent !== '' ? $parent : null,
            'created' => $created,
            'size_mb' => 0,
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
    public function deleteVm(Request $request, $vmId)
    {
        try {
            try { $this->runVirsh('destroy', $vmId); } catch (\Throwable $e) {}
            $this->runVirsh('undefine', $vmId, '--remove-all-storage', '--snapshots-metadata');
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }

        $domain = $request->input('domain_name');
        if ($domain) {
            try {
                SceneVmInstance::where('c_vm_name', $domain)->delete();
            } catch (\Throwable $e) {
                Log::error('Failed to delete VM record: ' . $e->getMessage(), ['domain' => $domain]);
            }
        }

        return response()->json(['message' => 'deleted'], 200);
    }
}
