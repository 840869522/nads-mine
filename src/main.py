from fastapi import FastAPI, HTTPException, Path, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import uuid4
from datetime import datetime, timedelta
import random
import platform
import os
# import libvirt # Uncomment when libvirt is actually used and installed
from enum import Enum # Added for EventLogLevel
from contextlib import asynccontextmanager # Added for lifespan manager

# --- Libvirt Connection Framework ---
LIBVIRT_CONNECTION = None

def get_libvirt_connection():
    """Attempts to establish a libvirt connection based on the OS."""
    global libvirt # Make sure to use the global import if it's conditional
    try:
        import libvirt # Try importing here, so it's only required if this function is called
    except ImportError:
        print("Libvirt-python library not found. Please install it to connect to libvirt.")
        return None

    conn = None
    uri = "qemu:///system" # Assuming development is now directly within WSL or a Linux environment

    print(f"Attempting local libvirt connection (WSL/Linux): {uri}")
    try:
        conn = libvirt.open(uri)
    except libvirt.libvirtError as e:
        print(f"Failed to connect to local libvirt ({uri}): {e}")
        print("Ensure libvirtd service is active and configured in your WSL/Linux environment.")
        conn = None

    if conn is None:
        print("Failed to establish libvirt connection. API will use mock data or operate in a limited mode.")
    else:
        print("Successfully connected to libvirt service.")
    return conn

@asynccontextmanager
async def lifespan(app_instance: FastAPI): # app_instance is the FastAPI app
    global LIBVIRT_CONNECTION
    print("FastAPI application starting up (lifespan). Attempting to initialize libvirt connection...")
    LIBVIRT_CONNECTION = get_libvirt_connection()
    if LIBVIRT_CONNECTION:
        try:
            hostname = LIBVIRT_CONNECTION.getHostname()
            print(f"Libvirt connection successful (lifespan). Hostname: {hostname}")
        except Exception as e:
            print(f"Libvirt connection established but failed to get hostname (lifespan): {e}")
            LIBVIRT_CONNECTION = None
            print("Reverted to no Libvirt connection due to post-connection check failure (lifespan).")
    else:
        print("Libvirt connection failed during startup (lifespan). Backend will use mock data.")
        print("Ensure libvirt service is running and configured correctly.")
        print("- On Linux/WSL: Check 'sudo systemctl status libvirtd' or 'sudo service libvirtd status'.")
        print("- On Windows (for WSL connection): Set WSL_LIBVIRT_IP and ensure WSL's libvirtd listens on TCP.")

    yield # Application runs here

    # Shutdown logic
    if LIBVIRT_CONNECTION:
        print("FastAPI application shutting down (lifespan). Closing libvirt connection...")
        try:
            LIBVIRT_CONNECTION.close()
            print("Libvirt connection closed (lifespan).")
        except Exception as e:
            print(f"Error closing libvirt connection (lifespan): {e}")
        LIBVIRT_CONNECTION = None

# --- End Libvirt Connection Framework ---


app = FastAPI(
    title="VM Management API",
    description="API for managing virtual machines (mock implementation)",
    version="0.1.0",
    lifespan=lifespan # Added lifespan manager
)

# Remove old on_event handlers if they exist (they were in a previous version of the file)
# @app.on_event("startup")
# async def startup_event():
#     ...
#
# @app.on_event("shutdown")
# async def shutdown_event():
#     ...

# --- Pydantic Models ---

class VmIdPath(BaseModel):
    vm_id: str = Path(..., description="The ID of the virtual machine (currently ignored, uses mock data for a single VM)")

# Overview Models
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
    pool: str # Assuming this refers to a storage pool concept
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

# Snapshots Models
class SnapshotBase(BaseModel):
    name: str = Field(..., example="My Snapshot")
    description: Optional[str] = Field(None, example="A brief description of the snapshot")

class SnapshotCreate(SnapshotBase):
    pass

class Snapshot(SnapshotBase):
    id: str = Field(..., example="snap_1678886400")
    created: datetime = Field(..., example=datetime.now())
    parentId: Optional[str] = Field(None, example="snap_parent_123")
    size_mb: int = Field(..., example=1024) # Simplified size
    xml: Optional[str] = Field(None, example="<domainsnapshot>...</domainsnapshot>")


