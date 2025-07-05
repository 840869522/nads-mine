<?php
namespace App\Http\Controllers\Vm;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class VmController extends Controller
{
    private function runVirsh(...$args)
    {
        $cmd = 'virsh -c qemu:///system ' . implode(' ', array_map('escapeshellarg', $args)) . ' 2>&1';
        exec($cmd, $out, $code);
        $output = implode("\n", $out);
        if ($code !== 0) {
            throw new \RuntimeException(trim($output));
        }
        return $output;
    }

    private function sizeToMb(float $size, string $unit): float
    {
        $unit = strtolower($unit);
        if (str_starts_with($unit, 'g')) return $size * 1024;
        if (str_starts_with($unit, 'k')) return $size / 1024;
        return $size;
    }

    private function getImageMetadata(string $path): array
    {
        $meta = ['version'=>null,'osType'=>null,'architecture'=>null];
        $proc = [];
        exec('virt-inspector --no-applications --no-icon -a '.escapeshellarg($path).' 2>/dev/null', $proc, $code);
        if ($code !== 0) return $meta;
        $xml = implode("\n", $proc);
        $root = simplexml_load_string($xml);
        if (!$root) return $meta;
        $os = $root->xpath('.//operatingsystem')[0] ?? null;
        if (!$os) return $meta;
        $meta['architecture'] = (string)($os->arch ?? '');
        $meta['osType'] = (string)($os->{'os_type'} ?? $os->{'os-type'} ?? $os->name ?? '');
        $distro = (string)($os->distro ?? $os->name ?? '');
        $major = (string)($os->{'major_version'} ?? $os->{'major-version'} ?? '');
        $minor = (string)($os->{'minor_version'} ?? $os->{'minor-version'} ?? '');
        if ($distro) {
            if ($major && $minor) $meta['version'] = "$distro $major.$minor";
            else $meta['version'] = (string)($os->product_name ?? $distro);
        }
        return $meta;
    }

    private function fetchVmInstances(): array
    {
        $host = trim(shell_exec('hostname'));
        $out = $this->runVirsh('list','--all');
        $lines = array_slice(preg_split("/\r?\n/", trim($out)),2);
        $list = [];
        foreach ($lines as $line) {
            if (!trim($line)) continue;
            $parts = preg_split('/\s+/', $line);
            if (count($parts) < 3) continue;
            $name = $parts[1];
            $state = implode(' ', array_slice($parts,2));
            try {
                $uuid = trim($this->runVirsh('domuuid',$name));
                $info = $this->runVirsh('dominfo',$name);
            } catch (\Throwable $e) { continue; }
            $vcpu = 0; $mem = 0;
            foreach (preg_split("/\r?\n/", $info) as $l) {
                if (str_starts_with($l,'CPU(s):')) $vcpu = (int)trim(explode(':',$l)[1]);
                if (preg_match('/memory:/i',$l)) {
                    $partsL = preg_split('/\s+/', $l);
                    $mem = isset($partsL[2])? (int)$partsL[2]:(int)$partsL[1];
                }
            }
            $list[] = [
                'id'=>$uuid,
                'name'=>$name,
                'hostNode'=>$host,
                'pool'=>'default',
                'state'=>$state,
                'vcpu'=>$vcpu,
                'vmem'=>(int)($mem/1024),
                'ip'=>null,
            ];
        }
        return $list;
    }

    private function fetchVmImages(): array
    {
        $images = [];
        try { $out = $this->runVirsh('vol-list','default'); }
        catch (\Throwable $e) { return $images; }
        $lines = array_slice(preg_split('/\r?\n/', trim($out)),2);
        foreach ($lines as $line) {
            if (!trim($line)) continue;
            $parts = preg_split('/\s+/', $line);
            if (count($parts) < 2) continue;
            $vol = $parts[0];
            $path = $parts[1];
            try { $info = $this->runVirsh('vol-info',$vol,'--pool','default'); }
            catch (\Throwable $e) { continue; }
            $sizeMb = 0.0;
            foreach (preg_split('/\r?\n/',$info) as $l) {
                if (str_starts_with($l,'Capacity:')) {
                    [$label,$val,$unit] = array_slice(preg_split('/\s+/',$l),0,3);
                    $sizeMb = $this->sizeToMb((float)$val,$unit);
                    break;
                }
            }
            $upload = null;
            if (file_exists($path)) {
                $upload = date('c', filemtime($path));
            }
            $meta = $this->getImageMetadata($path);
            $images[] = [
                'id'=>$vol,
                'name'=>$vol,
                'pool'=>'default',
                'size'=>sprintf('%.1f MB',$sizeMb),
                'path'=>$path,
                'uploadDate'=>$upload,
                'status'=>'available',
                'version'=>$meta['version'],
                'osType'=>$meta['osType'],
                'architecture'=>$meta['architecture']
            ];
        }
        return $images;
    }

