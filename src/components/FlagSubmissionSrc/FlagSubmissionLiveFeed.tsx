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

const WS_URL = 'ws://your-workerman-server-ip:8080'; // 替换为你的Workerman服务器IP

const FlagSubmissionLiveFeed: React.FC = () => {
    const [messages, setMessages] = useState<SubmissionMessage[]>([]);
    const { token } = useAuth(); // 从你的认证上下文中获取token

    useEffect(() => {
        // 确保有token和URL才建立连接
        if (!token || !WS_URL) {
            console.warn('WebSocket URL or JWT token is missing. Live feed will not connect.');
            return;
        }

        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('WebSocket connected');
            // 在连接打开时，发送认证信息和订阅消息
            const authMessage = JSON.stringify({
                action: 'auth',
                token: token,
            });
            ws.send(authMessage);

            // 如果Workerman需要显式订阅，可以在这里发送订阅消息
            // const subscribeMessage = JSON.stringify({
            //   action: 'subscribe',
            //   channel: 'flag-submissions',
            // });
            // ws.send(subscribeMessage);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'flag_submission') {
                    setMessages((prevMessages) => [data, ...prevMessages].slice(0, 10)); // 只保留最新的10条消息
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        // 组件卸载时断开连接
        return () => {
            if (ws.readyState === 1) {
                ws.close();
            }
        };
    }, [token]);

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