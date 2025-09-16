import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Modal, Box, Typography, CircularProgress, Alert,
    Select, MenuItem, FormControl, InputLabel, Button,
    Accordion, AccordionSummary, AccordionDetails, Tabs, Tab,
    Table, TableBody, TableCell, TableHead, TableRow, Paper,
    LinearProgress, SelectChangeEvent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// --- Types ---
interface Host {
    name: string;
    indexName: string;
    ipAddress: string;
}

interface PlaybackModalProps {
    open: boolean;
    onClose: () => void;
    hosts: Host[];
}

type TimeMode = 'fixed' | 'real';

interface Command {
    ts: string;
    cwd: string;
    command: string;
    sleep_until_next_ms?: number;
}

interface GroupData {
    [groupName: string]: Command[];
}

interface HostData {
    status: 'success' | 'error';
    groups: GroupData;
    message?: string;
}

interface ApiResponse {
    [indexName: string]: HostData;
}

type PlayStatus = 'stopped' | 'playing' | 'paused' | 'finished';

interface PlaybackState {
    status: PlayStatus;
    currentIndex: number;
    log: string[];
}

// --- Helper Functions ---
function formatDuration(ms: number): string {
    if (ms < 0) return "0s";
    if (ms === 0) return "0s";

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    if (parts.length > 0) return parts.join(' ');

    return `${ms}ms`;
}

// --- Constants ---
const MODAL_STYLE = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80vw',
    maxWidth: '1200px',
    height: '90vh',
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
    display: 'flex',
    flexDirection: 'column',
};

const TERMINAL_STYLE = {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'monospace',
    p: 2,
    mt: 2,
    borderRadius: 1,
    height: '200px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
};


// --- Sub-Components ---

const PlaybackTerminal = ({
                              playbackState,
                              onPlay,
                              onPause,
                              onStop,
                              onClose,
                              totalCommands
                          }: {
    playbackState: PlaybackState,
    onPlay: () => void,
    onPause: () => void,
    onStop: () => void,
    onClose: () => void,
    totalCommands: number
}) => {

    if (playbackState.status === 'stopped') {
        return <Button onClick={onPlay} variant="contained" sx={{ mt: 1 }}>开始回放</Button>;
    }

    const { status, currentIndex, log } = playbackState;
    const isPlaying = status === 'playing';
    const isPaused = status === 'paused';
    const isFinished = status === 'finished';

    const progress = totalCommands > 0 ? ((currentIndex) / totalCommands) * 100 : 0;

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">
                    进度: {currentIndex} / {totalCommands}
                </Typography>
                <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                {isPlaying && <Button onClick={onPause} variant="outlined">暂停</Button>}
                {isPaused && <Button onClick={onPlay} variant="outlined">继续</Button>}
                {!isFinished && <Button onClick={onStop} variant="outlined" color="error">中止</Button>}
            </Box>
            <Paper sx={TERMINAL_STYLE}>
                {log.join('\n')}
                {isFinished && '\n\n[--- 回放结束 ---]'}
            </Paper>
            {isFinished && <Button onClick={onClose} sx={{mt: 1}}>关闭</Button>}
        </Box>
    );
};


