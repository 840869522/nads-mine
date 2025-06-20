"use client";
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Stack,
    Typography,
    Box
} from '@mui/material';

interface SaveScenarioModalProps {
    open: boolean;
    onClose: () => void;
    // 回调函数，将名称和描述传回
    onSave: (name: string, description: string) => void;
}

const SaveScenarioModal: React.FC<SaveScenarioModalProps> = ({ open, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');

    // 每次打开弹窗时，清空之前的输入
    useEffect(() => {
        if (open) {
            setName('');
            setDescription('');
            setError('');
        }
    }, [open]);

    const handleConfirmSave = () => {
        // 简单的验证
        if (!name.trim()) {
            setError('场景名称不能为空');
            return;
        }
        // 调用父组件传递的 onSave 函数
        onSave(name, description);
        onClose(); // 关闭弹窗
    };

    // 获取当前日期
    const currentDate = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>保存拓扑场景</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <TextField
                        autoFocus
                        required
                        id="scenario-name"
                        label="场景名称"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        variant="outlined"
                        error={!!error}
                        helperText={error}
                    />
                    <TextField
                        id="scenario-description"
                        label="场景描述"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={4}
                        variant="outlined"
                    />
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            上传日期: {currentDate}
                        </Typography>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>取消</Button>
                <Button variant="contained" onClick={handleConfirmSave}>确认保存</Button>
            </DialogActions>
        </Dialog>
    );
};

export default SaveScenarioModal;
