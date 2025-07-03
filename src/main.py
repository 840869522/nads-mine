from fastapi import FastAPI, HTTPException, Path, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import uuid4
import os
import libvirt
from contextlib import asynccontextmanager

# ---------------- Libvirt Connection ----------------
LIBVIRT_CONNECTION = None

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

class MetricDataPoint(BaseModel):
    timestamp: datetime
    value: float

class HistoricalMetrics(BaseModel):
    cpu_percent: List[MetricDataPoint]
    memory_mb: List[MetricDataPoint]
    disk_rw_mbps_total: List[MetricDataPoint]
    network_throughput_mbps_total: List[MetricDataPoint]

class EventLog(BaseModel):
    id: str
    timestamp: datetime
    level: str
    message: str
    details: Optional[Dict[str, Any]] = None

# ---------------- Helper Functions ----------------
def _require_conn():
    if not LIBVIRT_CONNECTION:
        raise HTTPException(status_code=503, detail="libvirt 未连接")
    return LIBVIRT_CONNECTION

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
                id=str(dom.ID()),
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
        pool.refresh(0)
        for vol_name in pool.listVolumes():
            vol = pool.storageVolLookupByName(vol_name)
            size_gb = vol.info()[1] / (1024 ** 3)
            images.append(
                VmImage(
                    id=vol_name,
                    name=vol_name,
                    pool=pool.name(),
                    size=f"{size_gb:.1f} GB",
                    path=vol.path(),
                )
            )
    return images

# ---------------- API Endpoints ----------------
@app.get("/api/vm/instances", response_model=List[VmInstance])
def api_vm_instances():
    return fetch_vm_instances()

@app.get("/api/vm/images", response_model=List[VmImage])
def api_vm_images():
    return fetch_vm_images()

@app.get("/api/vm/{vm_id}/overview", response_model=OverviewData)
def get_vm_overview(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
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
    return OverviewData(
        status=status,
        uptime="N/A",
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

@app.post("/api/vm/{vm_id}/overview/{action}", response_model=LifecycleActionResponse)
def manage_vm_lifecycle(vm_id: str, action: str = Path(...)):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
    try:
        if action == "start":
            dom.create()
        elif action == "pause":
            dom.suspend()
        elif action == "resume":
            dom.resume()
        elif action == "shutdown":
            dom.shutdown()
        elif action == "reboot":
            dom.reboot()
        elif action == "force-off":
            dom.destroy()
        else:
            raise HTTPException(status_code=400, detail="未知操作")
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return LifecycleActionResponse(message="ok", vm_id=vm_id, action=action)

@app.get("/api/vm/{vm_id}/snapshots", response_model=List[Snapshot])
def list_vm_snapshots(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
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

@app.post("/api/vm/{vm_id}/snapshots", response_model=Snapshot)
def create_vm_snapshot(vm_id: str, snapshot_data: SnapshotCreate):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
    snap_xml = f"<domainsnapshot><name>{snapshot_data.name}</name><description>{snapshot_data.description or ''}</description></domainsnapshot>"
    try:
        snap = dom.snapshotCreateXML(snap_xml, 0)
        info = snap.getInfo()
        return Snapshot(id=snap.getName(), name=snap.getName(), description=snapshot_data.description, created=datetime.fromtimestamp(info[1]), xml=snap.getXMLDesc())
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vm/{vm_id}/snapshots/{snapshot_id}/revert")
def revert_to_vm_snapshot(vm_id: str, snapshot_id: str):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
    snap = dom.snapshotLookupByName(snapshot_id, 0)
    try:
        snap.revertToSnapshot(0)
        return {"message": "reverted"}
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/vm/{vm_id}/snapshots/{snapshot_id}")
def delete_vm_snapshot(vm_id: str, snapshot_id: str):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
    snap = dom.snapshotLookupByName(snapshot_id, 0)
    try:
        snap.delete(0)
        return None
    except libvirt.libvirtError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vm/{vm_id}/storage/disks", response_model=List[Disk])
def list_vm_disks(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
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

@app.get("/api/vm/{vm_id}/storage/cdroms", response_model=List[CdRomDevice])
def list_vm_cdroms(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
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

@app.get("/api/vm/{vm_id}/network/vnics", response_model=List[VirtualNic])
def list_vm_vnics(vm_id: str):
    conn = _require_conn()
    dom = conn.lookupByID(int(vm_id))
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

@app.get("/api/vm/{vm_id}/performance/historical", response_model=HistoricalMetrics)
def get_historical_performance(vm_id: str, range: str = "1h"):
    # 由于缺乏持久化，此处仅返回空数据
    return HistoricalMetrics(cpu_percent=[], memory_mb=[], disk_rw_mbps_total=[], network_throughput_mbps_total=[])

@app.get("/api/vm/{vm_id}/events", response_model=List[EventLog])
def list_vm_events(vm_id: str):
    # 未实现事件持久化，暂返回空列表
    return []

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_API_PORT", "3010"))
    uvicorn.run(app, host="0.0.0.0", port=port)
