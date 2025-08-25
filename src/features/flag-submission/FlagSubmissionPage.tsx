import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Backdrop,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    TableContainer,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Snackbar,
    Alert,
    AlertTitle,
    SelectChangeEvent
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'; // 成功图标
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; // 失败图标
import { apiClientWithToken } from '../../utils/axios.tsx'; // 从 src/features/flag-submission/ 向上两级到 src/axios.tsx
import { BACK_IP_PORT } from '@/constants.ts'; // 从 src/features/flag-submission/ 向上两级到 src/constants.ts
import dayjs from 'dayjs';
import {toast} from "react-toastify"; // 导入 dayjs 用于时间格式化

// --- 类型定义 (这里为了简洁直接包含，实际项目中可以放到单独的 types.ts 文件) ---
interface GlobalResponse<T> {
    code: number;
    message: string;
    data: T;
}

interface SceneInstance {
    c_scene_instances_id: string;
}

interface ContainerTargetInstance {
    id: string;
    type: 'docker';
}

interface VmTargetInstance {
    id: number;
    type: 'vm';
}

type TargetInstance = ContainerTargetInstance | VmTargetInstance;

interface SubmitFlagResult {
    is_correct: boolean;
    points_earned: number;
    message: string;
}

interface SubmissionHistoryRecord {
    c_submission_id: string;
    c_username: string;
    scene_instance_id: string;
    instance_id: string; // 可能是 c_container_id 或 c_vm_id
    instance_type: 'docker' | 'vm';
    c_submitted_at: string; // 后端返回的时间字符串
    c_submitted_flag: string;
    c_is_correct: 0 | 1;
    c_attempt_count: number;
    c_points_earned: number;
}

interface PaginatedData<T> {
    data: T[];
    count?: number;
}
// --- 类型定义结束 ---