# --- Mock Data Store ---
# Using global variables for mock data for simplicity in this example.
# In a real app, this would be a database or direct libvirt calls.

mock_vm_overview = OverviewData(
    status="running",
    uptime="1d 02:30:15",
    hostNode="mock-hypervisor-01",
    pool="default_pool",
    vcpu=VCPUInfo(count=4, usage_percent=random.uniform(10, 70)),
    vram=VRAMInfo(total_mb=8192, usage_mb=random.randint(2048, 6144), usage_percent=0.0), # usage_percent will be calculated
    bootSource="Hard Disk",
    uuid=str(uuid4()),
    ipAddress="192.168.122.101",
    disks_rw_mbps=random.uniform(5, 50),
    network_throughput_mbps=random.uniform(1, 20)
)
mock_vm_overview.vram.usage_percent = (mock_vm_overview.vram.usage_mb / mock_vm_overview.vram.total_mb) * 100

mock_snapshots_db: Dict[str, Snapshot] = {}

def init_mock_snapshots():
    snap1_id = f"snap_{int(datetime.now().timestamp()) - 3600*24*5}"
    snap1 = Snapshot(
        id=snap1_id,
        name="Base Installation",
        description="Clean OS install with updates.",
        created=datetime.now() - timedelta(days=5),
        parentId=None,
        size_mb=20480, # 20GB
        xml=f"<domainsnapshot><name>Base Installation</name><memory snapshot='no'/><disks><disk name='vda' snapshot='internal'/></disks></domainsnapshot>"
    )
    mock_snapshots_db[snap1.id] = snap1

    snap2_id = f"snap_{int(datetime.now().timestamp()) - 3600*24*2}"
    snap2 = Snapshot(
        id=snap2_id,
        name="Development Tools Installed",
        description="After installing IDE and other tools.",
        created=datetime.now() - timedelta(days=2),
        parentId=snap1.id,
        size_mb=5120, # 5GB diff
        xml=f"<domainsnapshot><name>Development Tools Installed</name><memory snapshot='no'/><disks><disk name='vda' snapshot='internal'/></disks></domainsnapshot>"
    )
    mock_snapshots_db[snap2.id] = snap2

init_mock_snapshots()


# --- API Endpoints ---

# Overview Endpoints
@app.get("/api/vm/{vm_id}/overview", response_model=OverviewData, tags=["Overview"])
async def get_vm_overview(vm_id: str):
    # In a real app, vm_id would be used to lookup with libvirt
    # For now, return mock data, updating dynamic fields
    mock_vm_overview.vcpu.usage_percent = random.uniform(10, 70)
    mock_vm_overview.vram.usage_mb = random.randint(2048, mock_vm_overview.vram.total_mb)
    mock_vm_overview.vram.usage_percent = (mock_vm_overview.vram.usage_mb / mock_vm_overview.vram.total_mb) * 100
    mock_vm_overview.disks_rw_mbps = random.uniform(5, 50)
    mock_vm_overview.network_throughput_mbps = random.uniform(1, 20)
    # Simulate uptime increase if status is running
    if mock_vm_overview.status == "running":
         # This is a very simplified uptime update. A real one would parse and add.
        parts = mock_vm_overview.uptime.split(" ")
        try:
            days = int(parts[0][:-1])
            time_parts = parts[1].split(":")
            hours = int(time_parts[0])
            minutes = int(time_parts[1])
            seconds = int(time_parts[2])

            total_seconds = seconds + minutes*60 + hours*3600 + days*86400
            total_seconds += random.randint(1,5) # Add a few seconds each call

            new_days = total_seconds // 86400
            rem_seconds = total_seconds % 86400
            new_hours = rem_seconds // 3600
            rem_seconds %= 3600
            new_minutes = rem_seconds // 60
            new_seconds = rem_seconds % 60
            mock_vm_overview.uptime = f"{new_days}d {str(new_hours).zfill(2)}:{str(new_minutes).zfill(2)}:{str(new_seconds).zfill(2)}"
        except:
            pass # Ignore parsing errors for mock uptime

    return mock_vm_overview

