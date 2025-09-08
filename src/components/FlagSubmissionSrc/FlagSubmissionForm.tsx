import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import {apiClientWithToken} from "@/utils/axios.tsx";
import { useAuth } from '../../contexts/AuthContext'; // 假设你有一个AuthContext来获取JWT token

interface FlagSubmissionFormProps {
    instanceId: string;
    sceneInstanceId: string;
    instanceType: 'docker' | 'vm';
}

const FlagSubmissionForm: React.FC<FlagSubmissionFormProps> = ({
                                                                   instanceId,
                                                                   sceneInstanceId,
                                                                   instanceType,
                                                               }) => {
    const [flag, setFlag] = useState('');
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const { token } = useAuth(); // 从你的认证上下文中获取token

    const handleSubmit = async () => {
        setMessage('');
        setIsSuccess(false);

        try {
            const response = await apiClientWithToken.post(
                '/back/api/flag/submit-flag',
                {
                    c_scene_instances_id: sceneInstanceId,
                    instance_id: instanceId,
                    instance_type: instanceType,
                    flag: flag,
                    token: token  // 为了适配JWT中间件，同时添加token字段
                }
            );

            if (response.data.code === 200) {
                setMessage(response.data.message);
                setIsSuccess(true);
                setFlag('');
            } else {
                setMessage(response.data.message || '提交失败');
                setIsSuccess(false);
            }
        } catch (error) {
            setMessage('提交请求失败，请稍后重试。');
            setIsSuccess(false);
        }
    };

    return (
        <Box sx={{ my: 2 }}>
            <Typography variant="h6" gutterBottom>
                提交 Flag
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    label="请输入 Flag"
                    variant="outlined"
                    fullWidth
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                />
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!flag}
                >
                    提交
                </Button>
            </Box>
            {message && (
                <Alert severity={isSuccess ? 'success' : 'error'} sx={{ mt: 2 }}>
                    {message}
                </Alert>
            )}
        </Box>
    );
};

export default FlagSubmissionForm;