// Flag 值 UUID 正则表达式
// 例如：flag{8位-4位-4位-4位-12位}
//const FLAG_UUID_REGEX = /^flag\\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\}$/;
// 更正后的 Flag 值 UUID 正则表达式
const FLAG_UUID_REGEX = /^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/;
const FlagSubmissionPage: React.FC = () => {
    // --- 状态管理 ---
    const [scenarioInstances, setScenarioInstances] = useState<SceneInstance[]>([]);
    const [targetInstances, setTargetInstances] = useState<TargetInstance[]>([]);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
    const [selectedTargetId, setSelectedTargetId] = useState<string>('');
    const [selectedTargetType, setSelectedTargetType] = useState<'docker' | 'vm' | ''>('');
    const [flagInput, setFlagInput] = useState<string>('');
    const [flagInputError, setFlagInputError] = useState<boolean>(false); // Flag输入框错误状态

    const [isPageLoading, setIsPageLoading] = useState<boolean>(true); // 页面初始化加载
    const [isFormLoading, setIsFormLoading] = useState<boolean>(false); // Flag提交请求加载
    const [isTargetLoading, setIsTargetLoading] = useState<boolean>(false); // 靶机实例加载

    const [submissionHistory, setSubmissionHistory] = useState<SubmissionHistoryRecord[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false); // 提交历史数据加载
    const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

    // Snackbar 状态
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
    const [snackbarIcon, setSnackbarIcon] = useState<React.ReactNode>(null);

    // --- API 交互函数 ---

    // 获取场景实例列表
    const getSceneInstances = useCallback(async () => {
        try {
            setIsPageLoading(true); // 初始加载时显示全局加载
            const response = await apiClientWithToken.get<GlobalResponse<PaginatedData<SceneInstance>>>(`${BACK_IP_PORT}/api/flag/scene-instances`);
            if (response.data.code === 200 && response.data.data) {
                console.log(response.data.data);
                setScenarioInstances(response.data.data);
            } else {
                console.error('Failed to fetch scene instances:', response.data.message);
                // 可以根据需要在此处显示 toast 错误
            }
        } catch (error) {
            console.error('Error fetching scene instances:', error);
            // axios 拦截器已处理常见错误，这里可用于更具体的捕获
        } finally {
            setIsPageLoading(false); // 无论成功失败，都停止全局加载
        }
    }, []);

    // 获取靶机实例列表
    const getTargetInstances = useCallback(async (sceneId: string) => {
        if (!sceneId) {
            setTargetInstances([]);
            setSelectedTargetId('');
            setSelectedTargetType('');
            return;
        }
        setIsTargetLoading(true); // 靶机加载时显示局部加载
        try {
            const response = await apiClientWithToken.get(`${BACK_IP_PORT}/api/flag/target-instances?scene_id=${sceneId}`);
            if (response.data.code === 200 && response.data.data) {
                setTargetInstances(response.data.data);
            } else {
                console.error('Failed to fetch target instances:', response.data.message);
                setTargetInstances([]);
                // 可以根据需要在此处显示 toast 错误
            }
        } catch (error) {
            console.error('Error fetching target instances:', error);
            setTargetInstances([]);
        } finally {
            setIsTargetLoading(false); // 停止局部加载
        }
    }, []);
    const getSubmissionHistory = useCallback(async () => {
        setIsHistoryLoading(true);
        try {
            // 根据后端API期望的参数构建请求URL
            const params = new URLSearchParams({
                scope: 'mine', // 默认只获取当前用户的提交记录
                target_scope: 'all_targets_in_all_scenes' // 获取所有靶机的记录
            });
            
            const response = await apiClientWithToken.get<GlobalResponse<SubmissionHistoryRecord[]>>(
                `${BACK_IP_PORT}/api/flag/submission-history?${params.toString()}`
            );
            
            if (response.data.code === 200 && response.data.data) {
                setSubmissionHistory(response.data.data);
            } else {
                console.error('Failed to fetch submission history:', response.data.message);
                setSubmissionHistory([]);
            }
        } catch (error) {
            console.error('Error fetching submission history:', error);
            setSubmissionHistory([]);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);
    // 提交 Flag
    const handleSubmitFlag = useCallback(async () => {
        // 前端验证
        if (!selectedScenarioId || !selectedTargetId || !selectedTargetType || !flagInput.trim()) {
            toast.error("请填写所有必填项！"); //
            return;
        }
        // Flag UUID 格式校验
        if (!FLAG_UUID_REGEX.test(flagInput.trim())) { //
            setFlagInputError(true);
            toast.error("Flag格式不正确，应为 flag{UUID} 格式。");
            return;
        } else {
            setFlagInputError(false);
        }


        setIsFormLoading(true); // 提交时禁用按钮并显示加载
        try {
            const requestBody = {
                c_scene_instances_id: selectedScenarioId,
                instance_id: selectedTargetId,
                instance_type: selectedTargetType,
                flag: flagInput.trim(),
            };
            const response = await apiClientWithToken.post<GlobalResponse<SubmitFlagResult>>(`${BACK_IP_PORT}/api/flag/submit-flag`, requestBody);

            if (response.data.code === 200) {
                // 根据Flag是否正确来设置不同的显示样式
                if (response.data.data?.is_correct) {
                    setSnackbarSeverity('success');
                    setSnackbarIcon(<CheckCircleOutlineIcon fontSize="inherit" />);
                    setFlagInput(''); // 只有正确时才清空输入框
                } else {
                    setSnackbarSeverity('error');
                    setSnackbarIcon(<ErrorOutlineIcon fontSize="inherit" />);
                }
                setSnackbarMessage(response.data.message || (
                    response.data.data?.is_correct ? "恭喜你，Flag提交成功！" : "Flag不正确，请继续尝试。"
                ));
                setSnackbarOpen(true);
                getSubmissionHistory(); // 无论正确与否都刷新历史记录
            } else {
                // 请求失败
                setSnackbarSeverity('error');
                setSnackbarMessage(response.data.message || "Flag提交失败，请再检查一下哦。");
                setSnackbarIcon(<ErrorOutlineIcon fontSize="inherit" />);
                setSnackbarOpen(true);
            }
        } catch (error: any) {
            console.error('Error submitting flag:', error);
            // axios 拦截器会处理 420/405 等全局错误，这里捕获的是其他网络错误或未被拦截器处理的业务错误
            if (error.response && error.response.data && error.response.data.message) {
                setSnackbarMessage(error.response.data.message);
            } else {
                setSnackbarMessage("Flag提交失败，请稍后再试。");
            }
            setSnackbarSeverity('error');
            setSnackbarIcon(<ErrorOutlineIcon fontSize="inherit" />);
            setSnackbarOpen(true);
        } finally {
            setIsFormLoading(false); // 停止加载
        }
    }, [selectedScenarioId, selectedTargetId, selectedTargetType, flagInput, getSubmissionHistory]);

    // --- 生命周期与数据获取 ---
    useEffect(() => {
        // 组件首次挂载时，获取所有场景实例
        getSceneInstances();
        // 启动轮询定时器
        const interval = setInterval(() => {
            getSubmissionHistory();
        }, 5000); // 每 5 秒刷新一次历史记录
        setPollingIntervalId(interval);

        // 清理函数：组件卸载时清除定时器
        return () => {
            if (pollingIntervalId) {
                clearInterval(pollingIntervalId);
            }
        };
    }, [getSceneInstances, getSubmissionHistory]); // 依赖项确保回调函数稳定

    useEffect(() => {
        // 监听 selectedScenarioId 的变化，获取靶机实例
        if (selectedScenarioId) {
            getTargetInstances(selectedScenarioId);
        } else {
            setTargetInstances([]);
            setSelectedTargetId('');
            setSelectedTargetType('');
        }
    }, [selectedScenarioId, getTargetInstances]);

    // --- 事件处理 ---
    const handleScenarioChange = (event: SelectChangeEvent<string>) => {
        setSelectedScenarioId(event.target.value);
        setSelectedTargetId(''); // 重置靶机实例选择
        setSelectedTargetType(''); // 重置靶机类型
    };

    const handleTargetChange = (event: SelectChangeEvent<string>) => {
        const selectedId = event.target.value;



        const target = targetInstances.find(inst => inst.id === selectedId);
        if (target) {
            setSelectedTargetId(selectedId);
            setSelectedTargetType(target.type);
        }
    };

    const handleFlagInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFlagInput(event.target.value);
        if (flagInputError && FLAG_UUID_REGEX.test(event.target.value.trim())) {
            setFlagInputError(false); // 用户开始输入后如果符合格式，清除错误状态
        }
    };

    const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }
        setSnackbarOpen(false);
    };

    // --- 渲染 ---
    return (
        <Box sx={{ p: 3 }}>
            {/* 全局加载指示器 */}
            <Backdrop open={isPageLoading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <CircularProgress color="inherit" size={60} />
            </Backdrop>

            <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
                Flag提交中心
            </Typography>

            {/* Flag提交表单 */}
            <Box component={Paper} elevation={3} sx={{ p: 4, mb: 4, borderRadius: 2 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                    提交Flag
                </Typography>
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel id="scenario-select-label">选择您要提交的场景实例</InputLabel>
                    <Select
                        labelId="scenario-select-label"
                        id="scenario-select"
                        value={selectedScenarioId}
                        label="选择您要提交的场景实例"
                        onChange={handleScenarioChange}
                        disabled={isFormLoading || scenarioInstances.length === 0}
                    >
                        {scenarioInstances.length === 0 ? (
                            <MenuItem value="no_data_scene" disabled>
                                暂无可用场景
                            </MenuItem>
                        ) : (
                            scenarioInstances.map((instance) => (
                                <MenuItem key={instance.c_scene_instances_id} value={instance.c_scene_instances_id}>
                                    {instance.c_scene_instances_id}
                                </MenuItem>
                            ))
                        )}
                    </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel id="target-select-label">选择您要提交的靶机实例</InputLabel>
                    <Select
                        labelId="target-select-label"
                        id="target-select"
                        value={selectedTargetId}
                        label="选择您要提交的靶机实例"
                        onChange={handleTargetChange}
                        disabled={isFormLoading || !selectedScenarioId || isTargetLoading}
                        endAdornment={isTargetLoading ? <CircularProgress size={20} sx={{ mr: 2 }} /> : null} // 靶机加载Spinner
                    >
                        {targetInstances.length === 0 ?(
                            <MenuItem value="no_data_target" disabled>
                                {isTargetLoading ? '加载中...' : '当前场景无靶机'}
                            </MenuItem>
                        ) : (
                            targetInstances.map((instance) => (
                                <MenuItem
                                    key={instance.id}
                                    value={instance.id}
                                >
                                    {instance.id}
                                </MenuItem>
                            ))
                        )}
                    </Select>
                </FormControl>

                <TextField
                    fullWidth
                    label="请输入您的Flag值"
                    variant="outlined"
                    value={flagInput}
                    onChange={handleFlagInputChange}
                    disabled={isFormLoading}
                    error={flagInputError}
                    helperText={flagInputError ? "Flag格式不正确，应为 flag{UUID} 格式。" : ""}
                    sx={{ mb: 3 }}
                />

                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmitFlag}
                    disabled={isFormLoading || !selectedTargetId || !flagInput.trim() || flagInputError}
                    sx={{ height: 56 }}
                >
                    {isFormLoading ? <CircularProgress size={24} color="inherit" /> : '提交'}
                </Button>
            </Box>

            {/* 提交历史表格 */}
            <Box component={Paper} elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                    Flag 提交历史
                </Typography>
                {isHistoryLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                        <CircularProgress />
                    </Box>
                ) : submissionHistory.length === 0 ? (
                    <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 5 }}>
                        暂无数据
                    </Typography>
                ) : (
                    <TableContainer sx={{ maxHeight: 500, overflowX: 'auto' }}> {/* 表格横向滚动 */}
                        <Table stickyHeader aria-label="submission history table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>时间</TableCell>
                                    <TableCell>用户</TableCell>
                                    <TableCell>场景实例ID / 靶机实例ID</TableCell>
                                    <TableCell>Flag值</TableCell>
                                    <TableCell>校验结果</TableCell>
                                    <TableCell>得分</TableCell>
                                    <TableCell>尝试次数</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {submissionHistory.map((record) => (
                                    <TableRow key={record.c_submission_id}>
                                        <TableCell>{dayjs(record.c_submitted_at).format('YYYY-MM-DD HH:mm:ss')}</TableCell>
                                        <TableCell>{record.c_username}</TableCell>
                                        <TableCell>
                                            场景实例ID：{record.scene_instance_id} / 靶机实例ID：{record.instance_id}
                                        </TableCell>
                                        <TableCell sx={{ wordBreak: 'break-all' }}>{record.c_submitted_flag}</TableCell>
                                        <TableCell>
                                            <Typography color={record.c_is_correct === 1 ? 'success.main' : 'error.main'}>
                                                {record.c_is_correct === 1 ? '正确' : '错误'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{record.c_points_earned}</TableCell>
                                        <TableCell>{record.c_attempt_count}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Snackbar 提示 */}
            <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
                <Alert
                    onClose={handleSnackbarClose}
                    severity={snackbarSeverity}
                    sx={{ width: '100%' }}
                    icon={snackbarIcon} // 显示图标
                >
                    <AlertTitle>{snackbarSeverity === 'success' ? '成功' : '失败'}</AlertTitle>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default FlagSubmissionPage;