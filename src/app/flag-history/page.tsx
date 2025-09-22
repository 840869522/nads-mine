'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { getCookie } from '@/utils/cookie.tsx';
import {customFetch} from "@/utils/fetch.ts";

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
    const [isLoading, setIsLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // 获取认证token（从 cookie 中获取）
    const getAuthToken = () => {
        return getCookie('_auth');
    };

    // 轮询获取最新的Flag提交数据
    const fetchLatestSubmissions = useCallback(async () => {
        const token = getAuthToken();
        if (!token) {
            console.error('未找到认证token');
            return;
        }

        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                limit: '20', // 获取最新20条记录
                ...(lastFetchTime && { since: lastFetchTime })
            });

            const response = await customFetch(`/back/api/flag/latest-submissions?${params}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📨 收到API响应:', data);
                
                if (data.code === 200 && data.data?.submissions) {
                    const newSubmissions = data.data.submissions;
                    
                    if (newSubmissions.length > 0) {
                        console.log('🏴 处理Flag提交数据...', newSubmissions.length, '条记录');
                        
                        // 转换数据格式
                        const formattedSubmissions: FlagSubmission[] = newSubmissions.map((item: any) => ({
                            submission_id: item.submission_id,
                            username: item.c_username,
                            is_correct: item.c_is_correct,
                            points_earned: item.c_points_earned,
                            submitted_at: item.c_submitted_at,
                            scene_instance_id: item.c_scene_instances_id || '',
                            container_instance_id: item.c_container_instance_id,
                            vm_instance_id: item.c_vm_instance_id,
                            instance_type: item.instance_type,
                            instance_name: item.instance_name,
                            attempt_count: item.attempt_count || 1,
                        }));

                        console.log('💾 更新提交列表...');
                        setSubmissions(prev => {
                            if (!lastFetchTime) {
                                // 初始加载，直接替换
                                console.log('✅ 初始加载，提交列表已更新，当前数量:', formattedSubmissions.length);
                                return formattedSubmissions;
                            } else {
                                // 轮询更新，将新数据加入列表顶部
                                const combined = [...formattedSubmissions, ...prev];
                                // 去重并只保留最新的50条
                                const unique = combined.filter((item, index, arr) => 
                                    arr.findIndex(sub => sub.submission_id === item.submission_id) === index
                                ).slice(0, 50);
                                console.log('✅ 轮询更新，提交列表已更新，当前数量:', unique.length);
                                return unique;
                            }
                        });
                        
                        // 更新统计数据
                        const correctCount = formattedSubmissions.filter(s => s.is_correct).length;
                        setStats(prev => {
                            if (!lastFetchTime) {
                                // 初始加载
                                return {
                                    total_submissions: formattedSubmissions.length,
                                    correct_submissions: correctCount,
                                    success_rate: formattedSubmissions.length > 0 ? (correctCount / formattedSubmissions.length) * 100 : 0,
                                    active_users: new Set(formattedSubmissions.map(s => s.username)).size,
                                };
                            } else {
                                // 轮询更新
                                return {
                                    total_submissions: prev.total_submissions + formattedSubmissions.length,
                                    correct_submissions: prev.correct_submissions + correctCount,
                                    success_rate: ((prev.correct_submissions + correctCount) / (prev.total_submissions + formattedSubmissions.length)) * 100,
                                    active_users: prev.active_users, // 这个需要从后端获取
                                };
                            }
                        });

                        // 更新最后获取时间
                        setLastFetchTime(data.data.stats?.latest_timestamp || new Date().toISOString());

                        // 自动滚动到顶部
                        if (autoScroll && lastFetchTime) {
                            setTimeout(() => {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }, 100);
                        }
                    }
                } else {
                    console.warn('无效的 API 响应格式:', data);
                }
            } else {
                console.error('API 请求失败:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('获取最新 Flag 提交数据失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [lastFetchTime, autoScroll]);

    // 初始化轮询（仅依赖isRealTimeEnabled）
    useEffect(() => {
        const token = getAuthToken();
        if (!token) {
            console.error('未找到认证token');
            return;
        }

        if (isRealTimeEnabled) {
            console.log('🔧 启动实时轮询...');
            
            // 初始加载数据
            fetchLatestSubmissions();

            // 设置轮询间隔（15秒）
            intervalRef.current = setInterval(() => {
                fetchLatestSubmissions();
            }, 15000);

            return () => {
                console.log('🧹 清理轮询间隔...');
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        } else {
            // 停止轮询
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
    }, [isRealTimeEnabled, fetchLatestSubmissions]); // 依赖isRealTimeEnabled和fetchLatestSubmissions

    // 获取历史数据（通过HTTP API）
    const fetchHistoryData = async () => {
        try {
            const token = getAuthToken();
            if (!token) return;

            const response = await customFetch('/back/api/flag/submission-history', {
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
            // 重置时间戳，重新加载所有数据
            setLastFetchTime(null);
        }
    };
    
    // 手动刷新函数
    const handleManualRefresh = () => {
        setLastFetchTime(null); // 重置时间戳
        fetchLatestSubmissions();
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
                                更新状态
                            </Typography>
                            <Box display="flex" alignItems="center">
                                <Chip
                                    label={isRealTimeEnabled ? (
                                        isLoading ? '正在更新...' : '实时更新'
                                    ) : '手动更新'}
                                    color={isRealTimeEnabled ? 'success' : 'default'}
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
                    <Tooltip title="手动刷新">
                        <IconButton onClick={handleManualRefresh} color="primary" disabled={isLoading}>
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
                    {isRealTimeEnabled && lastFetchTime && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                            最后更新: {new Date(lastFetchTime).toLocaleTimeString()}
                        </Typography>
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
