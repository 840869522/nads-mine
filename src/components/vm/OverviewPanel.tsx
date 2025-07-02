import React, { useState, useEffect } from 'react';
import {
  Alert, Box, CircularProgress, Grid, Stack, Typography, Paper, Skeleton
} from '@mui/material';
import {
  Dns, Memory as MemoryIconMui, Storage as StorageIcon, NetworkCheck
} from '@mui/icons-material'; // Renamed Memory to MemoryIconMui to avoid conflict


interface OverviewPanelProps {
  vmId: string;
}

interface VCPUInfo {
  count: number;
  usage_percent: number;
}

interface VRAMInfo {
  total_mb: number;
  usage_mb: number;
  usage_percent: number;
}

interface OverviewData {
  status: string;
  uptime: string;
  hostNode: string;
  pool: string;
  vcpu: VCPUInfo;
  vram: VRAMInfo;
  bootSource: string;
  uuid: string;
  ipAddress: string;
  disks_rw_mbps: number;
  network_throughput_mbps: number;
}


const MiniGauge: React.FC<{label: string; value: number; unit?: string; icon?: React.ReactElement; isLoading?: boolean }> = ({ label, value, unit = '%', icon, isLoading }) => (
  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1 }}>
      {icon}
      <Typography variant="subtitle2" >{label}</Typography>
    </Stack>
    {isLoading ? <Skeleton variant="circular" width={60} height={60} sx={{my:1, mx: 'auto'}} /> : <CircularProgress variant="determinate" value={unit === '%' ? value : (value > 0 ? 100: 0) } size={60} thickness={4} sx={{my:1}} />}
    {isLoading ? <Skeleton width="50%" sx={{mx: 'auto'}} /> : <Typography variant="h6" display="block">{value.toFixed(1)}{unit}</Typography>}
  </Paper>
);

const KeyValueListItem: React.FC<{label: string; value: string | number | undefined; isLoading?: boolean}> = ({label, value, isLoading}) => (
  <Stack direction="row" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid #eee', '&:last-child': { borderBottom: 'none'} }}>
    <Typography variant="body2" color="text.secondary">{label}:</Typography>
    {isLoading ? <Skeleton width="40%" /> : <Typography variant="body2" sx={{textAlign: 'right'}}>{value ?? 'N/A'}</Typography>}
  </Stack>
);

export default function OverviewPanel({ vmId }: OverviewPanelProps) {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverviewData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/vm/${vmId}/overview`);
        if (!response.ok) {
          throw new Error(`Failed to fetch overview data: ${response.status} ${response.statusText}`);
        }
        const data: OverviewData = await response.json();
        setOverviewData(data);
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
        setOverviewData(null); // Clear data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverviewData(); // Initial fetch
    const intervalId = setInterval(fetchOverviewData, 5000); // Refresh every 5 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  if (error) {
    return <Alert severity="error" sx={{m:2}}>Error loading overview: {error}</Alert>;
  }

  return (
    <Stack spacing={2.5} sx={{p: 0.5}}>
      <Grid container spacing={2.5}>
        {/* Left Column: Basic Info */}
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1.5, borderBottom: '1px solid #ddd', pb:1 }}>基本配置</Typography>
            <Stack spacing={0}>
              <KeyValueListItem label="Status" value={overviewData?.status} isLoading={isLoading} />
              <KeyValueListItem label="Host Node" value={overviewData?.hostNode} isLoading={isLoading} />
              <KeyValueListItem label="Pool" value={overviewData?.pool} isLoading={isLoading} />
              <KeyValueListItem label="vCPU Count" value={overviewData?.vcpu?.count} isLoading={isLoading} />
              <KeyValueListItem label="vRAM Total" value={overviewData?.vram?.total_mb !== undefined ? `${overviewData.vram.total_mb} MB` : undefined} isLoading={isLoading} />
              <KeyValueListItem label="Boot Source" value={overviewData?.bootSource} isLoading={isLoading} />
              <KeyValueListItem label="UUID" value={overviewData?.uuid} isLoading={isLoading} />
              <KeyValueListItem label="IP Address" value={overviewData?.ipAddress} isLoading={isLoading} />
              <KeyValueListItem label="Uptime" value={overviewData?.uptime} isLoading={isLoading} />
            </Stack>
          </Paper>
        </Grid>

        {/* Right Column: Real-time Usage */}
        <Grid item xs={12} md={7}>
           <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1.5, borderBottom: '1px solid #ddd', pb:1 }}>实时用量</Typography>
            <Grid container spacing={2} alignItems="stretch">
              <Grid item xs={6} sm={3}>
                <MiniGauge label="CPU" value={overviewData?.vcpu?.usage_percent ?? 0} icon={<Dns fontSize="small" />} isLoading={isLoading} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="Memory" value={overviewData?.vram?.usage_percent ?? 0} icon={<MemoryIconMui fontSize="small" />} isLoading={isLoading} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="Disk R/W" value={overviewData?.disks_rw_mbps ?? 0} unit="MB/s" icon={<StorageIcon fontSize="small" />} isLoading={isLoading} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="Net Throughput" value={overviewData?.network_throughput_mbps ?? 0} unit="Mbps" icon={<NetworkCheck fontSize="small" />} isLoading={isLoading} />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
