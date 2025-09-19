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
    Box,
    CircularProgress,
} from '@mui/material';

// 1. 修改 Props 接口，增加新的属性
interface SaveScenarioModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (name: string, description: string) => void;
    // --- 新增的 Props ---
    isSaving: boolean; // 用于控制加载状态
    initialName?: string | null; // 用于接收初始名称 (编辑模式)
    initialDescription?: string | null; // 用于接收初始描述 (编辑模式)
}

const SaveScenarioModal: React.FC<SaveScenarioModalProps> = ({
                                                                 open,
                                                                 onClose,
                                                                 onSave,
                                                                 isSaving,
                                                                 initialName,
                                                                 initialDescription
                                                             }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');

    // 2. 修改 useEffect 逻辑
    // 当弹窗打开时，根据是否有初始值来填充表单
    useEffect(() => {
        if (open) {
            // 如果是编辑模式，使用传入的初始值；否则，清空
            setName(initialName || '');
            setDescription(initialDescription || '');
            setError(''); // 总是清空错误信息
        }
    }, [open, initialName, initialDescription]); // 依赖项更新，以响应初始值的变化

    const handleConfirmSave = () => {
        if (!name.trim()) {
            setError('场景名称不能为空');
            return;
        }
        // 调用父组件的 onSave，父组件现在负责处理API调用和后续操作（如关闭弹窗）
        onSave(name, description);
    };

    const isSaveDisabled = !name.trim() || isSaving;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            {/* 3. 修改标题为动态标题 */}
            <DialogTitle>{initialName ? '编辑场景信息' : '保存新场景'}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <TextField
                        autoFocus
                        required
                        id="scenario-name"
                        label="场景名称"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (error) setError(''); // 用户开始输入时清除错误
                        }}
                        fullWidth
                        variant="outlined"
                        error={!!error}
                        helperText={error}
                        disabled={isSaving} // 保存时禁用输入框
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
                        disabled={isSaving} // 保存时禁用输入框
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>取消</Button>
                <Button
                    variant="contained"
                    onClick={handleConfirmSave}
                    disabled={isSaveDisabled}
                >
                    {/* 4. 根据 isSaving 状态显示不同内容 */}
                    {isSaving ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                            保存中...
                        </Box>
                    ) : '确认保存'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SaveScenarioModal;
