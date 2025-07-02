"use client"

import * as React from "react"
import {
    Box, Button, Divider, Menu, MenuItem,
    Tabs, Tab, TextField, Typography, InputAdornment,
    Paper, useTheme,
} from "@mui/material"
import {
    Search as SearchIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    PlayArrow as StartIcon,
    Stop as StopIcon,
    Pause as PauseIcon,
    RestartAlt as ResetIcon,
    Visibility as ConsoleIcon,
    DesktopWindows as VncIcon,
    Camera as SnapshotIcon,
    KeyboardArrowDown as ArrowDownIcon,
} from "@mui/icons-material"
import { DataGrid, GridColDef } from "@mui/x-data-grid"
import OverviewPanel from "@/components/vm/OverviewPanel"
import SnapshotsPanel from "@/components/vm/SnapshotsPanel"
import StoragePanel from "@/components/vm/StoragePanel"
import NetworkPanel from "@/components/vm/NetworkPanel"
import PerformancePanel from "@/components/vm/PerformancePanel"
import EventsPanel from "@/components/vm/EventsPanel"

/* ---------- 类型 ---------- */
interface VmInstance {
    id: string
    name: string
    hostNode: string      // 宿主机
    pool: string          // 存储或分组
    state: "running" | "paused" | "shutoff"
    vcpu: number
    vmem: number          // MB
    ip?: string
    uptime?: string
}

/* ---------- 从后端获取虚拟机实例列表 ---------- */

/* ---------- 状态图标 ---------- */
function stateIcon(state: VmInstance["state"]) {
    switch (state) {
        case "running": return <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
        case "paused": return <WarningIcon sx={{ fontSize: 16, color: "warning.main" }} />
        default: return <ErrorIcon sx={{ fontSize: 16, color: "grey.500" }} />
    }
}

export default function VmPage() {
    const [rows, setRows] = React.useState<VmInstance[]>([])
    const [current, setCurrent] = React.useState<VmInstance | null>(null)
    const [search, setSearch] = React.useState("")
    const [page, setPage] = React.useState(0)
    const [rowsPerPage, setRowsPerPage] = React.useState(10)
    const [tab, setTab] = React.useState(0)
    const [actionAnchor, setActionAnchor] = React.useState<null | HTMLElement>(null)

    // 从后端获取虚拟机实例列表
    React.useEffect(() => {
        fetch('/api/vm/instances')
            .then(res => res.json())
            .then((data: VmInstance[]) => {
                setRows(data)
                setCurrent(data[0] ?? null)
            })
            .catch(() => {})
    }, [])

    /* ----- 列定义 ----- */
    const columns = React.useMemo<GridColDef[]>(() => [
        { field: "state", headerName: "", width: 40, renderCell: p => stateIcon(p.row.state) },
        { field: "name", headerName: "名称", minWidth: 160, flex: 1 },
        { field: "hostNode", headerName: "宿主机", minWidth: 120 },
        { field: "pool", headerName: "存储池", minWidth: 120 },
        { field: "vcpu", headerName: "vCPU", width: 80 },
        { field: "vmem", headerName: "内存 (MB)", width: 100 },
        { field: "ip", headerName: "IP", minWidth: 140 },
        { field: "uptime", headerName: "运行时间", minWidth: 120 },
    ], [])

    const theme = useTheme();
    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="h4" component="h1">虚拟机实例管理</Typography>
                    <TextField
                        variant="outlined"
                        placeholder="搜索虚拟机..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        size="small"
                        InputProps={{ startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        )}}
                        sx={{ width: { xs: '100%', sm: 260 } }}
                    />
                </Box>
            </Box>

            <Box component={Paper} sx={{ boxShadow: 3, height: '50vh', display: 'flex', flexDirection: 'column' }}>
                <DataGrid
                    rows={rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))}
                    columns={columns}
                    density="compact"
                    pageSizeOptions={[5, 10, 25]}
                    paginationModel={{ pageSize: rowsPerPage, page }}
                    onPaginationModelChange={(m) => { setRowsPerPage(m.pageSize); setPage(m.page); }}
                    onRowClick={p => setCurrent(p.row)}
                    sx={{
                        height: '100%',
                        '& .MuiDataGrid-columnHeaders': {
                            bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
                        },
                    }}
                />
            </Box>

            {/* Details */}
            {current && (
                <Box component={Paper} sx={{ mt: 3, p: 2, display: 'flex', flexDirection: 'column', minHeight: '50vh', boxShadow: 3, overflow: 'auto' }}>
                    {/* Actions bar */}
                    <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {stateIcon(current.state)}
                        <Typography sx={{ mr: 2 }}>{current.name}</Typography>

                        {current.state === "running" ? (
                            <>
                                <Button size="small" startIcon={<PauseIcon />}>
                                    Pause
                                </Button>
                                <Button size="small" startIcon={<StopIcon />}>
                                    Shutdown
                                </Button>
                                <Button size="small" startIcon={<ResetIcon />}>
                                    Reboot
                                </Button>
                            </>
                        ) : (
                            <Button size="small" startIcon={<StartIcon />}>
                                Start
                            </Button>
                        )}

                        <Button
                            size="small"
                            variant="outlined"
                            sx={{ ml: 'auto' }}
                            startIcon={<ConsoleIcon />}
                        >
                            Console
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            endIcon={<ArrowDownIcon />}
                            onClick={e => setActionAnchor(e.currentTarget)}
                        >
                            More
                        </Button>
                    </Box>

                    {/* Tabs */}
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        sx={{ borderBottom: 1, borderColor: 'divider', pl: 2 }}
                    >
                        {["Overview", "Snapshots", "Storage", "Network", "Performance", "Events"].map(l => (
                            <Tab key={l} label={l.toUpperCase()} />
                        ))}
                    </Tabs>

                    {/* Panels */}
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

            {/* --- More Actions Menu --- */}
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
        </Box>
    )
}
