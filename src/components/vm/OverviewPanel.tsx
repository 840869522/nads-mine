"use client";
import React from "react";
import {
    Alert,
    Box,
    Stack,
    Typography,
    Paper,
    Skeleton,
} from "@mui/material";
import useSWR from "swr";

// --- Step 1: Import the desired icons ---
import PowerSettingsNewOutlinedIcon from '@mui/icons-material/PowerSettingsNewOutlined';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import DeveloperBoardOutlinedIcon from '@mui/icons-material/DeveloperBoardOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';


/* ---------- 类型 (No changes here) ---------- */
interface OverviewPanelProps {
    vmId: string;
}
// ... (rest of the interfaces are the same)
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


/* --- Step 2: Update KeyValueListItem to accept icons and have larger text --- */
const KeyValueListItem: React.FC<{
    label: string;
    value: string | number | undefined;
    isLoading?: boolean;
    icon?: React.ReactNode; // Add icon to props
}> = ({ label, value, isLoading, icon }) => (
    <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center" // Vertically align items
        sx={{
            py: 1.5, // Increased padding for better spacing
            borderBottom: "1px solid #eee",
            "&:last-child": { borderBottom: "none" },
        }}
    >
        {/* Group icon and label together on the left */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
            {isLoading ? <Skeleton variant="circular" width={22} height={22} /> : icon}
            <Typography
                variant="body1" /* Use body1 for larger font */
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center' }}
            >
                {isLoading ? <Skeleton width={80} /> : `${label}:`}
            </Typography>
        </Stack>

        {/* Value remains on the right */}
        {isLoading ? (
            <Skeleton width="40%" />
        ) : (
            <Typography variant="body1" sx={{ textAlign: "right" }}>
                {value ?? "N/A"}
            </Typography>
        )}
    </Stack>
);

/* ---------- 主组件 (Refactored) ---------- */
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OverviewPanel({ vmId }: OverviewPanelProps) {
    const {
        data,
        error,
        isLoading,
    } = useSWR<OverviewData>(`/back/api/vms/${vmId}`, fetcher, {
        refreshInterval: 5000,
        keepPreviousData: true,
        refreshWhenHidden: false,
        dedupingInterval: 5000,
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

    /* --- Step 3: Add the icon components to your data array --- */
    const overviewItems = [
        { label: "状态", value: overviewData?.status, icon: <PowerSettingsNewOutlinedIcon color="action" /> },
        { label: "OS 类型", value: overviewData?.osType, icon: <TerminalOutlinedIcon color="action" /> },
        { label: "宿主机", value: overviewData?.hostNode, icon: <DnsOutlinedIcon color="action" /> },
        { label: "持久化", value: overviewData?.persistent === undefined ? undefined : overviewData.persistent ? "是" : "否", icon: <SaveOutlinedIcon color="action" /> },
        { label: "存储池", value: overviewData?.pool, icon: <StorageOutlinedIcon color="action" /> },
        { label: "自动启动", value: overviewData?.autostart === undefined ? undefined : overviewData.autostart ? "是" : "否", icon: <AutorenewOutlinedIcon color="action" /> },
        { label: "vCPU 数", value: overviewData?.vcpu?.count, icon: <DeveloperBoardOutlinedIcon color="action" /> },
        { label: "UUID", value: overviewData?.uuid, icon: <FingerprintIcon color="action" /> },
        { label: "内存总量", value: overviewData?.vram?.total_mb !== undefined ? `${overviewData.vram.total_mb} MB` : undefined, icon: <MemoryOutlinedIcon color="action" /> },
        { label: "IP 地址", value: overviewData?.ipAddress, icon: <LanOutlinedIcon color="action" /> },
    ];

    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography
                variant="h6"
                sx={{ mb: 1.5, borderBottom: "1px solid #ddd", pb: 1 }}
            >
                基本配置
            </Typography>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    columnGap: 3, // Increased gap slightly for better visual separation
                    rowGap: 0,
                }}
            >
                {overviewItems.map((item) => (
                    /* --- Step 4: Pass the icon to the component --- */
                    <KeyValueListItem
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        isLoading={initialLoading}
                        icon={item.icon}
                    />
                ))}
            </Box>
        </Paper>
    );
}