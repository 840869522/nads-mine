// src/app/scenario/sceneinstances/page.tsx
"use client";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Typography, Box, Paper, Button, TextField, InputAdornment, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Tooltip, TablePagination, TableSortLabel, CircularProgress, Alert, Chip
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Visibility as ViewIcon,
    StopCircle as StopIcon,
} from '@mui/icons-material';
// 关键改动：导入正确的 Dialog 组件
import InstanceDetailsDialog from './InstanceDetailsDialog';

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

const ScenarioInstanceManagementPage: React.FC = () => {
    const [instances, setInstances] = useState<ScenarioInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [order, setOrder] = useState<Order>('desc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('runtime');

    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    // 新增 state 用于存储场景名称
    const [selectedScenarioName, setSelectedScenarioName] = useState<string>('');

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
            setInstances(data);
        } catch (err: any) {
            setError(err.message || '发生未知错误');
            setInstances([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInstances();
    }, [fetchInstances]);

    const handleRefresh = () => {
        fetchInstances();
    };

    // 关键改动：传递整个 instance 对象
    const handleViewDetails = (instance: ScenarioInstance) => {
        setSelectedInstanceId(instance.instance_id);
        setSelectedScenarioName(instance.scenario_name); // 保存场景名称
        setIsDetailsModalOpen(true);
    };

    const handleStopInstance = (instanceId: string) => {
        if (window.confirm(`您确定要停止实例 ${instanceId} 吗？所有容器将被删除。`)) {
            alert(`功能待开发：停止并清理实例 ${instanceId}。`);
        }
    };

    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedInstances = useMemo(() => {
        let filtered = instances.filter(inst =>
            (inst.scenario_name || '').toLowerCase().includes(searchText.toLowerCase()) ||
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
                <Typography variant="h4" component="h1" fontWeight="bold">
                    场景实例管理
                </Typography>
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
                        fullWidth variant="outlined" placeholder="搜索场景名称或启动用户..." value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),}}
                    />
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                           <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                                <TableCell>实例 ID</TableCell>
                                <TableCell>
                                    <TableSortLabel active={orderBy === 'scenario_name'} direction={orderBy === 'scenario_name' ? order : 'asc'} onClick={() => handleRequestSort('scenario_name')}>
                                        场景名称
                                    </TableSortLabel>
                                </TableCell>
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
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 2 }}>正在加载实例列表...</Typography></TableCell></TableRow>
                            ) : error ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><Alert severity="error">{error}</Alert></TableCell></TableRow>
                            ) : paginatedInstances.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><Typography color="text.secondary">没有找到任何场景实例。</Typography></TableCell></TableRow>
                            ) : (
                                paginatedInstances.map((instance) => (
                                    <TableRow key={instance.instance_id} hover>
                                        <TableCell><Tooltip title={instance.instance_id}><code>{(instance.instance_id || '').substring(0, 8)}...</code></Tooltip></TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>{instance.scenario_name}</TableCell>
                                        <TableCell>{instance.username}</TableCell>
                                        <TableCell>{new Date(instance.runtime).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Chip label={instance.status} color={statusColors[instance.status]} size="small" />
                                        </TableCell>
                                        <TableCell align="right">
                                            {/* 关键改动：传递整个 instance 对象 */}
                                            <Tooltip title="查看详情"><IconButton color="primary" size="small" onClick={() => handleViewDetails(instance)}><ViewIcon /></IconButton></Tooltip>
                                            <Tooltip title="停止场景"><IconButton color="error" size="small" onClick={() => handleStopInstance(instance.instance_id)}><StopIcon /></IconButton></Tooltip>
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
            
            {/* 关键改动：传递 scenarioName prop */}
            {isDetailsModalOpen && selectedInstanceId && (
                <InstanceDetailsDialog
                    open={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    instanceId={selectedInstanceId}
                    scenarioName={selectedScenarioName} 
                />
            )}
        </Paper>
    );
};

export default ScenarioInstanceManagementPage;