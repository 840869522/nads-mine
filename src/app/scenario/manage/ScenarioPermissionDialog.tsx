"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, Box, TextField, FormGroup, FormControlLabel, Checkbox, Typography, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { type Scenario } from './page'; 


// 模拟的用户数据
const mockUsers = [
    { id: 'user-1', name: 'Alice' },
    { id: 'user-2', name: 'Bob' },
    { id: 'user-3', name: 'Charlie' },
    { id: 'user-4', name: 'David' },
];

interface ScenarioPermissionDialogProps {
    open: boolean;
    onClose: () => void;
    scenario: Scenario | null;
    onSaveSuccess: () => void;
}

const ScenarioPermissionDialog: React.FC<ScenarioPermissionDialogProps> = ({ open, onClose, scenario, onSaveSuccess }) => {
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && scenario) {
            // 在实际应用中，这里应该从后端API获取当前场景的权限设置
            // 此处我们模拟一个初始状态，比如 Bob 和 David 拥有权限
            const initialPermissions = mockUsers.reduce((acc, user) => {
                acc[user.id] = ['user-2', 'user-4'].includes(user.id);
                return acc;
            }, {} as Record<string, boolean>);
            setPermissions(initialPermissions);
            setError(null);
        } else {
            // 关闭时重置状态
            setPermissions({});
        }
    }, [open, scenario]);

    const handlePermissionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPermissions({
            ...permissions,
            [event.target.name]: event.target.checked,
        });
    };

    const handleSave = async () => {
        if (!scenario) return;

        setIsSaving(true);
        setError(null);
        try {
            console.log(`正在保存场景 "${scenario.name}" 的权限:`, permissions);
            // 模拟API调用
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 在实际应用中，您会在这里发起一个API请求来保存权限
            // const response = await fetch(`/api/scenarios/${scenario.id}/permissions`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ permissions }),
            // });
            // if (!response.ok) {
            //     throw new Error('保存权限失败');
            // }

            onSaveSuccess(); // 调用父组件传入的成功回调
            onClose(); // 关闭弹窗
        } catch (err: any) {
            setError(err.message || '发生未知错误');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                管理场景权限: {scenario?.name || ''}
                <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box component="form" noValidate autoComplete="off" sx={{ mt: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                        选择可以查看此场景的用户:
                    </Typography>
                    <FormGroup>
                        {mockUsers.map(user => (
                            <FormControlLabel
                                key={user.id}
                                control={
                                    <Checkbox
                                        checked={permissions[user.id] || false}
                                        onChange={handlePermissionChange}
                                        name={user.id}
                                    />
                                }
                                label={user.name}
                            />
                        ))}
                    </FormGroup>
                    {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>取消</Button>
                <Button onClick={handleSave} variant="contained" color="primary" disabled={isSaving}>
                    {isSaving ? <CircularProgress size={24} /> : '保存权限'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ScenarioPermissionDialog;