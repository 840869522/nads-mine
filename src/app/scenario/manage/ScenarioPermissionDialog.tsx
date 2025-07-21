"use client";

import React, { useState, useEffect, useContext } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, Box, FormGroup, FormControlLabel, Checkbox, Typography, CircularProgress,
    Alert, Skeleton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { AuthContext } from '@/contexts/AuthContext'; // 确保路径与您的 AuthContext 文件匹配
import { getCookie } from '@/utils/cookie';           // 确保路径与您的 cookie 工具函数文件匹配

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

    // 从 AuthContext 获取认证状态，用于 useEffect 依赖项
    const authContext = useContext(AuthContext);

    // 组件状态定义
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 数据获取逻辑
    useEffect(() => {
        const token = getCookie('_auth'); // 从 cookie 读取 token

        const loadData = async () => {
            if (!scenario) return;

            // 关键检查 1: 在发起请求前，检查 token 是否存在
            if (!token) {
                setError("用户未认证或认证已失效，请重新登录。");
                return;
            }

            setIsLoading(true);
            setError(null);
            // headers: { 'Authorization': `Bearer ${token}` }
            try {
                const requestOptions = {
                    method: 'GET',
                    headers: { 'token': `${token}` }
                };

                const [usersRes, permissionsRes] = await Promise.all([
                    fetch(`${API_PREFIX}/permissions/users`, requestOptions),
                    fetch(`${API_PREFIX}/scenarios/${scenario.id}/permissions`, requestOptions)
                ]);

                // 关键检查 2: 检查 API 响应是否成功
                if (!usersRes.ok || !permissionsRes.ok) {
                    // 为认证失败（401, 403, 或您案例中的 420）提供专门的、清晰的错误提示
                    const authErrorStatus = [401, 403, 420];
                    if (authErrorStatus.includes(usersRes.status) || authErrorStatus.includes(permissionsRes.status)) {
                        throw new Error("认证失败或Token已过期，请重新登录。");
                    }
                    // 其他类型的错误
                    throw new Error(`加载数据失败 (HTTP 状态: ${usersRes.status}, ${permissionsRes.status})`);
                }

                const usersData = await usersRes.json();
                const permissionsData = await permissionsRes.json();

                // 安全地处理返回的数据
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
            // 对话框关闭时，重置所有状态，避免数据显示残留
            setAllUsers([]);
            setPermissions({});
            setError(null);
            setIsLoading(false);
            setIsSaving(false);
        }
        // 当弹窗打开/关闭、场景变化、或用户登录/登出时，重新执行
    }, [open, scenario, authContext?.user]);

    // 保存权限逻辑
    const handleSave = async () => {
        const token = getCookie('_auth'); // 同样从 cookie 获取 token

        if (!scenario || !token) {
            setError("用户未认证，无法保存。");
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const grantedUserIds = Object.keys(permissions).filter(userId => permissions[userId]);
            const response = await fetch(`${API_PREFIX}/scenarios/${scenario.id}/permissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `${token}`
                },
                body: JSON.stringify({ users: grantedUserIds }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `保存失败，状态码: ${response.status}` }));
                throw new Error(errData.message || `保存失败`);
            }

            // 某些API即使成功也可能返回业务失败信息
            const result = await response.json();
            if (result && result.success === false) {
                throw new Error(result.message || '保存权限失败。');
            }

            onSaveSuccess(); // 通知父组件保存成功

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // 复选框变更处理器
    const handlePermissionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPermissions(prev => ({ ...prev, [event.target.name]: event.target.checked }));
    };

    // 渲染对话框内容
    const renderContent = () => {
        // 状态 1: 正在加载数据，显示骨架屏
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
        // 状态 2: 发生错误，优先显示错误警告
        if (error) {
            return <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>;
        }
        // 状态 3: 加载完成但没有用户数据
        if (allUsers.length === 0) {
            return <Typography sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>没有可供选择的用户。</Typography>;
        }
        // 状态 4: 正常显示用户列表
        return (
            <FormGroup>
                {allUsers.map(user => (
                    <FormControlLabel
                        key={user.id}
                        control={<Checkbox checked={!!permissions[user.id]} onChange={handlePermissionChange} name={user.id} disabled={isSaving} />}
                        label={user.name}
                        sx={{ pl: 1, pr: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                    />
                ))}
            </FormGroup>
        );
    };

    // 最终的 JSX 结构
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