

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';


export interface PermissionFormData {
  id?: string;
  name: string;
}



interface PermissionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (role: PermissionFormData, isNew: boolean) => void;
  initialPermission: PermissionFormData | null;
}

const PermissionFormModal: React.FC<PermissionFormModalProps> = ({ open, onClose, onSave, initialPermission }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [formData, setFormData] = useState<PermissionFormData>({ id: '', name: ''});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNewRole = !initialPermission;

  useEffect(() => {
    if (open) {
      if (initialPermission) {
        setFormData({
          id: initialPermission?.id,
          name: initialPermission?.name
        });
      } else {
        setFormData({
            id: "",
            name: ""
        });
      }
      setErrors({});
    }
  }, [initialPermission, open]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };



  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.id.trim()) newErrors.id = '权限id不能为空。';
    if (!formData.name.trim()) newErrors.name = '权限描述不能为空。';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData, isNewRole);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        {isNewRole ? '添加新权限' : `编辑权限: ${initialPermission?.name}`}
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>权限信息</Typography>
            <TextField
              autoFocus
              name="id"
              label="权限id"
              fullWidth
              variant="outlined"
              value={formData.id || ''}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
              required
              sx={{ mb: 2 }}
              disabled={!isNewRole}
            />
            <TextField
              name="name"
              label="权限描述"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={formData.name || ''}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
              required
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>
          {isNewRole ? '确认添加' : '保存更改'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PermissionFormModal;

