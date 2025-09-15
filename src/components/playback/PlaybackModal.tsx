import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal, Box, Typography, CircularProgress, Alert,
  Select, MenuItem, FormControl, InputLabel, Button,
  Accordion, AccordionSummary, AccordionDetails, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  LinearProgress, SelectChangeEvent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// --- Types ---
interface PlaybackModalProps {
  open: boolean;
  onClose: () => void;
  hosts: { name: string; indexName: string }[];
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

// --- Helper Functions ---
function formatDuration(ms: number): string {
  if (ms < 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    // Show seconds if it's the only unit or if there are other units
    if (parts.length > 0) {
      parts.push(`${seconds}s`);
    } else {
      // For values less than a minute, show decimals
      return `${(ms/1000).toFixed(2)}s`;
    }
  }

  return parts.join(' ');
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

const PlaybackTerminal = ({ commands, timeMode, interval }: { commands: Command[], timeMode: TimeMode, interval: number }) => {
    const [hasStarted, setHasStarted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [logOutput, setLogOutput] = useState<string[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const cleanupTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handlePlay = () => {
        cleanupTimeout();
        setLogOutput([`$ [${new Date(commands[0].ts).toLocaleString()}] cd ${commands[0].cwd} && ${commands[0].command}`]);
        setCurrentIndex(1); // Start with the second command
        setIsPaused(false);
        setIsPlaying(true);
        setHasStarted(true);
    };

    const handlePause = () => setIsPaused(!isPaused);

    const handleStop = () => {
        cleanupTimeout();
        setIsPlaying(false);
        setIsPaused(false);
    };

    const handleClose = () => {
        handleStop();
        setHasStarted(false);
        setCurrentIndex(0);
        setLogOutput([]);
    };

    useEffect(() => {
        if (!isPlaying || isPaused || currentIndex >= commands.length) {
            if (isPlaying && currentIndex >= commands.length) {
                setIsPlaying(false); // Finished
            }
            return cleanupTimeout;
        };

        const prevCommand = commands[currentIndex - 1];
        // The delay is always determined by the previous command's sleep time.
        const delay = prevCommand.sleep_until_next_ms ?? 0;

        timeoutRef.current = setTimeout(() => {
            const currentCommand = commands[currentIndex];
            setLogOutput(prev => [...prev, `$ [${new Date(currentCommand.ts).toLocaleString()}] cd ${currentCommand.cwd} && ${currentCommand.command}`]);
            setCurrentIndex(prev => prev + 1);
        }, delay);

        return cleanupTimeout;
    }, [isPlaying, isPaused, currentIndex, commands, timeMode, interval]);

    if (!hasStarted) {
        return <Button onClick={handlePlay} variant="contained" sx={{ mt: 1 }}>开始回放</Button>;
    }

    const isFinished = !isPlaying && hasStarted && currentIndex >= commands.length;
    const progress = currentIndex >= commands.length ? 100 : (currentIndex / commands.length) * 100;

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">
                    进度: {Math.min(currentIndex, commands.length)} / {commands.length}
                </Typography>
                <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                 {isPlaying && <Button onClick={handlePause} variant="outlined">{isPaused ? '继续' : '暂停'}</Button>}
                 {hasStarted && !isFinished && <Button onClick={handleStop} variant="outlined" color="error">中止</Button>}
            </Box>
            <Paper sx={TERMINAL_STYLE}>
                {logOutput.join('\n')}
                {isFinished && '\n\n[--- 回放结束 ---]'}
            </Paper>
             {isFinished && <Button onClick={handleClose} sx={{mt: 1}}>关闭</Button>}
        </Box>
    );
};


const HostDisplay = ({ host, data, timeMode, fixedInterval }: { host: { name: string }, data: HostData, timeMode: TimeMode, fixedInterval: number }) => {
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

  return (
    <Box>
      <Tabs value={activeTab} onChange={handleTabChange}>
        {groupNames.map(name => <Tab label={name} key={name} />)}
      </Tabs>
      {groupNames.map((groupName, index) => (
        <Box role="tabpanel" hidden={activeTab !== index} key={groupName} sx={{ pt: 2 }}>
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
                {data.groups[groupName].map((cmd, idx) => {
                  const interval = cmd.sleep_until_next_ms ?? 0;

                  return (
                    <TableRow key={idx}>
                      <TableCell>{new Date(cmd.ts).toLocaleString()}</TableCell>
                      <TableCell>{cmd.cwd}</TableCell>
                      <TableCell><code>{cmd.command}</code></TableCell>
                      <TableCell align="right">{formatDuration(interval)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
          <PlaybackTerminal commands={data.groups[groupName]} timeMode={timeMode} interval={fixedInterval} />
        </Box>
      ))}
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

  const indexNames = useMemo(() => hosts.map(h => h.indexName), [hosts]);

  useEffect(() => {
    if (!open || hosts.length === 0) {
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setData(null);
      try {
        const response = await fetch('/api/playback-commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            indexNames,
            groupBy,
            filterNoise,
            timeMode,
            fixedIntervalSeconds: fixedInterval,
          }),
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API 请求失败: ${response.status} ${errText}`);
        }
        const result: ApiResponse = await response.json();
        setData(result);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [open, hosts, indexNames, groupBy, filterNoise, timeMode, fixedInterval]);

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={MODAL_STYLE}>
        <Typography variant="h6" component="h2">指令回放</Typography>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 2, my: 2, flexWrap: 'wrap' }}>
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

        {/* Content */}
        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {isLoading && <CircularProgress />}
          {error && <Alert severity="error">{error}</Alert>}
          {data && hosts.map(host => (
            <Accordion key={host.indexName}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{host.name}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {data[host.indexName] ? (
                  <HostDisplay
                    host={host}
                    data={data[host.indexName]}
                    timeMode={timeMode}
                    fixedInterval={fixedInterval}
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
