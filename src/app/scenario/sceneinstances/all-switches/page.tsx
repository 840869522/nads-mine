// src/app/scenario/sceneinstances/all-switches/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Paper,
    Button,
    Tooltip,
    IconButton,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import { Refresh as RefreshIcon, Delete as DeleteIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import Link from 'next/link';

// API 基础路径
const API_BASE = "/back";

// 定义交换机数据类型
interface SwitchInstance {
    id: string; // 使用 switch_name 作为唯一的 id
    switch_name: string;
    source: string;
}

const AllSwitchesPage: React.FC = () => {
    const theme = useTheme();
    const [switches, setSwitches] = useState<GridRowsProp>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // ⭐ 新增：追踪正在被删除的行的 ID，用于显示加载状态
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // 获取所有交换机数据 (逻辑不变)
    const fetchAllSwitches = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const url = `${API_BASE}/api/scenariosinstances/switches`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `获取交换机列表失败，状态码: ${response.status}`);
            }
            const data: Omit<SwitchInstance, 'id'>[] = await response.json();
            const formattedData = data.map((item) => ({ id: item.switch_name, ...item }));
            setSwitches(formattedData);
        } catch (err: any) {
            setError(err.message || '发生未知错误，无法连接到后端服务。');
            setSwitches([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllSwitches();
    }, [fetchAllSwitches]);
    
    // ⭐ 修改：为删除按钮添加实际功能
    const handleDeleteSwitch = async (switchId: string, switchName: string) => {
        const isConfirmed = window.confirm(`您确定要删除交换机 "${switchName}" 吗？此操作无法恢复。`);
        if (!isConfirmed) {
            return;
        }

        setDeletingId(switchId); // 设置当前行正在删除中

        try {
            // 假设删除交换机的 API 端点是 DELETE /api/scenariosinstances/switches/{switch_name}
            // ！！！请确保您的后端实现了此接口 ！！！
            const url = `${API_BASE}/api/scenariosinstances/switches/${switchName}`;
            const response = await fetch(url, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "未知错误" }));
                throw new Error(errorData.detail || errorData.message || `删除失败，状态码: ${response.status}`);
            }

            // 删除成功后，从前端状态中移除该行
            setSwitches((prevSwitches) => prevSwitches.filter(s => s.id !== switchId));

        } catch (err: any) {
            // 如果删除失败，显示错误提示
            alert(`删除失败: ${err.message}`);
        } finally {
            setDeletingId(null); // 重置删除状态
        }
    };
    
    // ⭐ 修改：更新列定义以在删除时显示加载动画
    const columns: GridColDef[] = [
        {
            field: 'switch_name',
            headerName: '交换机名称',
            flex: 1.5,
            renderCell: (params) => <Typography variant="body2" sx={{ fontWeight: 500 }}>{params.value}</Typography>,
        },
        {
            field: 'source',
            headerName: '来源',
            flex: 1,
        },
        {
            field: 'actions',
            headerName: '操作',
            sortable: false,
            width: 100,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => {
                const isDeleting = deletingId === params.row.id;
                return (
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        {isDeleting ? (
                            <CircularProgress size={24} />
                        ) : (
                            <Tooltip title="删除交换机">
                                <div> {/* 用于包裹 disabled 的 IconButton，确保 Tooltip 生效 */}
                                    <IconButton
                                        color="error"
                                        size="small"
                                        onClick={() => handleDeleteSwitch(params.row.id, params.row.switch_name)}
                                        disabled={isDeleting}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </div>
                            </Tooltip>
                        )}
                    </Box>
                );
            }
        }
    ];

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
            {/* ... 页面标题和刷新按钮部分保持不变 ... */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
                <Box>
                    <Button component={Link} href="/scenario/sceneinstances" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
                        返回实例列表
                    </Button>
                    <Typography variant="h4" component="h1" fontWeight="bold">
                        所有交换机
                    </Typography>
                </Box>
                <Button variant="outlined" startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />} onClick={fetchAllSwitches} disabled={isLoading}>
                    {isLoading ? '加载中...' : '刷新'}
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper elevation={2} sx={{ height: '75vh', width: '100%' }}>
                <DataGrid
                    rows={switches}
                    columns={columns}
                    loading={isLoading}
                    disableRowSelectionOnClick
                    slots={{
                      noRowsOverlay: () => (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography color="text.secondary">没有找到任何交换机</Typography>
                        </Box>
                      ),
                    }}
                    sx={{ border: 0 }}
                />
            </Paper>
        </Paper>
    );
};

export default AllSwitchesPage;