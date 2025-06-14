
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
  Box,
  Typography,
  Chip
} from '@mui/material';
import { ManagedImage } from '../../types';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface ImageFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (image: ManagedImage) => void;
  image: ManagedImage | null;
}

const ImageFormModal: React.FC<ImageFormModalProps> = ({ open, onClose, onSave, image }) => {
  const [formData, setFormData] = useState<Partial<ManagedImage>>({
    name: '',
    type: 'docker',
    version: '',
    description: '',
    fileName: '',
    size: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (image) {
      setFormData({
        id: image.id,
        name: image.name,
        type: image.type,
        version: image.version,
        description: image.description,
        fileName: image.fileName,
        size: image.size,
        uploadDate: image.uploadDate,
      });
      setSelectedFile(null); // Reset file if editing
    } else {
      setFormData({
        name: '',
        type: 'docker',
        version: '',
        description: '',
        fileName: '',
        size: '',
      });
      setSelectedFile(null);
    }
    setErrors({});
  }, [image, open]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target as { name?: string; value: string };
    if (name) {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    }
  };

  const handleFileTypeChange = (event: any) => { // Using 'any' for SelectChangeEvent for simplicity here
    const value = event.target.value as 'docker' | 'vm';
     setFormData(prev => ({ ...prev, type: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFormData(prev => ({ 
        ...prev, 
        fileName: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB` // Simulate size
      }));
      if (errors.file) {
        setErrors(prev => ({ ...prev, file: '' }));
      }
    } else {
      setSelectedFile(null);
       if (!image?.fileName) { // only clear if not editing an existing entry with a file
         setFormData(prev => ({ ...prev, fileName: '', size: '' }));
       }
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = '镜像名称不能为空。';
    if (!formData.version?.trim()) newErrors.version = '版本号不能为空。';
    if (!formData.type) newErrors.type = '请选择镜像类型。';
    // For new images, file is "required" (simulated)
    if (!image && !selectedFile) newErrors.file = '请上传一个镜像文件。'; 
    // For existing images, fileName should exist if no new file is selected
    if (image && !selectedFile && !formData.fileName) newErrors.file = '镜像文件信息丢失，请重新选择。';


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const saveData: ManagedImage = {
        id: image?.id || `temp-id-${Date.now()}`, // Placeholder ID for new images
        name: formData.name!,
        type: formData.type!,
        version: formData.version!,
        description: formData.description || '',
        fileName: formData.fileName,
        size: formData.size,
        uploadDate: image?.uploadDate || new Date().toISOString(), // Keep original or set new
      };
      onSave(saveData);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 2}}>
        {image ? '编辑镜像' : '添加新镜像'}
      </DialogTitle>
      <DialogContent sx={{ py: 3 }}>
        <TextField
          autoFocus
          margin="dense"
          name="name"
          label="镜像名称"
          type="text"
          fullWidth
          variant="outlined"
          value={formData.name}
          onChange={handleChange}
          error={!!errors.name}
          helperText={errors.name}
          required
        />
        <FormControl fullWidth margin="dense" variant="outlined" error={!!errors.type} required>
          <InputLabel id="image-type-label">镜像类型</InputLabel>
          <Select
            labelId="image-type-label"
            name="type"
            value={formData.type}
            onChange={handleFileTypeChange}
            label="镜像类型"
          >
            <MenuItem value="docker">Docker</MenuItem>
            <MenuItem value="vm">虚拟机 (VM)</MenuItem>
          </Select>
          {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
        </FormControl>
        <TextField
          margin="dense"
          name="version"
          label="版本号"
          type="text"
          fullWidth
          variant="outlined"
          value={formData.version}
          onChange={handleChange}
          error={!!errors.version}
          helperText={errors.version}
          required
        />
        <TextField
          margin="dense"
          name="description"
          label="描述 (可选)"
          type="text"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          value={formData.description}
          onChange={handleChange}
        />
        <Box mt={2} mb={1}>
            <Typography variant="subtitle2" color={errors.file ? "error" : "text.secondary"} gutterBottom>
                {image && !selectedFile ? "当前镜像文件:" : "上传镜像文件 (模拟):"}
            </Typography>
            {image && !selectedFile && formData.fileName && (
                 <Chip 
                    label={`${formData.fileName} (${formData.size || 'N/A'})`} 
                    size="small" 
                    sx={{ mr: 1, mb: 1, bgcolor: 'action.selected' }}
                />
            )}
             {selectedFile && (
                <Chip 
                    label={`${selectedFile.name} (${(selectedFile.size / (1024*1024)).toFixed(2)} MB)`} 
                    onDelete={() => {
                      setSelectedFile(null);
                      if (!image?.fileName) { // if new image, clear fields
                         setFormData(prev => ({ ...prev, fileName: '', size: '' }));
                      } else { // if editing, revert to original file info
                         setFormData(prev => ({...prev, fileName: image.fileName, size: image.size}));
                      }
                    }}
                    color="primary" 
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                />
            )}
            <Button
                variant="outlined"
                component="label"
                size="small"
                startIcon={<CloudUploadIcon />}
                sx={{ textTransform: 'none' }}
                color={errors.file ? "error" : "primary"}
            >
                {selectedFile || (image && formData.fileName) ? "更改文件" : "选择文件"}
                <input type="file" hidden onChange={handleFileChange} />
            </Button>
            {errors.file && <FormHelperText error sx={{ml:1}}>{errors.file}</FormHelperText>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, borderTop: 1, borderColor: 'divider', pt:2 }}>
        <Button onClick={onClose} color="secondary" variant="outlined">取消</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {image ? '保存更改' : '确认添加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageFormModal;
