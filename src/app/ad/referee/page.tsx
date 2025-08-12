"use client";

import React, { useState, useEffect, useCallback } from 'react';

// --- 自定义 Hooks 和组件导入 (请确保路径正确) ---
import { useAuth } from '@/hooks/useAuth';
import InstanceDetailsDialog from '../instances/InstanceDetailsDialog'; // 复用详情弹窗

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

// --- MUI 图标导入 ---
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';

// === 类型定义 (已更新以匹配后端数据) ===
interface User {
    c_username: string;
}

// 演练配置信息，现在包含了所有需要的字段
interface AdConfig {
    c_id: string;
    c_name: string;
    c_scene_config_id: number | null;
    c_scene_instance_id: string | null;
    c_status: 'pending' | 'running' | 'finished' | 'archived';
}

// 裁判总览列表的条目结构
interface RefereeEntry {
    c_user_id: string;
    c_ad_config_id: string;
    c_level: string;
    c_create_at: string;
    user: User;
    ad_config: AdConfig; // 确保 ad_config 是完整的 AdConfig 类型
}

// 裁判总览页面组件
const RefereeOverviewPage: React.FC = () => {
    // --- 状态管理 (与 AdManagementPage 同步) ---
    const [refereeEntries, setRefereeEntries] = useState<RefereeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
    const [selectedScenarioName, setSelectedScenarioName] = useState<string>('');

    // --- Hooks 初始化 ---
    const { user } = useAuth();

    // --- 数据获取 ---
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(prev => (prev?.type === 'error' ? prev : null));
        try {
            const response = await fetch('/back/api/ad/referees/all');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '获取裁判总览列表失败');
            }
            const result = await response.json();
            setRefereeEntries(result.data ?? []);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- 事件处理函数 (从 AdManagementPage 完整复用) ---

    // 启动演练
    const handleStartDrill = async (entry: RefereeEntry) => {
        const adConfig = entry.ad_config;
        const username = (user as any)?.user?.c_username;

        if (!adConfig.c_scene_config_id) {
            setStatusMessage({ type: 'error', message: '此演练未关联任何场景模板，无法启动。' });
            return;
        }
        if (!username) {
            setStatusMessage({ type: 'error', message: '无法获取当前用户名，请确保您已登录。' });
            return;
        }
        if (!window.confirm(`您确定要为演练 “${adConfig.c_name}” 启动场景实例吗？`)) {
            return;
        }

        try {
            // 注意这里的 API 路径与 AdController 中的定义一致
            const response = await fetch(`/back/api/scenarios/${adConfig.c_scene_config_id}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    ad_config_id: adConfig.c_id
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '启动失败');

            setStatusMessage({ type: 'success', message: result.message || '演练已成功启动！正在刷新列表...' });
            await fetchData(); // 成功后刷新列表
        } catch (err: any) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        }
    };

    // 查看详情
    const handleViewDetails = (entry: RefereeEntry) => {
        const adConfig = entry.ad_config;
        if (adConfig.c_scene_instance_id) {
            setSelectedInstanceId(adConfig.c_scene_instance_id);
            setSelectedScenarioName(adConfig.c_name);
            setIsDetailsModalOpen(true);
        } else {
            setStatusMessage({ type: 'error', message: '此演练尚未启动或关联实例，无法查看详情。' });
        }
    };

    // 关闭详情弹窗
    const handleCloseDetails = () => {
        setIsDetailsModalOpen(false);
        setSelectedInstanceId(null);
        setSelectedScenarioName('');
    };

    // 渲染状态标签的辅助函数
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

    // === 渲染逻辑 (已完全更新) ===
    return (
        <Box sx={{ p: 3, maxWidth: '1400px', margin: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">裁判总览</Typography>
                <Typography variant="body1" color="text.secondary">此处展示所有攻防演练中已指派的裁判信息。</Typography>
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
                                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>当前没有任何裁判指派记录。</TableCell></TableRow>
                            ) : (
                                refereeEntries.map((entry) => (
                                    <TableRow hover key={`${entry.c_ad_config_id}-${entry.c_user_id}`}>
                                        <TableCell component="th" scope="row">{entry.user?.c_username || 'N/A'}</TableCell>
                                        <TableCell>{entry.c_level}</TableCell>
                                        <TableCell>{entry.ad_config?.c_name || entry.c_ad_config_id}</TableCell>
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
            </Paper>

            {/* 详情弹窗组件 */}
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