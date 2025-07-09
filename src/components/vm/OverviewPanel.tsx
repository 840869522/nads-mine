"use client";
import React from "react";
import {
  Alert,
  Grid,
  Stack,
  Typography,
  Paper,
  Skeleton,
} from "@mui/material";
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
  hostNode: string;
  pool: string;
  vcpu: VCPUInfo;
  vram: VRAMInfo;
  osType?: string;
  persistent?: boolean;
  autostart?: boolean;
  uuid: string;
  ipAddress: string;
}


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
  } = useSWR<OverviewData>(`/back/api/vms/${vmId}`, fetcher, {
    refreshInterval: 5000, // 5 s 轮询
    keepPreviousData: true,
    refreshWhenHidden: false, // 标签页不可见时暂停
    dedupingInterval: 5000, // 与 refreshInterval 对齐
  });

  const overviewData = data ?? null;

  const initialLoading = isLoading && !data;

  if (error) {
    return (
        <Alert severity="error" sx={{ m: 2 }}>
          Error loading overview: {(error as any).message || "unknown"}
        </Alert>
    );
  }


  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography
        variant="h6"
        sx={{ mb: 1.5, borderBottom: "1px solid #ddd", pb: 1 }}
      >
        基本配置
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
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
          </Stack>
        </Grid>

        <Grid item xs={12} md={6}>
          <Stack spacing={0}>
            <KeyValueListItem
              label="OS 类型"
              value={overviewData?.osType}
              isLoading={initialLoading}
            />
            <KeyValueListItem
              label="持久化"
              value={
                overviewData?.persistent === undefined
                  ? undefined
                  : overviewData.persistent
                  ? "是"
                  : "否"
              }
              isLoading={initialLoading}
            />
            <KeyValueListItem
              label="自动启动"
              value={
                overviewData?.autostart === undefined
                  ? undefined
                  : overviewData.autostart
                  ? "是"
                  : "否"
              }
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
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
}