# Lifecycle actions
@app.post("/api/vm/{vm_id}/overview/{action}", response_model=LifecycleActionResponse, tags=["Overview"])
async def manage_vm_lifecycle(vm_id: str, action: str = Path(..., description="Lifecycle action: start, pause, resume, shutdown, reboot, force-off")):
    valid_actions = ["start", "pause", "resume", "shutdown", "reboot", "force-off"]
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail="Invalid lifecycle action.")

    current_status = mock_vm_overview.status
    message = f"VM '{vm_id}' action '{action}' initiated."

    if action == "start":
        if current_status == "shutdown":
            mock_vm_overview.status = "running"
            mock_vm_overview.uptime = "0d 00:00:00" # Reset uptime
        else:
            message = f"VM '{vm_id}' is already {current_status}. Cannot start."
            # raise HTTPException(status_code=409, detail=message) # Conflict
    elif action == "pause":
        if current_status == "running":
            mock_vm_overview.status = "paused"
        else:
            message = f"VM '{vm_id}' must be running to pause. Current status: {current_status}."
    elif action == "resume":
        if current_status == "paused":
            mock_vm_overview.status = "running"
        else:
            message = f"VM '{vm_id}' must be paused to resume. Current status: {current_status}."
    elif action == "shutdown": # Gentle shutdown
        if current_status in ["running", "paused"]:
            mock_vm_overview.status = "shutdown"
        else:
            message = f"VM '{vm_id}' is already {current_status} or cannot be shutdown gently."
    elif action == "reboot": # Gentle reboot
        if current_status == "running":
            mock_vm_overview.status = "running" # Simulates reboot: remains running
            mock_vm_overview.uptime = "0d 00:00:00" # Reset uptime
        else:
            message = f"VM '{vm_id}' must be running to reboot. Current status: {current_status}."
    elif action == "force-off": # Destroy
        mock_vm_overview.status = "shutdown" # Effectively same as shutdown in mock

    return LifecycleActionResponse(message=message, vm_id=vm_id, action=action)


# Snapshots Endpoints
@app.get("/api/vm/{vm_id}/snapshots", response_model=List[Snapshot], tags=["Snapshots"])
async def list_vm_snapshots(vm_id: str):
    # vm_id ignored for now
    return sorted(list(mock_snapshots_db.values()), key=lambda s: s.created)

@app.post("/api/vm/{vm_id}/snapshots", response_model=Snapshot, status_code=201, tags=["Snapshots"])
async def create_vm_snapshot(vm_id: str, snapshot_data: SnapshotCreate = Body(...)):
    # vm_id ignored
    new_id = f"snap_{int(datetime.now().timestamp())}"
    # Determine parentId: if a snapshot is selected in UI, it could be passed.
    # For mock, let's assume the latest snapshot is the parent if not specified.
    parent_id = None
    if mock_snapshots_db:
        latest_snapshot = sorted(mock_snapshots_db.values(), key=lambda s: s.created, reverse=True)
        if latest_snapshot:
            parent_id = latest_snapshot[0].id
            # A more sophisticated mock might take parentId from request if provided

    new_snapshot = Snapshot(
        id=new_id,
        name=snapshot_data.name,
        description=snapshot_data.description,
        created=datetime.now(),
        parentId=parent_id, # Mock: could be based on selected snapshot in UI
        size_mb=random.randint(100, 2000), # Mock size
        xml=f"<domainsnapshot><name>{snapshot_data.name}</name><description>{snapshot_data.description or ''}</description></domainsnapshot>"
    )
    mock_snapshots_db[new_id] = new_snapshot
    return new_snapshot

@app.post("/api/vm/{vm_id}/snapshots/{snapshot_id}/revert", tags=["Snapshots"])
async def revert_to_vm_snapshot(vm_id: str, snapshot_id: str = Path(..., description="ID of the snapshot to revert to")):
    # vm_id ignored
    if snapshot_id not in mock_snapshots_db:
        raise HTTPException(status_code=404, detail=f"Snapshot with ID '{snapshot_id}' not found.")
    # Mock action: just a message. In reality, VM state would change.
    mock_vm_overview.status = "running" # Assume VM is running after revert
    mock_vm_overview.uptime = "0d 00:00:00" # Uptime might reset
    return {"message": f"VM '{vm_id}' reverted to snapshot '{mock_snapshots_db[snapshot_id].name}' (mock action)."}