    private function detectOs(string $imgPath): string
    {
        exec('virt-inspector -a '.escapeshellarg($imgPath).' 2>&1',$out,$code);
        if ($code!==0) throw new \RuntimeException('Cannot detect guest OS');
        $txt = strtolower(implode("\n",$out));
        if (str_contains($txt,'windows')) return 'windows';
        if (str_contains($txt,'linux')) return 'linux';
        throw new \RuntimeException('Cannot detect guest OS');
    }

    private function genMac(string $seed): string
    {
        $h = sha1($seed,true);
        $bytes = substr($h,0,5);
        return '02:'.implode(':', array_map(fn($b)=>sprintf('%02x', ord($b)) , str_split($bytes)));
    }

    private function parseVncPort(string $xml): ?int
    {
        if (preg_match("/<graphics[^>]*type='vnc'[^>]*port='(\d+)'/", $xml, $m)) {
            return (int)$m[1];
        }
        return null;
    }

    private function guacLogin(string $url,string $user,string $pass): array
    {
        $resp = Http::asForm()->post("{$url}/api/tokens",['username'=>$user,'password'=>$pass]);
        if (!$resp->ok()) throw new \RuntimeException('Guacamole auth failed');
        $data = $resp->json();
        return [$data['authToken'],$data['dataSource']];
    }

    private function guacCreateConn(string $url,string $token,string $ds,string $name,string $proto,array $params,string $parent=null)
    {
        $body=[
            'name'=>$name,
            'protocol'=>$proto,
            'parameters'=>$params,
            'attributes'=>['max-connections'=>'5','max-connections-per-user'=>'2'],
        ];
        $resp = Http::withHeaders(['Content-Type'=>'application/json'])
            ->post("{$url}/api/session/data/{$ds}/connections",$body,[ 'token'=>$token ]);
        if (!$resp->ok()) throw new \RuntimeException('create connection failed');
        $connId = $resp->json();
        if ($parent && $parent !== 'ROOT') {
            Http::post("{$url}/api/session/data/{$ds}/connectionGroups/{$parent}/connections/{$connId}",['token'=>$token]);
        }
        return $connId;
    }

    private function guacFindConn(string $url,string $token,string $ds,string $name): ?string
    {
        $resp = Http::get("{$url}/api/session/data/{$ds}/connections",['token'=>$token]);
        if (!$resp->ok()) return null;
        foreach ($resp->json() as $cid=>$info) {
            if (($info['name'] ?? '') === $name) return $cid;
        }
        return null;
    }

    private function waitForState(string $name,string $target,int $timeout=30): bool
    {
        $end = time()+$timeout;
        while (time() < $end) {
            try {
                $state = trim($this->runVirsh('domstate',$name));
                if ($state === $target) return true;
            } catch (\Throwable $e) {}
            sleep(1);
        }
        return false;
    }

    /* ---------- PUBLIC ENDPOINTS ---------- */
    public function index()
    {
        return response()->json($this->fetchVmInstances());
    }

    public function images()
    {
        return response()->json($this->fetchVmImages());
    }

