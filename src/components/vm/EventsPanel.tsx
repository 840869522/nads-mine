import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Button, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Toolbar, Typography, Paper, Chip,
  FormControl, InputLabel, Switch, FormControlLabel
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
  LiveTvOutlined as LiveTailIconOff, // Placeholder for live tail
  SensorsOutlined as LiveTailIconOn // Placeholder for live tail
} from '@mui/icons-material';

type EventLevel = 'info' | 'warning' | 'error' | 'debug';

interface EventLog {
  id: string;
  timestamp: Date;
  level: EventLevel;
  message: string;
  details?: Record<string, any>;
}

const initialEvents: EventLog[] = [
  { id: 'evt1', timestamp: new Date(Date.now() - 3600000 * 2), level: 'info', message: 'VM Guest OS booted successfully.', details: { source: 'kernel' } },
  { id: 'evt2', timestamp: new Date(Date.now() - 3000000), level: 'debug', message: 'Network interface eth0 link up.', details: { speed: '1000Mbps' } },
  { id: 'evt3', timestamp: new Date(Date.now() - 1800000), level: 'warning', message: 'High CPU utilization detected.', details: { usage: '92%', threshold: '90%' } },
  { id: 'evt4', timestamp: new Date(Date.now() - 600000), level: 'info', message: 'Snapshot "backup_daily" created.', details: { user: 'admin' } },
  { id: 'evt5', timestamp: new Date(Date.now() - 300000), level: 'error', message: 'Failed to attach storage volume "data_vol_03".', details: { reason: 'Volume not found' } },
  { id: 'evt6', timestamp: new Date(Date.now() - 60000), level: 'info', message: 'User "jdoe" connected via VNC.', details: { ip: '192.168.1.105' } },
];

const eventLevels: EventLevel[] = ['info', 'warning', 'error', 'debug'];
const timeWindowOptions = [
    { value: 'all', label: 'All Time' },
    { value: '1h', label: 'Last 1 Hour' },
    { value: '6h', label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
];


export default function EventsPanel() {
  const [events, setEvents] = useState<EventLog[]>(initialEvents);
  const [filterLevel, setFilterLevel] = useState<EventLevel | 'all'>('all');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterTimeWindow, setFilterTimeWindow] = useState(timeWindowOptions[0].value);
  const [liveTail, setLiveTail] = useState(false);

  const filteredEvents = useMemo(() => {
    let result = events;

    if (filterLevel !== 'all') {
      result = result.filter(e => e.level === filterLevel);
    }

    if (filterKeyword.trim() !== '') {
      const lowerKeyword = filterKeyword.toLowerCase();
      result = result.filter(e =>
        e.message.toLowerCase().includes(lowerKeyword) ||
        (e.details && JSON.stringify(e.details).toLowerCase().includes(lowerKeyword))
      );
    }

    if (filterTimeWindow !== 'all') {
        const now = Date.now();
        let startTime = 0;
        if (filterTimeWindow === '1h') startTime = now - 3600000;
        else if (filterTimeWindow === '6h') startTime = now - 3600000 * 6;
        else if (filterTimeWindow === '24h') startTime = now - 3600000 * 24;
        result = result.filter(e => e.timestamp.getTime() >= startTime);
    }

    return result.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()); // Show newest first
  }, [events, filterLevel, filterKeyword, filterTimeWindow]);

  const handleClearLogs = () => {
    setEvents([]);
  };

  const handleExportCsv = () => {
    alert(`Exporting ${filteredEvents.length} events to CSV (mock action)`);
  };

  const toggleLiveTail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLiveTail(event.target.checked);
    if(event.target.checked) {
        // Mock: In a real app, you might subscribe to an event stream here
        console.log("Live tail enabled (mock)");
    } else {
        console.log("Live tail disabled (mock)");
    }
  };

  const getLevelChipColor = (level: EventLevel): "success" | "warning" | "error" | "info" | "default" => {
    switch(level) {
        case 'info': return 'success'; // Or 'info' if you prefer blue
        case 'warning': return 'warning';
        case 'error': return 'error';
        case 'debug': return 'info'; // Often blue or grey
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
            onChange={e => setFilterLevel(e.target.value as EventLevel | 'all')}
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
            onChange={e => setFilterTimeWindow(e.target.value)}
            startAdornment={<TimeWindowIcon fontSize="small" sx={{mr:0.5, color: 'action.active'}}/>}
          >
            {timeWindowOptions.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1, minWidth: '10px' }} /> {/* Spacer */}

        <FormControlLabel
            control={<Switch checked={liveTail} onChange={toggleLiveTail} size="small" />}
            labelPlacement="start"
            label={<Typography variant="body2" sx={{mr:0.5}}>Live Tail</Typography>}
            sx={{mr:1}}
        />
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCsv}>
          Export CSV
        </Button>
        <Button size="small" variant="outlined" color="error" startIcon={<ClearIcon />} onClick={handleClearLogs}>
          Clear Log
        </Button>
      </Toolbar>

      <TableContainer sx={{ maxHeight: 600 }}> {/* Limit height for scroll */}
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{width: '180px'}}><TimeIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Timestamp</TableCell>
              <TableCell sx={{width: '100px'}}><LevelIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Level</TableCell>
              <TableCell><DetailIcon fontSize="inherit" sx={{verticalAlign:'middle', mr:0.5}}/>Message & Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEvents.length > 0 ? filteredEvents.map(e => (
              <TableRow key={e.id} hover>
                <TableCell>{e.timestamp.toLocaleString()}</TableCell>
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
      {filteredEvents.length > 0 && (
         <Box sx={{p:1, textAlign: 'right', borderTop: '1px solid #eee'}}>
            <Typography variant="caption">Displaying {filteredEvents.length} of {events.length} total events.</Typography>
        </Box>
      )}
    </Paper>
  );
}
