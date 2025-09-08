"use client";

import React, { useState, useEffect, useContext } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, Box, FormGroup, FormControlLabel, Checkbox, Typography, CircularProgress,
    Alert, Skeleton, TextField, InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { AuthContext } from '@/contexts/AuthContext';
import { getCookie } from '@/utils/cookie';
import { customFetch } from '@/utils/fetch';

// 类型定义
export interface Scenario {
    id: string;
    name: string;
}
interface User {
    id: string;
    name: string;
}
interface ScenarioPermissionDialogProps {
    open: boolean;
    onClose: () => void;
    scenario: Scenario | null;
    onSaveSuccess: () => void;
}

// API 配置
const API_PREFIX = '/back/api';

const ScenarioPermissionDialog: React.FC<ScenarioPermissionDialogProps> = ({ open, onClose, scenario, onSaveSuccess }) => {

    const authContext = useContext(AuthContext);

    // 组件状态定义
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // 数据获取逻辑
    useEffect(() => {
        const token = getCookie('_auth');
        const loadData = async () => {
            if (!scenario || !token) {
                setError("用户未认证或认证已失效，请重新登录。");
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const requestOptions = { method: 'GET', headers: { 'token': `${token}` } };
                const [usersRes, permissionsRes] = await Promise.all([
                    customFetch(`${API_PREFIX}/permissions/users`, requestOptions),
                    customFetch(`${API_PREFIX}/scenarios/${scenario.id}/permissions`, requestOptions)
                ]);
                if (!usersRes.ok || !permissionsRes.ok) {
                    const authErrorStatus = [401, 403, 420];
                    if (authErrorStatus.includes(usersRes.status) || authErrorStatus.includes(permissionsRes.status)) {
                        throw new Error("认证失败或Token已过期，请重新登录。");
                    }
                    throw new Error(`加载数据失败 (HTTP 状态: ${usersRes.status}, ${permissionsRes.status})`);
                }
                const usersData = await usersRes.json();

                // ▼▼▼ BUG修复 ▼▼▼
                // 错误地对 usersRes 调用了两次 .json()，现已修正为对 permissionsRes 调用。
                const permissionsData = await permissionsRes.json();
                // ▲▲▲ 修复结束 ▲▲▲

                const fetchedUsers: User[] = Array.isArray(usersData) ? usersData : [];
                setAllUsers(fetchedUsers);
                const currentPermissionIds: string[] = Array.isArray(permissionsData) ? permissionsData : [];
                const initialPermissions = fetchedUsers.reduce((acc: Record<string, boolean>, user: User) => {
                    acc[user.id] = currentPermissionIds.includes(user.id);
                    return acc;
                }, {});
                setPermissions(initialPermissions);
            } catch (err: any) {
                setError(err.message || "发生未知错误");
            } finally {
                setIsLoading(false);
            }
        };

        if (open) {
            loadData();
        } else {
            setAllUsers([]);
            setPermissions({});
            setError(null);
            setIsLoading(false);
            setIsSaving(false);
            setSearchTerm('');
        }
    }, [open, scenario, authContext?.user]);

    // 保存权限逻辑
    const handleSave = async () => {
        if (!scenario) {
            setError("无法保存，场景信息丢失。");
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const token = getCookie('_auth');
            if (!token) {
                throw new Error("认证失败，请重新登录。");
            }
            const grantedUserIds = Object.keys(permissions).filter(userId => permissions[userId]);
            const response = await customFetch(`${API_PREFIX}/scenarios/${scenario.id}/permissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': token,
                },
                body: JSON.stringify({ users: grantedUserIds }),
            });

            if (!response.ok) {
                // 尝试解析错误信息
                try {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `保存失败 (HTTP 状态: ${response.status})`);
                } catch {
                    throw new Error(`保存失败 (HTTP 状态: ${response.status})`);
                }
            }
            onSaveSuccess(); // 调用父组件的回调
            onClose(); // 关闭对话框
        } catch (err: any) {
            setError(err.message || "保存时发生未知错误。");
        } finally {
            setIsSaving(false);
        }
    };

    // 复选框变更处理器 (无变化)
    const handlePermissionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPermissions(prev => ({ ...prev, [event.target.name]: event.target.checked }));
    };

    // 用户过滤逻辑 (无变化)
    const getFilteredUsers = (): User[] => {
        if (!searchTerm.trim()) {
            return allUsers;
        }
        try {
            const regex = new RegExp(searchTerm.trim(), 'i');
            return allUsers.filter(user => regex.test(user.name));
        } catch (e) {
            console.warn("无效的正则表达式，已降级为子字符串搜索:", e);
            const lowercasedSearchTerm = searchTerm.trim().toLowerCase();
            return allUsers.filter(user => user.name.toLowerCase().includes(lowercasedSearchTerm));
        }
    };

    const filteredUsers = getFilteredUsers();

    // 1. 计算“全选”复选框的状态 (无变化)
    const selectedFilteredCount = filteredUsers.filter(user => permissions[user.id]).length;
    const isAllFilteredSelected = filteredUsers.length > 0 && selectedFilteredCount === filteredUsers.length;
    const isSomeFilteredSelected = selectedFilteredCount > 0 && selectedFilteredCount < filteredUsers.length;

    // 2. “全选”复选框的点击事件处理器 (无变化)
    const handleSelectAllChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = event.target.checked;
        const newPermissions = { ...permissions };
        filteredUsers.forEach(user => {
            newPermissions[user.id] = isChecked;
        });
        setPermissions(newPermissions);
    };

    // 渲染对话框内容 (无变化)
    const renderContent = () => {
        if (isLoading) {
            return (
                <Box sx={{ p: 2 }}>
                    {[...Array(5)].map((_, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                            <Skeleton variant="rectangular" width={24} height={24} sx={{ mr: 1.5 }} />
                            <Skeleton variant="text" sx={{ flexGrow: 1 }} />
                        </Box>
                    ))}
                </Box>
            );
        }
        if (error) {
            return <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>;
        }
        if (allUsers.length === 0) {
            return <Typography sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>没有可供选择的用户。</Typography>;
        }
        return (
            <>
                {/* 搜索框 */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        size="small"
                        placeholder="搜索用户 (支持正则表达式)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>

                {/* “全选”复选框 UI */}
                <Box sx={{ pl: 1, pr: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <FormControlLabel
                        label="全选/取消全选 (当前结果)"
                        control={
                            <Checkbox
                                checked={isAllFilteredSelected}
                                indeterminate={isSomeFilteredSelected}
                                onChange={handleSelectAllChange}
                                disabled={filteredUsers.length === 0}
                            />
                        }
                    />
                </Box>

                {/* 用户列表 */}
                {filteredUsers.length > 0 ? (
                    <FormGroup>
                        {filteredUsers.map(user => (
                            <FormControlLabel
                                key={user.id}
                                control={<Checkbox checked={!!permissions[user.id]} onChange={handlePermissionChange} name={user.id} disabled={isSaving} />}
                                label={user.name}
                                sx={{ pl: 2, pr: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                            />
                        ))}
                    </FormGroup>
                ) : (
                    <Typography sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
                        未找到匹配的用户。
                    </Typography>
                )}
            </>
        );
    };

    // 最终的 JSX 结构 (无变化)
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                管理场景权限: {scenario?.name}
                <IconButton aria-label="close" onClick={onClose} disabled={isSaving || isLoading}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {renderContent()}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>取消</Button>
                <Button onClick={handleSave} variant="contained" disabled={isSaving || isLoading || !!error}>
                    {isSaving ? <CircularProgress size={24} /> : '保存权限'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ScenarioPermissionDialog;