    public function create(Request $request)
    {
        $req = $request->all();
        $vm = $req['vm_name'] ?? ('vm-' . substr(str_replace('-','',uniqid()),0,8));
        $mac = $this->genMac($vm);
        $guest = $this->detectOs($req['base_image']);
        $overlay = "/var/lib/libvirt/images/{$vm}.qcow2";
        exec('qemu-img create -f qcow2 -F qcow2 -o '.escapeshellarg('backing_file='.$req['base_image']).' '.escapeshellarg($overlay).' '.escapeshellarg($req['disk_gb'].'G'),$o,$c);
        if ($c!==0) throw new \RuntimeException('qemu-img failed');
        $tmp = sys_get_temp_dir().'/'.$vm.'-ci-'.uniqid();
        mkdir($tmp);
        try {
            if ($guest==='linux') {
                $udata = "#cloud-config\nhostname: {$vm}\nusers:\n  - default\n  - name: ubuntu\n    sudo: ALL=(ALL) NOPASSWD:ALL\n    ssh_authorized_keys:\n      - ".$req['ssh_key'];
            } else {
                if (empty($req['admin_password'])) return response()->json(['detail'=>'Windows VM requires admin_password'],422);
                $udata = "#cloud-config\npassword: {$req['admin_password']}\nusername: Administrator\nruncmd:\n  - powershell -Command \"Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name fDenyTSConnections -Value 0\"\n  - powershell -Command \"Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'\"";
            }
            file_put_contents("$tmp/user-data", $udata);
            file_put_contents("$tmp/meta-data", "instance-id: {$vm}\nlocal-hostname: {$vm}\n");
            touch("$tmp/network-config");
            $ciParam = 'user-data='.$tmp.'/user-data,'.'meta-data='.$tmp.'/meta-data,'.'network-config='.$tmp.'/network-config,disable=on';
            $diskRoot = "path={$overlay},format=qcow2,bus=virtio,backing_file={$req['base_image']}";
            $networkArg = "user,model=virtio,mac={$mac},hostfwd=tcp::2222-:22,hostfwd=tcp::33389-:3389";
            $cmd = [
                'virt-install','--import','--quiet','--name',$vm,'--memory',(string)$req['memory'],'--vcpus',(string)$req['vcpus'],'--os-variant',$guest==='linux'?'ubuntu24.04':'win10','--graphics','vnc,listen=0.0.0.0','--noautoconsole','--wait','0','--disk',$diskRoot,'--network',$networkArg,'--cloud-init',$ciParam
            ];
            if ($guest==='windows') {
                array_push($cmd,'--disk','path=/usr/share/virtio-win/virtio-win.iso,device=cdrom,readonly=on,bus=sata');
            }
            exec(implode(' ',array_map('escapeshellarg',$cmd)) . ' 2>&1',$out,$code);
            if ($code!==0) throw new \RuntimeException('virt-install failed: '.implode("\n",$out));
        } finally {
            exec('rm -rf '.escapeshellarg($tmp));
        }
        try {
            $xml = $this->runVirsh('dumpxml',$vm);
            $vnc = $this->parseVncPort($xml) ?? 5900;
        } catch (\Throwable $e) { $vnc = 5900; }
        try {
            [$token,$ds] = $this->guacLogin($req['guacamole']['url'],$req['guacamole']['username'],$req['guacamole']['password']);
            if ($guest==='linux') {
                $this->guacCreateConn($req['guacamole']['url'],$token,$ds,$vm.'-ssh','ssh',['hostname'=>'hypervisor','port'=>'2222','username'=>'ubuntu'],$req['guacamole']['folder_id']);
            } else {
                $this->guacCreateConn($req['guacamole']['url'],$token,$ds,$vm.'-rdp','rdp',['hostname'=>'hypervisor','port'=>'33389','security'=>'nla'],$req['guacamole']['folder_id']);
            }
            $this->guacCreateConn($req['guacamole']['url'],$token,$ds,$vm.'-vnc','vnc',['hostname'=>'hypervisor','port'=>(string)$vnc],$req['guacamole']['folder_id']);
        } catch (\Throwable $e) {
            return response()->json(['vm'=>$vm,'mac'=>$mac,'vnc_port'=>$vnc,'guac_warning'=>$e->getMessage()]);
        }
        return response()->json(['vm'=>$vm,'mac'=>$mac,'vnc_port'=>$vnc,'guac_connections'=>'created']);
    }

    public function guac(Request $request,string $vmName)
    {
        $url = $request->query('url');
        $user = $request->query('username');
        $pass = $request->query('password');
        [$token,$ds] = $this->guacLogin($url,$user,$pass);
        $conns = [];
        foreach (['ssh','rdp','vnc'] as $p) {
            $cid = $this->guacFindConn($url,$token,$ds,"{$vmName}-{$p}");
            if ($cid) $conns[$p] = $cid;
        }
        return response()->json(['token'=>$token,'ds'=>$ds,'connections'=>$conns]);
    }

