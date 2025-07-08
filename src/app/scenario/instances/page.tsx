"use client";
import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    Paper,
    IconButton,
    Chip,
    Tooltip,
    CircularProgress,
    Alert as MuiAlert,
    TextField,
    InputAdornment,
    useTheme,
    Checkbox,
    Switch,
    FormControlLabel,
    Menu,
    MenuItem,
} from '@mui/material';

const API_BASE = '/back/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import PauseIcon from '@mui/icons-material/Pause';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ComputerIcon from '@mui/icons-material/Computer'; // For VMs
import ViewInArIcon from '@mui/icons-material/ViewInAr'; // For Containers
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import RouterIcon from '@mui/icons-material/Router';
import DnsIcon from '@mui/icons-material/Dns'; // Using Dns as a proxy for Switch


import { RunningInstance, InstanceStatus } from '@/types';
import { STATUS_TRANSLATIONS } from '@/constants';
import InstanceDetailsModal from '@/components/scenario/InstanceDetailsModal';
import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';
import ContainerLogsModal from '@/components/scenario/ContainerLogsModal';
import ContainerInspectModal from '@/components/scenario/ContainerInspectModal';
import BindMountsModal from '@/components/scenario/BindMountsModal';
import { useExecTerminal } from '@/contexts/ExecTerminalContext';
import CreateContainerModal from '@/components/scenario/CreateContainerModal';
import { useAuth } from '@/hooks/useAuth';


