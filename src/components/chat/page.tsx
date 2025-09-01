"use client";
import { Dialog, DialogContent, useMediaQuery } from "@mui/material";
import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Paper,
    List,
    ListItem,
    TextField,
    Button,
    Typography,
    Divider,
    useTheme,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from "@/hooks/useAuth";
import { apiClientWithToken } from "@/utils/axios";

interface Message {
    id: string;
    text: string;
    role: 'user' | 'assistant';
}

const ChatDialog = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: '你好！有什么可以帮助你的吗？',
            role: 'assistant'
        },
        {
            id: "2",
            text: "adasd",
            role: "user"
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource>(null);
    const theme = useTheme();
    // const {user} = useAuth();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [])

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (inputValue.trim()) {
            const newMessage: Message = {
                id: Date.now().toString(),
                text: inputValue,
                role: 'user'
            };

            setMessages(prev => [...prev, newMessage]);
            setInputValue('');
            const eventUrl = "/chat/chat"
            apiClientWithToken.post(eventUrl, JSON.stringify({ message: newMessage.text })).then(() => {
                // 连接 SSE 端点
                eventSourceRef.current = new EventSource(eventUrl);

                let currentMessage = '';
                eventSourceRef.current.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.chunk) {
                        currentMessage += data.chunk;
                        setMessages((prev) => {
                            const newMessages = [...prev];
                            if (newMessages[newMessages.length - 1]?.role === 'assistant') {
                                newMessages[newMessages.length - 1].text = currentMessage;
                            } else {
                                newMessages.push({ id: (Date.now() + 1).toString(), role: 'assistant', text: currentMessage });
                            }
                            return newMessages;
                        });
                    }
                    if (data.done) {
                        eventSourceRef.current?.close();
                        eventSourceRef.current = null;
                    }
                };

                eventSourceRef.current.onerror = () => {
                    setMessages((prev) => [
                        ...prev,
                        { id: (Date.now() + 1).toString(), role: 'assistant', text: '连接错误，请重试。' },
                    ]);
                    eventSourceRef.current?.close();
                    eventSourceRef.current = null;
                };
            })

        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 消息列表 */}
            <List
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 0,
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                    color: theme.palette.text.primary,
                    height: 'calc(100% - 120px)',
                    '&::-webkit-scrollbar': { display: 'none' },
                    scrollbarWidth: 'none',
                }}
            >
                {messages.map((message) => (
                    <ListItem
                        key={message.id}
                        sx={{
                            display: 'flex',
                            flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                            px: 1,
                            py: 1,
                        }}
                    >
                        <Paper
                            elevation={1}
                            sx={{
                                p: 1.5,
                                bgcolor: message.role === 'user'
                                    ? theme.palette.primary.main
                                    : theme.palette.mode === 'dark'
                                        ? 'grey.800'
                                        : 'background.paper',
                                color: message.role === 'user'
                                    ? theme.palette.primary.contrastText
                                    : theme.palette.text.primary,
                                borderRadius: message.role === 'user'
                                    ? '16px 4px 4px 16px'
                                    : '4px 16px 16px 4px',
                                boxShadow: message.role === 'user'
                                    ? `0 2px 5px ${theme.palette.mode === 'dark' ? 'rgba(0,0,150,0.5)' : 'rgba(0,0,150,0.3)'}`
                                    : `0 2px 5px ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                ...(message.role === 'user' && {
                                    mr: 0,
                                    ml: 'auto',
                                }),
                                ...(message.role !== 'user' && {
                                    ml: 0,
                                    mr: 'auto',
                                }),
                                animation: 'fadeIn 0.3s ease-in',
                                '@keyframes fadeIn': {
                                    from: { opacity: 0, transform: 'translateY(10px)' },
                                    to: { opacity: 1, transform: 'translateY(0)' }
                                }
                            }}
                        >
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                                {message.text}
                            </Typography>
                        </Paper>
                    </ListItem>
                ))}
                {isLoading && (
                    <ListItem
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            px: 1,
                            py: 1,
                        }}
                    >
                        <Paper
                            elevation={1}
                            sx={{
                                p: 1.5,
                                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'background.paper',
                                borderRadius: '4px 16px 16px 4px',
                                boxShadow: `0 2px 5px ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                ml: 0,
                                mr: 'auto',
                                animation: 'fadeIn 0.3s ease-in'
                            }}
                        >
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Box sx={{
                                    width: 4,
                                    height: 4,
                                    bgcolor: 'text.secondary',
                                    borderRadius: '50%',
                                    animation: 'dot 1.4s infinite ease-in-out both'
                                }}
                                    style={{ animationDelay: '0s' }}
                                />
                                <Box sx={{
                                    width: 4,
                                    height: 4,
                                    bgcolor: 'text.secondary',
                                    borderRadius: '50%',
                                    animation: 'dot 1.4s infinite ease-in-out both'
                                }}
                                    style={{ animationDelay: '0.2s' }}
                                />
                                <Box sx={{
                                    width: 4,
                                    height: 4,
                                    bgcolor: 'text.secondary',
                                    borderRadius: '50%',
                                    animation: 'dot 1.4s infinite ease-in-out both'
                                }}
                                    style={{ animationDelay: '0.4s' }}
                                />
                            </Box>
                        </Paper>
                    </ListItem>
                )}
                <div ref={messagesEndRef} />
            </List>

            <Divider sx={{ bgcolor: theme.palette.divider }} />

            <Box sx={{
                p: 2,
                pr: 1,
                display: 'flex',
                gap: 1,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper'
            }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    placeholder="输入消息..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 20,
                            bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                            color: theme.palette.text.primary,
                            '&:hover': {
                                bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.200'
                            },
                            '&.Mui-focused': {
                                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'common.white',
                                boxShadow: `0 0 0 2px ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,82,204,0.2)'}`
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.mode === 'dark' ? 'grey.600' : 'grey.300'
                            }
                        }
                    }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={handleSend}
                    sx={{
                        minWidth: 40,
                        p: 1,
                        borderRadius: '50%',
                        boxShadow: 2,
                        '&:hover': { boxShadow: 4 },
                        bgcolor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText
                    }}
                    disabled={!inputValue.trim()}
                >
                    <SendIcon fontSize="small" />
                </Button>
            </Box>
        </Box>
    );
};

interface ChatPageProps {
    open: boolean;
    onClose: () => void;
}

const ChatPage: React.FC<ChatPageProps> = ({ open, onClose }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            fullScreen={fullScreen}
            PaperProps={{
                sx: {
                    borderRadius: { xs: 0, sm: 2 },
                    width: '100%',
                    maxWidth: 'md',
                    height: { xs: '100vh', sm: '80vh' },
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: "40vw",
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper'
                }
            }}
            sx={{
                display: "flex",
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%'
            }}
        >
            <DialogContent sx={{ p: 0, flexGrow: 1 }}>
                <ChatDialog />
            </DialogContent>
        </Dialog>
    );
};

export default ChatPage;