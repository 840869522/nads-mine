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

// MUI 图标
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';

// 假设的自定义钩子和类型，请确保路径正确
import { useDebounce } from '@/app/hooks/useDebounce';
import {TopologyData} from "@/types";
import {useAuth} from "@/hooks/useAuth";
import { customFetch } from "@/utils/fetch"
import InstanceDetailsDialog from '../ad/instances/InstanceDetailsDialog';

// --- 类型定义 ---
interface User {
    c_username: string;
    c_email?: string;
}
interface Team {
    c_id: number;
    c_name: string;
    users: { c_username: string }[];
}
interface AdReferee {
    c_user_id: string;
    c_level: string;
    user?: User;
}
interface AdConfig {
    c_id: string;
    c_drill_name: string;
    c_description: string | null;
    c_red_team_id: number;
    c_blue_team_id: number;
    c_scene_config_id: number | null;
    c_scene_instance_id: string | null;
    c_status: 'pending' | 'running' | 'finished' | 'archived';
    c_start_time: string | null;
    c_end_time: string | null;
    c_create_at: string;
    c_update_at: string;
    referees: AdReferee[];
    redTeam?: Team;
    blueTeam?: Team;
}
export interface Ad {
    id: string;
    name: string;
    description: string;
    uploadDate: string;
    nodeCount: number;
    c_scene_config_id: number;
    topology_json: TopologyData;
}
interface SceneConfig { c_config_id: number; c_name: string; }

const AdManagementPage: React.FC = () => {
    // === 状态管理 (无变化) ===
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

    const teamMemberUsernames = useMemo(() => {
        if (!selectedRedTeamId && !selectedBlueTeamId) { return new Set<string>(); }
        const redTeam = teams.find(t => t.c_id === selectedRedTeamId);
        const blueTeam = teams.find(t => t.c_id === selectedBlueTeamId);
        const members = new Set<string>();
        if (redTeam?.users) { redTeam.users.forEach(user => members.add(user.c_username)); }
        if (blueTeam?.users) { blueTeam.users.forEach(user => members.add(user.c_username)); }
        return members;
    }, [selectedRedTeamId, selectedBlueTeamId, teams]);

    // ★★★ 核心修复：调整 fetchData 函数内部逻辑 ★★★
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null); // 开始获取时清除旧消息
        try {
            const params = new URLSearchParams();
            params.append('search', debouncedSearchQuery);
            params.append('page', String(page + 1));
            params.append('per_page', String(rowsPerPage));

            // 修复了 URL 路径中的占位符
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

            // 按顺序解析 JSON 并赋值，避免初始化错误
            const adConfigsData = await adConfigsRes.json();
            const teamsData = await teamsRes.json();
            const usersData = await usersRes.json();
            const scenesData = await scenesRes.json(); // <-- 在这里正确地获取 scenesData

            setAdConfigs(adConfigsData.data || []);
            setTotalAdConfigs(adConfigsData.meta?.total || 0);

            setTeams(teamsData.data || []);
            setUsers(usersData.data.data || []);

            // 现在可以安全地使用 scenesData
            const formattedScenes = (Array.isArray(scenesData) ? scenesData : scenesData.data || []).map((scene: any) => ({
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

    useEffect(() => {
        setPage(0);
    }, [debouncedSearchQuery]);

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
        const cj_name = findSceneNameById(ad.c_scene_config_id);
        const username = (user as any)?.user?.c_username;
        if (!username) {
            setStatusMessage({ type: 'error', message: '无法获取当前用户名，请确保您已登录。' });
            return;
        }
        if (!window.confirm(`您确定要启动场景 “${cj_name}” 的演练吗？`)) {
            return;
        }

        try {
            const response = await customFetch(`/back/api/scenarios/${ad.c_scene_config_id}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    ad_config_id: ad.c_id
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || '启动失败');
            }

            setStatusMessage({ type: 'success', message: result.message || '演练已成功启动！正在刷新列表...' });
            await fetchData();
        } catch (err: any) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
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
    const findSceneNameById = (id: number | null) => sceneConfigs.find(i => i.c_config_id === id)?.c_name || `未关联`;
    const findUserNameById = (id: string | null) => users.find(u => u.c_username === id)?.c_username || `未知 (${id})`;

    const renderStatusChip = (status: AdConfig['c_status']) => {
        const statusMap = {
            pending: { label: '未开始', color: 'default' as const },
            running: { label: '进行中', color: 'success' as const },
            finished: { label: '已结束', color: 'primary' as const },
            archived: { label: '已归档', color: 'warning' as const },
        };
        const { label, color } = statusMap[status] || statusMap.pending;
        return <Chip label={label} color={color} size="small" />;
    };

    const handleOpenView = (c_scene_instance_id:string | null) => {
        // if (!c_scene_instance_id) {
        //     setStatusMessage({ type: 'warning', message: '演练未启动，无可视化界面。' });
        //     return;
        // }
        window.open('/visualization', '_blank');
    }

    const handleChangePage = (event: MouseEvent<HTMLButtonElement> | null, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
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
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                        {adConfig.referees.map(ref => (<Chip key={ref.c_user_id} label={`${findUserNameById(ref.c_user_id)} (${ref.c_level})`} size="small" />))}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>{findSceneNameById(adConfig.c_scene_config_id)}</TableCell>
                                                <TableCell>{adConfig.c_start_time ? new Date(adConfig.c_start_time).toLocaleString() : '未设置'}</TableCell>
                                                <TableCell sx={{fontWeight: 'bold'}}>
                                                    <IconButton color="primary" onClick={() => handleOpenView(adConfig.c_scene_instance_id)}>
                                                        <ScreenShareIcon />
                                                    </IconButton>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {['pending', 'finished', 'archived'].includes(adConfig.c_status) && (
                                                        <Tooltip title="开始/重新开始演练">
                                                            <span>
                                                                <IconButton color="success" onClick={() => handleAdAction(adConfig)} disabled={!adConfig.c_scene_config_id}>
                                                                    <PlayArrowIcon />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip title="查看详情/报告">
                                                        <span>
                                                            <IconButton color="info" onClick={() => handleViewDetails(adConfig)} disabled={!adConfig.c_scene_instance_id}>
                                                                <VisibilityIcon />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Tooltip title="编辑"><span><IconButton color="primary" onClick={() => handleOpenForm(adConfig)} disabled={adConfig.c_status === 'running'}><EditIcon /></IconButton></span></Tooltip>
                                                    <Tooltip title="删除"><span><IconButton color="error" onClick={() => handleDeleteConfirmation(adConfig)} disabled={adConfig.c_status === 'running'}><DeleteIcon /></IconButton></span></Tooltip>
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
                <InstanceDetailsDialog
                    open={isDetailsModalOpen}
                    onClose={handleCloseDetails}
                    instanceId={selectedInstanceId}
                    scenarioName={selectedScenarioName}
                />
            )}
        </Box>
    );
};

export default AdManagementPage;