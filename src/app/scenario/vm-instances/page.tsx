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
    Dialog,
    DialogTitle,
    DialogContent,
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
import SnapshotsPanel from "@/components/vm/SnapshotsPanel";
import {customFetch} from "@/utils/fetch.ts";

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
const fetcher = (url: string) => customFetch(url).then((r) => r.json());

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

/* ---------- 纯前端 CPU/内存使用“假数据”
   约束：CPU 列总和 ≤ 60%，且单行 CPU 不为 0；内存列总和 ≤ 60%，并在小范围抖动
---------- */
const COLUMN_MAX_SUM = 60; // 每列占用总和上限（%）
const PER_ITEM_MAX = 12;   // 单格上限，保证数值偏小
const CPU_MIN_PER_ITEM = 1; // CPU 不允许 0

// 将 maxSum(<=60) 的“预算”按权重随机分配到各行，支持最小值约束
function allocColumn(
    ids: string[],
    opts?: { maxSum?: number; perItemMax?: number; minPerItem?: number; targetMin?: number; targetMax?: number }
): Record<string, number> {
    const maxSum = opts?.maxSum ?? COLUMN_MAX_SUM;
    const perItemMax = opts?.perItemMax ?? PER_ITEM_MAX;
    const targetMin = opts?.targetMin ?? 30; // 让总量偏小：30%~60%
    const targetMax = opts?.targetMax ?? maxSum;
    const wantMin = opts?.minPerItem ?? 0;

    const result: Record<string, number> = {};
    if (!ids || ids.length === 0) return result;

    // 如果最小值总和超过上限，则回退为 0（极端大列表保护）
    const minPerItem = ids.length * wantMin <= maxSum ? wantMin : 0;

    const target = Math.max(minPerItem * ids.length, Math.floor(targetMin + Math.random() * (targetMax - targetMin + 1)));

    // 随机权重（幂次 > 1 让小值更多）
    const weights = ids.map(() => Math.random() ** 2.2);
    const total = weights.reduce((a, b) => a + b, 0) || 1;

    // 先按权重分配到整数，并加上最小值
    const base = ids.map(() => minPerItem);
    const room = Math.max(0, Math.min(maxSum, target) - base.reduce((a, b) => a + b, 0));
    let alloc = weights.map(w => Math.floor((w / total) * room));

    // 裁剪到每项上限
    alloc = alloc.map((v, i) => Math.min(v, Math.max(0, perItemMax - base[i])));

    // 统计并做余量分配，直到用尽或无容量
    const sumNow = base.reduce((s, b, i) => s + b + alloc[i], 0);
    let remainder = Math.max(0, Math.min(maxSum, target) - sumNow);
    const capLeft = () => alloc.map((v, i) => (perItemMax - base[i] - v));
    while (remainder > 0) {
        let progressed = false;
        const cap = capLeft();
        for (let i = 0; i < ids.length && remainder > 0; i++) {
            if (cap[i] > 0) {
                alloc[i] += 1;
                remainder -= 1;
                progressed = true;
            }
        }
        if (!progressed) break; // 无可分配容量
    }

    ids.forEach((id, i) => { result[id] = base[i] + alloc[i]; });
    return result; // sum(values) ≤ maxSum
}

// 内存列围绕基线小抖动：先加噪，再整体归一确保总和 ≤ 上限
function jitterAroundBase(
    ids: string[],
    base: Record<string, number>,
    jitter: number = 2,
    maxSum: number = COLUMN_MAX_SUM,
    perItemMax: number = PER_ITEM_MAX
): Record<string, number> {
    if (!ids || ids.length === 0) return {};
    // 初步加噪并夹紧到 [0, perItemMax]
    const temp = ids.map(id => {
        const b = base[id] ?? 0;
        const delta = Math.floor(Math.random() * (2 * jitter + 1)) - jitter; // [-jitter, +jitter]
        return Math.max(0, Math.min(perItemMax, b + delta));
    });
    let sum = temp.reduce((a, b) => a + b, 0);
    if (sum <= maxSum) {
        const out: Record<string, number> = {};
        ids.forEach((id, i) => { out[id] = temp[i]; });
        return out;
    }
    // 归一缩放后转整数，使用“余数分配”法保证总和 ≤ maxSum
    const scale = maxSum / (sum || 1);
    const floored = temp.map(v => Math.floor(v * scale));
    let remainder = maxSum - floored.reduce((a, b) => a + b, 0);
    // 可用容量 = perItemMax - floored[i]
    while (remainder > 0) {
        let progressed = false;
        for (let i = 0; i < floored.length && remainder > 0; i++) {
            if (floored[i] < perItemMax) {
                floored[i] += 1;
                remainder -= 1;
                progressed = true;
            }
        }
        if (!progressed) break;
    }
    const out: Record<string, number> = {};
    ids.forEach((id, i) => { out[id] = floored[i]; });
    return out;
}

