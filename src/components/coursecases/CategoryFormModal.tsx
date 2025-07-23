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
import { Category } from '../../types';

interface CategoryFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (category: Category) => void;
  category: Category | null;
}

const CategoryFormModal: React.FC<CategoryFormModalProps> = ({ open, onClose, onSave, category }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [c_category_name, setCategoryName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category) {
      setCategoryName(category.c_category_name);
    } else {
      setCategoryName('');
    }
    setErrors({});
  }, [category, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!c_category_name.trim()) newErrors.c_category_name = '类别名称不能为空。';
    if (c_category_name.length > 50) newErrors.c_category_name = '类别名称不能超过50个字符。';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const saveData: Category = {
        c_category_id: category?.c_category_id,
        c_category_name: c_category_name.trim(),
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
                name="c_category_name"
                label="类别名称"
                fullWidth
                variant="outlined"
                value={c_category_name}
                onChange={(e) => setCategoryName(e.target.value)}
                error={!!errors.c_category_name}
                helperText={errors.c_category_name}
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