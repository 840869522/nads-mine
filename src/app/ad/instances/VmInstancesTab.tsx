"use client";

import * as React from "react";
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
    Terminal as SshIcon,
    LaptopWindows as RdpIcon,
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
    can_operate: boolean | string; // 允许 can_operate 是布尔值或字符串
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

/* ---------- SWR Hooks (无改动) ---------- */
const fetcher = (url: string) =>customFetch(url).then((r) => r.json());

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
    switch (state) {
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

    const { user } = useAuth();

    const handleLifecycle = async (vm: VmInstance, action: string) => {
        setActionLoading(true);
        forceRefreshUntil.current = Date.now() + 30_000;
        try {
            const res = await customFetch(`/back/api/ad/vms/${vm.name}/actions/${action}`, { method: "POST" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || res.statusText);
            }
            await mutate();
            await globalMutate(`/back/api/vms/${vm.id}`);
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

    const handleGuac = async (vmName: string, proto: 'ssh' | 'rdp' | 'vnc') => {
        try {
            const res = await customFetch(`/back/api/ad/vms/${vmName}/guac?method=${proto}&vm_name=${encodeURIComponent(vmName)}`);
            if (!res.ok) throw new Error('Guacamole info request failed');
            const info = await res.json();
            const port = proto === 'ssh' ? info.ssh_port : proto === 'rdp' ? info.rdp_port : info.vnc_port;
            openGuacWindow({ type: proto, hostname: info.host, port: String(port) });
        } catch (e: any) {
            alert(e.message || 'Failed to open connection');
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
                throw new Error(err.detail || res.statusText);
            }
            await mutate();
        } catch (e: any) {
            alert(e.message || 'Failed to delete');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenLogs = React.useCallback((vm: VmInstance) => {
        const base = process.env.NEXT_PUBLIC_KIBANA_BASE_URL || 'http://10.12.0.102:25601';
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
                width: 280,
                renderCell: (params) => {
                    const vm = params.row;
                    const { data: info } = useVmInfo(vm.id);
                    const state = info?.status || vm.state;
                    const isRunning = state === 'running';
                    const isPaused = state === 'paused';
                    const isTarget = vm.is_target;

                    // ★★★ START: 最终修复版 - 引入安全的 Base64 解码 ★★★

                    const safeJsonParse = (b64: string | boolean): any => {
                        if (typeof b64 !== 'string' || b64 === '') {
                            return { can_operate: !!b64, vm_stop: false, vm_restart: false, vm_shutdown: false, vm_delete: false };
                        }
                        try {
                            const paddedB64 = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
                            const jsonString = atob(paddedB64);
                            return JSON.parse(jsonString);
                        } catch (e) {
                            console.error("Failed to parse 'can_operate' field:", e, "Original value:", b64);
                            return { can_operate: false, vm_stop: false, vm_restart: false, vm_shutdown: false, vm_delete: false };
                        }
                    };

                    const isPrivilegedUser = (currentUser: any): boolean => {
                        if (!currentUser) return false;
                        const privilegedRoleStrings = ['admin', 'referee', 'administrator'];
                        const roles = currentUser.role || currentUser.user?.roles;
                        if (Array.isArray(roles)) {
                            return roles.some(role => privilegedRoleStrings.includes(role));
                        }
                        return false;
                    };

                    const getUserTeamId = (currentUser: any): string | null => {
                        if (!currentUser) return null;
                        return currentUser.team_id || currentUser.user?.team_id || null;
                    };

                    const isAdminOrReferee = isPrivilegedUser(user);
                    const userTeamId = getUserTeamId(user);

                    const isTeamMember = !!(userTeamId && vm.team_id && String(userTeamId) === String(vm.team_id));

                    const hasVncPermission = isAdminOrReferee || isTeamMember;

                    const canOperateGeneral = safeJsonParse(vm.can_operate);

                    // ★★★ END: 最终修复版 ★★★

                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {isRunning ? (
                                <>
                                    <Tooltip title={canOperateGeneral?.vm_stop ? "暂停" : "无权限"}><Box component="span"><IconButton size="small" onClick={() => handleLifecycle(vm, 'pause')} disabled={actionLoading || !canOperateGeneral?.vm_stop}><PauseIcon fontSize="small" /></IconButton></Box></Tooltip>
                                    <Tooltip title={canOperateGeneral?.vm_shutdown ? "关机" : "无权限"}><Box component="span"><IconButton size="small" onClick={() => handleLifecycle(vm, 'shutdown')} disabled={actionLoading || !canOperateGeneral?.vm_shutdown}><StopIcon fontSize="small" color={canOperateGeneral?.vm_shutdown ? "error" : "disabled"} /></IconButton></Box></Tooltip>
                                    <Tooltip title={canOperateGeneral?.vm_restart ? "重启" : "无权限"}><Box component="span"><IconButton size="small" onClick={() => handleLifecycle(vm, 'reboot')} disabled={actionLoading || !canOperateGeneral?.vm_restart}><ResetIcon fontSize="small" /></IconButton></Box></Tooltip>
                                </>
                            ) : (
                                <Tooltip title={canOperateGeneral?.can_operate ? (isPaused ? "恢复" : "启动") : "无权限"}><Box component="span"><IconButton size="small" onClick={() => handleLifecycle(vm, isPaused ? 'resume' : 'start')} disabled={actionLoading || !canOperateGeneral?.can_operate}><StartIcon fontSize="small" color={canOperateGeneral?.can_operate ? "success" : "disabled"} /></IconButton></Box></Tooltip>
                            )}
                            <Tooltip title={canOperateGeneral?.vm_delete ? "删除" : "无权限"}><Box component="span"><IconButton size="small" onClick={() => handleDelete(vm)} disabled={actionLoading || !canOperateGeneral?.vm_delete}><DeleteIcon fontSize="small" color={canOperateGeneral?.vm_delete ? "error" : "disabled"} /></IconButton></Box></Tooltip>

                            {isTarget && (
                                <>
                                    <Tooltip title="提交Flag"><Box component="span"><IconButton onClick={() => setFlagSubmissionModalId(vm.id)} size="small" disabled={!isRunning || actionLoading}><FlagIcon fontSize="small" color={isRunning ? 'primary' : 'disabled'} /></IconButton></Box></Tooltip>
                                    <Tooltip title="Flag历史记录"><Box component="span"><IconButton onClick={() => setFlagHistoryModalOpen(true)} size="small" disabled={actionLoading}><HistoryIcon fontSize="small" color="info" /></IconButton></Box></Tooltip>
                                </>
                            )}

                            <Tooltip title="日志"><Box component="span"><IconButton onClick={() => handleOpenLogs(vm)} disabled={!canOperateGeneral?.can_operate} size="small"><ArticleIcon fontSize="small" /></IconButton></Box></Tooltip>

                            <Tooltip title={
                                !isRunning ? "虚拟机未运行" :
                                    !canOperateGeneral?.can_operate ? "您无权进行此操作" :
                                        !hasVncPermission ? "您不属于此虚拟机分配的队伍" : "更多操作"
                            }>
                                <Box component="span">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => setActionAnchor({ anchor: e.currentTarget, id: vm.id })}
                                        disabled={!isRunning || !canOperateGeneral?.can_operate || !hasVncPermission}
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
        [actionLoading, showColumns, handleOpenLogs, user]
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