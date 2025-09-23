import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Modal, Box, Typography, CircularProgress, Alert,
    Select, MenuItem, FormControl, InputLabel, Button,
    Accordion, AccordionSummary, AccordionDetails, Tabs, Tab,
    Table, TableBody, TableCell, TableHead, TableRow, Paper,
    LinearProgress, SelectChangeEvent,TableContainer, ToggleButtonGroup, ToggleButton,
    Slider, FormControlLabel, Switch
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

interface CommandHistoryEntry {
    command: string;
    output: string;
}

interface PlaybackState {
    status: PlayStatus;
    currentIndex: number;
    log: string[];
    history: CommandHistoryEntry[];
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

function historyToLog(history: CommandHistoryEntry[]): string[] {
    return history.flatMap(entry => {
        const lines = [`$ ${entry.command}`];
        if (entry.output) {
            lines.push(entry.output);
        }
        return lines;
    });
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

const createDefaultPlaybackState = (): PlaybackState => ({
    status: 'stopped',
    currentIndex: 0,
    log: [],
    history: [],
});


// --- Sub-Components ---

const PlaybackTerminal = ({
                              playbackState,
                              onPlay,
                              onPause,
                              onStop,
                              onClose,
                              totalCommands,
                              speed,
                              onSpeedChange,
                              onJump
                          }: {
    playbackState: PlaybackState,
    onPlay: () => void,
    onPause: () => void,
    onStop: () => void,
    onClose: () => void,
    totalCommands: number,
    speed: number,
    onSpeedChange: (speed: number) => void,
    onJump: (targetIndex: number) => void | Promise<void>
}) => {
    const [sliderValue, setSliderValue] = useState<number>(playbackState.currentIndex);

    useEffect(() => {
        setSliderValue(playbackState.currentIndex);
    }, [playbackState.currentIndex]);

    if (playbackState.status === 'stopped') {
        return <Button onClick={onPlay} variant="contained" sx={{ mt: 1 }}>开始回放</Button>;
    }

    const { status, currentIndex, log } = playbackState;
    const isPlaying = status === 'playing';
    const isPaused = status === 'paused';
    const isFinished = status === 'finished';

    const progress = totalCommands > 0 ? ((currentIndex) / totalCommands) * 100 : 0;

    const speedOptions = [1, 2, 4];

    const handleSpeedToggle = (_: React.MouseEvent<HTMLElement>, newSpeed: number | null) => {
        if (newSpeed !== null) {
            onSpeedChange(newSpeed);
        }
    };

    const canUseSlider = totalCommands > 0;

    const handleSliderChange = (_: Event, value: number | number[]) => {
        if (Array.isArray(value)) return;
        setSliderValue(value);
    };

    const handleSliderCommit = (_: React.SyntheticEvent | Event, value: number | number[]) => {
        if (Array.isArray(value)) return;
        onJump(value);
    };

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">
                    进度: {currentIndex} / {totalCommands}
                </Typography>
                <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {isPlaying && <Button onClick={onPause} variant="outlined">暂停</Button>}
                    {isPaused && <Button onClick={onPlay} variant="outlined">继续</Button>}
                    {!isFinished && <Button onClick={onStop} variant="outlined" color="error">中止</Button>}
                </Box>
                <ToggleButtonGroup
                    exclusive
                    value={speed}
                    size="small"
                    onChange={handleSpeedToggle}
                    aria-label="播放速度"
                >
                    {speedOptions.map(option => (
                        <ToggleButton key={option} value={option} aria-label={`${option}x`}>
                            {option}x
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>
            {canUseSlider && (
                <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        拖动滑块以快速跳转到指定指令位置（顶部开关可控制是否补执行前序命令）
                    </Typography>
                    <Slider
                        value={Math.min(sliderValue, totalCommands)}
                        min={0}
                        max={totalCommands}
                        step={1}
                        marks
                        size="small"
                        onChange={handleSliderChange}
                        onChangeCommitted={handleSliderCommit}
                        valueLabelDisplay="auto"
                    />
                </Box>
            )}
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
                         playbackSpeeds,
                         onPlaybackAction,
                         onSpeedChange,
                         onJump
                     }: {
    host: Host,
    data: HostData,
    playbackStates: Record<string, PlaybackState>,
    playbackSpeeds: Record<string, number>,
    onPlaybackAction: (key: string, action: 'play' | 'pause' | 'stop' | 'close') => Promise<void>,
    onSpeedChange: (key: string, speed: number) => void,
    onJump: (key: string, targetIndex: number) => Promise<void>
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
                const state = playbackStates[groupKey] || createDefaultPlaybackState();

                return (
                    <Box role="tabpanel" hidden={activeTab !== index} key={groupKey} sx={{ pt: 2 }}>
                        <TableContainer component={Paper} sx={{ maxHeight: 360, overflow: 'auto' }}>
                            <Table
                                size="small"
                                stickyHeader
                                sx={{
                                    // 表头样式
                                    '& .MuiTableCell-stickyHeader': {
                                        backgroundColor: (t) =>
                                            t.palette.mode === 'dark' ? t.palette.grey[900] : t.palette.grey[100],
                                        color: 'text.primary',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        py: 0.75, // 减小高度
                                        borderBottom: (t) => `1px solid ${t.palette.divider}`,
                                    },
                                    // 防止表头/单元格文字竖排
                                    '& th, & td': { whiteSpace: 'nowrap' },
                                    // 表格整体更紧凑一些
                                    '& td': { py: 0.5 },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ width: 170 }}>时间戳</TableCell>
                                        <TableCell sx={{ width: 140 }}>工作目录</TableCell>
                                        <TableCell>命令</TableCell>
                                        <TableCell sx={{ width: 100 }} align="right">下一条延时</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {commands.map((cmd, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{new Date(cmd.ts).toLocaleString()}</TableCell>
                                            <TableCell>{cmd.cwd}</TableCell>
                                            <TableCell>
                                                <code style={{ wordBreak: 'break-word' }}>{cmd.command}</code>
                                            </TableCell>
                                            <TableCell align="right">
                                                {formatDuration(cmd.sleep_until_next_ms ?? 0)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <PlaybackTerminal
                            playbackState={state}
                            totalCommands={commands.length}
                            onPlay={() => onPlaybackAction(groupKey, 'play')}
                            onPause={() => onPlaybackAction(groupKey, 'pause')}
                            onStop={() => onPlaybackAction(groupKey, 'stop')}
                            onClose={() => onPlaybackAction(groupKey, 'close')}
                            speed={playbackSpeeds[groupKey] ?? 1}
                            onSpeedChange={(speed) => onSpeedChange(groupKey, speed)}
                            onJump={(target) => onJump(groupKey, target)}
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
    const [replayOnJump, setReplayOnJump] = useState(true);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ApiResponse | null>(null);
    const [playbackStates, setPlaybackStates] = useState<Record<string, PlaybackState>>({});
    const [playbackSpeeds, setPlaybackSpeeds] = useState<Record<string, number>>({});
    const playbackStatesRef = useRef(playbackStates);

    const hostMap = useMemo(() => hosts.reduce((acc, h) => ({...acc, [h.indexName]: h }), {} as Record<string, Host>), [hosts]);
    const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

    useEffect(() => {
        playbackStatesRef.current = playbackStates;
    }, [playbackStates]);

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
            const speed = playbackSpeeds[key] ?? 1;
            const adjustedDelay = speed > 0 ? delay / speed : delay;

            timeoutRef.current[key] = setTimeout(async () => {
                const output = await executeRemoteCommand(host, commandToExecute, indexName);

                setPlaybackStates(s => {
                    if (s[key]?.status !== 'playing') {
                        delete timeoutRef.current[key];
                        return s;
                    }
                    const previousState = s[key] ?? createDefaultPlaybackState();
                    const prevHistory = previousState.history ?? [];
                    const entry: CommandHistoryEntry = { command: commandToExecute.command, output: output || '' };
                    const nextHistory = [...prevHistory, entry];
                    const nextLog = historyToLog(nextHistory);
                    delete timeoutRef.current[key];
                    return {
                        ...s,
                        [key]: {
                            ...previousState,
                            history: nextHistory,
                            log: nextLog,
                            currentIndex: previousState.currentIndex + 1,
                        }
                    };
                });
            }, adjustedDelay);
        });
    }, [playbackStates, playbackSpeeds, data, hostMap, fixedInterval]);

    useEffect(() => {
        return () => {
            Object.keys(timeoutRef.current).forEach(key => {
                clearTimeout(timeoutRef.current[key]);
                delete timeoutRef.current[key];
            });
        };
    }, []);


    const handlePlaybackAction = async (key: string, action: 'play' | 'pause' | 'stop' | 'close') => {
        const currentState = playbackStates[key] || createDefaultPlaybackState();

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
                        history: [{ command: firstCommand.command, output: output || '' }],
                        log: historyToLog([{ command: firstCommand.command, output: output || '' }])
                    };
                } else {
                    newState = { ...createDefaultPlaybackState(), status: 'playing' };
                }
            }
            const ensuredHistory = newState.history ?? currentState.history ?? [];
            const ensuredLog = newState.log ?? historyToLog(ensuredHistory);
            setPlaybackStates(s => ({ ...s, [key]: { ...newState, history: ensuredHistory, log: ensuredLog } }));
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
                finalState = createDefaultPlaybackState();
            }
            const ensuredHistory = finalState.history ?? currentState.history ?? [];
            const ensuredLog = finalState.log ?? historyToLog(ensuredHistory);
            setPlaybackStates(s => ({ ...s, [key]: { ...finalState, history: ensuredHistory, log: ensuredLog } }));
        }
    };

    const handleSpeedChange = (key: string, speed: number) => {
        if (timeoutRef.current[key]) {
            clearTimeout(timeoutRef.current[key]);
            delete timeoutRef.current[key];
        }
        setPlaybackSpeeds(s => ({ ...s, [key]: speed }));
        if (playbackStatesRef.current[key]?.status === 'playing') {
            setPlaybackStates(s => ({ ...s, [key]: { ...s[key] } }));
        }
    };

    const handleJumpToIndex = async (key: string, rawTargetIndex: number) => {
        const [indexName, groupName] = key.split('__');
        const host = hostMap[indexName];
        const commands = data?.[indexName]?.groups[groupName];
        if (!commands || !host) return;

        const targetIndex = Math.max(0, Math.min(rawTargetIndex, commands.length));
        const currentState = playbackStatesRef.current[key] || createDefaultPlaybackState();

        if (targetIndex === currentState.currentIndex) return;

        if (timeoutRef.current[key]) {
            clearTimeout(timeoutRef.current[key]);
            delete timeoutRef.current[key];
        }

        const wasPlaying = currentState.status === 'playing';

        if (!replayOnJump) {
            const nextHistory = targetIndex <= currentState.history.length
                ? currentState.history.slice(0, targetIndex)
                : [...currentState.history];
            const newStatus: PlayStatus = targetIndex >= commands.length
                ? 'finished'
                : (wasPlaying ? 'playing' : 'paused');
            setPlaybackStates(s => ({
                ...s,
                [key]: {
                    ...(s[key] ?? createDefaultPlaybackState()),
                    status: newStatus,
                    currentIndex: targetIndex,
                    history: nextHistory,
                    log: historyToLog(nextHistory),
                }
            }));
            return;
        }

        let newHistory: CommandHistoryEntry[] = [];
        let startIndex = 0;

        if (targetIndex > currentState.currentIndex) {
            newHistory = [...currentState.history];
            startIndex = currentState.currentIndex;
        }

        try {
            for (let i = startIndex; i < targetIndex; i++) {
                const cmd = commands[i];
                const output = await executeRemoteCommand(host, cmd, indexName);
                newHistory.push({ command: cmd.command, output: output || '' });
            }
        } finally {
            const finalHistory = newHistory;
            const newStatus: PlayStatus = targetIndex >= commands.length
                ? 'finished'
                : (wasPlaying ? 'playing' : 'paused');

            setPlaybackStates(s => ({
                ...s,
                [key]: {
                    ...(s[key] ?? createDefaultPlaybackState()),
                    status: newStatus,
                    currentIndex: targetIndex,
                    history: finalHistory,
                    log: historyToLog(finalHistory),
                }
            }));
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
        setPlaybackSpeeds({});
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
                    <FormControlLabel
                        control={<Switch size="small" checked={replayOnJump} onChange={(_, checked) => setReplayOnJump(checked)} />}
                        label="跳转时执行前序命令"
                    />
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
                                        playbackSpeeds={playbackSpeeds}
                                        onPlaybackAction={handlePlaybackAction}
                                        onSpeedChange={handleSpeedChange}
                                        onJump={handleJumpToIndex}
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