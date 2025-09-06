import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAuth } from '@/hooks/useAuth'; // 假设你有一个useAuth hook来获取token
import { websocketClient } from '@/utils/websocket';
import { getCookie } from '@/utils/cookie.tsx';

interface SubmissionMessage {
    submission_id: string;
    c_username: string;
    c_is_correct: boolean;
    c_points_earned: number;
    c_submitted_at: string;
    instance_type: 'docker' | 'vm';
    c_container_instance_id?: string;
    c_vm_instance_id?: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'; // 环境变量配置

const FlagSubmissionLiveFeed: React.FC = () => {
    const [messages, setMessages] = useState<SubmissionMessage[]>([]);
    const { user } = useAuth(); // 从认证上下文中获取用户信息

    useEffect(() => {
        // 从 cookie 中获取 token
        const token = getCookie('_auth');
        
        if (!token || !user) {
            console.warn('JWT token or user info is missing. Live feed will not connect.');
            return;
        }

        // 设置token并连接
        websocketClient.setToken(token);
        
        // 消息处理函数
        const handleMessage = (data: any) => {
            if (data.type === 'flag_submission') {
                setMessages((prevMessages) => [data, ...prevMessages].slice(0, 10));
            }
        };
        
        // 注册消息处理器
        websocketClient.onMessage(handleMessage);
        
        // 连接WebSocket
        websocketClient.connect();

        // 组件卸载时清理
        return () => {
            websocketClient.offMessage(handleMessage);
        };
    }, [user]);

    return (
        <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
                最新 Flag 提交动态
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                <List dense>
                    {messages.length === 0 ? (
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
        </Paper>
    );
};

export default FlagSubmissionLiveFeed;