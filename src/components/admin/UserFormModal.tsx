import React, { useEffect, useState, ChangeEvent } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  Stack,
  useMediaQuery,
  SelectChangeEvent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { User, UserRole } from '../../types';
import { USER_ROLES_CONFIG } from '../../constants';

// ---------- Types ----------
export interface UserFormData extends Partial<User> {
  username?: string;
  email?: string;
  status?: 'active' | 'disabled';
  password?: string;
}

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (user: UserFormData, isNew: boolean) => void;
  initialUser: ({}) | null;
}

const DEFAULT_FORM: UserFormData = {
  username: '',
  role: UserRole.STUDENT,
  email: '',
  status: 'active',
  password: '',
};

// ---------- Component ----------
const UserFormModal: React.FC<UserFormModalProps> = ({ open, onClose, onSave, initialUser }) => {
  const theme             = useTheme();
  const fullScreen        = useMediaQuery(theme.breakpoints.down('sm'));
  const [formData, setFormData] = useState<UserFormData>(DEFAULT_FORM);
  const [errors,  setErrors]    = useState<Record<string, string>>({});
  const isNewUser               = !initialUser;

  // ----------- Sync initial data -----------
  useEffect(() => {
    if (!open) return;

    if (initialUser) {
      setFormData({
        username:  initialUser.c_username,
        role:      initialUser.role,
        email:     initialUser.c_email,
        status:    initialUser.c_is_login ? "active" : "disabled",
        password:  '',
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
    setErrors({});
  }, [open, initialUser]);

  // ----------- Handlers -----------
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as any }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ----------- Validation -----------
  const validate = () => {
    const next: Record<string, string> = {};

    if (!formData.username?.trim()) next.username = '用户名不能为空';

    if (!formData.email?.trim()) {
      next.email = '邮箱不能为空';
    } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(formData.email)) {
      next.email = '邮箱格式无效';
    }

    if (!formData.role) next.role = '请选择角色';

    if (isNewUser && !formData.password?.trim()) {
      next.password = '新用户必须设置密码';
    } else if (formData.password && formData.password.length < 6) {
      next.password = '密码至少 6 位';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave(formData, isNewUser);
    onClose();
  };

  // ----------- UI -----------
  return (
      <Dialog
          open={open}
          onClose={onClose}
          fullWidth
          maxWidth="sm"
          fullScreen={fullScreen}
          PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {/* Title */}
        <DialogTitle>{isNewUser ? '添加新用户' : `编辑用户: ${initialUser?.username}`}</DialogTitle>

        {/* Content */}
        <DialogContent dividers>
          <Stack spacing={2}>
            {/* 基本信息 */}
            <TextField
                autoFocus
                fullWidth
                name="username"
                label="用户名"
                variant="outlined"
                margin="dense"
                value={formData.username}
                onChange={handleChange}
                error={!!errors.username}
                helperText={errors.username}
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
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                required
            />

            {/* 角色 & 密码 */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth margin="dense" error={!!errors.role} required>
                <InputLabel id="role-label">角色</InputLabel>
                <Select
                    labelId="role-label"
                    name="role"
                    label="角色"
                    value={formData.role || ''}
                    onChange={handleSelectChange}
                >
                  {Object.values(UserRole).map(r => (
                      <MenuItem key={r} value={r}>
                        {USER_ROLES_CONFIG[r]?.name || r}
                      </MenuItem>
                  ))}
                </Select>
                {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
              </FormControl>

              <TextField
                  fullWidth
                  name="password"
                  type="password"
                  label={isNewUser ? '密码' : '新密码 (可选)'}
                  variant="outlined"
                  margin="dense"
                  value={formData.password}
                  onChange={handleChange}
                  error={!!errors.password}
                  helperText={errors.password}
                  required={isNewUser}
                  autoComplete="new-password"
              />
            </Stack>

            {/* 状态 */}
            <FormControl fullWidth margin="dense" error={!!errors.status}>
              <InputLabel id="status-label">状态</InputLabel>
              <Select
                  labelId="status-label"
                  name="status"
                  label="状态"
                  value={formData.status || 'active'}
                  onChange={handleSelectChange}
              >
                <MenuItem value="active">已激活</MenuItem>
                <MenuItem value="disabled">已禁用</MenuItem>
              </Select>
              {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
            </FormControl>
          </Stack>
        </DialogContent>

        {/* Actions */}
        <DialogActions sx={{ p: 2 }}>  {/* matches MUI form-dialog example */}
          <Button onClick={onClose}>取消</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {isNewUser ? '确认添加' : '保存更改'}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

export default UserFormModal;
