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
    ArrowBack as ArrowBackIcon,
    Visibility as ViewIcon, // <-- 确认导入
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
  onBack: () => void;
}

const ScenarioInstanceManagementPage: React.FC<ScenarioInstanceManagementPageProps> = ({ username, scenarioName, onBack }) => {
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
        console.log('开始获取场景实例列表...');
        
        const response = await fetch('/back/api/study/test/index', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            },
        });
        
        console.log('响应状态:', response.status);
        console.log('响应头:', Object.fromEntries([...response.headers]));
        
        // 获取原始响应文本
        const rawText = await response.text();
        console.log('原始响应长度:', rawText.length);
        console.log('完整响应内容:', rawText);
        
        // 检查前100个字符的编码
        console.log('前100个字符的编码:');
        const first100Chars = rawText.substring(0, 100);
        for (let i = 0; i < first100Chars.length; i++) {
            const char = first100Chars[i];
            const code = first100Chars.charCodeAt(i);
            console.log(`位置 ${i}: '${char}' (ASCII: ${code}, Hex: 0x${code.toString(16)})`);
            
            // 特别检查位置60附近的字符
            if (i >= 55 && i <= 65) {
                console.log(`⚠️ 注意位置 ${i}: '${char}' (ASCII: ${code})`);
            }
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${rawText.substring(0, 200)}`);
        }
        
        // 尝试清理响应
        let cleanedText = rawText;
        
        // 移除BOM (0xFEFF)
        if (cleanedText.charCodeAt(0) === 0xFEFF) {
            console.log('检测到BOM头，已移除');
            cleanedText = cleanedText.substring(1);
        }
        
        // 查找JSON开始位置
        const jsonStart = cleanedText.indexOf('{');
        if (jsonStart > 0) {
            console.log(`发现JSON开始于位置 ${jsonStart}`);
            console.log(`JSON前的文本: "${cleanedText.substring(0, jsonStart)}"`);
            cleanedText = cleanedText.substring(jsonStart);
        }
        
        // 查找JSON结束位置
        const jsonEnd = cleanedText.lastIndexOf('}');
        if (jsonEnd !== -1 && jsonEnd < cleanedText.length - 1) {
            console.log(`发现JSON结束于位置 ${jsonEnd}，后面还有内容`);
            cleanedText = cleanedText.substring(0, jsonEnd + 1);
        }
        
        console.log('清理后的文本:', cleanedText);
        
        // 尝试解析JSON
        try {
            const data = JSON.parse(cleanedText);
            console.log('解析成功的数据:', data);
            
            // 处理数据格式
            let instancesData: ScenarioInstance[] = [];
            
            if (Array.isArray(data)) {
                instancesData = data;
            } else if (data && typeof data === 'object' && Array.isArray(data.data)) {
                instancesData = data.data;
            } else if (data && typeof data === 'object') {
                instancesData = [data];
            }
            
            console.log('处理后的实例数据:', instancesData);
            
            // 过滤数据
            const filteredData = scenarioName 
                ? instancesData.filter(inst => inst.scenario_name === scenarioName) 
                : instancesData;
                
            setInstances(filteredData);
            
        } catch (parseError: any) {
            console.error('JSON解析错误详情:', parseError);
            
            // 显示具体的错误位置
            if (parseError.message.includes('position')) {
                const positionMatch = parseError.message.match(/position (\d+)/);
                if (positionMatch) {
                    const errorPosition = parseInt(positionMatch[1]);
                    console.log(`错误位置: ${errorPosition}`);
                    console.log(`错误位置的字符: '${cleanedText[errorPosition]}' (ASCII: ${cleanedText.charCodeAt(errorPosition)})`);
                    console.log(`错误位置周围的文本: "${cleanedText.substring(errorPosition - 10, errorPosition + 10)}"`);
                }
            }
            
            throw new Error(`JSON解析失败: ${parseError.message}`);
        }
        
    } catch (err: any) {
        console.error('获取场景实例列表错误:', err);
        setError('获取场景实例列表失败: ' + err.message);
        setInstances([]);
    } finally {
        setIsLoading(false);
    }
}, [username, scenarioName]);

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

    const handleDeleteInstance = async (instanceId: string, scenarioName: string) => {
        if (window.confirm(`您确定要永久删除场景实例 "${scenarioName}" (${instanceId}) 吗？此操作将删除所有关联的容器和资源，且无法撤销。`)) {
            setIsLoading(true);
            try {
                const response = await customFetch(`/back/api/scenariosinstances/${instanceId}`, { method: 'DELETE' });
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
                const response = await customFetch(`/back/api/scenariosinstances/${instanceId}/teardown`, { method: 'POST' });
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
                    <Button startIcon={<ArrowBackIcon />} sx={{ mb: 1 }} onClick={onBack}>
                        返回场景管理
                    </Button>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                        场景: {scenarioName || '所有'}
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
                                            {/* [MODIFICATION] 添加查看详情按钮 */}
                                            {instance.status !== 'STOPPED' && (
                                                <Tooltip title="查看详情">
                                                    <IconButton color="primary" size="small" onClick={() => handleViewDetails(instance)}>
                                                        <ViewIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
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