'use client';

import React from 'react';
import { Container, Typography, Paper, Box } from '@mui/material';

// 简单的测试页面，用于验证路由是否正常工作
export default function FlagHistoryTestPage() {
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Flag History Page Test
                </Typography>
                <Typography variant="body1" paragraph>
                    如果你能看到这个页面，说明路由配置是正确的。
                </Typography>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                    <Typography variant="body2">
                        路径: /flag-history
                    </Typography>
                    <Typography variant="body2">
                        时间: {new Date().toLocaleString()}
                    </Typography>
                    <Typography variant="body2">
                        环境: {process.env.NODE_ENV}
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
}
