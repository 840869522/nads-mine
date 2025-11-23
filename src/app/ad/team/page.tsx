"use client";

import React, { useState, useEffect, useCallback, FormEvent, MouseEvent } from 'react';
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
import Autocomplete from '@mui/material/Autocomplete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import { customFetch } from "@/utils/fetch"

// 导入新创建的组件
import InstanceDetailsDialog from './InstanceDetailsDialog';

// 假设 useDebounce.ts 路径正确
import { useDebounce } from '@/app/hooks/useDebounce';

// === 自定义类型 ===
interface User {
    u_id: string;
    u_name?: string;
}

interface Team {
    c_id: number;
    c_name: string;
    c_description?: string;
    score?: number;
    members?: User[];
}

interface TeamDrill {
    c_id: string;
    c_drill_name: string;
    c_status: 'pending' | 'running' | 'finished' | 'archived';
    c_scene_instance_id: string | null;
    scene_config: {
        c_name: string;
    } | null;
    pivot?: {
        c_role: string;
    }
}

interface InstanceDetails {
    instance_id: string;
    scenario_name: string;
    status: string;
    resources: {
        vms: any[];
        containers: any[];
        switches: any[];
    };
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
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalTeams, setTotalTeams] = useState(0);
    const API_BASE_URL = '/back/api';

    // 演练弹窗状态
    const [isDrillsDialogOpen, setIsDrillsDialogOpen] = useState(false);
    const [selectedTeamForDrills, setSelectedTeamForDrills] = useState<Team | null>(null);
    const [teamDrills, setTeamDrills] = useState<TeamDrill[]>([]);
    const [isDrillsLoading, setIsDrillsLoading] = useState(false);

    // 实例资源详情弹窗状态
    const [isInstanceDetailsOpen, setIsInstanceDetailsOpen] = useState(false);
    const [isInstanceDetailsLoading, setIsInstanceDetailsLoading] = useState(false);
    const [selectedInstanceDetails, setSelectedInstanceDetails] = useState<InstanceDetails | null>(null);
    const [instanceDetailsError, setInstanceDetailsError] = useState<string | null>(null);

    const fetchTeams = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            const params = new URLSearchParams();
            params.append('page', String(page + 1));
            params.append('per_page', String(rowsPerPage));
            if (debouncedSearchQuery) {
                params.append('search', debouncedSearchQuery);
            }
            const urlString = `${API_BASE_URL}/ad/team?${params.toString()}`;
            const response = await customFetch(urlString);
            if (!response.ok) throw new Error('从服务器获取队伍列表失败');

            const result = await response.json();
            const rawTeams = result.data ?? [];
            setTotalTeams(result.total ?? 0);

            const formattedTeams: Team[] = rawTeams.map((team: any) => ({
                c_id: team.c_id,
                c_name: team.c_name,
                c_description: team.c_description,
                score: team.score,
                members: team.users?.map((user: any) => ({
                    u_id: user.c_username,
                    u_name: user.c_name
                })) || [],
            }));
            setTeams(formattedTeams);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
            setTeams([]);
            setTotalTeams(0);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery, page, rowsPerPage]);

    const fetchUsers = async () => {
        if (allUsers.length > 0) {
            return;
        }

        setIsUsersLoading(true);
        try {
            // 保持之前的修复：添加 ?page=-1 参数以请求所有用户数据
            const response = await customFetch(`${API_BASE_URL}/ad/users?page=-1`);
            if (!response.ok) {
                throw new Error('获取用户列表失败');
            }
            const result = await response.json();

            const userList = result.data?.data || [];

            if (Array.isArray(userList)) {
                const formattedUsers: User[] = userList.map((user: any) => ({
                    u_id: user.c_username,
                    u_name: user.c_name
                }));
                setAllUsers(formattedUsers);
            } else {
                throw new Error('返回的用户数据格式不正确');
            }
        } catch (err) {
            setStatusMessage({ type: 'error', message: `无法加载用户列表: ${(err as Error).message}` });
            setAllUsers([]);
        } finally {
            setIsUsersLoading(false);
        }
    };

    useEffect(() => { fetchTeams(); }, [fetchTeams]);
    useEffect(() => { setPage(0); }, [debouncedSearchQuery]);

    const handleOpenForm = (team?: Team) => {
        fetchUsers();
        setEditingTeam(team || null);
        setSelectedMemberIds(team?.members?.map(member => member.u_id) || []);
        setIsFormOpen(true);
        setStatusMessage(null);
    };
    const handleCloseForm = () => { setIsFormOpen(false); setEditingTeam(null); setSelectedMemberIds([]); };

    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const teamData = {
            c_name: formData.get('name') as string,
            c_description: formData.get('description') as string,
            users: selectedMemberIds,
        };

        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            const url = editingTeam ? `${API_BASE_URL}/ad/team/${editingTeam.c_id}` : `${API_BASE_URL}/ad/team`;
            const method = editingTeam ? 'PUT' : 'POST';
            const response = await customFetch(url, { method, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(teamData) });
            const result = await response.json();
            if (!response.ok) {
                if (response.status === 422 && result.errors) throw new Error(JSON.stringify(result.errors));
                throw new Error(result.message || '操作失败');
            }
            setStatusMessage({ type: 'success', message: result.message || '操作成功！' });
            handleCloseForm();
            await fetchTeams();
        } catch (error) {
            let errorMessage: string | { [key: string]: string[] } = (error as Error).message;
            try { errorMessage = JSON.parse(errorMessage); } catch (e) { /* is string */ }
            setStatusMessage({ type: 'error', message: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderErrorMessage = (message: string | { [key: string]: string[] }) => {
        if (typeof message === 'string') return message;
        return <ul style={{ paddingLeft: '20px', margin: 0 }}>{Object.values(message).flat().map((msg, index) => <li key={index}>{msg}</li>)}</ul>;
    };
    const handleOpenConfirmDialog = (team: Team) => { setTeamToDelete(team); setIsConfirmOpen(true); };
    const handleCloseConfirmDialog = () => { setTeamToDelete(null); setIsConfirmOpen(false); };
    const handleDeleteTeam = async () => {
        if (!teamToDelete) return;
        setIsSubmitting(true);
        setStatusMessage(null);
        try {
            const response = await customFetch(`${API_BASE_URL}/ad/team/${teamToDelete.c_id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } });
            if (!response.ok) { const result = await response.json(); throw new Error(result.message || '删除队伍失败'); }
            setStatusMessage({ type: 'success', message: '删除成功！' });
            await fetchTeams();
        } catch (error) {
            setStatusMessage({ type: 'error', message: (error as Error).message });
        } finally {
            setIsSubmitting(false);
            handleCloseConfirmDialog();
        }
    };
    const handleChangePage = (event: MouseEvent<HTMLButtonElement> | null, newPage: number) => { setPage(newPage); };
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

    const handleOpenDrillsDialog = async (team: Team) => {
        setSelectedTeamForDrills(team);
        setIsDrillsDialogOpen(true);
        setIsDrillsLoading(true);
        setTeamDrills([]);
        try {
            const response = await customFetch(`${API_BASE_URL}/ad/team/${team.c_id}/drills`);
            if (!response.ok) {
                throw new Error('获取演练列表失败');
            }
            const result = await response.json();
            if (result.status === 'success') {
                setTeamDrills(result.data);
            } else {
                throw new Error(result.message || '未能加载数据');
            }
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsDrillsLoading(false);
        }
    };

    const handleCloseDrillsDialog = () => {
        setIsDrillsDialogOpen(false);
        setSelectedTeamForDrills(null);
        setTeamDrills([]);
    };

    const handleOpenInstanceDetailsDialog = async (instanceId: string) => {
        setIsInstanceDetailsOpen(true);
        setIsInstanceDetailsLoading(true);
        setInstanceDetailsError(null);
        setSelectedInstanceDetails(null);

        try {
            const response = await customFetch(`${API_BASE_URL}/scenariosinstances/${instanceId}/details`);
            const result = await response.json();
            if (!response.ok || result.status !== 'success') {
                throw new Error(result.message || '获取实例资源失败');
            }
            setSelectedInstanceDetails(result.data);
        } catch (err) {
            setInstanceDetailsError((err as Error).message);
        } finally {
            setIsInstanceDetailsLoading(false);
        }
    };

    const handleCloseInstanceDetailsDialog = () => {
        setIsInstanceDetailsOpen(false);
    };

    return (
        <Box sx={{ p: 3, maxWidth: '1200px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Typography variant="h4" component="h1" fontWeight="bold">队伍管理</Typography>
                    <TextField variant="outlined" size="small" placeholder="搜索队伍名称或描述..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>) }} sx={{ minWidth: '300px' }} />
                </Box>
                <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => handleOpenForm()}>创建新队伍</Button>
            </Box>

            {statusMessage && <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 3, wordBreak: 'break-word' }}>{renderErrorMessage(statusMessage.message)}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>队伍名称</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', minWidth: '200px' }}>成员列表</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>当前得分</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>描述</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 1 }}>正在加载队伍数据...</Typography></TableCell></TableRow>
                            ) : teams.length === 0 ? (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5 }}><Typography color="text.secondary">{debouncedSearchQuery ? '未找到匹配的队伍。' : '当前没有队伍，请创建新队伍。'}</Typography></TableCell></TableRow>
                            ) : (
                                teams.map((team) => (
                                    <TableRow hover key={team.c_id}>
                                        <TableCell>{team.c_name}</TableCell>
                                        <TableCell>
                                            {team.members && team.members.length > 0 ? (
                                                <Tooltip title={team.members.map(m => m.u_name ? `${m.u_id}(${m.u_name})` : m.u_id).join(', ')}>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                                                        {team.members.map(member => (
                                                            <Chip key={member.u_id} label={member.u_name ? `${member.u_id}(${member.u_name})` : member.u_id} size="small" variant="outlined" />
                                                        ))}
                                                    </Box>
                                                </Tooltip>
                                            ) : (
                                                <Typography variant="body2" color="text.disabled">暂无成员</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="center">{team.score ?? 0}</TableCell>
                                        <TableCell><Tooltip title={team.c_description || ''}><Typography noWrap sx={{ maxWidth: '200px', color: team.c_description ? 'inherit' : 'text.disabled' }}>{team.c_description || '暂无描述'}</Typography></Tooltip></TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="查看参与的演练">
                                                <IconButton onClick={() => handleOpenDrillsDialog(team)} color="info">
                                                    <FindInPageIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="编辑队伍"><IconButton onClick={() => handleOpenForm(team)} color="primary"><EditIcon /></IconButton></Tooltip>
                                            <Tooltip title="删除队伍"><IconButton onClick={() => handleOpenConfirmDialog(team)} color="error"><DeleteIcon /></IconButton></Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component="div"
                    count={totalTeams}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    labelRowsPerPage="每页行数:"
                    labelDisplayedRows={({ from, to, count }) => `第 ${from} 到 ${to} 条，共 ${count} 条`}
                />
            </Paper>

            <Dialog key={editingTeam?.c_id || 'new-team-form'} open={isFormOpen} onClose={handleCloseForm} fullWidth maxWidth="sm">
                <DialogTitle>{editingTeam ? '编辑队伍' : '创建新队伍'}</DialogTitle>
                <form onSubmit={handleFormSubmit}>
                    <DialogContent>
                        {statusMessage && statusMessage.type === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{renderErrorMessage(statusMessage.message)}</Alert>}
                        <TextField autoFocus margin="dense" id="name" name="name" label="队伍名称" type="text" fullWidth variant="outlined" defaultValue={editingTeam?.c_name || ''} required />
                        <Autocomplete
                            multiple
                            id="team-members"
                            options={allUsers}
                            getOptionLabel={(option) => option.u_name ? `${option.u_id}(${option.u_name})` : option.u_id}
                            value={allUsers.filter(user => selectedMemberIds.includes(user.u_id))}
                            onChange={(_, newValue) => { setSelectedMemberIds(newValue.map(user => user.u_id)); }}
                            isOptionEqualToValue={(option, value) => option.u_id === value.u_id}
                            loading={isUsersLoading}
                            noOptionsText="没有可用选项"
                            // === 修改点：设置 ListboxProps 以限制高度并开启滚动 ===
                            ListboxProps={{
                                style: {
                                    maxHeight: 250, // 限制下拉列表最大高度
                                    overflow: 'auto' // 内容超出时显示滚动条
                                }
                            }}
                            renderInput={(params) => (
                                <TextField {...params} variant="outlined" label="添加队员 (可选)" placeholder="搜索并选择用户..."
                                           InputProps={{ ...params.InputProps, endAdornment: (<>{isUsersLoading ? <CircularProgress color="inherit" size={20} /> : null}{params.InputProps.endAdornment}</>), }}
                                />
                            )}
                            sx={{ mt: 2 }}
                        />
                        <TextField margin="dense" id="description" name="description" label="队伍描述 (可选)" type="text" fullWidth multiline rows={3} variant="outlined" defaultValue={editingTeam?.c_description || ''} sx={{ mt: 2 }} />
                    </DialogContent>
                    <DialogActions sx={{ p: 'o 24px 20px' }}>
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
                    <Button onClick={handleDeleteTeam} color="error" disabled={isSubmitting}>{isSubmitting ? <CircularProgress size={24} /> : '确认删除'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={isDrillsDialogOpen} onClose={handleCloseDrillsDialog} fullWidth maxWidth="lg">
                <DialogTitle>队伍 "{selectedTeamForDrills?.c_name}" 参与的演练</DialogTitle>
                <DialogContent dividers>
                    {isDrillsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                    ) : teamDrills.length > 0 ? (
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>演练名称</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>状态</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>担任角色</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>场景模板</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>操作</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {teamDrills.map((drill) => (
                                    <TableRow hover key={drill.c_id}>
                                        <TableCell>{drill.c_drill_name}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={drill.c_status === 'running' ? '进行中' : (drill.c_status === 'finished' ? '已结束' : '未开始')}
                                                color={drill.c_status === 'running' ? 'success' : (drill.c_status === 'finished' ? 'primary' : 'default')}
                                                size="small"
                                            />
                                        </TableCell>
                                        {/* MODIFIED: 角色显示逻辑更新 */}
                                        <TableCell>
                                            <Chip
                                                label={drill.pivot?.c_role || '参赛方'}
                                                color="primary"
                                                variant="outlined"
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {drill.scene_config?.c_name || (
                                                <Typography variant="body2" color="text.disabled">
                                                    未关联场景
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={drill.c_status !== 'running' ? "只有进行中的演练才能查看实例资源" : "查看实例资源"}>
                                                <span>
                                                    <IconButton
                                                        color="secondary"
                                                        onClick={() => handleOpenInstanceDetailsDialog(drill.c_scene_instance_id!)}
                                                        disabled={!drill.c_scene_instance_id || drill.c_status !== 'running'}
                                                    >
                                                        <VisibilityIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Typography sx={{ p: 4, textAlign: 'center' }} color="text.secondary">该队伍未参与任何演练。</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDrillsDialog}>关闭</Button>
                </DialogActions>
            </Dialog>

            <InstanceDetailsDialog
                open={isInstanceDetailsOpen}
                onClose={handleCloseInstanceDetailsDialog}
                isLoading={isInstanceDetailsLoading}
                details={selectedInstanceDetails}
                error={instanceDetailsError}
            />
        </Box>
    );
};

export default Page;