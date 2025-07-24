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
    IconButton,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import { Refresh as RefreshIcon, Delete as DeleteIcon } from '@mui/icons-material';
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
    const [deletingId, setDeletingId] = useState<string | null>(null);


    const fetchSwitches = useCallback(async () => {
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
            const data: Omit<SwitchInstance, 'id'>[] = await response.json();
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

    // [MODIFICATION START] 更新删除处理函数以调用 API
    const handleDeleteSwitch = async (switchId: string, switchName: string) => {
        const isConfirmed = window.confirm(`您确定要删除交换机 "${switchName}" 吗？此操作无法恢复。`);
        if (!isConfirmed || !instanceId) {
            return;
        }

        setDeletingId(switchId); // 开始删除，设置加载状态

        try {
            // 假设的 API 端点，请确保后端已实现
            const url = `${API_BASE}/api/scenariosinstances/switches/${switchName}`;
            const response = await fetch(url, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "未知错误" }));
                throw new Error(errorData.detail || errorData.message || `删除失败，状态码: ${response.status}`);
            }

            // 从前端状态中移除，实现界面实时更新
            setSwitches((prevSwitches) => prevSwitches.filter(s => s.id !== switchId));

        } catch (err: any) {
            alert(`删除失败: ${err.message}`);
        } finally {
            setDeletingId(null); // 结束删除，重置加载状态
        }
    };
    // [MODIFICATION END]
    
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
        // [MODIFICATION START] 更新“操作”列以显示加载状态
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
                                <div>
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
        // [MODIFICATION END]
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
                    columns={columns}
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
