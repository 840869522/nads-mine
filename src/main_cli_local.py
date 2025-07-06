from fastapi import HTTPException
import argparse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import uuid4
import uuid
import os
import time
import textwrap
import json
import re
import subprocess
import tempfile
import shutil
import xml.etree.ElementTree as ET
# from virtinst import Guest                     # (old)
# from virtinst.device.disk import DeviceDisk    # (old)
# from virtinst.device.interface import DeviceInterface  # (old)
# from virtinst.device.cloudinit import DeviceCloudInit  # (old)
# from virtinst.device.graphics import DeviceGraphics    # (old)

# ---------------- Command Helpers ----------------
METRIC_SAMPLES: Dict[str, Dict[str, float]] = {}

def run_virsh(*args: str) -> str:
    """Run a virsh command and return its stdout."""
    result = subprocess.run([
        "virsh",
        "-c",
        "qemu:///system",
        *args,
    ], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return result.stdout



# ---------------- Pydantic Models ----------------
class VmInstance(BaseModel):
    id: str
    name: str
    hostNode: str
    pool: str
    state: str
    vcpu: int
    vmem: int
    ip: Optional[str] = None

class VmImage(BaseModel):
    id: str
    name: str
    pool: str
    size: str
    path: str
    # 下列字段在 libvirt 的存储卷信息中通常不存在，故设为可选
    description: Optional[str] = None
    version: Optional[str] = None
    osType: Optional[str] = None
    architecture: Optional[str] = None
    # 上传日期可近似使用文件的修改时间
    uploadDate: Optional[str] = None
    # 镜像状态目前固定为 available，无法直接从 libvirt 获取
    status: Optional[str] = None

class VCPUInfo(BaseModel):
    count: int
    usage_percent: float

class VRAMInfo(BaseModel):
    total_mb: int
    usage_mb: int
    usage_percent: float

class OverviewData(BaseModel):
    status: str
    hostNode: str
    pool: str
    vcpu: VCPUInfo
    vram: VRAMInfo
    osType: Optional[str] = None
    persistent: Optional[bool] = None
    autostart: Optional[bool] = None
    uuid: str
    ipAddress: str

class LifecycleActionResponse(BaseModel):
    message: str
    vm_id: str
    action: str
    state: str

class Snapshot(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created: datetime
    parentId: Optional[str] = None
    size_mb: int = 0
    xml: Optional[str] = None

class SnapshotCreate(BaseModel):
    name: str
    description: Optional[str] = None

class Disk(BaseModel):
    id: str
    target: str
    source: str
    format: str
    bus: str
    capacity_gb: int
    allocated_gb: int
    iops_rw: Optional[str] = None

class CdRomDevice(BaseModel):
    id: str
    target: str
    source_iso: Optional[str]
    mounted: bool

class VirtualNic(BaseModel):
    id: str
    mac: str
    bridge: str
    model: str
    pciAddress: Optional[str] = None
    rx_rate_kbps: int
    tx_rate_kbps: int
    status: str
    bandwidth_limit_mbps: Optional[int] = None
    vlan_tag: Optional[int] = None


class VmRealtimeMetrics(BaseModel):
    cpu_percent: float
    memory_mb: int
    memory_percent: float
    disk_rw_mb_s: float
    network_mbps: float

class EventLog(BaseModel):
    id: str
    timestamp: datetime
    level: str
    message: str
    details: Optional[Dict[str, Any]] = None

# ----- VM Creation Models -----
class VMRequest(BaseModel):
    vm_name: Optional[str] = None
    base_image: str
    memory: int = 2048
    vcpus: int = 2
    disk_gb: int = 20
    ssh_key: Optional[str] = None
    admin_password: Optional[str] = None
    static_ip: Optional[str] = None

# ---------------- Helper Functions ----------------
def _require_conn():
    """Compatibility helper for API parity. Always returns None."""
    return None

# 使用命令行工具 virt-inspector 获取镜像的系统信息
def _get_image_metadata(path: str) -> dict[str, Optional[str]]:
    meta: dict[str, Optional[str]] = {"version": None, "osType": None, "architecture": None}

    # 1. 精简输出，减少解析负担
    cmd = ["virt-inspector", "--no-applications", "--no-icon", "-a", path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError:
        return meta                    # 运行失败直接返回空白 meta

    root = ET.fromstring(result.stdout)
    os_node = root.find(".//operatingsystem")
    if os_node is None:
        return meta

    # 2. architecture
    meta["architecture"] = os_node.findtext("arch")

    # 3. osType —— 优先 os_type / os-type，其次 name
    meta["osType"] = (
            os_node.findtext("os_type") or
            os_node.findtext("os-type") or
            os_node.findtext("name")
    )

    # 4. version —— distro + (major.minor | product_name)
    distro = os_node.findtext("distro") or os_node.findtext("name")
    major  = os_node.findtext("major_version") or os_node.findtext("major-version")
    minor  = os_node.findtext("minor_version") or os_node.findtext("minor-version")

    if distro:
        if major and minor:
            meta["version"] = f"{distro} {major}.{minor}"
        else:
            # 某些发行版只有 product_name，或者 major/minor 取不到
            product = os_node.findtext("product_name")
            meta["version"] = product if product else distro

    return meta

def _size_to_mb(size: float, unit: str) -> float:
    unit = unit.lower()
    if unit.startswith("g"):
        return size * 1024
    if unit.startswith("k"):
        return size / 1024
    return size

# 获取所有虚拟机实例
def fetch_vm_instances() -> List[VmInstance]:
    host = subprocess.run(["hostname"], capture_output=True, text=True).stdout.strip()
    output = run_virsh("list", "--all")
    lines = output.strip().splitlines()[2:]
    instances: List[VmInstance] = []
    for line in lines:
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        name = parts[1]
        state = " ".join(parts[2:])
        try:
            uuid_val = run_virsh("domuuid", name).strip()
            info_out = run_virsh("dominfo", name)
        except RuntimeError:
            continue
        vcpu = 0
        mem_kib = 0
        for l in info_out.splitlines():
            if l.startswith("CPU(s):"):
                vcpu = int(l.split()[1])
            elif l.startswith("Used memory:") or l.startswith("Max memory:"):
                mem_kib = int(l.split()[2]) if len(l.split()) > 2 else int(l.split()[1])
        instances.append(
            VmInstance(
                id=uuid_val,
                name=name,
                hostNode=host,
                pool="default",
                state=state,
                vcpu=vcpu,
                vmem=int(mem_kib / 1024),
            )
        )
    return instances

# 获取所有存储卷信息
def fetch_vm_images() -> List[VmImage]:
    images: List[VmImage] = []
    try:
        output = run_virsh("vol-list", "default")
    except RuntimeError:
        return images
    lines = output.strip().splitlines()[2:]
    for line in lines:
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        vol_name = parts[0]
        path = parts[1]
        try:
            info_out = run_virsh("vol-info", vol_name, "--pool", "default")
        except RuntimeError:
            continue
        size_mb = 0.0
        for l in info_out.splitlines():
            if l.startswith("Capacity:"):
                val, unit = l.split()[1:3]
                size_mb = _size_to_mb(float(val), unit)
                break
        try:
            mtime = os.path.getmtime(path)
            upload_date = datetime.fromtimestamp(mtime).isoformat()
        except OSError:
            upload_date = None

        meta = _get_image_metadata(path)
        images.append(
            VmImage(
                id=vol_name,
                name=vol_name,
                pool="default",
                size=f"{size_mb:.1f} MB",
                path=path,
                uploadDate=upload_date,
                status="available",
                version=meta.get("version"),
                osType=meta.get("osType"),
                architecture=meta.get("architecture"),
            )
        )
    return images

# 等待虚拟机达到指定状态
def _wait_for_state(name: str, target_state: str, timeout: int = 30) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        try:
            state = run_virsh("domstate", name).strip()
            if state == target_state:
                return True
        except RuntimeError:
            pass
        time.sleep(1)
    return False

# ----- VM Creation Helpers -----
POOL_DIR = "/home/proj/"
VIRTIO_ISO = "/usr/share/virtio-win/virtio-win.iso"
QEMU_IMG = "qemu-img"

import subprocess
import xml.etree.ElementTree as ET
from typing import Literal

def detect_os(img_path: str) -> Literal["linux", "windows"]:
    """
    使用 virt-inspector 的 XML 元数据精准判断镜像类型。

    返回:
        "linux"   —— 任意 Linux 发行版（Ubuntu, CentOS, Debian, …）
        "windows" —— 任意 Windows 版本（Server/桌面）
    """
    # 1. 调用 virt-inspector，关掉不必要的输出以加速
    cmd = ["virt-inspector", "--no-applications", "--no-icon", "-a", img_path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        raise ValueError(f"virt-inspector failed: {e.stderr.strip()}") from e

    # 2. 解析 XML
    try:
        root = ET.fromstring(result.stdout)
    except ET.ParseError as e:
        raise ValueError(f"Cannot parse virt-inspector XML: {e}") from e

    os_node = root.find(".//operatingsystem")
    if os_node is None:
        raise ValueError("No <operatingsystem> node in inspector output")

    # 3. 取出核心字段
    os_type = (
        (os_node.findtext("os_type") or os_node.findtext("os-type") or "")
        .strip()
        .lower()
    )

    # 某些镜像没有 os_type，可 fallback 到 name/distro
    if not os_type:
        os_type = (
            (os_node.findtext("name") or os_node.findtext("distro") or "")
            .strip()
            .lower()
        )

    # 4. 归一化判定
    if "windows" in os_type:
        return "windows"
    if "linux" in os_type:
        return "linux"

    # 5. 再次 fallback：看 distro 里是否出现典型 Linux 关键字
    distro = (os_node.findtext("distro") or "").lower()
    linux_keywords = (
        "ubuntu", "debian", "centos", "rhel", "redhat", "fedora",
        "opensuse", "suse", "arch", "alpine", "oracle", "rocky", "alma",
    )
    if any(k in distro for k in linux_keywords):
        return "linux"

    # 实在识别不了就明确抛错，包含元数据方便调试
    meta = {
        "os_type": os_type,
        "distro": distro,
        "name": (os_node.findtext("name") or "").lower(),
    }
    raise ValueError(f"Cannot determine OS type from metadata: {meta}")

def _detect_vm_os(vm_id: str) -> Optional[str]:
    """Try to detect the OS type of an existing VM by inspecting its disk image."""
    try:
        xml = run_virsh("dumpxml", vm_id)
    except RuntimeError:
        return None
    tree = ET.fromstring(xml)
    source = tree.find(".//devices/disk[@device='disk']/source")
    if source is None:
        return None
    img_path = source.get("file") or source.get("dev")
    if not img_path:
        return None
    try:
        return detect_os(img_path).capitalize()
    except Exception:
        return None

def gen_mac(seed: str) -> str:
    h = uuid.uuid5(uuid.NAMESPACE_DNS, seed).hex
    return "02:" + ":".join(h[i:i+2] for i in range(0, 10, 2))

def parse_vnc_port(xml: str) -> int | None:
    m = re.search(r"<graphics[^>]*type='vnc'[^>]*port='(\d+)'", xml)
    return int(m.group(1)) if m else None


# ---------------- CLI Functions ----------------
def list_vms():
    return fetch_vm_instances()

def list_vm_images():
    return fetch_vm_images()

def create_vm(req: VMRequest):
    vm = req.vm_name or f"vm-{uuid.uuid4().hex[:8]}"
    mac = gen_mac(vm)
    try:
        guest_os = detect_os(req.base_image)
    except Exception:
        guest_os = "linux"

    # 1. 创建差分盘
    overlay = f"{POOL_DIR}/{vm}.qcow2"
    subprocess.run([
        QEMU_IMG,
        "create",
        "-f",
        "qcow2",
        "-F",
        "qcow2",
        "-o",
        f"backing_file={req.base_image}",
        overlay,
        f"{req.disk_gb}G",
    ], check=True)

    # 2. 生成 Cloud-Init 文件
    tmpdir = tempfile.mkdtemp(prefix=f"{vm}-ci-")
    try:
        if guest_os == "linux":
            udata_lines = [
                "#cloud-config",
                f"hostname: {vm}",
                "users:",
                "  - default",
                "  - name: ubuntu",
                "    sudo: ALL=(ALL) NOPASSWD:ALL",
            ]
            if req.ssh_key:
                udata_lines += [
                    "    ssh_authorized_keys:",
                    f"      - {req.ssh_key}",
                ]
            if req.admin_password:
                udata_lines += [
                    "chpasswd:",
                    "  list: |",
                    f"    ubuntu:{req.admin_password}",
                    "  expire: False",
                    "ssh_pwauth: True",
                ]
            udata = "\n".join(udata_lines)
        else:
            if not req.admin_password:
                raise HTTPException(422, "Windows VM requires admin_password")
            udata = textwrap.dedent(
                f"""\
                #cloud-config
                password: {req.admin_password}
                username: Administrator
                runcmd:
                  - powershell -Command "Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name fDenyTSConnections -Value 0"
                  - powershell -Command "Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'"
                """
            )

        with open(os.path.join(tmpdir, "user-data"), "w") as f:
            f.write(udata)
        with open(os.path.join(tmpdir, "meta-data"), "w") as f:
            f.write(f"instance-id: {vm}\nlocal-hostname: {vm}\n")
        open(os.path.join(tmpdir, "network-config"), "w").close()

        ci_param = ",".join(
            [
                f"user-data={os.path.join(tmpdir, 'user-data')}",
                f"meta-data={os.path.join(tmpdir, 'meta-data')}",
                "network-config=" + os.path.join(tmpdir, "network-config"),
                "disable=on",
            ]
        )

        disk_root = f"path={overlay},format=qcow2,bus=virtio"

        # 1) virt-install 不让它自动建网卡
        network_arg = "none"

        # 2) 手动添加 user/slirp 网卡 + 端口转发
        qemu_netdev = (
            "--qemu-commandline="
            "-netdev user,id=net0,"
            "hostfwd=tcp::2222-:22,"
            "hostfwd=tcp::33389-:3389"
        )

        # 3) 把网卡插到 pcie.0 的 slot 0x6，避开 0x1(virtio-vga) 和 0x2(root-port)
        qemu_device = (
            "--qemu-commandline="
            "-device virtio-net-pci,netdev=net0,bus=pcie.0,addr=0x6"
        )

        # 4) 组装 cmd
        cmd = [
            "virt-install",
            "--import",
            "--quiet",
            "--name", vm,
            "--memory", str(req.memory),
            "--vcpus", str(req.vcpus),
            "--os-variant", "ubuntu24.04" if guest_os == "linux" else "win10",
            "--graphics", "vnc,listen=0.0.0.0",
            "--noautoconsole",
            "--wait", "0",
            "--disk", disk_root,
            "--network", network_arg,
            "--cloud-init", ci_param,
            qemu_netdev,
            qemu_device,
        ]

        subprocess.run(cmd, check=True)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    # 3. 查询 VNC 端口
    try:
        xml = run_virsh("dumpxml", vm)
        vnc_port = parse_vnc_port(xml) or 5900
    except RuntimeError:
        vnc_port = 5900

    return {"vm": vm, "mac": mac, "vnc_port": vnc_port}


def get_guac_info(vm_name: str):
    try:
        xml = run_virsh("dumpxml", vm_name)
        vnc_port = parse_vnc_port(xml) or 5900
    except RuntimeError:
        vnc_port = 5900

    return {
        "host": "hypervisor",
        "ssh_port": 2222,
        "rdp_port": 33389,
        "vnc_port": vnc_port,
    }

def get_vm_info(vm_id: str):
    try:
        info_out = run_virsh("dominfo", vm_id)
    except RuntimeError as e:
        raise HTTPException(404, str(e))
    host = subprocess.run(["hostname"], capture_output=True, text=True).stdout.strip()
    state = "unknown"
    vcpu = 0
    total_mb = 0
    used_mb = 0
    os_type = None
    persistent = None
    autostart = None
    for line in info_out.splitlines():
        if line.startswith("State:"):
            state = line.split()[1]
        elif line.startswith("CPU(s):"):
            vcpu = int(line.split()[1])
        elif line.startswith("Max memory:"):
            total_mb = int(line.split()[2]) // 1024
        elif line.startswith("Used memory:"):
            used_mb = int(line.split()[2]) // 1024
        elif line.startswith("Persistent:"):
            val = line.split()[1].lower()
            persistent = val == "yes"
        elif line.startswith("Autostart:"):
            val = line.split()[1].lower()
            autostart = val in ["enable", "yes"]
    vram = VRAMInfo(total_mb=total_mb, usage_mb=used_mb, usage_percent=(used_mb / total_mb * 100) if total_mb else 0.0)
    vcpu_info = VCPUInfo(count=vcpu, usage_percent=0.0)

    ip = None
    try:
        addr_out = run_virsh("domifaddr", vm_id, "--source", "agent")
        for l in addr_out.splitlines()[2:]:
            parts = l.split()
            if len(parts) >= 4:
                ip = parts[3]
                break
    except RuntimeError:
        pass

    if os_type is None:
        try:
            os_type = _detect_vm_os(vm_id)
        except Exception:
            os_type = None

    return OverviewData(
        status=state,
        hostNode=host,
        pool="default",
        vcpu=vcpu_info,
        vram=vram,
        osType=os_type,
        persistent=persistent,
        autostart=autostart,
        uuid=vm_id,
        ipAddress=ip or "",
    )

def manage_vm_lifecycle(vm_id: str, action: str):
    cmd_map = {
        "start": "start",
        "pause": "suspend",
        "resume": "resume",
        "shutdown": "shutdown",
        "reboot": "reboot",
        "force-off": "destroy",
    }
    if action not in cmd_map:
        raise HTTPException(status_code=400, detail="未知操作")
    try:
        run_virsh(cmd_map[action], vm_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    target_state = "running" if action in ["start", "resume", "reboot"] else "paused" if action == "pause" else "shut off"
    _wait_for_state(vm_id, target_state)
    return LifecycleActionResponse(message="ok", vm_id=vm_id, action=action, state=target_state)

def list_vm_snapshots(vm_id: str):
    snaps: List[Snapshot] = []
    try:
        output = run_virsh("snapshot-list", vm_id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    lines = output.strip().splitlines()[2:]
    import xml.etree.ElementTree as ET
    for line in lines:
        if not line.strip():
            continue
        name = line.split()[0]
        xml = run_virsh("snapshot-dumpxml", vm_id, name)
        tree = ET.fromstring(xml)
        ctime = tree.findtext("creationTime")
        created = datetime.fromtimestamp(int(ctime)) if ctime else datetime.now()
        snaps.append(Snapshot(id=name, name=name, created=created, xml=xml))
    return snaps

def create_vm_snapshot(vm_id: str, snapshot_data: SnapshotCreate):
    args = ["snapshot-create-as", vm_id, snapshot_data.name]
    if snapshot_data.description:
        args += ["--description", snapshot_data.description]
    try:
        run_virsh(*args)
        xml = run_virsh("snapshot-dumpxml", vm_id, snapshot_data.name)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    import xml.etree.ElementTree as ET
    tree = ET.fromstring(xml)
    ctime = tree.findtext("creationTime")
    created = datetime.fromtimestamp(int(ctime)) if ctime else datetime.now()
    return Snapshot(
        id=snapshot_data.name,
        name=snapshot_data.name,
        description=snapshot_data.description,
        created=created,
        xml=xml,
    )

def revert_to_vm_snapshot(vm_id: str, snapshot_id: str):
    try:
        run_virsh("snapshot-revert", vm_id, snapshot_id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    return {"message": "reverted"}

def delete_vm_snapshot(vm_id: str, snapshot_id: str):
    try:
        run_virsh("snapshot-delete", vm_id, snapshot_id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    return None

def list_vm_disks(vm_id: str):
    disks: List[Disk] = []
    try:
        output = run_virsh("domblklist", vm_id, "--details")
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    lines = output.strip().splitlines()[2:]
    for line in lines:
        parts = line.split()
        if len(parts) < 4 or parts[1] != "disk":
            continue
        target = parts[2]
        path = parts[3]
        try:
            info_out = run_virsh("domblkinfo", vm_id, target)
        except RuntimeError:
            continue
        capacity_gb = 0
        alloc_gb = 0
        for l in info_out.splitlines():
            if l.startswith("Capacity:"):
                val, unit = l.split()[1:3]
                capacity_gb = _size_to_mb(float(val), unit) / 1024
            elif l.startswith("Allocation:"):
                val, unit = l.split()[1:3]
                alloc_gb = _size_to_mb(float(val), unit) / 1024
        disks.append(
            Disk(
                id=target,
                target=target,
                source=path,
                format="",  # unknown
                bus="virtio",
                capacity_gb=int(capacity_gb),
                allocated_gb=int(alloc_gb),
            )
        )
    return disks

def list_vm_cdroms(vm_id: str):
    try:
        xml = run_virsh("dumpxml", vm_id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    import xml.etree.ElementTree as ET
    tree = ET.fromstring(xml)
    cds: List[CdRomDevice] = []
    for disk in tree.findall(".//devices/disk[@device='cdrom']"):
        target = disk.find("target").get("dev")
        source_elem = disk.find("source")
        iso = source_elem.get("file") if source_elem is not None else None
        mounted = iso is not None
        cds.append(CdRomDevice(id=target, target=target, source_iso=iso, mounted=mounted))
    return cds

def list_vm_vnics(vm_id: str):
    try:
        xml = run_virsh("dumpxml", vm_id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    import xml.etree.ElementTree as ET
    tree = ET.fromstring(xml)
    nics: List[VirtualNic] = []
    for iface in tree.findall(".//devices/interface"):
        mac = iface.find("mac").get("address")
        bridge = iface.find("source").get("bridge") if iface.find("source") is not None else ""
        model = iface.find("model").get("type") if iface.find("model") is not None else ""
        target_elem = iface.find("target")
        target = target_elem.get("dev") if target_elem is not None else None
        rx = tx = 0
        if target:
            try:
                stat_out = run_virsh("domifstat", vm_id, target)
                for l in stat_out.splitlines():
                    if l.startswith("rx_bytes"):
                        rx = int(l.split()[1])
                    elif l.startswith("tx_bytes"):
                        tx = int(l.split()[1])
            except RuntimeError:
                pass
        nics.append(
            VirtualNic(
                id=mac.replace(":", ""),
                mac=mac,
                bridge=bridge,
                model=model,
                pciAddress=None,
                rx_rate_kbps=int(rx / 1024),
                tx_rate_kbps=int(tx / 1024),
                status="active",
            )
        )
    return nics

def get_vm_realtime_metrics(vm_id: str):
    try:
        mem_out = run_virsh("dommemstat", vm_id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    rss_kb = 0
    for line in mem_out.splitlines():
        if line.startswith("rss"):
            rss_kb = int(line.split()[1])
            break
    mem_mb = int(rss_kb / 1024)
    return VmRealtimeMetrics(
        cpu_percent=0.0,
        memory_mb=mem_mb,
        memory_percent=0.0,
        disk_rw_mb_s=0.0,
        network_mbps=0.0,
    )


def list_vm_events(vm_id: str):
    # 未实现事件持久化，暂返回空列表
    return []


def _print_result(res):
    """Pretty-print result objects as JSON."""
    if isinstance(res, BaseModel):
        print(json.dumps(res.model_dump(), indent=2, ensure_ascii=False))
    elif isinstance(res, list):
        out = [r.model_dump() if isinstance(r, BaseModel) else r for r in res]
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(res, indent=2, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description="Local VM management CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list-vms").set_defaults(func=lambda a: list_vms())
    sub.add_parser("list-images").set_defaults(func=lambda a: list_vm_images())

    p_create = sub.add_parser("create-vm")
    p_create.add_argument("--vm-name")
    p_create.add_argument("--base-image", required=True)
    p_create.add_argument("--memory", type=int, default=2048)
    p_create.add_argument("--vcpus", type=int, default=2)
    p_create.add_argument("--disk-gb", type=int, default=20)
    p_create.add_argument("--ssh-key")
    p_create.add_argument("--admin-password")
    p_create.add_argument("--static-ip")
    # Guacamole parameters removed in lite mode

    def _create_vm(args):
        req = VMRequest(
            vm_name=args.vm_name,
            base_image=args.base_image,
            memory=args.memory,
            vcpus=args.vcpus,
            disk_gb=args.disk_gb,
            ssh_key=args.ssh_key,
            admin_password=args.admin_password,
            static_ip=args.static_ip,
        )
        return create_vm(req)

    p_create.set_defaults(func=_create_vm)

    p_guac = sub.add_parser("guac-info")
    p_guac.add_argument("vm_name")
    p_guac.set_defaults(func=lambda a: get_guac_info(a.vm_name))

    p_get = sub.add_parser("get-vm")
    p_get.add_argument("vm_id")
    p_get.set_defaults(func=lambda a: get_vm_info(a.vm_id))

    p_lifecycle = sub.add_parser("lifecycle")
    p_lifecycle.add_argument("vm_id")
    p_lifecycle.add_argument("action")
    p_lifecycle.set_defaults(func=lambda a: manage_vm_lifecycle(a.vm_id, a.action))

    p_ls_snap = sub.add_parser("list-snapshots")
    p_ls_snap.add_argument("vm_id")
    p_ls_snap.set_defaults(func=lambda a: list_vm_snapshots(a.vm_id))

    p_create_snap = sub.add_parser("create-snapshot")
    p_create_snap.add_argument("vm_id")
    p_create_snap.add_argument("name")
    p_create_snap.add_argument("--description")
    def _create_snap(args):
        return create_vm_snapshot(args.vm_id, SnapshotCreate(name=args.name, description=args.description))
    p_create_snap.set_defaults(func=_create_snap)

    p_revert_snap = sub.add_parser("revert-snapshot")
    p_revert_snap.add_argument("vm_id")
    p_revert_snap.add_argument("snapshot_id")
    p_revert_snap.set_defaults(func=lambda a: revert_to_vm_snapshot(a.vm_id, a.snapshot_id))

    p_del_snap = sub.add_parser("delete-snapshot")
    p_del_snap.add_argument("vm_id")
    p_del_snap.add_argument("snapshot_id")
    p_del_snap.set_defaults(func=lambda a: delete_vm_snapshot(a.vm_id, a.snapshot_id))

    p_disks = sub.add_parser("list-disks")
    p_disks.add_argument("vm_id")
    p_disks.set_defaults(func=lambda a: list_vm_disks(a.vm_id))

    p_cd = sub.add_parser("list-cdroms")
    p_cd.add_argument("vm_id")
    p_cd.set_defaults(func=lambda a: list_vm_cdroms(a.vm_id))

    p_nics = sub.add_parser("list-vnics")
    p_nics.add_argument("vm_id")
    p_nics.set_defaults(func=lambda a: list_vm_vnics(a.vm_id))

    p_metrics = sub.add_parser("metrics")
    p_metrics.add_argument("vm_id")
    p_metrics.set_defaults(func=lambda a: get_vm_realtime_metrics(a.vm_id))

    p_events = sub.add_parser("events")
    p_events.add_argument("vm_id")
    p_events.set_defaults(func=lambda a: list_vm_events(a.vm_id))

    args = parser.parse_args()

    try:
        result = args.func(args)
        _print_result(result)
    except HTTPException as e:
        _print_result({"error": e.detail, "status_code": e.status_code})


if __name__ == "__main__":
    main()