    public function info(string $vmId)
    {
        try { $info = $this->runVirsh('dominfo',$vmId); }
        catch (\Throwable $e) { return response()->json(['detail'=>$e->getMessage()],404); }
        $host = trim(shell_exec('hostname'));
        $state='unknown';$vcpu=0;$total=0;$used=0;
        foreach (preg_split('/\r?\n/',$info) as $l) {
            if (str_starts_with($l,'State:')) $state = trim(explode(':',$l)[1]);
            elseif (str_starts_with($l,'CPU(s):')) $vcpu=(int)trim(explode(':',$l)[1]);
            elseif (str_starts_with($l,'Max memory:')) $total=(int)trim(explode(' ',trim($l))[2])/1024;
            elseif (str_starts_with($l,'Used memory:')) $used=(int)trim(explode(' ',trim($l))[2])/1024;
        }
        $vram=['total_mb'=>$total,'usage_mb'=>$used,'usage_percent'=>$total?($used/$total*100):0];
        $vcpuInfo=['count'=>$vcpu,'usage_percent'=>0.0];
        $ip=null;
        try {
            $addr = $this->runVirsh('domifaddr',$vmId,'--source','agent');
            foreach (array_slice(preg_split('/\r?\n/',$addr),2) as $l) {
                $parts = preg_split('/\s+/',trim($l));
                if (count($parts)>=4) { $ip=$parts[3]; break; }
            }
        } catch(\Throwable $e){}
        $data=[
            'status'=>$state,
            'uptime'=>'0',
            'hostNode'=>$host,
            'pool'=>'default',
            'vcpu'=>$vcpuInfo,
            'vram'=>$vram,
            'bootSource'=>'disk',
            'uuid'=>$vmId,
            'ipAddress'=>$ip ?: '',
            'disks_rw_mbps'=>0.0,
            'network_throughput_mbps'=>0.0
        ];
        return response()->json($data);
    }

    public function lifecycle(string $vmId,string $action)
    {
        $map=['start'=>'start','pause'=>'suspend','resume'=>'resume','shutdown'=>'shutdown','reboot'=>'reboot','force-off'=>'destroy'];
        if (!isset($map[$action])) return response()->json(['detail'=>'未知操作'],400);
        try { $this->runVirsh($map[$action],$vmId); }
        catch(\Throwable $e){ return response()->json(['detail'=>$e->getMessage()],500); }
        $target = in_array($action,['start','resume','reboot']) ? 'running' : ($action==='pause'?'paused':'shut off');
        $this->waitForState($vmId,$target);
        return response()->json(['message'=>'ok','vm_id'=>$vmId,'action'=>$action,'state'=>$target]);
    }

    public function snapshots(string $vmId)
    {
        $snaps=[];
        try { $out=$this->runVirsh('snapshot-list',$vmId); } catch(\Throwable $e){ return response()->json([],500); }
        $lines=array_slice(preg_split('/\r?\n/',trim($out)),2);
        foreach ($lines as $line) {
            if(!trim($line)) continue;
            $name=strtok($line,' ');
            $xml=$this->runVirsh('snapshot-dumpxml',$vmId,$name);
            $s=simplexml_load_string($xml);
            $ctime=(string)($s->creationTime??'');
            $created=$ctime?date('c',(int)$ctime):date('c');
            $snaps[]=['id'=>$name,'name'=>$name,'description'=>null,'created'=>$created,'parentId'=>null,'size_mb'=>0,'xml'=>$xml];
        }
        return response()->json($snaps);
    }

    public function createSnapshot(Request $r,string $vmId)
    {
        $name=$r->input('name');
        $desc=$r->input('description');
        $args=['snapshot-create-as',$vmId,$name];
        if($desc) array_push($args,'--description',$desc);
        try { $this->runVirsh(...$args); $xml=$this->runVirsh('snapshot-dumpxml',$vmId,$name); }
        catch(\Throwable $e){ return response()->json(['detail'=>$e->getMessage()],500); }
        $s=simplexml_load_string($xml); $ctime=(string)($s->creationTime??'');
        $created=$ctime?date('c',(int)$ctime):date('c');
        return response()->json(['id'=>$name,'name'=>$name,'description'=>$desc,'created'=>$created,'xml'=>$xml]);
    }

    public function revertSnapshot(string $vmId,string $snapshotId)
    {
        try { $this->runVirsh('snapshot-revert',$vmId,$snapshotId); }
        catch(\Throwable $e){ return response()->json(['detail'=>$e->getMessage()],500); }
        return response()->json(['message'=>'reverted']);
    }

