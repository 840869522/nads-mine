"use client";

import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, Box, FormGroup, FormControlLabel, Checkbox, Typography,
    CircularProgress, Alert, Skeleton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getCookie } from '@/utils/cookie';
import { TextField } from '@mui/material';

// 类型定义
interface Course {
    c_course_id: string;
    c_course_name: string;
}
interface User {
    id: string;
    name: string;
    username: string; // Added to store c_username
}
interface CoursePermissionDialogProps {
    open: boolean;
    onClose: () => void;
    course: Course | null;
    onSaveSuccess: () => void;
}

const CoursePermissionDialog: React.FC<CoursePermissionDialogProps> = ({ open, onClose, course, onSaveSuccess }) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            if (!course) return;
            const token = getCookie('_auth');
            console.log('JWT Token:', token);
            if (!token) {
                setError("用户未认证，请重新登录。");
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const requestOptions = {
                    method: 'GET',
                    headers: {
                        'Authorization': `${token}`,
                        'Content-Type': 'application/json'
                    }
                };

                console.log('Sending GET request to:', `/back/api/study/permissions/usernames`);
                const [usersRes, permissionsRes] = await Promise.all([
                    fetch(`/back/api/study/permissions/usernames`, requestOptions),
                    fetch(`/back/api/study/permissions/courses/${course.c_course_id}/users`, requestOptions)
                ]);

                console.log('usersRes status:', usersRes.status);
                console.log('permissionsRes status:', permissionsRes.status);

                const usersData = await usersRes.json();
                console.log('Raw usersData:', JSON.stringify(usersData, null, 2));

                if (usersData.code !== 200) {
                    setError(usersData.message || '加载用户数据失败');
                    throw new Error(usersData.message || `加载用户数据失败 (code: ${usersData.code})`);
                }

                const fetchedUsers: User[] = Array.isArray(usersData.data) ? usersData.data.map((u: any) => ({
                    id: u.c_username,
                    username: u.c_username,
                    name: u.c_name || u.c_username // Fallback to username if name is empty
                })) : [];
                console.log('Fetched users:', fetchedUsers);
                setAllUsers(fetchedUsers);

                const permissionsData = await permissionsRes.json();
                console.log('Raw permissionsData:', JSON.stringify(permissionsData, null, 2));
                if (permissionsData.code !== 200) {
                    setError(permissionsData.message || '加载权限数据失败');
                    throw new Error(permissionsData.message || `加载权限数据失败 (code: ${permissionsData.code})`);
                }

                const currentPermissionIds: string[] = Array.isArray(permissionsData.data) ? permissionsData.data.map((u: any) => u.c_username) : [];
                const initialPermissions = fetchedUsers.reduce((acc: Record<string, boolean>, user: User) => {
                    acc[user.id] = currentPermissionIds.includes(user.id);
                    return acc;
                }, {});
                setPermissions(initialPermissions);
            } catch (err: any) {
                setError(err.message || "发生未知错误");
                console.error('Fetch error:', err);
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
        }
    }, [open, course]);

    const handleSave = async () => {
        const token = getCookie('_auth');
        if (!course || !token) {
            setError("用户未认证，无法保存。");
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const grantedUserIds = Object.keys(permissions).filter(userId => permissions[userId]);
            const response = await fetch(`/back/api/study/permissions/courses/${course.c_course_id}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${token}`
                },
                body: JSON.stringify({ users: grantedUserIds })
            });

            if (!response.ok) {
                throw new Error("保存权限失败");
            }

            const result = await response.json();
            if (result.code !== 200) {
                throw new Error(result.message || '保存权限失败');
            }

            onSaveSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePermissionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPermissions(prev => ({ ...prev, [event.target.name]: event.target.checked }));
    };

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
            return (
                <Typography sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
                    无法加载用户列表，可能缺少权限或数据库为空，请联系管理员。
                </Typography>
            );
        }
        const filteredUsers = allUsers.filter(user =>
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <>
                <Box sx={{ p: 2, pb: 0 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="搜索用户姓名或用户名"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        size="small"
                    />
                </Box>
                <FormGroup>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start', p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Button
                            variant="text"
                            size="small"
                            onClick={() => {
                                const newPermissions = { ...permissions };
                                filteredUsers.forEach(user => { newPermissions[user.id] = true; });
                                setPermissions(newPermissions);
                            }}
                            disabled={isSaving}
                        >
                            全选
                        </Button>
                        <Button
                            variant="text"
                            size="small"
                            onClick={() => {
                                const newPermissions = { ...permissions };
                                filteredUsers.forEach(user => { newPermissions[user.id] = false; });
                                setPermissions(newPermissions);
                            }}
                            disabled={isSaving}
                        >
                            取消全选
                        </Button>
                    </Box>
                    {filteredUsers.map(user => (
                        <FormControlLabel
                            key={user.id}
                            control={<Checkbox checked={!!permissions[user.id]} onChange={handlePermissionChange} name={user.id} disabled={isSaving} />}
                            label={`${user.name} (${user.username})`}
                            sx={{ pl: 1, pr: 1, borderBottom: '1px solid', borderColor: 'divider' }}
                        />
                    ))}
                </FormGroup>
            </>
        );
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                管理课程权限: {course?.c_course_name}
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

export default CoursePermissionDialog;