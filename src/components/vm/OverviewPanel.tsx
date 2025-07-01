import React from 'react';
import {
  Box, Button, ButtonGroup, CircularProgress, Grid, Stack, Typography, Paper, Chip, Icon
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, RestartAlt, PowerSettingsNew, Dns, Memory, Storage, NetworkCheck, Computer
} from '@mui/icons-material';

// Mock VM Status enum
enum VMStatus {
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export default function OverviewPanel() {
  const vmName = 'MyVirtualMachine';
  const vmStatus = VMStatus.RUNNING; // Mock status

  const info = {
    hostNode: 'kvm-node-1',
    pool: 'default',
    vcpu: 4,
    vram: 8192,
    ip: '192.168.122.101',
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    uptime: '2d 03:12',
    boot: 'Hard Disk', // Added Boot source
  };

  const usage = {
    cpu: 45, // percentage
    mem: 70, // percentage
    diskRW: 150, // MB/s
    netThroughput: 55, // Mbps
  };

  const getStatusColor = (status: VMStatus) => {
    switch (status) {
      case VMStatus.RUNNING: return 'success';
      case VMStatus.PAUSED: return 'warning';
      case VMStatus.STOPPED: return 'error';
      default: return 'disabled';
    }
  };

  const MiniGauge: React.FC<{label: string; value: number; unit?: string; icon?: React.ReactElement }> = ({ label, value, unit = '%', icon }) => (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', width: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1 }}>
        {icon}
        <Typography variant="subtitle2" >{label}</Typography>
      </Stack>
      <CircularProgress variant="determinate" value={unit === '%' ? value : 100} size={60} thickness={4} sx={{mb:1}} />
      <Typography variant="h6" display="block">{value}{unit}</Typography>
    </Paper>
  );

  const KeyValueListItem: React.FC<{label: string; value: string | number}> = ({label, value}) => (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5, borderBottom: '1px solid #eee' }}>
      <Typography variant="body2" color="text.secondary">{label}:</Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );


  return (
    <Stack spacing={2}>
      {/* HeaderBar */}
      <Paper elevation={1} sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Chip
            icon={
              vmStatus === VMStatus.RUNNING ? <PlayArrow /> :
              vmStatus === VMStatus.PAUSED ? <Pause /> :
              <Stop />
            }
            label={vmStatus}
            color={getStatusColor(vmStatus)}
            size="small"
          />
          <Typography variant="h6" component="div">
            {vmName}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <ButtonGroup variant="outlined" size="small">
            <Button title="Start"><PlayArrow /></Button>
            <Button title="Pause"><Pause /></Button>
            <Button title="Shutdown"><Stop /></Button>
            <Button title="Reboot"><RestartAlt /></Button>
            <Button title="Force Off" color="error"><PowerSettingsNew /></Button>
          </ButtonGroup>
          <Button variant="contained" size="small" startIcon={<Computer />}>
            Console
          </Button>
        </Stack>
      </Paper>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column: Basic Info */}
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.5, borderBottom: '1px solid #ddd', pb:1 }}>基本配置</Typography>
            <Stack spacing={0.5}>
              <KeyValueListItem label="Host Node" value={info.hostNode} />
              <KeyValueListItem label="Pool" value={info.pool} />
              <KeyValueListItem label="vCPU" value={info.vcpu} />
              <KeyValueListItem label="vRAM" value={`${info.vram} MB`} />
              <KeyValueListItem label="Boot" value={info.boot} />
              <KeyValueListItem label="UUID" value={info.uuid} />
              <KeyValueListItem label="IP Address" value={info.ip} />
              <KeyValueListItem label="Uptime" value={info.uptime} />
            </Stack>
          </Paper>
        </Grid>

        {/* Right Column: Real-time Usage */}
        <Grid item xs={12} md={7}>
           <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.5, borderBottom: '1px solid #ddd', pb:1 }}>实时用量 (刷新间隔 3-5s)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="CPU" value={usage.cpu} icon={<Dns fontSize="small" />} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MiniGauge label="Memory" value={usage.mem} icon={<Memory fontSize="small" />} />
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
