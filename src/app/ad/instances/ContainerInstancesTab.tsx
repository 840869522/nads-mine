"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Typography, CircularProgress, Alert as MuiAlert, Paper, IconButton, Chip, Tooltip,
    TextField, InputAdornment, Switch, FormControlLabel, Menu, MenuItem, Button, useTheme
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
    Refresh as RefreshIcon, Search as SearchIcon, PlayArrow as PlayArrowIcon,
    Stop as StopIcon, Delete as DeleteIcon, Pause as PauseIcon,
    ViewColumn as ViewColumnIcon, MoreVert as MoreVertIcon, Flag as FlagIcon,
    Article as ArticleIcon
} from '@mui/icons-material';

import { RunningInstance, InstanceStatus } from '@/types';
import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';
import ContainerLogsModal from '@/components/scenario/ContainerLogsModal';
import ContainerInspectModal from '@/components/scenario/ContainerInspectModal';
import BindMountsModal from '@/components/scenario/BindMountsModal';
import FlagSubmissionModal from '@/components/scenario/FlagSubmissionModal';
import { useExecTerminal } from '@/contexts/ExecTerminalContext';
import { useAuth } from '@/hooks/useAuth';
import { customFetch } from '@/utils/fetch';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = "/back";

interface ContainerInstancesTabProps {
    instanceId: string | null;
}

