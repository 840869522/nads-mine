"use client";

import * as React from "react";
import {
    Box,
    Button,
    Divider,
    Menu,
    MenuItem,
    TextField,
    Typography,
    InputAdornment,
    Paper,
    Backdrop,
    CircularProgress,
    Skeleton,
    useTheme,
    IconButton,
    Checkbox,
    Switch,
    FormControlLabel,
} from "@mui/material";
import {
    Search as SearchIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    PlayArrow as StartIcon,
    Stop as StopIcon,
    Pause as PauseIcon,
    RestartAlt as ResetIcon,
    PowerSettingsNew as ForceOffIcon,
    Delete as DeleteIcon,
    DesktopWindows as VncIcon,
    Terminal as SshIcon,
    LaptopWindows as RdpIcon,
    Camera as SnapshotIcon,
    KeyboardArrowDown as ArrowDownIcon,
    AddCircleOutline as AddIcon,
    ViewColumn as ViewColumnIcon,
} from "@mui/icons-material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import useSWR, { mutate as globalMutate } from "swr";

// 保留 OverviewPanel 文件，但此页面不再使用
//import OverviewPanel from "@/components/vm/OverviewPanel";
import CreateVmModal from "@/components/vm/CreateVmModal";

/* ---------- 类型 ---------- */
interface VmInstance {
    id: string;
    name: string;
    hostNode: string;
    pool: string;
    state: "running" | "paused" | "shutoff";
    vcpu: number;
    vmem: number; // MB
    ip?: string;
    scene_instance_id?: string;
    scene_name?: string;
    uptime?: string;
}

interface VCPUInfo {
    count: number;
    usage_percent: number;
}

interface VRAMInfo {
    total_mb: number;
    usage_mb: number;
    usage_percent: number;
}

interface OverviewData {
    status: string;
    hostNode: string;
    pool: string;
    vcpu: VCPUInfo;
    vram: VRAMInfo;
    osType?: string;
    persistent?: boolean;
    autostart?: boolean;
    uuid: string;
    ipAddress: string;
}

/* ---------- SWR Hook ---------- */
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function useVmInstances(forceRef?: React.MutableRefObject<number>) {
    const {
        data,
        error,
        isLoading,
        isValidating,
        mutate, // 若后面需要手动刷新可用
    } = useSWR<VmInstance[]>("/back/api/vms", fetcher, {
        // 10 s 内认为数据“新鲜”，避免短时间重复请求
        dedupingInterval: 10_000,
        keepPreviousData: true,

        /* 智能轮询：有 pending 状态 ➜ 5 s；全部 running ➜ 30 s */
        refreshInterval: (latest: VmInstance[] | undefined) => {
            // 动作触发后，在一定时间内保持快速轮询
            if (forceRef && Date.now() < forceRef.current) return 5_000;
            if (!latest) return 5_000; // 首次
            const unstable = latest.some((vm) =>
                ["paused", "shutoff"].includes(vm.state)
            );
            return unstable ? 5_000 : 30_000;
        },

        /* 标签页不可见/后台时不轮询 */
        refreshWhenHidden: false,
        /* 聚焦窗口时会自动 revalidate，保留默认 true */
        revalidateOnFocus: true,
    });

    return { data, error, isLoading, isValidating, mutate };
}

function useVmInfo(vmId: string) {
    return useSWR<OverviewData>(vmId ? `/back/api/vms/${vmId}` : null, fetcher, {
        refreshInterval: 30_000,
        dedupingInterval: 10_000,
        keepPreviousData: true,
    });
}

function VmInfoCell({ id, width, children }: { id: string; width?: number; children: (d: OverviewData) => React.ReactNode }) {
    const { data } = useVmInfo(id);
    return data ? <>{children(data)}</> : <Skeleton width={width ?? 40} />;
}

/* ---------- 状态图标 ---------- */
function stateIcon(state: VmInstance["state"]) {
    switch (state) {
        case "running":
            return <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />;
        case "paused":
            return <WarningIcon sx={{ fontSize: 16, color: "warning.main" }} />;
        default:
            return <ErrorIcon sx={{ fontSize: 16, color: "grey.500" }} />;
    }
}

