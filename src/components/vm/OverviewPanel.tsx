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
  uptime: string;
  hostNode: string;
  pool: string;
  vcpu: VCPUInfo;
  vram: VRAMInfo;
  bootSource: string;
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

          {/* ---------- 右侧占位（实时用量已移除） ---------- */}
          <Grid item xs={12} md={7}>
            <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
              <Typography
                  variant="h6"
                  sx={{ mb: 1.5, borderBottom: "1px solid #ddd", pb: 1 }}
              >
                实时用量
              </Typography>
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ height: 120 }}
              >
                <Typography variant="body2" color="text.secondary">
                  实时资源监控已禁用
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
  );
}