const ContainerInstancesTab: React.FC<ContainerInstancesTabProps> = ({ instanceId }) => {
    const theme = useTheme();
    const { user } = useAuth();

    const [instances, setInstances] = useState<RunningInstance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [confirmActionProps, setConfirmActionProps] = useState<{ title: string; message: string; onConfirm: () => void; } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [moreMenuAnchor, setMoreMenuAnchor] = useState<{ anchor: HTMLElement | null; id: string | null }>({ anchor: null, id: null });
    const [logsModalId, setLogsModalId] = useState<string | null>(null);
    const [inspectModalId, setInspectModalId] = useState<string | null>(null);
    const [bindsModalId, setBindsModalId] = useState<string | null>(null);
    const [flagSubmissionModalId, setFlagSubmissionModalId] = useState<string | null>(null);
    const { openTerminal } = useExecTerminal();
    const [columnAnchorEl, setColumnAnchorEl] = useState<null | HTMLElement>(null);
    const [showColumns, setShowColumns] = useState({
        id: false,
        is_target: true, // Added for the new column
        imageName: true,
        ports: true,
        cpuUsage: true,
        memoryUsage: true,
        uptime: true,
        ipAddress: true,
        scene_instance_id: true,
        scene_name: true,
    });

    const getStatusChipColor = (status: InstanceStatus): "success" | "warning" | "error" | "info" | "default" => {
        switch (status) {
            case 'running': return 'success';
            case 'paused': return 'info';
            case 'restarting': case 'starting': case 'stopping': case 'deleting': return 'warning';
            case 'exited': case 'stopped': return 'default';
            case 'error': return 'error';
            default: return 'info';
        }
    };

    const fetchInstanceDetails = useCallback(async () => {
        if (!instanceId || !user) {
            setInstances([]);
            return;
        }
        setIsLoading(true);
        setFetchError(null);
        const url = `${API_BASE}/api/scenariosinstances/${instanceId}`;
        try {
            const res = await customFetch(url);
            if (!res.ok) throw new Error(`获取容器列表失败，状态码: ${res.status}`);
            const data = await res.json();
            setInstances(data);
        } catch (err: any) {
            setInstances([]);
            setFetchError(err.message || '无法连接到后端服务。');
        } finally {
            setIsLoading(false);
        }
    }, [instanceId, user]);

    useEffect(() => {
        if (instanceId) {
            fetchInstanceDetails();
        } else {
            setInstances([]);
            setFetchError(null);
        }
    }, [instanceId, fetchInstanceDetails]);

    const handleStartInstance = useCallback((instance: RunningInstance) => {
        setConfirmActionProps({
            title: `启动实例: ${instance.name}`,
            message: `您确定要启动实例 "${instance.name}" 吗？`,
            onConfirm: async () => {
                const action = instance.status === 'paused' ? 'unpause' : 'start';
                await customFetch(`${API_BASE}/api/containers/${instance.id}?action=${action}`, { method: 'POST' });
                fetchInstanceDetails();
            },
        });
        setIsConfirmDialogOpen(true);
    }, [fetchInstanceDetails]);

    const handleStopInstance = useCallback((instance: RunningInstance) => {
        setConfirmActionProps({
            title: `停止实例: ${instance.name}`,
            message: `您确定要停止实例 "${instance.name}" 吗？`,
            onConfirm: async () => {
                await fetch(`${API_BASE}/api/containers/${instance.id}?action=stop`, { method: 'POST' });
                fetchInstanceDetails();
            },
        });
        setIsConfirmDialogOpen(true);
    }, [fetchInstanceDetails]);

    const handlePauseInstance = useCallback((instance: RunningInstance) => {
        setConfirmActionProps({
            title: `暂停实例: ${instance.name}`,
            message: `您确定要暂停实例 "${instance.name}" 吗？`,
            onConfirm: async () => {
                await customFetch(`${API_BASE}/api/containers/${instance.id}?action=pause`, { method: 'POST' });
                fetchInstanceDetails();
            },
        });
        setIsConfirmDialogOpen(true);
    }, [fetchInstanceDetails]);

    const handleDeleteInstance = useCallback((instance: RunningInstance) => {
        setConfirmActionProps({
            title: `删除实例: ${instance.name}`,
            message: `您确定要永久删除实例 "${instance.name}" 吗？此操作无法撤销。`,
            onConfirm: async () => {
                await customFetch(`${API_BASE}/api/containers/${instance.id}?action=delete`, { method: 'POST' });
                if (user) {
                    const q = `?userId=${user.id}&role=${user.role}&id=${instance.id}`;
                    await customFetch(`${API_BASE}/api/instances${q}`, { method: 'DELETE' });
                }
                fetchInstanceDetails();
            },
        });
        setIsConfirmDialogOpen(true);
    }, [fetchInstanceDetails, user]);

    const handleOpenLogs = useCallback((instance: RunningInstance) => {
        const base = process.env.NEXT_PUBLIC_KIBANA_BASE_URL || 'http://10.12.0.102:25601';
        const version = process.env.NEXT_PUBLIC_KIBANA_VERSION || '';
        const id = uuidv4();
        const title = `${instance.scene_instance_id || ''}_${instance.name}`;
        const params = encodeURIComponent(JSON.stringify({
            dataViewSpec: { id, title, allowNoIndex: true },
            columns: ["_source"],
            query: { language: "kuery", query: "" },
            filters: []
        }));
        const url = `${base}/app/r?l=DISCOVER_APP_LOCATOR&v=${version}&p=${params}`;
        window.open(url, '_blank');
    }, []);

    const columns: GridColDef[] = React.useMemo(() => [
        { field: 'name', headerName: '名称', flex: 1.5 },
        { field: 'status', headerName: '状态', width: 120, renderCell: (params) => (<Chip label={params.row.status} color={getStatusChipColor(params.row.status as InstanceStatus)} size="small" />)},
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
        { field: 'imageName', headerName: '镜像', flex: 2, hide: !showColumns.imageName },
        { field: 'ports', headerName: '端口', flex: 2, hide: !showColumns.ports },
        { field: 'cpuUsage', headerName: 'CPU', width: 100, hide: !showColumns.cpuUsage },
        { field: 'memoryUsage', headerName: '内存', flex: 1, hide: !showColumns.memoryUsage },
        { field: 'uptime', headerName: '运行时间', flex: 1, hide: !showColumns.uptime },
        { field: 'ipAddress', headerName: 'IP', width: 160, hide: !showColumns.ipAddress },
        { field: 'scene_instance_id', headerName: '场景实例ID', width: 160, hide: !showColumns.scene_instance_id },
        { field: 'scene_name', headerName: '场景名称', width: 160, hide: !showColumns.scene_name },
        { field: 'id', headerName: '容器ID', flex: 1, hide: !showColumns.id, renderCell: (params) => <Tooltip title={params.value}><code>{params.value.substring(0,12)}...</code></Tooltip> },
        {
            field: 'actions', headerName: '操作', sortable: false, width: 260,
            renderCell: (params) => {
                const instance = params.row as RunningInstance;
                const isActionable = !['starting', 'stopping', 'deleting'].includes(instance.status);
                const isStopped = instance.status === 'exited' || instance.status === 'stopped';
                const isRunning = instance.status === 'running';
                const isPaused = instance.status === 'paused';
                const isTarget = instance.is_target; // 检查是否为靶机
                return (
                    <Box>
                        <Tooltip title={isRunning ? '暂停' : '启动'}>
                            <span>
                                <IconButton onClick={() => isRunning ? handlePauseInstance(instance) : handleStartInstance(instance)} size="small" disabled={!isActionable || (!isRunning && !isPaused && !isStopped)}>
                                    {isRunning ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" color="success" />}
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
                        {/* 只有靶机才显示Flag提交按钮 */}
                        {isTarget && (
                            <Tooltip title="提交Flag">
                                <span>
                                    <IconButton onClick={() => setFlagSubmissionModalId(instance.id)} size="small" disabled={!isRunning}>
                                        <FlagIcon fontSize="small" color={isRunning ? 'primary' : 'disabled'} />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        <Tooltip title="日志">
                            <span>
                                <IconButton onClick={() => handleOpenLogs(instance)} size="small">
                                    <ArticleIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <IconButton onClick={(e) => setMoreMenuAnchor({ anchor: e.currentTarget, id: instance.id })} size="small"><MoreVertIcon fontSize="small" /></IconButton>
                    </Box>
                );
            }
        }
    ], [showColumns, handleStartInstance, handleStopInstance, handlePauseInstance, handleDeleteInstance, handleOpenLogs]);

    const filteredContainers = useMemo(() => {
        if (!searchTerm.trim()) return instances;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return instances.filter(c =>
            (c.name || '').toLowerCase().includes(lowerCaseSearchTerm) ||
            (c.imageName || '').toLowerCase().includes(lowerCaseSearchTerm)
        );
    }, [instances, searchTerm]);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography variant="h6">容器列表</Typography>
                <TextField
                    variant="outlined"
                    placeholder="搜索容器名称或镜像..."
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                />
                <Button startIcon={<RefreshIcon />} onClick={fetchInstanceDetails} size="small" variant="outlined" disabled={isLoading}>
                    {isLoading ? '刷新中...' : '刷新'}
                </Button>
                <Button startIcon={<ViewColumnIcon />} onClick={(e) => setColumnAnchorEl(e.currentTarget)} variant="outlined" size="small">显示列</Button>
            </Box>
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 5 }}>
                    <CircularProgress />
                    <Typography sx={{ml: 2}}>正在加载容器数据...</Typography>
                </Box>
            ) : fetchError ? (
                <MuiAlert severity="error">{fetchError}</MuiAlert>
            ) : (
                <Box component={Paper} sx={{ height: 'calc(100vh - 300px)', width: '100%' }}>
                    <DataGrid
                        rows={filteredContainers}
                        columns={columns}
                        pageSizeOptions={[10, 20, 50, 100]}
                        disableRowSelectionOnClick
                        autoHeight={false}
                        sx={{
                            border: 0,
                            '& .MuiDataGrid-columnHeaders': {
                                bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
                            }
                        }}
                    />
                </Box>
            )}

            <Menu anchorEl={columnAnchorEl} open={Boolean(columnAnchorEl)} onClose={()=>setColumnAnchorEl(null)}>
                {Object.entries(showColumns).map(([key,val])=> (
                    <MenuItem key={key}>
                        <FormControlLabel
                            control={<Switch checked={val} onChange={(e)=>setShowColumns(prev=>({...prev,[key]:e.target.checked}))} color="primary"/>}
                            label={
                                key === 'id' ? '容器 ID' :
                                    key === 'imageName' ? '镜像名' :
                                        key === 'ports' ? '端口' :
                                            key === 'cpuUsage' ? 'CPU' :
                                                key === 'memoryUsage' ? '内存' :
                                                    key === 'ipAddress' ? 'IP' :
                                                        key === 'scene_instance_id' ? '场景实例ID' :
                                                            key === 'scene_name' ? '场景名称' :
                                                                key === 'is_target' ? '是否为靶机' : // Added label for new column
                                                                    '运行时间'
                            }
                        />
                    </MenuItem>
                ))}
            </Menu>

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

            {logsModalId && <ContainerLogsModal open={Boolean(logsModalId)} containerId={logsModalId} onClose={() => setLogsModalId(null)} />}
            {inspectModalId && <ContainerInspectModal open={Boolean(inspectModalId)} containerId={inspectModalId} onClose={() => setInspectModalId(null)} />}
            {bindsModalId && <BindMountsModal open={Boolean(bindsModalId)} containerId={bindsModalId} onClose={() => setBindsModalId(null)} />}
            {flagSubmissionModalId && (
                <FlagSubmissionModal
                    open={Boolean(flagSubmissionModalId)}
                    onClose={() => setFlagSubmissionModalId(null)}
                    instanceId={flagSubmissionModalId}
                    instanceType="docker"
                    sceneInstanceId={instanceId || ''}
                    instanceName={instances.find(i => i.id === flagSubmissionModalId)?.name}
                />
            )}
        </Box>
    );
};

export default ContainerInstancesTab;