"use client";

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
// MUI 组件导入 (保持不变)
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
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';

// 假设 useDebounce.ts 与 page.tsx 在同一目录
// 确保这个路径是正确的
import { useDebounce } from '@/app/hooks/useDebounce.ts';

// 自定义类型
enum TeamColor {
    RED = 'red',
    BLUE = 'blue',
}

interface Team {
    c_id: number;
    c_name: string;
    c_color: TeamColor;
    c_description?: string;
    member_count?: number;
    score?: number;
}

const Page: React.FC = () => {
    // === 状态管理 ===
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string | { [key: string]: string[] } } | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const fetchTeams = useCallback(async () => {
        setIsLoading(true);
        try {
            var url = '/back/api/ad/team'
            if (debouncedSearchQuery) {
                url =`${url}?search=${debouncedSearchQuery}`;
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error('从服务器获取队伍列表失败');
            const result = await response.json();
            setTeams(result.data ?? []);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
            setTeams([]);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery]);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    // === 事件处理器 ===
    const handleOpenForm = (team?: Team) => {
        setEditingTeam(team || null);
        setIsFormOpen(true);
        setStatusMessage(null); // 打开表单时清除旧消息
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingTeam(null);
    };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const teamData = {
            c_name: formData.get('name') as string,
            c_color: formData.get('color') as TeamColor,
            c_description: formData.get('description') as string,
        };

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const url = editingTeam
                ? `/back/api/ad/team/${editingTeam.c_id}`
                : '/back/api/ad/team';
            const method = editingTeam ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(teamData),
            });
            const result = await response.json();

            if (!response.ok) {
                if (response.status === 422 && result.errors) {
                    throw new Error(JSON.stringify(result.errors));
                }
                throw new Error(result.message || '操作失败，请重试');
            }

            setStatusMessage({ type: 'success', message: result.message || '操作成功！' });
            handleCloseForm();
            await fetchTeams();

        } catch (error) {
            let errorMessage: string | { [key: string]: string[] } = (error as Error).message;
            try {
                errorMessage = JSON.parse(errorMessage);
            } catch (e) {
                // is string
            }
            setStatusMessage({ type: 'error', message: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderErrorMessage = (message: string | { [key: string]: string[] }) => {
        if (typeof message === 'string') return message;
        return (
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {Object.values(message).flat().map((msg, index) => <li key={index}>{msg}</li>)}
            </ul>
        );
    };

    const handleOpenConfirmDialog = (team: Team) => {
        setTeamToDelete(team);
        setIsConfirmOpen(true);
    };

    const handleCloseConfirmDialog = () => {
        setTeamToDelete(null);
        setIsConfirmOpen(false);
    };

    const handleDeleteTeam = async () => {
        if (!teamToDelete) return;

        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            const response = await fetch(`/back/api/ad/team/${teamToDelete.c_id}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '删除队伍失败');
            }

            setStatusMessage({ type: 'success', message: result.message || '删除成功！' });
            await fetchTeams();

        } catch (error) {
            setStatusMessage({ type: 'error', message: (error as Error).message });
        } finally {
            setIsSubmitting(false);
            handleCloseConfirmDialog();
        }
    };

    // === 渲染逻辑 ===
    return (
        <Box sx={{ p: 3, maxWidth: '1200px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Typography variant="h4" component="h1" fontWeight="bold">队伍管理</Typography>
                    <TextField
                        variant="outlined"
                        size="small"
                        placeholder="搜索队伍名称或描述..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>) }}
                        sx={{ minWidth: '300px' }}
                    />
                </Box>
                <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()}>创建新队伍</Button>
            </Box>
            {statusMessage && <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 3, wordBreak: 'break-word' }}>{renderErrorMessage(statusMessage.message)}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer>
                    <Table stickyHeader aria-label="teams table">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>队伍名称</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>队伍颜色</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>成员数量</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>当前得分</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>描述</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 1 }}>正在加载队伍数据...</Typography></TableCell></TableRow>
                            ) : teams.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                                        <Typography color="text.secondary">{debouncedSearchQuery ? '未找到匹配的队伍。' : '当前没有队伍，请创建新队伍。'}</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                teams.filter(Boolean).map((team) => (
                                    <TableRow hover key={team.c_id}>
                                        <TableCell component="th" scope="row">{team.c_name}</TableCell>
                                        <TableCell><Chip label={team.c_color === TeamColor.RED ? '红队 - 攻击方' : '蓝队 - 防御方'} color={team.c_color === TeamColor.RED ? 'error' : 'primary'} size="small" /></TableCell>
                                        <TableCell align="center">{team.member_count ?? 0}</TableCell>
                                        <TableCell align="center">{team.score ?? 0}</TableCell>
                                        <TableCell><Tooltip title={team.c_description || ''}><Typography noWrap sx={{ maxWidth: '200px', color: team.c_description ? 'inherit' : 'text.disabled' }}>{team.c_description || '暂无描述'}</Typography></Tooltip></TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="编辑队伍"><IconButton onClick={() => handleOpenForm(team)} color="primary"><EditIcon /></IconButton></Tooltip>
                                            <Tooltip title="删除队伍"><IconButton onClick={() => handleOpenConfirmDialog(team)} color="error"><DeleteIcon /></IconButton></Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog key={editingTeam?.c_id || 'new-team-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="sm">
                <DialogTitle>{editingTeam ? '编辑队伍' : '创建新队伍'}</DialogTitle>
                {/*  <<<<< 这里是修正点 >>>>>  */}
                <form onSubmit={handleFormSubmit}>
                    <DialogContent>
                        {statusMessage && statusMessage.type === 'error' && (
                            <Alert severity="error" sx={{ mb: 2 }}>{renderErrorMessage(statusMessage.message)}</Alert>
                        )}
                        <TextField autoFocus margin="dense" id="name" name="name" label="队伍名称" type="text" fullWidth variant="outlined" defaultValue={editingTeam?.c_name || ''} required />
                        <FormControl component="fieldset" margin="normal" required>
                            <FormLabel component="legend">队伍颜色</FormLabel>
                            <RadioGroup row aria-label="color" name="color" defaultValue={editingTeam?.c_color || TeamColor.BLUE}>
                                <FormControlLabel value={TeamColor.BLUE} control={<Radio />} label="蓝队 (防御方)" />
                                <FormControlLabel value={TeamColor.RED} control={<Radio />} label="红队 (攻击方)" />
                            </RadioGroup>
                        </FormControl>
                        <TextField margin="dense" id="description" name="description" label="队伍描述 (可选)" type="text" fullWidth multiline rows={3} variant="outlined" defaultValue={editingTeam?.c_description || ''} />
                    </DialogContent>
                    <DialogActions sx={{ p: '0 24px 20px' }}>
                        <Button onClick={handleCloseForm} variant="outlined" disabled={isSubmitting}>取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting}>
                            {isSubmitting ? <CircularProgress size={24} /> : (editingTeam ? '保存更改' : '确认创建')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
            <Dialog open={isConfirmOpen} onClose={handleCloseConfirmDialog}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent><Typography>您确定要删除队伍 "{teamToDelete?.c_name}" 吗？此操作无法撤销。</Typography></DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseConfirmDialog} disabled={isSubmitting}>取消</Button>
                    <Button onClick={handleDeleteTeam} color="error" disabled={isSubmitting}>
                        {isSubmitting ? <CircularProgress size={24} /> : '确认删除'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Page;