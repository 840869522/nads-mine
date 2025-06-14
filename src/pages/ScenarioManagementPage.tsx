import React, { useState, useMemo} from 'react';
import {
    Typography, Box, Paper, Button, TextField, InputAdornment, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Tooltip, TablePagination, TableSortLabel, CircularProgress
} from '@mui/material';
import {
    Add as AddIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Delete as DeleteIcon,
    PlayCircleOutline as StartIcon
} from '@mui/icons-material';

// 1. 更新数据结构：移除 status, lastModified -> uploadDate
interface MockScenario {
    id: string;
    name: string;
    description: string;
    uploadDate: string; // 使用上传日期
    nodeCount: number;
}

// 2. 更新模拟数据
const mockScenarios: MockScenario[] = [
    { id: 'scn_001', name: '城市电网关键节点攻击模拟', description: '模拟针对城市电力基础设施的网络攻击。', uploadDate: '2025-06-09', nodeCount: 12 },
    { id: 'scn_002', name: '港口物流中心网络渗透演练', description: '测试港口自动化系统的网络安全防御能力。', uploadDate: '2025-04-18', nodeCount: 25 },
    { id: 'scn_003', name: '基础Web服务漏洞利用场景', description: '包含常见Web漏洞（如SQL注入、XSS）的教学场景。', uploadDate: '2025-03-05', nodeCount: 8 },
    { id: 'scn_004', name: '勒索软件攻击防御预案', description: '一个已归档的旧演练场景。', uploadDate: '2025-02-11', nodeCount: 15 },
    { id: 'scn_005', name: '金融系统数据篡改攻防', description: '模拟针对金融交易系统的数据篡改攻击与防御。', uploadDate: '2025-01-20', nodeCount: 30 },
];

type Order = 'asc' | 'desc';
// 更新可排序的字段
type SortableKeys = keyof Pick<MockScenario, 'name' | 'description' | 'uploadDate' | 'nodeCount'>;

const ScenarioManagementPage: React.FC = () => {
    const [scenarios, setScenarios] = useState<MockScenario[]>(mockScenarios);
    const [isRefreshing, setIsRefreshing] = useState(false); // <-- 新增这一行
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [order, setOrder] = useState<Order>('desc');
    const [orderBy, setOrderBy] = useState<SortableKeys>('uploadDate');

    const handleRefresh = () => {
        setIsRefreshing(true);
        // 模拟一个网络延迟
        setTimeout(() => {
            // 将场景列表重置为最原始的模拟数据 (并打乱顺序以产生刷新效果)
            setScenarios([...mockScenarios].sort(() => Math.random() - 0.5));
            setIsRefreshing(false);
        }, 1000); // 延迟1秒
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
            {/* 顶部标题和操作区 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    场景管理
                </Typography>
                <Box>
                    <Button
                        variant="outlined"
                        startIcon={
                            isRefreshing ? (
                                <CircularProgress size={20} color="inherit" />
                            ) : (
                                <RefreshIcon />
                            )
                        }
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        sx={{ mr: 1 }}
                    >
                        {isRefreshing ? '刷新中...' : '刷新'}
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />}>创建场景</Button>
                </Box>
            </Box>

            {/* 列表容器 */}
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
                                {/* 3. 更新表头 */}
                                <TableCell sortDirection={orderBy === 'name' ? order : false}>
                                    <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleRequestSort('name')}>
                                        场景名称
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sortDirection={orderBy === 'description' ? order : false}>
                                    <TableSortLabel active={orderBy === 'description'} direction={orderBy === 'description' ? order : 'asc'} onClick={() => handleRequestSort('description')}>
                                        描述
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sortDirection={orderBy === 'uploadDate' ? order : false}>
                                    <TableSortLabel active={orderBy === 'uploadDate'} direction={orderBy === 'uploadDate' ? order : 'asc'} onClick={() => handleRequestSort('uploadDate')}>
                                        上传日期
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell align="right">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isRefreshing ? (
                                // 1. 如果正在刷新，则显示加载中...
                                <TableRow>
                                    {/* colSpan={4} 因为你有“场景名称”、“描述”、“上传日期”、“操作”共4个表头列 */}
                                    <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                                        <CircularProgress />
                                        <Typography sx={{ mt: 2 }} color="text.secondary">
                                            正在刷新场景列表...
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedScenarios.length === 0 ? (
                                // 2. 如果刷新结束，但没有数据，则显示提示信息
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                                        <Typography color="text.secondary">
                                            {searchText ? "没有找到匹配的场景。" : "当前题库为空，请添加新场景。"}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                // 3. 如果刷新结束且有数据，正常渲染列表
                                paginatedScenarios.map((scenario) => (
                                    <TableRow key={scenario.id} hover>
                                        <TableCell sx={{ fontWeight: 'medium' }}>{scenario.name}</TableCell>
                                        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <Tooltip title={scenario.description} placement="top-start">
                                                <span>{scenario.description}</span>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>{scenario.uploadDate}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="启动演练"><IconButton color="success" size="small"><StartIcon /></IconButton></Tooltip>
                                            <Tooltip title="删除场景"><IconButton color="error" size="small"><DeleteIcon /></IconButton></Tooltip>
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
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    labelRowsPerPage="每页行数:"
                />
            </Paper>
        </Paper>
    );
};

export default ScenarioManagementPage;