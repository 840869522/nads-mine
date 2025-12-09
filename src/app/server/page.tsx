"use client";

import {
    Paper,
    TextField,
    Button,
    Typography,
    Box,
    Stack,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    IconButton,
    Divider,
    Alert,
    CircularProgress
} from "@mui/material";
import { useState, useEffect } from "react";
import { apiClientWithToken } from "@/utils/axios";
import { toast } from "react-toastify";
import { Edit, Delete } from "@mui/icons-material";

interface FallbackTarget {
    id?: number;
    name: string;
    host: string;
    port: string;
}

const ServerPage: React.FC = () => {
    const [fallbackTargets, setFallbackTargets] = useState<FallbackTarget[]>([]);
    const [fallbackForm, setFallbackForm] = useState<FallbackTarget>({ name: "", host: "", port: "" });
    const [editingTargetId, setEditingTargetId] = useState<number | null>(null);
    const [fallbackLoading, setFallbackLoading] = useState(false);
    const [fallbackSaving, setFallbackSaving] = useState(false);
    const [fallbackError, setFallbackError] = useState<string>("");

    const loadFallbackTargets = async () => {
        setFallbackLoading(true);
        setFallbackError("");
        try {
            const res = await apiClientWithToken.get("/back/api/support/fallback-targets");
            const list = Array.isArray(res.data?.data) ? res.data.data : [];
            setFallbackTargets(list);
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "加载备用节点失败";
            setFallbackError(msg);
        } finally {
            setFallbackLoading(false);
        }
    };

    useEffect(() => {
        loadFallbackTargets();
    }, []);

    const resetFallbackForm = () => {
        setFallbackForm({ name: "", host: "", port: "" });
        setEditingTargetId(null);
    };

    const handleFallbackChange = (field: keyof FallbackTarget, value: string) => {
        setFallbackForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveFallback = async () => {
        if (!fallbackForm.name.trim() || !fallbackForm.host.trim() || !fallbackForm.port.trim()) {
            setFallbackError("请完整填写名称、Host 和端口");
            return;
        }

        setFallbackSaving(true);
        setFallbackError("");

        try {
            if (editingTargetId) {
                await apiClientWithToken.put(`/back/api/support/fallback-targets/${editingTargetId}`, fallbackForm);
                toast.success("备用节点已更新");
            } else {
                await apiClientWithToken.post("/back/api/support/fallback-targets", fallbackForm);
                toast.success("备用节点已创建");
            }
            await loadFallbackTargets();
            resetFallbackForm();
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "保存失败";
            setFallbackError(msg);
        } finally {
            setFallbackSaving(false);
        }
    };

    const handleEditFallback = (target: FallbackTarget) => {
        setFallbackForm({ name: target.name, host: target.host, port: target.port });
        setEditingTargetId(target.id ?? null);
    };

    const handleDeleteFallback = async (target: FallbackTarget) => {
        if (!target.id) return;
        if (!window.confirm(`确认删除 ${target.name}?`)) return;
        setFallbackSaving(true);
        setFallbackError("");
        try {
            await apiClientWithToken.delete(`/back/api/support/fallback-targets/${target.id}`);
            toast.success("已删除备用节点");
            await loadFallbackTargets();
            if (editingTargetId === target.id) {
                resetFallbackForm();
            }
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "删除失败";
            setFallbackError(msg);
        } finally {
            setFallbackSaving(false);
        }
    };

    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">备用节点管理</Typography>
                <Button
                    variant="outlined"
                    onClick={loadFallbackTargets}
                    startIcon={fallbackLoading ? <CircularProgress size={18} /> : undefined}
                    disabled={fallbackLoading}
                >
                    重新加载
                </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {fallbackError && <Alert severity="error" sx={{ mb: 2 }}>{fallbackError}</Alert>}
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                        label="名称"
                        value={fallbackForm.name}
                        onChange={(e) => handleFallbackChange("name", e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="Host"
                        value={fallbackForm.host}
                        onChange={(e) => handleFallbackChange("host", e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="端口"
                        value={fallbackForm.port}
                        onChange={(e) => handleFallbackChange("port", e.target.value)}
                        fullWidth
                    />
                </Stack>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        onClick={handleSaveFallback}
                        disabled={fallbackSaving}
                    >
                        {fallbackSaving ? <CircularProgress size={20} /> : editingTargetId ? "保存修改" : "添加节点"}
                    </Button>
                    <Button variant="outlined" onClick={resetFallbackForm} disabled={fallbackSaving}>
                        重置
                    </Button>
                </Box>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>名称</TableCell>
                            <TableCell>Host</TableCell>
                            <TableCell>端口</TableCell>
                            <TableCell align="right">操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {fallbackLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    <CircularProgress size={24} />
                                </TableCell>
                            </TableRow>
                        ) : fallbackTargets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center">
                                    暂无数据
                                </TableCell>
                            </TableRow>
                        ) : (
                            fallbackTargets.map((item) => (
                                <TableRow key={item.id ?? `${item.host}-${item.port}`}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.host}</TableCell>
                                    <TableCell>{item.port}</TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" onClick={() => handleEditFallback(item)} disabled={fallbackSaving}>
                                            <Edit fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteFallback(item)} disabled={fallbackSaving}>
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Stack>
        </Paper>
    );
};

export default ServerPage;