    public function deleteSnapshot(string $vmId,string $snapshotId)
    {
        try { $this->runVirsh('snapshot-delete',$vmId,$snapshotId); }
        catch(\Throwable $e){ return response()->json(['detail'=>$e->getMessage()],500); }
        return response()->json(null);
    }

    public function disks(string $vmId)
    {
        $disks=[];
        try { $out=$this->runVirsh('domblklist',$vmId,'--details'); } catch(\Throwable $e){ return response()->json([],500); }
        $lines=array_slice(preg_split('/\r?\n/',trim($out)),2);
        foreach($lines as $line){
            $parts=preg_split('/\s+/',$line);
            if(count($parts)<4||$parts[1]!=='disk') continue;
            $target=$parts[2];$path=$parts[3];
            try { $info=$this->runVirsh('domblkinfo',$vmId,$target); } catch(\Throwable $e){ continue; }
            $cap=0;$alloc=0;
            foreach(preg_split('/\r?\n/',$info) as $l){
                if(str_starts_with($l,'Capacity:')){ [$label,$val,$unit]=array_slice(preg_split('/\s+/',$l),0,3); $cap=$this->sizeToMb((float)$val,$unit)/1024; }
                elseif(str_starts_with($l,'Allocation:')){ [$label,$val,$unit]=array_slice(preg_split('/\s+/',$l),0,3); $alloc=$this->sizeToMb((float)$val,$unit)/1024; }
            }
            $disks[]=['id'=>$target,'target'=>$target,'source'=>$path,'format'=>'','bus'=>'virtio','capacity_gb'=>(int)$cap,'allocated_gb'=>(int)$alloc];
        }
        return response()->json($disks);
    }

    public function cdroms(string $vmId)
    {
        try { $xml=$this->runVirsh('dumpxml',$vmId); } catch(\Throwable $e){ return response()->json([],500); }
        $tree=simplexml_load_string($xml); $cds=[];
        foreach($tree->xpath('.//devices/disk[@device="cdrom"]') as $disk){
            $target=(string)$disk->target['dev'];
            $source=$disk->source['file']??null; $mounted= $source?true:false;
            $cds[]=['id'=>$target,'target'=>$target,'source_iso'=>$source? (string)$source : null,'mounted'=>$mounted];
        }
        return response()->json($cds);
    }

    public function vnics(string $vmId)
    {
        try { $xml=$this->runVirsh('dumpxml',$vmId); } catch(\Throwable $e){ return response()->json([],500); }
        $tree=simplexml_load_string($xml); $nics=[];
        foreach($tree->xpath('.//devices/interface') as $iface){
            $mac=(string)$iface->mac['address'];
            $bridge=$iface->source['bridge']??''; $model=$iface->model['type']??'';
            $target=$iface->target['dev']??null; $rx=0;$tx=0;
            if($target){
                try{ $stat=$this->runVirsh('domifstat',$vmId,$target); foreach(preg_split('/\r?\n/',$stat) as $l){ if(str_starts_with($l,'rx_bytes')) $rx=(int)trim(explode(' ', $l)[1]); elseif(str_starts_with($l,'tx_bytes')) $tx=(int)trim(explode(' ', $l)[1]); } } catch(\Throwable $e){}
            }
            $nics[]=[
                'id'=>str_replace(':','',$mac),
                'mac'=>$mac,
                'bridge'=>$bridge? (string)$bridge : '',
                'model'=>$model? (string)$model : '',
                'pciAddress'=>null,
                'rx_rate_kbps'=>(int)($rx/1024),
                'tx_rate_kbps'=>(int)($tx/1024),
                'status'=>'active'
            ];
        }
        return response()->json($nics);
    }

    public function metrics(string $vmId)
    {
        try { $mem=$this->runVirsh('dommemstat',$vmId); } catch(\Throwable $e){ return response()->json([],500); }
        $rss=0; foreach(preg_split('/\r?\n/',$mem) as $l){ if(str_starts_with($l,'rss')){ $rss=(int)trim(explode(' ', $l)[1]); break; } }
        $memMb=(int)($rss/1024);
        return response()->json(['cpu_percent'=>0.0,'memory_mb'=>$memMb,'memory_percent'=>0.0,'disk_rw_mb_s'=>0.0,'network_mbps'=>0.0]);
    }

    public function events(string $vmId)
    {
        return response()->json([]);
    }
}
