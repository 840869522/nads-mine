import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, Box, Typography, CircularProgress, Alert, List, ListItem, ListItemText
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
interface CourseLearnPermissionDialogProps {
    open: boolean;
    onClose: () => void;
    course: Course | null;
}

const CourseLearnPermissionDialog: React.FC<CourseLearnPermissionDialogProps> = ({ open, onClose, course }) => {
    const [permittedUsers, setPermittedUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            if (!course) return;
            const token = getCookie('_auth');
            if (!token) {
                setError("用户未认证，请重新登录。");
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/back/api/study/permissions/courses/${course.c_course_id}/users`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const permissionsData = await response.json();
                if (permissionsData.code !== 200) {
                    setError(permissionsData.message || '加载权限数据失败');
                    throw new Error(permissionsData.message || `加载权限数据失败 (code: ${permissionsData.code})`);
                }

                const fetchedUsers: User[] = Array.isArray(permissionsData.data)
                    ? permissionsData.data.map((u: any) => ({
                        id: u.c_username,
                        username: u.c_username,
                        name: u.c_name || u.c_username // Fallback to username if name is empty
                    }))
                    : [];
                setPermittedUsers(fetchedUsers);
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
            setPermittedUsers([]);
            setError(null);
            setIsLoading(false);
            setSearchTerm('');
        }
    }, [open, course]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress />
                </Box>
            );
        }
        if (error) {
            return <Alert severity="error" sx={{ m: 1 }}>{error}</Alert>;
        }
        if (permittedUsers.length === 0) {
            return (
                <Typography sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
                    无用户被分配此课程权限。
                </Typography>
            );
        }
        const filteredUsers = permittedUsers.filter(user =>
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
                <List sx={{ p: 1 }}>
                    {filteredUsers.map(user => (
                        <ListItem key={user.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                            <ListItemText primary={`${user.name} (${user.username})`} />
                        </ListItem>
                    ))}
                </List>
            </>
        );
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                查看课程权限: {course?.c_course_name}
                <IconButton aria-label="close" onClick={onClose} disabled={isLoading}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {renderContent()}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isLoading}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CourseLearnPermissionDialog;