"use client";

import React, { useState, useEffect, useCallback, MouseEvent } from 'react';

// --- 自定义 Hooks 和组件导入 ---
import { useAuth } from '@/hooks/useAuth';
// 确认 InstanceDetailsDialog 组件的导入路径正确
import InstanceDetailsDialog from '../team/InstanceDetailsDialog';
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
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import { customFetch } from "@/utils/fetch"

// --- MUI 图标导入 ---
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// === 类型定义 ===
interface User {
    c_username: string;
    c_name?: string;
}

// MODIFIED: 更新 AdConfig 类型定义
interface AdConfig {
    c_id: string;
    c_drill_name: string;
    c_scene_config_id: number | null;
    c_scene_instance_id: string | null;
    c_status: 'pending' | 'running' | 'finished' | 'archived';
    teams: { c_id: number; c_name: string }[]; // 替换 redTeam 和 blueTeam
    sceneConfig?: { c_name: string };
}

interface RefereeEntry {
    c_user_id: string;
    c_ad_config_id: string;
    c_level: string;
    c_create_at: string;
    user: User;
    ad_config: AdConfig;
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

// 裁判总览页面组件
const RefereeOverviewPage: React.FC = () => {
    const [refereeEntries, setRefereeEntries] = useState<RefereeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalEntries, setTotalEntries] = useState(0);
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [selectedAdConfig, setSelectedAdConfig] = useState<AdConfig | null>(null);
    const [isInstanceDetailsOpen, setIsInstanceDetailsOpen] = useState(false);
    const [isInstanceDetailsLoading, setIsInstanceDetailsLoading] = useState(false);
    const [selectedInstanceDetails, setSelectedInstanceDetails] = useState<InstanceDetails | null>(null);
    const [instanceDetailsError, setInstanceDetailsError] = useState<string | null>(null);

    const { user } = useAuth();
    const API_BASE_URL = '/back/api';

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(prev => (prev?.type === 'error' ? prev : null));
        try {
            const params = new URLSearchParams();
            params.append('search', debouncedSearchQuery);
            params.append('page', String(page + 1));
            params.append('per_page', String(rowsPerPage));
            const response = await customFetch(`${API_BASE_URL}/ad/referees?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '获取裁判总览列表失败');
            }
            const result = await response.json();
            setRefereeEntries(result.data ?? []);
            setTotalEntries(result.total ?? 0);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [debouncedSearchQuery, page, rowsPerPage]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { setPage(0); }, [debouncedSearchQuery]);

    const handleChangePage = (event: MouseEvent<HTMLButtonElement> | null, newPage: number) => { setPage(newPage); };
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };

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
            const response = await customFetch(`/back/api/scenarios/${adConfig.c_scene_config_id}/start`, {
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

    const handleOpenInfoDialog = (adConfig: AdConfig) => {
        setSelectedAdConfig(adConfig);
        setIsInfoDialogOpen(true);
    };
    const handleCloseInfoDialog = () => {
        setIsInfoDialogOpen(false);
        setSelectedAdConfig(null);
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
    const handleCloseInstanceDetailsDialog = () => { setIsInstanceDetailsOpen(false); };

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

    return (
        <Box sx={{ p: 3, maxWidth: '1400px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" component="h1" fontWeight="bold">裁判总览</Typography>
                    <Typography variant="body1" color="text.secondary">搜索用户名或所属演练名称。</Typography>
                </Box>
                <TextField variant="outlined" size="small" placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>)}} sx={{ minWidth: '300px' }} />
            </Box>

            {statusMessage && (<Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 2 }}>{statusMessage.message}</Alert>)}

            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer>
                    <Table stickyHeader>
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
                                    <Typography color="text.secondary">{searchQuery ? '未找到匹配的记录。' : '当前没有任何裁判指派记录。'}</Typography>
                                </TableCell></TableRow>
                            ) : (
                                refereeEntries.map((entry) => (
                                    <TableRow hover key={`${entry.c_ad_config_id}-${entry.c_user_id}`}>
                                        <TableCell>{entry.user?.c_name ? `${entry.user.c_username} (${entry.user.c_name})` : entry.user?.c_username || 'N/A'}</TableCell>
                                        <TableCell>{entry.c_level}</TableCell>
                                        <TableCell>{entry.ad_config?.c_drill_name || entry.c_ad_config_id}</TableCell>
                                        <TableCell align="center">{renderStatusChip(entry.ad_config.c_status)}</TableCell>
                                        <TableCell>{new Date(entry.c_create_at).toLocaleString()}</TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="查看演练详情"><IconButton color="default" onClick={() => handleOpenInfoDialog(entry.ad_config)}><InfoOutlinedIcon /></IconButton></Tooltip>
                                            <Tooltip title="开始/重新开始演练"><span><IconButton color="success" onClick={() => handleStartDrill(entry)} disabled={!entry.ad_config.c_scene_config_id || entry.ad_config.c_status === 'running'}><PlayArrowIcon /></IconButton></span></Tooltip>
                                            <Tooltip title="查看实例资源"><span><IconButton color="info" onClick={() => { if(entry.ad_config.c_scene_instance_id){ handleOpenInstanceDetailsDialog(entry.ad_config.c_scene_instance_id) } }} disabled={!entry.ad_config.c_scene_instance_id}><VisibilityIcon /></IconButton></span></Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination component="div" count={totalEntries} page={page} onPageChange={handleChangePage} rowsPerPage={rowsPerPage} onRowsPerPageChange={handleChangeRowsPerPage} rowsPerPageOptions={[5, 10, 25, 50]} labelRowsPerPage="每页行数:" labelDisplayedRows={({ from, to, count }) => `第 ${from} 到 ${to} 条，共 ${count} 条`} />
            </Paper>

            {/* MODIFIED: 演练详情弹窗内容更新 */}
            <Dialog open={isInfoDialogOpen} onClose={handleCloseInfoDialog} fullWidth maxWidth="xs">
                <DialogTitle>演练详情: {selectedAdConfig?.c_drill_name}</DialogTitle>
                <DialogContent dividers>
                    {selectedAdConfig ? (
                        <List dense>
                            <ListItem>
                                <ListItemText
                                    primary="参赛队伍"
                                    secondary={
                                        selectedAdConfig.teams && selectedAdConfig.teams.length > 0
                                            ? selectedAdConfig.teams.map(t => t.c_name).join('、')
                                            : '未指定'
                                    }
                                />
                            </ListItem>
                            <Divider component="li" />
                            <ListItem>
                                <ListItemText
                                    primary="场景模板"
                                    secondary={selectedAdConfig.sceneConfig?.c_name || '未关联'}
                                />
                            </ListItem>
                        </List>
                    ) : (
                        <Typography color="text.secondary">无法加载演练信息。</Typography>
                    )}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
                    <Button variant="outlined" color="secondary" startIcon={<VisibilityIcon />} onClick={() => { if (selectedAdConfig?.c_scene_instance_id) { handleOpenInstanceDetailsDialog(selectedAdConfig.c_scene_instance_id); } }} disabled={!selectedAdConfig?.c_scene_instance_id}>查看实例资源</Button>
                    <Button onClick={handleCloseInfoDialog}>关闭</Button>
                </DialogActions>
            </Dialog>

            <InstanceDetailsDialog open={isInstanceDetailsOpen} onClose={handleCloseInstanceDetailsDialog} isLoading={isInstanceDetailsLoading} details={selectedInstanceDetails} error={instanceDetailsError} />
        </Box>
    );
};

export default RefereeOverviewPage;