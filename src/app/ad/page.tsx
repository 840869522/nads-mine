"use client";

import React, {useState, useEffect, useCallback, FormEvent, useMemo, MouseEvent} from 'react';

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
import FormHelperText from '@mui/material/FormHelperText';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';

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
import GroupIcon from '@mui/icons-material/Group';
import ShieldIcon from '@mui/icons-material/Shield';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import PersonIcon from '@mui/icons-material/Person';
import FlagIcon from '@mui/icons-material/Flag';

// 自定义钩子和组件
import { useDebounce } from '@/app/hooks/useDebounce';
import {useAuth} from "@/hooks/useAuth";
import { customFetch } from "@/utils/fetch";
import InstanceDetailsDialog from '../ad/instances/InstanceDetailsDialog';
import FlagHistoryModal from '../../components/scenario/FlagHistoryModal';

// --- 类型定义 ---
interface User { c_username: string; c_email?: string; }
interface Team {
    c_id: number;
    c_name: string;
    users: {
        c_username: string;
        pivot: {
            is_banned: boolean;
            role: string;
        }
    }[];
}
interface AdReferee { c_user_id: string; c_level: string; user?: User; }
interface AdConfig {
    c_id: string;
    c_drill_name: string;
    c_description: string | null;
    c_red_team_id: number;
    c_blue_team_id: number;
    c_scene_config_id: number | null;
    c_scene_instance_id: string | null;
    c_status: 'pending' | 'running' | 'finished' | 'archived' | 'failed' | 'creating';
    c_start_time: string | null;
    c_end_time: string | null;
    referees: AdReferee[];
    redTeam?: Team;
    blueTeam?: Team;
}
interface SceneConfig { c_config_id: number; c_name: string; }

