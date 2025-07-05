from fastapi import FastAPI, HTTPException, Path, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import uuid4
import uuid
import os
import time
import textwrap
import json
import re
import libvirt
import guestfs
import requests
from virtinst import Guest
from virtinst.device.disk import DeviceDisk
from virtinst.device.interface import DeviceInterface
from virtinst.device.cloudinit import DeviceCloudInit
from virtinst.device.graphics import DeviceGraphics
from contextlib import asynccontextmanager

# ---------------- Libvirt Connection ----------------
LIBVIRT_CONNECTION = None
METRIC_SAMPLES: Dict[str, Dict[str, float]] = {}

def get_libvirt_connection():
    """建立到 libvirt 的连接"""
    try:
        return libvirt.open("qemu:///system")
    except libvirt.libvirtError as e:
        print(f"libvirt 连接失败: {e}")
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global LIBVIRT_CONNECTION
    LIBVIRT_CONNECTION = get_libvirt_connection()
    yield
    if LIBVIRT_CONNECTION:
        LIBVIRT_CONNECTION.close()
        LIBVIRT_CONNECTION = None

app = FastAPI(title="VM Management API", lifespan=lifespan)

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
    uptime: str
    hostNode: str
    pool: str
    vcpu: VCPUInfo
    vram: VRAMInfo
    bootSource: str
    uuid: str
    ipAddress: str
    disks_rw_mbps: float
    network_throughput_mbps: float

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
class GuacInfo(BaseModel):
    url: str
    username: str
    password: str
    folder_id: Optional[str] = "ROOT"

class VMRequest(BaseModel):
    vm_name: Optional[str] = None
    base_image: str
    memory: int = 2048
    vcpus: int = 2
    disk_gb: int = 20
    ssh_key: Optional[str] = None
    admin_password: Optional[str] = None
    static_ip: Optional[str] = None
    guacamole: GuacInfo

# ---------------- Helper Functions ----------------
def _require_conn():
    if not LIBVIRT_CONNECTION:
        raise HTTPException(status_code=503, detail="libvirt 未连接")
    return LIBVIRT_CONNECTION

# 使用 libguestfs 解析镜像文件以获取版本等元数据
def _get_image_metadata(path: str) -> dict[str, Optional[str]]:
    meta: dict[str, Optional[str]] = {
        "version": None,
        "osType": None,
        "architecture": None,
    }
    g = guestfs.GuestFS(python_return_dict=True)
    try:
        g.add_drive_opts(path, readonly=True)
        g.launch()
        roots = g.inspect_os()
        if roots:
            root = roots[0]
            distro = g.inspect_get_distro(root)
            major = g.inspect_get_major_version(root)
            minor = g.inspect_get_minor_version(root)
            meta["version"] = f"{distro} {major}.{minor}"
            meta["osType"] = g.inspect_get_type(root)
            meta["architecture"] = g.inspect_get_arch(root)
    except Exception:
        pass
    finally:
        try:
            g.close()
        except Exception:
            pass
    return meta

# 获取所有虚拟机实例
def fetch_vm_instances() -> List[VmInstance]:
    conn = _require_conn()
    host = conn.getHostname()
    instances: List[VmInstance] = []
    for dom in conn.listAllDomains():
        info = dom.info()
        state_code = info[0]
        if state_code == libvirt.VIR_DOMAIN_RUNNING:
            state = "running"
        elif state_code == libvirt.VIR_DOMAIN_PAUSED:
            state = "paused"
        else:
            state = "shutoff"
        instances.append(
            VmInstance(
                id=dom.UUIDString(),
                name=dom.name(),
                hostNode=host,
                pool="default",
                state=state,
                vcpu=info[3],
                vmem=int(info[2] / 1024),
            )
        )
    return instances

