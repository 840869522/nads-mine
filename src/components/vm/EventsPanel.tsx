import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Alert, Box, Button, CircularProgress, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Toolbar, Typography, Paper, Chip,
  FormControl, InputLabel, Switch, FormControlLabel, Skeleton, SelectChangeEvent
} from '@mui/material';
import {
  FilterListOutlined as FilterIcon,
  ListAltOutlined as EventIcon,
  CalendarTodayOutlined as TimeIcon,
  PriorityHighOutlined as LevelIcon,
  NotesOutlined as DetailIcon,
  DownloadOutlined as DownloadIcon,
  DeleteSweepOutlined as ClearIcon,
  SearchOutlined as KeywordIcon,
  AccessTimeOutlined as TimeWindowIcon,
  // LiveTvOutlined as LiveTailIconOff, // Placeholder for live tail
  // SensorsOutlined as LiveTailIconOn // Placeholder for live tail
} from '@mui/icons-material';


interface EventsPanelProps {
  vmId: string;
}

type EventLevel = 'info' | 'warning' | 'error' | 'debug';

interface EventLog {
  id: string;
  timestamp: string; // ISO String from backend
  level: EventLevel;
  message: string;
  details?: Record<string, any>;
}

const eventLevels: EventLevel[] = ['info', 'warning', 'error', 'debug'];
const timeWindowOptions = [
    { value: 'all', label: 'All Time' },
    { value: '1h', label: 'Last 1 Hour' },
    { value: '6h', label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
];


export default function EventsPanel({ vmId }: EventsPanelProps) {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<EventLevel | 'all'>('all');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterTimeWindow, setFilterTimeWindow] = useState(timeWindowOptions[0].value);
  const [liveTail, setLiveTail] = useState(false); // Mock behavior for now

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFetchedEvents, setTotalFetchedEvents] = useState(0);


  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const queryParams = new URLSearchParams();
    if (filterLevel !== 'all') queryParams.append('level', filterLevel);
    if (filterKeyword.trim()) queryParams.append('keyword', filterKeyword.trim());
    if (filterTimeWindow !== 'all') queryParams.append('time_window', filterTimeWindow);
    // queryParams.append('limit', '200'); // Example limit

    try {
        const response = await fetch(`/api/vm/${vmId}/events?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
      }
      const data: EventLog[] = await response.json();
      setEvents(data); // API returns already sorted and filtered data
      setTotalFetchedEvents(data.length); // Assuming API returns all matching, not just a page
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while fetching events.');
      setEvents([]);
      setTotalFetchedEvents(0);
    } finally {
      setIsLoading(false);
    }
  }, [filterLevel, filterKeyword, filterTimeWindow]); // Dependencies for re-fetching

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // The backend API is now responsible for filtering, so local `filteredEvents` useMemo is less critical
  // but can be kept if frontend-side sub-filtering or sorting (e.g. by timestamp if API doesn't guarantee) is needed.
  // For now, the API is assumed to return sorted data.

  const handleClearLogs = () => {
    // This would be an API call if supported. For now, it's a mock.
    alert('Clear Logs (mock action) - This feature would typically require backend support.');
    // setEvents([]); // If we were managing local state primarily
  };

  const handleExportCsv = () => {
    alert(`Exporting ${events.length} events to CSV (mock action)`);
  };

  const toggleLiveTail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLiveTail(event.target.checked);
    if(event.target.checked) {
        console.log("Live tail enabled (mock - would require WebSocket or long polling)");
        // In a real app, you might subscribe to an event stream here
        // and potentially disable manual refresh/filters or merge live events
    } else {
        console.log("Live tail disabled (mock)");
    }
  };

  const getLevelChipColor = (level: EventLevel): "success" | "warning" | "error" | "info" | "default" => {
    switch(level) {
        case 'info': return 'success';
        case 'warning': return 'warning';
        case 'error': return 'error';
        case 'debug': return 'info';
        default: return 'default';
    }
  }

  return (
    <Paper variant="outlined">
      <Toolbar disableGutters sx={{ px: 1.5, borderBottom: '1px solid #eee', flexWrap: 'wrap', gap: 1.5, py:1 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <FilterIcon color="action"/>
          <Typography variant="subtitle1" fontWeight="medium">Filters:</Typography>
        </Stack>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Level</InputLabel>
          <Select
            label="Level"
            value={filterLevel}
            onChange={(e: SelectChangeEvent<EventLevel | 'all'>) => setFilterLevel(e.target.value as EventLevel | 'all')}
            disabled={isLoading || liveTail}
          >
            <MenuItem value="all">All Levels</MenuItem>
            {eventLevels.map(lvl => <MenuItem key={lvl} value={lvl}>{lvl.charAt(0).toUpperCase() + lvl.slice(1)}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Keyword search..."
          value={filterKeyword}
          onChange={e => setFilterKeyword(e.target.value)}
          disabled={isLoading || liveTail}
          InputProps={{
            startAdornment: <KeywordIcon fontSize="small" sx={{mr:0.5, color: 'action.active'}}/>
          }}
          sx={{minWidth: 200}}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Time Window</InputLabel>
          <Select
            label="Time Window"
            value={filterTimeWindow}
            onChange={(e: SelectChangeEvent<string>) => setFilterTimeWindow(e.target.value)}
            disabled={isLoading || liveTail}
            startAdornment={<TimeWindowIcon fontSize="small" sx={{mr:0.5, color: 'action.active'}}/>}
          >
            {timeWindowOptions.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1, minWidth: '10px' }} /> {/* Spacer */}

        <FormControlLabel
            control={<Switch checked={liveTail} onChange={toggleLiveTail} size="small" disabled={isLoading} />}
            labelPlacement="start"
            label={<Typography variant="body2" sx={{mr:0.5}}>Live Tail</Typography>}
            sx={{mr:1}}
        />
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCsv} disabled={isLoading || events.length === 0}>
          Export CSV
        </Button>
        <Button size="small" variant="outlined" color="error" startIcon={<ClearIcon />} onClick={handleClearLogs} disabled={isLoading || events.length === 0}>
          Clear Log
        </Button>
      </Toolbar>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{m:1}}>{error}</Alert>}

      <TableContainer sx={{ maxHeight: 600 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{width: '180px'}}><TimeIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Timestamp</TableCell>
              <TableCell sx={{width: '100px'}}><LevelIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Level</TableCell>
              <TableCell><DetailIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Message & Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
                Array.from(new Array(5)).map((_, index) => (
                    <TableRow key={`skel-event-${index}`}>
                        <TableCell><Skeleton /></TableCell>
                        <TableCell><Skeleton /></TableCell>
                        <TableCell><Skeleton /></TableCell>
                    </TableRow>
                ))
            ) : events.length > 0 ? events.map(e => (
              <TableRow key={e.id} hover>
                <TableCell>{new Date(e.timestamp).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip label={e.level.toUpperCase()} color={getLevelChipColor(e.level)} size="small" variant="filled" sx={{fontWeight:'medium'}}/>
                </TableCell>
                <TableCell>
                    <Typography variant="body2" component="div">{e.message}</Typography>
                    {e.details && Object.keys(e.details).length > 0 && (
                        <Typography variant="caption" color="text.secondary" component="div" sx={{pl:1, mt:0.5, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.7rem'}}>
                            {JSON.stringify(e.details, null, 2)}
                        </Typography>
                    )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{py:3}}>
                  <EventIcon sx={{fontSize: 40, color: 'grey.400', mb:1}}/>
                  <Typography color="text.secondary">No events match current filters.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {!isLoading && events.length > 0 && (
         <Box sx={{p:1, textAlign: 'right', borderTop: '1px solid #eee'}}>
            <Typography variant="caption">Displaying {events.length} events (Total matching: {totalFetchedEvents})</Typography>
        </Box>
      )}
       {!isLoading && events.length === 0 && !error && (
         <Box sx={{p:1, textAlign: 'right', borderTop: '1px solid #eee'}}>
            <Typography variant="caption">No events to display.</Typography>
        </Box>
      )}
    </Paper>
  );
}
