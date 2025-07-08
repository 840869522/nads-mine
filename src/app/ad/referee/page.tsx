"use client";

import React, { useState, useEffect, FormEvent } from 'react';

// (MUI 组件导入部分，新增了 Select, MenuItem, InputLabel)
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
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
import Select, {  SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// === 类型定义 (Type Definitions) ===

// 关联的用户信息 (假设后端API会返回)
interface User {
    id: number;
    user_name: string;
    email: string;
}

// 裁判级别
enum RefereeLevel {
    HEAD = 'Head',
    STANDARD = 'Standard',
    ASSISTANT = 'Assistant',
}

// 裁判数据结构，与 c_referees 表对应
interface Referee {
    c_id: number;
    c_user_id: number;
    c_real_name?: string;
    c_level: RefereeLevel;
    c_expertise?: string;
    c_contact_info?: string;
    create_at: string;
    update_at: string;
    // 关键：包含关联的用户信息用于展示
    user?: User;
}

// 裁判管理页面组件
const RefereeManagementPage: React.FC = () => {
    // === 状态管理 (State Management) ===
    const [referees, setReferees] = useState<Referee[]>([]);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]); // 用于创建裁判时选择用户
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string | { [key: string]: string[] } } | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingReferee, setEditingReferee] = useState<Referee | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [refereeToDelete, setRefereeToDelete] = useState<Referee | null>(null);

    // === 副作用 (Side Effects) ===
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 并行获取裁判列表和可用的用户列表
                const [refereesResponse, usersResponse] = await Promise.all([
                    fetch('/back/api/ad/referee'),
                    fetch('/back/api/ad/available-users') // 假设有此API
                ]);

                if (!refereesResponse.ok) throw new Error('获取裁判列表失败');
                const refereesResult = await refereesResponse.json();
                setReferees(refereesResult.data ?? []);

                if (!usersResponse.ok) throw new Error('获取可用用户列表失败');
                const usersResult = await usersResponse.json();
                setAvailableUsers(usersResult.data ?? []);

            } catch (err) {
                setStatusMessage({ type: 'error', message: (err as Error).message });
                setReferees([]);
                setAvailableUsers([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // === 事件处理器 (Event Handlers) ===
    const handleOpenForm = (referee?: Referee) => {
        setEditingReferee(referee || null);
        setIsFormOpen(true);
        setStatusMessage(null);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
    };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // 构建与后端 c_ 前缀匹配的数据对象
        const refereeData = {
            c_user_id: formData.get('user_id') as string,
            c_real_name: formData.get('real_name') as string,
            c_level: formData.get('level') as RefereeLevel,
            c_expertise: formData.get('expertise') as string,
            c_contact_info: formData.get('contact_info') as string,
        };

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            let response;
            const url = editingReferee
                ? `/back/api/ad/referee/${editingReferee.c_id}`
                : '/back/api/ad/referee';

            const method = editingReferee ? 'PUT' : 'POST';

            response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(refereeData),
            });

            const result = await response.json();

            if (!response.ok) {
                if (response.status === 422 && result.errors) throw new Error(JSON.stringify(result.errors));
                throw new Error(result.message || (editingReferee ? '更新裁判失败' : '创建裁判失败'));
            }

            // 刷新裁判和可用用户列表以保持数据同步
            // 这种方式最简单，也可以在前端手动更新 state
            const [refereesResponse, usersResponse] = await Promise.all([
                fetch('/back/api/ad/referee'),
                fetch('/back/api/ad/available-users')
            ]);
            const refereesResult = await refereesResponse.json();
            setReferees(refereesResult.data ?? []);
            const usersResult = await usersResponse.json();
            setAvailableUsers(usersResult.data ?? []);


            setStatusMessage({ type: 'success', message: result.message || `操作成功！` });
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

    const handleOpenConfirmDialog = (referee: Referee) => {
        setRefereeToDelete(referee);
        setIsConfirmOpen(true);
    };

    const handleCloseConfirmDialog = () => {
        setRefereeToDelete(null);
        setIsConfirmOpen(false);
    };

    const handleDeleteReferee = async () => {
        if (!refereeToDelete) return;
        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            const response = await fetch(`/back/api/ad/referee/${refereeToDelete.c_id}`, { method: 'DELETE' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '删除裁判失败' }));
                throw new Error(errorData.message);
            }

            // 从裁判列表中移除
            setReferees(prevReferees => prevReferees.filter(r => r.c_id !== refereeToDelete.c_id));
            // 将被删除的用户加回到可用用户列表中
            if (refereeToDelete.user) {
                setAvailableUsers(prevUsers => [...prevUsers, refereeToDelete.user!].sort((a,b) => a.user_name.localeCompare(b.user_name)));
            }

            setStatusMessage({ type: 'success', message: `裁判 "${refereeToDelete.user?.user_name}" 已被删除。` });
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
                    裁判管理
                </Typography>
                <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()}>
                    添加新裁判
                </Button>
            </Box>

            {statusMessage && (
                <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 3 }}>
                    {renderErrorMessage(statusMessage.message)}
                </Alert>
            )}

            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer>
                    <Table stickyHeader aria-label="referees table">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>用户名</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>真实姓名</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>裁判级别</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>负责领域</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>联系方式</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow>
                            ) : referees.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>当前没有裁判信息。</TableCell></TableRow>
                            ) : (
                                referees.map((referee) => (
                                    <TableRow hover key={referee.c_id}>
                                        <TableCell component="th" scope="row">
                                            <Typography fontWeight="medium">{referee.user?.user_name}</Typography>
                                            <Typography variant="body2" color="text.secondary">{referee.user?.email}</Typography>
                                        </TableCell>
                                        <TableCell>{referee.c_real_name || 'N/A'}</TableCell>
                                        <TableCell>{referee.c_level}</TableCell>
                                        <TableCell>{referee.c_expertise || 'N/A'}</TableCell>
                                        <TableCell>{referee.c_contact_info || 'N/A'}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="编辑裁判"><IconButton onClick={() => handleOpenForm(referee)} color="primary"><EditIcon /></IconButton></Tooltip>
                                            <Tooltip title="删除裁判"><IconButton onClick={() => handleOpenConfirmDialog(referee)} color="error"><DeleteIcon /></IconButton></Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* 创建/编辑裁判的对话框 */}
            <Dialog key={editingReferee?.c_id || 'new-referee-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="sm">
                <DialogTitle>{editingReferee ? '编辑裁判信息' : '添加新裁判'}</DialogTitle>
                <form onSubmit={handleFormSubmit}>
                    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
                        {/* 核心区别：创建时用下拉框选择用户，编辑时显示不可修改的用户名 */}
                        {editingReferee ? (
                            <TextField
                                label="用户名"
                                value={editingReferee.user?.user_name || ''}
                                disabled
                                fullWidth
                                variant="filled"
                            />
                        ) : (
                            <FormControl fullWidth required>
                                <InputLabel id="user-select-label">选择用户</InputLabel>
                                <Select
                                    labelId="user-select-label"
                                    id="user_id"
                                    name="user_id"
                                    label="选择用户"
                                    defaultValue=""
                                >
                                    {availableUsers.map(user => (
                                        <MenuItem key={user.id} value={user.id}>
                                            {user.user_name} ({user.email})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        <TextField name="real_name" label="真实姓名 (可选)" fullWidth variant="outlined" defaultValue={editingReferee?.c_real_name || ''} />

                        <FormControl fullWidth required>
                            <InputLabel id="level-select-label">裁判级别</InputLabel>
                            <Select
                                labelId="level-select-label"
                                name="level"
                                label="裁判级别"
                                defaultValue={editingReferee?.c_level || RefereeLevel.STANDARD}
                            >
                                <MenuItem value={RefereeLevel.HEAD}>主裁判 (Head)</MenuItem>
                                <MenuItem value={RefereeLevel.STANDARD}>标准裁判 (Standard)</MenuItem>
                                <MenuItem value={RefereeLevel.ASSISTANT}>助理裁判 (Assistant)</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField name="expertise" label="负责领域 (可选, 如 Web, Pwn)" fullWidth variant="outlined" defaultValue={editingReferee?.c_expertise || ''} />
                        <TextField name="contact_info" label="内部联系方式 (可选)" fullWidth variant="outlined" defaultValue={editingReferee?.c_contact_info || ''} />
                    </DialogContent>
                    <DialogActions sx={{ p: '0 24px 20px' }}>
                        <Button onClick={handleCloseForm} variant="outlined">取消</Button>
                        <Button type="submit" variant="contained" disabled={isSubmitting}>
                            {isSubmitting ? <CircularProgress size={24} /> : (editingReferee ? '保存更改' : '确认添加')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* 确认删除对话框 */}
            <Dialog open={isConfirmOpen} onClose={handleCloseConfirmDialog}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent>
                    <Typography>您确定要删除裁判 "{refereeToDelete?.user?.user_name}" 吗？该用户将恢复为普通用户身份。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseConfirmDialog} disabled={isSubmitting}>取消</Button>
                    <Button onClick={handleDeleteReferee} color="error" disabled={isSubmitting}>
                        {isSubmitting ? <CircularProgress size={24} /> : '确认删除'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RefereeManagementPage;