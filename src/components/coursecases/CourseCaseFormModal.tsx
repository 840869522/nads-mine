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
import { Category, CourseCase, CourseCaseResource, CourseCaseResourceFormat } from '../../types';
import { SUPPORTED_COURSE_RESOURCE_FORMATS } from '../../constants';

interface CourseCaseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (courseCase: CourseCase) => void;
  courseCase: CourseCase | null;
  categories: Category[];
}

const getResourceFormat = (fileName: string): CourseCaseResourceFormat => {
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

const getResourceIcon = (format: CourseCaseResourceFormat) => {
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
  const [c_course_name, setCourseName] = useState('');
  const [c_description, setDescription] = useState('');
  const [c_category_id, setCategoryId] = useState<string>('');
  const [resources, setResources] = useState<CourseCaseResource[]>([]);
  const [selectedRawFiles, setSelectedRawFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [c_status, setStatus] = useState<'draft' | 'published'>('published');

  useEffect(() => {
    resources.forEach(resource => {
      if (resource.c_resource_path && resource.c_resource_path.startsWith('blob:') && resource.fileObject) {
        URL.revokeObjectURL(resource.c_resource_path);
      }
    });

    if (courseCase) {
      setCourseName(courseCase.c_course_name || '');
      setDescription(courseCase.c_description || '');
      setCategoryId(courseCase.c_category_id ?? '');
      setResources(courseCase.resources.map(r => ({ ...r })));
      setStatus(courseCase.c_status || 'published'); // 确保从数据库加载状态
    } else {
      setCourseName('');
      setDescription('');
      setCategoryId(categories.length > 0 && categories[0].c_category_id ? categories[0].c_category_id : '');
      setResources([]);
      setStatus('published');  // 默认发布
    }
    setSelectedRawFiles([]);
    setErrors({});
    return () => {
      resources.forEach(resource => {
        if (resource.c_resource_path && resource.c_resource_path.startsWith('blob:') && resource.fileObject) {
          URL.revokeObjectURL(resource.c_resource_path);
        }
      });
    };
  }, [courseCase, open, categories]);

  useEffect(() => {
    // 仅在新增模式下（courseCase 为 null）或 c_category_id 无效时重置
    if (!courseCase && categories.length > 0 && !categories.some(cat => cat.c_category_id === c_category_id)) {
      setCategoryId(categories[0].c_category_id || '');
    }
  }, [categories, c_category_id, courseCase]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newRawFilesArray = Array.from(e.target.files);
      setSelectedRawFiles(prev => [...prev, ...newRawFilesArray]);
      const newCourseCaseResources: CourseCaseResource[] = newRawFilesArray.map(rawFile => ({
        c_resource_id: `new-${rawFile.name}-${Date.now()}`,
        c_resource_name: rawFile.name,
        c_type: getResourceFormat(rawFile.name),
        c_resource_path: '',
        c_size: `${(rawFile.size / (1024 * 1024)).toFixed(2)} MB`,
        fileObject: rawFile,
      }));
      setResources(prev => [...prev, ...newCourseCaseResources]);
      e.target.value = '';
    }
  };

  const handleRemoveResource = (resourceIdToRemove: string) => {
    const resourceToRemove = resources.find(r => r.c_resource_id === resourceIdToRemove);
    if (resourceToRemove?.c_resource_path && resourceToRemove.c_resource_path.startsWith('blob:')) {
      URL.revokeObjectURL(resourceToRemove.c_resource_path);
    }
    setResources(prevResources => prevResources.filter(resource => resource.c_resource_id !== resourceIdToRemove));
    setSelectedRawFiles(prevRaw => prevRaw.filter(rawFile => `new-${rawFile.name}-${Date.now()}` !== resourceIdToRemove && rawFile.name !== resourceToRemove?.c_resource_name));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!c_course_name.trim()) newErrors.c_course_name = '课程标题不能为空。';
    if (!c_category_id && categories.length > 0) newErrors.c_category_id = '请选择一个课程分类。';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      const processedResources = resources.map(resource => {
        if (resource.fileObject && !resource.c_resource_path) {
          return { ...resource, c_resource_path: URL.createObjectURL(resource.fileObject) };
        }
        return resource;
      });

      const saveData: CourseCase = {
        c_course_id: courseCase?.c_course_id || `temp-id-${Date.now()}`,
        c_course_name,
        c_description,
        c_status,  // 新增
        c_category_id: c_category_id ?? '',
        c_category_name: categories.find(cat => cat.c_category_id === c_category_id)?.c_category_name || '',
        resources: processedResources,
        created_at: courseCase?.created_at || new Date().toISOString(),
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
          {courseCase ? '编辑课程' : '添加新课程'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
                autoFocus
                name="c_course_name"
                label="课程标题"
                fullWidth
                variant="outlined"
                value={c_course_name}
                onChange={(e) => setCourseName(e.target.value)}
                error={!!errors.c_course_name}
                helperText={errors.c_course_name}
                required
            />
            <FormControl fullWidth variant="outlined" error={!!errors.c_category_id} required={categories.length > 0}>
              <InputLabel id="course-category-label">课程分类</InputLabel>
              <Select
                  labelId="course-category-label"
                  name="c_category_id"
                  value={c_category_id ?? ''}
                  onChange={(e) => setCategoryId(e.target.value as string)}
                  label="课程分类"
                  disabled={categories.length === 0}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 250, // 设置最大高度
                      },
                    },
                  }}
              >
                {categories.length === 0 ? (
                    <MenuItem value="" disabled>
                      无可用分类
                    </MenuItem>
                ) : (
                    [
                      <MenuItem key="placeholder" value="" disabled>
                        请选择分类
                      </MenuItem>,
                      ...categories
                          .filter(cat => cat.c_category_id)
                          .map(cat => (
                              <MenuItem key={cat.c_category_id} value={cat.c_category_id}>
                                {cat.c_category_name}
                              </MenuItem>
                          ))
                    ]
                )}
              </Select>
              {errors.c_category_id && <FormHelperText>{errors.c_category_id}</FormHelperText>}
              {categories.length === 0 && (
                  <FormHelperText>请先添加分类</FormHelperText>
              )}
            </FormControl>
            <TextField
                name="c_description"
                label="课程描述 (可选)"
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                value={c_description}
                onChange={(e) => setDescription(e.target.value)}
            />
            <FormControl fullWidth variant="outlined" sx={{ mt: 1 }}>
              <InputLabel id="course-status-label">课程状态（可选，默认发布）</InputLabel>
              <Select
                  labelId="course-status-label"
                  name="c_status"
                  value={c_status}
                  onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                  label="课程状态（可选，默认发布）"
              >
                <MenuItem value="published">发布</MenuItem>
                <MenuItem value="draft">草稿</MenuItem>
              </Select>
            </FormControl>
            <Box mt={1}>
              <Typography variant="subtitle1" gutterBottom color="text.primary">
                课程资源（可选）
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
                    accept={Object.values(SUPPORTED_COURSE_RESOURCE_FORMATS).filter(ext => ext !== '*/*').join(',')}
                />
              </Button>
              {resources.length > 0 && (
                  <List dense sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 1 }}>
                    {resources.map((resource) => (
                        <ListItem
                            key={resource.c_resource_id}
                            secondaryAction={
                              <IconButton edge="end" aria-label="delete resource" onClick={() => handleRemoveResource(resource.c_resource_id)} color="error">
                                <DeleteIcon fontSize="small"/>
                              </IconButton>
                            }
                            sx={{ borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {getResourceIcon(resource.c_type)}
                          </ListItemIcon>
                          <ListItemText
                              primary={resource.c_resource_name}
                              primaryTypographyProps={{ variant: 'body2', noWrap: true, maxWidth: 'calc(100% - 50px)' }}
                              secondary={resource.c_size || '未知大小'}
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
          <Button type="submit" variant="contained" disabled={categories.length === 0 && !c_category_id}>
            {courseCase ? '保存更改' : '确认添加'}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

export default CourseCaseFormModal;