export default function VmPage() {
    /* ---- SWR 数据 ---- */
    const forceRefreshUntil = React.useRef(0);
    const { data, isLoading, isValidating, mutate } = useVmInstances(forceRefreshUntil);

    /* ---- 本地 UI 状态 ---- */
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [actionAnchor, setActionAnchor] = React.useState<{ anchor: HTMLElement | null; id: string | null }>({ anchor: null, id: null });
    const [actionLoading, setActionLoading] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [showRunningOnly, setShowRunningOnly] = React.useState(false);
    const [columnAnchor, setColumnAnchor] = React.useState<null | HTMLElement>(null);
    const [showColumns, setShowColumns] = React.useState({
        hostNode: false,
        pool: false,
        persistent: false,
        autostart: false,
    });


    /* ---- 列定义 ---- */
    const columns = React.useMemo<GridColDef[]>(
        () => [
            {
                field: 'status',
                headerName: '状态',
                width: 80,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={20}>{d => stateIcon(d.status as any)}</VmInfoCell>
                ),
            },
            { field: 'name', headerName: '名称', flex: 1 },
            { field: 'scene_name', headerName: '场景名称', width: 160 },
            { field: 'scene_instance_id', headerName: '场景实例ID', width: 160 },
            {
                field: 'osType',
                headerName: 'OS 类型',
                width: 120,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={80}>{d => d.osType ?? 'N/A'}</VmInfoCell>
                ),
            },
            {
                field: 'hostNode',
                headerName: '宿主机',
                width: 120,
                hide: !showColumns.hostNode,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={80}>{d => d.hostNode}</VmInfoCell>
                ),
            },
            {
                field: 'pool',
                headerName: '存储池',
                width: 120,
                hide: !showColumns.pool,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={60}>{d => d.pool}</VmInfoCell>
                ),
            },
            {
                field: 'persistent',
                headerName: '持久化',
                width: 80,
                hide: !showColumns.persistent,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={30}>{d => d.persistent ? '是' : '否'}</VmInfoCell>
                ),
            },
            {
                field: 'autostart',
                headerName: '自动启动',
                width: 80,
                hide: !showColumns.autostart,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={30}>{d => d.autostart ? '是' : '否'}</VmInfoCell>
                ),
            },
            {
                field: 'vcpu',
                headerName: 'vCPU',
                width: 80,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={30}>{d => d.vcpu.count}</VmInfoCell>
                ),
            },
            {
                field: 'memory',
                headerName: '内存(MB)',
                width: 100,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={40}>{d => d.vram.total_mb}</VmInfoCell>
                ),
            },
            {
                field: 'ip',
                headerName: 'IP',
                width: 140,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={100}>{d => d.ipAddress}</VmInfoCell>
                ),
            },
            {
                field: 'uuid',
                headerName: 'UUID',
                width: 220,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={200}>{d => d.uuid}</VmInfoCell>
                ),
            },
            {
                field: 'actions',
                headerName: '操作',
                sortable: false,
                width: 160,
                renderCell: (params) => {
                    const vm = params.row as VmInstance;
                    const { data } = useVmInfo(vm.id);
                    const state = data?.status || vm.state;
                    const isRunning = state === 'running';
                    const isPaused = state === 'paused';
                    const notShutoff = state !== 'shutoff';
                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {isRunning ? (
                                <>
                                    <IconButton size="small" onClick={() => handleLifecycle(vm, 'pause')} disabled={actionLoading}>
                                        <PauseIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleLifecycle(vm, 'shutdown')} disabled={actionLoading}>
                                        <StopIcon fontSize="small" color="error" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleLifecycle(vm, 'reboot')} disabled={actionLoading}>
                                        <ResetIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleLifecycle(vm, 'force-off')} disabled={actionLoading}>
                                        <ForceOffIcon fontSize="small" color="error" />
                                    </IconButton>
                                </>
                            ) : (
                                <>
                                    <IconButton size="small" onClick={() => handleLifecycle(vm, isPaused ? 'resume' : 'start')} disabled={actionLoading}>
                                        <StartIcon fontSize="small" color="success" />
                                    </IconButton>
                                </>
                            )}
                            <IconButton size="small" onClick={() => handleDelete(vm)} disabled={actionLoading}>
                                <DeleteIcon fontSize="small" color="error" />
                            </IconButton>
                            <IconButton size="small" onClick={(e) => setActionAnchor({ anchor: e.currentTarget, id: vm.id })}>
                                <ArrowDownIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    );
                },
            },
        ],
        [actionLoading]
    );

    const theme = useTheme();

    /* ---- 行过滤 ---- */
    const filteredRows = React.useMemo(() => {
        let rows = (data ?? []).filter((r) =>
            r.name.toLowerCase().includes(search.toLowerCase())
        );
        if (showRunningOnly) rows = rows.filter((r) => r.state === 'running');
        return rows;
    }, [data, search, showRunningOnly]);

    const handleLifecycle = async (vm: VmInstance, action: string) => {
        setActionLoading(true);
        // 动作触发即刻进入快速轮询模式
        forceRefreshUntil.current = Date.now() + 30_000;
        try {
            const res = await fetch(`/back/api/vms/${vm.id}/actions/${action}`, {
                method: "POST",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || res.statusText);
            }
            const result = (await res.json()) as { state?: string };
            await mutate();
            await globalMutate(`/back/api/vms/${vm.id}`);
            if (result.state !== "shutoff") {
                await globalMutate(`/back/api/vms/${vm.id}/metrics`);
            }
        } catch (e: any) {
            alert(e.message || "Operation failed");
        } finally {
            setActionLoading(false);
        }
    };

    const handleGuac = async (vm: VmInstance, proto: 'ssh' | 'rdp' | 'vnc') => {
        try {
            const res = await fetch(`/back/api/vms/${vm.name}/guac?method=${proto}`);
            if (!res.ok) throw new Error('Guacamole info request failed');
            const info = await res.json();

            const port =
                proto === 'ssh'
                    ? info.ssh_port
                    : proto === 'rdp'
                    ? info.rdp_port
                    : info.vnc_port;
            const url = `/index.html?type=${proto}&hostname=${encodeURIComponent(info.host)}&port=${port}`;
            //const url = `/guac?type=${proto}&hostname=${encodeURIComponent(info.host)}&port=${port}`;
            window.open(url, '_blank');
        } catch (e: any) {
            alert(e.message || 'Failed to open connection');
        }
        // Close the actions menu after attempting to open Guacamole
        setActionAnchor({ anchor: null, id: null });
    };

    const handleDelete = async (vm: VmInstance) => {
        if (!window.confirm(`确定删除虚拟机 ${vm.name}？`)) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/back/api/vms/${vm.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || res.statusText);
            }
            await mutate();
        } catch (e: any) {
            alert(e.message || 'Failed to delete');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* ---------- 顶栏 ---------- */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 3,
                    flexWrap: "wrap",
                    gap: 2,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                    <Typography variant="h4">虚拟机实例管理</Typography>
                    <TextField
                        variant="outlined"
                        placeholder="搜索虚拟机..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        size="small"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ width: { xs: "100%", sm: 260 } }}
                    />
                    <Button startIcon={<ViewColumnIcon />} onClick={(e)=>setColumnAnchor(e.currentTarget)} variant="outlined" size="small">显示列</Button>
                    <FormControlLabel
                        control={<Checkbox checked={showRunningOnly} onChange={(e)=>setShowRunningOnly(e.target.checked)} />}
                        label="只显示运行中的虚拟机"
                    />
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateOpen(true)}
                >
                    创建实例
                </Button>
            </Box>

            <Menu anchorEl={columnAnchor} open={Boolean(columnAnchor)} onClose={() => setColumnAnchor(null)}>
                {Object.entries(showColumns).map(([key, val]) => (
                    <MenuItem key={key}>
                        <FormControlLabel
                            control={<Switch checked={val} onChange={(e) => setShowColumns(prev => ({ ...prev, [key]: e.target.checked }))} color="primary" />}
                            label={
                                key === 'hostNode' ? '宿主机' :
                                key === 'pool' ? '存储池' :
                                key === 'persistent' ? '持久化' :
                                '自动启动'
                            }
                        />
                    </MenuItem>
                ))}
            </Menu>

            {/* ---------- 列表区域 ---------- */}
            {isLoading ? (
                /* === 首次 Skeleton === */
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
            ) : (
                <Box component={Paper} sx={{ boxShadow: 3 }}>
                    {/* 进度条移动至按钮区域 */}

                    <DataGrid
                        autoHeight
                        rows={filteredRows}
                        columns={columns}
                        density="compact"
                        columnVisibilityModel={showColumns}
                        onColumnVisibilityModelChange={(m) => setShowColumns(m as any)}
                        pageSizeOptions={[5, 10, 25]}
                        paginationModel={{ pageSize: rowsPerPage, page }}
                        onPaginationModelChange={(m) => {
                            setRowsPerPage(m.pageSize);
                            setPage(m.page);
                        }}
                        sx={{
                            '& .MuiDataGrid-columnHeaders': {
                                bgcolor:
                                    theme.palette.mode === 'dark'
                                        ? theme.palette.grey[800]
                                        : theme.palette.grey[200],
                            },
                        }}
                    />
                </Box>
            )}


            {/* ---------- More Actions Menu ---------- */}
            <Menu
                anchorEl={actionAnchor.anchor}
                open={Boolean(actionAnchor.anchor)}
                onClose={() => setActionAnchor({ anchor: null, id: null })}
            >
                <MenuItem onClick={() => { const vm = data?.find(v=>v.id===actionAnchor.id); if(vm) handleGuac(vm,'ssh'); setActionAnchor({ anchor: null, id: null }); }}>
                    <SshIcon fontSize="small" sx={{ mr: 1 }} />
                    SSH
                </MenuItem>
                <MenuItem onClick={() => { const vm = data?.find(v=>v.id===actionAnchor.id); if(vm) handleGuac(vm,'rdp'); setActionAnchor({ anchor: null, id: null }); }}>
                    <RdpIcon fontSize="small" sx={{ mr: 1 }} />
                    RDP
                </MenuItem>
                <MenuItem onClick={() => { const vm = data?.find(v=>v.id===actionAnchor.id); if(vm) handleGuac(vm,'vnc'); setActionAnchor({ anchor: null, id: null }); }}>
                    <VncIcon fontSize="small" sx={{ mr: 1 }} />
                    VNC 控制台
                </MenuItem>
            </Menu>
            <Backdrop open={actionLoading} sx={{ zIndex: theme.zIndex.modal + 1 }}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <CreateVmModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => mutate()} />
        </Box>
    );
}
