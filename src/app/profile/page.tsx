"use client";

import { Paper, Grid, TextField, Button, Typography, Box, Chip, Stack } from "@mui/material";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ColorMap } from "@/utils/color";
import { apiClientWithToken } from "@/utils/axios";
import { toast } from "react-toastify";

const PersonalPage: React.FC = () => {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [emailError, setEmailError] = useState("");
    const [formData, setFormData] = useState({
        username: '',
        email: "",
    });
    const [passwordData, setPasswordData] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [passwordErrors, setPasswordErrors] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [submitStatus, setSubmitStatus] = useState({
        success: false,
        message: "",
        visible: false

    })
    // 初始化表单数据
    useEffect(() => {
        if (user) {
            setFormData({
                username: user.user.c_username,
                email: user.user.c_email || "",
            });
        }
    }, [user]);

    const validateEmail = () => {
        let isValid = true;
        if (!formData.email.trim()) {
            setEmailError("邮箱不能为空");
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setEmailError("邮箱格式不正确");
            isValid = false;
        } else {
            setEmailError("");
        }

        return isValid;
    };

    // 验证密码表单
    const validatePassword = () => {
        const newErrors = {
            oldPassword: "",
            newPassword: "",
            confirmPassword: ""
        };
        let isValid = true;

        if (!passwordData.oldPassword.trim()) {
            newErrors.oldPassword = "旧密码不能为空";
            isValid = false;
        }

        if (!passwordData.newPassword.trim()) {
            newErrors.newPassword = "新密码不能为空";
            isValid = false;
        } else if (passwordData.newPassword.length < 6) {
            newErrors.newPassword = "新密码至少6位";
            isValid = false;
        }

        if (!passwordData.confirmPassword.trim()) {
            newErrors.confirmPassword = "请确认新密码";
            isValid = false;
        } else if (passwordData.confirmPassword !== passwordData.newPassword) {
            newErrors.confirmPassword = "两次输入的新密码不一致";
            isValid = false;
        }

        setPasswordErrors(newErrors);
        return isValid;
    };

    // 邮箱输入变化处理
    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (name === 'email') {
            if (value.trim()) {
                setEmailError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "邮箱格式不正确");
            } else {
                setEmailError("邮箱不能为空");
            }
        }
    };

    // 密码输入变化处理
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({
            ...prev,
            [name]: value
        }));

        if (name === 'oldPassword') {
            setPasswordErrors(prev => ({
                ...prev,
                oldPassword: value.trim() ? "" : "旧密码不能为空"
            }));
        } else if (name === 'newPassword') {
            setPasswordErrors(prev => ({
                ...prev,
                newPassword: value.trim() ? "" : "新密码不能为空"
            }));
        } else if (name === 'confirmPassword') {
            setPasswordErrors(prev => ({
                ...prev,
                confirmPassword: value.trim() ? "" : "请确认新密码"
            }));
        }
    };

    // 提交基本信息
    const handleSubmitInfo = async () => {
        if (!validateEmail()) return;
        apiClientWithToken.post("/back/api/support/user/update_pwd", JSON.stringify({
            data: {
                email: formData.email
            },
            id: user?.user.c_username
        })).then((res) => {
            if (res.data.code === 200) {
                toast.success(`修改信息成功`,
                    {
                        autoClose: 3000,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                    }
                );
            } else {
                toast.error(`修改信息失败 ${res.data.message}`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                })
            }
        }).finally(() => {
            setIsEditing(false);
        })

    };

    // 提交密码修改
    const handleSubmitPassword = async () => {
        if (!validatePassword()) return;
        if (!validateEmail()) return;
        apiClientWithToken.post("/back/api/support/user/update_pwd", JSON.stringify({
            data: {
                oldPassword: passwordData.oldPassword,
                newPassword: passwordData.newPassword,
            },
            id: user?.user.c_username
        })).then((res) => {
            if (res.data.code === 200) {
                toast.success(`修改密码成功`,
                    {
                        autoClose: 3000,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                    }
                );
            } else {
                toast.error(`修改密码失败 ${res.data.message}`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                })
            }
        }).finally(() => {
            setPasswordData({
                oldPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
            setIsEditing(false);
        })
    };

    // 取消编辑
    const handleCancel = () => {
        if (user) {
            setFormData({
                username: formData.username,
                email: user.user.c_email || "",
            });
        } else {
            setPasswordData({
                oldPassword: "",
                newPassword: "",
                confirmPassword: ""
            });
        }
        setIsEditing(false);
    };

    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
            {/* 页面标题和编辑按钮 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                    个人信息
                </Typography>
                {submitStatus.visible && (
                    <Typography
                        color={submitStatus.success ? "success.main" : "error.main"}
                        mr={2}
                    >
                        {submitStatus.message}
                    </Typography>
                )}
            </Box>
            <Grid container spacing={2} columns={16}>
                <Grid size={10}>
                    {
                        isEditing ? (
                            <Stack>
                                <TextField
                                    autoFocus
                                    fullWidth
                                    disabled
                                    name="username"
                                    label="用户名"
                                    variant="outlined"
                                    margin="dense"
                                    value={formData.username}
                                    required
                                />

                                <TextField
                                    fullWidth
                                    name="email"
                                    label="邮箱"
                                    type="email"
                                    variant="outlined"
                                    margin="dense"
                                    value={formData.email}
                                    onChange={handleEmailChange}
                                    error={!!emailError}
                                    helperText={emailError}
                                    required
                                />

                            </Stack>
                        ) : (
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    用户信息
                                </Typography>
                                <Box sx={{ mt: 2 }}>
                                    <Typography sx={{ fontWeight: 'bold' }}>用户名:</Typography>
                                    <Typography>{formData.username}</Typography>
                                </Box>
                                <Box sx={{ mt: 2 }}>
                                    <Typography sx={{ fontWeight: 'bold' }}>邮箱:</Typography>
                                    <Typography>{formData.email}</Typography>
                                </Box>
                                <Box sx={{ mt: 2 }}>
                                    <Typography sx={{ fontWeight: 'bold' }}>角色权限:</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                        {user?.role.map((role, index) => (
                                            <Chip
                                                key={role}
                                                label={role}
                                                size="small"
                                                color={ColorMap[index % ColorMap.length]}
                                                sx={{ m: 0.5 }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            </Box>
                        )
                    }
                    <Box sx={{ display: "flex", justifyContent: "center", pt: isEditing ? 22 : 10 }}>
                        {isEditing ? (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    variant="contained"
                                    onClick={handleSubmitInfo}
                                    disabled={!!emailError}
                                >
                                    保存
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={handleCancel}
                                >
                                    取消
                                </Button>
                            </Box>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={() => setIsEditing(true)}
                            >
                                编辑资料
                            </Button>
                        )
                        }
                    </Box>
                </Grid>
                <Grid size={6}>
                    {/* 右侧 - 修改密码表单 */}
                    <Box xs={12} md={6}>
                        <Typography variant="h6" gutterBottom>
                            修改密码
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <TextField
                                fullWidth
                                label="旧密码"
                                type="password"
                                name="oldPassword"
                                value={passwordData.oldPassword}
                                onChange={handlePasswordChange}
                                error={!!passwordErrors.oldPassword}
                                helperText={passwordErrors.oldPassword}
                                required
                            />
                        </Box>
                        <Box sx={{ mt: 2 }}>
                            <TextField
                                fullWidth
                                label="新密码"
                                type="password"
                                name="newPassword"
                                value={passwordData.newPassword}
                                onChange={handlePasswordChange}
                                error={!!passwordErrors.newPassword}
                                helperText={passwordErrors.newPassword}
                                required
                            />
                        </Box>
                        <Box sx={{ mt: 2 }}>
                            <TextField
                                fullWidth
                                label="确认新密码"
                                type="password"
                                name="confirmPassword"
                                value={passwordData.confirmPassword}
                                onChange={handlePasswordChange}
                                error={!!passwordErrors.confirmPassword}
                                helperText={passwordErrors.confirmPassword}
                                required
                            />
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: "center", pt: 5, mt: 3 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="contained"
                                onClick={handleSubmitPassword}
                                disabled={
                                    !!passwordErrors.oldPassword ||
                                    !!passwordErrors.newPassword ||
                                    !!passwordErrors.confirmPassword
                                }
                            >
                                保存密码
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={handleCancel}
                            >
                                取消
                            </Button>
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </Paper >
    );
};

export default PersonalPage;