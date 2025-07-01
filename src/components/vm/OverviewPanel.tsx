import React from 'react'
import {
  Box, Button, CircularProgress, Grid, IconButton, Stack, Typography
} from '@mui/material'
import {
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  RestartAlt as RebootIcon,
  PowerSettingsNew as ForceIcon,
  DesktopWindows as ConsoleIcon
} from '@mui/icons-material'

export default function OverviewPanel() {
  const info = {
    hostNode: 'kvm-node-1',
    pool: 'default',
    vcpu: 4,
    vram: 8192,
    ip: '192.168.122.101',
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    uptime: '2d 03:12'
  }

  const usage = {
    cpu: 45,
    mem: 70,
    disk: 40,
    net: 12
  }

  const MiniGauge: React.FC<{label: string; value: number}> = ({ label, value }) => (
    <Box sx={{ textAlign: 'center' }}>
      <CircularProgress variant="determinate" value={value} size={60} thickness={4} />
      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>{label} {value}%</Typography>
    </Box>
  )

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          <StartIcon color="success" sx={{ verticalAlign: 'middle', mr: 1 }} /> demo-vm
        </Typography>
        <IconButton size="small" color="primary"><StartIcon /></IconButton>
        <IconButton size="small" color="primary"><PauseIcon /></IconButton>
        <IconButton size="small" color="primary"><StopIcon /></IconButton>
        <IconButton size="small" color="primary"><RebootIcon /></IconButton>
        <IconButton size="small" color="error"><ForceIcon /></IconButton>
        <Button size="small" variant="outlined" startIcon={<ConsoleIcon />}>Console</Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid item size={{ xs: 12, md: 4 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>基本信息</Typography>
          <Stack spacing={0.5} sx={{ fontSize: 14 }}>
            <span>Host Node: {info.hostNode}</span>
            <span>Pool: {info.pool}</span>
            <span>vCPU: {info.vcpu}</span>
            <span>vRAM: {info.vram} MB</span>
            <span>IP: {info.ip}</span>
            <span>UUID: {info.uuid}</span>
            <span>Uptime: {info.uptime}</span>
          </Stack>
        </Grid>
        <Grid item size={{ xs: 12, md: 8 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>实时用量</Typography>
          <Stack direction="row" spacing={3}>
            <MiniGauge label="CPU" value={usage.cpu} />
            <MiniGauge label="Memory" value={usage.mem} />
            <MiniGauge label="Disk" value={usage.disk} />
            <MiniGauge label="Net" value={usage.net} />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  )
}
