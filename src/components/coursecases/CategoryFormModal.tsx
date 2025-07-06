import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Stack
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (category: { id?: string; name: string }) => void;
  category: { id: string; name: string } | null;
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({ open, onClose, onSave, category }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setName(category.name);
    } else {
      setName('');
    }
    setErrors({});
  }, [category, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = '类别名称不能为空。';
    if (name.length > 50) newErrors.name = '类别名称不能超过50个字符。';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const saveData = {
        id: category?.id,
        name: name.trim(),
      };
      onSave(saveData);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      PaperProps={{ component: 'form', onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); handleSubmit(); }, sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        {category ? '编辑类别' : '添加新类别'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            autoFocus
            name="name"
            label="类别名称"
            fullWidth
            variant="outlined"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button type="submit" variant="contained">
          {category ? '保存更改' : '确认添加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryFormModal;