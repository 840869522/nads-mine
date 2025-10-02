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
    ArrowBack as ArrowBackIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { customFetch } from '@/utils/fetch';
// [MODIFICATION] 导入详情对话框组件
import InstanceDetailsDialog from '../../sceneinstances/InstanceDetailsDialog';

interface ScenarioInstance {
    instance_id: string;
    scenario_name: string;
    username: string;
    runtime: string;
    status: 'CREATING' | 'RUNNING' | 'FAILED' | 'STOPPED';
    test_id?: string; // 新增：测试ID字段
}

type Order = 'asc' | 'desc';
type SortableKeys = keyof Pick<ScenarioInstance, 'scenario_name' | 'username' | 'runtime' | 'status'>;

const statusColors: Record<ScenarioInstance['status'], 'success' | 'warning' | 'error' | 'default'> = {
    RUNNING: 'success',
    CREATING: 'warning',
    FAILED: 'error',
    STOPPED: 'default',
};

interface ScenarioInstanceManagementPageProps {
  username: string;
  scenarioName: string;
  testId?: string; // 新增：测试ID
  onBack: () => void;
}

const ScenarioInstanceManagementPage: React.FC<ScenarioInstanceManagementPageProps> = ({ username, scenarioName, testId, onBack }) => {
    const [instances, setInstances] = useState<ScenarioInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [order, setOrder] = useState<Order>('desc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('runtime');
    
    // [MODIFICATION] 新增状态用于控制详情弹窗
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [selectedScenarioName, setSelectedScenarioName] = useState<string>('');

   const fetchInstances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        // 修改：根据是否有testId选择不同的API
        let url = '/back/api/study/test/index';
        if (testId) {
            url = `/back/api/study/test/index?test_id=${testId}`;
        }
        
        const response = await customFetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '获取场景实例列表失败' }));
            throw new Error(errorData.message);
        }
        
        const result = await response.json();
        
        // 修改：处理新的返回格式
        if (result.code !== 200) {
            throw new Error(result.message || '获取场景实例失败');
        }
        
        let data: ScenarioInstance[] = [];
        if (Array.isArray(result.data)) {
            data = result.data;
        } else if (result.data && typeof result.data === 'object') {
            // 如果是单个对象，转换为数组
            data = [result.data];
        }
        
        // 根据场景名称过滤
        const filteredData = scenarioName ? data.filter(inst => inst.scenario_name === scenarioName) : data;
        setInstances(filteredData);
    } catch (err: any) {
        setError(err.message || '发生未知错误');
        setInstances([]);
    } finally {
        setIsLoading(false);
    }
}, [username, scenarioName, testId]);

    useEffect(() => {
        fetchInstances();
    }, [fetchInstances]);

    const handleRefresh = () => {
        fetchInstances();
    };
    
    // [MODIFICATION] 新增查看详情的处理函数
    const handleViewDetails = (instance: ScenarioInstance) => {
        setSelectedInstanceId(instance.instance_id);
        setSelectedScenarioName(instance.scenario_name);
        setIsDetailsModalOpen(true);
    };

    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedInstances = useMemo(() => {
        let filtered = instances.filter(inst =>
            (inst.username || '').toLowerCase().includes(searchText.toLowerCase()) ||
            (inst.scenario_name || '').toLowerCase().includes(searchText.toLowerCase())
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
                    <Button startIcon={<ArrowBackIcon />} sx={{ mb: 1 }} onClick={onBack}>
                        返回场景管理
                    </Button>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                        场景: {scenarioName || '所有'} {testId && `(测试ID: ${testId})`}
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
                        fullWidth variant="outlined" placeholder="搜索场景名称或用户..." value={searchText}
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
                                <TableCell>场景名称</TableCell>
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
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress /><Typography sx={{ mt: 2 }}>正在加载实例列表...</Typography></TableCell></TableRow>
                            ) : paginatedInstances.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><Typography color="text.secondary">没有找到任何场景实例。</Typography></TableCell></TableRow>
                            ) : (
                                paginatedInstances.map((instance) => (
                                    <TableRow key={instance.instance_id} hover>
                                        <TableCell><Tooltip title={instance.instance_id}><code>{(instance.instance_id || '').substring(0, 8)}...</code></Tooltip></TableCell>
                                        <TableCell>{instance.scenario_name}</TableCell>
                                        <TableCell>{instance.username}</TableCell>
                                        <TableCell>{new Date(instance.runtime).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Chip label={instance.status} color={statusColors[instance.status]} size="small" />
                                        </TableCell>
                                        <TableCell align="right">
                                            {/* [MODIFICATION] 添加查看详情按钮 */}
                                            {instance.status !== 'STOPPED' && (
                                                <Tooltip title="查看详情">
                                                    <IconButton color="primary" size="small" onClick={() => handleViewDetails(instance)}>
                                                        <ViewIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
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
            
            {/* [MODIFICATION] 添加详情对话框的渲染逻辑 */}
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