# 获取所有存储卷信息
def fetch_vm_images() -> List[VmImage]:
    conn = _require_conn()
    images: List[VmImage] = []
    for pool in conn.listAllStoragePools():
        if pool.name() != "default":          # 只看 default 池
            continue
        pool.refresh(0)
        for vol_name in pool.listVolumes():
            vol = pool.storageVolLookupByName(vol_name)
            size_mb = vol.info()[1] / (1024 ** 2)
            path = vol.path()
            # 使用文件的修改时间作为上传日期的近似值
            try:
                mtime = os.path.getmtime(path)
                upload_date = datetime.fromtimestamp(mtime).isoformat()
            except OSError:
                upload_date = None

            # 使用 guestfs 解析镜像文件获取更多元信息
            meta = _get_image_metadata(path)

            images.append(
                VmImage(
                    id=vol_name,
                    name=vol_name,
                    pool=pool.name(),
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
def _wait_for_state(dom, target_code: int, timeout: int = 30) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        try:
            if dom.info()[0] == target_code:
                return True
        except libvirt.libvirtError:
            pass
        time.sleep(1)
    return False

# ----- VM Creation Helpers -----
POOL_DIR = "/var/lib/libvirt/images"
VIRTIO_ISO = "/usr/share/virtio-win/virtio-win.iso"

def detect_os(img_path: str) -> str:
    g = guestfs.GuestFS(python_return_dict=True)
    g.add_drive_opts(img_path, readonly=1)
    g.launch()
    roots = g.inspect_os()
    if not roots:
        raise ValueError("Cannot detect guest OS")
    return g.inspect_get_type(roots[0])

def gen_mac(seed: str) -> str:
    h = uuid.uuid5(uuid.NAMESPACE_DNS, seed).hex
    return "02:" + ":".join(h[i:i+2] for i in range(0, 10, 2))

def parse_vnc_port(xml: str) -> int | None:
    m = re.search(r"<graphics[^>]*type='vnc'[^>]*port='(\d+)'", xml)
    return int(m.group(1)) if m else None

def guac_login(url: str, username: str, password: str) -> tuple[str, str]:
    r = requests.post(f"{url}/api/tokens", data={"username": username, "password": password})
    if not r.ok:
        raise RuntimeError("Guacamole auth failed")
    data = r.json()
    return data["authToken"], next(iter(data["dataSource"]))

def guac_create_conn(url: str, token: str, ds: str, name: str, proto: str, params: dict, parent: str | None):
    body = {
        "name": name,
        "protocol": proto,
        "parameters": params,
        "attributes": {"max-connections": "5", "max-connections-per-user": "2"},
    }
    r = requests.post(f"{url}/api/session/data/{ds}/connections", params={"token": token}, json=body)
    if not r.ok:
        raise RuntimeError("create connection failed")
    conn_id = r.json()
    if parent and parent != "ROOT":
        requests.post(
            f"{url}/api/session/data/{ds}/connectionGroups/{parent}/connections/{conn_id}",
            params={"token": token},
        )
    return conn_id

# ---------------- API Endpoints ----------------
@app.get("/api/vms", response_model=List[VmInstance])
def list_vms():
    return fetch_vm_instances()

@app.get("/api/vms/images", response_model=List[VmImage])
def list_vm_images():
    return fetch_vm_images()

@app.post("/api/vms/create")
def create_vm(req: VMRequest):
    vm_name = req.vm_name or f"vm-{uuid.uuid4().hex[:8]}"
    mac = gen_mac(vm_name)

    guest_os = detect_os(req.base_image)
    conn = _require_conn()
    g = Guest(conn)
    g.name, g.memory, g.vcpus = vm_name, req.memory, req.vcpus
    g.os_type = "hvm"
    g.os_variant = "ubuntu24.04" if guest_os == "linux" else "win10"

    overlay = f"{POOL_DIR}/{vm_name}.qcow2"
    d = DeviceDisk(g)
    d.source_file = overlay
    d.backing_store = req.base_image
    d.driver_type = "qcow2"
    d.size = req.disk_gb
    d.bus, d.create = "virtio", True
    g.devices.append(d)

    iface = DeviceInterface(g)
    iface.type = DeviceInterface.TYPE_USER
    iface.hostfwd = [
        "tcp::2222-:22",
        "tcp::33389-:3389",
    ]
    iface.mac_address = mac
    g.devices.append(iface)

    if guest_os == "linux":
        user_data = textwrap.dedent(f"""\
            #cloud-config
            hostname: {vm_name}
            users:
              - default
              - name: ubuntu
                sudo: ALL=(ALL) NOPASSWD:ALL
                ssh_authorized_keys:
                  - {req.ssh_key or ''}
        """)
    else:
        if not req.admin_password:
            raise HTTPException(422, "Windows VM requires admin_password")
        user_data = textwrap.dedent(f"""\
            #cloud-config
            password: {req.admin_password}
            username: Administrator
            runcmd:
              - powershell -Command "Set-ItemProperty -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' -Name fDenyTSConnections -Value 0"
              - powershell -Command "Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'"
        """)

    ci = DeviceCloudInit(g)
    ci.user_data = user_data
    ci.disable = True
    g.devices.append(ci)

    if guest_os == "windows":
        drv = DeviceDisk(g)
        drv.device = DeviceDisk.DEVICE_CDROM
        drv.read_only = True
        drv.source_file = VIRTIO_ISO
        drv.bus = "sata"
        g.devices.append(drv)

    vnc = DeviceGraphics(g)
    vnc.type, vnc.port, vnc.listen = "vnc", -1, "0.0.0.0"
    g.devices.append(vnc)

    dom_xml = g.get_xml_config()
    dom = conn.defineXML(dom_xml)
    dom.create()
    vnc_port = parse_vnc_port(dom.XMLDesc()) or 5900

    try:
        token, ds = guac_login(
            req.guacamole.url, req.guacamole.username, req.guacamole.password
        )

        if guest_os == "linux":
            guac_create_conn(
                req.guacamole.url,
                token,
                ds,
                name=vm_name + "-ssh",
                proto="ssh",
                params={"hostname": "hypervisor", "port": "2222", "username": "ubuntu"},
                parent=req.guacamole.folder_id,
            )
        else:
            guac_create_conn(
                req.guacamole.url,
                token,
                ds,
                name=vm_name + "-rdp",
                proto="rdp",
                params={"hostname": "hypervisor", "port": "33389", "security": "nla"},
                parent=req.guacamole.folder_id,
            )

        guac_create_conn(
            req.guacamole.url,
            token,
            ds,
            name=vm_name + "-vnc",
            proto="vnc",
            params={"hostname": "hypervisor", "port": str(vnc_port)},
            parent=req.guacamole.folder_id,
        )
    except Exception as e:
        return {"vm": vm_name, "mac": mac, "vnc_port": vnc_port, "guac_warning": str(e)}

    return {"vm": vm_name, "mac": mac, "vnc_port": vnc_port, "guac_connections": "created"}

@app.get("/api/vms/{vm_id}", response_model=OverviewData)
def get_vm_info(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    info = dom.info()
    state_code = info[0]
    if state_code == libvirt.VIR_DOMAIN_RUNNING:
        status = "running"
    elif state_code == libvirt.VIR_DOMAIN_PAUSED:
        status = "paused"
    else:
        status = "shutoff"
    total_mb = int(info[1] / 1024)
    used_mb = int(info[2] / 1024)
    vram = VRAMInfo(total_mb=total_mb, usage_mb=used_mb, usage_percent=used_mb / total_mb * 100)
    vcpu = VCPUInfo(count=info[3], usage_percent=0.0)
    ip = None
    try:
        ifaces = dom.interfaceAddresses(libvirt.VIR_DOMAIN_INTERFACE_ADDRESSES_SRC_AGENT, 0)
        for val in ifaces.values():
            if val['addrs']:
                ip = val['addrs'][0]['addr']
                break
    except libvirt.libvirtError:
        pass
    uptime_s = int(info[4] / 1e9) if info[3] else 0
    return OverviewData(
        status=status,
        uptime=str(uptime_s),
        hostNode=conn.getHostname(),
        pool="default",
        vcpu=vcpu,
        vram=vram,
        bootSource="disk",
        uuid=dom.UUIDString(),
        ipAddress=ip or "",
        disks_rw_mbps=0.0,
        network_throughput_mbps=0.0,
    )

@app.post("/api/vms/{vm_id}/actions/{action}", response_model=LifecycleActionResponse)
def manage_vm_lifecycle(vm_id: str, action: str = Path(...)):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    try:
        if action == "start":
            dom.create()
            target = libvirt.VIR_DOMAIN_RUNNING
        elif action == "pause":
            dom.suspend()
            target = libvirt.VIR_DOMAIN_PAUSED
        elif action == "resume":
            dom.resume()
            target = libvirt.VIR_DOMAIN_RUNNING
        elif action == "shutdown":
            dom.shutdown()
            target = libvirt.VIR_DOMAIN_SHUTOFF
        elif action == "reboot":
            dom.reboot()
            target = libvirt.VIR_DOMAIN_RUNNING
        elif action == "force-off":
            dom.destroy()
            target = libvirt.VIR_DOMAIN_SHUTOFF
        else:
            raise HTTPException(status_code=400, detail="未知操作")
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))

    _wait_for_state(dom, target)
    state_map = {
        libvirt.VIR_DOMAIN_RUNNING: "running",
        libvirt.VIR_DOMAIN_PAUSED: "paused",
        libvirt.VIR_DOMAIN_SHUTOFF: "shutoff",
    }
    return LifecycleActionResponse(message="ok", vm_id=vm_id, action=action, state=state_map.get(target, "unknown"))

@app.get("/api/vms/{vm_id}/snapshots", response_model=List[Snapshot])
def list_vm_snapshots(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    snaps = []
    for name in dom.snapshotListNames(0):
        snap = dom.snapshotLookupByName(name, 0)
        info = snap.getInfo()
        snaps.append(
            Snapshot(
                id=name,
                name=name,
                created=datetime.fromtimestamp(info[1]),
                xml=snap.getXMLDesc(),
            )
        )
    return snaps

@app.post("/api/vms/{vm_id}/snapshots", response_model=Snapshot)
def create_vm_snapshot(vm_id: str, snapshot_data: SnapshotCreate):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    snap_xml = f"<domainsnapshot><name>{snapshot_data.name}</name><description>{snapshot_data.description or ''}</description></domainsnapshot>"
    try:
        snap = dom.snapshotCreateXML(snap_xml, 0)
        info = snap.getInfo()
        return Snapshot(id=snap.getName(), name=snap.getName(), description=snapshot_data.description, created=datetime.fromtimestamp(info[1]), xml=snap.getXMLDesc())
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vms/{vm_id}/snapshots/{snapshot_id}/revert")
def revert_to_vm_snapshot(vm_id: str, snapshot_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    snap = dom.snapshotLookupByName(snapshot_id, 0)
    try:
        snap.revertToSnapshot(0)
        return {"message": "reverted"}
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/vms/{vm_id}/snapshots/{snapshot_id}")
def delete_vm_snapshot(vm_id: str, snapshot_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    snap = dom.snapshotLookupByName(snapshot_id, 0)
    try:
        snap.delete(0)
        return None
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vms/{vm_id}/storage/disks", response_model=List[Disk])
def list_vm_disks(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    xml = dom.XMLDesc(0)
    import xml.etree.ElementTree as ET
    tree = ET.fromstring(xml)
    disks: List[Disk] = []
    for disk in tree.findall(".//devices/disk[@device='disk']"):
        target = disk.find("target").get("dev")
        source = disk.find("source")
        path = source.get("file") if source is not None else None
        if not path:
            continue
        vol = conn.storageVolLookupByPath(path)
        info = vol.info()
        disks.append(
            Disk(
                id=target,
                target=target,
                source=path,
                format=disk.find("driver").get("type"),
                bus=disk.find("target").get("bus"),
                capacity_gb=int(info[1] / (1024 ** 3)),
                allocated_gb=int(info[2] / (1024 ** 3)),
            )
        )
    return disks

@app.get("/api/vms/{vm_id}/storage/cdroms", response_model=List[CdRomDevice])
def list_vm_cdroms(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    xml = dom.XMLDesc(0)
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

@app.get("/api/vms/{vm_id}/network/vnics", response_model=List[VirtualNic])
def list_vm_vnics(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    xml = dom.XMLDesc(0)
    import xml.etree.ElementTree as ET
    tree = ET.fromstring(xml)
    nics: List[VirtualNic] = []
    for iface in tree.findall(".//devices/interface[@type='bridge']"):
        mac = iface.find("mac").get("address")
        bridge = iface.find("source").get("bridge")
        model = iface.find("model").get("type")
        target_elem = iface.find("target")
        target = target_elem.get("dev") if target_elem is not None else None
        stats = dom.interfaceStats(target) if target else (0,0,0,0,0,0,0,0)
        rx = stats[0]
        tx = stats[4]
        nics.append(
            VirtualNic(
                id=mac.replace(":", ""),
                mac=mac,
                bridge=bridge,
                model=model,
                pciAddress=None,
                rx_rate_kbps=int(rx/1024),
                tx_rate_kbps=int(tx/1024),
                status="active",
            )
        )
    return nics

@app.get("/api/vms/{vm_id}/metrics", response_model=VmRealtimeMetrics)
def get_vm_realtime_metrics(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByUUIDString(vm_id)
    now = time.time()

    info = dom.info()
    vcpu_count = info[3]

    # cgroup v2 环境下不支持 per-vCPU 统计，需使用汇总值
    cpu_time = dom.getCPUStats(True)[0]["cpu_time"]

    mem_stats = dom.memoryStats()
    rss_kb = mem_stats.get("rss", 0)
    mem_mb = int(rss_kb / 1024)
    mem_pct = (rss_kb / info[1]) * 100 if info[1] else 0.0

    xml_desc = dom.XMLDesc(0)
    import xml.etree.ElementTree as ET
    tree = ET.fromstring(xml_desc)

    disk_bytes = 0
    for disk in tree.findall(".//devices/disk[@device='disk']"):
        dev = disk.find("target").get("dev")
        stats = dom.blockStats(dev)
        disk_bytes += stats[1] + stats[3]

    net_bytes = 0
    for iface in tree.findall(".//devices/interface/target"):
        name = iface.get("dev")
        rx, _, _, _, tx, _, _, _ = dom.interfaceStats(name)
        net_bytes += rx + tx

    prev = METRIC_SAMPLES.get(vm_id)
    if prev:
        dt = now - prev["time"]
        if dt <= 0:
            dt = 1
        cpu_percent = (cpu_time - prev["cpu_time"]) / (dt * 1e9 * vcpu_count) * 100
        disk_rw_mb_s = (disk_bytes - prev["disk"]) / dt / (1024 ** 2)
        network_mbps = (net_bytes - prev["net"]) * 8 / dt / (1024 ** 2)
    else:
        cpu_percent = 0.0
        disk_rw_mb_s = 0.0
        network_mbps = 0.0

    METRIC_SAMPLES[vm_id] = {
        "time": now,
        "cpu_time": cpu_time,
        "disk": disk_bytes,
        "net": net_bytes,
    }

    return VmRealtimeMetrics(
        cpu_percent=cpu_percent,
        memory_mb=mem_mb,
        memory_percent=mem_pct,
        disk_rw_mb_s=disk_rw_mb_s,
        network_mbps=network_mbps,
    )


@app.get("/api/vms/{vm_id}/events", response_model=List[EventLog])
def list_vm_events(vm_id: str):
    # 未实现事件持久化，暂返回空列表
    return []

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_API_PORT", "3010"))
    uvicorn.run(app, host="0.0.0.0", port=port)
