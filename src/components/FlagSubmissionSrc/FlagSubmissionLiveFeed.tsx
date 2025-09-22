import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Paper,
    Divider,
    IconButton,
    Tooltip,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '@/hooks/useAuth'; // 假设你有一个useAuth hook来获取token
import { getCookie } from '@/utils/cookie.tsx';
import { customFetch } from '@/utils/fetch';

interface SubmissionMessage {
    submission_id: string;
    c_username: string;
    c_is_correct: boolean;
    c_points_earned: number;
    c_submitted_at: string;
    instance_type: 'docker' | 'vm';
    c_container_instance_id?: string;
    c_vm_instance_id?: string;
    instance_name?: string;
    attempt_count: number;
}

const FlagSubmissionLiveFeed: React.FC = () => {
    const [messages, setMessages] = useState<SubmissionMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
    const { user } = useAuth(); // 从认证上下文中获取用户信息
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isComponentMounted = useRef(true);

    // 获取认证token
    const getAuthToken = () => {
        const token = getCookie('_auth');
        return token ? `Bearer ${token}` : null;
    };

    // 从 API 获取最新的 Flag 提交数据
    const fetchLatestSubmissions = useCallback(async () => {
        const token = getAuthToken();
        if (!token || !user) {
            console.warn('JWT token or user info is missing. Cannot fetch submissions.');
            return;
        }

        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                limit: '10',
                ...(lastFetchTime && { since: lastFetchTime })
            });

            const response = await customFetch(`/back/api/flag/latest-submissions?${params}`, {
                method: 'GET',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                console.log('API响应:', data);
                
                if (data.code === 200 && data.data?.submissions) {
                    const newSubmissions = data.data.submissions;
                    
                    if (newSubmissions.length > 0) {
                        // 转换数据格式
                        const formattedSubmissions: SubmissionMessage[] = newSubmissions.map((item: any) => ({
                            submission_id: item.submission_id,
                            c_username: item.c_username,
                            c_is_correct: item.c_is_correct,
                            c_points_earned: item.c_points_earned,
                            c_submitted_at: item.c_submitted_at,
                            c_container_instance_id: item.c_container_instance_id,
                            c_vm_instance_id: item.c_vm_instance_id,
                            instance_type: item.instance_type,
                            instance_name: item.instance_name,
                            attempt_count: item.attempt_count || 1,
                        }));

                        // 更新消息列表
                        setMessages(prev => {
                            if (!lastFetchTime) {
                                // 初始加载，直接替换
                                return formattedSubmissions;
                            } else {
                                // 轮询更新，将新数据加入列表顶部
                                const combined = [...formattedSubmissions, ...prev];
                                // 去重并只保留最新的10条
                                const unique = combined.filter((item, index, arr) => 
                                    arr.findIndex(sub => sub.submission_id === item.submission_id) === index
                                ).slice(0, 10);
                                return unique;
                            }
                        });

                        // 更新最后获取时间
                        setLastFetchTime(data.data.stats?.latest_timestamp || new Date().toISOString());
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
            if (isComponentMounted.current) {
                setIsLoading(false);
            }
        }
    }, [user, lastFetchTime]);

    // 手动刷新
    const handleManualRefresh = () => {
        setLastFetchTime(null); // 重置时间戳，重新加载所有数据
        fetchLatestSubmissions();
    };

    // 启动轮询
    useEffect(() => {
        if (!user) {
            console.warn('User not authenticated. Live feed will not start.');
            return;
        }

        // 初始加载数据
        fetchLatestSubmissions();

        // 设置轮询间隔（10秒）
        intervalRef.current = setInterval(() => {
            if (isComponentMounted.current) {
                fetchLatestSubmissions();
            }
        }, 10000);

        // 组件卸载时清理
        return () => {
            isComponentMounted.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [user, fetchLatestSubmissions]);

    return (
        <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6">
                    最新 Flag 提交动态
                </Typography>
                <Tooltip title="手动刷新">
                    <IconButton 
                        onClick={handleManualRefresh} 
                        disabled={isLoading}
                        size="small"
                    >
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                <List dense>
                    {isLoading && messages.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                            正在加载最新提交记录...
                        </Typography>
                    ) : messages.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                            暂无最新提交记录
                        </Typography>
                    ) : (
                        messages.map((msg) => (
                            <React.Fragment key={msg.submission_id}>
                                <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: msg.c_is_correct ? 'success.main' : 'error.main' }}>
                                            {msg.c_is_correct ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography component="span" variant="body1" color="text.primary" fontWeight="bold">
                                                    {msg.c_username}
                                                </Typography>
                                                <Typography component="span" variant="body2" color="text.secondary">
                                                    提交了一个 Flag
                                                </Typography>
                                                {msg.instance_name && (
                                                    <Typography component="span" variant="body2" color="info.main">
                                                        ({msg.instance_name})
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <React.Fragment>
                                                <Typography
                                                    sx={{ display: 'block' }}
                                                    component="span"
                                                    variant="body2"
                                                    color="text.primary"
                                                >
                                                    {msg.c_is_correct ? `正确 Flag，得分: ${msg.c_points_earned}` : 'Flag 错误'}
                                                </Typography>
                                                <Typography
                                                    sx={{ display: 'block' }}
                                                    component="span"
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    提交于: {new Date(msg.c_submitted_at).toLocaleString()}
                                                </Typography>
                                            </React.Fragment>
                                        }
                                    />
                                </ListItem>
                                <Divider component="li" variant="inset" />
                            </React.Fragment>
                        ))
                    )}
                </List>
            </Box>
            {lastFetchTime && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                    最后更新: {new Date(lastFetchTime).toLocaleTimeString()}
                </Typography>
            )}
        </Paper>
    );
};

export default FlagSubmissionLiveFeed;