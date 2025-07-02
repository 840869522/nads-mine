import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography, Paper, Grid,
  Select, MenuItem, FormControl, InputLabel, Toolbar, SelectChangeEvent, CircularProgress, Skeleton
} from '@mui/material';
import {
  TimelineOutlined as ChartIcon,
  MemoryOutlined as MemoryIcon,
  DownloadOutlined as DownloadIcon,
  RefreshOutlined as RefreshIcon,
} from '@mui/icons-material';
import DnsIcon from '@mui/icons-material/Dns'; // CPU
import StorageIcon from '@mui/icons-material/Storage'; // Disk
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck'; // Network

interface ChartConfig {
  title: string;
  icon: React.ReactElement;
  unit: string;
  type: 'LineChart' | 'AreaChart' | 'BarChart';
  dataKey: keyof HistoricalMetrics; // Ensure this matches keys in HistoricalMetrics
}

const chartConfigs: ChartConfig[] = [
  { title: 'CPU Usage', icon: <DnsIcon />, unit: '%', type: 'LineChart', dataKey: 'cpu_percent' },
  { title: 'Memory Usage', icon: <MemoryIcon />, unit: 'MB', type: 'AreaChart', dataKey: 'memory_mb' },
  { title: 'Disk Throughput', icon: <StorageIcon />, unit: 'MBps', type: 'BarChart', dataKey: 'disk_rw_mbps_total' },
  { title: 'Network Throughput', icon: <NetworkCheckIcon />, unit: 'Mbps', type: 'LineChart', dataKey: 'network_throughput_mbps_total' },
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

// Data structures from backend
interface MetricDataPoint {
  timestamp: string; // ISO string
  value: number;
}

interface HistoricalMetrics {
  cpu_percent: MetricDataPoint[];
  memory_mb: MetricDataPoint[];
  disk_rw_mbps_total: MetricDataPoint[];
  network_throughput_mbps_total: MetricDataPoint[];
}

const VM_ID = "test-vm"; // Placeholder VM ID

export default function PerformancePanel() {
  const [timeRange, setTimeRange] = useState(timeRanges[0].value);
  const [refreshIntervalValue, setRefreshIntervalValue] = useState(refreshIntervals[1].value); // Renamed to avoid conflict
  const [performanceData, setPerformanceData] = useState<HistoricalMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformanceData = useCallback(async (currentRange: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vm/${VM_ID}/performance/historical?range=${currentRange}`);
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Failed to fetch performance data: ${response.status} ${response.statusText} - ${errBody}`);
      }
      const data: HistoricalMetrics = await response.json();
      setPerformanceData(data);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
      setPerformanceData(null);
    } finally {
      setIsLoading(false);
    }
  }, []); // VM_ID can be added if it's dynamic

  useEffect(() => {
    fetchPerformanceData(timeRange);
  }, [timeRange, fetchPerformanceData]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (refreshIntervalValue !== 'never' && !isLoading) { // Also check isLoading to avoid multiple fetches if one is ongoing
      const msDelay = refreshIntervalValue.endsWith('s') ? parseInt(refreshIntervalValue.replace('s','')) * 1000 : parseInt(refreshIntervalValue.replace('m','')) * 60000;
      intervalId = setInterval(() => {
        if (!isLoading) { // Double check isLoading before fetching inside interval
             fetchPerformanceData(timeRange);
        }
      }, msDelay);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [refreshIntervalValue, timeRange, fetchPerformanceData, isLoading]);


  const handleTimeRangeChange = (_: React.MouseEvent<HTMLElement>, newRange: string | null) => {
    if (newRange !== null && newRange !== timeRange) {
      setTimeRange(newRange);
      // Data will be fetched by the useEffect hook watching timeRange
    }
  };

  const handleRefreshIntervalChange = (event: SelectChangeEvent<string>) => {
    setRefreshIntervalValue(event.target.value as string);
  };

  const handleExportCsv = () => {
    alert(`Exporting CSV for ${timeRange} with ${refreshIntervalValue} refresh (mock action)`);
  };

  const ChartPlaceholder: React.FC<{config: ChartConfig, data?: MetricDataPoint[], isLoadingChart: boolean, chartError?: string | null}> =
    ({ config, data, isLoadingChart, chartError }) => (
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
        {isLoadingChart && <CircularProgress size={30}/>}
        {!isLoadingChart && chartError && <Typography variant="caption" color="error" sx={{textAlign:'center', px:1}}>Error loading data for {config.title}.</Typography>}
        {!isLoadingChart && !chartError && (!data || data.length === 0) && <Typography variant="caption" color="text.secondary">No data for this period.</Typography>}
        {!isLoadingChart && !chartError && data && data.length > 0 && <Typography variant="caption" color="text.secondary">[{config.type} - {data.length} points for {timeRange}]</Typography>}
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
              disabled={isLoading}
            >
              {timeRanges.map(tr => (
                <ToggleButton key={tr.value} value={tr.value} aria-label={tr.label} disabled={isLoading}>
                  {tr.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <FormControl size="small" sx={{minWidth: 120}}>
              <InputLabel id="refresh-interval-label">Refresh</InputLabel>
              <Select
                labelId="refresh-interval-label"
                label="Refresh"
                value={refreshIntervalValue}
                onChange={handleRefreshIntervalChange}
                startAdornment={<RefreshIcon fontSize="small" sx={{mr:0.5, color: 'action.active'}}/>}
                disabled={isLoading}
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
              disabled={isLoading || !performanceData}
            >
              Export CSV
            </Button>
          </Stack>
        </Toolbar>
      </Paper>

      {error && !isLoading && <Alert severity="error" sx={{my:1}}>{error}</Alert>}

      <Grid container spacing={2}>
        {chartConfigs.map((config) => (
          <Grid item xs={12} sm={6} key={config.title}>
            {isLoading && !performanceData ? ( // Initial full loading state or error state where performanceData is null
                 <Paper variant="outlined" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{mb: 1}}>
                        {config.icon}
                        <Typography variant="subtitle1" component="div">{config.title} ({config.unit})</Typography>
                    </Stack>
                    <Skeleton variant="rectangular" sx={{flexGrow:1, minHeight: 150, border: '1px dashed grey', borderRadius:1}} />
                 </Paper>
            ) : (
                <ChartPlaceholder
                    config={config}
                    data={performanceData ? performanceData[config.dataKey] : undefined}
                    isLoadingChart={isLoading && !!performanceData} // Show spinner in chart if already have some data but refreshing
                    chartError={error && !performanceData ? `Failed to load data for charts.` : undefined}
                />
            )}
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
