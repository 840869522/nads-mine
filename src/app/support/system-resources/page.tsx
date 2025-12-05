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
  state: "running" | "paused" | "shutoff" | "shut off";
  vcpu: number;
  vmem: number;
  ip?: string;
  scene_instance_id?: string;
  scene_name?: string;
  uptime?: string;
}

interface VmDetailResponse {
  vram?: {
    total_mb?: number;
  };
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
    case 'shut off':
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
    case 'shutoff':
    case 'shut off':
    case 'stopped':
      return <PauseCircleIcon fontSize="small" color="action" />;
    default:
      return <ErrorIcon fontSize="small" color="error" />;
  }
};

const MetricSparkline = ({ data, color = '#1976d2' }: { data: number[]; color?: string }) => {
  const width = 160;
  const height = 48;

  if (!data.length) {
    return <Skeleton variant="rectangular" height={height} />;
  }

  const maxValue = Math.max(100, ...data);
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
};

const ResourceCard = ({
  title,
  icon,
  percent,
  value,
  helperText,
  loading,
  chart
}: {
  title: string;
  icon: React.ReactNode;
  percent?: number;
  value: string;
  helperText?: string;
  loading?: boolean;
  chart?: React.ReactNode;
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
        <Box sx={{ mb: 1 }}>
          <LinearProgress variant="determinate" value={percent} sx={{ height: 10, borderRadius: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {percent.toFixed(1)}%
          </Typography>
        </Box>
      )}
      {chart && <Box sx={{ mt: 1 }}>{chart}</Box>}
      {helperText && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {loading ? <Skeleton width={200} /> : helperText}
        </Typography>
      )}
    </CardContent>
  </Card>
);

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

  const { data: vmDetails } = useSWR<Record<string, VmDetailResponse> | null>(
    vms.length ? ['vm-details', vms.map(vm => vm.id).join(',')] : null,
    async () => {
      const entries = await Promise.all(
        vms.map(async vm => {
          try {
            const detail = await fetcher(`/back/api/vms/${vm.id}`);
            return [vm.id, detail as VmDetailResponse];
          } catch (error) {
            console.error('Failed to fetch vm detail', vm.id, error);
            return [vm.id, null];
          }
        })
      );

      return Object.fromEntries(entries);
    },
    { refreshInterval: 20_000 }
  );

  const diskTotals = React.useMemo(() => {
    if (!resources?.disks?.length) return undefined;
    const sizeKB = resources.disks.reduce((acc, disk) => acc + (disk.sizeKB || 0), 0);
    const usedKB = resources.disks.reduce((acc, disk) => acc + (disk.usedKB || 0), 0);
    const usedPercent = sizeKB > 0 ? (usedKB / sizeKB) * 100 : 0;
    return { sizeKB, usedKB, usedPercent };
  }, [resources?.disks]);
  const cpuUsage = resources?.cpu?.usagePercent;
  const memoryUsage = resources?.memory;

  const [cpuHistory, setCpuHistory] = React.useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (cpuUsage !== undefined) {
      setCpuHistory(prev => [...prev.slice(-29), cpuUsage]);
    }
  }, [cpuUsage]);

  React.useEffect(() => {
    if (memoryUsage?.usedPercent !== undefined) {
      setMemoryHistory(prev => [...prev.slice(-29), memoryUsage.usedPercent]);
    }
  }, [memoryUsage?.usedPercent]);

  const instanceRows = React.useMemo(() => {
    const containerRows = containers.map(container => ({
      id: container.id,
      name: container.name,
      type: '容器',
      status: container.status,
      ip: container.ipAddress ?? '',
      cpu: container.cpuUsage ?? '',
      memory: container.memoryUsage ?? '',
      disk: container.uptime ?? '',
      scene: container.scene_name ?? ''
    }));

    const vmRows = vms.map(vm => ({
      id: vm.id,
      name: vm.name,
      type: '虚拟机',
      status: vm.state,
      ip: vm.ip ?? '',
      cpu: vm.vcpu ? `${vm.vcpu} vCPU` : '',
      memory: vmDetails?.[vm.id]?.vram?.total_mb ? `${vmDetails[vm.id].vram!.total_mb} MB` : vm.vmem ? `${vm.vmem} MB` : '',
      disk: vm.uptime ?? '',
      scene: vm.scene_name ?? ''
    }));

    return [...containerRows, ...vmRows];
  }, [containers, vms, vmDetails]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>系统资源详情</Typography>
          <Typography variant="body1" color="text.secondary">查看服务器资源占用与虚拟化实例总体情况</Typography>
        </Box>

        <Grid container spacing={2} columns={12}>
          <Grid item xs={12} md={4}>
            <ResourceCard
              title="CPU"
              icon={<MonitorHeartIcon color="primary" />}
              value={cpuUsage !== undefined ? `${cpuUsage.toFixed(1)}%` : '--'}
              percent={cpuUsage}
              helperText={resources?.cpu ? `${resources.cpu.cores} 核` : ''}
              loading={loadingResources}
              chart={<MetricSparkline data={cpuHistory} color="#1976d2" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <ResourceCard
              title="内存"
              icon={<MemoryIcon color="primary" />}
              value={memoryUsage ? `${formatBytes(memoryUsage.used)} / ${formatBytes(memoryUsage.total)}` : '--'}
              percent={memoryUsage?.usedPercent}
              helperText={memoryUsage ? `剩余 ${formatBytes(memoryUsage.free)}` : ''}
              loading={loadingResources}
              chart={<MetricSparkline data={memoryHistory} color="#9c27b0" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <ResourceCard
              title="磁盘"
              icon={<StorageIcon color="primary" />}
              value={diskTotals ? `${formatBytes(diskTotals.usedKB * 1024)} / ${formatBytes(diskTotals.sizeKB * 1024)}` : '--'}
              percent={diskTotals?.usedPercent}
              helperText={diskTotals ? `共 ${resources?.disks?.length ?? 0} 个挂载` : '等待加载磁盘信息'}
              loading={loadingResources}
            />
          </Grid>
        </Grid>

        <Divider />

        <Box>
          <Typography variant="h5" fontWeight={600} gutterBottom>虚拟化与容器实例概览</Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <DnsIcon color="primary" />
              <RouterIcon color="primary" />
              <Typography variant="h6">实例列表</Typography>
              <Chip label={`总计 ${instanceRows.length}`} size="small" sx={{ ml: 'auto' }} />
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>类型</TableCell>
                  <TableCell>名称</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>CPU</TableCell>
                  <TableCell>内存</TableCell>
                  <TableCell>运行时长 / 磁盘</TableCell>
                  <TableCell>场景</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instanceRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">暂无实例</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  instanceRows.map(row => (
                    <TableRow key={`${row.type}-${row.id}`}>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {statusIcon(row.status)}
                          <Chip label={row.status} color={statusColor(row.status) as any} size="small" />
                        </Stack>
                      </TableCell>
                      <TableCell>{row.ip || '-'}</TableCell>
                      <TableCell>{row.cpu || '-'}</TableCell>
                      <TableCell>{row.memory || '-'}</TableCell>
                      <TableCell>{row.disk || '-'}</TableCell>
                      <TableCell>{row.scene || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      </Stack>
    </Container>
  );
};

export default SystemResourcesPage;
