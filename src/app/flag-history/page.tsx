'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Avatar,
    Container,
    Card,
    CardContent,
    Grid,
    Alert,
    IconButton,
    Tooltip,
    Switch,
    FormControlLabel,
} from '@mui/material';
import {
    CheckCircle,
    Cancel,
    Flag,
    Person,
    Computer,
    Storage,
    Refresh,
    PlayArrow,
    Stop,
} from '@mui/icons-material';
import { websocketClient } from '@/utils/websocket';
import { getCookie } from '@/utils/cookie.tsx';

interface FlagSubmission {
    submission_id: string;
    username: string;
    is_correct: boolean;
    points_earned: number;
    submitted_at: string;
    scene_instance_id: string;
    container_instance_id?: string;
    vm_instance_id?: string;
    instance_type: 'docker' | 'vm';
    instance_name?: string;
    attempt_count: number;
}

interface Stats {
    total_submissions: number;
    correct_submissions: number;
    success_rate: number;
    active_users: number;
}

export default function FlagHistoryPage() {
    const [submissions, setSubmissions] = useState<FlagSubmission[]>([]);
    const [stats, setStats] = useState<Stats>({
        total_submissions: 0,
        correct_submissions: 0,
        success_rate: 0,
        active_users: 0,
    });
    const [isConnected, setIsConnected] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);

    // 获取认证token（从 cookie 中获取）
    const getAuthToken = () => {
        return getCookie('_auth');
    };

    // WebSocket消息处理
    const handleWebSocketMessage = useCallback((message: any) => {
        console.log('📨 收到WebSocket消息:', message);
        
        if (message.type === 'flag_submission') {
            console.log('🏴 处理Flag提交消息...');
            const newSubmission: FlagSubmission = {
                submission_id: message.submission_id,
                username: message.c_username || message.username,
                is_correct: message.c_is_correct || message.is_correct,
                points_earned: message.c_points_earned || message.points_earned,
                submitted_at: message.c_submitted_at || message.submitted_at,
                scene_instance_id: message.c_scene_instances_id || message.scene_instance_id,
                container_instance_id: message.c_container_instance_id,
                vm_instance_id: message.c_vm_instance_id,
                instance_type: message.instance_type,
                instance_name: message.instance_name,
                attempt_count: message.attempt_count || 1,
            };

            console.log('💾 更新提交列表...');
            setSubmissions(prev => {
                const updated = [newSubmission, ...prev.slice(0, 49)];
                console.log('✅ 提交列表已更新，当前数量:', updated.length);
                return updated;
            });
            
            // 更新统计数据
            setStats(prev => ({
                total_submissions: prev.total_submissions + 1,
                correct_submissions: prev.correct_submissions + (newSubmission.is_correct ? 1 : 0),
                success_rate: ((prev.correct_submissions + (newSubmission.is_correct ? 1 : 0)) / (prev.total_submissions + 1)) * 100,
                active_users: prev.active_users, // 这个需要从后端获取
            }));

            // 自动滚动到顶部 - 使用回调式获取当前值
            setTimeout(() => {
                // 从 localStorage或状态中获取autoScroll状态
                const shouldAutoScroll = document.querySelector('[data-auto-scroll]')?.getAttribute('data-auto-scroll') === 'true';
                if (shouldAutoScroll) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 100);
        }
        
        if (message.type === 'auth_response') {
            setIsAuthenticated(message.success);
        }
    }, []); // 移除所有依赖项，避免不必要的重新创建

    // 初始化WebSocket连接
    useEffect(() => {
        const token = getAuthToken();
        if (!token) {
            console.error('未找到认证token');
            return;
        }

        if (isRealTimeEnabled) {
            console.log('🔧 注册WebSocket消息处理器...');
            websocketClient.setToken(token);
            websocketClient.onMessage(handleWebSocketMessage);
            websocketClient.connect();
            
            // 确认处理器已注册
            setTimeout(() => {
                console.log('✅ 当前WebSocket处理器数量:', websocketClient.getHandlerCount?.() || 'N/A');
            }, 100);

            // 监听连接状态
            const checkConnection = () => {
                setIsConnected(websocketClient.isConnected());
                setIsAuthenticated(websocketClient.isAuth());
            };

            const interval = setInterval(checkConnection, 1000);

            return () => {
                console.log('🧹 清理WebSocket连接...');
                clearInterval(interval);
                websocketClient.offMessage(handleWebSocketMessage);
            };
        }
    }, [handleWebSocketMessage, isRealTimeEnabled]);

    // 获取历史数据（通过HTTP API）
    const fetchHistoryData = async () => {
        try {
            const token = getAuthToken();
            if (!token) return;

            const response = await fetch('/back/api/flag/submission-history', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scope: 'all',
                    target_scope: 'all_targets_in_all_scenes',
                    token: token  // 添加token字段以适配JWT中间件
                }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('历史记录API响应:', data);
                
                if (data.code === 200 && data.data) {
                    console.log('获取到历史数据:', data.data.length, '条记录');
                    
                    // 转换数据格式
                    const formattedSubmissions = data.data.map((item: any) => ({
                        submission_id: item.c_submission_id,
                        username: item.c_username,
                        is_correct: item.c_is_correct,
                        points_earned: item.c_points_earned,
                        submitted_at: item.c_submitted_at,
                        scene_instance_id: item.c_scene_instances_id,
                        container_instance_id: item.c_container_instance_id,
                        vm_instance_id: item.c_vm_instance_id,
                        instance_type: item.instance_type,
                        attempt_count: item.c_attempt_count,
                    }));
                    
                    console.log('格式化后的数据:', formattedSubmissions);
                    setSubmissions(formattedSubmissions);
                    
                    // 更新统计数据
                    const totalCount = formattedSubmissions.length;
                    const correctCount = formattedSubmissions.filter(s => s.is_correct).length;
                    setStats({
                        total_submissions: totalCount,
                        correct_submissions: correctCount,
                        success_rate: totalCount > 0 ? (correctCount / totalCount) * 100 : 0,
                        active_users: 0
                    });
                } else {
                    console.error('历史记录API返回错误:', data);
                }
            } else {
                const errorText = await response.text();
                console.error('HTTP请求失败:', response.status, errorText);
            }
        } catch (error) {
            console.error('获取历史数据失败:', error);
        }
    };

    // 页面加载时获取历史数据
    useEffect(() => {
        fetchHistoryData();
    }, []);

    // 格式化时间
    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('zh-CN');
    };

    // 切换实时功能
    const toggleRealTime = () => {
        setIsRealTimeEnabled(!isRealTimeEnabled);
        if (!isRealTimeEnabled) {
            // 重新连接
            const token = getAuthToken();
            if (token) {
                websocketClient.setToken(token);
                websocketClient.connect();
            }
        } else {
            // 断开连接
            websocketClient.disconnect();
            setIsConnected(false);
            setIsAuthenticated(false);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold' }}>
                <Flag sx={{ mr: 1, verticalAlign: 'middle' }} />
                实时 Flag 提交历史
            </Typography>

            {/* 统计卡片 */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                总提交数
                            </Typography>
                            <Typography variant="h4" component="div">
                                {stats.total_submissions}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                正确提交数
                            </Typography>
                            <Typography variant="h4" component="div" color="success.main">
                                {stats.correct_submissions}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                成功率
                            </Typography>
                            <Typography variant="h4" component="div" color="info.main">
                                {stats.success_rate.toFixed(1)}%
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                连接状态
                            </Typography>
                            <Box display="flex" alignItems="center">
                                <Chip
                                    label={isConnected && isAuthenticated ? '已连接' : '未连接'}
                                    color={isConnected && isAuthenticated ? 'success' : 'error'}
                                    size="small"
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* 控制面板 */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box display="flex" alignItems="center" gap={2}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={isRealTimeEnabled}
                                onChange={toggleRealTime}
                                color="primary"
                            />
                        }
                        label="实时更新"
                    />
                    <Tooltip title="刷新历史数据">
                        <IconButton onClick={fetchHistoryData} color="primary">
                            <Refresh />
                        </IconButton>
                    </Tooltip>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={autoScroll}
                                onChange={(e) => setAutoScroll(e.target.checked)}
                                color="primary"
                                data-auto-scroll={autoScroll}
                            />
                        }
                        label="自动滚动"
                        data-auto-scroll={autoScroll}
                    />
                    {!isConnected && isRealTimeEnabled && (
                        <Alert severity="warning" sx={{ ml: 2 }}>
                            WebSocket 连接断开，正在尝试重连...
                        </Alert>
                    )}
                </Box>
            </Paper>

            {/* 提交历史表格 */}
            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>状态</TableCell>
                                <TableCell>用户</TableCell>
                                <TableCell>得分</TableCell>
                                <TableCell>靶机类型</TableCell>
                                <TableCell>靶机ID</TableCell>
                                <TableCell>场景ID</TableCell>
                                <TableCell>尝试次数</TableCell>
                                <TableCell>提交时间</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {submissions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                        <Typography color="textSecondary">
                                            暂无提交记录
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                submissions.map((submission) => (
                                    <TableRow 
                                        key={submission.submission_id}
                                        sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                                    >
                                        <TableCell>
                                            <Box display="flex" alignItems="center">
                                                {submission.is_correct ? (
                                                    <CheckCircle color="success" sx={{ mr: 1 }} />
                                                ) : (
                                                    <Cancel color="error" sx={{ mr: 1 }} />
                                                )}
                                                <Chip
                                                    label={submission.is_correct ? '成功' : '失败'}
                                                    color={submission.is_correct ? 'success' : 'error'}
                                                    size="small"
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box display="flex" alignItems="center">
                                                <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: 12 }}>
                                                    <Person />
                                                </Avatar>
                                                {submission.username}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                fontWeight="bold"
                                                color={submission.is_correct ? 'success.main' : 'text.disabled'}
                                            >
                                                {submission.points_earned} 分
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Box display="flex" alignItems="center">
                                                {submission.instance_type === 'docker' ? (
                                                    <Computer color="primary" sx={{ mr: 1 }} />
                                                ) : (
                                                    <Storage color="secondary" sx={{ mr: 1 }} />
                                                )}
                                                <Chip
                                                    label={submission.instance_type === 'docker' ? 'Docker' : 'VM'}
                                                    color={submission.instance_type === 'docker' ? 'primary' : 'secondary'}
                                                    size="small"
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontFamily="monospace">
                                                {submission.container_instance_id || submission.vm_instance_id || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontFamily="monospace">
                                                {submission.scene_instance_id?.substring(0, 8)}...
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={`第 ${submission.attempt_count} 次`}
                                                variant="outlined"
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {formatTime(submission.submitted_at)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Container>
    );
}
