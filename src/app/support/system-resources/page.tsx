"use client";

import React from 'react';
import useSWR from 'swr';
import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Divider,
  Paper,
  Tooltip,
  Skeleton,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import DnsIcon from '@mui/icons-material/Dns';
import RouterIcon from '@mui/icons-material/Router';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import ErrorIcon from '@mui/icons-material/Error';

import { customFetch } from '@/utils/fetch';
import { RunningInstance } from '@/types';
import { DiskUsage } from '@/services/systemMetrics';

interface SystemResources {
  cpu: {
    cores: number;
    usagePercent: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  disks: DiskUsage[];
}

interface VmInstance {
  id: string;
  name: string;
  hostNode: string;
  pool: string;
  state: "running" | "paused" | "shutoff";
  vcpu: number;
  vmem: number;
  ip?: string;
  scene_instance_id?: string;
  scene_name?: string;
  uptime?: string;
}

const fetcher = (url: string) => customFetch(url).then(res => res.json());

const formatBytes = (bytes: number) => {
  if (!bytes && bytes !== 0) return '未知';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
};

const statusColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'success';
    case 'paused':
      return 'warning';
    case 'shutoff':
    case 'stopped':
      return 'default';
    default:
      return 'error';
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'running':
      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'paused':
      return <PauseCircleIcon fontSize="small" color="warning" />;
    default:
      return <ErrorIcon fontSize="small" color="error" />;
  }
};

