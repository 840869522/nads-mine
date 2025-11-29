"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Button,
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
    Tooltip,
    Chip,
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
    KeyboardArrowDown as ArrowDownIcon,
    ViewColumn as ViewColumnIcon,
    Refresh as RefreshIcon,
    Flag as FlagIcon,
    History as HistoryIcon,
    Article as ArticleIcon,
} from "@mui/icons-material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import useSWR, { mutate as globalMutate } from "swr";
import FlagSubmissionModal from '@/components/scenario/FlagSubmissionModal';
import FlagHistoryModal from '@/components/scenario/FlagHistoryModal';
import { v4 as uuidv4 } from 'uuid';
import { customFetch } from '@/utils/fetch';
import { useAuth } from "@/hooks/useAuth";
import { toast } from "react-toastify";

/* ---------- 类型定义 ---------- */
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
    is_target: boolean;
    can_operate: string | boolean; // 后端返回的 base64 权限字符串
    team_id: string | null;
}

interface OverviewData {
    status: string;
    hostNode: string;
    pool: string;
    vcpu: { count: number; usage_percent: number };
    vram: { total_mb: number; usage_mb: number; usage_percent: number };
    osType?: string;
    persistent?: boolean;
    autostart?: boolean;
    uuid: string;
    ipAddress: string;
}

interface VmInstancesTabProps {
    instanceId: string | null;
}

/* ---------- SWR Hooks ---------- */
const fetcher = (url: string) => customFetch(url).then((r) => r.json());

function useVmInstances(instanceId: string | null, forceRef?: React.MutableRefObject<number>) {
    const {
        data,
        error,
        isLoading,
        isValidating,
        mutate,
    } = useSWR<VmInstance[]>(
        instanceId ? `/back/api/ad/vms/scene/${instanceId}` : null,
        fetcher,
        {
            dedupingInterval: 10_000,
            keepPreviousData: true,
            refreshInterval: (latest: VmInstance[] | undefined) => {
                if (forceRef && Date.now() < forceRef.current) return 5_000;
                if (!latest) return 5_000;
                const unstable = latest.some((vm) => !["running"].includes(vm.state));
                return unstable ? 5_000 : 30_000;
            },
            refreshWhenHidden: false,
            revalidateOnFocus: true,
        }
    );

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

function stateIcon(state: VmInstance["state"]) {
    const normalizedState = (state || '').toLowerCase().trim();
    switch (normalizedState) {
        case "running":
            return <Tooltip title="运行中"><CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} /></Tooltip>;
        case "paused":
            return <Tooltip title="已暂停"><WarningIcon sx={{ fontSize: 16, color: "warning.main" }} /></Tooltip>;
        default:
            return <Tooltip title="已关机"><ErrorIcon sx={{ fontSize: 16, color: "grey.500" }} /></Tooltip>;
    }
}

