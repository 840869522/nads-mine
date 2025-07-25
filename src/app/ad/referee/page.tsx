"use client";

import React, { useState, useEffect } from 'react';

// (MUI 组件导入，只保留展示所需的)
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

// === 类型定义 (与后端全局查询结果对齐) ===

// 关联的用户信息
interface User {
    c_username: string;
}

// 关联的演练信息
interface AdConfig {
    c_id: string;
    c_name: string; // 假设演练配置表有 c_name 字段
}

// 裁判总览列表中的条目结构
interface RefereeEntry {
    c_user_id: string;
    c_ad_config_id: string;
    c_level: string;
    c_create_at: string;
    // 关键：包含关联的用户和演练信息用于展示
    user: User;
    ad_config: AdConfig;
}

// 裁判总览页面组件
const RefereeOverviewPage: React.FC = () => {
    // === 状态管理 (简化版) ===
    const [refereeEntries, setRefereeEntries] = useState<RefereeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // === 副作用 (Side Effects) ===
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // API 请求一个全局的裁判列表
                const response = await fetch('/back/api/ad/referees/all');

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || '获取裁判总览列表失败');
                }
                const result = await response.json();
                setRefereeEntries(result.data ?? []);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // === 渲染逻辑 (Render Logic) ===
    return (
        <Box sx={{ p: 3, maxWidth: '1200px', margin: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" fontWeight="bold">
                    裁判总览
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    此处展示所有攻防演练中已指派的裁判信息。
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Paper sx={{ width: '100%', overflow: 'hidden' }} elevation={2}>
                <TableContainer>
                    <Table stickyHeader aria-label="referee overview table">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>用户名</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>裁判级别</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>所属演练</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>指派时间</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow>
                            ) : refereeEntries.length === 0 ? (
                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>当前没有任何裁判指派记录。</TableCell></TableRow>
                            ) : (
                                refereeEntries.map((entry, index) => (
                                    <TableRow hover key={`${entry.c_ad_config_id}-${entry.c_user_id}`}>
                                        <TableCell component="th" scope="row">
                                            {entry.user?.c_username || 'N/A'}
                                        </TableCell>
                                        <TableCell>{entry.c_level}</TableCell>
                                        <TableCell>{entry.ad_config?.c_name || entry.c_ad_config_id}</TableCell>
                                        <TableCell>{new Date(entry.c_create_at).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default RefereeOverviewPage;