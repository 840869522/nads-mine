"use client";
import React from "react";
import {
  Alert,
  Grid,
  Stack,
  Typography,
  Paper,
  Skeleton,
  CircularProgress,
} from "@mui/material";
import { Dns, Memory as MemoryIconMui, Storage as StorageIcon, NetworkCheck } from "@mui/icons-material";
import useSWR from "swr";

/* ---------- 类型 ---------- */
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
}

interface RealtimeMetrics {
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  disk_rw_mb_s: number;
  network_mbps: number;
}

const MiniGauge: React.FC<{
  label: string;
  value: number;
  unit?: string;
  icon?: React.ReactElement;
  isLoading?: boolean;
}> = ({ label, value, unit = "%", icon, isLoading }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      textAlign: "center",
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}
  >
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="center"
      sx={{ mb: 1 }}
    >
      {icon}
      <Typography variant="subtitle2">{label}</Typography>
    </Stack>

    {isLoading ? (
      <Skeleton
        variant="circular"
        width={60}
        height={60}
        sx={{ my: 1, mx: "auto" }}
      />
    ) : (
      <CircularProgress
        variant="determinate"
        value={unit === "%" ? value : value > 0 ? 100 : 0}
        size={60}
        thickness={4}
        sx={{ my: 1 }}
      />
    )}

    {isLoading ? (
      <Skeleton width="50%" sx={{ mx: "auto" }} />
    ) : (
      <Typography variant="h6" display="block">
        {value.toFixed(1)}
        {unit}
      </Typography>
    )}
  </Paper>
);

const MetricBox: React.FC<{
  label: string;
  value: number;
  unit?: string;
  icon?: React.ReactElement;
  isLoading?: boolean;
}> = ({ label, value, unit = '', icon, isLoading }) => (
  <Paper
    variant="outlined"
    sx={{ p: 2, textAlign: 'center', width: '100%', height: '100%' }}
  >
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="center"
      sx={{ mb: 1 }}
    >
      {icon}
      <Typography variant="subtitle2">{label}</Typography>
    </Stack>
    {isLoading ? (
      <Skeleton width="60%" sx={{ mx: 'auto' }} />
    ) : (
      <Typography variant="h6" display="block">
        {value.toFixed(1)} {unit}
      </Typography>
    )}
  </Paper>
);

const KeyValueListItem: React.FC<{
  label: string;
  value: string | number | undefined;
  isLoading?: boolean;
}> = ({ label, value, isLoading }) => (
    <Stack
        direction="row"
        justifyContent="space-between"
        sx={{
          py: 1,
          borderBottom: "1px solid #eee",
          "&:last-child": { borderBottom: "none" },
        }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}:
      </Typography>
      {isLoading ? (
          <Skeleton width="40%" />
      ) : (
          <Typography variant="body2" sx={{ textAlign: "right" }}>
            {value ?? "N/A"}
          </Typography>
      )}
    </Stack>
);

/* ---------- 主组件 ---------- */
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OverviewPanel({ vmId }: OverviewPanelProps) {
  /* --- SWR 轮询，保留旧数据 --- */
  const {
    data,
    error,
    isLoading,
  } = useSWR<OverviewData>(`/api/vms/${vmId}`, fetcher, {
    refreshInterval: 5000, // 5 s 轮询
    keepPreviousData: true,
    refreshWhenHidden: false, // 标签页不可见时暂停
    dedupingInterval: 5000, // 与 refreshInterval 对齐
  });

  const overviewData = data ?? null;
  const metricsKey =
    overviewData && overviewData.status !== "shutoff"
      ? `/api/vms/${vmId}/metrics`
      : null;

  const {
    data: rtData,
    error: rtError,
    isLoading: rtLoading,
  } = useSWR<RealtimeMetrics>(metricsKey, fetcher, {
    refreshInterval: 5000,
    keepPreviousData: true,
    refreshWhenHidden: false,
    dedupingInterval: 5000,
  });

  const initialLoading = isLoading && !data;
  const metrics = rtData ?? null;

  if (error) {
    return (
        <Alert severity="error" sx={{ m: 2 }}>
          Error loading overview: {(error as any).message || "unknown"}
        </Alert>
    );
  }

  if (metricsKey && rtError) {
    return (
        <Alert severity="error" sx={{ m: 2 }}>
          Error loading metrics: {(rtError as any).message || "unknown"}
        </Alert>
    );
  }

  return (
      <Stack spacing={2.5} sx={{ p: 0.5, position: "relative" }}>

        <Grid container spacing={2.5}>
          {/* ---------- 左侧基本信息 ---------- */}
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
              <Typography
                  variant="h6"
                  sx={{ mb: 1.5, borderBottom: "1px solid #ddd", pb: 1 }}
              >
                基本配置
              </Typography>
              <Stack spacing={0}>
                <KeyValueListItem
                    label="状态"
                    value={overviewData?.status}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="宿主机"
                    value={overviewData?.hostNode}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="存储池"
                    value={overviewData?.pool}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="vCPU 数"
                    value={overviewData?.vcpu?.count}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="内存总量"
                    value={
                      overviewData?.vram?.total_mb !== undefined
                          ? `${overviewData.vram.total_mb} MB`
                          : undefined
                    }
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="启动介质"
                    value={overviewData?.bootSource}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="UUID"
                    value={overviewData?.uuid}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="IP 地址"
                    value={overviewData?.ipAddress}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="运行时长"
                    value={overviewData?.uptime}
                    isLoading={initialLoading}
                />
              </Stack>
            </Paper>
          </Grid>

          {metricsKey && (
            <Grid item xs={12} md={7}>
              <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                <Typography
                    variant="h6"
                    sx={{ mb: 1.5, borderBottom: "1px solid #ddd", pb: 1 }}
                >
                  实时用量
                </Typography>
                <Grid container spacing={2} alignItems="stretch">
                  <Grid item xs={6} sm={3}>
                    <MiniGauge
                        label="CPU"
                        value={metrics?.cpu_percent ?? 0}
                        icon={<Dns fontSize="small" />}
                        isLoading={rtLoading && !metrics}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <MiniGauge
                        label="内存"
                        value={metrics?.memory_percent ?? 0}
                        icon={<MemoryIconMui fontSize="small" />}
                        isLoading={rtLoading && !metrics}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <MetricBox
                        label="磁盘读写"
                        value={metrics?.disk_rw_mb_s ?? 0}
                        unit="MB/s"
                        icon={<StorageIcon fontSize="small" />}
                        isLoading={rtLoading && !metrics}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <MetricBox
                        label="网络吞吐"
                        value={metrics?.network_mbps ?? 0}
                        unit="Mbps"
                        icon={<NetworkCheck fontSize="small" />}
                        isLoading={rtLoading && !metrics}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Stack>
  );
}
