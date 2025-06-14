
import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  // Grid, // Old import
  SelectChangeEvent,
} from '@mui/material';
import Grid from '@mui/material/Grid'; // New import
import { User, UserRole } from '../../types';
import { USER_ROLES_CONFIG } from '../../constants';

// Extended user type for the form, including fields not in the base User type
export interface UserFormData extends Partial<User> {
  email?: string;
  status?: 'active' | 'disabled';
  password?: string; // For new users or password change
}

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (user: UserFormData, isNew: boolean) => void;
  initialUser: (User & { email: string; status: 'active' | 'disabled'; createdAt: string }) | null;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ open, onClose, onSave, initialUser }) => {
  const [formData, setFormData] = useState<UserFormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNewUser = !initialUser;

  useEffect(() => {
    if (open) {
      if (initialUser) {
        setFormData({
          id: initialUser.id,
          username: initialUser.username,
          role: initialUser.role,
          email: initialUser.email,
          status: initialUser.status,
          password: '', // Password field cleared for editing
        });
      } else {
        setFormData({
          username: '',
          role: UserRole.STUDENT, // Default role
          email: '',
          status: 'active', // Default status
          password: '',
        });
      }
      setErrors({});
    }
  }, [initialUser, open]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (e: SelectChangeEvent<string | UserRole>) => {
    const { name, value } = e.target;
     setFormData(prev => ({ ...prev, [name]: value as UserRole | 'active' | 'disabled' }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.username?.trim()) newErrors.username = '用户名不能为空。';
    if (!formData.email?.trim()) {
      newErrors.email = '邮箱不能为空。';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '邮箱格式无效。';
    }
    if (!formData.role) newErrors.role = '请选择一个角色。';
    if (isNewUser && !formData.password?.trim()) {
      newErrors.password = '新用户必须设置密码。';
    } else if (formData.password && formData.password.length < 6) {
        newErrors.password = '密码至少需要6个字符。'
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData, isNewUser);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}>
        {isNewUser ? '添加新用户' : `编辑用户: ${initialUser?.username}`}
      </DialogTitle>
      <DialogContent sx={{ py: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              autoFocus
              name="username"
              label="用户名"
              fullWidth
              variant="outlined"
              value={formData.username || ''}
              onChange={handleChange}
              error={!!errors.username}
              helperText={errors.username}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              name="email"
              label="邮箱"
              type="email"
              fullWidth
              variant="outlined"
              value={formData.email || ''}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              required
            />
          </Grid>
          <Grid item xs={12} sm={isNewUser ? 6 : 12}>
            <FormControl fullWidth variant="outlined" error={!!errors.role} required>
              <InputLabel id="user-role-label">角色</InputLabel>
              <Select
                labelId="user-role-label"
                name="role"
                value={formData.role || ''}
                onChange={handleSelectChange}
                label="角色"
              >
                {Object.values(UserRole).map((roleKey) => (
                  <MenuItem key={roleKey} value={roleKey}>
                    {USER_ROLES_CONFIG[roleKey]?.name || roleKey}
                  </MenuItem>
                ))}
              </Select>
              {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
            </FormControl>
          </Grid>
          {isNewUser && (
             <Grid item xs={12} sm={6}>
              <TextField
                name="password"
                label="密码"
                type="password"
                fullWidth
                variant="outlined"
                value={formData.password || ''}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                required={isNewUser}
                autoComplete="new-password"
              />
            </Grid>
          )}
          {!isNewUser && (
             <Grid item xs={12}>
                <TextField
                    name="password"
                    label="新密码 (可选, 留空则不更改)"
                    type="password"
                    fullWidth
                    variant="outlined"
                    value={formData.password || ''}
                    onChange={handleChange}
                    error={!!errors.password}
                    helperText={errors.password}
                    autoComplete="new-password"
                />
            </Grid>
          )}


          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined" error={!!errors.status}>
              <InputLabel id="user-status-label">状态</InputLabel>
              <Select
                labelId="user-status-label"
                name="status"
                value={formData.status || 'active'}
                onChange={handleSelectChange}
                label="状态"
              >
                <MenuItem value="active">已激活</MenuItem>
                <MenuItem value="disabled">已禁用</MenuItem>
              </Select>
              {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, borderTop: 1, borderColor: 'divider', pt: 2 }}>
        <Button onClick={onClose} color="secondary" variant="outlined">取消</Button>
        <Button onClick={handleSubmit} variant="contained">
          {isNewUser ? '确认添加' : '保存更改'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserFormModal;
