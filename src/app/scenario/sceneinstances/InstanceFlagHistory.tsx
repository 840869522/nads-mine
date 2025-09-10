// src/app/scenario/sceneinstances/InstanceFlagHistory.tsx
"use client";
import React from 'react';
import { Box, Typography } from '@mui/material';

interface InstanceFlagHistoryProps {
    instanceId: string | null;
}

const InstanceFlagHistory: React.FC<InstanceFlagHistoryProps> = ({ instanceId }) => {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                Flag 历史记录
            </Typography>
            <Typography variant="body2" color="text.secondary">
                场景实例ID: {instanceId || '未选择'}
            </Typography>
            {/* 这里可以添加Flag相关的具体内容 */}
        </Box>
    );
};

export default InstanceFlagHistory;