@app.delete("/api/vm/{vm_id}/snapshots/{snapshot_id}", status_code=204, tags=["Snapshots"])
async def delete_vm_snapshot(vm_id: str, snapshot_id: str = Path(..., description="ID of the snapshot to delete")):
    # vm_id ignored
    if snapshot_id not in mock_snapshots_db:
        raise HTTPException(status_code=404, detail=f"Snapshot with ID '{snapshot_id}' not found.")

    # Mock: check for children. Real libvirt might handle this differently or require flags.
    children = [sid for sid, snap in mock_snapshots_db.items() if snap.parentId == snapshot_id]
    if children:
        # Simplistic mock: delete children too. Real app might prevent or offer re-parenting.
        for child_id in children:
            del mock_snapshots_db[child_id]
        # raise HTTPException(status_code=409, detail=f"Snapshot '{mock_snapshots_db[snapshot_id].name}' has children. Delete them first or use a recursive delete option (mock limitation).")

    del mock_snapshots_db[snapshot_id]
    return None # No content for 204

# --- Storage Models & Endpoints ---
class Disk(BaseModel):
    id: str
    target: str
    source: str
    format: str # qcow2, raw
    bus: str # virtio, sata, scsi, ide
    capacity_gb: int
    allocated_gb: int
    iops_rw: Optional[str] = None # e.g., "120/60"

class CreateDisk(BaseModel):
    pool_name: str = Field("default", example="data_pool")
    capacity_gb: int = Field(..., example=20, gt=0)
    format: str = Field("qcow2", example="qcow2", pattern="^(qcow2|raw)$")
    bus: str = Field("virtio", example="virtio", pattern="^(virtio|sata|scsi|ide)$")

class ResizeDisk(BaseModel):
    new_capacity_gb: int = Field(..., example=100, gt=0)

class CdRomDevice(BaseModel):
    id: str
    target: str
    source_iso: Optional[str] = None
    mounted: bool

class MountIso(BaseModel):
    iso_path: str = Field(..., example="/isos/ubuntu-live.iso")


mock_disks_db: Dict[str, Disk] = {
    "disk_vda": Disk(id="disk_vda", target="vda", source="/var/lib/libvirt/images/vm1-disk1.qcow2", format="qcow2", bus="virtio", capacity_gb=50, allocated_gb=25, iops_rw="120/60"),
    "disk_vdb": Disk(id="disk_vdb", target="vdb", source="pool1/vm1-disk2.raw", format="raw", bus="sata", capacity_gb=100, allocated_gb=80, iops_rw="90/40"),
}

mock_cdroms_db: Dict[str, CdRomDevice] = {
    "cdrom_sda": CdRomDevice(id="cdrom_sda", target="sda", mounted=True, source_iso="/isos/ubuntu-22.04.iso"),
    "cdrom_sdb": CdRomDevice(id="cdrom_sdb", target="sdb", mounted=False),
}


@app.get("/api/vm/{vm_id}/storage/disks", response_model=List[Disk], tags=["Storage"])
async def list_vm_disks(vm_id: str):
    return list(mock_disks_db.values())

@app.post("/api/vm/{vm_id}/storage/disks", response_model=Disk, status_code=201, tags=["Storage"])
async def add_vm_disk(vm_id: str, disk_data: CreateDisk):
    new_target_char_code = ord('a') + len(mock_disks_db)
    if new_target_char_code > ord('z'): # Simple check for too many disks
        new_target_char_code = random.randint(ord('a'), ord('z')) # fallback for mock

    new_target = f"vd{chr(new_target_char_code)}"
    new_disk_id = f"disk_{new_target}"

    if new_disk_id in mock_disks_db : # handle unlikely collision in mock
        new_target = f"vd{chr(new_target_char_code)}{random.randint(1,9)}"
        new_disk_id = f"disk_{new_target}"


    new_disk = Disk(
        id=new_disk_id,
        target=new_target,
        source=f"{disk_data.pool_name}/new_disk_{new_target}.{disk_data.format}",
        format=disk_data.format,
        bus=disk_data.bus,
        capacity_gb=disk_data.capacity_gb,
        allocated_gb=0, # New disks start with 0 allocated for mock
        iops_rw="0/0"
    )
    mock_disks_db[new_disk_id] = new_disk
    return new_disk

@app.delete("/api/vm/{vm_id}/storage/disks/{disk_id}", status_code=204, tags=["Storage"])
async def delete_vm_disk(vm_id: str, disk_id: str):
    if disk_id not in mock_disks_db:
        raise HTTPException(status_code=404, detail=f"Disk with ID '{disk_id}' not found.")
    del mock_disks_db[disk_id]
    return None

