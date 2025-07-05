"use client";

import * as React from "react";
import {
    Box,
    Button,
    Divider,
    Menu,
    MenuItem,
    Tabs,
    Tab,
    TextField,
    Typography,
    InputAdornment,
    Paper,
    LinearProgress,
    Backdrop,
    CircularProgress,
    Skeleton,
    useTheme,
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
    Visibility as ConsoleIcon,
    DesktopWindows as VncIcon,
    Camera as SnapshotIcon,
    KeyboardArrowDown as ArrowDownIcon,
} from "@mui/icons-material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import useSWR, { mutate as globalMutate } from "swr";

import OverviewPanel from "@/components/vm/OverviewPanel";
import SnapshotsPanel from "@/components/vm/SnapshotsPanel";
import StoragePanel from "@/components/vm/StoragePanel";
import NetworkPanel from "@/components/vm/NetworkPanel";
import PerformancePanel from "@/components/vm/PerformancePanel";
import EventsPanel from "@/components/vm/EventsPanel";

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
    uptime?: string;
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
    } = useSWR<VmInstance[]>("/api/vms", fetcher, {
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
    const [current, setCurrent] = React.useState<VmInstance | null>(null);
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [tab, setTab] = React.useState(0);
    const [actionAnchor, setActionAnchor] = React.useState<null | HTMLElement>(
        null
    );
    const [actionLoading, setActionLoading] = React.useState(false);

    /* ---- 选中行同步（数据更新后仍保持同一行对象，避免重绘） ---- */
    React.useEffect(() => {
        if (!data) return;
        if (current) {
            const fresh = data.find((d) => d.id === current.id);
            setCurrent(fresh ?? data[0] ?? null);
        } else {
            setCurrent(data[0] ?? null);
        }
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ---- 列定义 ---- */
    const columns = React.useMemo<GridColDef[]>(
        () => [
            {
                field: "state",
                headerName: "",
                width: 40,
                renderCell: (p) => stateIcon(p.row.state),
            },
            { field: "name", headerName: "名称", minWidth: 160, flex: 1 },
            { field: "hostNode", headerName: "宿主机", minWidth: 120 },
            { field: "pool", headerName: "存储池", minWidth: 120 },
            { field: "vcpu", headerName: "vCPU", width: 80 },
            { field: "vmem", headerName: "内存 (MB)", width: 100 },
            { field: "ip", headerName: "IP", minWidth: 140 },
            { field: "uptime", headerName: "运行时间", minWidth: 120 },
        ],
        []
    );

    const theme = useTheme();

    /* ---- 行过滤 ---- */
    const filteredRows = React.useMemo(
        () =>
            (data ?? []).filter((r) =>
                r.name.toLowerCase().includes(search.toLowerCase())
            ),
        [data, search]
    );

    const handleLifecycle = async (action: string) => {
        if (!current) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/vms/${current.id}/actions/${action}`, {
                method: "POST",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || res.statusText);
            }
            // 动作触发后强制一段时间内快速轮询
            forceRefreshUntil.current = Date.now() + 20_000;
            await mutate();
            await Promise.all([
                globalMutate(`/api/vms/${current.id}`),
                globalMutate(`/api/vms/${current.id}/metrics`),
            ]);
        } catch (e: any) {
            alert(e.message || "Operation failed");
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
                </Box>
            </Box>

            {/* ---------- 列表区域 ---------- */}
            {isLoading ? (
                /* === 首次 Skeleton === */
                <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
            ) : (
                <Box
                    component={Paper}
                    sx={{
                        boxShadow: 3,
                        height: "50vh",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                    }}
                >
                    {/* 进度条移动至按钮区域 */}

                    <DataGrid
                        rows={filteredRows}
                        columns={columns}
                        density="compact"
                        pageSizeOptions={[5, 10, 25]}
                        paginationModel={{ pageSize: rowsPerPage, page }}
                        onPaginationModelChange={(m) => {
                            setRowsPerPage(m.pageSize);
                            setPage(m.page);
                        }}
                        onRowClick={(p) => setCurrent(p.row)}
                        sx={{
                            height: "100%",
                            "& .MuiDataGrid-columnHeaders": {
                                bgcolor:
                                    theme.palette.mode === "dark"
                                        ? theme.palette.grey[800]
                                        : theme.palette.grey[200],
                            },
                        }}
                    />
                </Box>
            )}

            {/* ---------- 详情面板 ---------- */}
            {current && (
                <Box
                    component={Paper}
                    sx={{
                        mt: 3,
                        p: 2,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: "50vh",
                        boxShadow: 3,
                        overflow: "auto",
                    }}
                >
                    {/* --- Action Bar --- */}
                    <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1, position: 'relative' }}>
                        {actionLoading && (
                            <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }} />
                        )}
                        {stateIcon(current.state)}
                        <Typography sx={{ mr: 2 }}>{current.name}</Typography>

                        {current.state === "running" ? (
                            <>
                                <Button
                                    size="small"
                                    startIcon={<PauseIcon />}
                                    disabled={actionLoading}
                                    onClick={() => handleLifecycle("pause")}
                                >
                                    Pause
                                </Button>
                                <Button
                                    size="small"
                                    startIcon={<StopIcon />}
                                    disabled={actionLoading}
                                    onClick={() => handleLifecycle("shutdown")}
                                >
                                    Shutdown
                                </Button>
                                <Button
                                    size="small"
                                    startIcon={<ResetIcon />}
                                    disabled={actionLoading}
                                    onClick={() => handleLifecycle("reboot")}
                                >
                                    Reboot
                                </Button>
                                <Button
                                    size="small"
                                    startIcon={<ForceOffIcon />}
                                    disabled={actionLoading}
                                    onClick={() => handleLifecycle("force-off")}
                                >
                                    Force Off
                                </Button>
                            </>
                        ) : (
                            <Button
                                size="small"
                                startIcon={<StartIcon />}
                                disabled={actionLoading}
                                onClick={() => handleLifecycle(current.state === "paused" ? "resume" : "start")}
                            >
                                {current.state === "paused" ? "Resume" : "Start"}
                            </Button>
                        )}
                        {current.state !== "shutoff" && current.state !== "running" && (
                            <Button
                                size="small"
                                startIcon={<ForceOffIcon />}
                                disabled={actionLoading}
                                onClick={() => handleLifecycle("force-off")}
                            >
                                Force Off
                            </Button>
                        )}

                        <Button
                            size="small"
                            variant="outlined"
                            sx={{ ml: "auto" }}
                            startIcon={<ConsoleIcon />}
                        >
                            Console
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            endIcon={<ArrowDownIcon />}
                            onClick={(e) => setActionAnchor(e.currentTarget)}
                        >
                            More
                        </Button>
                    </Box>

                    {/* --- Tabs --- */}
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        sx={{ borderBottom: 1, borderColor: "divider", pl: 2 }}
                    >
                        {[
                            "Overview",
                            "Snapshots",
                            "Storage",
                            "Network",
                            "Performance",
                            "Events",
                        ].map((l) => (
                            <Tab key={l} label={l.toUpperCase()} />
                        ))}
                    </Tabs>

                    {/* --- Panels --- */}
                    <Box sx={{ flex: 1, p: 2 }}>
                        {tab === 0 && current && <OverviewPanel vmId={current.id} />}
                        {tab === 1 && current && <SnapshotsPanel vmId={current.id} />}
                        {tab === 2 && current && <StoragePanel vmId={current.id} />}
                        {tab === 3 && current && <NetworkPanel vmId={current.id} />}
                        {tab === 4 && current && <PerformancePanel vmId={current.id} />}
                        {tab === 5 && current && <EventsPanel vmId={current.id} />}
                    </Box>
                </Box>
            )}

            {/* ---------- More Actions Menu ---------- */}
            <Menu
                anchorEl={actionAnchor}
                open={Boolean(actionAnchor)}
                onClose={() => setActionAnchor(null)}
            >
                <MenuItem onClick={() => setActionAnchor(null)}>
                    <SnapshotIcon fontSize="small" sx={{ mr: 1 }} />
                    创建快照
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => setActionAnchor(null)}>
                    <VncIcon fontSize="small" sx={{ mr: 1 }} />
                    VNC / SPICE 控制台
                </MenuItem>
            </Menu>
            <Backdrop open={actionLoading} sx={{ zIndex: theme.zIndex.modal + 1 }}>
                <CircularProgress color="inherit" />
            </Backdrop>
        </Box>
    );
}
