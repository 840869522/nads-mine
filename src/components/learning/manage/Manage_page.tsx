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
    PlayCircleOutline as StartIcon,
    Visibility as ViewInstancesIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import moment from 'moment';
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

interface ScenarioManagementPageProps {
  testId?: string; // 新增：可选的 testId，用于获取关联场景
  username: string; // 新增：用户名
  onBack: () => void; // 新增：返回回调
  onViewInstances: (name: string) => void; // 新增：查看实例回调
}

const ScenarioManagementPage: React.FC<ScenarioManagementPageProps> = ({ testId, username, onBack, onViewInstances }) => {
    const { user } = useAuth();
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [order, setOrder] = useState<Order>('desc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('uploadDate');
    const [startingScenarioId, setStartingScenarioId] = useState<string | null>(null);

 const fetchScenarios = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        let response;
        if (testId) {
            response = await customFetch(`/back/api/study/test/getScenarioByTestId/${testId}`);
        } else {
            response = await customFetch('/back/api/scenarios');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '获取场景列表失败' }));
            throw new Error(errorData.message || '获取场景列表失败');
        }
        const result = await response.json();
        console.log('Fetched scenarios response:', result); // 调试日志

        // 假设后端返回格式为 { code, message, data }
        if (result.code !== 200) { // 使用硬编码 200 替代 GlobalResponse.HTTP_STATUS_OK_CODE
            throw new Error(result.message || '后端返回错误状态');
        }

        const data = result.data;
        if (!data) {
            throw new Error('后端返回数据为空');
        }

        // 确保数据是数组，并过滤掉无效项
        const scenariosData = (Array.isArray(data) ? data : [data]).filter(
            (item): item is Scenario => item && typeof item === 'object' && 'name' in item && 'id' in item
        );

        if (scenariosData.length === 0) {
            console.warn('没有有效的场景数据');
            setError('没有找到与测试ID关联的场景数据');
        }

        setScenarios(scenariosData);
    } catch (err: any) {
        console.error('Fetch scenarios error:', err);
        setError(err.message || '发生未知错误');
        setScenarios([]);
    } finally {
        setIsLoading(false);
    }
}, [testId]);

    useEffect(() => {
        fetchScenarios();
    }, [fetchScenarios]);

    // 更新 handleSaveSuccess
    const handleSaveSuccess = () => {
        fetchScenarios();
    };

    const handleRefresh = () => {
        fetchScenarios();
    };

    // 启动场景
    const handleStartDrill = async (scenario: Scenario) => {
        const currentUsername = username || (user?.user as any)?.c_username;

        if (!currentUsername) {
            alert('无法获取当前用户名，请确保您已登录。');
            return;
        }

        if (!window.confirm(`您确定要启动场景 "${scenario.name}" 的演练吗？`)) {
            return;
        }

        setStartingScenarioId(scenario.id);
        setError(null);

        try {
            const response = await customFetch(`/back/api/scenarios/${scenario.id}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ username: currentUsername }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '启动失败');
            }

            alert(result.message);
            fetchScenarios();
        } catch (err: any) {
            setError(err.message || '发生未知网络错误');
            alert(`启动失败: ${err.message}`);
        } finally {
            setStartingScenarioId(null);
        }
    };

    const handleRequestSort = (property: SortableKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedScenarios = useMemo(() => {
    const filtered = scenarios
        .filter((s): s is Scenario => s !== null && s !== undefined && typeof s === 'object' && 'name' in s)
        .filter(s =>
            (s.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
            (s.description || '').toLowerCase().includes(searchText.toLowerCase())
        );
    filtered.sort((a, b) => {
        const valA = a[orderBy] || '';
        const valB = b[orderBy] || '';
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
                <Box>
                    <Button startIcon={<ArrowBackIcon />} sx={{ mb: 1 }} onClick={onBack}>
                        返回测试列表
                    </Button>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                        场景管理 {testId ? `(测试ID: ${testId})` : ''}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                        onClick={handleRefresh}
                        disabled={isLoading}
                    >
                        {isLoading ? '加载中...' : '刷新'}
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
            <TableCell>
              {moment(scenario.uploadDate).isValid()
                ? moment(scenario.uploadDate).format('YYYY-MM-DD')
                : moment().format('YYYY-MM-DD')}
            </TableCell>
            <TableCell align="right">
              <Tooltip title="查看实例">
                <IconButton
                  color="info"
                  size="small"
                  onClick={() => onViewInstances(scenario.name)}
                >
                  <ViewInstancesIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="启动演练">
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
        </Paper>
    );
};

export default ScenarioManagementPage;