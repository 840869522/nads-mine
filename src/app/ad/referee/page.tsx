"use client";

import React, { useState, useEffect, useCallback, MouseEvent } from 'react';

// --- 自定义 Hooks 和组件导入 ---
import { useAuth } from '@/hooks/useAuth';
import InstanceDetailsDialog from '../instances/InstanceDetailsDialog';
import { useDebounce } from '@/app/hooks/useDebounce';

// --- MUI 组件导入 ---
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import TablePagination from '@mui/material/TablePagination';

// --- MUI 图标导入 ---
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';

// === 类型定义 ===
interface User {
    c_username: string;
    c_name?: string; // 为后端可能返回的真实姓名做准备
}

interface AdConfig {
    c_id: string;
    c_drill_name: string;
    c_scene_config_id: number | null;
    c_scene_instance_id: string | null;
    c_status: 'pending' | 'running' | 'finished' | 'archived';
}

interface RefereeEntry {
    c_user_id: string;
    c_ad_config_id: string;
    c_level: string;
    c_create_at: string;
    user: User;
    ad_config: AdConfig;
}

// 裁判总览页面组件
const RefereeOverviewPage: React.FC = () => {
    // --- 状态管理 ---
    const [refereeEntries, setRefereeEntries] = useState<RefereeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [selectedScenarioName, setSelectedScenarioName] = useState<string>('');

    // 1. 新增搜索和分页状态
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalEntries, setTotalEntries] = useState(0);

    const { user } = useAuth();
    const API_BASE_URL = '/back/api';

    // 2. 更新数据获取逻辑
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        // 保留错误信息，直到下一次成功获取或新的错误发生
        setStatusMessage(prev => (prev?.type === 'error' ? prev : null));
        try {
            const params = new URLSearchParams();
            params.append('search', debouncedSearchQuery);
            params.append('page', String(page + 1));
            params.append('per_page', String(rowsPerPage));

            const response = await fetch(`${API_BASE_URL}/ad/referees/all?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '获取裁判总览列表失败');
            }
            const result = await response.json();

            // 处理分页响应 (Laravel paginate() 默认返回 data 和 total)
            setRefereeEntries(result.data ?? []);
            setTotalEntries(result.total ?? 0);

        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery, page, rowsPerPage]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 搜索时重置页码
    useEffect(() => {
        setPage(0);
    }, [debouncedSearchQuery]);

    // --- 事件处理函数 ---

    // 3. 新增分页事件处理器
    const handleChangePage = (event: MouseEvent<HTMLButtonElement> | null, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleStartDrill = async (entry: RefereeEntry) => {
        const adConfig = entry.ad_config;
        const username = (user as any)?.user?.c_username;
        if (!adConfig.c_scene_config_id) {
            setStatusMessage({ type: 'warning', message: '此演练未关联任何场景模板，无法启动。' });
            return;
        }
        if (!username) {
            setStatusMessage({ type: 'error', message: '无法获取当前用户名，请确保您已登录。' });
            return;
        }
        if (!window.confirm(`您确定要为演练 “${adConfig.c_drill_name}” 启动场景实例吗？`)) return;

        try {
            const response = await fetch(`/back/api/scenarios/${adConfig.c_scene_config_id}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username: username, ad_config_id: adConfig.c_id }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '启动失败');
            setStatusMessage({ type: 'success', message: result.message || '演练已成功启动！正在刷新列表...' });
            await fetchData();
        } catch (err: any) {
            setStatusMessage({ type: 'error', message: err.message });
        }
    };

    const handleViewDetails = (entry: RefereeEntry) => {
        const adConfig = entry.ad_config;
        if (adConfig.c_scene_instance_id) {
            setSelectedInstanceId(adConfig.c_scene_instance_id);
            setSelectedScenarioName(adConfig.c_drill_name);
            setIsDetailsModalOpen(true);
        } else {
            setStatusMessage({ type: 'warning', message: '此演练尚未启动或关联实例，无法查看详情。' });
        }
    };

    const handleCloseDetails = () => {
        setIsDetailsModalOpen(false);
        setSelectedInstanceId(null);
        setSelectedScenarioName('');
    };

    const renderStatusChip = (status: AdConfig['c_status']) => {
        const statusMap = {
            pending: { label: '未开始', color: 'default' as const },
            running: { label: '进行中', color: 'success' as const },
            finished: { label: '已结束', color: 'primary' as const },
            archived: { label: '已归档', color: 'warning' as const },
        };
        const { label, color } = statusMap[status] || statusMap.pending;
        return <Chip label={label} color={color} size="small" />;
    };

    // === 渲染逻辑 ===
    return (
        <Box sx={{ p: 3, maxWidth: '1400px', margin: 'auto' }}>
            {/* 4. 添加标题和搜索框 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" component="h1" fontWeight="bold">裁判总览</Typography>
                    <Typography variant="body1" color="text.secondary">搜索用户名或所属演练名称。</Typography>
                </Box>
                <TextField
                    variant="outlined"
                    size="small"
                    placeholder="搜索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ minWidth: '300px' }}
                />
            </Box>

            {statusMessage && (
                <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 2 }}>
                    {statusMessage.message}
                </Alert>
            )}

            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer>
                    <Table stickyHeader aria-label="referee overview table">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>用户名</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>裁判级别</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>所属演练</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>演练状态</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>指派时间</TableCell>
                                <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow>
                            ) : refereeEntries.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                                    <Typography color="text.secondary">
                                        {searchQuery ? '未找到匹配的记录。' : '当前没有任何裁判指派记录。'}
                                    </Typography>
                                </TableCell></TableRow>
                            ) : (
                                refereeEntries.map((entry) => (
                                    <TableRow hover key={`${entry.c_ad_config_id}-${entry.c_user_id}`}>
                                        <TableCell component="th" scope="row">{entry.user?.c_name ? `${entry.user.c_username} (${entry.user.c_name})` : entry.user?.c_username || 'N/A'}</TableCell>
                                        <TableCell>{entry.c_level}</TableCell>
                                        <TableCell>{entry.ad_config?.c_drill_name || entry.c_ad_config_id}</TableCell>
                                        <TableCell align="center">{renderStatusChip(entry.ad_config.c_status)}</TableCell>
                                        <TableCell>{new Date(entry.c_create_at).toLocaleString()}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="开始/重新开始演练">
                                                <span>
                                                    <IconButton
                                                        color="success"
                                                        onClick={() => handleStartDrill(entry)}
                                                        disabled={!entry.ad_config.c_scene_config_id || entry.ad_config.c_status === 'running'}
                                                    >
                                                        <PlayArrowIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="查看详情/报告">
                                                <span>
                                                    <IconButton
                                                        color="info"
                                                        onClick={() => handleViewDetails(entry)}
                                                        disabled={!entry.ad_config.c_scene_instance_id}
                                                    >
                                                        <VisibilityIcon />
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

                {/* 5. 添加 TablePagination 组件 */}
                <TablePagination
                    component="div"
                    count={totalEntries}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    labelRowsPerPage="每页行数:"
                    labelDisplayedRows={({ from, to, count }) => `第 ${from} 到 ${to} 条，共 ${count} 条`}
                />
            </Paper>

            {isDetailsModalOpen && selectedInstanceId && (
                <InstanceDetailsDialog
                    open={isDetailsModalOpen}
                    onClose={handleCloseDetails}
                    instanceId={selectedInstanceId}
                    scenarioName={selectedScenarioName}
                />
            )}
        </Box>
    );
};

export default RefereeOverviewPage;