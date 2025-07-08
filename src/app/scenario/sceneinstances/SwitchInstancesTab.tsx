// src/app/scenario/sceneinstances/SwitchInstancesTab.tsx
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
    IconButton, // 导入 IconButton
} from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import { Refresh as RefreshIcon, Delete as DeleteIcon } from '@mui/icons-material'; // 导入 DeleteIcon
import { useTheme } from '@mui/material/styles';

const API_BASE = "/back";

interface SwitchInstance {
    id: string;
    switch_name: string;
    instance_id: string;
    source: string;
}

interface SwitchInstancesTabProps {
    instanceId: string | null;
}

const SwitchInstancesTab: React.FC<SwitchInstancesTabProps> = ({ instanceId }) => {
    const theme = useTheme();
    const [switches, setSwitches] = useState<GridRowsProp>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSwitches = useCallback(async () => {
        // ... (数据获取逻辑保持不变)
        if (!instanceId) {
            setSwitches([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const url = `${API_BASE}/api/scenariosinstances/${instanceId}/switches`;
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `获取交换机列表失败，状态码: ${response.status}`);
            }
            const data: SwitchInstance[] = await response.json();
            const formattedData = data.map((item) => ({ id: item.switch_name, ...item }));
            setSwitches(formattedData);
        } catch (err: any) {
            setError(err.message || '发生未知错误，无法连接到后端服务。');
            setSwitches([]);
        } finally {
            setIsLoading(false);
        }
    }, [instanceId]);

    useEffect(() => {
        fetchSwitches();
    }, [fetchSwitches]);

    // ⭐ 新增：处理删除按钮点击事件的函数
    const handleDeleteSwitch = (switchName: string) => {
        // 使用 window.confirm 提供一个简单的确认对话框
        const isConfirmed = window.confirm(`您确定要删除交换机 "${switchName}" 吗？`);
        if (isConfirmed) {
            // 在实际应用中，这里会调用后端 API
            // 目前，我们只在前端显示一个提示信息
            alert(`功能待实现：正在删除交换机 ${switchName}。`);
            // 可以在这里暂时从前端列表中移除该项，以模拟删除效果
            // setSwitches((prevSwitches) => prevSwitches.filter(s => s.id !== switchName));
        }
    };
    
    // ⭐ 修改：更新 DataGrid 的列定义
    const columns: GridColDef[] = [
        {
            field: 'switch_name',
            headerName: '交换机名称',
            flex: 1,
            renderCell: (params) => (
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {params.value}
                </Typography>
            ),
        },
        {
            field: 'instance_id',
            headerName: '场景实例 ID',
            flex: 1.5,
            renderCell: (params) => (
                 <Tooltip title={params.value}>
                    <code>{params.value}</code>
                </Tooltip>
            )
        },
        {
            field: 'source',
            headerName: '来源',
            width: 150,
        },
        // ⭐ 新增：“操作”列
        {
            field: 'actions',
            headerName: '操作',
            sortable: false,
            width: 100,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => {
                return (
                    <Tooltip title="删除交换机">
                        {/* 点击时调用 handleDeleteSwitch 函数 */}
                        <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleDeleteSwitch(params.row.switch_name)}
                        >
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                );
            }
        }
    ];

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography variant="h6" component="h2">
                    交换机列表
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                    onClick={fetchSwitches}
                    disabled={isLoading || !instanceId}
                >
                    {isLoading ? '刷新中...' : '刷新'}
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Paper sx={{ height: 'calc(100vh - 350px)', width: '100%' }}>
                <DataGrid
                    rows={switches}
                    columns={columns} // 使用更新后的列
                    loading={isLoading}
                    autoHeight={false}
                    disableRowSelectionOnClick
                    slots={{
                      noRowsOverlay: () => (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography color="text.secondary">
                            {instanceId ? '没有找到交换机数据' : '请先选择一个场景实例'}
                          </Typography>
                        </Box>
                      ),
                    }}
                    sx={{
                        border: 0,
                        '& .MuiDataGrid-columnHeaders': {
                            backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[200],
                            fontWeight: 'bold',
                        },
                    }}
                />
            </Paper>
        </Box>
    );
};

export default SwitchInstancesTab;