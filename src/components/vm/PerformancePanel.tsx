import React, { useState } from 'react';
import {
  Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography, Paper, Grid,
  Select, MenuItem, FormControl, InputLabel, Toolbar, SelectChangeEvent // Added SelectChangeEvent
} from '@mui/material';
import {
  TimelineOutlined as ChartIcon,
  // CpuChipOutline as CpuIcon,
  MemoryOutlined as MemoryIcon,
  // HarddiskOutline as DiskIcon,
  // LanOutlined as NetworkIcon,
  DownloadOutlined as DownloadIcon,
  RefreshOutlined as RefreshIcon,
} from '@mui/icons-material';

// For placeholder icons if specific ones aren't in @mui/icons-material
import DnsIcon from '@mui/icons-material/Dns'; // CPU
import StorageIcon from '@mui/icons-material/Storage'; // Disk
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'; // Network

interface ChartConfig {
  title: string;
  icon: React.ReactElement;
  unit: string;
  type: 'LineChart' | 'AreaChart' | 'BarChart';
}

const chartConfigs: ChartConfig[] = [
  { title: 'CPU Usage', icon: <DnsIcon />, unit: '%', type: 'LineChart' },
  { title: 'Memory Usage', icon: <MemoryIcon />, unit: 'MB', type: 'AreaChart' },
  { title: 'Disk Throughput', icon: <StorageIcon />, unit: 'MBps', type: 'BarChart' },
  { title: 'Network Throughput', icon: <NetworkCheckIcon />, unit: 'Mbps', type: 'LineChart' },
];

const timeRanges = [
  { value: '1h', label: '1 Hour' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
];

const refreshIntervals = [
  { value: '5s', label: '5 Seconds' },
  { value: '15s', label: '15 Seconds' },
  { value: '30s', label: '30 Seconds' },
  { value: '1m', label: '1 Minute' },
  { value: 'never', label: 'Manual' },
];

export default function PerformancePanel() {
  const [timeRange, setTimeRange] = useState(timeRanges[0].value);
  const [refreshInterval, setRefreshInterval] = useState(refreshIntervals[1].value);

  const handleTimeRangeChange = (_: React.MouseEvent<HTMLElement>, newRange: string | null) => {
    if (newRange !== null) {
      setTimeRange(newRange);
    }
  };

  // Moved comment to a more appropriate place and used SelectChangeEvent
  const handleRefreshIntervalChange = (event: SelectChangeEvent<string>) => {
    setRefreshInterval(event.target.value as string);
  };

  const handleExportCsv = () => {
    alert(`Exporting CSV for ${timeRange} with ${refreshInterval} refresh (mock action)`);
  };

  const ChartPlaceholder: React.FC<{config: ChartConfig}> = ({ config }) => (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 1}}>
            {config.icon}
            <Typography variant="subtitle1" component="div">{config.title} ({config.unit})</Typography>
        </Stack>
      <Box
        sx={{
          flexGrow: 1,
          border: '1px dashed grey',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.50',
          minHeight: 150,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          [{config.type} Area - Data for {timeRange}]
        </Typography>
      </Box>
    </Paper>
  );

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Toolbar disableGutters variant="dense">
          <ChartIcon sx={{ mr: 1, color: 'text.secondary' }}/>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Performance Metrics</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ToggleButtonGroup
              size="small"
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              aria-label="Time range"
            >
              {timeRanges.map(tr => (
                <ToggleButton key={tr.value} value={tr.value} aria-label={tr.label}>
                  {tr.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <FormControl size="small" sx={{minWidth: 120}}>
              <InputLabel id="refresh-interval-label">Refresh</InputLabel>
              <Select
                labelId="refresh-interval-label"
                label="Refresh"
                value={refreshInterval}
                onChange={handleRefreshIntervalChange} // Corrected: No 'any' type here
                startAdornment={<RefreshIcon fontSize="small" sx={{mr:0.5, color: 'action.active'}}/>}
              >
                {refreshIntervals.map(ri => (
                  <MenuItem key={ri.value} value={ri.value}>{ri.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          </Stack>
        </Toolbar>
      </Paper>

      <Grid container spacing={2}>
        {chartConfigs.map((config) => (
          <Grid item xs={12} sm={6} key={config.title}>
            <ChartPlaceholder config={config} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
