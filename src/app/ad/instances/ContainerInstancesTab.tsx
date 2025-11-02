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

import { RunningInstance as OriginalRunningInstance, InstanceStatus } from '@/types';

interface RunningInstance extends OriginalRunningInstance {
    team_id: string | null;
    can_operate: string | boolean;
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

const API_BASE = "/back";

interface ContainerInstancesTabProps {
    instanceId: string | null;
}

const ContainerInstancesTab: React.FC<ContainerInstancesTabProps> = ({ instanceId }) => {
    const theme = useTheme();
    // ★ 1. 从 useAuth hook 中获取 user 和 userTeamId ★
    const { user, userTeamId } = useAuth();

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

    // 原始版本中的操作函数，保持不变
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
    }, [fetchInstanceDetails, user]);

    const handleOpenLogs = useCallback((instance: RunningInstance) => {
        setLogsModalId(instance.id);
    }, []);

    // 原始版本中需要的权限辅助函数，保持不变
    const isPrivilegedUser = useCallback((currentUser: any): boolean => {
        if (!currentUser) return false;
        const privilegedRoles = ['admin', 'referee', 'administrator'];
        const roles = currentUser.role || currentUser.user?.roles;
        if (Array.isArray(roles)) {
            return roles.some(role => privilegedRoles.includes(role.c_name || role));
        }
        return false;
    }, []);

    const getUserTeamId = useCallback((currentUser: any): string | null => {
        if (!currentUser) return null;
        return currentUser.team_id || currentUser.user?.team_id || null;
    }, []);


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
            field: 'actions', headerName: '操作', sortable: false, width: 320,
            renderCell: (params) => {
                const instance = params.row as RunningInstance;
                const isActionable = !['starting', 'stopping', 'deleting', 'restarting'].includes(instance.status);
                const isStopped = instance.status === 'exited' || instance.status === 'stopped';
                const isRunning = instance.status === 'running';
                const isPaused = instance.status === 'paused';
                const isTarget = instance.is_target;

                const safeJsonParse = (b64: string | boolean): any => {
                    if (typeof b64 !== 'string' || b64 === '') {
                        return { can_operate: !!b64 };
                    }
                    try {
                        const paddedB64 = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
                        return JSON.parse(atob(paddedB64));
                    } catch (e) {
                        console.error("Failed to parse 'can_operate' field:", e, "Original value:", b64);
                        return { can_operate: false };
                    }
                };

                const canOperateGeneral = safeJsonParse(instance.can_operate);
                const isAdminOrReferee = isPrivilegedUser(user);

                // ★ 2. 在这里添加Flag提交的权限判断逻辑 ★
                const isOwnTeamTarget = !!(userTeamId && instance.team_id && String(userTeamId) === String(instance.team_id));
                const canSubmitFlag = isAdminOrReferee || !isOwnTeamTarget;

                // 终端权限逻辑保持不变
                const isTeamMember = !!(userTeamId && instance.team_id && String(userTeamId) === String(instance.team_id));
                const hasTerminalPermission = isAdminOrReferee || isTeamMember;

                return (
                    <Box>
                        {/* 原始版本的启动/暂停、停止、删除按钮逻辑，保持不变 */}
                        <Tooltip title={canOperateGeneral?.can_operate ? (isRunning ? '暂停' : '启动/恢复') : "无权限"}>
                            <Box component="span">
                                <IconButton onClick={() => handleStartInstance(instance)} size="small" disabled={!isActionable || (!isRunning && !isPaused && !isStopped) || !canOperateGeneral?.can_operate}>
                                    {isRunning ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" color={canOperateGeneral?.can_operate ? "success" : "disabled"} />}
                                </IconButton>
                            </Box>
                        </Tooltip>
                        <Tooltip title={canOperateGeneral?.container_stop ? "停止" : "无权限"}>
                            <Box component="span">
                                <IconButton onClick={() => handleStopInstance(instance)} size="small" disabled={!isActionable || isStopped || !canOperateGeneral?.container_stop}>
                                    <StopIcon fontSize="small" color={!isStopped && canOperateGeneral?.container_stop ? 'error' : 'disabled'} />
                                </IconButton>
                            </Box>
                        </Tooltip>
                        <Tooltip title={canOperateGeneral?.container_delete ? "删除" : "无权限"}>
                            <Box component="span">
                                <IconButton onClick={() => handleDeleteInstance(instance)} size="small" disabled={!isActionable || !isStopped || !canOperateGeneral?.container_delete}>
                                    <DeleteIcon fontSize="small" color={isStopped && canOperateGeneral?.container_delete ? 'error' : 'disabled'} />
                                </IconButton>
                            </Box>
                        </Tooltip>

                        {isTarget && (
                            <>
                                {/* ★ 3. 修改 Flag 按钮的 disabled 逻辑和 Tooltip 提示 ★ */}
                                <Tooltip title={canSubmitFlag ? "提交Flag" : "不能对本队靶机提交Flag"}>
                                    <Box component="span">
                                        <IconButton
                                            onClick={() => setFlagSubmissionModalId(instance.id)}
                                            size="small"
                                            disabled={!isRunning || !canSubmitFlag}
                                        >
                                            <FlagIcon fontSize="small" color={isRunning && canSubmitFlag ? 'primary' : 'disabled'} />
                                        </IconButton>
                                    </Box>
                                </Tooltip>
                                <Tooltip title="Flag历史记录">
                                    <Box component="span">
                                        <IconButton onClick={() => setFlagHistoryModalOpen(true)} size="small">
                                            <HistoryIcon fontSize="small" color="info" />
                                        </IconButton>
                                    </Box>
                                </Tooltip>
                            </>
                        )}

                        <Tooltip title="日志"><Box component="span"><IconButton onClick={() => handleOpenLogs(instance)} size="small"><ArticleIcon fontSize="small" /></IconButton></Box></Tooltip>

                        <Tooltip title={hasTerminalPermission ? "更多操作" : "您不属于此容器分配的队伍"}>
                            <Box component="span">
                                <IconButton onClick={(e) => setMoreMenuAnchor({ anchor: e.currentTarget, id: instance.id })} size="small" disabled={!hasTerminalPermission}>
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Tooltip>
                    </Box>
                );
            }
        }
        // ★ 4. 将 userTeamId 添加到依赖数组中 ★
    ], [showColumns, handleStartInstance, handleStopInstance, handlePauseInstance, handleDeleteInstance, handleOpenLogs, user, userTeamId, isPrivilegedUser, getUserTeamId]);

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
            {/* ... JSX 保持不变 ... */}
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
                <MenuItem onClick={() => {
                    const instance = instances.find(inst => inst.id === moreMenuAnchor.id);
                    if (instance) {
                        const isAdmin = isPrivilegedUser(user);
                        const isMember = !!(getUserTeamId(user) && instance.team_id && String(getUserTeamId(user)) === String(instance.team_id));
                        if(isAdmin || isMember) {
                            openTerminal(moreMenuAnchor.id!); // Non-null assertion is safe here
                        }
                    }
                    setMoreMenuAnchor({ anchor: null, id: null });
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