/* ---------- 主组件 ---------- */
const VmInstancesTab: React.FC<VmInstancesTabProps> = ({ instanceId }) => {
    const theme = useTheme();
    const forceRefreshUntil = React.useRef(0);
    const { data, isLoading, isValidating, mutate } = useVmInstances(instanceId, forceRefreshUntil);

    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [actionAnchor, setActionAnchor] = React.useState<{ anchor: HTMLElement | null; id: string | null }>({ anchor: null, id: null });
    const [actionLoading, setActionLoading] = React.useState(false);
    const [showRunningOnly, setShowRunningOnly] = React.useState(false);
    const [columnAnchor, setColumnAnchor] = React.useState<null | HTMLElement>(null);
    const [flagSubmissionModalId, setFlagSubmissionModalId] = React.useState<string | null>(null);
    const [flagHistoryModalOpen, setFlagHistoryModalOpen] = React.useState(false);
    const [showColumns, setShowColumns] = React.useState({
        hostNode: false,
        pool: false,
        osType: true,
        ip: true,
        is_target: true,
    });

    const { user } = useAuth(); // user 仅用于辅助或兜底

    const handleLifecycle = async (vm: VmInstance, action: string) => {
        setActionLoading(true);
        forceRefreshUntil.current = Date.now() + 30_000;
        try {
            const res = await customFetch(`/back/api/ad/vms/${vm.name}/actions/${action}`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || err.detail || res.statusText);
            }
            await mutate();
            await globalMutate(`/back/api/vms/${vm.id}`);
        } catch (e: any) {
            toast.error(e.message || "操作失败");
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

    const handleGuac = async (vmName: string, proto: 'ssh' | 'rdp' | 'vnc') => {
        try {
            const res = await customFetch(`/back/api/ad/vms/${vmName}/guac?method=${proto}&vm_name=${encodeURIComponent(vmName)}`);

            if (!res.ok) {
                let errorMessage = '连接请求失败';
                try {
                    const errorData = await res.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {}
                throw new Error(errorMessage);
            }

            const info = await res.json();
            const port = proto === 'ssh' ? info.ssh_port : proto === 'rdp' ? info.rdp_port : info.vnc_port;
            openGuacWindow({ type: proto, hostname: info.host, port: String(port) });
        } catch (e: any) {
            toast.error(e.message || '连接失败');
        }
        setActionAnchor({ anchor: null, id: null });
    };

    const handleDelete = async (vm: VmInstance) => {
        if (!window.confirm(`确定删除虚拟机 ${vm.name}？`)) return;
        setActionLoading(true);
        try {
            const res = await customFetch(`/back/api/vms/${vm.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || err.detail || res.statusText);
            }
            await mutate();
        } catch (e: any) {
            toast.error(e.message || '删除失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenLogs = React.useCallback((vm: VmInstance) => {
        const base =
            typeof window !== 'undefined'
                ? `${window.location.protocol}//${window.location.hostname}:25601` : process.env.NEXT_PUBLIC_KIBANA_BASE_URL;
        const version = process.env.NEXT_PUBLIC_KIBANA_VERSION || '1453';
        const id = uuidv4();
        const title = `${vm.scene_instance_id || ''}_${vm.name}`.toLowerCase();
        const params = encodeURIComponent(JSON.stringify({
            dataViewSpec: { id, title, allowNoIndex: true },
            columns: ["_source"],
            query: { language: "kuery", query: "" },
            filters: []
        }));
        const url = `${base}/app/r?l=DISCOVER_APP_LOCATOR&v=${version}&p=${params}`;
        window.open(url, '_blank');
    }, []);

    // ★★★ 核心：权限解析函数 ★★★
    const safeJsonParse = (b64: string | boolean): { [key: string]: boolean } => {
        const defaultPermissions = {
            vm_start: false,
            vm_stop: false,
            vm_restart: false,
            vm_delete: false,
            vm_console: false,
            vm_snapshot: false,
            can_submit_flag: false,
            can_flag_history: false,
            can_operate: false
        };

        if (typeof b64 !== 'string' || b64.trim() === '') {
            return { ...defaultPermissions, can_operate: !!b64 };
        }

        try {
            const paddedB64 = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
            const decodedJson = JSON.parse(atob(paddedB64));
            return { ...defaultPermissions, ...decodedJson };
        } catch (e) {
            console.error("Failed to parse 'can_operate' field:", e);
            return defaultPermissions;
        }
    };

    const columns = React.useMemo<GridColDef<VmInstance>[]>(
        () => [
            { field: 'status', headerName: '状态', width: 80, renderCell: (p) => <VmInfoCell id={p.row.id} width={20}>{d => stateIcon(d.status as any)}</VmInfoCell> },
            { field: 'name', headerName: '名称', flex: 1 },
            {
                field: 'is_target',
                headerName: '是否为靶机',
                width: 120,
                hide: !showColumns.is_target,
                renderCell: (params) => ( <Chip label={params.value ? '是' : '否'} color={params.value ? 'primary' : 'default'} size="small" variant="outlined" /> )
            },
            { field: 'osType', headerName: 'OS 类型', width: 120, hide: !showColumns.osType, renderCell: (p) => <VmInfoCell id={p.row.id} width={80}>{d => d.osType ?? 'N/A'}</VmInfoCell> },
            { field: 'hostNode', headerName: '宿主机', width: 120, hide: !showColumns.hostNode, renderCell: (p) => <VmInfoCell id={p.row.id} width={80}>{d => d.hostNode}</VmInfoCell> },
            { field: 'pool', headerName: '存储池', width: 120, hide: !showColumns.pool, renderCell: (p) => <VmInfoCell id={p.row.id} width={60}>{d => d.pool}</VmInfoCell> },
            { field: 'vcpu', headerName: 'vCPU', width: 80, renderCell: (p) => <VmInfoCell id={p.row.id} width={30}>{d => d.vcpu.count}</VmInfoCell> },
            { field: 'memory', headerName: '内存(MB)', width: 100, renderCell: (p) => <VmInfoCell id={p.row.id} width={40}>{d => d.vram.total_mb}</VmInfoCell> },
            { field: 'ip', headerName: 'IP', width: 140 },
            {
                field: 'actions',
                headerName: '操作',
                sortable: false,
                width: 350,
                renderCell: (params) => {
                    const vm = params.row;
                    const { data: info } = useVmInfo(vm.id);

                    // ★ 增强状态判断的健壮性 (大小写/空格不敏感) ★
                    const rawState = info?.status || vm.state || '';
                    const state = rawState.toLowerCase().trim();
                    const isRunning = state === 'running';
                    const isPaused = state === 'paused';
                    const isTarget = vm.is_target;

                    // ★ 获取后端计算好的所有权限 ★
                    const perms = safeJsonParse(vm.can_operate);

                    // 辅助判断：日志通常复用 can_operate
                    const canViewLogs = perms.can_operate;

                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {/* 1. 启动/暂停/重启/停止 */}
                            {isRunning ? (
                                <>
                                    {/* 暂停 */}
                                    <Tooltip title={perms.vm_stop ? "暂停" : "无权限"}>
                                        <Box component="span">
                                            <IconButton size="small" onClick={() => handleLifecycle(vm, 'pause')} disabled={actionLoading || !perms.vm_stop}>
                                                <PauseIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Tooltip>
                                    {/* 关机 (Stop) */}
                                    <Tooltip title={perms.vm_stop ? "关机" : "无权限"}>
                                        <Box component="span">
                                            <IconButton size="small" onClick={() => handleLifecycle(vm, 'shutdown')} disabled={actionLoading || !perms.vm_stop}>
                                                <StopIcon fontSize="small" color={perms.vm_stop ? "error" : "disabled"} />
                                            </IconButton>
                                        </Box>
                                    </Tooltip>
                                    {/* 重启 */}
                                    <Tooltip title={perms.vm_restart ? "重启" : "无权限"}>
                                        <Box component="span">
                                            <IconButton size="small" onClick={() => handleLifecycle(vm, 'reboot')} disabled={actionLoading || !perms.vm_restart}>
                                                <ResetIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Tooltip>
                                </>
                            ) : (
                                // 启动
                                <Tooltip title={perms.vm_start ? (isPaused ? "恢复" : "启动") : "无权限"}>
                                    <Box component="span">
                                        <IconButton size="small" onClick={() => handleLifecycle(vm, isPaused ? 'resume' : 'start')} disabled={actionLoading || !perms.vm_start}>
                                            <StartIcon fontSize="small" color={perms.vm_start ? "success" : "disabled"} />
                                        </IconButton>
                                    </Box>
                                </Tooltip>
                            )}

                            {/* 2. 删除 */}
                            <Tooltip title={perms.vm_delete ? "删除" : "无权限"}>
                                <Box component="span">
                                    <IconButton size="small" onClick={() => handleDelete(vm)} disabled={actionLoading || !perms.vm_delete}>
                                        <DeleteIcon fontSize="small" color={perms.vm_delete ? "error" : "disabled"} />
                                    </IconButton>
                                </Box>
                            </Tooltip>

                            {/* 3. Flag 相关 */}
                            {isTarget && (
                                <>
                                    <Tooltip title={perms.can_submit_flag ? "提交Flag" : "无提交权限(本队靶机或未运行)"}>
                                        <Box component="span">
                                            <IconButton
                                                onClick={() => setFlagSubmissionModalId(vm.id)}
                                                size="small"
                                                disabled={!isRunning || actionLoading || !perms.can_submit_flag}
                                            >
                                                <FlagIcon fontSize="small" color={isRunning && perms.can_submit_flag ? 'primary' : 'disabled'} />
                                            </IconButton>
                                        </Box>
                                    </Tooltip>
                                    <Tooltip title={perms.can_flag_history ? "Flag历史记录" : "无查看权限"}>
                                        <Box component="span">
                                            <IconButton onClick={() => setFlagHistoryModalOpen(true)} size="small" disabled={actionLoading || !perms.can_flag_history}>
                                                <HistoryIcon fontSize="small" color={perms.can_flag_history ? 'info' : 'disabled'} />
                                            </IconButton>
                                        </Box>
                                    </Tooltip>
                                </>
                            )}

                            {/* 4. 日志 */}
                            <Tooltip title={canViewLogs ? "日志" : "无权限"}>
                                <Box component="span">
                                    <IconButton onClick={() => handleOpenLogs(vm)} disabled={!canViewLogs} size="small">
                                        <ArticleIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Tooltip>

                            {/* 5. 更多操作 (VNC) */}
                            <Tooltip title={
                                !isRunning ? "虚拟机未运行" :
                                    !perms.vm_console ? "您无权进行此操作" : "更多操作"
                            }>
                                <Box component="span">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => setActionAnchor({ anchor: e.currentTarget, id: vm.id })}
                                        disabled={!isRunning || !perms.vm_console}
                                    >
                                        <ArrowDownIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Tooltip>
                        </Box>
                    );
                },
            },
        ],
        [actionLoading, showColumns, handleOpenLogs]
    );

    const filteredRows = React.useMemo(() => {
        let rows = (data ?? []).filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
        if (showRunningOnly) rows = rows.filter((r) => r.state === 'running');
        return rows;
    }, [data, search, showRunningOnly]);

    if (!instanceId) {
        return ( <Box sx={{ p: 3, textAlign: 'center' }}><Typography color="text.secondary">请先选择一个场景实例。</Typography></Box> );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">虚拟机列表</Typography>
                <TextField variant="outlined" placeholder="搜索虚拟机..." value={search} onChange={(e) => setSearch(e.target.value)} size="small" InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} sx={{ width: { xs: "100%", sm: 260 } }} />
                <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => mutate()} disabled={isValidating}> {isValidating ? '刷新中...' : '刷新'} </Button>
                <Button startIcon={<ViewColumnIcon />} onClick={(e)=>setColumnAnchor(e.currentTarget)} variant="outlined" size="small">显示列</Button>
                <FormControlLabel control={<Checkbox checked={showRunningOnly} onChange={(e) => setShowRunningOnly(e.target.checked)} />} label="只显示运行中" />
            </Box>

            <Menu anchorEl={columnAnchor} open={Boolean(columnAnchor)} onClose={() => setColumnAnchor(null)}>
                {Object.entries(showColumns).map(([key, val]) => (
                    <MenuItem key={key}>
                        <FormControlLabel control={<Switch checked={val} onChange={(e) => setShowColumns(prev => ({ ...prev, [key]: e.target.checked }))} />}
                                          label={ key === 'hostNode' ? '宿主机' : key === 'pool' ? '存储池' : key === 'osType' ? '系统类型' : key === 'ip' ? 'IP地址' : key === 'is_target' ? '是否为靶机' : key } />
                    </MenuItem>
                ))}
            </Menu>

            <Box component={Paper} sx={{ height: 'calc(100vh - 350px)', width: '100%' }}>
                <DataGrid rows={filteredRows} columns={columns} loading={isLoading} density="compact" pageSizeOptions={[10, 25, 50]} paginationModel={{ pageSize: rowsPerPage, page }} onPaginationModelChange={(m) => { setRowsPerPage(m.pageSize); setPage(m.page); }} sx={{ '& .MuiDataGrid-columnHeaders': { bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200] } }} />
            </Box>

            <Menu anchorEl={actionAnchor.anchor} open={Boolean(actionAnchor.anchor)} onClose={() => setActionAnchor({ anchor: null, id: null })}>
                <MenuItem onClick={() => { const vm = data?.find(v=>v.id===actionAnchor.id); if(vm) handleGuac(vm.name,'vnc'); }}>
                    <VncIcon fontSize="small" sx={{ mr: 1 }} /> VNC 控制台
                </MenuItem>
            </Menu>

            <Backdrop open={actionLoading} sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: '#fff' }}>
                <CircularProgress color="inherit" />
            </Backdrop>

            {flagSubmissionModalId && (
                <FlagSubmissionModal open={Boolean(flagSubmissionModalId)} onClose={() => setFlagSubmissionModalId(null)} instanceId={flagSubmissionModalId} instanceType="vm" sceneInstanceId={instanceId || ''} instanceName={data?.find(vm => vm.id === flagSubmissionModalId)?.name} />
            )}

            {flagHistoryModalOpen && (
                <FlagHistoryModal
                    open={flagHistoryModalOpen}
                    onClose={() => setFlagHistoryModalOpen(false)}
                    sceneInstanceId={instanceId || ''}
                    title="虚拟机 Flag 历史记录"
                />
            )}
        </Box>
    );
};

export default VmInstancesTab;