@app.post("/api/vm/{vm_id}/storage/disks/{disk_id}/resize", response_model=Disk, tags=["Storage"])
async def resize_vm_disk(vm_id: str, disk_id: str, resize_data: ResizeDisk):
    if disk_id not in mock_disks_db:
        raise HTTPException(status_code=404, detail=f"Disk with ID '{disk_id}' not found.")

    disk_to_resize = mock_disks_db[disk_id]
    if resize_data.new_capacity_gb <= disk_to_resize.capacity_gb:
        raise HTTPException(status_code=400, detail="New capacity must be greater than current capacity.")

    disk_to_resize.capacity_gb = resize_data.new_capacity_gb
    # In a real scenario, allocated_gb might also change or need checks
    return disk_to_resize


@app.get("/api/vm/{vm_id}/storage/cdroms", response_model=List[CdRomDevice], tags=["Storage"])
async def list_vm_cdroms(vm_id: str):
    return list(mock_cdroms_db.values())

@app.post("/api/vm/{vm_id}/storage/cdroms/{cdrom_id}/mount", response_model=CdRomDevice, tags=["Storage"])
async def mount_iso_to_cdrom(vm_id: str, cdrom_id: str, mount_data: MountIso):
    if cdrom_id not in mock_cdroms_db:
        raise HTTPException(status_code=404, detail=f"CD-ROM device with ID '{cdrom_id}' not found.")

    cdrom_device = mock_cdroms_db[cdrom_id]
    cdrom_device.source_iso = mount_data.iso_path
    cdrom_device.mounted = True
    return cdrom_device

@app.post("/api/vm/{vm_id}/storage/cdroms/{cdrom_id}/eject", response_model=CdRomDevice, tags=["Storage"])
async def eject_iso_from_cdrom(vm_id: str, cdrom_id: str):
    if cdrom_id not in mock_cdroms_db:
        raise HTTPException(status_code=404, detail=f"CD-ROM device with ID '{cdrom_id}' not found.")

    cdrom_device = mock_cdroms_db[cdrom_id]
    cdrom_device.source_iso = None
    cdrom_device.mounted = False
    return cdrom_device


# --- Network Models & Endpoints ---
class VirtualNic(BaseModel):
    id: str
    mac: str
    bridge: str
    model: str # virtio, e1000, rtl8139
    pciAddress: Optional[str] = None
    rx_rate_kbps: int
    tx_rate_kbps: int
    status: str # active, inactive, unplugged
    bandwidth_limit_mbps: Optional[int] = None
    vlan_tag: Optional[int] = None

class CreateNic(BaseModel):
    bridge: str = Field("virbr0", example="virbr0")
    model: str = Field("virtio", example="virtio", pattern="^(virtio|e1000|rtl8139)$")
    vlan_tag: Optional[int] = Field(None, example=10, ge=1, le=4094)
    bandwidth_limit_mbps: Optional[int] = Field(None, example=100, gt=0)

class UpdateNic(CreateNic): # Can reuse CreateNic for updates, or make specific fields optional
    pass


mock_vnics_db: Dict[str, VirtualNic] = {
    "nic_525400AABBCC": VirtualNic(id="nic_525400AABBCC", mac="52:54:00:AA:BB:CC", bridge="virbr0", model="virtio", pciAddress="0000:01:00.0", rx_rate_kbps=random.randint(0,2000), tx_rate_kbps=random.randint(0,1000), status="active", bandwidth_limit_mbps=100, vlan_tag=10),
    "nic_525400DDEEFF": VirtualNic(id="nic_525400DDEEFF", mac="52:54:00:DD:EE:FF", bridge="br-lan", model="e1000", pciAddress="0000:02:00.0", rx_rate_kbps=0, tx_rate_kbps=0, status="inactive"),
}

def generate_mac():
    return "52:54:00:" + ":".join(f"{random.randint(0, 255):02X}" for _ in range(3))


@app.get("/api/vm/{vm_id}/network/vnics", response_model=List[VirtualNic], tags=["Network"])
async def list_vm_vnics(vm_id: str):
    # Simulate dynamic rates
    for nic in mock_vnics_db.values():
        if nic.status == "active":
            nic.rx_rate_kbps = random.randint(0, 2000)
            nic.tx_rate_kbps = random.randint(0, 1000)
        else:
            nic.rx_rate_kbps = 0
            nic.tx_rate_kbps = 0
    return list(mock_vnics_db.values())

