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
    Chip, // Added Chip import
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
    Article as ArticleIcon,
} from "@mui/icons-material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import useSWR, { mutate as globalMutate } from "swr";
import FlagSubmissionModal from '@/components/scenario/FlagSubmissionModal';
import { v4 as uuidv4 } from 'uuid';
import { customFetch } from '@/utils/fetch';
import { useAuth } from '@/hooks/useAuth';

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
    is_target: boolean; // Added is_target field
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

interface SupportUserResponse {
    code: number;
    message: string;
    data?: {
        c_username?: string;
        [key: string]: unknown;
    };
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
        instanceId ? `/back/api/scenariosinstances/${instanceId}/vms` : null, // 根据 instanceId 动态生成 URL
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
    const { user: authUser } = useAuth();
    const authUsername = React.useMemo(
        () => ((authUser?.user as { c_username?: string } | undefined)?.c_username) ?? undefined,
        [authUser]
    );
    const { data: currentUser, error: currentUserError } = useSWR<SupportUserResponse>(
        authUsername ? ['/back/api/support/user/id', authUsername] : null,
        ([url, id]) =>
            customFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            }).then(async (res) => {
                if (!res.ok) {
                    const message = res.statusText || '获取用户信息失败';
                    throw new Error(message);
                }
                return res.json();
            }),
        {
            revalidateOnFocus: false,
        }
    );
    const effectiveUsername = currentUser?.data?.c_username ?? authUsername;
    React.useEffect(() => {
        if (currentUserError) {
            console.log(`[Guac Authority] 获取用户信息失败: ${currentUserError.message}`);
        }
    }, [currentUserError]);
    const { data, isLoading, isValidating, mutate } = useVmInstances(instanceId, forceRefreshUntil);

    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [actionAnchor, setActionAnchor] = React.useState<{ anchor: HTMLElement | null; id: string | null }>({ anchor: null, id: null });
    const [actionLoading, setActionLoading] = React.useState(false);
    const [showRunningOnly, setShowRunningOnly] = React.useState(false);
    const [columnAnchor, setColumnAnchor] = React.useState<null | HTMLElement>(null);
    const [flagSubmissionModalId, setFlagSubmissionModalId] = React.useState<string | null>(null);
    const [showColumns, setShowColumns] = React.useState({
        hostNode: false,
        pool: false,
        osType: true,
        ip: true,
        is_target: true, // Added for the new column
    });
    const [blockedVnc, setBlockedVnc] = React.useState<Record<string, boolean>>({});

    const selectedVm = React.useMemo(
        () => data?.find((vm) => vm.id === actionAnchor.id) ?? null,
        [data, actionAnchor.id]
    );

    const handleLifecycle = async (vm: VmInstance, action: string) => {
        setActionLoading(true);
        forceRefreshUntil.current = Date.now() + 30_000;
        try {
            const res = await customFetch(`/back/api/vms/${vm.id}/actions/${action}`, { method: "POST" });
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
        const params = new URLSearchParams({ method: proto, vm_name: vmName });
        if (effectiveUsername) {
            params.append('username', effectiveUsername);
        } else {
            const reason = currentUserError?.message || '当前用户信息尚未加载';
            console.log(`[Guac Authority] ${reason}`);
            alert(reason);
            setActionAnchor({ anchor: null, id: null });
            return;
        }

        try {
            const res = await customFetch(`/back/api/vms/${vmName}/guac-with-authority?${params.toString()}`);
            let payload: any = null;
            try {
                payload = await res.json();
            } catch (err) {
                payload = null;
            }

            if (!res.ok) {
                const message = payload?.error ?? payload?.message ?? 'Guacamole info request failed';
                if (proto === 'vnc') {
                    setBlockedVnc((prev) => ({ ...prev, [vmName]: true }));
                }
                console.log(`[Guac Authority] ${message}`);
                const error = new Error(message);
                (error as any).__alreadyLogged = true;
                throw error;
            }

            if (!payload) {
                throw new Error('Guacamole info response is invalid');
            }

            const info = payload;
            const port = proto === 'ssh' ? info.ssh_port : proto === 'rdp' ? info.rdp_port : info.vnc_port;
            openGuacWindow({ type: proto, hostname: info.host, port: String(port) });
            if (proto === 'vnc') {
                setBlockedVnc((prev) => {
                    if (!prev[vmName]) return prev;
                    const { [vmName]: _removed, ...rest } = prev;
                    return rest;
                });
            }
        } catch (e: any) {
            if (!e?.__alreadyLogged) {
                console.log('打开连接失败：', e?.message ?? e);
            }
            alert(e?.message || 'Failed to open connection');
        } finally {
            setActionAnchor({ anchor: null, id: null });
        }
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

    const columns = React.useMemo<GridColDef<VmInstance>[]>(
        () => [
            { field: 'status', headerName: '状态', width: 80, renderCell: (p) => <VmInfoCell id={p.row.id} width={20}>{d => stateIcon(d.status as any)}</VmInfoCell> },
            { field: 'name', headerName: '名称', flex: 1 },
            // New column for "Is Target"
            {
                field: 'is_target',
                headerName: '是否为靶机',
                width: 120,
                hide: !showColumns.is_target,
                renderCell: (params) => (
                    <Chip
                        label={params.value ? '是' : '否'}
                        color={params.value ? 'primary' : 'default'}
                        size="small"
                        variant="outlined"
                    />
                )
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
                width: 240,
                renderCell: (params) => {
                    const vm = params.row;
                    const { data: info } = useVmInfo(vm.id);
                    const state = info?.status || vm.state;
                    const isRunning = state === 'running';
                    const isPaused = state === 'paused';
                    const isTarget = vm.is_target; // 检查是否为靶机
                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {isRunning ? (
                                <>
                                    <Tooltip title="暂停"><IconButton size="small" onClick={() => handleLifecycle(vm, 'pause')} disabled={actionLoading}><PauseIcon fontSize="small" /></IconButton></Tooltip>
                                    <Tooltip title="关机"><IconButton size="small" onClick={() => handleLifecycle(vm, 'shutdown')} disabled={actionLoading}><StopIcon fontSize="small" color="error" /></IconButton></Tooltip>
                                    <Tooltip title="重启"><IconButton size="small" onClick={() => handleLifecycle(vm, 'reboot')} disabled={actionLoading}><ResetIcon fontSize="small" /></IconButton></Tooltip>
                                </>
                            ) : (
                                <Tooltip title={isPaused ? "恢复" : "启动"}><IconButton size="small" onClick={() => handleLifecycle(vm, isPaused ? 'resume' : 'start')} disabled={actionLoading}><StartIcon fontSize="small" color="success" /></IconButton></Tooltip>
                            )}
                            <Tooltip title="删除"><IconButton size="small" onClick={() => handleDelete(vm)} disabled={actionLoading}><DeleteIcon fontSize="small" color="error" /></IconButton></Tooltip>
                            {/* 只有靶机才显示Flag提交按钮 */}
                            {isTarget && (
                                <>
                                    <Tooltip title="提交Flag">
                                        <span>
                                            <IconButton onClick={() => setFlagSubmissionModalId(vm.id)} size="small" disabled={!isRunning || actionLoading}>
                                                <FlagIcon fontSize="small" color={isRunning ? 'primary' : 'disabled'} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </>
                            )}
                            <Tooltip title="日志">
                                <span>
                                    <IconButton onClick={() => handleOpenLogs(vm)} size="small">
                                        <ArticleIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title="更多操作"><IconButton size="small" onClick={(e) => setActionAnchor({ anchor: e.currentTarget, id: vm.id })}><ArrowDownIcon fontSize="small" /></IconButton></Tooltip>
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

    // 如果没有instanceId，显示提示信息
    if (!instanceId) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">请先选择一个场景实例。</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">虚拟机列表</Typography>
                <TextField
                    variant="outlined"
                    placeholder="搜索虚拟机..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    size="small"
                    InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                    sx={{ width: { xs: "100%", sm: 260 } }}
                />
                <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => mutate()} disabled={isValidating}>
                    {isValidating ? '刷新中...' : '刷新'}
                </Button>
                <Button startIcon={<ViewColumnIcon />} onClick={(e)=>setColumnAnchor(e.currentTarget)} variant="outlined" size="small">显示列</Button>
                <FormControlLabel
                    control={<Checkbox checked={showRunningOnly} onChange={(e) => setShowRunningOnly(e.target.checked)} />}
                    label="只显示运行中"
                />
            </Box>

            <Menu anchorEl={columnAnchor} open={Boolean(columnAnchor)} onClose={() => setColumnAnchor(null)}>
                {Object.entries(showColumns).map(([key, val]) => (
                    <MenuItem key={key}>
                        <FormControlLabel
                            control={<Switch checked={val} onChange={(e) => setShowColumns(prev => ({ ...prev, [key]: e.target.checked }))} />}
                            label={
                                key === 'hostNode' ? '宿主机' :
                                    key === 'pool' ? '存储池' :
                                        key === 'osType' ? '系统类型' :
                                            key === 'ip' ? 'IP地址' :
                                                key === 'is_target' ? '是否为靶机' :
                                                    key // Fallback label
                            }
                        />
                    </MenuItem>
                ))}
            </Menu>

            <Box component={Paper} sx={{ height: 'calc(100vh - 350px)', width: '100%' }}>
                <DataGrid
                    rows={filteredRows}
                    columns={columns}
                    loading={isLoading}
                    density="compact"
                    pageSizeOptions={[10, 25, 50]}
                    paginationModel={{ pageSize: rowsPerPage, page }}
                    onPaginationModelChange={(m) => { setRowsPerPage(m.pageSize); setPage(m.page); }}
                    sx={{ '& .MuiDataGrid-columnHeaders': { bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200] } }}
                />
            </Box>

            <Menu anchorEl={actionAnchor.anchor} open={Boolean(actionAnchor.anchor)} onClose={() => setActionAnchor({ anchor: null, id: null })}>
                <MenuItem
                    disabled={!selectedVm || !!blockedVnc[selectedVm.name] || !effectiveUsername}
                    onClick={() => {
                        if (selectedVm) {
                            handleGuac(selectedVm.name, 'vnc');
                        }
                    }}
                >
                    <VncIcon fontSize="small" sx={{ mr: 1 }} /> VNC 控制台
                </MenuItem>
            </Menu>

            <Backdrop open={actionLoading} sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: '#fff' }}>
                <CircularProgress color="inherit" />
            </Backdrop>

            {flagSubmissionModalId && (
                <FlagSubmissionModal
                    open={Boolean(flagSubmissionModalId)}
                    onClose={() => setFlagSubmissionModalId(null)}
                    instanceId={flagSubmissionModalId}
                    instanceType="vm"
                    sceneInstanceId={instanceId || ''}
                    instanceName={data?.find(vm => vm.id === flagSubmissionModalId)?.name}
                />
            )}
        </Box>
    );
};

export default VmInstancesTab;