// /var/www/nads/src/app/scenario/manage/instances/page.tsx
"use client";
import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import {
    Typography, Box, Paper, Button, TextField, InputAdornment, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Tooltip, TablePagination, TableSortLabel, CircularProgress, Alert, Chip
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Delete as DeleteIcon,
    Pause as PauseIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ScenarioInstance {
    instance_id: string;
    scenario_name: string;
    username: string;
    runtime: string;
    status: 'CREATING' | 'RUNNING' | 'FAILED' | 'STOPPED';
}

type Order = 'asc' | 'desc';
type SortableKeys = keyof Pick<ScenarioInstance, 'scenario_name' | 'username' | 'runtime' | 'status'>;

const statusColors: Record<ScenarioInstance['status'], 'success' | 'warning' | 'error' | 'default'> = {
    RUNNING: 'success',
    CREATING: 'warning',
    FAILED: 'error',
    STOPPED: 'default',
};

// 内联一个包装组件以在 Suspense 中使用 hooks
const ScenarioInstanceListPageContent: React.FC = () => {
    const searchParams = useSearchParams();
    const scenarioName = searchParams.get('name');

    const [instances, setInstances] = useState<ScenarioInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [order, setOrder] = useState<Order>('desc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('runtime');

    const fetchInstances = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/back/api/scenariosinstances');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: '获取场景实例列表失败' }));
                throw new Error(errorData.message);
            }
            const data: ScenarioInstance[] = await response.json();
            // 根据 URL 参数筛选
            const filteredData = scenarioName ? data.filter(inst => inst.scenario_name === scenarioName) : data;
            setInstances(filteredData);
        } catch (err: any) {
            setError(err.message || '发生未知错误');
            setInstances([]);
        } finally {
            setIsLoading(false);
        }
    }, [scenarioName]);

    useEffect(() => {
        fetchInstances();
    }, [fetchInstances]);

    const handleRefresh = () => {
        fetchInstances();
    };

    const handleDeleteInstance = async (instanceId: string, scenarioName: string) => {
        if (window.confirm(`您确定要永久删除场景实例 "${scenarioName}" (${instanceId}) 吗？此操作将删除所有关联的容器和资源，且无法撤销。`)) {
            setIsLoading(true);
            try {
                const response = await fetch(`/back/api/scenariosinstances/${instanceId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || `删除失败，状态码: ${response.status}`);
                }
                setInstances(prevInstances => prevInstances.filter(inst => inst.instance_id !== instanceId));
            } catch (err: any) {
                setError(err.message || '删除过程中发生错误');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handlePauseInstance = async (instanceId: string, scenarioName: string) => {
        if (window.confirm(`您确定要暂停场景实例 "${scenarioName}" (${instanceId}) 吗？这将拆卸相关资源。`)) {
            setIsLoading(true);
            try {
                const response = await fetch(`/back/api/scenariosinstances/${instanceId}/teardown`, {
                    method: 'POST',
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || `暂停失败，状态码: ${response.status}`);
                }
                fetchInstances();
            } catch (err: any) {
                setError(err.message || '暂停过程中发生错误');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedInstances = useMemo(() => {
        let filtered = instances.filter(inst =>
            (inst.username || '').toLowerCase().includes(searchText.toLowerCase())
        );
        filtered.sort((a, b) => {
            const valA = a[orderBy];
            const valB = b[orderBy];
            if (valB < valA) return order === 'asc' ? 1 : -1;
            if (valB > valA) return order === 'asc' ? -1 : 1;
            return 0;
        });
        return filtered;
    }, [instances, searchText, order, orderBy]);

    const paginatedInstances = filteredAndSortedInstances.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Button component={Link} href="/scenario/manage" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
                        返回场景管理
                    </Button>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                        场景实例: {scenarioName || '所有'}
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                    onClick={handleRefresh}
                    disabled={isLoading}
                >
                    {isLoading ? '加载中...' : '刷新'}
                </Button>
            </Box>

            <Paper elevation={2}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        fullWidth variant="outlined" placeholder="搜索启动用户..." value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),}}
                    />
                </Box>

                {error && <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>{error}</Alert>}

                <TableContainer>
                    <Table>
                        <TableHead>
                           <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                                <TableCell>实例 ID</TableCell>
                                <TableCell>
                                    <TableSortLabel active={orderBy === 'username'} direction={orderBy === 'username' ? order : 'asc'} onClick={() => handleRequestSort('username')}>
                                        启动用户
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={orderBy === 'runtime'} direction={orderBy === 'runtime' ? order : 'asc'} onClick={() => handleRequestSort('runtime')}>
                                        创建时间
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel active={orderBy === 'status'} direction={orderBy === 'status' ? order : 'asc'} onClick={() => handleRequestSort('status')}>
                                        状态
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="right">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading && instances.length === 0 ? (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 2 }}>正在加载实例列表...</Typography></TableCell></TableRow>
                            ) : paginatedInstances.length === 0 ? (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5 }}><Typography color="text.secondary">没有找到任何场景实例。</Typography></TableCell></TableRow>
                            ) : (
                                paginatedInstances.map((instance) => (
                                    <TableRow key={instance.instance_id} hover>
                                        <TableCell><Tooltip title={instance.instance_id}><code>{(instance.instance_id || '').substring(0, 8)}...</code></Tooltip></TableCell>
                                        <TableCell>{instance.username}</TableCell>
                                        <TableCell>{new Date(instance.runtime).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Chip label={instance.status} color={statusColors[instance.status]} size="small" />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="暂停场景">
                                                <IconButton color="warning" size="small" onClick={() => handlePauseInstance(instance.instance_id, instance.scenario_name)} disabled={isLoading || instance.status === 'STOPPED'}>
                                                    <PauseIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="删除场景">
                                                <IconButton color="error" size="small" onClick={() => handleDeleteInstance(instance.instance_id, instance.scenario_name)} disabled={isLoading}>
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

                <TablePagination
                    rowsPerPageOptions={[10, 25, 50]}
                    component="div"
                    count={filteredAndSortedInstances.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(_e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    labelRowsPerPage="每页行数:"
                />
            </Paper>
        </Paper>
    );
};


// 导出包含 Suspense 的主组件
const ScenarioInstanceManagementPage: React.FC = () => {
    return (
        <Suspense fallback={<CircularProgress />}>
            <ScenarioInstanceListPageContent />
        </Suspense>
    );
};


export default ScenarioInstanceManagementPage;