const HostDisplay = ({
                         host,
                         data,
                         playbackStates,
                         onPlaybackAction
                     }: {
    host: Host,
    data: HostData,
    playbackStates: Record<string, PlaybackState>,
    onPlaybackAction: (key: string, action: 'play' | 'pause' | 'stop' | 'close') => Promise<void>
}) => {
    const [activeTab, setActiveTab] = useState(0);

    if (data.status === 'error') {
        return <Alert severity="error">加载 {host.name} 数据失败: {data.message}</Alert>;
    }

    const groupNames = Object.keys(data.groups);
    if (groupNames.length === 0) {
        return <Typography>没有找到任何指令记录。</Typography>
    }

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const getGroupKey = (groupName: string) => `${host.indexName}__${groupName}`;

    return (
        <Box>
            <Tabs value={activeTab} onChange={handleTabChange}>
                {groupNames.map(name => <Tab label={name} key={name} />)}
            </Tabs>
            {groupNames.map((groupName, index) => {
                const groupKey = getGroupKey(groupName);
                const commands = data.groups[groupName];
                const state = playbackStates[groupKey] || { status: 'stopped', currentIndex: 0, log: [] };

                return (
                    <Box role="tabpanel" hidden={activeTab !== index} key={groupKey} sx={{ pt: 2 }}>
                        <Paper variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>时间戳</TableCell>
                                        <TableCell>工作目录</TableCell>
                                        <TableCell>命令</TableCell>
                                        <TableCell align="right">下一条延时</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {commands.map((cmd, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{new Date(cmd.ts).toLocaleString()}</TableCell>
                                            <TableCell>{cmd.cwd}</TableCell>
                                            <TableCell><code>{cmd.command}</code></TableCell>
                                            <TableCell align="right">{formatDuration(cmd.sleep_until_next_ms ?? 0)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Paper>
                        <PlaybackTerminal
                            playbackState={state}
                            totalCommands={commands.length}
                            onPlay={() => onPlaybackAction(groupKey, 'play')}
                            onPause={() => onPlaybackAction(groupKey, 'pause')}
                            onStop={() => onPlaybackAction(groupKey, 'stop')}
                            onClose={() => onPlaybackAction(groupKey, 'close')}
                        />
                    </Box>
                )
            })}
        </Box>
    );
};


// --- Main Component ---

export const PlaybackModal = ({ open, onClose, hosts }: PlaybackModalProps) => {
    const [groupBy, setGroupBy] = useState<'user' | 'session'>('user');
    const [filterNoise, setFilterNoise] = useState(true);
    const [timeMode, setTimeMode] = useState<TimeMode>('fixed');
    const [fixedInterval, setFixedInterval] = useState(1);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ApiResponse | null>(null);
    const [playbackStates, setPlaybackStates] = useState<Record<string, PlaybackState>>({});

    const hostMap = useMemo(() => hosts.reduce((acc, h) => ({...acc, [h.indexName]: h }), {} as Record<string, Host>), [hosts]);
    const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

    const executeRemoteCommand = async (host: Host, command: Command, indexName: string) => {
        try {
            const res = await fetch('/api/execute-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetHost: host.ipAddress.split('/')[0],
                    targetPort: 8000,
                    cwd: command.cwd,
                    command: command.command,
                    indexName: indexName
                })
            });

            const responseText = await res.text();
            try {
                const result = JSON.parse(responseText);
                if (result.status === 'fallback') {
                    return result.stdout;
                }
                if (res.ok) {
                    return result.stdout || result.stderr || "";
                }
                return `Error: ${result.detail || result.error || responseText}`;
            } catch (e) {
                // This catches JSON.parse errors, meaning the response was not JSON (e.g., HTML 404 page)
                return `[Error] Received invalid response from server:\n${responseText}`;
            }
        } catch (e: any) {
            // This catches network errors (e.g., fetch failed to connect)
            return `[Error] Failed to execute command: ${e.message}`;
        }
    }

    // State-driven playback engine
    useEffect(() => {
        const activeKeys = Object.keys(playbackStates).filter(k => playbackStates[k].status === 'playing');

        activeKeys.forEach(key => {
            if (timeoutRef.current[key]) return;

            const state = playbackStates[key];
            const [indexName, groupName] = key.split('__');
            const host = hostMap[indexName];
            const commands = data?.[indexName]?.groups[groupName];

            if (!commands || !host || state.currentIndex >= commands.length) {
                handlePlaybackAction(key, 'stop');
                return;
            }

            const commandToExecute = commands[state.currentIndex];
            const delay = commandToExecute.sleep_until_next_ms ?? fixedInterval * 1000;

            timeoutRef.current[key] = setTimeout(async () => {
                const output = await executeRemoteCommand(host, commandToExecute, indexName);

                setPlaybackStates(s => {
                    if (s[key]?.status !== 'playing') {
                        delete timeoutRef.current[key];
                        return s;
                    }
                    const currentLog = s[key]?.log || [];
                    const newLog = output ? [...currentLog, `$ ${commandToExecute.command}`, output] : [...currentLog, `$ ${commandToExecute.command}`];
                    delete timeoutRef.current[key];
                    return { ...s, [key]: { ...s[key], log: newLog, currentIndex: s[key].currentIndex + 1 } };
                });
            }, delay);
        });

        return () => {
            Object.values(timeoutRef.current).forEach(clearTimeout);
        }
    }, [playbackStates, data, hostMap, fixedInterval]);


    const handlePlaybackAction = async (key: string, action: 'play' | 'pause' | 'stop' | 'close') => {
        const currentState = playbackStates[key] || { status: 'stopped', currentIndex: 0, log: [] };

        if (action === 'play') {
            let newState = { ...currentState, status: 'playing' as PlayStatus };
            // If starting from the beginning, execute the first command immediately
            if (currentState.status === 'stopped' || currentState.status === 'finished') {
                const [indexName, groupName] = key.split('__');
                const host = hostMap[indexName];
                const commands = data?.[indexName]?.groups[groupName];
                if (commands && commands.length > 0 && host) {
                    const firstCommand = commands[0];
                    const output = await executeRemoteCommand(host, firstCommand, indexName);
                    newState = {
                        status: 'playing',
                        currentIndex: 1,
                        log: [`$ ${firstCommand.command}`, output]
                    };
                } else {
                    newState = { status: 'playing', currentIndex: 0, log: [] };
                }
            }
            setPlaybackStates(s => ({ ...s, [key]: newState }));
        } else {
            // Handle pause, stop, close
            if (timeoutRef.current[key]) {
                clearTimeout(timeoutRef.current[key]);
                delete timeoutRef.current[key];
            }
            let newStatus: PlayStatus = 'paused';
            if (action === 'stop') newStatus = 'finished';
            if (action === 'close') newStatus = 'stopped';

            let finalState = { ...currentState, status: newStatus };
            if (action === 'close') {
                finalState = { status: 'stopped', currentIndex: 0, log: [] };
            }
            setPlaybackStates(s => ({ ...s, [key]: finalState }));
        }
    };

    const handlePlayAll = () => {
        if (!data) return;
        for (const host of hosts) {
            const hostData = data[host.indexName];
            if (hostData?.groups) {
                for (const groupName in hostData.groups) {
                    const key = `${host.indexName}__${groupName}`;
                    handlePlaybackAction(key, 'play');
                }
            }
        }
    };

    const fetchData = useCallback(async () => {
        if (!open || hosts.length === 0) return;
        setIsLoading(true);
        setError(null);
        setData(null);
        setPlaybackStates({});
        try {
            const response = await fetch('/api/playback-commands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ indexNames: hosts.map(h=>h.indexName), groupBy, filterNoise, timeMode, fixedIntervalSeconds: fixedInterval }),
            });
            if (!response.ok) throw new Error(`API 请求失败: ${response.status}`);
            const result: ApiResponse = await response.json();
            setData(result);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [open, hosts, groupBy, filterNoise, timeMode, fixedInterval]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={MODAL_STYLE}>
                <Typography variant="h6" component="h2">指令回放</Typography>

                <Box sx={{ display: 'flex', gap: 2, my: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button onClick={handlePlayAll} variant="contained" color="primary" startIcon={<PlayArrowIcon />}>全部回放</Button>
                    <FormControl size="small">
                        <InputLabel>分组方式</InputLabel>
                        <Select value={groupBy} label="分组方式" onChange={(e: SelectChangeEvent<'user' | 'session'>) => setGroupBy(e.target.value as any)}>
                            <MenuItem value="user">按用户</MenuItem>
                            <MenuItem value="session">按会话</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small">
                        <InputLabel>过滤噪音</InputLabel>
                        <Select value={String(filterNoise)} label="过滤噪音" onChange={e => setFilterNoise(e.target.value === 'true')}>
                            <MenuItem value="true">是</MenuItem>
                            <MenuItem value="false">否</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small">
                        <InputLabel>回放模式</InputLabel>
                        <Select value={timeMode} label="回放模式" onChange={(e: SelectChangeEvent<TimeMode>) => setTimeMode(e.target.value as any)}>
                            <MenuItem value="fixed">固定间隔</MenuItem>
                            <MenuItem value="real">真实时间</MenuItem>
                        </Select>
                    </FormControl>
                    {timeMode === 'fixed' && (
                        <FormControl size="small" sx={{minWidth: 120}}>
                            <InputLabel>间隔(秒)</InputLabel>
                            <Select value={String(fixedInterval)} label="间隔(秒)" onChange={e => setFixedInterval(Number(e.target.value))}>
                                <MenuItem value={1}>1s</MenuItem>
                                <MenuItem value={2}>2s</MenuItem>
                                <MenuItem value={5}>5s</MenuItem>
                            </Select>
                        </FormControl>
                    )}
                </Box>

                <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
                    {isLoading && <CircularProgress />}
                    {error && <Alert severity="error">{error}</Alert>}
                    {data && hosts.map(host => (
                        <Accordion key={host.indexName} TransitionProps={{ unmountOnExit: true }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>{host.name} ({host.ipAddress})</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {data[host.indexName] ? (
                                    <HostDisplay
                                        host={host}
                                        data={data[host.indexName]}
                                        playbackStates={playbackStates}
                                        onPlaybackAction={handlePlaybackAction}
                                    />
                                ) : <CircularProgress size={20} />}
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
                <Button onClick={onClose} sx={{ mt: 2, alignSelf: 'flex-end' }}>关闭</Button>
            </Box>
        </Modal>
    );
};