import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  Stack,
  FormHelperText
} from '@mui/material';
import useMediaQuery  from '@mui/material/useMediaQuery'; 
import { useTheme } from '@mui/material/styles';

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (categoryName: string) => void;
  categories: { category_id: number; category_name: string }[];
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({ open, onClose, onSave, categories }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [category_name, setCategoryName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setCategoryName('');
      setErrors({});
    }
  }, [open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!category_name.trim()) {
      newErrors.category_name = '分类名称不能为空。';
    } else if (categories.some(c => c.category_name.toLowerCase() === category_name.trim().toLowerCase())) {
      newErrors.category_name = '该分类名称已存在。';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(category_name);
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
      <DialogTitle>添加新分类</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            autoFocus
            name="category_name"
            label="分类名称"
            fullWidth
            variant="outlined"
            value={category_name}
            onChange={(e) => setCategoryName(e.target.value)}
            error={!!errors.category_name}
            helperText={errors.category_name}
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button type="submit" variant="contained">
          确认添加
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryFormModal;