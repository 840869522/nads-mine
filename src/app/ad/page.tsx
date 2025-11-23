"use client";

import React, {useState, useEffect, useCallback, FormEvent, MouseEvent, useMemo, useRef} from 'react';

// MUI 组件导入
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress, { LinearProgressProps } from '@mui/material/LinearProgress';

// MUI 图标
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import FlagIcon from '@mui/icons-material/Flag';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import BlockIcon from '@mui/icons-material/Block';

// 自定义钩子和组件
import { useDebounce } from '@/app/hooks/useDebounce';
import {useAuth} from "@/hooks/useAuth";
import { customFetch } from "@/utils/fetch";
import InstanceDetailsDialog from '../ad/instances/InstanceDetailsDialog';
import FlagHistoryModal from '../../components/scenario/FlagHistoryModal';
import InstanceTopologyDialog from '../scenario/sceneinstances/InstanceTopologyDialog';
import NodeTeamAssignmentDialog from './NodeTeamAssignmentDialog';
import MemberManagementDialog from './MemberManagementDialog';
import { TopologyData } from "@/types";
import { userPermissionContext } from '@/contexts/PermissionAndMenuContext';

// --- 类型定义 ---
interface User { c_username: string; c_email?: string; c_name?: string; }
interface AdReferee { c_user_id: string; c_level: string; user?: User; }
interface SceneConfigForAd { c_config_id: number; c_name: string; topology_json?: any; }
interface AdConfig { c_id: string; c_drill_name: string; c_description: string | null; c_scene_config_id: number | null; c_scene_instance_id: string | null; c_status: 'pending' | 'running' | 'finished' | 'archived' | 'failed' | 'creating'; c_start_time: string | null; c_end_time: string | null; c_type: number | null; c_show_attack: number | null; referees: AdReferee[]; sceneConfig?: { c_name: string; } | null; nodeAssignments?: any[]; }
interface TopologyNode { id: string; label: string; type: 'container' | 'virtual_machine' | 'switch' | 'nat_bridge'; }


// --- 辅助组件 ---

const ClientOnlyWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    if (!hasMounted) {
        return null;
    }

    return <>{children}</>;
};

function LinearProgressWithLabel(props: LinearProgressProps & { value: number; label: string }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">{props.label}</Typography>
            <Box sx={{ width: '100%', mr: 1, ml: 1 }}>
                <LinearProgress variant="determinate" {...props} />
            </Box>
            <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" color="text.secondary">{`${Math.round(props.value)}%`}</Typography>
            </Box>
        </Box>
    );
}