const AdManagementPage: React.FC = () => {
    // === 状态管理 ===
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [selectedScenarioName, setSelectedScenarioName] = useState<string>('');
    const { user } = useAuth();
    const [adConfigs, setAdConfigs] = useState<AdConfig[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [sceneConfigs, setSceneConfigs] = useState<SceneConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string | { [key: string]: string[] } } | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAdConfig, setEditingAdConfig] = useState<AdConfig | null>(null);
    const [selectedReferees, setSelectedReferees] = useState<AdReferee[]>([]);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [adConfigToDelete, setAdConfigToDelete] = useState<AdConfig | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [selectedRedTeamId, setSelectedRedTeamId] = useState<number | ''>('');
    const [selectedBlueTeamId, setSelectedBlueTeamId] = useState<number | ''>('');
    const [teamConflictError, setTeamConflictError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalAdConfigs, setTotalAdConfigs] = useState(0);
    const API_BASE_URL = '/back/api';

    const [isTeamDetailsOpen, setIsTeamDetailsOpen] = useState(false);
    const [selectedAdForTeamDetails, setSelectedAdForTeamDetails] = useState<AdConfig | null>(null);

    // Flag历史相关状态
    const [isFlagHistoryOpen, setIsFlagHistoryOpen] = useState(false);
    const [selectedAdForFlagHistory, setSelectedAdForFlagHistory] = useState<AdConfig | null>(null);

    const teamMemberUsernames = useMemo(() => {
        if (!selectedRedTeamId && !selectedBlueTeamId) { return new Set<string>(); }
        const redTeam = teams.find(t => t.c_id === selectedRedTeamId);
        const blueTeam = teams.find(t => t.c_id === selectedBlueTeamId);
        const members = new Set<string>();
        if (redTeam?.users) { redTeam.users.forEach(user => members.add(user.c_username)); }
        if (blueTeam?.users) { blueTeam.users.forEach(user => members.add(user.c_username)); }
        return members;
    }, [selectedRedTeamId, selectedBlueTeamId, teams]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            const params = new URLSearchParams();
            params.append('search', debouncedSearchQuery);
            params.append('page', String(page + 1));
            params.append('per_page', String(rowsPerPage));
            const adConfigsUrl = `${API_BASE_URL}/ad-configs?${params.toString()}`;
            const teamsUrl = `${API_BASE_URL}/ad/team`;
            const usersUrl = `${API_BASE_URL}/ad/users`;
            const scenesUrl = `${API_BASE_URL}/scenarios`;
            const [adConfigsRes, teamsRes, usersRes, scenesRes] = await Promise.all([
                customFetch(adConfigsUrl),
                customFetch(teamsUrl),
                customFetch(usersUrl),
                customFetch(scenesUrl),
            ]);
            if (!adConfigsRes.ok || !teamsRes.ok || !usersRes.ok || !scenesRes.ok) throw new Error('获取基础数据失败');
            const adConfigsData = await adConfigsRes.json();
            const teamsData = await teamsRes.json();
            const usersData = await usersRes.json();
            const scenesData = await scenesRes.json();

            setAdConfigs(adConfigsData.data || []);
            setTotalAdConfigs(adConfigsData.meta?.total || 0);
            setTeams(Array.isArray(teamsData.data) ? teamsData.data : (Array.isArray(teamsData) ? teamsData : []));
            setUsers(usersData?.data?.data || []);
            const formattedScenes = (Array.isArray(scenesData.data) ? scenesData.data : (Array.isArray(scenesData) ? scenesData : [])).map((scene: any) => ({
                c_config_id: scene.id,
                c_name: scene.name,
            }));
            setSceneConfigs(formattedScenes);

        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery, page, rowsPerPage]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(0); }, [debouncedSearchQuery]);

    useEffect(() => {
        if (!selectedRedTeamId || !selectedBlueTeamId) { setTeamConflictError(null); return; }
        if (selectedRedTeamId === selectedBlueTeamId) { setTeamConflictError('红队和蓝队不能选择同一个队伍。'); return; }
        const redTeam = teams.find(t => t.c_id === selectedRedTeamId);
        const blueTeam = teams.find(t => t.c_id === selectedBlueTeamId);
        if (!redTeam || !blueTeam || !redTeam.users || !blueTeam.users) { setTeamConflictError(null); return; }
        const redMemberIds = new Set(redTeam.users.map(m => m.c_username));
        const commonMembers = blueTeam.users.filter(m => redMemberIds.has(m.c_username));
        if (commonMembers.length > 0) {
            const commonNames = commonMembers.map(m => m.c_username).join(', ');
            setTeamConflictError(`成员冲突：用户 "${commonNames}" 同时存在于红队和蓝队中。`);
        } else {
            setTeamConflictError(null);
        }
    }, [selectedRedTeamId, selectedBlueTeamId, teams]);

    const handleOpenForm = (adConfig: AdConfig | null = null) => {
        setStatusMessage(null);
        setEditingAdConfig(adConfig);
        if (adConfig) {
            const refereesWithUserDetails = adConfig.referees.map(ref => ({...ref, user: users.find(u => u.c_username === ref.c_user_id)})).filter(ref => ref.user);
            setSelectedReferees(refereesWithUserDetails as AdReferee[]);
            setSelectedRedTeamId(adConfig.c_red_team_id || '');
            setSelectedBlueTeamId(adConfig.c_blue_team_id || '');
        } else {
            setSelectedReferees([]);
            setSelectedRedTeamId('');
            setSelectedBlueTeamId('');
        }
        setIsFormOpen(true);
        setTeamConflictError(null);
    };

    const handleCloseForm = () => { setIsFormOpen(false); setEditingAdConfig(null); setSelectedReferees([]); };
    const handleViewDetails = (adConfig: AdConfig) => {
        if (adConfig.c_scene_instance_id) {
            setSelectedInstanceId(adConfig.c_scene_instance_id);
            setSelectedScenarioName(adConfig.c_drill_name);
            setIsDetailsModalOpen(true);
        } else {
            setStatusMessage({ type: 'warning', message: '此演练尚未启动，无法查看实例详情。' });
        }
    };
    const handleCloseDetails = () => { setIsDetailsModalOpen(false); };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (teamConflictError) { setStatusMessage({ type: 'error', message: teamConflictError }); return; }
        setIsSubmitting(true);
        setStatusMessage(null);
        const formData = new FormData(e.currentTarget);
        const adConfigData = {
            c_drill_name: formData.get('c_drill_name') as string,
            c_description: formData.get('c_description') as string,
            c_red_team_id: Number(selectedRedTeamId),
            c_blue_team_id: Number(selectedBlueTeamId),
            c_scene_config_id: Number(formData.get('c_scene_config_id')) || null,
            c_start_time: formData.get('c_start_time') ? new Date(formData.get('c_start_time') as string).toISOString() : null,
            c_end_time: formData.get('c_end_time') ? new Date(formData.get('c_end_time') as string).toISOString() : null,
            referees: selectedReferees.map(({ c_user_id, c_level }) => ({ c_user_id, c_level })),
        };
        try {
            const url = editingAdConfig ? `${API_BASE_URL}/ad-configs/${editingAdConfig.c_id}` : `${API_BASE_URL}/ad-configs`;
            const method = editingAdConfig ? 'PUT' : 'POST';
            const response = await customFetch(url, { method, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(adConfigData) });
            const result = await response.json();
            if (!response.ok) {
                if (response.status === 422 && result.errors) throw new Error(JSON.stringify(result.errors));
                throw new Error(result.message || '操作失败');
            }
            setStatusMessage({ type: 'success', message: result.message || '操作成功！' });
            handleCloseForm();
            await fetchData();
        } catch (error) {
            let errorMessage: string | { [key: string]: string[] } = (error as Error).message;
            try { errorMessage = JSON.parse(errorMessage); } catch (e) { /* is string */ }
            setStatusMessage({ type: 'error', message: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStopDrill = async (adConfig: AdConfig) => {
        if (!window.confirm(`您确定要停止演练 "${adConfig.c_drill_name}" 吗？此操作将尝试关闭并清理所有相关虚拟资源。`)) {
            return;
        }
        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            const response = await customFetch(`${API_BASE_URL}/ad-configs/${adConfig.c_id}/stop`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || '停止演练失败');
            }
            setStatusMessage({ type: 'success', message: result.message || '演练已成功停止！' });
            await fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteConfirmation = (adConfig: AdConfig) => {
        setAdConfigToDelete(adConfig);
        setIsConfirmOpen(true);
    };

    const handleDeleteAdConfig = async () => {
        if (!adConfigToDelete) return;
        setIsSubmitting(true);
        try {
            await customFetch(`${API_BASE_URL}/ad-configs/${adConfigToDelete.c_id}`, { method: 'DELETE' });
            setStatusMessage({ type: 'success', message: `演练 "${adConfigToDelete.c_drill_name}" 已删除。` });
            await fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsSubmitting(false);
            setIsConfirmOpen(false);
            setAdConfigToDelete(null);
        }
    };

    const handleAdAction = async (ad: AdConfig) => {
        const username = (user as any)?.user?.c_username;
        if (!username) {
            setStatusMessage({ type: 'error', message: '无法获取当前用户名，请确保您已登录。' });
            return;
        }
        if (!window.confirm(`您确定要启动演练 “${ad.c_drill_name}” 吗？`)) {
            return;
        }
        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            const response = await customFetch(`${API_BASE_URL}/ad-configs/${ad.c_id}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username: username, }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || '启动失败');
            }
            setStatusMessage({ type: 'success', message: result.message || '演练已成功启动！正在刷新列表...' });
            await fetchData();
        } catch (err: any) {
            setStatusMessage({ type: 'error', message: err.message || '启动过程中发生未知错误' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRefereeLevelChange = (user_id: string, newLevel: string) => {
        setSelectedReferees(prev => prev.map(ref => ref.c_user_id === user_id ? { ...ref, c_level: newLevel } : ref));
    };

    const renderErrorMessage = (message: string | { [key: string]: string[] }) => {
        if (typeof message === 'string') return message;
        return <ul style={{ paddingLeft: '20px', margin: 0 }}>{Object.values(message).flat().map((msg, index) => <li key={index}>{msg}</li>)}</ul>;
    };

    const findTeamNameById = (id: number | null) => teams.find(i => i.c_id === id)?.c_name || `未知 (ID: ${id})`;

    // ★★★ 核心修复 ★★★: 增强此函数以处理数据不一致的情况
    const findSceneNameById = (id: number | null): string | null => {
        if (id === null || id === undefined) {
            return '未关联';
        }
        const scene = sceneConfigs.find(i => i.c_config_id === id);
        if (scene) {
            return scene.c_name;
        }
        // 如果在已加载的场景列表中找不到，返回 null 作为特殊标记
        return null;
    };

    const findUserNameById = (id: string | null) => users.find(u => u.c_username === id)?.c_username || `未知 (${id})`;

    const renderStatusChip = (status: AdConfig['c_status']) => {
        const statusMap = {
            pending: { label: '未开始', color: 'default' as const },
            running: { label: '进行中', color: 'success' as const },
            finished: { label: '已结束', color: 'primary' as const },
            archived: { label: '已归档', color: 'warning' as const },
            failed: { label: '失败', color: 'error' as const },
            creating: { label: '创建中...', color: 'info' as const },
        };
        const { label, color } = statusMap[status] || statusMap.pending;
        return <Chip label={label} color={color} size="small" />;
    };

    const handleOpenView = (c_scene_instance_id: string | null) => {
        if (c_scene_instance_id) {
            localStorage.setItem('instance_id', c_scene_instance_id);
            window.open('/visualization', '_blank');
        } else {
            setStatusMessage({ type: 'warning', message: '演练未启动，无可视化界面。' });
        }
    };

    const handleChangePage = (event: MouseEvent<HTMLButtonElement> | null, newPage: number) => { setPage(newPage); };
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

    const handleOpenTeamDetails = (adConfig: AdConfig) => {
        setSelectedAdForTeamDetails(adConfig);
        setIsTeamDetailsOpen(true);
    };

    const handleCloseTeamDetails = () => {
        setIsTeamDetailsOpen(false);
        setTimeout(() => setSelectedAdForTeamDetails(null), 300);
    };

    const handleOpenFlagHistory = (adConfig: AdConfig) => {
        if (adConfig.c_scene_instance_id) {
            setSelectedAdForFlagHistory(adConfig);
            setIsFlagHistoryOpen(true);
        } else {
            setStatusMessage({ type: 'warning', message: '此演练尚未启动，无法查看Flag历史。' });
        }
    };

    const handleCloseFlagHistory = () => {
        setIsFlagHistoryOpen(false);
        setTimeout(() => setSelectedAdForFlagHistory(null), 300);
    };

    const handleToggleUserBan = async (teamId: number, username: string) => {
        if (!selectedAdForTeamDetails) return;
        try {
            const response = await customFetch(`${API_BASE_URL}/ad/team/${teamId}/users/${username}/toggle-ban`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '操作失败');

            const updatedAdConfig = JSON.parse(JSON.stringify(selectedAdForTeamDetails));

            const updateTeamUsers = (team: Team | undefined) => {
                if (!team) return;
                team.users = team.users.map(u =>
                    u.c_username === username ? { ...u, pivot: { ...u.pivot, is_banned: result.data.is_banned } } : u
                );
            };

            updateTeamUsers(updatedAdConfig.redTeam);
            updateTeamUsers(updatedAdConfig.blueTeam);

            setSelectedAdForTeamDetails(updatedAdConfig);
            setAdConfigs(prev => prev.map(ad => ad.c_id === updatedAdConfig.c_id ? updatedAdConfig : ad));

            setStatusMessage({ type: 'success', message: result.message });
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: '1600px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">攻防演练管理</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField variant="outlined" size="small" placeholder="搜索演练名称..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} sx={{ minWidth: '300px' }} />
                    <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()} disabled={isLoading}>创建新演练</Button>
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
                                <TableCell sx={{ fontWeight: 'bold' }}>红队</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>蓝队</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>裁判团队</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>场景模板</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>计划开始时间</TableCell>
                                <TableCell sx={{fontWeight: 'bold'}}>可视化</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? ( <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow> )
                                : adConfigs.length === 0 ? ( <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5 }}>没有找到演练配置。</TableCell></TableRow> )
                                    : (
                                        adConfigs.map((adConfig) => (
                                            <TableRow hover key={adConfig.c_id}>
                                                <TableCell>{adConfig.c_drill_name}</TableCell>
                                                <TableCell align="center">{renderStatusChip(adConfig.c_status)}</TableCell>
                                                <TableCell>{findTeamNameById(adConfig.c_red_team_id)}</TableCell>
                                                <TableCell>{findTeamNameById(adConfig.c_blue_team_id)}</TableCell>
                                                <TableCell><Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{adConfig.referees.map(ref => (<Chip key={ref.c_user_id} label={`${findUserNameById(ref.c_user_id)} (${ref.c_level})`} size="small" />))}</Stack></TableCell>
                                                {/* ★★★ 核心修复 ★★★: 使用新的渲染逻辑来优雅地处理数据不一致 */}
                                                <TableCell>
                                                    {(() => {
                                                        const sceneName = findSceneNameById(adConfig.c_scene_config_id);
                                                        if (sceneName === null) {
                                                            return (
                                                                <Tooltip title={`场景模板 ID: ${adConfig.c_scene_config_id} (已失效或被删除)`}>
                                                                    <Chip label="模板丢失" color="error" size="small" variant="outlined" />
                                                                </Tooltip>
                                                            );
                                                        }
                                                        return sceneName;
                                                    })()}
                                                </TableCell>
                                                <TableCell>{adConfig.c_start_time ? new Date(adConfig.c_start_time).toLocaleString() : '未设置'}</TableCell>
                                                <TableCell sx={{fontWeight: 'bold'}}><IconButton color="primary" onClick={() => handleOpenView(adConfig.c_scene_instance_id)}><ScreenShareIcon /></IconButton></TableCell>
                                                <TableCell align="right">
                                                    {['pending', 'finished', 'archived', 'failed'].includes(adConfig.c_status) && (
                                                        <Tooltip title="开始/重新开始演练">
                                                            <IconButton color="success" onClick={() => handleAdAction(adConfig)} disabled={!adConfig.c_scene_config_id || isSubmitting}><PlayArrowIcon /></IconButton>
                                                        </Tooltip>
                                                    )}
                                                    {adConfig.c_status === 'running' && (
                                                        <>
                                                            <Tooltip title="Flag历史">
                                                                <IconButton color="info" onClick={() => handleOpenFlagHistory(adConfig)} disabled={!adConfig.c_scene_instance_id}><FlagIcon /></IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="停止演练">
                                                                <IconButton color="warning" onClick={() => handleStopDrill(adConfig)} disabled={isSubmitting}><StopCircleIcon /></IconButton>
                                                            </Tooltip>
                                                        </>
                                                    )}
                                                    <Tooltip title="查看队伍成员">
                                                        <IconButton color="secondary" onClick={() => handleOpenTeamDetails(adConfig)}><GroupIcon /></IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="查看实例详情">
                                                        <IconButton color="info" onClick={() => handleViewDetails(adConfig)} disabled={adConfig.c_status !== 'running' || !adConfig.c_scene_instance_id}><VisibilityIcon /></IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="编辑">
                                                        <IconButton color="primary" onClick={() => handleOpenForm(adConfig)} disabled={adConfig.c_status === 'running'}><EditIcon /></IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="删除">
                                                        <IconButton color="error" onClick={() => handleDeleteConfirmation(adConfig)} disabled={isSubmitting}><DeleteIcon /></IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={totalAdConfigs}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    labelRowsPerPage="每页行数:"
                    labelDisplayedRows={({ from, to, count }) => `第 ${from} 到 ${to} 条，共 ${count} 条`}
                />
            </Paper>

            <Dialog key={editingAdConfig?.c_id || 'new-ad-config-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="md">
                <form onSubmit={handleFormSubmit}>
                    <DialogTitle>{editingAdConfig ? '编辑演练配置' : '创建新演练'}</DialogTitle>
                    <DialogContent>
                        {statusMessage && statusMessage.type === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{renderErrorMessage(statusMessage.message)}</Alert>}
                        <TextField autoFocus margin="dense" name="c_drill_name" label="演练名称" type="text" fullWidth required defaultValue={editingAdConfig?.c_drill_name || ''} />
                        <TextField margin="dense" name="c_description" label="演练描述 (可选)" type="text" fullWidth multiline rows={3} defaultValue={editingAdConfig?.c_description || ''} />

                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                            <FormControl fullWidth margin="dense" required error={!!teamConflictError}><InputLabel id="red-team-select-label">红队</InputLabel><Select labelId="red-team-select-label" label="红队" value={selectedRedTeamId} onChange={(e: SelectChangeEvent<number|''>) => setSelectedRedTeamId(e.target.value as number)}>{teams.map(team => <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>)}</Select></FormControl>
                            <FormControl fullWidth margin="dense" required error={!!teamConflictError}><InputLabel id="blue-team-select-label">蓝队</InputLabel><Select labelId="blue-team-select-label" label="蓝队" value={selectedBlueTeamId} onChange={(e: SelectChangeEvent<number|''>) => setSelectedBlueTeamId(e.target.value as number)}>{teams.map(team => <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>)}</Select></FormControl>
                        </Stack>
                        {teamConflictError && (<FormHelperText error sx={{ ml: '14px' }}>{teamConflictError}</FormHelperText>)}

                        <TextField select fullWidth margin="dense" label="场景模板 (可选)" name="c_scene_config_id" defaultValue={editingAdConfig?.c_scene_config_id || ''}><MenuItem value=""><em>不选择场景</em></MenuItem>{sceneConfigs.map(sc => <MenuItem key={sc.c_config_id} value={sc.c_config_id}>{sc.c_name}</MenuItem>)}</TextField>

                        <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2, mt: 2 }}>
                            <Typography variant="h6" gutterBottom><GroupAddIcon sx={{ verticalAlign: 'middle', mr: 1 }}/>指派裁判</Typography>
                            <Autocomplete multiple id="referee-autocomplete" options={users} getOptionLabel={(option) => option.c_username} value={selectedReferees.map(ref => ref.user).filter(Boolean) as User[]} isOptionEqualToValue={(option, value) => option.c_username === value.c_username}
                                          onChange={(_event, newValue) => {
                                              const newReferees = newValue.map(user => {
                                                  const existing = selectedReferees.find(r => r.c_user_id === user.c_username);
                                                  return existing || { c_user_id: user.c_username, c_level: '普通裁判', user: user };
                                              });
                                              setSelectedReferees(newReferees);
                                          }}
                                          getOptionDisabled={(option) => teamMemberUsernames.has(option.c_username)}
                                          renderInput={(params) => (
                                              <TextField {...params} variant="standard" label="选择用户作为裁判" placeholder="添加裁判..." helperText={teamMemberUsernames.size > 0 ? "已经是红/蓝队成员的用户将被禁用" : ""}/>
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
                            <TextField margin="dense" name="c_start_time" label="计划开始时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingAdConfig?.c_start_time ? new Date(new Date(editingAdConfig.c_start_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} />
                            <TextField margin="dense" name="c_end_time" label="计划结束时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingAdConfig?.c_end_time ? new Date(new Date(editingAdConfig.c_end_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseForm} disabled={isSubmitting}>取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting || !!teamConflictError}>
                            {isSubmitting ? <CircularProgress size={24} /> : (editingAdConfig ? '保存更改' : '确认创建')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={isConfirmOpen} onClose={() => setIsConfirmOpen(false)}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent><Typography>您确定要删除演练 "{adConfigToDelete?.c_drill_name}" 吗？此操作不可撤销。</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>取消</Button>
                    <Button onClick={handleDeleteAdConfig} color="error" disabled={isSubmitting}>{isSubmitting ? <CircularProgress size={24} /> : '确认删除'}</Button>
                </DialogActions>
            </Dialog>

            {isDetailsModalOpen && selectedInstanceId && (
                <InstanceDetailsDialog open={isDetailsModalOpen} onClose={handleCloseDetails} instanceId={selectedInstanceId} scenarioName={selectedScenarioName} />
            )}

            {isFlagHistoryOpen && selectedAdForFlagHistory && selectedAdForFlagHistory.c_scene_instance_id && (
                <FlagHistoryModal
                    open={isFlagHistoryOpen}
                    onClose={handleCloseFlagHistory}
                    sceneInstanceId={selectedAdForFlagHistory.c_scene_instance_id}
                    title={`Flag提交历史 - ${selectedAdForFlagHistory.c_drill_name}`}
                />
            )}

            <Dialog open={isTeamDetailsOpen} onClose={handleCloseTeamDetails} fullWidth maxWidth="xs">
                <DialogTitle>队伍成员详情</DialogTitle>
                <DialogContent dividers>
                    {selectedAdForTeamDetails ? (
                        <Box>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
                                <WhatshotIcon sx={{ mr: 1 }} />
                                {selectedAdForTeamDetails.redTeam?.c_name || '红队'}
                            </Typography>
                            {selectedAdForTeamDetails.redTeam?.users && selectedAdForTeamDetails.redTeam.users.length > 0 ? (
                                <List dense>
                                    {selectedAdForTeamDetails.redTeam.users.map(user => (
                                        <ListItem key={user.c_username}
                                                  sx={{
                                                      backgroundColor: user.pivot?.is_banned ? 'rgba(255, 0, 0, 0.08)' : 'transparent',
                                                      textDecoration: user.pivot?.is_banned ? 'line-through' : 'none',
                                                      opacity: user.pivot?.is_banned ? 0.6 : 1,
                                                  }}
                                        >
                                            <ListItemIcon><PersonIcon /></ListItemIcon>
                                            <ListItemText primary={user.c_username} secondary={user.pivot?.is_banned ? "已禁用 (作弊)" : ""} />
                                            <Switch
                                                edge="end"
                                                checked={!user.pivot?.is_banned}
                                                onChange={() => handleToggleUserBan(selectedAdForTeamDetails.redTeam!.c_id, user.c_username)}
                                                inputProps={{ 'aria-label': `toggle ban for ${user.c_username}` }}
                                                color="success"
                                                title={user.pivot?.is_banned ? "解禁用户" : "禁用用户"}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            ) : (
                                <Typography sx={{ pl: 2, color: 'text.secondary' }}>暂无成员信息</Typography>
                            )}
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', color: 'info.main' }}>
                                <ShieldIcon sx={{ mr: 1 }} />
                                {selectedAdForTeamDetails.blueTeam?.c_name || '蓝队'}
                            </Typography>
                            {selectedAdForTeamDetails.blueTeam?.users && selectedAdForTeamDetails.blueTeam.users.length > 0 ? (
                                <List dense>
                                    {selectedAdForTeamDetails.blueTeam.users.map(user => (
                                        <ListItem key={user.c_username}
                                                  sx={{
                                                      backgroundColor: user.pivot.is_banned ? 'rgba(255, 0, 0, 0.08)' : 'transparent',
                                                      textDecoration: user.pivot.is_banned ? 'line-through' : 'none',
                                                      opacity: user.pivot.is_banned ? 0.6 : 1,
                                                  }}
                                        >
                                            <ListItemIcon><PersonIcon /></ListItemIcon>
                                            <ListItemText primary={user.c_username} secondary={user.pivot.is_banned ? "已禁用 (作弊)" : ""} />
                                            <Switch
                                                edge="end"
                                                checked={!user.pivot.is_banned}
                                                onChange={() => handleToggleUserBan(selectedAdForTeamDetails.blueTeam!.c_id, user.c_username)}
                                                inputProps={{ 'aria-label': `toggle ban for ${user.c_username}` }}
                                                color="success"
                                                title={user.pivot.is_banned ? "解禁用户" : "禁用用户"}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            ) : (
                                <Typography sx={{ pl: 2, color: 'text.secondary' }}>暂无成员信息</Typography>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseTeamDetails}>关闭</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdManagementPage;