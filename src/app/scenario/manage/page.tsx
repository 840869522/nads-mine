// /var/www/nads/src/app/scenario/manage/page.tsx
"use client";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Typography, Box, Paper, Button, TextField, InputAdornment, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Tooltip, TablePagination, TableSortLabel, CircularProgress, Alert,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Delete as DeleteIcon,
    PlayCircleOutline as StartIcon,
    Edit as EditIcon,
    Add as AddIcon,
    PeopleAlt as PermissionIcon,
    Visibility as ViewInstancesIcon // <-- 新增图标
} from '@mui/icons-material';
import Link from 'next/link'; // <-- 新增导入
import ScenarioCreateDialog from './ScenarioCreateDialog';
import ScenarioEditDialog from './ScenarioEditDialog';
import ScenarioPermissionDialog  from './ScenarioPermissionDialog'
import {TopologyData} from "@/types.ts";
import { useAuth } from '@/hooks/useAuth';
import { customFetch } from '@/utils/fetch';


// 定义场景的数据结构
export interface Scenario {
    id: string; // 文件名将作为ID
    name: string;
    description: string;
    uploadDate: string;
    nodeCount: number;
    topology_json: TopologyData;
}


type Order = 'asc' | 'desc';
type SortableKeys = keyof Pick<Scenario, 'name' | 'description' | 'uploadDate' | 'nodeCount'>;