const ResourceCard = ({
  title,
  icon,
  percent,
  value,
  helperText,
  loading
}: {
  title: string;
  icon: React.ReactNode;
  percent?: number;
  value: string;
  helperText?: string;
  loading?: boolean;
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        {icon}
        <Typography variant="subtitle1">{title}</Typography>
      </Stack>
      <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 1 }}>
        {loading ? <Skeleton width={140} /> : value}
      </Typography>
      {percent !== undefined && (
        <Box>
          <LinearProgress variant="determinate" value={percent} sx={{ height: 10, borderRadius: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {percent.toFixed(1)}%
          </Typography>
        </Box>
      )}
      {helperText && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {loading ? <Skeleton width={200} /> : helperText}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const DiskTable = ({ disks, loading }: { disks?: DiskUsage[]; loading?: boolean }) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
      <StorageIcon color="primary" />
      <Typography variant="h6">磁盘占用情况</Typography>
    </Stack>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>挂载点</TableCell>
          <TableCell>文件系统</TableCell>
          <TableCell>类型</TableCell>
          <TableCell align="right">容量</TableCell>
          <TableCell align="right">已用</TableCell>
          <TableCell align="right">可用</TableCell>
          <TableCell align="right">占用率</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {loading && (
          <TableRow>
            <TableCell colSpan={7}>
              <LinearProgress />
            </TableCell>
          </TableRow>
        )}
        {!loading && disks?.map((disk) => (
          <TableRow key={`${disk.filesystem}-${disk.mountpoint}`}>
            <TableCell>{disk.mountpoint}</TableCell>
            <TableCell>{disk.filesystem}</TableCell>
            <TableCell>{disk.type || '未知'}</TableCell>
            <TableCell align="right">{formatBytes(disk.sizeKB * 1024)}</TableCell>
            <TableCell align="right">{formatBytes(disk.usedKB * 1024)}</TableCell>
            <TableCell align="right">{formatBytes(disk.availKB * 1024)}</TableCell>
            <TableCell align="right">
              <Tooltip title={`${disk.usedPercent}%`}>
                <LinearProgress variant="determinate" value={disk.usedPercent} sx={{ height: 8, borderRadius: 1 }} />
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Paper>
);

const InstanceBlock = ({
  title,
  icon,
  items,
  typeKey
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; name: string; status: string; extra?: string }[];
  typeKey: 'vm' | 'container';
}) => {
  const running = items.filter(item => item.status === 'running').length;
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        {icon}
        <Typography variant="h6">{title}</Typography>
        <Chip label={`运行中 ${running}/${items.length}`} color="primary" size="small" sx={{ ml: 'auto' }} />
      </Stack>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">暂无数据</Typography>
      ) : (
        <Stack spacing={1.5}>
          {items.slice(0, 6).map(item => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {statusIcon(item.status)}
                <Box>
                  <Typography variant="subtitle2">{item.name}</Typography>
                  {item.extra && <Typography variant="caption" color="text.secondary">{item.extra}</Typography>}
                </Box>
              </Box>
              <Chip label={item.status} color={statusColor(item.status) as any} size="small" />
            </Box>
          ))}
          {items.length > 6 && (
            <Typography variant="caption" color="text.secondary">... 共 {items.length} 个{typeKey === 'vm' ? '虚拟机' : '容器'}</Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
};

const SystemResourcesPage: React.FC = () => {
  const { data: resources, isLoading: loadingResources } = useSWR<SystemResources>('/api/system/resources', fetcher, {
    refreshInterval: 10_000,
  });

  const { data: containerData } = useSWR<RunningInstance[] | { data: RunningInstance[] }>('/back/api/instances', fetcher, {
    refreshInterval: 20_000,
  });
  const { data: vmData } = useSWR<VmInstance[] | { data: VmInstance[] }>('/back/api/vms', fetcher, {
    refreshInterval: 20_000,
  });

  const containers: RunningInstance[] = Array.isArray(containerData)
    ? containerData
    : (containerData as any)?.data ?? [];
  const vms: VmInstance[] = Array.isArray(vmData)
    ? vmData
    : (vmData as any)?.data ?? [];

  const primaryDisk = resources?.disks?.[0];

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>系统资源详情</Typography>
          <Typography variant="body1" color="text.secondary">查看服务器资源占用与虚拟化实例总体情况</Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <ResourceCard
              title="CPU"
              icon={<MonitorHeartIcon color="primary" />}
              value={resources ? `${resources.cpu.usagePercent.toFixed(1)}%` : '--'}
              percent={resources?.cpu?.usagePercent}
              helperText={resources ? `${resources.cpu.cores} 核 | 1/5/15 分钟负载 ${resources.cpu.loadAverage.map(v => v.toFixed(2)).join(' / ')}` : ''}
              loading={loadingResources}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <ResourceCard
              title="内存"
              icon={<MemoryIcon color="primary" />}
              value={resources ? `${formatBytes(resources.memory.used)} / ${formatBytes(resources.memory.total)}` : '--'}
              percent={resources?.memory?.usedPercent}
              helperText={resources ? `剩余 ${formatBytes(resources.memory.free)}` : ''}
              loading={loadingResources}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <ResourceCard
              title="磁盘"
              icon={<StorageIcon color="primary" />}
              value={primaryDisk ? `${formatBytes(primaryDisk.usedKB * 1024)} / ${formatBytes(primaryDisk.sizeKB * 1024)}` : '--'}
              percent={primaryDisk?.usedPercent}
              helperText={primaryDisk ? `挂载点 ${primaryDisk.mountpoint}` : '等待加载磁盘信息'}
              loading={loadingResources}
            />
          </Grid>
        </Grid>

        <DiskTable disks={resources?.disks} loading={loadingResources} />

        <Divider />

        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>虚拟化与容器实例概览</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <InstanceBlock
                title="虚拟机实例"
                icon={<DnsIcon color="primary" />}
                items={vms.map(vm => ({
                  id: vm.id,
                  name: vm.name,
                  status: vm.state,
                  extra: vm.ip ? `IP: ${vm.ip}` : undefined
                }))}
                typeKey="vm"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <InstanceBlock
                title="容器实例"
                icon={<RouterIcon color="primary" />}
                items={containers.map(c => ({
                  id: c.id,
                  name: c.name,
                  status: c.status,
                  extra: c.ipAddress ? `IP: ${c.ipAddress}` : undefined
                }))}
                typeKey="container"
              />
            </Grid>
          </Grid>
        </Box>
      </Stack>
    </Container>
  );
};

export default SystemResourcesPage;
