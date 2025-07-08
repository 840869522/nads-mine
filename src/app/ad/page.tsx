"use client";

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
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
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';

// MUI 图标
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

// 假设的自定义钩子，请确保路径正确
import { useDebounce } from '@/app/hooks/useDebounce';

// --- 类型定义 (已更新为 c_ 前缀) ---
enum AdStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    FINISHED = 'finished',
    ARCHIVED = 'archived',
}
interface AdReferee {
    user_id: number;
    username: string; // username 通常不需要c_前缀，因为它来自User对象
    c_level: string;
    c_expertise: string;
}
interface AdConfig {
    c_id: string; // 主键更新
    c_drill_name: string;
    c_description: string | null;
    c_red_team_id: number;
    c_blue_team_id: number;
    referees: AdReferee[]; // 裁判团队的结构保持不变
    c_scene_config_id: number | null; // 变为可选
    c_scene_instance_id: string | null;
    c_status: AdStatus;
    c_start_time: string | null;
    c_end_time: string | null;
    c_create_at: string;
    c_update_at: string;
}
interface Team { c_id: number; c_name: string; }
interface User { c_id: number; c_username: string; } // 主键更新
interface SceneConfig { c_config_id: number; c_name: string; }

const AdManagementPage: React.FC = () => {
    // === 状态管理 ===
    const [adConfigs, setAdConfigs] = useState<AdConfig[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [sceneConfigs, setSceneConfigs] = useState<SceneConfig[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAdConfig, setEditingAdConfig] = useState<AdConfig | null>(null);
    const [selectedReferees, setSelectedReferees] = useState<AdReferee[]>([]);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [adConfigToDelete, setAdConfigToDelete] = useState<AdConfig | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // *** 修正点：API 基地址已修正 ***
    const API_BASE_URL = 'http://127.0.0.1:8000/api';

    // --- 数据获取 (已恢复完整功能) ---
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            const [adConfigsRes, teamsRes, usersRes, scenesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/ad/ad-configs?search=${debouncedSearchQuery}`),
                fetch(`${API_BASE_URL}/ad/team`),
                fetch(`${API_BASE_URL}/ad/users`),
                fetch(`${API_BASE_URL}/scenarios`),
            ]);

            if (!adConfigsRes.ok) throw new Error(`获取演练列表失败: ${adConfigsRes.statusText}`);
            if (!teamsRes.ok) throw new Error(`获取队伍列表失败: ${teamsRes.statusText}`);
            if (!usersRes.ok) throw new Error(`获取用户列表失败: ${usersRes.statusText}`);
            if (!scenesRes.ok) throw new Error(`获取场景列表失败: ${scenesRes.statusText}`);

            const [adConfigsData, teamsData, usersData, scenesData] = await Promise.all([
                adConfigsRes.json(),
                teamsRes.json(),
                usersRes.json(),
                scenesRes.json(),
            ]);

            setAdConfigs(adConfigsData.data || []);
            setTeams(teamsData.data || []);
            setUsers(usersData.data || []);
            setSceneConfigs(scenesData.data || []);

        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
            setAdConfigs([]);
            setTeams([]);
            setUsers([]);
            setSceneConfigs([]);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);


    // --- 事件处理器 ---
    const handleOpenForm = (adConfig: AdConfig | null = null) => {
        setEditingAdConfig(adConfig);
        setSelectedReferees(adConfig ? adConfig.referees : []);
        setIsFormOpen(true);
        setStatusMessage(null);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingAdConfig(null);
        setSelectedReferees([]);
    };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const adConfigData = {
            // *** 修正点：所有字段名已更新为 c_ 前缀 ***
            c_drill_name: formData.get('c_drill_name') as string,
            c_description: formData.get('c_description') as string,
            c_red_team_id: Number(formData.get('c_red_team_id')),
            c_blue_team_id: Number(formData.get('c_blue_team_id')),
            c_scene_config_id: Number(formData.get('c_scene_config_id')) || null, // 允许为空
            c_start_time: formData.get('c_start_time') || null,
            c_end_time: formData.get('c_end_time') || null,
            referees: selectedReferees.map(({ user_id, c_level, c_expertise }) => ({
                user_id,
                c_level,
                c_expertise
            })),
        };

        if (!adConfigData.c_red_team_id || !adConfigData.c_blue_team_id) {
            setStatusMessage({ type: 'error', message: '请选择红队和蓝队！' });
            return;
        }
        if (adConfigData.c_red_team_id === adConfigData.c_blue_team_id) {
            setStatusMessage({ type: 'error', message: '红队和蓝队不能选择同一个队伍！' });
            return;
        }
        if (adConfigData.referees.length === 0) {
            setStatusMessage({ type: 'error', message: '请至少指定一名裁判！' });
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const url = editingAdConfig
                ? `${API_BASE_URL}/ad/ad-configs/${editingAdConfig.c_id}`
                : `${API_BASE_URL}/ad/ad-configs`;
            const method = editingAdConfig ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(adConfigData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '操作失败');

            setStatusMessage({ type: 'success', message: result.message || '操作成功！' });
            handleCloseForm();
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
        try {
            await fetch(`${API_BASE_URL}/ad/ad-configs/${adConfigToDelete.c_id}`, { method: 'DELETE' });
            setStatusMessage({ type: 'success', message: `演练 "${adConfigToDelete.c_drill_name}" 已删除。` });
            await fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsConfirmOpen(false);
            setAdConfigToDelete(null);
        }
    };

    const handleAdAction = async (adConfigId: string, action: 'start' | 'stop') => {
        try {
            const response = await fetch(`${API_BASE_URL}/ad/ad-configs/${adConfigId}/${action}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '状态变更失败');
            setStatusMessage({ type: 'success', message: result.message });
            await fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        }
    };

    const handleRefereeChange = (index: number, field: 'c_level' | 'c_expertise', value: string) => {
        const updatedReferees = [...selectedReferees];
        updatedReferees[index] = { ...updatedReferees[index], [field]: value };
        setSelectedReferees(updatedReferees);
    };

    // --- 辅助渲染函数 ---
    const findTeamNameById = (id: number | null) => {
        if (id === null) return 'N/A';
        const item = teams.find(i => i.c_id === id);
        return item ? item.c_name : `未知 (ID: ${id})`;
    };

    const findSceneNameById = (id: number | null) => {
        if (id === null) return 'N/A';
        const item = sceneConfigs.find(i => i.c_config_id === id);
        return item ? item.c_name : `未知 (ID: ${id})`;
    };

    const renderStatusChip = (status: AdStatus) => {
        const statusMap = {
            [AdStatus.PENDING]: { label: '未开始', color: 'default' as const },
            [AdStatus.RUNNING]: { label: '进行中', color: 'success' as const },
            [AdStatus.FINISHED]: { label: '已结束', color: 'primary' as const },
            [AdStatus.ARCHIVED]: { label: '已归档', color: 'warning' as const },
        };
        const { label, color } = statusMap[status] || statusMap[AdStatus.PENDING];
        return <Chip label={label} color={color} size="small" />;
    };

    // --- 渲染逻辑 (已更新 c_ 前缀) ---
    return (
        <Box sx={{ p: 3, maxWidth: '1600px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">攻防演练管理</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField variant="outlined" size="small" placeholder="搜索演练名称..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} sx={{ minWidth: '300px' }} />
                    <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()} disabled={isLoading}>创建新演练</Button>
                </Box>
            </Box>

            {statusMessage && <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 2 }}>{statusMessage.message}</Alert>}

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
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? ( <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow> )
                                : adConfigs.length === 0 ? ( <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>没有找到演练配置。</TableCell></TableRow> )
                                    : (
                                        adConfigs.map((adConfig) => (
                                            <TableRow hover key={adConfig.c_id}>
                                                <TableCell component="th" scope="row">{adConfig.c_drill_name}</TableCell>
                                                <TableCell align="center">{renderStatusChip(adConfig.c_status)}</TableCell>
                                                <TableCell>{findTeamNameById(adConfig.c_red_team_id)}</TableCell>
                                                <TableCell>{findTeamNameById(adConfig.c_blue_team_id)}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                                        {adConfig.referees.map(ref => (
                                                            <Tooltip key={ref.user_id} title={`领域: ${ref.c_expertise}`}>
                                                                <Chip label={`${ref.username} (${ref.c_level})`} size="small" />
                                                            </Tooltip>
                                                        ))}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>{findSceneNameById(adConfig.c_scene_config_id)}</TableCell>
                                                <TableCell>{adConfig.c_start_time ? new Date(adConfig.c_start_time).toLocaleString() : '未设置'}</TableCell>
                                                <TableCell align="right">
                                                    {adConfig.c_status === AdStatus.PENDING && (<Tooltip title="开始演练"><IconButton color="success" onClick={() => handleAdAction(adConfig.c_id, 'start')}><PlayArrowIcon /></IconButton></Tooltip>)}
                                                    {adConfig.c_status === AdStatus.RUNNING && (<Tooltip title="停止演练"><IconButton color="warning" onClick={() => handleAdAction(adConfig.c_id, 'stop')}><StopIcon /></IconButton></Tooltip>)}
                                                    <Tooltip title="查看详情/报告"><IconButton color="info"><VisibilityIcon /></IconButton></Tooltip>
                                                    <Tooltip title="编辑"><IconButton color="primary" onClick={() => handleOpenForm(adConfig)} disabled={adConfig.c_status !== AdStatus.PENDING}><EditIcon /></IconButton></Tooltip>
                                                    <Tooltip title="删除"><IconButton color="error" onClick={() => handleDeleteConfirmation(adConfig)} disabled={adConfig.c_status !== AdStatus.PENDING}><DeleteIcon /></IconButton></Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog key={editingAdConfig?.c_id || 'new-ad-config-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="md">
                <form onSubmit={handleFormSubmit}>
                    <DialogTitle>{editingAdConfig ? '编辑演练配置' : '创建新演练'}</DialogTitle>
                    <DialogContent>
                        {statusMessage && statusMessage.type === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{statusMessage.message}</Alert>}
                        <TextField autoFocus margin="dense" name="c_drill_name" label="演练名称" type="text" fullWidth required defaultValue={editingAdConfig?.c_drill_name || ''} />
                        <TextField margin="dense" name="c_description" label="演练描述 (可选)" type="text" fullWidth multiline rows={3} defaultValue={editingAdConfig?.c_description || ''} />
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                            <TextField select fullWidth margin="dense" required label="红队" name="c_red_team_id" defaultValue={editingAdConfig?.c_red_team_id || ''}>
                                {teams.map(team => <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>)}
                            </TextField>
                            <TextField select fullWidth margin="dense" required label="蓝队" name="c_blue_team_id" defaultValue={editingAdConfig?.c_blue_team_id || ''}>
                                {teams.map(team => <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>)}
                            </TextField>
                        </Stack>
                        <TextField select fullWidth margin="dense" label="场景模板 (可选)" name="c_scene_config_id" defaultValue={editingAdConfig?.c_scene_config_id || ''}>
                            <MenuItem value=""><em>不选择场景</em></MenuItem>
                            {sceneConfigs.map(sc => <MenuItem key={sc.c_config_id} value={sc.c_config_id}>{sc.c_name}</MenuItem>)}
                        </TextField>

                        <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2, mt: 2 }}>
                            <Typography variant="h6" gutterBottom><GroupAddIcon sx={{ verticalAlign: 'middle', mr: 1 }}/>指派裁判团队</Typography>
                            <Autocomplete
                                multiple
                                options={users}
                                getOptionLabel={(option) => option.c_username}
                                value={selectedReferees.map(ref => users.find(u => u.c_id === ref.user_id)).filter(Boolean) as User[]}
                                isOptionEqualToValue={(option, value) => option.c_id === value.c_id}
                                onChange={(_event, newValue) => {
                                    const newReferees = newValue.map(user => {
                                        const existing = selectedReferees.find(r => r.user_id === user.c_id);
                                        return existing || { user_id: user.c_id, username: user.c_username, c_level: 'Standard', c_expertise: 'General' };
                                    });
                                    setSelectedReferees(newReferees);
                                }}
                                renderInput={(params) => (<TextField {...params} variant="standard" label="选择用户作为裁判" placeholder="添加裁判..." />)}
                            />
                            <Stack spacing={2} sx={{ mt: 2 }}>
                                {selectedReferees.map((referee, index) => (
                                    <Paper key={referee.user_id} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }} variant="outlined">
                                        <Typography sx={{ flexShrink: 0, fontWeight: 'bold', minWidth: '100px' }}>{referee.username}</Typography>
                                        <TextField fullWidth label="级别 (Level)" size="small" value={referee.c_level} onChange={(e) => handleRefereeChange(index, 'c_level', e.target.value)} required />
                                        <TextField fullWidth label="负责领域 (Expertise)" size="small" value={referee.c_expertise} onChange={(e) => handleRefereeChange(index, 'c_expertise', e.target.value)} required />
                                    </Paper>
                                ))}
                            </Stack>
                        </Box>

                        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                            <TextField margin="dense" name="c_start_time" label="计划开始时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingAdConfig?.c_start_time?.slice(0, 16) || ''} />
                            <TextField margin="dense" name="c_end_time" label="计划结束时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingAdConfig?.c_end_time?.slice(0, 16) || ''} />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseForm} disabled={isSubmitting}>取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting}>
                            {isSubmitting ? <CircularProgress size={24} /> : (editingAdConfig ? '保存更改' : '确认创建')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={isConfirmOpen} onClose={() => setIsConfirmOpen(false)}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent><Typography>您确定要删除演练 "{adConfigToDelete?.c_drill_name}" 吗？此操作不可撤销。</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsConfirmOpen(false)}>取消</Button>
                    <Button onClick={handleDeleteAdConfig} color="error">确认删除</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdManagementPage;