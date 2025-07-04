"use client";
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert
} from '@mui/material';
import CryptoJS from "crypto-js";

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUsernameError(null);
    setPasswordError(null);
    let hasLocalError = false;
    if (!username.trim()) {
      setUsernameError('请输入用户名');
      hasLocalError = true;
    }
    if (!password.trim()) {
      setPasswordError('请输入密码');
      hasLocalError = true;
    }
    if (hasLocalError) return;

    try {
      const pwsha256 = CryptoJS.SHA256(password).toString()
      setSubmitting(true);
      await login(username, pwsha256);
    } catch (err) {
      setError((err as Error).message || '用户名或密码错误');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper sx={{ p: 4, width: 360 }} elevation={3}>
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          登录到 无人机网络安全实验平台
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
          <TextField
            label="用户名"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            error={!!usernameError}
            helperText={usernameError ?? ''}
          />
          <TextField
            label="密码"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            error={!!passwordError || !!error}
            helperText={passwordError ?? error ?? ''}
          />
          <Button type="submit" variant="contained" color="primary" fullWidth disabled={submitting} sx={{ mt: 1 }}>
            {submitting ? '登录中...' : '登录'}
          </Button>
        </Box>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" display="block">管理员: admin / admin123</Typography>
          <Typography variant="caption" display="block">学生: student / student123</Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;