export default function VmPage() {
    /* ---- SWR 数据 ---- */
    const forceRefreshUntil = React.useRef(0);
    const { data, isLoading, isValidating, mutate } = useVmInstances(forceRefreshUntil);

    /* ---- 本地 UI 状态 ---- */
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(20);
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
        // 新增两列：默认隐藏
        cpuUsage: false,
        memUsage: false,
    });
    const [snapshotVmId, setSnapshotVmId] = React.useState<string | null>(null);

    // 纯前端使用率表：id -> {cpu, mem}
    const [usageMap, setUsageMap] = React.useState<Record<string, { cpu: number; mem: number }>>({});
    // 内存“基线”，用于围绕它小幅抖动，保持相对稳定
    const [memBase, setMemBase] = React.useState<Record<string, number>>({});

    // 当列表变化时：重建内存基线 & 立即生成一帧（CPU≥1 且列总和≤60；内存≤60）
    React.useEffect(() => {
        const list: VmInstance[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
        const ids = list.map(v => v.id);
        // 先生成新的基线（内存）
        const newMemBase = allocColumn(ids, { minPerItem: 0 });
        setMemBase(newMemBase);
        // 立即产出一帧数据
        const cpuMap = allocColumn(ids, { minPerItem: CPU_MIN_PER_ITEM });
        const memMap = jitterAroundBase(ids, newMemBase, 0); // 初次不抖动
        const next: Record<string, { cpu: number; mem: number }> = {};
        ids.forEach(id => { next[id] = { cpu: cpuMap[id] ?? 0, mem: memMap[id] ?? 0 }; });
        setUsageMap(next);
    }, [data]);

    // 定时刷新 —— 每 5 秒：CPU 重新分配且保证最小为 1；内存在基线附近小抖动
    React.useEffect(() => {
        const timer = setInterval(() => {
            const list: VmInstance[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
            const ids = list.map(v => v.id);
            const cpuMap = allocColumn(ids, { minPerItem: CPU_MIN_PER_ITEM });
            const memMap = jitterAroundBase(ids, memBase, 2);
            const next: Record<string, { cpu: number; mem: number }> = {};
            ids.forEach(id => { next[id] = { cpu: cpuMap[id] ?? 0, mem: memMap[id] ?? 0 }; });
            setUsageMap(next);
        }, 5_000);
        return () => clearInterval(timer);
    }, [data, memBase]);

    const getColumnLabel = (key: string) => {
        switch (key) {
            case 'hostNode': return '宿主机';
            case 'pool': return '存储池';
            case 'persistent': return '持久化';
            case 'autostart': return '自动启动';
            case 'cpuUsage': return 'CPU 使用率';
            case 'memUsage': return '内存使用率';
            default: return key;
        }
    };

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
                    <VmInfoCell id={p.row.id} width={30}>{d => d.vcpu?.count ?? '-'}</VmInfoCell>
                ),
            },
            {
                field: 'memory',
                headerName: '内存(MB)',
                width: 100,
                renderCell: (p) => (
                    <VmInfoCell id={p.row.id} width={40}>{d => d.vram?.total_mb ?? '-'}</VmInfoCell>
                ),
            },
            // === 新增：CPU 使用率（纯前端） ===
            {
                field: 'cpuUsage',
                headerName: 'CPU 使用率',
                width: 120,
                hide: !showColumns.cpuUsage,
                sortable: false,
                renderCell: (p) => {
                    const u = usageMap[p.row.id];
                    return u ? <span>{u.cpu}%</span> : <Skeleton width={40} />;
                },
            },
            // === 新增：内存使用率（纯前端） ===
            {
                field: 'memUsage',
                headerName: '内存使用率',
                width: 120,
                hide: !showColumns.memUsage,
                sortable: false,
                renderCell: (p) => {
                    const u = usageMap[p.row.id];
                    return u ? <span>{u.mem}%</span> : <Skeleton width={40} />;
                },
            },
            {
                field: 'ip',
                headerName: 'IP',
                width: 140,
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
                width: 200,
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
                                    {/*<IconButton size="small" onClick={() => handleLifecycle(vm, 'shutdown')} disabled={actionLoading}>
                                        <StopIcon fontSize="small" color="error" />
                                    </IconButton>*/}
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
                            <IconButton size="small" onClick={() => setSnapshotVmId(vm.id)} disabled={actionLoading}>
                                <SnapshotIcon fontSize="small" />
                            </IconButton>
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
        // 依赖 usageMap 保证定时刷新后单元格重渲染；showColumns 控制初始隐藏
        [actionLoading, usageMap, showColumns]
    );

    const theme = useTheme();

    /* ---- 行过滤 ---- */
    const filteredRows = React.useMemo(() => {
        const list = Array.isArray(data) ? data : (data as any)?.data ?? [];
        let rows = list.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
        if (showRunningOnly) rows = rows.filter(r => r.state === 'running');
        return rows;
    }, [data, search, showRunningOnly]);

    const handleLifecycle = async (vm: VmInstance, action: string) => {
        setActionLoading(true);
        // 动作触发即刻进入快速轮询模式
        forceRefreshUntil.current = Date.now() + 30_000;
        try {
            const res = await customFetch(`/back/api/vms/${vm.id}/actions/${action}`, {
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

    const openGuacWindow = (params: Record<string, string>) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/guacamole';
        form.target = '_blank';
        Object.entries(params).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        form.remove();
    };

    const handleGuac = async (vm: VmInstance, proto: 'ssh' | 'rdp' | 'vnc') => {
        try {
            const res = await customFetch(`/back/api/vms/${vm.name}/guac?method=${proto}&vm_name=${encodeURIComponent(vm.name)}`);
            if (!res.ok) throw new Error('Guacamole info request failed');
            const info = await res.json();

            const port =
                proto === 'ssh'
                    ? info.ssh_port
                    : proto === 'rdp'
                        ? info.rdp_port
                        : info.vnc_port;
            openGuacWindow({ type: proto, hostname: info.host, port: String(port) });
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
            const res = await customFetch(`/back/api/vms/${vm.id}?domain_name=${encodeURIComponent(vm.name)}`, { method: 'DELETE' });
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
                            label={getColumnLabel(key)}
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
                        pageSizeOptions={[5, 10,20, 25,50]}
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
                {/*<MenuItem onClick={() => { const vm = data?.find(v=>v.id===actionAnchor.id); if(vm) handleGuac(vm,'ssh'); setActionAnchor({ anchor: null, id: null }); }}>
                    <SshIcon fontSize="small" sx={{ mr: 1 }} />
                    SSH
                </MenuItem>
                <MenuItem onClick={() => { const vm = data?.find(v=>v.id===actionAnchor.id); if(vm) handleGuac(vm,'rdp'); setActionAnchor({ anchor: null, id: null }); }}>
                    <RdpIcon fontSize="small" sx={{ mr: 1 }} />
                    RDP
                </MenuItem>*/}
                <MenuItem onClick={() => { const vm = (Array.isArray(data) ? data : (data as any)?.data ?? []).find((v: VmInstance)=>v.id===actionAnchor.id); if(vm) handleGuac(vm,'vnc'); setActionAnchor({ anchor: null, id: null }); }}>
                    <VncIcon fontSize="small" sx={{ mr: 1 }} />
                    VNC 控制台
                </MenuItem>
            </Menu>
            <Backdrop open={actionLoading} sx={{ zIndex: theme.zIndex.modal + 1 }}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <Dialog open={Boolean(snapshotVmId)} onClose={() => setSnapshotVmId(null)} fullWidth maxWidth="md">
                <DialogTitle>快照管理</DialogTitle>
                <DialogContent sx={{p:2}}>
                    {snapshotVmId && <SnapshotsPanel vmId={snapshotVmId} />}
                </DialogContent>
            </Dialog>
            <CreateVmModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => mutate()} />
        </Box>
    );
}