@app.post("/api/vm/{vm_id}/network/vnics", response_model=VirtualNic, status_code=201, tags=["Network"])
async def attach_vm_vnic(vm_id: str, nic_data: CreateNic):
    new_mac = generate_mac()
    new_id = f"nic_{new_mac.replace(':', '')}"
    # Simplified PCI address for mock
    pci_slot = len(mock_vnics_db) + 1

    new_vnic = VirtualNic(
        id=new_id,
        mac=new_mac,
        bridge=nic_data.bridge,
        model=nic_data.model,
        pciAddress=f"0000:0{pci_slot}:00.0",
        rx_rate_kbps=0,
        tx_rate_kbps=0,
        status="active", # Assume new NICs are active
        bandwidth_limit_mbps=nic_data.bandwidth_limit_mbps,
        vlan_tag=nic_data.vlan_tag
    )
    mock_vnics_db[new_id] = new_vnic
    return new_vnic

@app.put("/api/vm/{vm_id}/network/vnics/{vnic_id}", response_model=VirtualNic, tags=["Network"])
async def update_vm_vnic(vm_id: str, vnic_id: str, nic_data: UpdateNic):
    if vnic_id not in mock_vnics_db:
        raise HTTPException(status_code=404, detail=f"vNIC with ID '{vnic_id}' not found.")

    vnic_to_update = mock_vnics_db[vnic_id]
    vnic_to_update.bridge = nic_data.bridge
    vnic_to_update.model = nic_data.model
    vnic_to_update.vlan_tag = nic_data.vlan_tag
    vnic_to_update.bandwidth_limit_mbps = nic_data.bandwidth_limit_mbps
    # Note: MAC, PCI, status changes are more complex and not handled simply here.
    return vnic_to_update

@app.delete("/api/vm/{vm_id}/network/vnics/{vnic_id}", status_code=204, tags=["Network"])
async def detach_vm_vnic(vm_id: str, vnic_id: str):
    if vnic_id not in mock_vnics_db:
        raise HTTPException(status_code=404, detail=f"vNIC with ID '{vnic_id}' not found.")
    del mock_vnics_db[vnic_id]
    return None


# --- Performance Models & Endpoints ---
class MetricDataPoint(BaseModel):
    timestamp: datetime
    value: float

class HistoricalMetrics(BaseModel):
    cpu_percent: List[MetricDataPoint]
    memory_mb: List[MetricDataPoint]
    # Disk and Network can be more complex (read/write, rx/tx)
    # For simplicity, using single values for now.
    disk_rw_mbps_total: List[MetricDataPoint]
    network_throughput_mbps_total: List[MetricDataPoint]

# Mock historical data generator
def generate_historical_data(range_str: str, points: int = 60) -> HistoricalMetrics:
    now = datetime.now()
    metrics = {
        "cpu_percent": [], "memory_mb": [],
        "disk_rw_mbps_total": [], "network_throughput_mbps_total": []
    }

    time_delta_map = {"1h": timedelta(hours=1), "24h": timedelta(days=1), "7d": timedelta(days=7)}
    total_duration = time_delta_map.get(range_str, timedelta(hours=1))
    time_step = total_duration / points

    for i in range(points):
        ts = now - total_duration + (i * time_step)
        metrics["cpu_percent"].append(MetricDataPoint(timestamp=ts, value=random.uniform(5, 80)))
        metrics["memory_mb"].append(MetricDataPoint(timestamp=ts, value=random.uniform(1024, mock_vm_overview.vram.total_mb * 0.9)))
        metrics["disk_rw_mbps_total"].append(MetricDataPoint(timestamp=ts, value=random.uniform(1, 30)))
        metrics["network_throughput_mbps_total"].append(MetricDataPoint(timestamp=ts, value=random.uniform(0.5, 15)))

    return HistoricalMetrics(**metrics)


@app.get("/api/vm/{vm_id}/performance/current", response_model=OverviewData, tags=["Performance"]) # Reusing OverviewData for simplicity
async def get_current_performance(vm_id: str):
    # This is largely redundant with /overview, but specific to "current performance" numbers
    # In a real system, this might poll more frequently or use different aggregation
    return await get_vm_overview(vm_id) # Just call the existing overview logic