const AdManagementPage: React.FC = () => {
    const { user } = useAuth();
    const { permissions } = userPermissionContext();

    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    // ★★★ 1. 权限检查逻辑 (扩展版) ★★★

    const currentUsername = (user as any)?.user?.c_username || (user as any)?.c_username;
    const currentName = (user as any)?.user?.c_name || (user as any)?.c_name;
    const isAdminUser = currentUsername === 'admin';

    const rawUserPermissions = (user as any)?.user?.permission || (user as any)?.permission || [];

    // 辅助函数：检查是否有某个特定权限
    const checkPermission = (permKey: string) => {
        return isClient && (
            isAdminUser ||
            (permissions?.includes(permKey) ?? false) ||
            (rawUserPermissions && rawUserPermissions.includes(permKey))
        );
    };

    // 定义所有按钮的权限开关
    const canCreate        = checkPermission('ad_add');         // 创建演练
    const canEdit          = checkPermission('ad_update');           // 编辑演练
    const canDelete        = checkPermission('ad_destroy');         // 删除演练

    const canStartDrill    = checkPermission('ad_start');          // 启动演练
    const canManageMembers = checkPermission('ad:member:ban');     // 成员禁赛
    const canAssignNodes   = checkPermission('ad:node:assign');    // 节点分配
    const canViewFlags     = checkPermission('ad:flag:history');   // Flag历史
    const canStopDrill     = checkPermission('ad_stop');           // 停止演练
    const canViewTopology  = checkPermission('ad:topology:view');  // 查看拓扑
    const canViewDetails   = checkPermission('ad:instance:view');  // 查看详情

    // ★★★ 新增：定义是否有权访问运行中的管理工具栏 ★★★
    const canAccessRunningTools = isAdminUser || canManageMembers || canAssignNodes || canViewFlags || canStopDrill;


    const startTimeRef = useRef<HTMLInputElement>(null);
    const endTimeRef = useRef<HTMLInputElement>(null);

    const API_BASE_URL = '/back/api';

    const [adConfigs, setAdConfigs] = useState<AdConfig[]>([]);
    const [totalAdConfigs, setTotalAdConfigs] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isFormLoading, setIsFormLoading] = useState(false);
    const [editingAdConfig, setEditingAdConfig] = useState<AdConfig | null>(null);
    const [selectedReferees, setSelectedReferees] = useState<AdReferee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [sceneConfigsForForm, setSceneConfigsForForm] = useState<SceneConfigForAd[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    // 修改：message 类型现在更明确地包含对象结构
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string | { [key: string]: string[] } } | null>(null);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [adConfigToDelete, setAdConfigToDelete] = useState<AdConfig | null>(null);

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [selectedScenarioName, setSelectedScenarioName] = useState<string>('');

    const [isFlagHistoryOpen, setIsFlagHistoryOpen] = useState(false);
    const [selectedAdForFlagHistory, setSelectedAdForFlagHistory] = useState<AdConfig | null>(null);

    const [isTopologyOpen, setIsTopologyOpen] = useState(false);
    const [selectedAdConfigForTopology, setSelectedAdConfigForTopology] = useState<AdConfig | null>(null);
    const [currentInstanceTopology, setCurrentInstanceTopology] = useState<any>(null);

    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
    const [selectedAdForAssignment, setSelectedAdForAssignment] = useState<AdConfig | null>(null);

    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [selectedAdForMembers, setSelectedAdForMembers] = useState<AdConfig | null>(null);

    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [progressValue, setProgressValue] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [progressError, setProgressError] = useState<string | null>(null);

    useEffect(() => {
        if (isFormOpen && !isFormLoading && editingAdConfig) {
            if (startTimeRef.current && editingAdConfig.c_start_time) {
                const localStartTime = new Date(new Date(editingAdConfig.c_start_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                startTimeRef.current.value = localStartTime;
            }
            if (endTimeRef.current && editingAdConfig.c_end_time) {
                const localEndTime = new Date(new Date(editingAdConfig.c_end_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                endTimeRef.current.value = localEndTime;
            }
        }
    }, [isFormOpen, isFormLoading, editingAdConfig]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            const params = new URLSearchParams({ search: debouncedSearchQuery, page: String(page + 1), per_page: String(rowsPerPage) });
            const adConfigsUrl = `${API_BASE_URL}/ad-configs?${params.toString()}`;
            const adConfigsRes = await customFetch(adConfigsUrl);
            if (!adConfigsRes.ok) throw new Error((await adConfigsRes.json()).message || '获取演练列表失败');
            const adConfigsData = await adConfigsRes.json();
            setAdConfigs(adConfigsData.data || []);
            setTotalAdConfigs(adConfigsData.meta?.total || 0);
        } catch (err) {
            console.error("加载页面数据时发生错误:", err);
            setStatusMessage({ type: 'error', message: "加载页面数据失败。" });
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery, page, rowsPerPage]);

    const loadDependenciesForForm = useCallback(async () => {
        setIsFormLoading(true);
        try {
            const promisesToRun = [];

            if (users.length === 0) {
                promisesToRun.push(
                    customFetch(`${API_BASE_URL}/ad/users?all=true`)
                        .then(res => res.json())
                        .then(data => ({ type: 'users', data }))
                );
            }
            if (sceneConfigsForForm.length === 0) {
                promisesToRun.push(
                    customFetch(`${API_BASE_URL}/scenarios?all=true`)
                        .then(res => res.json())
                        .then(data => ({ type: 'scenes', data }))
                );
            }

            if (promisesToRun.length > 0) {
                const results = await Promise.all(promisesToRun);
                results.forEach(result => {
                    if (result.type === 'users') {
                        const userList = result.data?.data?.data || result.data?.data || result.data || [];
                        setUsers(userList);
                    } else if (result.type === 'scenes') {
                        const rawScenes = Array.isArray(result.data) ? result.data : [];
                        const formattedScenes = rawScenes.map((scene: any) => ({
                            c_config_id: scene.id,
                            c_name: scene.name,
                        }));
                        setSceneConfigsForForm(formattedScenes);
                    }
                });
            }
        } catch (err) {
            console.error("加载表单依赖项时出错:", err);
            throw new Error("加载创建演练所需的数据失败，请稍后重试。");
        } finally {
            setIsFormLoading(false);
        }
    }, [users, sceneConfigsForForm]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(0); }, [debouncedSearchQuery]);

    const handleOpenForm = async (adConfig: AdConfig | null = null) => {
        setStatusMessage(null);
        setEditingAdConfig(adConfig);
        setIsFormOpen(true);
        try {
            await loadDependenciesForForm();
            if (adConfig) {
                const refereesWithUserDetails = (adConfig.referees || [])
                    .map(ref => ({...ref, user: users.find(u => u.c_username === ref.c_user_id)}))
                    .filter(ref => ref.user);
                setSelectedReferees(refereesWithUserDetails as AdReferee[]);
            } else {
                setSelectedReferees([]);
            }
        } catch(err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
            setIsFormOpen(false);
        }
    };

    const handleCloseForm = () => { setIsFormOpen(false); setEditingAdConfig(null); setSelectedReferees([]); };

    // ★★★ 核心修改：更新后的表单提交逻辑 ★★★
    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage(null);
        const formData = new FormData(e.currentTarget);
        const startTime = formData.get('c_start_time') as string;
        const endTime = formData.get('c_end_time') as string;
        const adConfigData = {
            c_drill_name: formData.get('c_drill_name') as string,
            c_description: formData.get('c_description') as string,
            c_scene_config_id: Number(formData.get('c_scene_config_id')) || null,
            c_start_time: startTime ? new Date(startTime).toISOString() : null,
            c_end_time: endTime ? new Date(endTime).toISOString() : null,
            c_type: formData.get('c_type') ? Number(formData.get('c_type')) : null,
            c_show_attack: formData.get('c_show_attack') ? Number(formData.get('c_show_attack')) : null,
            referees: selectedReferees.map(({ c_user_id, c_level }) => ({ c_user_id, c_level })),
            teams: [],
        };
        try {
            const url = editingAdConfig ? `${API_BASE_URL}/ad-configs/${editingAdConfig.c_id}` : `${API_BASE_URL}/ad-configs`;
            const method = editingAdConfig ? 'PUT' : 'POST';

            const response = await customFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' // ★ 确保后端返回 JSON 错误
                },
                body: JSON.stringify(adConfigData)
            });

            const result = await response.json();

            if (!response.ok) {
                // ★ 优先处理验证错误 422
                if (response.status === 422 && result.errors) {
                    setStatusMessage({ type: 'error', message: result.errors });
                    return; // 终止执行，保留在表单页面
                }
                throw new Error(result.message || '操作失败');
            }

            setStatusMessage({ type: 'success', message: result.message || '操作成功！' });
            handleCloseForm();
            await fetchData();
        } catch (error) {
            // 处理普通字符串错误
            setStatusMessage({ type: 'error', message: (error as Error).message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAdAction = async (ad: AdConfig) => {
        const username = (user as any)?.user?.c_username;
        if (!username) { setStatusMessage({ type: 'error', message: '无法获取当前用户名。' }); return; }
        if (!window.confirm(`您确定要启动演练 “${ad.c_drill_name}” 吗？`)) return;

        setProgressValue(0);
        setProgressMessage('正在准备启动演练...');
        setProgressError(null);
        setIsProgressModalOpen(true);

        const timer = setInterval(() => {
            setProgressValue((prev) => {
                if (prev >= 95) { clearInterval(timer); return 95; }
                return prev + Math.floor(Math.random() * 5);
            });
        }, 800);

        try {
            setProgressMessage('正在向服务器发送启动请求...');
            const response = await customFetch(`${API_BASE_URL}/ad-configs/${ad.c_id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
            clearInterval(timer);
            if (!response.ok) { const result = await response.json().catch(() => ({ message: '启动失败，无法解析错误信息。' })); throw new Error(result.message || '启动失败'); }
            const result = await response.json();
            setProgressMessage(result.message || '演练已成功启动！');
            setProgressValue(100);
            setStatusMessage({ type: 'success', message: '演练启动成功！' });
            setTimeout(() => { setIsProgressModalOpen(false); fetchData(); }, 1500);
        } catch (err: any) {
            clearInterval(timer);
            setProgressError(err.message || '启动过程中发生未知错误');
            setStatusMessage({ type: 'error', message: err.message });
        }
    };

    const handleTopologySave = async (newTopology: TopologyData) => {
        if (!selectedAdConfigForTopology) {
            console.error("无法保存拓扑，因为没有选中的演练配置。");
            return;
        }
        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            const url = `${API_BASE_URL}/ad-configs/${selectedAdConfigForTopology.c_id}/topology`;
            const response = await customFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topology: newTopology }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '拓扑更新失败');
            setStatusMessage({ type: 'success', message: '拓扑已成功更新并应用！' });
            setIsTopologyOpen(false);
            await fetchData();
        } catch (err: any) {
            setStatusMessage({ type: 'error', message: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ★★★ 核心修改：改进错误渲染函数，支持对象格式 ★★★
    const renderErrorMessage = (message: string | { [key: string]: string[] }) => {
        if (typeof message === 'string') return message;
        return (
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {Object.values(message).flat().map((msg, index) => (
                    <li key={index}>{msg}</li>
                ))}
            </ul>
        );
    };

    const renderStatusChip = (status: AdConfig['c_status']) => { const statusMap = { pending: { label: '未开始', color: 'default' as const }, running: { label: '进行中', color: 'success' as const }, finished: { label: '已结束', color: 'primary' as const }, archived: { label: '已归档', color: 'warning' as const }, failed: { label: '失败', color: 'error' as const }, creating: { label: '创建中...', color: 'info' as const }, }; const { label, color } = statusMap[status] || statusMap.pending; return <Chip label={label} color={color} size="small" />; };
    const mapTypeToString = (type: number | null) => { switch (type) { case 1: return '无人机类型'; case 2: return '科幻类型'; default: return '默认'; } };
    const mapShowAttackToString = (show: number | null) => { switch (show) { case 1: return <Chip label="是" color="success" size="small" />; case 0: return <Chip label="否" color="default" size="small" />; default: return <Chip label="未设置" color="default" size="small" />; } };
    const handleStopDrill = async (adConfig: AdConfig) => { if (!window.confirm(`您确定要停止演练 "${adConfig.c_drill_name}" 吗？`)) return; setIsSubmitting(true); setStatusMessage(null); try { const response = await customFetch(`${API_BASE_URL}/ad-configs/${adConfig.c_id}/stop`, { method: 'POST' }); const result = await response.json(); if (!response.ok) throw new Error(result.message || '停止演练失败'); setStatusMessage({ type: 'success', message: result.message || '演练已成功停止！' }); await fetchData(); } catch (err) { setStatusMessage({ type: 'error', message: (err as Error).message }); } finally { setIsSubmitting(false); } };
    const handleDeleteConfirmation = (adConfig: AdConfig) => { setAdConfigToDelete(adConfig); setIsConfirmOpen(true); };
    const handleDeleteAdConfig = async () => { if (!adConfigToDelete) return; setIsSubmitting(true); try { await customFetch(`${API_BASE_URL}/ad-configs/${adConfigToDelete.c_id}`, { method: 'DELETE' }); setStatusMessage({ type: 'success', message: `演练 "${adConfigToDelete.c_drill_name}" 已删除。` }); await fetchData(); } catch (err) { setStatusMessage({ type: 'error', message: (err as Error).message }); } finally { setIsSubmitting(false); setIsConfirmOpen(false); setAdConfigToDelete(null); } };
    const handleViewDetails = (adConfig: AdConfig) => { if (adConfig.c_scene_instance_id) { setSelectedInstanceId(adConfig.c_scene_instance_id); setSelectedScenarioName(adConfig.c_drill_name); setIsDetailsModalOpen(true); } else { setStatusMessage({ type: 'warning', message: '此演练尚未启动，无法查看实例详情。' }); } };
    const handleCloseDetails = () => { setIsDetailsModalOpen(false); };
    const handleOpenAssignmentDialog = (adConfig: AdConfig) => { if (adConfig.c_status === 'running' && adConfig.c_scene_instance_id) { setSelectedAdForAssignment(adConfig); setIsAssignmentDialogOpen(true); } else { setStatusMessage({ type: 'warning', message: '只有进行中的演练才能分配节点队伍。' }); } };
    const handleOpenMemberDialog = (adConfig: AdConfig) => { if (adConfig.c_status === 'running') { setSelectedAdForMembers(adConfig); setIsMemberDialogOpen(true); } else { setStatusMessage({ type: 'warning', message: '只有进行中的演练才能管理成员。' }); } };
    const handleViewTopology = async (adConfig: AdConfig) => { if (!adConfig.c_scene_instance_id) { setStatusMessage({ type: 'warning', message: '此演练尚未启动，无法查看拓扑。' }); return; } setIsSubmitting(true); setStatusMessage(null); try { const response = await customFetch(`${API_BASE_URL}/scenariosinstances/${adConfig.c_scene_instance_id}/config`); const result = await response.json(); if (!response.ok) throw new Error(result.message || '获取实例拓扑数据失败'); if (result && result.c_scene_config) { setCurrentInstanceTopology(result.c_scene_config); setSelectedAdConfigForTopology(adConfig); setIsTopologyOpen(true); } else { throw new Error('从实例数据中未找到有效的拓扑信息。'); } } catch (err: any) { setStatusMessage({ type: 'error', message: err.message }); } finally { setIsSubmitting(false); } };
    const handleTopologyTerminalClick = async (node: TopologyNode, instanceId: string): Promise<void> => { /* ... */ };
    const handleRefereeLevelChange = (user_id: string, newLevel: string) => { setSelectedReferees(prev => prev.map(ref => ref.c_user_id === user_id ? { ...ref, c_level: newLevel } : ref)); };
    const handleOpenView = (adConfig: AdConfig) => { if (adConfig.c_scene_instance_id && adConfig.c_status === "running") { const data = { id: adConfig.c_scene_instance_id, type: adConfig.c_type, showAttack: adConfig.c_show_attack }; localStorage.setItem('adData', JSON.stringify(data)); window.open('/visualization', '_blank'); } else { setStatusMessage({ type: 'warning', message: '演练未启动，无可视化界面。' }); } };
    const handleChangePage = (event: MouseEvent<HTMLButtonElement> | null, newPage: number) => { setPage(newPage); };
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };
    const handleOpenFlagHistory = (adConfig: AdConfig) => { if (adConfig.c_scene_instance_id) { setSelectedAdForFlagHistory(adConfig); setIsFlagHistoryOpen(true); } else { setStatusMessage({ type: 'warning', message: '此演练尚未启动，无法查看Flag历史。' }); } };
    const handleCloseFlagHistory = () => { setIsFlagHistoryOpen(false); setTimeout(() => setSelectedAdForFlagHistory(null), 300); };
    const isAdmin = (user as any)?.user?.c_username === 'admin';

    return (
        <Box sx={{ p: 3, maxWidth: '1600px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">攻防演练管理</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField variant="outlined" size="small" placeholder="搜索演练名称..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} sx={{ minWidth: '300px' }} />
                    {canCreate && (
                        <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()} disabled={isLoading}>创建新演练</Button>
                    )}
                </Box>
            </Box>

            {statusMessage && <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 2 }}>{renderErrorMessage(statusMessage.message)}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer sx={{ maxHeight: '70vh' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>演练名称</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>状态</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>裁判团队</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>场景模板</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>可视化类型</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>显示攻击</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>计划开始时间</TableCell>
                                <TableCell sx={{fontWeight: 'bold'}}>可视化</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? ( <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow> )
                                : adConfigs.map((adConfig, index) => {
                                    const isReferee = (adConfig.referees || []).some(ref => {
                                        if (ref.c_user_id === currentUsername) return true;
                                        if (currentName && ref.c_user_id === currentName) return true;
                                        if (ref.user && ref.user.c_username === currentUsername) return true;
                                        return false;
                                    });

                                    return (
                                        <TableRow hover key={`${adConfig.c_id}-${index}`}>
                                            <TableCell>{adConfig.c_drill_name}</TableCell>
                                            <TableCell align="center">{renderStatusChip(adConfig.c_status)}</TableCell>
                                            <TableCell><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{(adConfig.referees || []).map((referee, rIndex ) => { const refereeName = referee.user?.c_name || referee.user?.c_username || '未知用户'; return <Chip key={`${referee.c_user_id}-${rIndex}`} label={`${refereeName} (${referee.c_level})`} size="small" />; })}</Stack></TableCell>
                                            <TableCell>{adConfig.sceneConfig?.c_name || '未关联'}</TableCell>
                                            <TableCell>{mapTypeToString(adConfig.c_type)}</TableCell>
                                            <TableCell>{mapShowAttackToString(adConfig.c_show_attack)}</TableCell>
                                            <TableCell>
                                                <ClientOnlyWrapper>
                                                    {adConfig.c_start_time ? new Date(adConfig.c_start_time).toLocaleString() : '未设置'}
                                                </ClientOnlyWrapper>
                                            </TableCell>
                                            <TableCell sx={{fontWeight: 'bold'}}><IconButton color="primary" onClick={() => handleOpenView(adConfig)}><ScreenShareIcon /></IconButton></TableCell>
                                            <TableCell align="right">
                                                {['pending', 'finished', 'archived', 'failed'].includes(adConfig.c_status) && canStartDrill && (
                                                    <Tooltip title="开始/重新开始演练">
                                                    <span>
                                                        <IconButton color="success" onClick={() => handleAdAction(adConfig)} disabled={!adConfig.c_scene_config_id || isSubmitting}>
                                                            <PlayArrowIcon />
                                                        </IconButton>
                                                    </span>
                                                    </Tooltip>
                                                )}

                                                {adConfig.c_status === 'running' && canAccessRunningTools && (
                                                    <>
                                                        {canManageMembers && (
                                                            <Tooltip title="成员管理 (禁赛)">
                                                          <span>
                                                            <IconButton color="error" onClick={() => handleOpenMemberDialog(adConfig)}>
                                                              <BlockIcon />
                                                            </IconButton>
                                                          </span>
                                                            </Tooltip>
                                                        )}

                                                        {canAssignNodes && (
                                                            <Tooltip title="节点队伍分配">
                                                            <span>
                                                                <IconButton color="secondary" onClick={() => handleOpenAssignmentDialog(adConfig)} disabled={!adConfig.c_scene_instance_id}>
                                                                    <GroupWorkIcon />
                                                                </IconButton>
                                                            </span>
                                                            </Tooltip>
                                                        )}

                                                        {canViewFlags && (
                                                            <Tooltip title="Flag历史">
                                                                <IconButton color="info" onClick={() => handleOpenFlagHistory(adConfig)} disabled={!adConfig.c_scene_instance_id}>
                                                                    <FlagIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}

                                                        {canStopDrill && (
                                                            <Tooltip title="停止演练">
                                                                <IconButton color="warning" onClick={() => handleStopDrill(adConfig)} disabled={isSubmitting}>
                                                                    <StopCircleIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </>
                                                )}

                                                {canViewTopology && (
                                                    <Tooltip title="查看拓扑">
                                                    <span>
                                                        <IconButton color="secondary" onClick={() => handleViewTopology(adConfig)} disabled={!adConfig.c_scene_instance_id || isSubmitting}>
                                                            <AccountTreeIcon />
                                                        </IconButton>
                                                    </span>
                                                    </Tooltip>
                                                )}

                                                {canViewDetails && (
                                                    <Tooltip title="查看实例详情">
                                                        <IconButton color="info" onClick={() => handleViewDetails(adConfig)} disabled={adConfig.c_status !== 'running' || !adConfig.c_scene_instance_id}>
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {canEdit && (
                                                    <Tooltip title="编辑"><IconButton color="primary" onClick={() => handleOpenForm(adConfig)} disabled={adConfig.c_status === 'running'}><EditIcon /></IconButton></Tooltip>
                                                )}
                                                {canDelete && (
                                                    <Tooltip title="删除"><IconButton color="error" onClick={() => handleDeleteConfirmation(adConfig)} disabled={isSubmitting}><DeleteIcon /></IconButton></Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )})
                            }
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination component="div" count={totalAdConfigs} page={page} onPageChange={handleChangePage} rowsPerPage={rowsPerPage} onRowsPerPageChange={handleChangeRowsPerPage} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="每页行数:" labelDisplayedRows={({ from, to, count }) => `第 ${from} 到 ${to} 条，共 ${count} 条`} />
            </Paper>

            <Dialog key={editingAdConfig?.c_id || 'new-ad-config-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="md">
                <form onSubmit={handleFormSubmit}>
                    <DialogTitle>{editingAdConfig ? '编辑演练配置' : '创建新演练'}</DialogTitle>
                    <DialogContent>
                        {isFormLoading ? ( <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box> )
                            : (
                                <>
                                    {/* ★★★ 3. 确保 Alert 组件能显示 statusMessage 中的内容 ★★★ */}
                                    {statusMessage && statusMessage.type === 'error' && (
                                        <Alert severity="error" sx={{ mb: 2 }}>
                                            {renderErrorMessage(statusMessage.message)}
                                        </Alert>
                                    )}

                                    <TextField autoFocus margin="dense" name="c_drill_name" label="演练名称" type="text" fullWidth required defaultValue={editingAdConfig?.c_drill_name || ''} />
                                    <TextField margin="dense" name="c_description" label="演练描述 (可选)" type="text" fullWidth multiline rows={3} defaultValue={editingAdConfig?.c_description || ''} />
                                    <TextField select fullWidth margin="dense" label="场景模板" name="c_scene_config_id" defaultValue={editingAdConfig?.c_scene_config_id || ''}>
                                        <MenuItem value=""><em>不选择</em></MenuItem>
                                        {sceneConfigsForForm.map(sc => <MenuItem key={sc.c_config_id} value={sc.c_config_id}>{sc.c_name}</MenuItem>)}
                                    </TextField>
                                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                                        <TextField select fullWidth margin="dense" label="可视化页面类型" name="c_type" defaultValue={editingAdConfig?.c_type || 1}><MenuItem value={1}>无人机类型</MenuItem><MenuItem value={2}>科幻类型</MenuItem></TextField>
                                        <TextField select fullWidth margin="dense" label="是否显示攻击行为" name="c_show_attack" defaultValue={editingAdConfig?.c_show_attack === 0 ? 0 : 1}><MenuItem value={1}>是</MenuItem><MenuItem value={0}>否</MenuItem></TextField>
                                    </Stack>
                                    <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2, mt: 2 }}>
                                        <Typography variant="h6" gutterBottom><GroupAddIcon sx={{ verticalAlign: 'middle', mr: 1 }}/>指派裁判</Typography>
                                        <Autocomplete multiple id="referee-autocomplete" options={users} getOptionLabel={(option) => `${option.c_username} ${option.c_name ? `(${option.c_name})` : ''}`} value={selectedReferees.map(ref => ref.user).filter(Boolean) as User[]} isOptionEqualToValue={(option, value) => option.c_username === value.c_username}
                                                      onChange={(_event, newValue) => {
                                                          const newReferees = newValue.map(user => {
                                                              const existing = selectedReferees.find(r => r.c_user_id === user.c_username);
                                                              return existing || { c_user_id: user.c_username, c_level: '普通裁判', user: user };
                                                          });
                                                          setSelectedReferees(newReferees);
                                                      }}
                                                      renderInput={(params) => (<TextField {...params} variant="standard" label="选择用户作为裁判" placeholder="添加裁判..."/>
                                                      )}/>
                                        {selectedReferees.length > 0 && (
                                            <Stack spacing={2} sx={{ mt: 3 }}>
                                                {selectedReferees.map((referee) => (
                                                    <Paper key={referee.c_user_id} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }} variant="outlined">
                                                        <Typography sx={{ flexShrink: 0, fontWeight: 'bold', minWidth: '120px' }}>{referee.user?.c_username || referee.c_user_id}</Typography>
                                                        <FormControl fullWidth size="small"><InputLabel id={`level-select-label-${referee.c_user_id}`}>裁判级别</InputLabel><Select labelId={`level-select-label-${referee.c_user_id}`} label="裁判级别" value={referee.c_level} onChange={(e: SelectChangeEvent) => handleRefereeLevelChange(referee.c_user_id, e.target.value)}><MenuItem value="主裁判">主裁判</MenuItem><MenuItem value="普通裁判">普通裁判</MenuItem><MenuItem value="技术专家">技术专家</MenuItem></Select></FormControl>
                                                    </Paper>
                                                ))}
                                            </Stack>
                                        )}
                                    </Box>
                                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                                        <TextField margin="dense" name="c_start_time" label="计划开始时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} inputRef={startTimeRef} />
                                        <TextField margin="dense" name="c_end_time" label="计划结束时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} inputRef={endTimeRef} />
                                    </Stack>
                                </>
                            )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseForm} disabled={isSubmitting || isFormLoading}>取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting || isFormLoading}>
                            {isSubmitting ? <CircularProgress size={24} /> : (editingAdConfig ? '保存更改' : '确认创建')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={isProgressModalOpen} aria-labelledby="progress-dialog-title">
                <DialogTitle id="progress-dialog-title">演练启动中</DialogTitle>
                <DialogContent sx={{ minWidth: 400, p: 3 }}>
                    <Box sx={{ width: '100%', pt: 2 }}>
                        <LinearProgressWithLabel value={progressValue} label={progressMessage} />
                        {progressError && ( <Alert severity="error" sx={{ mt: 3 }}> {progressError} </Alert> )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    {(progressError || progressValue === 100) && ( <Button onClick={() => setIsProgressModalOpen(false)}>关闭</Button> )}
                </DialogActions>
            </Dialog>

            <Dialog open={isConfirmOpen} onClose={() => setIsConfirmOpen(false)}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent><Typography>您确定要删除演练 "{adConfigToDelete?.c_drill_name}" 吗？此操作不可撤销。</Typography></DialogContent>
                <DialogActions><Button onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>取消</Button><Button onClick={handleDeleteAdConfig} color="error" disabled={isSubmitting}>{isSubmitting ? <CircularProgress size={24} /> : '确认删除'}</Button></DialogActions>
            </Dialog>

            {isDetailsModalOpen && selectedInstanceId && ( <InstanceDetailsDialog open={isDetailsModalOpen} onClose={handleCloseDetails} instanceId={selectedInstanceId} scenarioName={selectedScenarioName} /> )}
            {isFlagHistoryOpen && selectedAdForFlagHistory && selectedAdForFlagHistory.c_scene_instance_id && ( <FlagHistoryModal open={isFlagHistoryOpen} onClose={handleCloseFlagHistory} sceneInstanceId={selectedAdForFlagHistory.c_scene_instance_id} title={`Flag提交历史 - ${selectedAdForFlagHistory.c_drill_name}`} /> )}

            {isTopologyOpen && selectedAdConfigForTopology && (
                <InstanceTopologyDialog
                    open={isTopologyOpen}
                    onClose={() => {
                        setIsTopologyOpen(false);
                        setSelectedAdConfigForTopology(null);
                        setCurrentInstanceTopology(null);
                    }}
                    title={`实例拓扑：${selectedAdConfigForTopology.c_drill_name}`}
                    topology={currentInstanceTopology}
                    instanceId={selectedAdConfigForTopology.c_scene_instance_id || ''}
                    onTerminalClick={handleTopologyTerminalClick}
                    onSaveSuccess={handleTopologySave}
                />
            )}

            {isAssignmentDialogOpen && selectedAdForAssignment && ( <NodeTeamAssignmentDialog open={isAssignmentDialogOpen} onClose={() => setIsAssignmentDialogOpen(false)} instanceId={selectedAdForAssignment.c_scene_instance_id!} drillName={selectedAdForAssignment.c_drill_name} referees={selectedAdForAssignment.referees || []} /> )}
            {isMemberDialogOpen && selectedAdForMembers && ( <MemberManagementDialog open={isMemberDialogOpen} onClose={() => setIsMemberDialogOpen(false)} adConfigId={selectedAdForMembers.c_id} drillName={selectedAdForMembers.c_drill_name} /> )}
        </Box>
    );
};

export default AdManagementPage;