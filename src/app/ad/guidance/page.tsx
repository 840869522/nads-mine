// src/app/guidance/page.tsx

"use client";

import React, { useState, useEffect, useCallback, FormEvent, MouseEvent } from 'react';
// MUI 组件、图标等导入...
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
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite';

import { useDebounce } from '@/app/hooks/useDebounce';

// === 类型定义 ===
interface AdConfigSummary {
    c_id: string;
    c_drill_name: string;
}

interface TeamSummary {
    c_id: number;
    c_name: string;
}

interface GuidanceInject {
    c_id: string;
    c_title: string;
    c_description: string;
    c_type: 'INFO' | 'ACTION' | 'ALERT'; // 信息、动作、警报
    c_ad_config_id: string;
    c_target_team_id: number;
    c_status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
    c_execution_time: string | null; // 预定执行时间
    c_executed_at: string | null;    // 实际执行时间
    ad_config?: AdConfigSummary;
    target_team?: TeamSummary;
}

const Page: React.FC = () => {
    // === 状态管理 ===
    const [injects, setInjects] = useState<GuidanceInject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingInject, setEditingInject] = useState<GuidanceInject | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [injectToDelete, setInjectToDelete] = useState<GuidanceInject | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalInjects, setTotalInjects] = useState(0);

    // 用于表单下拉框的数据
    const [adConfigs, setAdConfigs] = useState<AdConfigSummary[]>([]);
    const [teams, setTeams] = useState<TeamSummary[]>([]);

    const API_BASE_URL = '/back/api';

    // === 数据获取 ===
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            // 并发获取所有需要的数据
            const params = new URLSearchParams({
                search: debouncedSearchQuery,
                page: String(page + 1),
                per_page: String(rowsPerPage),
            });
            const [injectsRes, adConfigsRes, teamsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/guidance/injects?${params.toString()}`),
                fetch(`${API_BASE_URL}/ad-configs?status=running`), // 只获取正在运行的演练作为目标
                fetch(`${API_BASE_URL}/ad/team`),
            ]);

            if (!injectsRes.ok || !adConfigsRes.ok || !teamsRes.ok) throw new Error('获取基础数据失败');

            const injectsData = await injectsRes.json();
            const adConfigsData = await adConfigsRes.json();
            const teamsData = await teamsRes.json();

            setInjects(injectsData.data ?? []);
            setTotalInjects(injectsData.total ?? 0);
            setAdConfigs(adConfigsData.data ?? []);
            setTeams(teamsData.data ?? []);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery, page, rowsPerPage]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(0); }, [debouncedSearchQuery]);


    // === 事件处理器 ===
    const handleOpenForm = (inject: GuidanceInject | null = null) => {
        setEditingInject(inject);
        setIsFormOpen(true);
        setStatusMessage(null);
    };
    const handleCloseForm = () => { setIsFormOpen(false); };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            c_title: formData.get('title'),
            c_description: formData.get('description'),
            c_type: formData.get('type'),
            c_ad_config_id: formData.get('ad_config_id'),
            c_target_team_id: Number(formData.get('target_team_id')),
            c_execution_time: formData.get('execution_time') ? new Date(formData.get('execution_time') as string).toISOString() : null,
        };

        try {
            const url = editingInject ? `${API_BASE_URL}/guidance/injects/${editingInject.c_id}` : `${API_BASE_URL}/guidance/injects`;
            const method = editingInject ? 'PUT' : 'POST';
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if (!response.ok) { const error = await response.json(); throw new Error(error.message || '操作失败'); }
            setStatusMessage({ type: 'success', message: '操作成功！' });
            handleCloseForm();
            fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExecuteInject = async (inject: GuidanceInject) => {
        if (!window.confirm(`确定要立即执行事件注入 "${inject.c_title}" 吗？`)) return;
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/guidance/injects/${inject.c_id}/execute`, { method: 'POST' });
            if (!response.ok) { const error = await response.json(); throw new Error(error.message || '执行失败'); }
            setStatusMessage({ type: 'success', message: '事件执行成功！' });
            fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleDeleteConfirmation = (inject: GuidanceInject) => {
        setInjectToDelete(inject);
        setIsConfirmOpen(true);
    };

    const handleDeleteInject = async () => {
        if (!injectToDelete) return;
        // 实现删除逻辑...
        setIsConfirmOpen(false);
        setInjectToDelete(null);
    };


    // === 渲染辅助函数 ===
    const renderStatusChip = (status: GuidanceInject['c_status']) => {
        const map = {
            PENDING: { label: '待处理', color: 'warning' as const },
            EXECUTED: { label: '已执行', color: 'success' as const },
            CANCELLED: { label: '已取消', color: 'default' as const },
        };
        const { label, color } = map[status];
        return <Chip label={label} color={color} size="small" />;
    };

    return (
        <Box sx={{ p: 3, maxWidth: '1400px', margin: 'auto' }}>
            {/* 页面头部 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">导调管理</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField size="small" placeholder="搜索事件标题..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}/>
                    <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()}>创建事件注入</Button>
                </Box>
            </Box>

            {statusMessage && <Alert severity={statusMessage.type} sx={{ mb: 2 }}>{statusMessage.message}</Alert>}

            {/* 表格 */}
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>标题</TableCell>
                                <TableCell>类型</TableCell>
                                <TableCell>目标演练</TableCell>
                                <TableCell>目标队伍</TableCell>
                                <TableCell>状态</TableCell>
                                <TableCell>计划执行时间</TableCell>
                                <TableCell align="right">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? ( <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow> )
                                : injects.map(inject => (
                                    <TableRow hover key={inject.c_id}>
                                        <TableCell>{inject.c_title}</TableCell>
                                        <TableCell>{inject.c_type}</TableCell>
                                        <TableCell>{inject.ad_config?.c_drill_name || 'N/A'}</TableCell>
                                        <TableCell>{inject.target_team?.c_name || 'N/A'}</TableCell>
                                        <TableCell>{renderStatusChip(inject.c_status)}</TableCell>
                                        <TableCell>{inject.c_execution_time ? new Date(inject.c_execution_time).toLocaleString() : '立即'}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="立即执行">
                                            <span>
                                                <IconButton color="success" onClick={() => handleExecuteInject(inject)} disabled={inject.c_status !== 'PENDING' || isSubmitting}>
                                                    <PlayCircleFilledWhiteIcon />
                                                </IconButton>
                                            </span>
                                            </Tooltip>
                                            <Tooltip title="编辑">
                                            <span>
                                                <IconButton color="primary" onClick={() => handleOpenForm(inject)} disabled={inject.c_status !== 'PENDING'}>
                                                    <EditIcon />
                                                </IconButton>
                                            </span>
                                            </Tooltip>
                                            <Tooltip title="删除">
                                             <span>
                                                <IconButton color="error" onClick={() => handleDeleteConfirmation(inject)} disabled={inject.c_status !== 'PENDING'}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination component="div" count={totalInjects} page={page} onPageChange={(e, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))} />
            </Paper>

            {/* 创建/编辑弹窗 */}
            <Dialog open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="sm">
                <form onSubmit={handleFormSubmit}>
                    <DialogTitle>{editingInject ? '编辑事件' : '创建新事件'}</DialogTitle>
                    <DialogContent>
                        <TextField name="title" label="事件标题" fullWidth required margin="dense" defaultValue={editingInject?.c_title} />
                        <TextField name="description" label="事件描述" fullWidth multiline rows={3} margin="dense" defaultValue={editingInject?.c_description} />
                        <FormControl fullWidth margin="dense" required>
                            <InputLabel>事件类型</InputLabel>
                            <Select name="type" label="事件类型" defaultValue={editingInject?.c_type || 'INFO'}>
                                <MenuItem value="INFO">信息</MenuItem>
                                <MenuItem value="ACTION">动作</MenuItem>
                                <MenuItem value="ALERT">警报</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth margin="dense" required>
                            <InputLabel>目标演练</InputLabel>
                            <Select name="ad_config_id" label="目标演练" defaultValue={editingInject?.c_ad_config_id || ''}>
                                {adConfigs.map(ac => <MenuItem key={ac.c_id} value={ac.c_id}>{ac.c_drill_name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth margin="dense" required>
                            <InputLabel>目标队伍</InputLabel>
                            <Select name="target_team_id" label="目标队伍" defaultValue={editingInject?.c_target_team_id || ''}>
                                {teams.map(t => <MenuItem key={t.c_id} value={t.c_id}>{t.c_name}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField name="execution_time" label="计划执行时间 (留空则为手动执行)" type="datetime-local" fullWidth margin="dense" InputLabelProps={{ shrink: true }} defaultValue={editingInject?.c_execution_time ? new Date(new Date(editingInject.c_execution_time).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}/>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseForm} disabled={isSubmitting}>取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? <CircularProgress size={24} /> : '保存'}</Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
};

export default Page;