@app.get("/api/vm/{vm_id}/performance/historical", response_model=HistoricalMetrics, tags=["Performance"])
async def get_historical_performance(vm_id: str, range: str = "1h"):
    if range not in ["1h", "24h", "7d"]:
        raise HTTPException(status_code=400, detail="Invalid range. Must be one of: 1h, 24h, 7d.")
    return generate_historical_data(range)


# --- Events Models & Endpoints ---
class EventLogLevel(str, Enum): # Changed to inherit from str and Enum
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    DEBUG = "debug"

class EventLog(BaseModel):
    id: str
    timestamp: datetime
    level: EventLogLevel
    message: str
    details: Optional[Dict[str, Any]] = None


mock_events_db: List[EventLog] = []

def init_mock_events():
    base_time = datetime.now()
    mock_events_db.extend([
        EventLog(id=str(uuid4()), timestamp=base_time - timedelta(hours=2), level=EventLogLevel.INFO, message="VM Guest OS booted successfully.", details={"source": "kernel"}),
        EventLog(id=str(uuid4()), timestamp=base_time - timedelta(minutes=50), level=EventLogLevel.DEBUG, message="Network interface eth0 link up.", details={"speed": "1000Mbps"}),
        EventLog(id=str(uuid4()), timestamp=base_time - timedelta(minutes=30), level=EventLogLevel.WARNING, message="High CPU utilization detected.", details={"usage": "92%", "threshold": "90%"}),
        EventLog(id=str(uuid4()), timestamp=base_time - timedelta(minutes=10), level=EventLogLevel.INFO, message=f"Snapshot '{list(mock_snapshots_db.values())[0].name if mock_snapshots_db else 'backup_daily'}' created.", details={"user": "admin"}),
        EventLog(id=str(uuid4()), timestamp=base_time - timedelta(minutes=5), level=EventLogLevel.ERROR, message="Failed to attach storage volume 'data_vol_03'.", details={"reason": "Volume not found"}),
        EventLog(id=str(uuid4()), timestamp=base_time - timedelta(minutes=1), level=EventLogLevel.INFO, message="User 'jdoe' connected via VNC.", details={"ip": "192.168.1.105"}),
    ])
    # Periodically add a new mock event if live tail is considered
    # For now, this is just initial data.

init_mock_events()

@app.get("/api/vm/{vm_id}/events", response_model=List[EventLog], tags=["Events"])
async def list_vm_events(
    vm_id: str,
    level: Optional[EventLogLevel] = None,
    keyword: Optional[str] = None,
    time_window: Optional[str] = None, # e.g., "1h", "6h", "24h", "all"
    limit: int = 100
):
    filtered_events = mock_events_db

    if level:
        filtered_events = [e for e in filtered_events if e.level == level]

    if keyword:
        kw = keyword.lower()
        filtered_events = [
            e for e in filtered_events
            if kw in e.message.lower() or (e.details and kw in str(e.details).lower())
        ]

    if time_window and time_window != "all":
        now = datetime.now()
        delta = None
        if time_window == "1h": delta = timedelta(hours=1)
        elif time_window == "6h": delta = timedelta(hours=6)
        elif time_window == "24h": delta = timedelta(days=1)

        if delta:
            start_time = now - delta
            filtered_events = [e for e in filtered_events if e.timestamp >= start_time]

    return sorted(filtered_events, key=lambda e: e.timestamp, reverse=True)[:limit]


# (Optional) Add a requirements.txt for the backend
# For now, dependencies are fastapi, uvicorn, python-dotenv (optional), libvirt-python (when used)

# To run this application:
# 1. Save as backend/main.py
# 2. Install dependencies: pip install fastapi uvicorn
# 3. Run from the project root: uvicorn backend.main:app --reload --port 8000
#    (or from backend folder: uvicorn main:app --reload --port 8000)

# --- Libvirt Connection Framework ---
LIBVIRT_CONNECTION = None