const RunningInstancesPage: React.FC = () => {
    const theme = useTheme();
    const { user } = useAuth();
    const [instances, setInstances] = useState<RunningInstance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedInstance, setSelectedInstance] = useState<RunningInstance | null>(null);

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [confirmActionProps, setConfirmActionProps] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        instanceName?: string;
    } | null>(null);

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [showRunningOnly, setShowRunningOnly] = useState(false);
    const [rowSelectionModel, setRowSelectionModel] = useState<{ type: 'include' | 'exclude'; ids: Set<string> }>({ type: 'include', ids: new Set() });
    const [columnAnchorEl, setColumnAnchorEl] = useState<null | HTMLElement>(null);
    const [moreMenuAnchor, setMoreMenuAnchor] = useState<{ anchor: HTMLElement | null; id: string | null }>({ anchor: null, id: null });
    const [logsModalId, setLogsModalId] = useState<string | null>(null);
    const [inspectModalId, setInspectModalId] = useState<string | null>(null);
    const [bindsModalId, setBindsModalId] = useState<string | null>(null);
    const { openTerminal } = useExecTerminal();
    const [showColumns, setShowColumns] = useState({
        id: true,
        imageName: true,
        ports: true,
        cpuUsage: true,
        memoryUsage: true,
        uptime: true,
    });
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [createModalOpen, setCreateModalOpen] = useState(false);

    const getStatusChipColor = (status: InstanceStatus): "success" | "warning" | "error" | "info" | "default" => {
        switch (status) {
            case 'running': return 'success';
            case 'starting':
            case 'stopping':
            case 'deleting':
                return 'warning';
            case 'stopped': return 'default';
            case 'error': return 'error';
            default: return 'info';
        }
    };

    const getTypeIcon = (type: string) => {
        const iconProps = { sx: { verticalAlign: 'middle', mr: 0.5 }, fontSize: 'small' as 'small' };
        switch (type) {
            case 'vm': return <ComputerIcon {...iconProps} />;
            case 'container': return <ViewInArIcon {...iconProps} />;
            case '交换机': return <DnsIcon {...iconProps} />;
            case '路由器': return <RouterIcon {...iconProps} />;
            case 'NAT网桥': return <LinkIcon {...iconProps} />;
            default: return null;
        }
    };

    const columns: GridColDef[] = React.useMemo(() => [
        { field: 'name', headerName: '名称', flex: 1 },
        { field: 'type', headerName: '类型', flex: 1, renderCell: (params) => (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getTypeIcon(params.row.type)}{params.row.type === 'vm' ? '虚拟机' : '容器'}
            </Box>
        ) },
        { field: 'status', headerName: '状态', flex: 1, renderCell: (params) => (
            <Chip label={STATUS_TRANSLATIONS[params.row.status]} color={getStatusChipColor(params.row.status)} size="small" />
        ) },
        { field: 'id', headerName: '容器ID', flex: 1, hide: !showColumns.id },
        { field: 'imageName', headerName: '镜像名', flex: 1, hide: !showColumns.imageName },
        { field: 'ports', headerName: '端口', flex: 1, hide: !showColumns.ports },
        { field: 'cpuUsage', headerName: 'CPU', flex: 1, hide: !showColumns.cpuUsage },
        { field: 'memoryUsage', headerName: '内存', flex: 1, hide: !showColumns.memoryUsage },
        { field: 'uptime', headerName: '运行时间', flex: 1, hide: !showColumns.uptime },
        {
            field: 'actions',
            headerName: '操作',
            sortable: false,
            flex: 1,
            renderCell: (params) => {
                const instance = params.row as RunningInstance;
                const isActionable = !['starting', 'stopping', 'deleting'].includes(instance.status);
                const isStopped = instance.status === 'stopped';
                const isRunning = instance.status === 'running';
                const isPaused = instance.status === 'paused';
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title={isRunning ? '暂停' : '启动'}>
                            <span>
                                <IconButton
                                    onClick={() => (isRunning ? handlePauseInstance(instance) : handleStartInstance(instance))}
                                    size="small"
                                    disabled={!isActionable || (!isRunning && !isPaused && !isStopped)}
                                >
                                    {isRunning ? (
                                        <PauseIcon fontSize="small" color={isActionable ? 'primary' : 'disabled'} />
                                    ) : (
                                        <PlayArrowIcon fontSize="small" color={isActionable ? 'success' : 'disabled'} />
                                    )}
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="停止">
                            <span>
                                <IconButton onClick={() => handleStopInstance(instance)} size="small" disabled={!isActionable || isStopped}>
                                    <StopIcon fontSize="small" color={isStopped ? 'disabled' : 'error'} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="删除">
                            <span>
                                <IconButton onClick={() => handleDeleteInstance(instance)} size="small" disabled={!isActionable || !isStopped && instance.status !== 'error'}>
                                    <DeleteIcon fontSize="small" color={isStopped || instance.status === 'error' ? (isActionable ? 'error' : 'disabled') : 'disabled'} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <IconButton onClick={(e) => setMoreMenuAnchor({ anchor: e.currentTarget, id: instance.id })} size="small">
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Box>
                );
            }
        }
    ], [showColumns]);

    const fetchInstances = React.useCallback(async () => {
        if (!user) return;
        const q = `?userId=${user.id}&role=${user.role}`;
        try {
            const res = await fetch(`${API_BASE}/instances`);
            if (!res.ok) throw new Error('fetch failed');
            const data = await res.json();
            setInstances(data);
            setFetchError(null);
        } catch {
            setInstances([]);
            setFetchError('无法连接到Docker后端。');
        }
    }, [user]);

    useEffect(() => {
        fetchInstances();
    }, [fetchInstances]);

    useEffect(() => {
        if (!user) return;
        const timer = setInterval(fetchInstances, 5000);
        return () => clearInterval(timer);
    }, [fetchInstances, user]);


    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value.toLowerCase());
        setPage(0);
    };


    const handleRefresh = () => {
        setIsLoading(true);
        fetchInstances().finally(() => setIsLoading(false));
    };

    const handleOpenDetailsModal = (instance: RunningInstance) => {
        setSelectedInstance(instance);
        setIsModalOpen(true);
    };

    const handleCloseDetailsModal = () => {
        setIsModalOpen(false);
        setSelectedInstance(null);
    };


    const handleStartInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `启动实例: ${instance.name}`,
            message: `您确定要启动实例 "${instance.name}" 吗？`,
            onConfirm: async () => {
                const action = instance.status === 'paused' ? 'unpause' : 'start';
                await fetch(`${API_BASE}/containers/${instance.id}?action=${action}`, { method: 'POST' });
                fetchInstances();
            },
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handleStopInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `停止实例: ${instance.name}`,
            message: `您确定要停止实例 "${instance.name}" 吗？`,
            onConfirm: async () => {
                await fetch(`${API_BASE}/containers/${instance.id}?action=stop`, { method: 'POST' });
                fetchInstances();
            },
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handlePauseInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `暂停实例: ${instance.name}`,
            message: `您确定要暂停实例 "${instance.name}" 吗？`,
            onConfirm: async () => {
                await fetch(`${API_BASE}/containers/${instance.id}?action=pause`, { method: 'POST' });
                fetchInstances();
            },
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handleDeleteInstance = (instance: RunningInstance) => {
        setConfirmActionProps({
            title: `删除实例: ${instance.name}`,
            message: `您确定要永久删除实例 "${instance.name}" 吗？此操作无法撤销。`,
            onConfirm: async () => {
                const id = instance.id;
                await fetch(`${API_BASE}/containers/${id}?action=delete`, { method: 'POST' });
                if (user) {
                    const q = `?userId=${user.id}&role=${user.role}&id=${id}`;
                    await fetch(`${API_BASE}/instances${q}`, { method: 'DELETE' });
                }
                fetchInstances();
            },
            instanceName: instance.name
        });
        setIsConfirmDialogOpen(true);
    };

    const handleCreateInstance = () => {
        setCreateModalOpen(true);
    };

    const sortedAndFilteredInstances = React.useMemo(() => {
        let processedInstances = [...instances].filter(instance =>
            instance.name.toLowerCase().includes(searchTerm) ||
            instance.id.includes(searchTerm) ||
            instance.imageName.toLowerCase().includes(searchTerm)
        );
        if (showRunningOnly) {
            processedInstances = processedInstances.filter(i => i.status === 'running');
        }
        return processedInstances;
    }, [instances, searchTerm, showRunningOnly]);

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="h4" component="h1">容器实例管理</Typography>
                    <TextField
                        variant="outlined"
                        placeholder="搜索容器 (名称, ID, 镜像)..."
                        onChange={handleSearchChange}
                        size="small"
                        InputProps={{ startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        )}}
                        sx={{ width: { xs: '100%', sm: 260 } }}
                    />
                    <Button startIcon={<ViewColumnIcon />} onClick={(e) => setColumnAnchorEl(e.currentTarget)} variant="outlined" size="small">显示列</Button>
                    <FormControlLabel
                        control={<Checkbox checked={showRunningOnly} onChange={(e)=>setShowRunningOnly(e.target.checked)} />}
                        label="只显示运行中的容器"
                    />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                        onClick={handleRefresh}
                        disabled={isLoading}
                        aria-label="刷新实例列表"
                    >
                        刷新
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={handleCreateInstance}
                        aria-label="创建新实例"
                    >
                        创建实例
                    </Button>
                </Box>
            </Box>

            <Menu anchorEl={columnAnchorEl} open={Boolean(columnAnchorEl)} onClose={()=>setColumnAnchorEl(null)}>
                {Object.entries(showColumns).map(([key,val])=> (
                    <MenuItem key={key}>
                        <FormControlLabel control={<Switch checked={val} onChange={(e)=>setShowColumns(prev=>({...prev,[key]:e.target.checked}))} color="primary"/>} label={
                            key === 'id' ? '容器 ID' :
                            key === 'imageName' ? '镜像名' :
                            key === 'ports' ? '端口' :
                            key === 'cpuUsage' ? 'CPU 使用率' :
                            key === 'memoryUsage' ? '内存使用率' :
                            '运行时间'
                        } />
                    </MenuItem>
                ))}
            </Menu>


            {fetchError ? (
                <MuiAlert severity="error" sx={{ mb: 2, fontSize: '1.2rem' }}>
                    {fetchError}
                </MuiAlert>
            ) : (
            <Box component={Paper} sx={{ boxShadow: 3 }}>
                <DataGrid
                    autoHeight
                    checkboxSelection
                    disableRowSelectionOnClick
                    rows={sortedAndFilteredInstances}
                    columns={columns}
                    pageSizeOptions={[5, 10, 25]}
                    paginationModel={{ pageSize: rowsPerPage, page }}
                    onPaginationModelChange={(m) => {
                        setRowsPerPage(m.pageSize);
                        setPage(m.page);
                    }}
                    rowSelectionModel={rowSelectionModel}
                    onRowSelectionModelChange={(model) => setRowSelectionModel(model as any)}
                    columnVisibilityModel={showColumns}
                    onColumnVisibilityModelChange={(m) => setShowColumns(m as any)}
                    sx={{
                        '& .MuiDataGrid-columnHeaders': {
                            bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
                        }
                    }}
                />
            </Box>
            )}
            <Menu anchorEl={moreMenuAnchor.anchor} open={Boolean(moreMenuAnchor.anchor)} onClose={() => setMoreMenuAnchor({ anchor: null, id: null })}>
                <MenuItem onClick={() => { setLogsModalId(moreMenuAnchor.id); setMoreMenuAnchor({ anchor: null, id: null }); }}>
                    Logs
                </MenuItem>
                <MenuItem onClick={() => { setInspectModalId(moreMenuAnchor.id); setMoreMenuAnchor({ anchor: null, id: null }); }}>
                    Inspect
                </MenuItem>
                <MenuItem onClick={() => { setBindsModalId(moreMenuAnchor.id); setMoreMenuAnchor({ anchor: null, id: null }); }}>
                    Bind mounts
                </MenuItem>
                <MenuItem onClick={() => { if (moreMenuAnchor.id) openTerminal(moreMenuAnchor.id); setMoreMenuAnchor({ anchor: null, id: null }); }}>
                    Terminal
                </MenuItem>
            </Menu>

            {selectedInstance && (
                <InstanceDetailsModal
                    open={isModalOpen}
                    onClose={handleCloseDetailsModal}
                    instance={selectedInstance}
                />
            )}

            {confirmActionProps && (
                <ConfirmActionDialog
                    open={isConfirmDialogOpen}
                    onClose={() => setIsConfirmDialogOpen(false)}
                    title={confirmActionProps.title}
                    message={confirmActionProps.message}
                    onConfirm={() => {
                        confirmActionProps.onConfirm();
                        setIsConfirmDialogOpen(false);
                    }}
                />
            )}
            <ContainerLogsModal open={Boolean(logsModalId)} containerId={logsModalId} onClose={() => setLogsModalId(null)} />
            <ContainerInspectModal open={Boolean(inspectModalId)} containerId={inspectModalId} onClose={() => setInspectModalId(null)} />
            <BindMountsModal open={Boolean(bindsModalId)} containerId={bindsModalId} onClose={() => setBindsModalId(null)} />
            <CreateContainerModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onCreated={fetchInstances}
            />
        </Box>
    );
};

export default RunningInstancesPage;
