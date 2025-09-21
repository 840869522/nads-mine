"use client";
import { Dialog, DialogContent, Drawer, useMediaQuery } from "@mui/material";
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
    IconButton
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { streamPostRequest } from "@/utils/stream"
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { fixIncompleteMarkdown, isSafeToRender } from "@/utils/markdwonFixer";

interface Message {
    id: string;
    text: string;
    role: 'user' | 'assistant';
}

const ThinkComponent = ({ children }: { children: React.ReactNode }) => {
    const theme = useTheme();
    const lighterColor = theme.palette.mode === 'dark'
        ? theme.palette.grey[600]
        : theme.palette.grey[500];

    return (
        <span style={{ color: lighterColor }}>
            {children}
        </span>
    );
};

const ChatDialog = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: '# 你好！有什么可以帮助你的吗？',
            role: 'assistant'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource>(null);
    const theme = useTheme();
    const [pendingStream, setPendingStream] = useState<string>('');
    const streamUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateRef = useRef<number | null>(null);

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
        if (!inputValue.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            role: 'user',
        };

        setMessages((prev) => [...prev, newMessage]);
        setInputValue('');
        setIsLoading(true);

        const currentMessage = { current: '' };
        setPendingStream('');
        if (streamUpdateTimeout.current) {
            clearTimeout(streamUpdateTimeout.current);
        }

        streamPostRequest(
            '/chat/chat',
            { message: newMessage.text },
            (chunk) => {
                currentMessage.current += chunk;
                setPendingStream(prev => prev + chunk);
                if (streamUpdateTimeout.current) {
                    clearTimeout(streamUpdateTimeout.current);
                }
                const lastTime = lastUpdateRef.current ?? 0
                const delay = Math.min(300, Math.max(50, 100 - (Date.now() - lastTime)))
                lastUpdateRef.current = Date.now();
                streamUpdateTimeout.current = setTimeout(() => {
                    // 1. 优先修复语法
                    const fixedText = fixIncompleteMarkdown(currentMessage.current);

                    // 2. 仅当处于安全状态时才更新（可选）
                    // if (isSafeToRender(fixedText)) {
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage?.role === 'assistant') {
                            lastMessage.text = fixedText;
                        } else {
                            newMessages.push({
                                id: (Date.now() + 1).toString(),
                                role: 'assistant',
                                text: fixedText,
                            });
                        }
                        return newMessages;
                    });
                    setPendingStream(''); // 清空待处理流
                    // }
                }, delay);
            },
            (error) => {
                setMessages((prev) => [
                    ...prev,
                    { id: (Date.now() + 1).toString(), role: 'assistant', text: `错误：${error.message}` },
                ]);
                setIsLoading(false);
            }
        ).finally(() => setIsLoading(false));
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
                            {message.role === 'assistant' ? (
                                <Box className="markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                            think: ThinkComponent,
                                            table: ({ children }) => (
                                                <table className="custom-markdown-table">
                                                    {children}
                                                </table>
                                            ),
                                            thead: ({ children }) => (
                                                <thead className="custom-markdown-thead">
                                                    {children}
                                                </thead>
                                            ),
                                            tbody: ({ children }) => (
                                                <tbody className="custom-markdown-tbody">
                                                    {children}
                                                </tbody>
                                            ),
                                            tr: ({ children }) => (
                                                <tr className="custom-markdown-tr">
                                                    {children}
                                                </tr>
                                            ),
                                            th: ({ children }) => (
                                                <th className="custom-markdown-th" style={{
                                                    padding: '0.6rem 1rem',
                                                    textAlign: 'left',
                                                    backgroundColor: '#f5f5f5',
                                                    fontWeight: '600',
                                                    borderBottom: '2px solid #e0e0e0'
                                                }}>
                                                    {children}
                                                </th>
                                            ),
                                            td: ({ children }) => (
                                                <td className="custom-markdown-td" style={{
                                                    padding: '0.6rem 1rem',
                                                    borderBottom: '1px solid #e0e0e0',
                                                    wordBreak: 'break-word',
                                                    whiteSpace: 'normal'
                                                }}>
                                                    {children}
                                                </td>
                                            )
                                        }}
                                    >
                                        {typeof message.text === 'string' ? message.text : String(message.text)}
                                    </ReactMarkdown>
                                </Box>
                            ) : (
                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                    {message.text}
                                </Typography>
                            )}
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
    width?: string
}

const ChatPage: React.FC<ChatPageProps> = ({ open, onClose, width }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Drawer
            open={open}
            onClose={onClose}
            variant="persistent"
            anchor="right"
            PaperProps={{
                sx: {
                    borderRadius: { xs: 0, sm: 2 },
                    maxWidth: 'md',
                    height: { xs: '100vh', sm: '80vh' },
                    display: 'flex',
                    flexDirection: 'column',
                    width: width,
                    minHeight: "100vh",
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'background.paper',
                    overflow: "hidden"
                }
            }}
            sx={{
                display: "flex",
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}
        >
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                borderBottom: 1,
                borderColor: theme.palette.divider,
                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100'
            }}>
                <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
                    聊天窗口
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent sx={{ p: 0, flexGrow: 1 }}>
                <ChatDialog />
            </DialogContent>
        </Drawer>
    );
};

export default ChatPage;