def get_libvirt_connection():
    """Attempts to establish a libvirt connection based on the OS."""
    global libvirt # Make sure to use the global import if it's conditional
    try:
        import libvirt # Try importing here, so it's only required if this function is called
    except ImportError:
        print("Libvirt-python library not found. Please install it to connect to libvirt.")
        return None

    system = platform.system()
    conn = None
    uri = None

    if system == "Linux":
        uri = "qemu:///system"
        print(f"Detected Linux system. Attempting local libvirt connection: {uri}")
        try:
            conn = libvirt.open(uri)
        except libvirt.libvirtError as e:
            print(f"Failed to connect to local libvirt (Linux): {e}")
            if os.getenv("WSL_DISTRO_NAME"):
                print("Running inside WSL, but local connection failed. Ensure libvirtd service is active and configured.")
            conn = None
    elif system == "Windows":
        wsl_ip = os.getenv("WSL_LIBVIRT_IP")
        if not wsl_ip:
            print("Windows system: WSL_LIBVIRT_IP environment variable not set. Cannot connect to WSL libvirt.")
            # Optionally, attempt to dynamically get WSL IP here if desired, as discussed previously.
            # For now, we rely on the environment variable.
            return None

        uri = f"qemu+tcp://{wsl_ip}:16509/system" # Default libvirt TCP port
        print(f"Detected Windows system. Attempting to connect to WSL libvirt via TCP: {uri}")
        try:
            conn = libvirt.open(uri)
        except libvirt.libvirtError as e:
            print(f"Failed to connect to WSL libvirt via TCP (Windows): {e}")
            conn = None
    else:
        print(f"Unsupported OS for libvirt connection: {system}")
        return None

    if conn is None:
        print("Failed to establish libvirt connection. API will use mock data or operate in a limited mode.")
    else:
        print("Successfully connected to libvirt service.")
    return conn

# @app.on_event("startup") # REMOVED - Replaced by lifespan manager
# async def startup_event():
#     global LIBVIRT_CONNECTION
#     print("FastAPI application starting up. Attempting to initialize libvirt connection...")
#     LIBVIRT_CONNECTION = get_libvirt_connection()
#     if LIBVIRT_CONNECTION:
#         try:
#             hostname = LIBVIRT_CONNECTION.getHostname()
#             print(f"Libvirt connection successful. Hostname: {hostname}")
#         except Exception as e: # Catch potential errors if connection drops immediately
#             print(f"Libvirt connection established but failed to get hostname: {e}")
#             LIBVIRT_CONNECTION = None # Reset if post-connection check fails
#             print("Reverted to no Libvirt connection due to post-connection check failure.")
#     else:
#         print("Libvirt connection failed during startup. Backend will use mock data.")
#         print("Ensure libvirt service is running and configured correctly.")
#         print("- On Linux/WSL: Check 'sudo systemctl status libvirtd' or 'sudo service libvirtd status'.")
#         print("- On Windows (for WSL connection): Set WSL_LIBVIRT_IP and ensure WSL's libvirtd listens on TCP.")

# @app.on_event("shutdown") # REMOVED - Replaced by lifespan manager
# async def shutdown_event():
#     global LIBVIRT_CONNECTION
#     if LIBVIRT_CONNECTION:
#         print("FastAPI application shutting down. Closing libvirt connection...")
#         try:
#             LIBVIRT_CONNECTION.close()
#             print("Libvirt connection closed.")
#         except Exception as e: # Use generic Exception for libvirt.libvirtError if import is conditional
#             print(f"Error closing libvirt connection: {e}")
#         LIBVIRT_CONNECTION = None

# --- End Libvirt Connection Framework ---

# Note: The lifespan manager is defined earlier and passed to FastAPI app instance:
# @asynccontextmanager
# async def lifespan(app_instance: FastAPI): ...
# app = FastAPI(..., lifespan=lifespan)

if __name__ == "__main__":
    import uvicorn
    # Ensure PYTHON_API_PORT from server.js (default 8000) is used if main.py is run directly.
    # However, when spawned by server.js, server.js controls the port uvicorn *should* listen on.
    # For direct execution (python src/main.py), we'll use a common default.
    # The uvicorn.run() call here is primarily for when this script is executed directly.
    # When server.js runs this script, these specific host/port values are less critical
    # as server.js *expects* it to be on PYTHON_API_PORT.
    # For consistency, we'll use 0.0.0.0 and a default port.

    configured_port = int(os.getenv("PYTHON_API_PORT", "8000"))
    print(f"Attempting to start Uvicorn programmatically on host 0.0.0.0, port {configured_port}")
    uvicorn.run(app, host="0.0.0.0", port=configured_port, log_level="info")
