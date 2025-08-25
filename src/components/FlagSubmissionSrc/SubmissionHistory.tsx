import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Alert,
    CircularProgress,
    ButtonGroup,
    Button,
} from '@mui/material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext'; // 假设你有一个AuthContext来获取JWT token  src/contexts/AuthContext.tsx

interface SubmissionHistoryProps {
    instanceId: string;
    sceneInstanceId: string;
    instanceType: 'docker' | 'vm';
}

interface SubmissionRecord {
    c_username: string;
    c_submitted_at: string;
    c_is_correct: boolean;
    c_attempt_count: number;
    c_points_earned: number;
}

const SubmissionHistory: React.FC<SubmissionHistoryProps> = ({ instanceId, sceneInstanceId }) => {
    const [history, setHistory] = useState<SubmissionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [scope, setScope] = useState<'mine' | 'all'>('all');
    const [targetScope, setTargetScope] = useState<'this_target' | 'all_targets_in_scene'>('this_target');
    const { token } = useAuth(); // 从你的认证上下文中获取token

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            setError('');
            try {
                const params = {
                    scope,
                    target_scope: targetScope,
                    c_scene_instances_id: sceneInstanceId,
                    instance_id: instanceId,
                };
                const response = await axios.get('/api/submission-history', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    params,
                });

                if (response.data.code === 200) {
                    setHistory(response.data.data);
                } else {
                    setError(response.data.message || '获取历史记录失败');
                }
            } catch (e) {
                setError('获取历史记录失败，请稍后重试。');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [scope, targetScope, instanceId, sceneInstanceId, token]);

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
                提交历史记录
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <ButtonGroup variant="outlined" aria-label="scope button group">
                    <Button onClick={() => setScope('mine')} color={scope === 'mine' ? 'primary' : 'inherit'}>
                        我的提交
                    </Button>
                    <Button onClick={() => setScope('all')} color={scope === 'all' ? 'primary' : 'inherit'}>
                        全部提交
                    </Button>
                </ButtonGroup>
                <ButtonGroup variant="outlined" aria-label="target scope button group">
                    <Button onClick={() => setTargetScope('this_target')} color={targetScope === 'this_target' ? 'primary' : 'inherit'}>
                        此靶机
                    </Button>
                    <Button onClick={() => setTargetScope('all_targets_in_scene')} color={targetScope === 'all_targets_in_scene' ? 'primary' : 'inherit'}>
                        此场景所有靶机
                    </Button>
                </ButtonGroup>
            </Box>
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>用户名</TableCell>
                                <TableCell>提交时间</TableCell>
                                <TableCell>是否正确</TableCell>
                                <TableCell>尝试次数</TableCell>
                                <TableCell>得分</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {history.map((record, index) => (
                                <TableRow key={index}>
                                    <TableCell>{record.c_username}</TableCell>
                                    <TableCell>{new Date(record.c_submitted_at).toLocaleString()}</TableCell>
                                    <TableCell>{record.c_is_correct ? '是' : '否'}</TableCell>
                                    <TableCell>{record.c_attempt_count}</TableCell>
                                    <TableCell>{record.c_points_earned}</TableCell>
                                </TableRow>
                            ))}
                            {history.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center">
                                        暂无历史记录
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default SubmissionHistory;