import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Typography,
    Box,
    CircularProgress,
    Alert,
    IconButton,
    Pagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Tooltip,
} from '@mui/material';
import {
    Close as CloseIcon,
    History as HistoryIcon,
    CheckCircle as SuccessIcon,
    Cancel as ErrorIcon,
} from '@mui/icons-material';
import { apiClientWithToken } from '@/utils/axios';

interface FlagSubmission {
    c_submission_id: string;
    c_username: string;
    c_submitted_at: string;
    c_is_correct: boolean;
    c_attempt_count: number;
    c_points_earned: number;
    instance_id: string;
    instance_name?: string;
    instance_type: 'docker' | 'vm';
}

interface FlagHistoryModalProps {
    open: boolean;
    onClose: () => void;
    sceneInstanceId: string;
    title?: string;
}

const FlagHistoryModal: React.FC<FlagHistoryModalProps> = ({
    open,
    onClose,
    sceneInstanceId,
    title = 'Flag 提交历史'
}) => {
    const [submissions, setSubmissions] = useState<FlagSubmission[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
    const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (open && sceneInstanceId) {
            fetchSubmissions();
            
            // 如果启用自动刷新，设置轮询
            if (isAutoRefreshEnabled) {
                intervalRef.current = setInterval(() => {
                    fetchSubmissions();
                }, 10000); // 10秒轮询一次
            }
        }
        
        // 清理函数
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [open, sceneInstanceId, filter, isAutoRefreshEnabled]);

    const fetchSubmissions = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await apiClientWithToken.post('/back/api/flag/submission-history', {
                scope: 'all', // 显示所有用户的提交
                target_scope: 'all_targets_in_scene', // 当前场景下的所有靶机
                c_scene_instances_id: sceneInstanceId
            });

            if (response.data.code === 200) {
                setSubmissions(response.data.data || []);
            } else {
                setError(response.data.message || 'Failed to load submissions');
            }
        } catch (err: any) {
            console.error('Failed to fetch flag submissions:', err);
            setError(err.message || 'Failed to load submissions');
        } finally {
            setLoading(false);
        }
    };

    const filteredSubmissions = submissions.filter(submission => {
        if (filter === 'correct') return submission.c_is_correct;
        if (filter === 'incorrect') return !submission.c_is_correct;
        return true;
    });

    const paginatedSubmissions = filteredSubmissions.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage
    );

    const handlePageChange = (_event: React.ChangeEvent<unknown>, newPage: number) => {
        setPage(newPage);
    };

    const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);

    const getStatusChip = (isCorrect: boolean) => (
        <Chip
            size="small"
            icon={isCorrect ? <SuccessIcon /> : <ErrorIcon />}
            label={isCorrect ? '正确' : '错误'}
            color={isCorrect ? 'success' : 'error'}
            variant="outlined"
        />
    );

    const getInstanceTypeText = (type: 'docker' | 'vm') => {
        return type === 'docker' ? 'Docker容器' : '虚拟机';
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { minHeight: '60vh' }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                pb: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryIcon color="primary" />
                    <Typography variant="h6">{title}</Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent>
                <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>筛选结果</InputLabel>
                            <Select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                label="筛选结果"
                            >
                                <MenuItem value="all">全部</MenuItem>
                                <MenuItem value="correct">正确</MenuItem>
                                <MenuItem value="incorrect">错误</MenuItem>
                            </Select>
                        </FormControl>
                        
                        <Typography variant="body2" color="text.secondary">
                            共 {filteredSubmissions.length} 条记录
                        </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="开启后每10秒自动更新数据">
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={isAutoRefreshEnabled}
                                        onChange={(e) => setIsAutoRefreshEnabled(e.target.checked)}
                                        size="small"
                                    />
                                }
                                label="自动刷新"
                            />
                        </Tooltip>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => fetchSubmissions()}
                            disabled={loading}
                        >
                            手动刷新
                        </Button>
                    </Box>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>加载历史记录...</Typography>
                    </Box>
                ) : error ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                ) : filteredSubmissions.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                            暂无Flag提交记录
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>用户名</TableCell>
                                        <TableCell>靶机类型</TableCell>
                                        <TableCell>靶机名称</TableCell>
                                        <TableCell>提交结果</TableCell>
                                        <TableCell>获得分数</TableCell>
                                        <TableCell>尝试次数</TableCell>
                                        <TableCell>提交时间</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedSubmissions.map((submission) => (
                                        <TableRow key={submission.c_submission_id}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="medium">
                                                    {submission.c_username}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={getInstanceTypeText(submission.instance_type)}
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2" 
                                                    fontWeight="medium"
                                                >
                                                    {submission.instance_name || 'Unknown Instance'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusChip(submission.c_is_correct)}
                                            </TableCell>
                                            <TableCell>
                                                <Typography 
                                                    variant="body2"
                                                    color={submission.c_points_earned > 0 ? 'success.main' : 'text.secondary'}
                                                    fontWeight={submission.c_points_earned > 0 ? 'medium' : 'normal'}
                                                >
                                                    {submission.c_points_earned > 0 ? `+${submission.c_points_earned}` : '0'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{submission.c_attempt_count}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {new Date(submission.c_submitted_at).toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {totalPages > 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                <Pagination 
                                    count={totalPages}
                                    page={page}
                                    onChange={handlePageChange}
                                    color="primary"
                                />
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>
            
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={onClose} variant="outlined">
                    关闭
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default FlagHistoryModal;