const ScenarioManagementPage: React.FC = () => {
    const { user } = useAuth();
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [order, setOrder] = useState<Order>('desc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('uploadDate');
    const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [permissionScenario, setPermissionScenario] = useState<Scenario | null>(null);
    const [startingScenarioId, setStartingScenarioId] = useState<string | null>(null); // 1. 新增状态



    const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);

    const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
    const fetchScenarios = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await customFetch('/back/api/scenarios');
            if (!response.ok) {
                throw new Error('获取场景列表失败');
            }
            const data: Scenario[] = await response.json();
            setScenarios(data);
        } catch (err: any) {
            setError(err.message || '发生未知错误');
            setScenarios([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleOpenPermissionDialog = (scenario: Scenario) => {
        setPermissionScenario(scenario);
    };
    useEffect(() => {
        fetchScenarios();
    }, [fetchScenarios]);

    // 这个函数会作为 prop (属性) 传递给 ScenarioEditorDialog 组件。当弹窗内部完成保存操作后，会调用这个函数，执行两个关键操作：关闭弹窗和刷新数据。
    // 更新 handleSaveSuccess 以便它可以同时处理创建和编辑成功后的逻辑
    const handleSaveSuccess = () => {
        setCreateDialogOpen(false); // 关闭创建弹窗
        setEditingScenario(null);   // 关闭编辑弹窗
        setPermissionScenario(null); // 关闭权限弹窗
        fetchScenarios();           // 统一刷新列表
    };
    const handleRefresh = () => {
        fetchScenarios();
    };

    // 2. 新增处理删除相关的函数
    const handleOpenDeleteDialog = (scenario: Scenario) => {
        setDeleteTarget(scenario);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteTarget(null);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        setIsDeleting(true);
        setError(null);
        try {
            // 向后端API发送DELETE请求，通过查询参数传递ID
            const response = await customFetch(`/back/api/scenarios?id=${deleteTarget.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '删除失败');
            }

            // 删除成功后，刷新列表
            await fetchScenarios();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsDeleting(false);
            handleCloseDeleteDialog(); // 关闭弹窗
        }
    };
    // 启动场景
    const handleStartDrill = async (scenario: Scenario) => {
        // 1. 从 useAuth Hook 获取用户名
        const username = user.user.c_username;

        if (!username) {
            alert('无法获取当前用户名，请确保您已登录。');
            return;
        }

        if (!window.confirm(`您确定要启动场景 “${scenario.name}” 的演练吗？`)) {
            return;
        }

        setStartingScenarioId(scenario.id); // 2. 设置加载状态
        setError(null);

        try {
            const response = await customFetch(`/back/api/scenarios/${scenario.id}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                // 2. 在请求体中附加上用户名
                body: JSON.stringify({ username: username }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '启动失败');
            }

            alert(result.message);
            fetchScenarios(); // 4. 成功后刷新数据

        } catch (err: any) {
            setError(err.message || '发生未知网络错误');
            alert(`启动失败: ${err.message}`);
        } finally {
            setStartingScenarioId(null); // 3. 结束加载状态
        }
    };

    // 新增一个临时的编辑处理函数
    const handleEditScenario = (scenario: Scenario) => {
        setEditingScenario(scenario);
    };

    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedScenarios = useMemo(() => {
        let filtered = scenarios.filter(s =>
            s.name.toLowerCase().includes(searchText.toLowerCase()) ||
            s.description.toLowerCase().includes(searchText.toLowerCase())
        );
        filtered.sort((a, b) => {
            const valA = a[orderBy];
            const valB = b[orderBy];
            if (valB < valA) return order === 'asc' ? 1 : -1;
            if (valB > valA) return order === 'asc' ? -1 : 1;
            return 0;
        });
        return filtered;
    }, [scenarios, searchText, order, orderBy]);

    const paginatedScenarios = filteredAndSortedScenarios.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    场景管理
                </Typography>
                {/* 将两个按钮放在一个flex容器中，用gap设置间距 */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                        onClick={handleRefresh}
                        disabled={isLoading}
                    >
                        {isLoading ? '加载中...' : '刷新'}
                    </Button>

                    {/* 打开弹窗的按钮 (JSX)用户需要一个交互元素（比如按钮）来触发弹窗的显示。*/}
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        // 这是关键。当用户点击此按钮时，它会调用 setCreateDialogOpen(true)，将状态设置为 true，从而触发展示弹窗的逻辑。
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        创建场景
                    </Button>
                </Box>
            </Box>

            <Paper elevation={2}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        fullWidth variant="outlined" placeholder="搜索场景..." value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),}}
                    />
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sortDirection={orderBy === 'name' ? order : false}>
                                    <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleRequestSort('name')}>场景名称</TableSortLabel>
                                </TableCell>
                                <TableCell sortDirection={orderBy === 'description' ? order : false}>
                                    <TableSortLabel active={orderBy === 'description'} direction={orderBy === 'description' ? order : 'asc'} onClick={() => handleRequestSort('description')}>描述</TableSortLabel>
                                </TableCell>
                                <TableCell sortDirection={orderBy === 'uploadDate' ? order : false}>
                                    <TableSortLabel active={orderBy === 'uploadDate'} direction={orderBy === 'uploadDate' ? order : 'asc'} onClick={() => handleRequestSort('uploadDate')}>上传日期</TableSortLabel>
                                </TableCell>
                                <TableCell align="right">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 2 }} color="text.secondary">正在加载场景列表...</Typography></TableCell></TableRow>
                            ) : error ? (
                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}><Alert severity="error">{error}</Alert></TableCell></TableRow>
                            ) : paginatedScenarios.length === 0 ? (
                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}><Typography color="text.secondary">{searchText ? "没有找到匹配的场景。" : "没有可用的场景。"}</Typography></TableCell></TableRow>
                            ) : (
                                paginatedScenarios.map((scenario) => (
                                    <TableRow key={scenario.id} hover>
                                        <TableCell sx={{ fontWeight: 'medium' }}>{scenario.name}</TableCell>
                                        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <Tooltip title={scenario.description} placement="top-start"><span>{scenario.description}</span></Tooltip>
                                        </TableCell>
                                        <TableCell>{new Date(scenario.uploadDate).toLocaleDateString()}</TableCell>
                                        <TableCell align="right">
                                            {/* --- MODIFICATION START --- */}
                                            <Tooltip title="查看实例">
                                                <IconButton
                                                    component={Link}
                                                    href={`/scenario/manage/instances?name=${encodeURIComponent(scenario.name)}`}
                                                    color="info"
                                                    size="small"
                                                >
                                                    <ViewInstancesIcon />
                                                </IconButton>
                                            </Tooltip>
                                            {/* --- MODIFICATION END --- */}
                                            <Tooltip title="启动演练">
                                                {/* 3. 更新按钮，根据状态显示加载动画或图标 */}
                                                <span>
                                                    <IconButton
                                                        color="success"
                                                        size="small"
                                                        onClick={() => handleStartDrill(scenario)}
                                                        disabled={startingScenarioId === scenario.id}
                                                    >
                                                        {startingScenarioId === scenario.id ? <CircularProgress size={20} color="inherit" /> : <StartIcon />}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="权限管理">
                                                {/* 4. 更新 onClick 事件以打开新弹窗 */}
                                                <IconButton color="default" size="small" onClick={() => handleOpenPermissionDialog(scenario)}>
                                                    <PermissionIcon />
                                                </IconButton>
                                            </Tooltip>
                                            {/* 3. 更新删除按钮的 onClick 事件 */}
                                            <Tooltip title="删除场景"><IconButton color="error" size="small" onClick={() => handleOpenDeleteDialog(scenario)}><DeleteIcon /></IconButton></Tooltip>
                                            <Tooltip title="编辑场景">
                                                <IconButton color="primary" size="small" onClick={() => handleEditScenario(scenario)}>
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={filteredAndSortedScenarios.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    labelRowsPerPage="每页行数:"
                />
            </Paper>

            {/* 4. 添加删除确认弹窗 */}
            <Dialog
                open={!!deleteTarget}
                onClose={handleCloseDeleteDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    确认删除场景
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        您确定要永久删除场景 “{deleteTarget?.name}” 吗？此操作无法撤销。
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog} disabled={isDeleting}>取消</Button>
                    <Button onClick={handleConfirmDelete} color="error" disabled={isDeleting} autoFocus>
                        {isDeleting ? <CircularProgress size={20} /> : '确认删除'}
                    </Button>
                </DialogActions>
            </Dialog>
            <ScenarioCreateDialog
                open={isCreateDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onSaveSuccess={handleSaveSuccess}
            />
            {/* 4. 在JSX中渲染弹窗: 并将所有需要的 props 传递给它 */}
            <ScenarioEditDialog
                open={!!editingScenario}
                onClose={() => setEditingScenario(null)}
                onSaveSuccess={handleSaveSuccess}
                scenario={editingScenario}
            />
            <ScenarioPermissionDialog
                open={!!permissionScenario}
                onClose={() => setPermissionScenario(null)}
                onSaveSuccess={handleSaveSuccess}
                scenario={permissionScenario}
            />
        </Paper>
    );
};

export default ScenarioManagementPage;