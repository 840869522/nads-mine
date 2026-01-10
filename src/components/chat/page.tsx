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
import { apiClientWithToken } from "@/utils/axios";
import { resolveMetadata } from "next/dist/lib/metadata/resolve-metadata";

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

        if (!document.getElementById('chat-loading-animations')) {
            const style = document.createElement('style');
            style.id = 'chat-loading-animations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1); }
                }
                @keyframes wave {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
            `;
            document.head.appendChild(style);
        }
        return () => {
            const existingStyle = document.getElementById('chat-loading-animations');
            if (existingStyle) {
                document.head.removeChild(existingStyle);
            }
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        // 添加用户消息
        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            role: 'user',
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        const assistantMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
            id: assistantMessageId,
            text: '',
            role: 'assistant',
        }]);
        streamPostRequest(
            "/chat/achat",
            { "message": userMessage.text },
            (chunk: string) => {
                console.log(chunk);
		// 更新助手消息内容
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                        ? { ...msg, text: msg.text + chunk }
                        : msg
                ));
            },
            (error: Error) => {
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                        ? { ...msg, text: `错误：${error.message}` }
                        : msg
                ));
                console.error("流式请求错误:", error);
            }
        ).finally(() => {
            setIsLoading(false);
        });
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                                <div className="markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                            code({ node, inline, className, children, ...props }) {
                                                const match = /language-(\w+)/.exec(className || '')
                                                return !inline && match ? (
                                                    <Box
                                                        sx={{
                                                            overflowX: 'auto',
                                                            borderRadius: 1,
                                                            bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.100',
                                                            p: 1,
                                                            mt: 1,
                                                            mb: 1
                                                        }}
                                                    >
                                                        <pre style={{ margin: 0 }}>
                                                            <code className={className} {...props}>
                                                                {children}
                                                            </code>
                                                        </pre>
                                                    </Box>
                                                ) : (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            },
                                            // 自定义标题样式
                                            h1: ({ children }) => (
                                                <Typography variant="h6" component="h1" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                                                    {children}
                                                </Typography>
                                            ),
                                            h2: ({ children }) => (
                                                <Typography variant="h6" component="h2" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                                                    {children}
                                                </Typography>
                                            ),
                                            h3: ({ children }) => (
                                                <Typography variant="subtitle1" component="h3" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                                                    {children}
                                                </Typography>
                                            ),
                                            // 自定义列表样式
                                            ul: ({ children }) => (
                                                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                                                    {children}
                                                </ul>
                                            ),
                                            ol: ({ children }) => (
                                                <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
                                                    {children}
                                                </ol>
                                            ),
                                            // 自定义表格样式
                                            table: ({ children }) => (
                                                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', my: 2 }}>
                                                    {children}
                                                </Box>
                                            ),
                                            th: ({ children }) => (
                                                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left', backgroundColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                                                    {children}
                                                </th>
                                            ),
                                            td: ({ children }) => (
                                                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                    {children}
                                                </td>
                                            ),
					    think: ({children}) => (
						<div style={{
                                                    fontSize: '0.85em',
                                                    color: theme.palette.mode === 'dark' ? theme.palette.grey[500] : theme.palette.grey[600],
                                                    fontStyle: 'italic',
                                                    display: 'inline-block',
                                                    padding: '0 2px',
                                                    margin: '0 1px',
                                                    borderRadius: '2px'
                                                }}>
                                                    {children}
                                                </div>
					    )
                                        }}
                                        children={message.text}
                                    />
                                </div>
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
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                py: 0.5
                            }}>
                                {/* 环形加载器 */}
                                <Box sx={{
                                    width: 24,
                                    height: 24,
                                    border: '2px solid',
                                    borderColor: 'primary.100',
                                    borderTopColor: 'primary.main',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    '@keyframes spin': {
                                        '0%': { transform: 'rotate(0deg)' },
                                        '100%': { transform: 'rotate(360deg)' }
                                    }
                                }} />

                                {/* 文字提示 */}
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: 'text.secondary',
                                        fontWeight: 500,
                                        letterSpacing: '0.5px'
                                    }}
                                >
                                    正在思考中...
                                </Typography>

                                {/* 微型呼吸点动画 */}
                                <Box sx={{
                                    display: 'flex',
                                    gap: 0.5
                                }}>
                                    {[0, 0.1, 0.2].map((delay, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                width: 4,
                                                height: 4,
                                                bgcolor: 'text.secondary',
                                                borderRadius: '50%',
                                                opacity: 0.3,
                                                animation: `pulse 1.5s ${delay}s infinite cubic-bezier(0.4, 0, 0.6, 1)`,
                                                '@keyframes pulse': {
                                                    '0%, 100%': { opacity: 0.3, transform: 'scale(0.8)' },
                                                    '50%': { opacity: 1, transform: 'scale(1)' }
                                                }
                                            }}
                                        />
                                    ))}
                                </Box>
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
