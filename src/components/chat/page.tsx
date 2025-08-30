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

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'other';
    timestamp: Date;
}

const ChatDialog = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: '你好！有什么可以帮助你的吗？',
            sender: 'other',
            timestamp: new Date()
        },
        {
            id: "2",
            text:"adasd",
            sender: "user",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (inputValue.trim()) {
            const newMessage: Message = {
                id: Date.now().toString(),
                text: inputValue,
                sender: 'user',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, newMessage]);
            setInputValue('');

            // 模拟回复
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    text: '这是自动回复示例',
                    sender: 'other',
                    timestamp: new Date()
                }]);
            }, 1000);
        }
    };

    useEffect(()=>{
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    },[messages]);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

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
                            flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                            justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                            px: 1, 
                            py: 1,
                        }}
                    >
                        <Paper
                            elevation={1}
                            sx={{
                                p: 1.5,
                                bgcolor: message.sender === 'user'
                                    ? theme.palette.primary.main
                                    : theme.palette.mode === 'dark'
                                        ? 'grey.800'
                                        : 'background.paper',
                                color: message.sender === 'user'
                                    ? theme.palette.primary.contrastText
                                    : theme.palette.text.primary,
                                borderRadius: message.sender === 'user'
                                    ? '16px 4px 4px 16px'
                                    : '4px 16px 16px 4px',
                                boxShadow: message.sender === 'user'
                                    ? `0 2px 5px ${theme.palette.mode === 'dark' ? 'rgba(0,0,150,0.5)' : 'rgba(0,0,150,0.3)'}`
                                    : `0 2px 5px ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                ...(message.sender === 'user' && {
                                    mr: 0,
                                    ml: 'auto',
                                }),
                                ...(message.sender !== 'user' && {
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
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    textAlign: 'right',
                                    mt: 0.5,
                                    color: message.sender === 'user'
                                        ? theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.7)'
                                        : theme.palette.text.secondary
                                }}
                            >
                                {formatTime(message.timestamp)}
                            </Typography>
                        </Paper>
                    </ListItem>
                ))}
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