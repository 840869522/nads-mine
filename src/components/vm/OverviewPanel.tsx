import React from 'react';
import {
  Box, CircularProgress, Grid, Stack, Typography, Paper
} from '@mui/material';
import {
  Dns, Memory as MemoryIconMui, Storage, NetworkCheck
} from '@mui/icons-material'; // Renamed Memory to MemoryIconMui to avoid conflict

// Mock VM Status enum (kept in case status-dependent rendering is needed elsewhere in this panel later)
enum VMStatus {
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export default function OverviewPanel() {
  // const vmName = 'MyVirtualMachine'; // No longer needed here
  // const vmStatus = VMStatus.RUNNING; // No longer needed here

  const info = {
    hostNode: 'kvm-node-1',
    pool: 'default',
    vcpu: 4,
    vram: 8192,
    ip: '192.168.122.101',
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    uptime: '2d 03:12',
    boot: 'Hard Disk',
  };

  const usage = {
    cpu: 45, // percentage
    mem: 70, // percentage
    diskRW: 150, // MB/s
    netThroughput: 55, // Mbps
  };

  const MiniGauge: React.FC<{label: string; value: number; unit?: string; icon?: React.ReactElement }> = ({ label, value, unit = '%', icon }) => (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1 }}>
        {icon}
        <Typography variant="subtitle2" >{label}</Typography>
      </Stack>
      <CircularProgress variant="determinate" value={unit === '%' ? value : 100} size={60} thickness={4} sx={{my:1}} />
      <Typography variant="h6" display="block">{value}{unit}</Typography>
    </Paper>
  );

  const KeyValueListItem: React.FC<{label: string; value: string | number}> = ({label, value}) => (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 1, borderBottom: '1px solid #eee', '&:last-child': { borderBottom: 'none'} }}>
      <Typography variant="body2" color="text.secondary">{label}:</Typography>
      <Typography variant="body2" sx={{textAlign: 'right'}}>{value}</Typography>
    </Stack>
  );


  return (
    <Stack spacing={2.5} sx={{p: 0.5}}> {/* Added small padding to the overall stack if needed */}
      {/* Main Content Grid - No HeaderBar */}
      <Grid container spacing={2.5}> {/* Increased spacing slightly */}
        {/* Left Column: Basic Info */}
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1.5, borderBottom: '1px solid #ddd', pb:1 }}>基本配置</Typography>
            <Stack spacing={0}>
              <KeyValueListItem label="Host Node" value={info.hostNode} />
              <KeyValueListItem label="Pool" value={info.pool} />
              <KeyValueListItem label="vCPU" value={info.vcpu} />
              <KeyValueListItem label="vRAM" value={`${info.vram} MB`} />
              <KeyValueListItem label="Boot Source" value={info.boot} />
              <KeyValueListItem label="UUID" value={info.uuid} />
              <KeyValueListItem label="IP Address" value={info.ip} />
              <KeyValueListItem label="Uptime" value={info.uptime} />
            </Stack>
          </Paper>
        </Grid>

        {/* Right Column: Real-time Usage */}
        <Grid item xs={12} md={7}>
           <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1.5, borderBottom: '1px solid #ddd', pb:1 }}>实时用量 (刷新间隔 3-5s)</Typography>
            <Grid container spacing={2} alignItems="stretch"> {/* alignItems stretch for equal height gauges */}
              <Grid item xs={6} sm={3}>
                <MiniGauge label="CPU" value={usage.cpu} icon={<Dns fontSize="small" />} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="Memory" value={usage.mem} icon={<MemoryIconMui fontSize="small" />} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="Disk R/W" value={usage.diskRW} unit="MB/s" icon={<Storage fontSize="small" />} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="Net Throughput" value={usage.netThroughput} unit="Mbps" icon={<NetworkCheck fontSize="small" />} />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
