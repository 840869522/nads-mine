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
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VideocamIcon from '@mui/icons-material/Videocam';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { CourseCase, CourseCaseFile } from '../../types';
import { SUPPORTED_COURSE_FILE_FORMATS } from '../../constants';

interface CourseCaseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (courseCase: CourseCase) => void;
  courseCase: CourseCase | null;
  categories: { category_id: number; category_name: string }[];
}

const getFileFormat = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf': return 'pdf';
    case 'pptx': return 'pptx';
    case 'docx': return 'docx';
    case 'mp4': return 'mp4';
    case 'avi': return 'avi';
    case 'png': case 'jpg': case 'jpeg': case 'gif': return 'image';
    default: return 'other';
  }
};

const getFileIcon = (format: string) => {
  switch (format) {
    case 'pdf': return <PictureAsPdfIcon />;
    case 'mp4': case 'avi': return <VideocamIcon />;
    case 'pptx': case 'docx': return <DescriptionIcon />;
    case 'image': return <InsertDriveFileIcon />;
    default: return <InsertDriveFileIcon />;
  }
};

const CourseCaseFormModal: React.FC<CourseCaseFormModalProps> = ({ open, onClose, onSave, courseCase, categories }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [course_name, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [category_id, setCategoryId] = useState<number | ''>('');
  const [resources, setResources] = useState<CourseCaseFile[]>([]);
  const [selectedRawFiles, setSelectedRawFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (courseCase) {
      setCourseName(courseCase.course_name);
      setDescription(courseCase.description || '');
      setCategoryId(courseCase.category.category_id);
      setResources(courseCase.resources.map(f => ({ ...f })));
    } else {
      setCourseName('');
      setDescription('');
      setCategoryId(categories.length > 0 ? categories[0].category_id : '');
      setResources([]);
    }
    setSelectedRawFiles([]);
    setErrors({});
  }, [courseCase, open, categories]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newRawFilesArray = Array.from(e.target.files);
      const validFiles = newRawFilesArray.filter(file => {
        const format = getFileFormat(file.name);
        if (!SUPPORTED_COURSE_FILE_FORMATS.includes(format)) return false;
        if (file.size > 10 * 1024 * 1024) return false; // Max 10MB
        return true;
      });
      if (validFiles.length < newRawFilesArray.length) {
        setErrors(prev => ({ ...prev, files: '某些文件格式不支持或超过10MB' }));
      }
      setSelectedRawFiles(prev => [...prev, ...validFiles]);
      const newResources: CourseCaseFile[] = validFiles.map(rawFile => ({
        id: `new-${rawFile.name}-${Date.now()}`,
        name: rawFile.name,
        format: getFileFormat(rawFile.name),
        size: rawFile.size,
        fileObject: rawFile,
      }));
      setResources(prev => [...prev, ...newResources]);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (fileIdToRemove: string) => {
    setResources(prev => prev.filter(file => file.id !== fileIdToRemove));
    setSelectedRawFiles(prev => prev.filter(rawFile => `new-${rawFile.name}-${Date.now()}` !== fileIdToRemove));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!course_name.trim()) newErrors.course_name = '案例标题不能为空。';
    if (!category_id) newErrors.category_id = '请选择一个案例分类。';
    if (resources.length === 0) newErrors.files = '请至少上传一个文件。';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const saveData: CourseCase = {
        course_id: courseCase?.course_id || 0,
        course_name,
        description,
        category: categories.find(c => c.category_id === category_id) || { category_id: 0, category_name: '' },
        resources,
        created_at: courseCase?.created_at || new Date().toISOString(),
      };
      onSave(saveData);
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
      PaperProps={{ component: 'form', onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); handleSubmit(); }, sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        {courseCase ? '编辑课程案例' : '添加新课程案例'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            autoFocus
            name="course_name"
            label="案例标题"
            fullWidth
            variant="outlined"
            value={course_name}
            onChange={(e) => setCourseName(e.target.value)}
            error={!!errors.course_name}
            helperText={errors.course_name}
            required
          />
          <FormControl fullWidth variant="outlined" error={!!errors.category_id} required>
            <InputLabel id="case-category-label">案例分类</InputLabel>
            <Select
              labelId="case-category-label"
              name="category_id"
              value={category_id}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              label="案例分类"
            >
              {categories.map(cat => (
                <MenuItem key={cat.category_id} value={cat.category_id}>{cat.category_name}</MenuItem>
              ))}
            </Select>
            {errors.category_id && <FormHelperText>{errors.category_id}</FormHelperText>}
          </FormControl>
          <TextField
            name="description"
            label="案例描述 (可选)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Box mt={1}>
            <Typography variant="subtitle1" gutterBottom color={errors.files ? "error" : "text.primary"}>
              案例文件
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              sx={{ mb: 1 }}
            >
              选择文件上传
              <input
                type="file"
                hidden
                multiple
                onChange={handleFileChange}
                accept={Object.values(SUPPORTED_COURSE_FILE_FORMATS).join(',')}
              />
            </Button>
            {errors.files && <FormHelperText error>{errors.files}</FormHelperText>}
            {resources.length > 0 && (
              <List dense sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 1 }}>
                {resources.map((file) => (
                  <ListItem
                    key={file.id}
                    secondaryAction={
                      <IconButton edge="end" aria-label="delete file" onClick={() => handleRemoveFile(file.id)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                    sx={{ borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getFileIcon(file.format)}
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      primaryTypographyProps={{ variant: 'body2', noWrap: true, maxWidth: 'calc(100% - 50px)' }}
                      secondary={`${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>取消</Button>
        <Button type="submit" variant="contained">
          {courseCase ? '保存更改' : '确认添加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CourseCaseFormModal;