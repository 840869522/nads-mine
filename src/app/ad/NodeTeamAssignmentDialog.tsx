"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    CircularProgress, Alert, Table, TableBody, TableCell, TableHead,
    TableRow, MenuItem, Select, Typography, Box, Paper, Chip
} from '@mui/material';
import { customFetch } from '@/utils/fetch';

// --- 类型定义 ---

interface Member {
    c_username: string;
    c_name: string | null;
    is_banned?: boolean;
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

interface Referee {
    c_user_id?: string; // 标记为可选，因为有时候数据里可能没这个字段
    c_level: string;
    user?: { c_username: string; c_name?: string; };
}

interface NodeTeamAssignmentDialogProps {
    open: boolean;
    onClose: () => void;
    instanceId: string;
    drillName: string;
    referees: Referee[];
}

const NodeTeamAssignmentDialog: React.FC<NodeTeamAssignmentDialogProps> = ({
                                                                               open,
                                                                               onClose,
                                                                               instanceId,
                                                                               drillName,
                                                                               referees
                                                                           }) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [allTeams, setAllTeams] = useState<TeamWithMembers[]>([]);
    const [availableTeams, setAvailableTeams] = useState<TeamWithMembers[]>([]);
    const [assignments, setAssignments] = useState<Record<string, number | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_BASE_URL = '/back/api';

    // 调试日志
    useEffect(() => {
        if (open) {
            console.log("【调试】接收到的裁判列表:", referees);
        }
    }, [open, referees]);

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
            setAllTeams(data.all_teams || []);
            setAvailableTeams(data.current_teams || []);

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

    const handleAssignmentChange = (nodeKey: string, newTeamId: string | number) => {
        const teamId = newTeamId === 'none' ? null : Number(newTeamId);
        setAssignments(prev => ({ ...prev, [nodeKey]: teamId }));
        if (error) setError(null);
    };

    const getTeamMembers = (teamId: number): string[] => {
        const team = allTeams.find(t => t.c_id === teamId);
        return team?.users?.map(u => u.c_username) || [];
    };

    const getAssignedUsernamesExcludingNode = (currentNodeKey: string) => {
        const assignedUsernames = new Set<string>();
        Object.entries(assignments).forEach(([key, teamId]) => {
            if (key !== currentNodeKey && teamId !== null) {
                const members = getTeamMembers(Number(teamId));
                members.forEach(m => assignedUsernames.add(m));
            }
        });
        return assignedUsernames;
    };

    const isSameUser = (u1: string | undefined, u2: string | undefined) => {
        if (!u1 || !u2) return false;
        return String(u1).trim().toLowerCase() === String(u2).trim().toLowerCase();
    };

    // ★★★ 核心修复：获取裁判ID的辅助函数 ★★★
    // 优先取 c_user_id，如果没有，去 user 对象里取 c_username
    const getRefereeId = (r: Referee) => {
        return r.c_user_id || r.user?.c_username || "";
    };

    const checkConflictsBeforeSubmit = (selectedTeamIds: number[]) => {
        // 1. 队伍重复
        const uniqueTeams = new Set(selectedTeamIds);
        if (uniqueTeams.size !== selectedTeamIds.length) return "存在多个节点分配给了同一个队伍。";

        // 2. 成员冲突
        const memberMap: Record<string, number> = {};
        for (const tid of selectedTeamIds) {
            const members = getTeamMembers(tid);
            for (const uid of members) {
                memberMap[uid] = (memberMap[uid] || 0) + 1;
                if (memberMap[uid] > 1) return `用户 ${uid} 同时存在于多个选定队伍中。`;
            }
        }

        // 3. 裁判冲突 (已修复取值逻辑)
        for (const tid of selectedTeamIds) {
            const members = getTeamMembers(tid);
            for (const uid of members) {
                const isReferee = referees.some(r => isSameUser(getRefereeId(r), uid));
                if (isReferee) return `用户 ${uid} 既是裁判又是参赛选手。`;
            }
        }

        return null;
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        const selectedTeamIds = Object.values(assignments)
            .filter(id => id !== null)
            .map(id => Number(id));

        const conflictError = checkConflictsBeforeSubmit(selectedTeamIds);
        if (conflictError) {
            setError(`无法保存：${conflictError}`);
            setIsSubmitting(false);
            return;
        }

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
                    <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>
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
                                const currentTeamData = assignedTeamId ? allTeams.find(t => t.c_id === assignedTeamId) : null;
                                const forbiddenMembers = getAssignedUsernamesExcludingNode(nodeKey);

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
                                                {allTeams.map(team => {
                                                    // 1. 队伍互斥
                                                    const isAssignedToOther = Object.entries(assignments).some(([k, tid]) => {
                                                        return k !== nodeKey && tid === team.c_id;
                                                    });

                                                    // 2. 裁判互斥 (已修复取值逻辑)
                                                    const teamUsers = team.users || [];
                                                    const hasReferee = teamUsers.some(u =>
                                                        referees.some(r => isSameUser(getRefereeId(r), u.c_username))
                                                    );

                                                    // 3. 成员互斥
                                                    const hasMemberConflict = teamUsers.some(u =>
                                                        forbiddenMembers.has(u.c_username)
                                                    );

                                                    const isDisabled = isAssignedToOther || hasReferee || hasMemberConflict;

                                                    let reason = "";
                                                    if (isAssignedToOther) reason = "(已分配给其他节点)";
                                                    else if (hasReferee) reason = "(包含裁判)";
                                                    else if (hasMemberConflict) reason = "(成员与其他队伍冲突)";

                                                    return (
                                                        <MenuItem
                                                            key={team.c_id}
                                                            value={team.c_id}
                                                            disabled={isDisabled}
                                                            style={isDisabled ? { opacity: 0.6 } : {}}
                                                        >
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                                <span>{team.c_name}</span>
                                                                {isDisabled && (
                                                                    <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                                                                        {reason}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </MenuItem>
                                                    );
                                                })}
                                            </Select>

                                            {currentTeamData && currentTeamData.users && currentTeamData.users.length > 0 && (
                                                <Box mt={2} pl={1}>
                                                    <Typography variant="subtitle2" gutterBottom>队伍成员:</Typography>
                                                    {currentTeamData.users.map(user => {
                                                        // 使用 getRefereeId 修复比对
                                                        const isReferee = referees.some(r => isSameUser(getRefereeId(r), user.c_username));
                                                        return (
                                                            <Paper
                                                                key={user.c_username}
                                                                variant="outlined"
                                                                sx={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    p: 1,
                                                                    mb: 1,
                                                                    bgcolor: isReferee ? '#fff0f0' : 'inherit',
                                                                    borderColor: isReferee ? 'error.main' : 'inherit'
                                                                }}
                                                            >
                                                                <Typography variant="body2" color={isReferee ? 'error' : 'textPrimary'}>
                                                                    {user.c_name ? `${user.c_name} (${user.c_username})` : user.c_username}
                                                                    {isReferee && <strong> (裁判)</strong>}
                                                                </Typography>
                                                                <Chip
                                                                    label={user.is_banned ? '已禁赛' : '正常'}
                                                                    color={user.is_banned ? 'error' : 'success'}
                                                                    size="small"
                                                                />
                                                            </Paper>
                                                        )
                                                    })}
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