"use client";

import React, { useState, useEffect, FormEvent } from 'react';

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

// MUI Table 相关导入
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

// MUI Dialog (模态框) 相关导入
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

// MUI 图标导入
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// 自定义类型
enum TeamColor {
    RED = 'red',
    BLUE = 'blue',
}

interface Team {
    id: number;
    name: string;
    color: TeamColor;
    description?: string;
    member_count?: number; // 与后端 Laravel 蛇形命名保持一致
    score?: number;
}

// 队伍管理页面组件
const Page: React.FC = () => {
    // === 状态管理 (State Management) ===
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string | { [key: string]: string[] } } | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

    // === 副作用 (Side Effects) ===
    useEffect(() => {
        const fetchTeams = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('http://127.0.0.1:8000/api/drill/team');
                if (!response.ok) {
                    throw new Error('从服务器获取队伍列表失败');
                }
                const result = await response.json();
                // 【关键修正】: 使用空值合并运算符(??)提供一个安全的默认值(空数组)
                // 这样即使API返回的数据中没有 'data' 字段，teams 也不会是 undefined
                setTeams(result.data ?? []);
            } catch (err) {
                setStatusMessage({ type: 'error', message: (err as Error).message });
                // 在捕获到错误时，也确保 teams 是一个数组，防止渲染时崩溃
                setTeams([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTeams();
    }, []);

    // === 事件处理器 (Event Handlers) ===

    const handleOpenForm = (team?: Team) => {
        setEditingTeam(team || null);
        setIsFormOpen(true);
        setStatusMessage(null);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
    };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const teamData = {
            name: formData.get('name') as string,
            color: formData.get('color') as TeamColor,
            description: formData.get('description') as string,
        };

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            let response;
            if (editingTeam) {
                response = await fetch(`http://127.0.0.1:8000/api/drill/team/${editingTeam.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(teamData),
                });
            } else {
                response = await fetch('http://127.0.0.1:8000/api/drill/team', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(teamData),
                });
            }

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 422 && result.errors) {
                    throw new Error(JSON.stringify(result.errors));
                }
                throw new Error(result.message || (editingTeam ? '更新队伍失败' : '创建队伍失败'));
            }

            if (editingTeam) {
                setTeams(prevTeams => prevTeams.map(t => (t.id === editingTeam.id ? result : t)));
                setStatusMessage({ type: 'success', message: `队伍 "${result.name}" 已成功更新！` });
            } else {
                setTeams(prevTeams => [result, ...prevTeams]);
                setStatusMessage({ type: 'success', message: `新队伍 "${result.name}" 已成功创建！` });
            }
            handleCloseForm();
        } catch (error) {
            let errorMessage: string | { [key: string]: string[] } = (error as Error).message;
            try { errorMessage = JSON.parse(errorMessage); } catch (e) { /* 保持为字符串错误 */ }
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
            const response = await fetch(`http://127.0.0.1:8000/api/drill/team/${teamToDelete.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '删除队伍失败' }));
                throw new Error(errorData.message);
            }
            setTeams(prevTeams => prevTeams.filter(t => t.id !== teamToDelete.id));
            setStatusMessage({ type: 'success', message: `队伍 "${teamToDelete.name}" 已被删除。` });
        } catch (error) {
            setStatusMessage({ type: 'error', message: (error as Error).message });
        } finally {
            setIsSubmitting(false);
            handleCloseConfirmDialog();
        }
    };

    // === 渲染逻辑 (Render Logic) ===
    return (
        <Box sx={{ p: 3, maxWidth: '1200px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    队伍管理
                </Typography>
                <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()}>
                    创建新队伍
                </Button>
            </Box>

            {statusMessage && (
                <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 3 }}>
                    {renderErrorMessage(statusMessage.message)}
                </Alert>
            )}

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
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                                        <CircularProgress />
                                        <Typography sx={{ mt: 1 }}>正在加载队伍数据...</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : teams.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                                        <Typography color="text.secondary">当前没有队伍，请创建新队伍。</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                teams.map((team) => (
                                    <TableRow hover key={team.id}>
                                        <TableCell component="th" scope="row">
                                            {team.name}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={team.color === TeamColor.RED ? '红队 - 攻击方' : '蓝队 - 防御方'}
                                                color={team.color === TeamColor.RED ? 'error' : 'primary'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell align="center">{team.member_count ?? 0}</TableCell>
                                        <TableCell align="center">{team.score ?? 0}</TableCell>
                                        <TableCell>
                                            <Tooltip title={team.description || ''}>
                                                <Typography noWrap sx={{ maxWidth: '200px', color: team.description ? 'inherit' : 'text.disabled' }}>
                                                    {team.description || '暂无描述'}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="编辑队伍">
                                                <IconButton onClick={() => handleOpenForm(team)} color="primary">
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="删除队伍">
                                                <IconButton onClick={() => handleOpenConfirmDialog(team)} color="error">
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog key={editingTeam?.id || 'new-team-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="sm">
                <DialogTitle>{editingTeam ? '编辑队伍' : '创建新队伍'}</DialogTitle>
                <form onSubmit={handleFormSubmit}>
                    <DialogContent>
                        <TextField autoFocus margin="dense" id="name" name="name" label="队伍名称" type="text" fullWidth variant="outlined" defaultValue={editingTeam?.name || ''} required />
                        <FormControl component="fieldset" margin="normal" required>
                            <FormLabel component="legend">队伍颜色</FormLabel>
                            <RadioGroup row aria-label="color" name="color" defaultValue={editingTeam?.color || TeamColor.BLUE}>
                                <FormControlLabel value={TeamColor.BLUE} control={<Radio />} label="蓝队 (防御方)" />
                                <FormControlLabel value={TeamColor.RED} control={<Radio />} label="红队 (攻击方)" />
                            </RadioGroup>
                        </FormControl>
                        <TextField margin="dense" id="description" name="description" label="队伍描述 (可选)" type="text" fullWidth multiline rows={3} variant="outlined" defaultValue={editingTeam?.description || ''} />
                    </DialogContent>
                    <DialogActions sx={{ p: '0 24px 20px' }}>
                        <Button onClick={handleCloseForm} variant="outlined">取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting}>
                            {isSubmitting ? <CircularProgress size={24} /> : (editingTeam ? '保存更改' : '确认创建')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={isConfirmOpen} onClose={handleCloseConfirmDialog}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent>
                    <Typography>您确定要删除队伍 "{teamToDelete?.name}" 吗？此操作无法撤销。</Typography>
                </DialogContent>
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