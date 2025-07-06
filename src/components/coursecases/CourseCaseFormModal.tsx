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
  Stack
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VideocamIcon from '@mui/icons-material/Videocam';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { CourseCase, CourseCaseFile, CourseCaseFileFormat } from '../../types';
import { SUPPORTED_COURSE_FILE_FORMATS } from '../../constants';

interface CourseCaseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (courseCase: CourseCase) => void;
  courseCase: CourseCase | null;
  categories: string[];
}

const getFileFormat = (fileName: string): CourseCaseFileFormat => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf': return 'pdf';
    case 'mp4': return 'mp4';
    case 'avi': return 'avi';
    case 'pptx': return 'pptx';
    case 'docx': return 'docx';
    default: return 'other';
  }
};

const getFileIcon = (format: CourseCaseFileFormat) => {
  switch (format) {
    case 'pdf': return <PictureAsPdfIcon />;
    case 'mp4': case 'avi': return <VideocamIcon />;
    case 'pptx': case 'docx': return <DescriptionIcon />;
    default: return <InsertDriveFileIcon />;
  }
};

const CourseCaseFormModal: React.FC<CourseCaseFormModalProps> = ({ open, onClose, onSave, courseCase, categories }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [files, setFiles] = useState<CourseCaseFile[]>([]);
  const [selectedRawFiles, setSelectedRawFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (courseCase) {
      setTitle(courseCase.title);
      setDescription(courseCase.description);
      setCategory(courseCase.category);
      setFiles(courseCase.files.map(f => ({ ...f })));
    } else {
      setTitle('');
      setDescription('');
      setCategory(categories.length > 0 ? categories[0] : '');
      setFiles([]);
    }
    setSelectedRawFiles([]);
    setErrors({});
  }, [courseCase, open, categories]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newRawFilesArray = Array.from(e.target.files);
      setSelectedRawFiles(prev => [...prev, ...newRawFilesArray]);
      const newCourseCaseFiles: CourseCaseFile[] = newRawFilesArray.map(rawFile => ({
        id: `new-${rawFile.name}-${Date.now()}`,
        name: rawFile.name,
        format: getFileFormat(rawFile.name),
        url: '',
        size: `${(rawFile.size / (1024 * 1024)).toFixed(2)} MB`,
        fileObject: rawFile,
      }));
      setFiles(prev => [...prev, ...newCourseCaseFiles]);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (fileIdToRemove: string) => {
    const fileToRemove = files.find(f => f.id === fileIdToRemove);
    if (fileToRemove?.url && fileToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(fileToRemove.url);
    }
    setFiles(prevFiles => prevFiles.filter(file => file.id !== fileIdToRemove));
    setSelectedRawFiles(prevRaw => prevRaw.filter(rawFile => `new-${rawFile.name}-${Date.now()}` !== fileIdToRemove && rawFile.name !== fileToRemove?.name));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = '案例标题不能为空。';
    if (!category.trim()) newErrors.category = '请选择一个案例分类。';
    if (files.length === 0) newErrors.files = '请至少上传一个文件。';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const processedFiles = files.map(file => {
        if (file.fileObject && !file.url) {
          return { ...file, url: URL.createObjectURL(file.fileObject) };
        }
        return file;
      });

      const saveData: CourseCase = {
        id: courseCase?.id || `temp-id-${Date.now()}`,
        title,
        description,
        category,
        files: processedFiles,
        uploadDate: courseCase?.uploadDate || new Date().toISOString(),
      };
      onSave(saveData);
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
            name="title"
            label="案例标题"
            fullWidth
            variant="outlined"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title}
            required
          />
          <FormControl fullWidth variant="outlined" error={!!errors.category} required>
            <InputLabel id="case-category-label">案例分类</InputLabel>
            <Select
              labelId="case-category-label"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as string)}
              label="案例分类"
            >
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
            {errors.category && <FormHelperText>{errors.category}</FormHelperText>}
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
            {files.length > 0 && (
              <List dense sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 1 }}>
                {files.map((file) => (
                  <ListItem
                    key={file.id}
                    secondaryAction={
                      <IconButton edge="end" aria-label="delete file" onClick={() => handleRemoveFile(file.id)} color="error">
                        <DeleteIcon fontSize="small"/>
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
                      secondary={file.size || '未知大小'}
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