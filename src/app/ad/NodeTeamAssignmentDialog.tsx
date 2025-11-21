"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    CircularProgress, Alert, Table, TableBody, TableCell, TableHead,
    TableRow, MenuItem, Select, Typography, Box, Paper, Chip
} from '@mui/material';
import { customFetch } from '@/utils/fetch';

// 类型定义
interface Member {
    c_username: string;
    c_name: string | null;
    is_banned: boolean;
}

interface TeamWithMembers {
    c_id: number;
    c_name: string;
    users: Member[];
}

interface Node {
    id: string;
    name: string;
    type: 'container' | 'vm';
    team_id: number | null;
    team: TeamWithMembers | null;
}

// 基础队伍类型，用于下拉菜单
interface BasicTeam {
    c_id: number;
    c_name: string;
}

interface NodeTeamAssignmentDialogProps {
    open: boolean;
    onClose: () => void;
    instanceId: string;
    drillName: string;
}

const NodeTeamAssignmentDialog: React.FC<NodeTeamAssignmentDialogProps> = ({
                                                                               open,
                                                                               onClose,
                                                                               instanceId,
                                                                               drillName
                                                                           }) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [allTeams, setAllTeams] = useState<BasicTeam[]>([]);
    const [availableTeams, setAvailableTeams] = useState<TeamWithMembers[]>([]);
    const [assignments, setAssignments] = useState<Record<string, number | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_BASE_URL = '/back/api';

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await customFetch(`${API_BASE_URL}/scenariosinstances/${instanceId}/nodes`);
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || '获取数据失败');
            }

            const apiData = await response.json();
            const data = apiData.data;

            setNodes(data.nodes || []);
            setAllTeams(data.all_teams || []); // 使用 all_teams 填充下拉菜单的数据源
            setAvailableTeams(data.current_teams || []); // 使用 current_teams 填充成员信息的数据源

            const initialAssignments: Record<string, number | null> = {};
            (data.nodes || []).forEach((node: Node) => {
                initialAssignments[`${node.type}-${node.id}`] = node.team_id;
            });
            setAssignments(initialAssignments);

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, [instanceId]);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open, fetchData]);

    // 处理下拉菜单变更
    const handleAssignmentChange = (nodeKey: string, newTeamId: string | number) => {
        const teamId = newTeamId === 'none' ? null : Number(newTeamId);
        setAssignments(prev => ({ ...prev, [nodeKey]: teamId }));
    };

    // 提交变更
    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        const payload = Object.entries(assignments).map(([key, team_id]) => {
            const [type, ...idParts] = key.split('-');
            const id = idParts.join('-');
            return { type, id, team_id };
        });
        try {
            const response = await customFetch(`${API_BASE_URL}/scenariosinstances/${instanceId}/node-assignments`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments: payload })
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || '更新失败');
            }
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>管理演练 "{drillName}" 节点与成员</DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                ) : error ? (
                    <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>节点信息</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>所属队伍与成员列表</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {nodes.map(node => {
                                const nodeKey = `${node.type}-${node.id}`;
                                const assignedTeamId = assignments[nodeKey];
                                // 成员列表数据源
                                const currentTeamData = assignedTeamId ? availableTeams.find(t => t.c_id === assignedTeamId) : null;

                                return (
                                    <TableRow key={nodeKey}>
                                        <TableCell sx={{ verticalAlign: 'top', width: '35%' }}>
                                            <Typography fontWeight="bold">{node.name}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {node.type === 'container' ? '容器' : '虚拟机'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ verticalAlign: 'top', width: '65%' }}>
                                            <Select
                                                value={assignedTeamId ?? 'none'}
                                                onChange={(e) => handleAssignmentChange(nodeKey, e.target.value)}
                                                size="small"
                                                fullWidth
                                            >
                                                <MenuItem value="none"><em>不分配</em></MenuItem>
                                                {allTeams.map(team => (
                                                    <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>
                                                ))}
                                            </Select>

                                            {/* 成员列表显示逻辑 */}
                                            {currentTeamData && currentTeamData.users && currentTeamData.users.length > 0 && (
                                                <Box mt={2} pl={1}>
                                                    <Typography variant="subtitle2" gutterBottom>队伍成员:</Typography>
                                                    {currentTeamData.users.map(user => (
                                                        <Paper key={user.c_username} variant="outlined" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, mb: 1 }}>
                                                            <Typography variant="body2">
                                                                {user.c_name ? `${user.c_name} (${user.c_username})` : user.c_username}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                {/* 仅展示状态 Chip，移除操作按钮 */}
                                                                <Chip
                                                                    label={user.is_banned ? '已禁赛' : '正常'}
                                                                    color={user.is_banned ? 'error' : 'success'}
                                                                    size="small"
                                                                />
                                                            </Box>
                                                        </Paper>
                                                    ))}
                                                </Box>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSubmitting}>取消</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting || isLoading}>
                    {isSubmitting ? <CircularProgress size={24} /> : '保存更改'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NodeTeamAssignmentDialog;