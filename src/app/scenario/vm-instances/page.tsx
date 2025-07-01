"use client"

import * as React from "react"
import {
    Box, Button, Divider, Grid, Menu, MenuItem,
    Tabs, Tab, TextField, Typography, InputAdornment,
} from "@mui/material"
import {
    Search as SearchIcon,
    Computer as ComputerIcon,
    Memory as MemoryIcon,
    Storage as StorageIcon,
    NetworkCheck as NetworkIcon,
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

/* ---------- MOCK ---------- */
const MOCK: VmInstance[] = [
    {
        id: "101",
        name: "db-01",
        hostNode: "kvm-node-1",
        pool: "default",
        state: "running",
        vcpu: 4,
        vmem: 8192,
        ip: "192.168.122.101",
        uptime: "2d 03:12",
    },
    { id: "102", name: "web-02", hostNode: "kvm-node-2", pool: "web", state: "shutoff", vcpu: 2, vmem: 4096 },
]

/* ---------- 状态图标 ---------- */
function stateIcon(state: VmInstance["state"]) {
    switch (state) {
        case "running": return <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
        case "paused": return <WarningIcon sx={{ fontSize: 16, color: "warning.main" }} />
        default: return <ErrorIcon sx={{ fontSize: 16, color: "grey.500" }} />
    }
}

export default function VmPage() {
    const [rows] = React.useState(MOCK)
    const [current, setCurrent] = React.useState<VmInstance | null>(rows[0] ?? null)
    const [search, setSearch] = React.useState("")
    const [tab, setTab] = React.useState(0)
    const [actionAnchor, setActionAnchor] = React.useState<null | HTMLElement>(null)

    /* ----- 列定义 ----- */
    const columns = React.useMemo<GridColDef[]>(() => [
        { field: "state", headerName: "", width: 40, renderCell: p => stateIcon(p.row.state) },
        { field: "name", headerName: "Name", minWidth: 160, flex: 1 },
        { field: "hostNode", headerName: "Node", minWidth: 120 },
        { field: "pool", headerName: "Pool", minWidth: 120 },
        { field: "vcpu", headerName: "vCPU", width: 80 },
        { field: "vmem", headerName: "RAM (MB)", width: 100 },
        { field: "ip", headerName: "IP", minWidth: 140 },
        { field: "uptime", headerName: "Uptime", minWidth: 120 },
    ], [])

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 2 }}>
                <ComputerIcon sx={{ color: "grey.100" }} />
                <Typography variant="h6" sx={{ color: "grey.100" }}>
                    VM 管理
                </Typography>
                <TextField
                    size="small"
                    placeholder="Search VM"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: "grey.500" }} />
                            </InputAdornment>
                        ),
                        sx: { bgcolor: "#1e1e1e", color: "white" },
                    }}
                    sx={{ ml: "auto", width: 260 }}
                />
            </Box>

            {/* Grid */}
            <Box sx={{ flex: 1, overflow: "hidden" }}>
                <DataGrid
                    rows={rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))}
                    columns={columns}
                    density="compact"
                    hideFooter
                    onRowClick={p => setCurrent(p.row)}
                    sx={{
                        border: 0,
                        "& .MuiDataGrid-columnHeaders": { bgcolor: "#111", color: "grey.300" },
                        "& .MuiDataGrid-cell": { borderBottom: "1px solid #222", color: "grey.100" },
                    }}
                />
            </Box>

            {/* Details */}
            {current && (
                <Box sx={{ minHeight: "50vh", borderTop: "1px solid #333", display: "flex", flexDirection: "column" }}>
                    {/* Actions bar */}
                    <Box sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1 }}>
                        {stateIcon(current.state)}
                        <Typography sx={{ color: "grey.100", mr: 2 }}>{current.name}</Typography>

                        {current.state === "running" ? (
                            <>
                                <Button size="small" startIcon={<PauseIcon />} sx={{ color: "grey.200" }}>
                                    Pause
                                </Button>
                                <Button size="small" startIcon={<StopIcon />} sx={{ color: "grey.200" }}>
                                    Shutdown
                                </Button>
                                <Button size="small" startIcon={<ResetIcon />} sx={{ color: "grey.200" }}>
                                    Reboot
                                </Button>
                            </>
                        ) : (
                            <Button size="small" startIcon={<StartIcon />} sx={{ color: "grey.200" }}>
                                Start
                            </Button>
                        )}

                        <Button
                            size="small"
                            variant="outlined"
                            sx={{ color: "white", borderColor: "grey.600", ml: "auto" }}
                            startIcon={<ConsoleIcon />}
                        >
                            Console
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            endIcon={<ArrowDownIcon />}
                            onClick={e => setActionAnchor(e.currentTarget)}
                            sx={{ color: "white", borderColor: "grey.600" }}
                        >
                            More
                        </Button>
                    </Box>

                    {/* Tabs */}
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        sx={{
                            "& .MuiTab-root": { color: "grey.500", minHeight: 36 },
                            "& .Mui-selected": { color: "skyblue" },
                            borderBottom: "1px solid #222",
                            pl: 2,
                        }}
                    >
                        {["Overview", "Snapshots", "Storage", "Network", "Performance", "Events"].map(l => (
                            <Tab key={l} label={l.toUpperCase()} />
                        ))}
                    </Tabs>

                    {/* Panels */}
                    <Box sx={{ flex: 1, p: 2 }}>
                        {tab === 0 && (
                            <Grid container spacing={3}>
                                <Grid item xs={4}>
                                    <Typography variant="subtitle2" sx={{ color: "grey.100", mb: 1 }}>
                                        基本信息
                                    </Typography>
                                    <Box sx={{ color: "grey.300", fontSize: 14, display: "flex", flexDirection: "column", gap: 0.75 }}>
                                        <span>Host Node: {current.hostNode}</span>
                                        <span>Pool: {current.pool}</span>
                                        <span>vCPU: {current.vcpu}</span>
                                        <span>vRAM: {current.vmem} MB</span>
                                        {current.ip && <span>IP: {current.ip}</span>}
                                    </Box>
                                </Grid>

                                {/* 其他概览块（可填充 CPU/MEM 仪表、磁盘利用等） */}
                            </Grid>
                        )}

                        {/* 其它标签占位 */}
                        {tab !== 0 && (
                            <Typography sx={{ color: "grey.400" }}>
                                {["Snapshots", "Storage", "Network", "Performance", "Events"][tab - 1]} 页面待实现…
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}

            {/* --- More Actions Menu --- */}
            <Menu
                anchorEl={actionAnchor}
                open={Boolean(actionAnchor)}
                onClose={() => setActionAnchor(null)}
                PaperProps={{ sx: { bgcolor: "#2a2a2a", color: "grey.100" } }}
            >
                <MenuItem onClick={() => setActionAnchor(null)}>
                    <SnapshotIcon fontSize="small" sx={{ mr: 1 }} />
                    创建快照
                </MenuItem>
                <Divider sx={{ bgcolor: "grey.700" }} />
                <MenuItem onClick={() => setActionAnchor(null)}>
                    <VncIcon fontSize="small" sx={{ mr: 1 }} />
                    VNC / SPICE 控制台
                </MenuItem>
            </Menu>
        </Box>
    )
}
