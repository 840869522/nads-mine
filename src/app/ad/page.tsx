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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
// MUI 图标
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import VisibilityIcon from '@mui/icons-material/Visibility';

// 假设的自定义钩子，用于实现搜索防抖
import { useDebounce } from '@/app/hooks/useDebounce.ts';

// --- 类型定义：与数据库表 c_drill_configs 紧密对应 ---
// 演练状态枚举
enum DrillStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    FINISHED = 'finished',
    ARCHIVED = 'archived',
}

// 演练配置类型
interface DrillConfig {
    id: number;
    drill_name: string;
    description: string | null;
    red_team_id: number;
    blue_team_id: number;
    referee_id: number;
    scene_config_id: number;
    scene_instance_id: number | null;
    status: DrillStatus;
    start_time: string | null;
    end_time: string | null;
    create_at: string;
    update_at: string;
}

// 用于表单下拉菜单的基础数据类型
interface Team { c_id: number; c_name: string; }
interface Referee { id: number; username: string; }
interface SceneConfig { id: number; name: string; }


const DrillManagementPage: React.FC = () => {
    // === 状态管理 ===
    const [drills, setDrills] = useState<DrillConfig[]>([]);
    // 用于表单下拉菜单的数据
    const [teams, setTeams] = useState<Team[]>([]);
    const [referees, setReferees] = useState<Referee[]>([]);
    const [sceneConfigs, setSceneConfigs] = useState<SceneConfig[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // 表单/对话框状态
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDrill, setEditingDrill] = useState<DrillConfig | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [drillToDelete, setDrillToDelete] = useState<DrillConfig | null>(null);

    // 搜索状态
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // --- 数据获取 ---
    const API_BASE_URL = '/back/api'; // 假设的API基地址

    // 获取演练列表
    const fetchDrills = useCallback(async () => {
        setIsLoading(true);
        try {
            const url = new URL(`${API_BASE_URL}/drills`);
            if (debouncedSearchQuery) {
                url.searchParams.append('search', debouncedSearchQuery);
            }
            const response = await fetch(url.toString());
            if (!response.ok) throw new Error('获取演练列表失败');
            const result = await response.json();
            setDrills(result.data || []);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery]);

    // 获取创建/编辑演练所需的表单数据（队伍、裁判、场景）
    const fetchFormData = async () => {
        try {
            const [teamsRes, refereesRes, scenesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/drill/team`),
                fetch(`${API_BASE_URL}/referees`), // 假设有这个API
                fetch(`${API_BASE_URL}/scene-configs`), // 假设有这个API
            ]);
            if (!teamsRes.ok || !refereesRes.ok || !scenesRes.ok) throw new Error('加载表单基础数据失败');
            const teamsData = await teamsRes.json();
            const refereesData = await refereesRes.json();
            const scenesData = await scenesRes.json();
            setTeams(teamsData.data || []);
            setReferees(refereesData.data || []);
            setSceneConfigs(scenesData.data || []);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        }
    };

    useEffect(() => {
        fetchDrills();
    }, [fetchDrills]);

    useEffect(() => {
        fetchFormData();
    }, []); // 仅在组件初次挂载时执行

    // --- 事件处理器 ---
    const handleOpenForm = (drill: DrillConfig | null = null) => {
        setEditingDrill(drill);
        setIsFormOpen(true);
        setStatusMessage(null);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingDrill(null);
    };


    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const drillData = {
            drill_name: formData.get('drill_name') as string,
            description: formData.get('description') as string,
            red_team_id: Number(formData.get('red_team_id')),
            blue_team_id: Number(formData.get('blue_team_id')),
            referee_id: Number(formData.get('referee_id')),
            scene_config_id: Number(formData.get('scene_config_id')),
            start_time: formData.get('start_time') || null,
            end_time: formData.get('end_time') || null,
        };

        // 前端验证：红蓝队不能相同，这与数据库的CHECK约束相对应
        if (drillData.red_team_id === drillData.blue_team_id) {
            setStatusMessage({ type: 'error', message: '红队和蓝队不能选择同一个队伍！'});
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const url = editingDrill
                ? `${API_BASE_URL}/drills/${editingDrill.id}`
                : `${API_BASE_URL}/drills`;
            const method = editingDrill ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(drillData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '操作失败');

            setStatusMessage({ type: 'success', message: result.message || '操作成功！' });
            handleCloseForm();
            await fetchDrills();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteConfirmation = (drill: DrillConfig) => {
        setDrillToDelete(drill);
        setIsConfirmOpen(true);
    };

    const handleDeleteDrill = async () => {
        if (!drillToDelete) return;
        try {
            // ... 与之前示例类似的删除逻辑
            await fetch(`${API_BASE_URL}/drills/${drillToDelete.id}`, { method: 'DELETE' });
            setStatusMessage({ type: 'success', message: `演练 "${drillToDelete.drill_name}" 已删除。`});
            await fetchDrills();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsConfirmOpen(false);
            setDrillToDelete(null);
        }
    };

    // 演练状态变更处理器
    const handleDrillAction = async (drillId: number, action: 'start' | 'stop') => {
        try {
            const response = await fetch(`${API_BASE_URL}/drills/${drillId}/${action}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '状态变更失败');
            setStatusMessage({ type: 'success', message: result.message });
            await fetchDrills(); // 重新加载列表以更新状态
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        }
    };

    // --- 辅助渲染函数 ---
    const findNameById = (id: number | null, list: {id: number, name: string}[] | {c_id: number, c_name: string}[]) => {
        if (id === null) return 'N/A';
        // @ts-ignore
        const item = list.find(i => (i.id || i.c_id) === id);
        // @ts-ignore
        return item ? (item.name || item.c_name || item.username) : `未知 (ID: ${id})`;
    };

    const renderStatusChip = (status: DrillStatus) => {
        const statusMap = {
            [DrillStatus.PENDING]: { label: '未开始', color: 'default' as const },
            [DrillStatus.RUNNING]: { label: '进行中', color: 'success' as const },
            [DrillStatus.FINISHED]: { label: '已结束', color: 'primary' as const },
            [DrillStatus.ARCHIVED]: { label: '已归档', color: 'warning' as const },
        };
        const { label, color } = statusMap[status] || statusMap[DrillStatus.PENDING];
        return <Chip label={label} color={color} size="small" />;
    };

    // --- 渲染逻辑 ---
    return (
        <Box sx={{ p: 3, maxWidth: '1600px', margin: 'auto' }}>
            {/* 页面标题和操作区 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">攻防演练管理</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                        variant="outlined" size="small" placeholder="搜索演练名称..."
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                        sx={{ minWidth: '300px' }}
                    />
                    <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()}>创建新演练</Button>
                </Box>
            </Box>

            {statusMessage && <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 2 }}>{statusMessage.message}</Alert>}

            {/* 演练列表表格 */}
            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer sx={{ maxHeight: '70vh' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>演练名称</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>状态</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>红队</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>蓝队</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>裁判</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>场景模板</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>计划开始时间</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>计划结束时间</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow>
                            ) : drills.length === 0 ? (
                                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5 }}>没有找到演练配置。</TableCell></TableRow>
                            ) : (
                                drills.map((drill) => (
                                    <TableRow hover key={drill.id}>
                                        <TableCell component="th" scope="row">{drill.drill_name}</TableCell>
                                        <TableCell align="center">{renderStatusChip(drill.status)}</TableCell>
                                        <TableCell>{findNameById(drill.red_team_id, teams)}</TableCell>
                                        <TableCell>{findNameById(drill.blue_team_id, teams)}</TableCell>
                                        <TableCell>{findNameById(drill.referee_id, referees)}</TableCell>
                                        <TableCell>{findNameById(drill.scene_config_id, sceneConfigs)}</TableCell>
                                        <TableCell>{drill.start_time ? new Date(drill.start_time).toLocaleString() : '未设置'}</TableCell>
                                        <TableCell>{drill.end_time ? new Date(drill.end_time).toLocaleString() : '未设置'}</TableCell>
                                        <TableCell align="right">
                                            {drill.status === DrillStatus.PENDING && (
                                                <Tooltip title="开始演练"><IconButton color="success" onClick={() => handleDrillAction(drill.id, 'start')}><PlayArrowIcon /></IconButton></Tooltip>
                                            )}
                                            {drill.status === DrillStatus.RUNNING && (
                                                <Tooltip title="停止演练"><IconButton color="warning" onClick={() => handleDrillAction(drill.id, 'stop')}><StopIcon /></IconButton></Tooltip>
                                            )}
                                            <Tooltip title="查看详情/报告"><IconButton color="info"><VisibilityIcon /></IconButton></Tooltip>
                                            <Tooltip title="编辑"><IconButton color="primary" onClick={() => handleOpenForm(drill)} disabled={drill.status !== DrillStatus.PENDING}><EditIcon /></IconButton></Tooltip>
                                            <Tooltip title="删除"><IconButton color="error" onClick={() => handleDeleteConfirmation(drill)} disabled={drill.status !== DrillStatus.PENDING}><DeleteIcon /></IconButton></Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* 创建/编辑演练的对话框 */}
            <Dialog key={editingDrill?.id || 'new-drill-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="md">
                <form onSubmit={handleFormSubmit}>
                    <DialogTitle>{editingDrill ? '编辑演练配置' : '创建新演练'}</DialogTitle>
                    <DialogContent>
                        {statusMessage && statusMessage.type === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{statusMessage.message}</Alert>}
                        <TextField autoFocus margin="dense" name="drill_name" label="演练名称" type="text" fullWidth required defaultValue={editingDrill?.drill_name || ''} />
                        <TextField margin="dense" name="description" label="演练描述 (可选)" type="text" fullWidth multiline rows={3} defaultValue={editingDrill?.description || ''} />
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
                            <FormControl fullWidth margin="dense" required>
                                <InputLabel>红队</InputLabel>
                                <Select name="red_team_id" label="红队" defaultValue={editingDrill?.red_team_id || ''}>
                                    {teams.map(team => <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth margin="dense" required>
                                <InputLabel>蓝队</InputLabel>
                                <Select name="blue_team_id" label="蓝队" defaultValue={editingDrill?.blue_team_id || ''}>
                                    {teams.map(team => <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth margin="dense" required>
                                <InputLabel>裁判</InputLabel>
                                <Select name="referee_id" label="裁判" defaultValue={editingDrill?.referee_id || ''}>
                                    {referees.map(referee => <MenuItem key={referee.id} value={referee.id}>{referee.username}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth margin="dense" required>
                                <InputLabel>场景模板</InputLabel>
                                <Select name="scene_config_id" label="场景模板" defaultValue={editingDrill?.scene_config_id || ''}>
                                    {sceneConfigs.map(sc => <MenuItem key={sc.id} value={sc.id}>{sc.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
                            <TextField margin="dense" name="start_time" label="计划开始时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingDrill?.start_time?.slice(0, 16) || ''} />
                            <TextField margin="dense" name="end_time" label="计划结束时间" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} defaultValue={editingDrill?.end_time?.slice(0, 16) || ''} />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseForm} disabled={isSubmitting}>取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting}>
                            {isSubmitting ? <CircularProgress size={24} /> : (editingDrill ? '保存更改' : '确认创建')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* 删除确认对话框 */}
            <Dialog open={isConfirmOpen} onClose={() => setIsConfirmOpen(false)}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent>
                    <Typography>您确定要删除演练 "{drillToDelete?.drill_name}" 吗？此操作不可撤销。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsConfirmOpen(false)}>取消</Button>
                    <Button onClick={handleDeleteDrill} color="error">确认删除</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DrillManagementPage;