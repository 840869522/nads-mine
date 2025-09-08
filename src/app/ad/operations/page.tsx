// src/app/ad/operations/Page.tsx

"use client";

import React, { useState, useEffect, useCallback, FormEvent, MouseEvent } from 'react';
// MUI 组件、图标等导入...
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GppGoodIcon from '@mui/icons-material/GppGood';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// === 类型定义 ===
type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
type LogStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

interface SystemLog {
    c_id: string;
    c_timestamp: string;
    c_service_name: string;
    c_level: LogLevel;
    c_message: string;
    c_status: LogStatus;
    c_acknowledged_by?: string;
    c_resolution_notes?: string;
}

const Page: React.FC = () => {
    // === 状态管理 ===
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalLogs, setTotalLogs] = useState(0);

    // 筛选状态
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<LogStatus | 'ALL'>('ALL');

    // 解决弹窗状态
    const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
    const [logToResolve, setLogToResolve] = useState<SystemLog | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');

    const API_BASE_URL = '/back/api';

    // === 数据获取 ===
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            const params = new URLSearchParams({
                page: String(page + 1),
                per_page: String(rowsPerPage),
            });
            if (levelFilter !== 'ALL') params.append('level', levelFilter);
            if (statusFilter !== 'ALL') params.append('status', statusFilter);

            const response = await fetch(`${API_BASE_URL}/operations/logs?${params.toString()}`);
            if (!response.ok) throw new Error('获取系统日志失败');

            const result = await response.json();
            setLogs(result.data ?? []);
            setTotalLogs(result.total ?? 0);
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [page, rowsPerPage, levelFilter, statusFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);
    // 当筛选条件变化时，回到第一页
    useEffect(() => { setPage(0); }, [levelFilter, statusFilter]);

    // === 事件处理器 ===
    const handleAcknowledge = async (logId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/operations/logs/${logId}/acknowledge`, { method: 'POST' });
            if (!response.ok) throw new Error('确认日志失败');
            setStatusMessage({ type: 'success', message: '日志已确认' });
            fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        }
    };

    const handleOpenResolveDialog = (log: SystemLog) => {
        setLogToResolve(log);
        setResolutionNotes('');
        setIsResolveDialogOpen(true);
    };

    const handleResolveSubmit = async () => {
        if (!logToResolve) return;
        try {
            const response = await fetch(`${API_BASE_URL}/operations/logs/${logToResolve.c_id}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: resolutionNotes }),
            });
            if (!response.ok) throw new Error('解决日志失败');
            setStatusMessage({ type: 'success', message: '日志已解决' });
            setIsResolveDialogOpen(false);
            fetchData();
        } catch (err) {
            setStatusMessage({ type: 'error', message: (err as Error).message });
        }
    };

    // === 渲染辅助函数 ===
    const renderLogLevelChip = (level: LogLevel) => {
        const map = {
            INFO: { label: '信息', color: 'info' as const },
            WARNING: { label: '警告', color: 'warning' as const },
            ERROR: { label: '错误', color: 'error' as const },
            CRITICAL: { label: '严重', color: 'error' as const, variant: 'filled' as const},
        };
        const props = map[level];
        return <Chip {...props} size="small" />;
    };

    const renderLogStatusChip = (status: LogStatus) => {
        const map = {
            OPEN: { label: '待处理', color: 'warning' as const },
            ACKNOWLEDGED: { label: '处理中', color: 'primary' as const },
            RESOLVED: { label: '已解决', color: 'success' as const },
        };
        const { label, color } = map[status];
        return <Chip label={label} color={color} size="small" />;
    }

    return (
        <Box sx={{ p: 3, maxWidth: '1600px', margin: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">运维管理</Typography>
                <Stack direction="row" spacing={2}>
                    <FormControl size="small" sx={{minWidth: 120}}>
                        <InputLabel>日志级别</InputLabel>
                        <Select value={levelFilter} label="日志级别" onChange={(e) => setLevelFilter(e.target.value as any)}>
                            <MenuItem value="ALL">全部</MenuItem>
                            <MenuItem value="INFO">信息</MenuItem>
                            <MenuItem value="WARNING">警告</MenuItem>
                            <MenuItem value="ERROR">错误</MenuItem>
                            <MenuItem value="CRITICAL">严重</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{minWidth: 120}}>
                        <InputLabel>处理状态</InputLabel>
                        <Select value={statusFilter} label="处理状态" onChange={(e) => setStatusFilter(e.target.value as any)}>
                            <MenuItem value="ALL">全部</MenuItem>
                            <MenuItem value="OPEN">待处理</MenuItem>
                            <MenuItem value="ACKNOWLEDGED">处理中</MenuItem>
                            <MenuItem value="RESOLVED">已解决</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Box>

            {statusMessage && <Alert severity={statusMessage.type} sx={{ mb: 2 }}>{statusMessage.message}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>时间</TableCell>
                                <TableCell>服务</TableCell>
                                <TableCell>级别</TableCell>
                                <TableCell>信息</TableCell>
                                <TableCell>状态</TableCell>
                                <TableCell align="right">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? ( <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow> )
                                : logs.map(log => (
                                    <TableRow hover key={log.c_id}>
                                        <TableCell>{new Date(log.c_timestamp).toLocaleString()}</TableCell>
                                        <TableCell>{log.c_service_name}</TableCell>
                                        <TableCell>{renderLogLevelChip(log.c_level)}</TableCell>
                                        <TableCell sx={{maxWidth: '500px', wordBreak: 'break-word'}}>{log.c_message}</TableCell>
                                        <TableCell>{renderLogStatusChip(log.c_status)}</TableCell>
                                        <TableCell align="right">
                                            {log.c_status === 'OPEN' && (
                                                <Tooltip title="我来处理 (确认)"><IconButton color="primary" onClick={() => handleAcknowledge(log.c_id)}><CheckCircleOutlineIcon /></IconButton></Tooltip>
                                            )}
                                            {log.c_status === 'ACKNOWLEDGED' && (
                                                <Tooltip title="标记为已解决"><IconButton color="success" onClick={() => handleOpenResolveDialog(log)}><GppGoodIcon /></IconButton></Tooltip>
                                            )}
                                            {log.c_status === 'RESOLVED' && (
                                                <Tooltip title="查看解决详情"><IconButton disabled><InfoOutlinedIcon /></IconButton></Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination component="div" count={totalLogs} page={page} onPageChange={(e, p) => setPage(p)} rowsPerPage={rowsPerPage} onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))} />
            </Paper>

            <Dialog open={isResolveDialogOpen} onClose={() => setIsResolveDialogOpen(false)}>
                <DialogTitle>解决日志</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="解决备注" fullWidth multiline rows={4} value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsResolveDialogOpen(false)}>取消</Button>
                    <Button onClick={handleResolveSubmit} variant="contained">确认解决</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Page;