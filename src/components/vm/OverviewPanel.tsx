import React from 'react';
import { Box, Grid, Typography, LinearProgress } from '@mui/material';

export default function OverviewPanel() {
  const info = {
    hostNode: 'kvm-node-1',
    pool: 'default',
    vcpu: 4,
    vram: 8192,
    ip: '192.168.122.101',
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    uptime: '2d 03:12'
  };

  const usage = {
    cpu: 35,
    mem: 62,
    disk: 40,
    net: 12
  };

  const Gauge: React.FC<{label: string; value: number}> = ({ label, value }) => (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption">{label}</Typography>
      <LinearProgress variant="determinate" value={value} sx={{ height: 10, borderRadius: 1, mt: 0.5 }}/>
    </Box>
  );

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>基本信息</Typography>
        <Box sx={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <span>Host Node: {info.hostNode}</span>
          <span>Pool: {info.pool}</span>
          <span>vCPU: {info.vcpu}</span>
          <span>vRAM: {info.vram} MB</span>
          <span>IP: {info.ip}</span>
          <span>UUID: {info.uuid}</span>
          <span>Uptime: {info.uptime}</span>
        </Box>
      </Grid>
      <Grid item xs={12} md={8}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>实时用量</Typography>
        <Box sx={{ maxWidth: 300 }}>
          <Gauge label="CPU" value={usage.cpu} />
          <Gauge label="Memory" value={usage.mem} />
          <Gauge label="Disk" value={usage.disk} />
          <Gauge label="Network" value={usage.net} />
        </Box>
      </Grid>
    </Grid>
  );
}
