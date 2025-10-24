// NodeTeamAssignmentDialog.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    CircularProgress, Alert, Table, TableBody, TableCell, TableHead,
    TableRow, MenuItem, Select, Typography, Box
} from '@mui/material';
import { customFetch } from '@/utils/fetch';

// 定义数据类型
interface Node {
    id: string; // 容器ID或虚拟机ID
    name: string;
    type: 'container' | 'vm';
    team_id: number | null; // 使用 number 因为 c_teams.c_id 是 int
}

interface Team {
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
    const [teams, setTeams] = useState<Team[]>([]);
    const [assignments, setAssignments] = useState<Record<string, number | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const API_BASE_URL = '/back/api';

    // 获取节点和队伍列表的函数
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // 并行获取节点列表和所有队伍列表
            const [nodesRes, teamsRes] = await Promise.all([
                customFetch(`${API_BASE_URL}/scenariosinstances/${instanceId}/nodes`),
                customFetch(`${API_BASE_URL}/ad/team?all=true`) // 假设有这样一个API获取所有队伍
            ]);

            if (!nodesRes.ok || !teamsRes.ok) {
                throw new Error('获取基础数据失败');
            }

            const nodesData = await nodesRes.json();
            const teamsData = await teamsRes.json();

            setNodes(nodesData.data || []);
            setTeams(teamsData.data || []);

            // 初始化 assignments 状态
            const initialAssignments: Record<string, number | null> = {};
            (nodesData.data || []).forEach((node: Node) => {
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
            const [type, id] = key.split('-');
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

            onClose(); // 成功后关闭弹窗
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>为演练 "{drillName}" 分配节点队伍</DialogTitle>
            <DialogContent dividers>
                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>节点名称</TableCell>
                                <TableCell>节点类型</TableCell>
                                <TableCell>所属队伍</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {nodes.map(node => {
                                const nodeKey = `${node.type}-${node.id}`;
                                return (
                                    <TableRow key={nodeKey}>
                                        <TableCell>{node.name}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {node.type === 'container' ? '容器' : '虚拟机'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={assignments[nodeKey] ?? 'none'}
                                                onChange={(e) => handleAssignmentChange(nodeKey, e.target.value)}
                                                size="small"
                                                fullWidth
                                            >
                                                <MenuItem value="none"><em>不分配</em></MenuItem>
                                                {teams.map(team => (
                                                    <MenuItem key={team.c_id} value={team.c_id}>{team.c_name}</MenuItem>
                                                ))}
                                            </Select>
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