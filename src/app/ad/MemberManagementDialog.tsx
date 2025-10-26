// 文件路径: app/ad/MemberManagementDialog.tsx

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    CircularProgress, Alert, Table, TableBody, TableCell, TableHead,
    TableRow, Chip, IconButton, Tooltip, Box, Typography,
    Accordion, AccordionSummary, AccordionDetails // ★ 修正拼写错误
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { customFetch } from "@/utils/fetch";

// 定义数据类型
interface Member {
    c_username: string;
    c_name: string | null;
    pivot: {
        is_banned: boolean;
    };
}

interface TeamWithMembers {
    c_id: number;
    c_name: string;
    users: Member[];
}

interface MemberManagementDialogProps {
    open: boolean;
    onClose: () => void;
    adConfigId: string;
    drillName: string;
}

const MemberManagementDialog: React.FC<MemberManagementDialogProps> = ({
                                                                           open,
                                                                           onClose,
                                                                           adConfigId,
                                                                           drillName
                                                                       }) => {
    const [teams, setTeams] = useState<TeamWithMembers[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const API_BASE_URL = '/back/api';

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await customFetch(`${API_BASE_URL}/ad-configs/${adConfigId}/teams-with-members`);
            if (!response.ok) {
                const result = await response.json().catch(() => ({ message: '获取成员列表失败' }));
                throw new Error(result.message);
            }
            const data = await response.json();
            setTeams(data.data || []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [adConfigId]);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open, fetchData]);

    const handleToggleBan = async (teamId: number, username: string) => {
        try {
            setError(null);
            const response = await customFetch(`${API_BASE_URL}/ad/team/${teamId}/users/${username}/toggle-ban`, {
                method: 'POST'
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({ message: '操作失败' }));
                throw new Error(result.message);
            }
            // 操作成功后，重新获取最新数据以刷新UI
            await fetchData();

        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>管理演练 "{drillName}" 成员</DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                ) : error ? (
                    <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
                ) : teams.length === 0 ? (
                    <Typography sx={{ p: 4, textAlign: 'center' }} color="text.secondary">
                        该演练没有关联任何队伍。
                    </Typography>
                ) : (
                    teams.map(team => (
                        <Accordion key={team.c_id} defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography fontWeight="bold">{team.c_name}</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>成员</TableCell>
                                            <TableCell align="center">状态</TableCell>
                                            <TableCell align="right">操作</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {team.users.map(user => (
                                            <TableRow hover key={user.c_username}>
                                                <TableCell>{user.c_name ? `${user.c_name} (${user.c_username})` : user.c_username}</TableCell>
                                                <TableCell align="center">
                                                    <Chip
                                                        label={user.pivot.is_banned ? '已禁赛' : '正常'}
                                                        color={user.pivot.is_banned ? 'error' : 'success'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title={user.pivot.is_banned ? '解除禁赛' : '标记作弊并禁赛'}>
                                                        <IconButton onClick={() => handleToggleBan(team.c_id, user.c_username)}>
                                                            {user.pivot.is_banned ? <CheckCircleOutlineIcon color="success" /> : <BlockIcon color="error" />}
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </AccordionDetails>
                        </Accordion>
                    ))
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default MemberManagementDialog;