"use client";
import React from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Stack,
  Typography,
  Paper,
  Skeleton,
  LinearProgress,
} from "@mui/material";
import {
  Dns,
  Memory as MemoryIconMui,
  Storage as StorageIcon,
  NetworkCheck,
} from "@mui/icons-material";
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
  disks_rw_mbps: number;
  network_throughput_mbps: number;
}

/* ---------- 公用小组件 ---------- */
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
    isValidating, // 后台刷新中
  } = useSWR<OverviewData>(`/api/vms/${vmId}`, fetcher, {
    refreshInterval: 5000, // 5 s 轮询
    keepPreviousData: true,
    refreshWhenHidden: false, // 标签页不可见时暂停
    dedupingInterval: 5000, // 与 refreshInterval 对齐
  });

  const initialLoading = isLoading && !data; // 只在首屏显示 Skeleton
  const overviewData = data ?? null;

  if (error) {
    return (
        <Alert severity="error" sx={{ m: 2 }}>
          Error loading overview: {(error as any).message || "unknown"}
        </Alert>
    );
  }

  return (
      <Stack spacing={2.5} sx={{ p: 0.5, position: "relative" }}>
        {/* 细线进度条：后台刷新时出现，不影响内容 */}
        {isValidating && (
            <LinearProgress
                sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 }}
            />
        )}

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
                    label="Status"
                    value={overviewData?.status}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="Host Node"
                    value={overviewData?.hostNode}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="Pool"
                    value={overviewData?.pool}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="vCPU Count"
                    value={overviewData?.vcpu?.count}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="vRAM Total"
                    value={
                      overviewData?.vram?.total_mb !== undefined
                          ? `${overviewData.vram.total_mb} MB`
                          : undefined
                    }
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="Boot Source"
                    value={overviewData?.bootSource}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="UUID"
                    value={overviewData?.uuid}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="IP Address"
                    value={overviewData?.ipAddress}
                    isLoading={initialLoading}
                />
                <KeyValueListItem
                    label="Uptime"
                    value={overviewData?.uptime}
                    isLoading={initialLoading}
                />
              </Stack>
            </Paper>
          </Grid>

          {/* ---------- 右侧实时用量 ---------- */}
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
                      value={overviewData?.vcpu?.usage_percent ?? 0}
                      icon={<Dns fontSize="small" />}
                      isLoading={initialLoading}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MiniGauge
                      label="Memory"
                      value={overviewData?.vram?.usage_percent ?? 0}
                      icon={<MemoryIconMui fontSize="small" />}
                      isLoading={initialLoading}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MiniGauge
                      label="Disk R/W"
                      value={overviewData?.disks_rw_mbps ?? 0}
                      unit="MB/s"
                      icon={<StorageIcon fontSize="small" />}
                      isLoading={initialLoading}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <MiniGauge
                      label="Net Throughput"
                      value={overviewData?.network_throughput_mbps ?? 0}
                      unit="Mbps"
                      icon={<NetworkCheck fontSize="small" />}
                      isLoading={initialLoading}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
  );
}
