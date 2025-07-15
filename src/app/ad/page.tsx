// file: AdManagementPage.tsx

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
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';

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

// --- ★★★ 核心类型定义更新 ★★★ ---

// 用户信息，主键是 c_username (string)，与后端 c_users 表对应
interface User {
    c_username: string;
    c_email: string; // email 字段可选，取决于后端是否返回
}

// 演练中裁判的信息结构，对应 c_referees 表的核心字段
interface AdReferee {
    c_user_id: string; // 对应 c_users.c_username
    c_level: string;   // 例如 "主裁判", "普通裁判"
    // 为了在前端表单中方便地显示和操作，我们临时加入完整的用户信息
    user?: User;
}

// 演练配置信息，包含一个裁判数组
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
    // 关键：referees 数组现在是 AdReferee 类型
    referees: AdReferee[];
}

interface Team { c_id: number; c_name: string; }
interface SceneConfig { c_config_id: number; c_name: string; }


const AdManagementPage: React.FC = () => {
    // === 状态管理 ===
    const [adConfigs, setAdConfigs] = useState<AdConfig[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<User[]>([]); // 所有可用用户列表
    const [sceneConfigs, setSceneConfigs] = useState<SceneConfig[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAdConfig, setEditingAdConfig] = useState<AdConfig | null>(null);

    // ★ 新增/修改的状态：管理表单中选中的裁判
    const [selectedReferees, setSelectedReferees] = useState<AdReferee[]>([]);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [adConfigToDelete, setAdConfigToDelete] = useState<AdConfig | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const API_BASE_URL = 'http://127.0.0.1:8000/api';

    // --- 数据获取 ---
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            // 注意: `/ad/users` 是我们新增的获取所有用户的API路由
            const [adConfigsRes, teamsRes, usersRes, scenesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/ad-configs?search=${debouncedSearchQuery}`), // 推荐使用更RESTful的路由
                fetch(`${API_BASE_URL}/ad/team`),
                fetch(`${API_BASE_URL}/ad/users`),
                fetch(`${API_BASE_URL}/scenarios`),
            ]);

            if (!adConfigsRes.ok || !teamsRes.ok || !usersRes.ok || !scenesRes.ok) {
                throw new Error('获取基础数据失败');
            }

            const [adConfigsData, teamsData, usersData, scenesData] = await Promise.all([
                adConfigsRes.json(),
                teamsRes.json(),
                usersRes.json(),
                scenesRes.json(),
            ]);

            // 假设后端返回的 AdConfig 对象中已经包含了 referees 数组
            // 格式: { ..., "referees": [{"c_user_id": "admin", "c_level": "主裁判"}] }
            setAdConfigs(adConfigsData.data || []);
            setTeams(teamsData.data || []);
            setUsers(usersData.data || []); // 后端 /api/ad/users 返回的用户列表

            // 保留你原有的场景数据处理逻辑
            if (Array.isArray(scenesData)) {
                const formattedScenes = scenesData.map(scene => ({ c_config_id: scene.id, c_name: scene.name }));
                setSceneConfigs(formattedScenes);
            } else {
                setSceneConfigs(scenesData.data || []);
            }

        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
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
        // 如果是编辑，用演练自带的裁判信息初始化；如果是新建，则为空数组
        if (adConfig && adConfig.referees) {
            // 关键一步：将完整的 User 对象附加到 selectedReferees 中，以便 Autocomplete 显示
            const refereesWithUserDetails = adConfig.referees.map(ref => ({
                ...ref,
                user: users.find(u => u.c_username === ref.c_user_id)
            })).filter(ref => ref.user); // 过滤掉找不到用户的裁判
            setSelectedReferees(refereesWithUserDetails as AdReferee[]);
        } else {
            setSelectedReferees([]);
        }
        setIsFormOpen(true);
        setStatusMessage(null);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingAdConfig(null);
        setSelectedReferees([]); // 清理状态
    };

    // ★ 核心修改：表单提交逻辑
    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        // 准备发送到后端的数据
        const adConfigData = {
            c_drill_name: formData.get('c_drill_name') as string,
            c_description: formData.get('c_description') as string,
            c_red_team_id: Number(formData.get('c_red_team_id')),
            c_blue_team_id: Number(formData.get('c_blue_team_id')),
            c_scene_config_id: Number(formData.get('c_scene_config_id')) || null,
            c_start_time: formData.get('c_start_time') ? new Date(formData.get('c_start_time') as string).toISOString() : null,
            c_end_time: formData.get('c_end_time') ? new Date(formData.get('c_end_time') as string).toISOString() : null,
            // 关键：只发送裁判的核心信息到后端，去除临时的 `user` 对象
            referees: selectedReferees.map(({ c_user_id, c_level }) => ({
                c_user_id,
                c_level
            })),
        };

        // ... (保留你原有的表单校验)
        if (!adConfigData.c_red_team_id || !adConfigData.c_blue_team_id) {
            setStatusMessage({ type: 'error', message: '请选择红队和蓝队！' });
            setIsSubmitting(false);
            return;
        }
        if (adConfigData.c_red_team_id === adConfigData.c_blue_team_id) {
            setStatusMessage({ type: 'error', message: '红队和蓝队不能选择同一个队伍！' });
            setIsSubmitting(false);
            return;
        }
        if (adConfigData.referees.length === 0) {
            setStatusMessage({ type: 'error', message: '请至少指定一名裁判！' });
            setIsSubmitting(false);
            return;
        }

        try {
            const url = editingAdConfig
                ? `${API_BASE_URL}/ad-configs/${editingAdConfig.c_id}`
                : `${API_BASE_URL}/ad-configs`;
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

    // (删除和启停演练的逻辑保持不变)
    const handleDeleteConfirmation = (adConfig: AdConfig) => {
        setAdConfigToDelete(adConfig);
        setIsConfirmOpen(true);
    };

    const handleDeleteAdConfig = async () => {
        if (!adConfigToDelete) return;
        try {
            await fetch(`${API_BASE_URL}/ad-configs/${adConfigToDelete.c_id}`, { method: 'DELETE' });
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
            const response = await fetch(`${API_BASE_URL}/ad-configs/${adConfigId}/${action}`, {
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

    // ★ 新增：处理裁判级别变化的函数
    const handleRefereeLevelChange = (user_id: string, newLevel: string) => {
        setSelectedReferees(prev =>
            prev.map(ref =>
                ref.c_user_id === user_id ? { ...ref, c_level: newLevel } : ref
            )
        );
    };

    // --- 辅助渲染函数 ---
    const findTeamNameById = (id: number | null) => teams.find(i => i.c_id === id)?.c_name || `未知 (ID: ${id})`;
    const findSceneNameById = (id: number | null) => sceneConfigs.find(i => i.c_config_id === id)?.c_name || `未知 (ID: ${id})`;
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

    // --- ★★★ 渲染逻辑 (Render Logic) ★★★ ---
    return (
        <Box sx={{ p: 3, maxWidth: '1600px', margin: 'auto' }}>
            {/* ... (页面标题、搜索框、创建按钮部分保持不变) ... */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">攻防演练管理</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField variant="outlined" size="small" placeholder="搜索演练名称..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} sx={{ minWidth: '300px' }} />
                    <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()} disabled={isLoading}>创建新演练</Button>
                </Box>
            </Box>

            {statusMessage && <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 2 }}>{statusMessage.message}</Alert>}

            {/* ★ 表格中裁判列的渲染更新 */}
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
                                                            <Chip
                                                                key={ref.c_user_id}
                                                                label={`${findUserNameById(ref.c_user_id)} (${ref.c_level})`}
                                                                size="small"
                                                            />
                                                        ))}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>{findSceneNameById(adConfig.c_scene_config_id)}</TableCell>
                                                <TableCell>{adConfig.c_start_time ? new Date(adConfig.c_start_time).toLocaleString() : '未设置'}</TableCell>
                                                <TableCell align="right">
                                                    {adConfig.c_status === 'pending' && (<Tooltip title="开始演练"><IconButton color="success" onClick={() => handleAdAction(adConfig.c_id, 'start')}><PlayArrowIcon /></IconButton></Tooltip>)}
                                                    {adConfig.c_status === 'running' && (<Tooltip title="停止演练"><IconButton color="warning" onClick={() => handleAdAction(adConfig.c_id, 'stop')}><StopIcon /></IconButton></Tooltip>)}
                                                    <Tooltip title="查看详情/报告"><IconButton color="info"><VisibilityIcon /></IconButton></Tooltip>
                                                    <Tooltip title="编辑"><IconButton color="primary" onClick={() => handleOpenForm(adConfig)} disabled={adConfig.c_status !== 'pending'}><EditIcon /></IconButton></Tooltip>
                                                    <Tooltip title="删除"><IconButton color="error" onClick={() => handleDeleteConfirmation(adConfig)} disabled={adConfig.c_status !== 'pending'}><DeleteIcon /></IconButton></Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* ★★★ 核心修改：创建/编辑演练的对话框 ★★★ */}
            <Dialog key={editingAdConfig?.c_id || 'new-ad-config-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="md">
                <form onSubmit={handleFormSubmit}>
                    <DialogTitle>{editingAdConfig ? '编辑演练配置' : '创建新演练'}</DialogTitle>
                    <DialogContent>
                        {statusMessage && statusMessage.type === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{statusMessage.message}</Alert>}
                        {/* ... (其他表单字段基本保持不变) ... */}
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

                        {/* ★ 新的裁判指派 UI */}
                        <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2, mt: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                <GroupAddIcon sx={{ verticalAlign: 'middle', mr: 1 }}/>指派裁判
                            </Typography>

                            <Autocomplete
                                multiple
                                id="referee-autocomplete"
                                options={users} // 选项是所有用户
                                getOptionLabel={(option) => option.c_username}
                                // 已选中的值是 selectedReferees 数组中的 user 对象
                                value={selectedReferees.map(ref => ref.user).filter(Boolean) as User[]}
                                isOptionEqualToValue={(option, value) => option.c_username === value.c_username}
                                onChange={(_event, newValue) => {
                                    // 当用户在下拉框中选择或移除时，更新 selectedReferees 状态
                                    const newReferees = newValue.map(user => {
                                        // 如果是已存在的裁判，保留其级别；如果是新添加的，给个默认级别
                                        const existing = selectedReferees.find(r => r.c_user_id === user.c_username);
                                        return existing || {
                                            c_user_id: user.c_username,
                                            c_level: '普通裁判', // 默认级别
                                            user: user
                                        };
                                    });
                                    setSelectedReferees(newReferees);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="standard"
                                        label="选择用户作为裁判"
                                        placeholder="添加裁判..."
                                    />
                                )}
                            />

                            {/* 显示已选中的裁判并允许修改其级别 */}
                            {selectedReferees.length > 0 && (
                                <Stack spacing={2} sx={{ mt: 3 }}>
                                    {selectedReferees.map((referee) => (
                                        <Paper key={referee.c_user_id} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }} variant="outlined">
                                            <Typography sx={{ flexShrink: 0, fontWeight: 'bold', minWidth: '120px' }}>
                                                {referee.user?.c_username || referee.c_user_id}
                                            </Typography>
                                            <FormControl fullWidth size="small">
                                                <InputLabel id={`level-select-label-${referee.c_user_id}`}>裁判级别</InputLabel>
                                                <Select
                                                    labelId={`level-select-label-${referee.c_user_id}`}
                                                    label="裁判级别"
                                                    value={referee.c_level}
                                                    onChange={(e: SelectChangeEvent) => handleRefereeLevelChange(referee.c_user_id, e.target.value)}
                                                >
                                                    <MenuItem value="主裁判">主裁判</MenuItem>
                                                    <MenuItem value="普通裁判">普通裁判</MenuItem>
                                                    <MenuItem value="技术专家">技术专家</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                            <TextField margin="dense" name="c_start_time" label="计划开始时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingAdConfig?.c_start_time ? editingAdConfig.c_start_time.slice(0, 16) : ''} />
                            <TextField margin="dense" name="c_end_time" label="计划结束时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingAdConfig?.c_end_time ? editingAdConfig.c_end_time.slice(0, 16) : ''} />
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

            {/* ... (删除确认对话框保持不变) ... */}
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

// @ts-ignore
export default AdManagementPage;