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
    History as HistoryIcon,
    Article as ArticleIcon
} from '@mui/icons-material';
import useSWR, { mutate as globalMutate } from "swr";

import { RunningInstance as OriginalRunningInstance, InstanceStatus } from '@/types';

// 定义扩展的接口
interface RunningInstance extends OriginalRunningInstance {
    team_id: string | null;
    can_operate: string | boolean; // 后端返回的 base64 权限包
}

import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';
import ContainerLogsModal from '@/components/scenario/ContainerLogsModal';
import ContainerInspectModal from '@/components/scenario/ContainerInspectModal';
import BindMountsModal from '@/components/scenario/BindMountsModal';
import FlagSubmissionModal from '@/components/scenario/FlagSubmissionModal';
import FlagHistoryModal from '@/components/scenario/FlagHistoryModal';
import { useExecTerminal } from '@/contexts/ExecTerminalContext';
import { useAuth } from '@/hooks/useAuth';
import { customFetch } from '@/utils/fetch';
import { toast } from 'react-toastify';
import {v4 as uuidv4} from "uuid";

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
    const [flagHistoryModalOpen, setFlagHistoryModalOpen] = useState(false);
    const { openTerminal } = useExecTerminal();
    const [columnAnchorEl, setColumnAnchorEl] = useState<null | HTMLElement>(null);
    const [showColumns, setShowColumns] = useState({
        id: false,
        is_target: true,
        team_id: true,
        imageName: true,
        ports: true,
        cpuUsage: false,
        memoryUsage: false,
        uptime: false,
        ipAddress: true,
        scene_instance_id: false,
        scene_name: false,
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
            setInstances(Array.isArray(data) ? data : []);
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
                await customFetch(`${API_BASE}/api/containers/${instance.id}?action=stop`, { method: 'POST' });
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
                fetchInstanceDetails();
            },
        });
        setIsConfirmDialogOpen(true);
    }, [fetchInstanceDetails]);

    const handleOpenLogs = useCallback((instance: RunningInstance) => {
        const base =
            typeof window !== 'undefined'
                ? `${window.location.protocol}//${window.location.hostname}:25601` : process.env.NEXT_PUBLIC_KIBANA_BASE_URL;
        const version = process.env.NEXT_PUBLIC_KIBANA_VERSION || '1453';
        const id = uuidv4();
        const title = `${instance.scene_instance_id || ''}_${instance.name}`.toLowerCase();
        const params = encodeURIComponent(JSON.stringify({
            dataViewSpec: { id, title, allowNoIndex: true },
            columns: ["_source"],
            query: { language: "kuery", query: "" },
            filters: []
        }));
        const url = `${base}/app/r?l=DISCOVER_APP_LOCATOR&v=${version}&p=${params}`;
        window.open(url, '_blank');
    }, []);

    // ★ 核心：权限解析函数，包含所有细粒度权限的默认值 ★
    const safeJsonParse = (b64: string | boolean): { [key: string]: boolean } => {
        const defaultPermissions = {
            can_restart: false,
            can_stop: false,
            can_delete: false,
            can_logs: false,
            can_terminal: false, // 对应旧的 can_operate
            can_submit_flag: false,
            can_flag_history: false
        };

        if (typeof b64 !== 'string' || b64.trim() === '') {
            return { ...defaultPermissions };
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

    const columns: GridColDef[] = useMemo(() => [
        { field: 'name', headerName: '名称', flex: 1.5 },
        { field: 'status', headerName: '状态', width: 120, renderCell: (params) => (<Chip label={params.row.status} color={getStatusChipColor(params.row.status as InstanceStatus)} size="small" />)},
        {
            field: 'is_target',
            headerName: '是否为靶机',
            width: 100,
            hide: !showColumns.is_target,
            renderCell: (params) => ( <Chip label={params.value ? '是' : '否'} color={params.value ? 'primary' : 'default'} size="small" variant="outlined" /> )
        },
        { field: 'team_id', headerName: '所属队伍ID', width: 120, hide: !showColumns.team_id },
        { field: 'imageName', headerName: '镜像', flex: 2, hide: !showColumns.imageName },
        { field: 'ports', headerName: '端口', flex: 1.5, hide: !showColumns.ports },
        { field: 'ipAddress', headerName: 'IP', width: 160, hide: !showColumns.ipAddress },
        { field: 'id', headerName: '容器ID', flex: 1, hide: !showColumns.id, renderCell: (params) => <Tooltip title={params.value}><code>{params.value.substring(0,12)}...</code></Tooltip> },
        {
            field: 'actions', headerName: '操作', sortable: false, width: 360,
            renderCell: (params) => {
                const instance = params.row as RunningInstance;
                const isActionable = !['starting', 'stopping', 'deleting', 'restarting'].includes(instance.status);
                const isStopped = instance.status === 'exited' || instance.status === 'stopped';
                const isRunning = instance.status === 'running';
                const isPaused = instance.status === 'paused';
                const isTarget = instance.is_target;

                // ★ 获取后端计算好的所有权限 ★
                const perms = safeJsonParse(instance.can_operate);

                return (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* 1. 启动/暂停 */}
                        <Tooltip title={perms.can_start ? (isRunning ? '暂停' : '启动/恢复') : "无权限"}>
                            <Box component="span">
                                <IconButton
                                    onClick={() => handleStartInstance(instance)}
                                    size="small"
                                    disabled={!isActionable || (!isRunning && !isPaused && !isStopped) || !perms.can_start}
                                >
                                    {isRunning ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" color={perms.can_start ? "success" : "disabled"} />}
                                </IconButton>
                            </Box>
                        </Tooltip>

                        {/* 2. 停止 */}
                        <Tooltip title={perms.can_stop ? "停止" : "无权限"}>
                            <Box component="span">
                                <IconButton
                                    onClick={() => handleStopInstance(instance)}
                                    size="small"
                                    disabled={!isActionable || isStopped || !perms.can_stop}
                                >
                                    <StopIcon fontSize="small" color={!isStopped && perms.can_stop ? 'error' : 'disabled'} />
                                </IconButton>
                            </Box>
                        </Tooltip>

                        {/* 3. 删除 */}
                        <Tooltip title={perms.can_delete ? "删除" : "无权限"}>
                            <Box component="span">
                                <IconButton
                                    onClick={() => handleDeleteInstance(instance)}
                                    size="small"
                                    disabled={!isActionable || !isStopped || !perms.can_delete}
                                >
                                    <DeleteIcon fontSize="small" color={isStopped && perms.can_delete ? 'error' : 'disabled'} />
                                </IconButton>
                            </Box>
                        </Tooltip>

                        {/* Flag 相关 (仅当容器是靶机时显示) */}
                        {isTarget && (
                            <>
                                {/* 4. 提交 Flag */}
                                <Tooltip title={perms.can_submit_flag ? "提交Flag" : "无提交权限(本队靶机或未运行)"}>
                                    <Box component="span">
                                        <IconButton
                                            onClick={() => setFlagSubmissionModalId(instance.id)}
                                            size="small"
                                            disabled={!isRunning || !perms.can_submit_flag}
                                        >
                                            <FlagIcon fontSize="small" color={isRunning && perms.can_submit_flag ? 'primary' : 'disabled'} />
                                        </IconButton>
                                    </Box>
                                </Tooltip>

                                {/* 5. Flag 历史 */}
                                <Tooltip title={perms.can_flag_history ? "Flag历史" : "无查看权限"}>
                                    <Box component="span">
                                        <IconButton
                                            onClick={() => setFlagHistoryModalOpen(true)}
                                            size="small"
                                            disabled={!perms.can_flag_history}
                                        >
                                            <HistoryIcon fontSize="small" color={perms.can_flag_history ? 'info' : 'disabled'} />
                                        </IconButton>
                                    </Box>
                                </Tooltip>
                            </>
                        )}

                        {/* 6. 日志 */}
                        <Tooltip title={perms.can_logs ? "日志" : "无权限"}>
                            <Box component="span">
                                <IconButton
                                    onClick={() => handleOpenLogs(instance)}
                                    size="small"
                                    disabled={!perms.can_logs}
                                >
                                    <ArticleIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Tooltip>

                        {/* 7. 更多操作 (终端) */}
                        <Tooltip title={perms.can_terminal ? "更多操作" : "无权限"}>
                            <Box component="span">
                                <IconButton
                                    onClick={(e) => setMoreMenuAnchor({ anchor: e.currentTarget, id: instance.id })}
                                    size="small"
                                    disabled={!perms.can_terminal}
                                >
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Tooltip>
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
                <TextField variant="outlined" placeholder="搜索容器名称或镜像..." onChange={(e) => setSearchTerm(e.target.value)} size="small" InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} />
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
                    <DataGrid rows={filteredContainers} columns={columns} pageSizeOptions={[10, 20, 50, 100]} disableRowSelectionOnClick autoHeight={false}
                              sx={{ border: 0, '& .MuiDataGrid-columnHeaders': { bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200] } }} />
                </Box>
            )}

            <Menu anchorEl={columnAnchorEl} open={Boolean(columnAnchorEl)} onClose={()=>setColumnAnchorEl(null)}>
                {Object.entries(showColumns).map(([key,val])=> (
                    <MenuItem key={key}>
                        <FormControlLabel control={<Switch checked={val} onChange={(e)=>setShowColumns(prev=>({...prev,[key]:e.target.checked}))} color="primary"/>}
                                          label={ key === 'id' ? '容器 ID' : key === 'imageName' ? '镜像名' : key === 'ports' ? '端口' : key === 'cpuUsage' ? 'CPU' : key === 'memoryUsage' ? '内存' : key === 'ipAddress' ? 'IP' : key === 'scene_instance_id' ? '场景实例ID' : key === 'scene_name' ? '场景名称' : key === 'is_target' ? '是否为靶机' : key === 'team_id' ? '队伍ID' : '运行时间' } />
                    </MenuItem>
                ))}
            </Menu>

            <Menu anchorEl={moreMenuAnchor.anchor} open={Boolean(moreMenuAnchor.anchor)} onClose={() => setMoreMenuAnchor({ anchor: null, id: null })}>
                <MenuItem onClick={() => { setLogsModalId(moreMenuAnchor.id); setMoreMenuAnchor({ anchor: null, id: null }); }}> 查看日志 </MenuItem>
                <MenuItem onClick={() => { setInspectModalId(moreMenuAnchor.id); setMoreMenuAnchor({ anchor: null, id: null }); }}> 查看详情 </MenuItem>
                <MenuItem onClick={() => { setBindsModalId(moreMenuAnchor.id); setMoreMenuAnchor({ anchor: null, id: null }); }}> 挂载点 </MenuItem>

                <MenuItem onClick={async () => {
                    const instanceId = moreMenuAnchor.id;
                    if (!instanceId) return;

                    setMoreMenuAnchor({ anchor: null, id: null });

                    try {
                        const res = await customFetch(`/back/api/containers/${instanceId}/terminal-with-authority`);

                        if (!res.ok) {
                            let errorMsg = "无法打开终端";
                            try {
                                const data = await res.json();
                                if (data.message) errorMsg = data.message;
                            } catch(e) {}

                            toast.error(errorMsg);
                            return;
                        }

                        openTerminal(instanceId);

                    } catch (e) {
                        console.error("Terminal check failed", e);
                        toast.error("权限检查请求失败");
                    }
                }}>
                    打开终端
                </MenuItem>
            </Menu>

            {confirmActionProps && (
                <ConfirmActionDialog open={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} title={confirmActionProps.title} message={confirmActionProps.message}
                                     onConfirm={() => { confirmActionProps.onConfirm(); setIsConfirmDialogOpen(false); }} />
            )}

            {logsModalId && <ContainerLogsModal open={Boolean(logsModalId)} containerId={logsModalId} onClose={() => setLogsModalId(null)} />}
            {inspectModalId && <ContainerInspectModal open={Boolean(inspectModalId)} containerId={inspectModalId} onClose={() => setInspectModalId(null)} />}
            {bindsModalId && <BindMountsModal open={Boolean(bindsModalId)} containerId={bindsModalId} onClose={() => setBindsModalId(null)} />}
            {flagSubmissionModalId && (
                <FlagSubmissionModal open={Boolean(flagSubmissionModalId)} onClose={() => setFlagSubmissionModalId(null)} instanceId={flagSubmissionModalId} instanceType="docker" sceneInstanceId={instanceId || ''} instanceName={instances.find(i => i.id === flagSubmissionModalId)?.name} />
            )}

            {flagHistoryModalOpen && (
                <FlagHistoryModal
                    open={flagHistoryModalOpen}
                    onClose={() => setFlagHistoryModalOpen(false)}
                    sceneInstanceId={instanceId || ''}
                    title="Docker容器Flag历史记录"
                />
            )}
        </Box>
    );
};

export default ContainerInstancesTab;