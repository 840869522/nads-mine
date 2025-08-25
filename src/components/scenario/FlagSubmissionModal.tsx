import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Box,
    Typography,
    IconButton
} from '@mui/material';
import { 
    Close as CloseIcon,
    Flag as FlagIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon
} from '@mui/icons-material';
import { apiClientWithToken } from '@/utils/axios';
import { BACK_IP_PORT } from '@/constants';

interface FlagSubmissionModalProps {
    open: boolean;
    onClose: () => void;
    instanceId: string;
    instanceType: 'docker' | 'vm';
    sceneInstanceId: string;
    instanceName?: string;
}

// Flag格式验证正则表达式
const FLAG_UUID_REGEX = /^flag\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}$/;

const FlagSubmissionModal: React.FC<FlagSubmissionModalProps> = ({
    open,
    onClose,
    instanceId,
    instanceType,
    sceneInstanceId,
    instanceName
}) => {
    const [flag, setFlag] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [flagError, setFlagError] = useState(false);

    // 重置状态
    const resetState = () => {
        setFlag('');
        setMessage('');
        setIsSuccess(false);
        setFlagError(false);
        setIsSubmitting(false);
    };

    // 处理模态框关闭
    const handleClose = () => {
        resetState();
        onClose();
    };

    // 验证Flag格式
    const validateFlag = (flagValue: string): boolean => {
        return FLAG_UUID_REGEX.test(flagValue.trim());
    };

    // 处理Flag输入变化
    const handleFlagChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setFlag(value);
        
        // 如果之前有错误且现在格式正确，清除错误状态
        if (flagError && validateFlag(value)) {
            setFlagError(false);
        }
    };

    // 提交Flag
    const handleSubmit = async () => {
        const trimmedFlag = flag.trim();
        
        // 前端验证
        if (!trimmedFlag) {
            setMessage('请输入Flag值');
            setIsSuccess(false);
            return;
        }

        if (!validateFlag(trimmedFlag)) {
            setFlagError(true);
            setMessage('Flag格式不正确，应为 flag{UUID} 格式');
            setIsSuccess(false);
            return;
        }

        setIsSubmitting(true);
        setMessage('');
        setFlagError(false);

        try {
            const requestBody = {
                c_scene_instances_id: sceneInstanceId,
                instance_id: instanceId,
                instance_type: instanceType,
                flag: trimmedFlag,
            };

            const response = await apiClientWithToken.post(
                `${BACK_IP_PORT}/api/flag/submit-flag`, 
                requestBody
            );

            if (response.data.code === 200) {
                const isCorrect = response.data.data?.is_correct;
                setIsSuccess(isCorrect);
                setMessage(response.data.message || (
                    isCorrect ? 'Flag提交成功！' : 'Flag不正确，请继续尝试。'
                ));
                
                // 如果Flag正确，清空输入框
                if (isCorrect) {
                    setFlag('');
                }
            } else {
                setIsSuccess(false);
                setMessage(response.data.message || 'Flag提交失败');
            }
        } catch (error: any) {
            console.error('Flag submission error:', error);
            setIsSuccess(false);
            if (error.response?.data?.message) {
                setMessage(error.response.data.message);
            } else {
                setMessage('提交失败，请稍后重试');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 2 }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                pb: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlagIcon color="primary" />
                    <Typography variant="h6">
                        提交 Flag
                    </Typography>
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        <strong>实例:</strong> {instanceName || instanceId}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        <strong>类型:</strong> {instanceType === 'docker' ? 'Docker容器' : '虚拟机'}
                    </Typography>
                </Box>

                <TextField
                    autoFocus
                    fullWidth
                    label="Flag值"
                    placeholder="flag{12345678-1234-1234-1234-123456789abc}"
                    value={flag}
                    onChange={handleFlagChange}
                    error={flagError}
                    helperText={flagError ? 'Flag格式不正确，应为 flag{UUID} 格式' : 'Flag必须以flag{开头，以}结尾，中间是UUID格式'}
                    disabled={isSubmitting}
                    sx={{ mb: 2 }}
                />

                {message && (
                    <Alert 
                        severity={isSuccess ? 'success' : 'error'}
                        icon={isSuccess ? <SuccessIcon /> : <ErrorIcon />}
                        sx={{ mt: 2 }}
                    >
                        {message}
                    </Alert>
                )}
            </DialogContent>
            
            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button 
                    onClick={handleClose} 
                    disabled={isSubmitting}
                    color="inherit"
                >
                    取消
                </Button>
                <Button 
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={isSubmitting || !flag.trim()}
                    startIcon={isSubmitting ? <CircularProgress size={16} /> : <FlagIcon />}
                >
                    {isSubmitting ? '提交中...' : '提交'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default FlagSubmissionModal;
