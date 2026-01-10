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
  CircularProgress,
  Chip,
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
  isSaving?: boolean;
}

// 文件大小限制常量
const MAX_SINGLE_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

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

// 添加辅助函数来格式化字节大小
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CourseCaseFormModal: React.FC<CourseCaseFormModalProps> = ({ open, onClose, onSave, courseCase, categories,isSaving = false }) => {
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
      
      // 计算当前已上传文件的总大小
      const currentTotalSize = resources.reduce((total, resource) => {
        if (resource.fileObject) {
          return total + resource.fileObject.size;
        }
        return total;
      }, 0);
      
      // 检查单个文件大小和总大小
      const validFiles: File[] = [];
      const oversizedFiles: string[] = [];
      let totalNewSize = 0;
      
      Array.from(e.target.files).forEach(file => {
        if (file.size > MAX_SINGLE_FILE_SIZE) {
          oversizedFiles.push(file.name);
        } else {
          validFiles.push(file);
          totalNewSize += file.size;
        }
      });
      
      // 检查总大小是否超过限制
      if (currentTotalSize + totalNewSize > MAX_TOTAL_SIZE) {
        alert(`上传总大小超过2GB限制！\n当前已上传：${formatBytes(currentTotalSize)}\n本次上传：${formatBytes(totalNewSize)}\n请减少文件数量或压缩文件大小。`);
        e.target.value = '';
        return;
      }
      
      // 如果有超大文件，提示用户
      if (oversizedFiles.length > 0) {
        alert(`以下文件超过200MB限制，将不会被上传：\n${oversizedFiles.join(', ')}\n\n请压缩文件或联系管理员调整服务器限制。`);
      }
      
      // 只添加有效文件
      const newCourseCaseResources: CourseCaseResource[] = validFiles.map(rawFile => ({
        c_resource_id: `new-${rawFile.name}-${Date.now()}`,
        c_resource_name: rawFile.name,
        c_type: getResourceFormat(rawFile.name),
        c_resource_path: '',
        c_size: `${(rawFile.size / (1024 * 1024)).toFixed(2)} MB`,
        fileObject: rawFile,
      }));
      
      setResources(prev => [...prev, ...newCourseCaseResources]);
      setSelectedRawFiles(prev => [...prev, ...validFiles]);
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
    
    // 新增文件大小验证
    const totalSize = resources.reduce((total, resource) => 
      total + (resource.fileObject?.size || 0), 0
    );
    
    if (totalSize > MAX_TOTAL_SIZE) {
      newErrors.resources = `总文件大小超过2GB限制（当前：${(totalSize / (1024 * 1024 * 1024)).toFixed(2)}GB）`;
    }
    
    // 检查是否有超大的单个文件
    const oversizedFiles = resources.filter(resource => 
      resource.fileObject && resource.fileObject.size > MAX_SINGLE_FILE_SIZE
    );
    
    if (oversizedFiles.length > 0) {
      newErrors.resources = `以下文件超过200MB限制：${oversizedFiles.map(f => f.c_resource_name).join(', ')}`;
    }
    
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
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  单个文件最大200MB，总大小不超过2GB
                </Typography>
              </Typography>
              
              <Box sx={{ mb: 2 }}>
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
                
                {/* 显示当前总大小信息 */}
                {resources.length > 0 && (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mb: 1,
                    p: 1,
                    backgroundColor: theme.palette.mode === 'dark' 
                      ? theme.palette.grey[800] 
                      : theme.palette.grey[50],
                    borderRadius: '4px'
                  }}>
                    <Typography 
                      variant="body2" 
                      color={
                        resources.reduce((total, resource) => 
                          total + (resource.fileObject?.size || 0), 0) > MAX_TOTAL_SIZE 
                          ? 'error' 
                          : 'primary'
                      }
                    >
                      <strong>已选择 {resources.length} 个文件</strong>
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color={
                        resources.reduce((total, resource) => 
                          total + (resource.fileObject?.size || 0), 0) > MAX_TOTAL_SIZE 
                          ? 'error' 
                          : 'primary'
                      }
                    >
                      总大小: {
                        (resources.reduce((total, resource) => 
                          total + (resource.fileObject?.size || 0), 0) / (1024 * 1024 * 1024)
                        ).toFixed(2)
                      } GB
                    </Typography>
                  </Box>
                )}
                
                {/* 显示剩余空间警告 */}
                {resources.length > 0 && (
                  <Typography 
                    variant="caption" 
                    color={
                      resources.reduce((total, resource) => 
                        total + (resource.fileObject?.size || 0), 0) > MAX_TOTAL_SIZE 
                        ? 'error' 
                        : 'text.secondary'
                    }
                    sx={{ display: 'block', mb: 1 }}
                  >
                    剩余可用空间: {
                      formatBytes(
                        Math.max(0, MAX_TOTAL_SIZE - resources.reduce((total, resource) => 
                          total + (resource.fileObject?.size || 0), 0)
                        )
                      )
                    }
                    {resources.reduce((total, resource) => 
                      total + (resource.fileObject?.size || 0), 0) > MAX_TOTAL_SIZE && 
                      ' (已超出限制，请删除部分文件)'
                    }
                  </Typography>
                )}
              </Box>
              
              {resources.length > 0 && (
                <List dense sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 1 }}>
                  {resources.map((resource) => {
                    const fileSize = resource.fileObject?.size || 0;
                    const isOversized = fileSize > MAX_SINGLE_FILE_SIZE;
                    
                    return (
                     <ListItem
                            key={resource.c_resource_id}
                            secondaryAction={
                              <IconButton edge="end" aria-label="delete resource" onClick={() => handleRemoveResource(resource.c_resource_id)} color="error">
                                <DeleteIcon fontSize="small"/>
                              </IconButton>
                            }
                            sx={{ 
                              borderBottom: 1, 
                              borderColor: 'divider', 
                              '&:last-child': { borderBottom: 0 },
                              bgcolor: isOversized ? 'error.lighter' : 'inherit'
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              {getResourceIcon(resource.c_type)}
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography 
                                    component="span" 
                                    variant="body2" 
                                    noWrap 
                                    sx={{ 
                                      flex: 1,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      color: isOversized ? 'error.main' : 'text.primary'
                                    }}
                                  >
                                    {resource.c_resource_name}
                                  </Typography>
                                  {isOversized && (
                                    <Chip 
                                      label="超限" 
                                      size="small" 
                                      color="error" 
                                      sx={{ ml: 1, height: 20, fontSize: '0.6rem' }}
                                    />
                                  )}
                                </Box>
                              }
                              secondary={resource.c_size || '未知大小'}
                              secondaryTypographyProps={{ 
                                component: 'span',
                                variant: 'caption',
                                color: isOversized ? 'error.main' : 'text.secondary'
                              }}
                            />
                          </ListItem>
                    );
                  })}
                </List>
              )}
              {errors.resources && (
                <FormHelperText error sx={{ mt: 1 }}>
                  {errors.resources}
                </FormHelperText>
              )}
            </Box>
          </Stack>
        </DialogContent>
      <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={onClose} 
            color="inherit"
            disabled={isSaving} // 保存时禁用取消按钮
          >
            取消
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary"
            disabled={isSaving || !c_course_name.trim() || !c_category_id} // 修改这里：使用 c_course_name 和 c_category_id
            startIcon={isSaving ? <CircularProgress size={20} /> : null} // 添加加载图标
          >
            {isSaving 
              ? (courseCase ? '更新中...' : '添加中...') 
              : (courseCase ? '保存更改' : '确认添加')}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

export default CourseCaseFormModal;