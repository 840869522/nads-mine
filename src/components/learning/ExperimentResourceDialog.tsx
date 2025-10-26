import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Avatar,
  DialogContentText
} from '@mui/material';
import {
  PictureAsPdf as PictureAsPdfIcon,
  Videocam as VideocamIcon,
  Description as DescriptionIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { apiClientWithToken } from '../../utils/axios';

interface ExperimentResource {
  c_resource_id: string;
  c_resource_name: string;
  c_type: string;
  c_size: number;
  c_resource_path: string;
  c_experiment_id: string;
  c_course_id: string;
  created_at?: string;
}

interface ExperimentResourceDialogProps {
  open: boolean;
  onClose: () => void;
  experimentId: string;
  experimentName: string;
  courseId: string;
  onShowMessage?: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
  hideDeleteButton?: boolean; // 新增：控制是否隐藏删除按钮
}

const ExperimentResourceDialog: React.FC<ExperimentResourceDialogProps> = ({
  open,
  onClose,
  experimentId,
  experimentName,
  courseId,
  onShowMessage,
  hideDeleteButton = false
}) => {
  const [resources, setResources] = useState<ExperimentResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewResource, setPreviewResource] = useState<ExperimentResource | null>(null);

  // 使用父组件提供的消息显示函数
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    if (onShowMessage) {
      onShowMessage(message, severity);
    } else {
      // 降级方案：使用alert
      alert(`${severity.toUpperCase()}: ${message}`);
    }
  };

  // 获取资源列表
  const fetchResources = async () => {
    if (!experimentId) return;
    
    setLoading(true);
    try {
      const response = await apiClientWithToken.get(`/back/api/study/experiments/${experimentId}/resources`);
      if (response.data.code === 200) {
        setResources(response.data.data.resources || []);
      } else {
        showSnackbar('获取资源列表失败: ' + response.data.message, 'error');
      }
    } catch (error) {
      showSnackbar('获取资源列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 删除资源
  const handleDeleteResource = async (resource: ExperimentResource) => {
    setLoadingDelete(resource.c_resource_id);
    try {
      const response = await apiClientWithToken.delete(
        `/back/api/study/experiments/${experimentId}/resources/${resource.c_resource_id}`
      );
      
      if (response.data.code === 200) {
        showSnackbar('资源删除成功');
        setResources(prev => prev.filter(r => r.c_resource_id !== resource.c_resource_id));
      } else {
        showSnackbar('删除资源失败: ' + response.data.message, 'error');
      }
    } catch (error) {
      showSnackbar('删除资源失败', 'error');
    } finally {
      setLoadingDelete(null);
    }
  };

  // 下载资源
  const handleDownloadResource = (resource: ExperimentResource) => {
    const downloadUrl = `/back/api/study/experiment-resources/${resource.c_resource_id}?disposition=attachment`;
    window.open(downloadUrl, '_blank');
  };

  // 预览资源
  const handlePreviewResource = (resource: ExperimentResource) => {
    setPreviewResource(resource);
    setPreviewOpen(true);
  };

  // 获取文件图标
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <PictureAsPdfIcon sx={{ color: '#d32f2f' }} />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <VideocamIcon sx={{ color: '#1976d2' }} />;
      case 'doc':
      case 'docx':
        return <DescriptionIcon sx={{ color: '#2e7d32' }} />;
      case 'ppt':
      case 'pptx':
        return <DescriptionIcon sx={{ color: '#ff6f00' }} />;
      default:
        return <InsertDriveFileIcon sx={{ color: '#757575' }} />;
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 判断是否可以预览
  const canPreview = (type: string) => {
    const previewTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'avi', 'doc', 'docx', 'ppt', 'pptx', 'txt'];
    return previewTypes.includes(type.toLowerCase());
  };

  useEffect(() => {
    if (open) {
      fetchResources();
    }
  }, [open, experimentId]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          实验资源管理 - {experimentName}
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : resources.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" p={4}>
              <InsertDriveFileIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                暂无实验资源
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {resources.map((resource) => (
                <Grid item xs={12} sm={6} md={4} key={resource.c_resource_id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <Avatar sx={{ mr: 1, bgcolor: 'transparent' }}>
                          {getFileIcon(resource.c_type)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle2" noWrap title={resource.c_resource_name}>
                            {resource.c_resource_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(resource.c_size)}
                          </Typography>
                        </Box>
                      </Box>
                      <Chip 
                        label={resource.c_type.toUpperCase()} 
                        size="small" 
                        variant="outlined"
                        sx={{ mt: 1 }}
                      />
                    </CardContent>
                    <CardActions sx={{ pt: 0, justifyContent: 'space-between' }}>
                      <Box>
                        {canPreview(resource.c_type) && (
                          <IconButton
                            size="small"
                            onClick={() => handlePreviewResource(resource)}
                            title="预览"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadResource(resource)}
                          title="下载"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                      {!hideDeleteButton && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteResource(resource)}
                            disabled={loadingDelete === resource.c_resource_id}
                            color="error"
                            title="删除"
                          >
                            {loadingDelete === resource.c_resource_id ? (
                              <CircularProgress size={20} />
                            ) : (
                              <DeleteIcon />
                            )}
                          </IconButton>
                        )}
                      </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose} color="primary">
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 资源预览对话框 */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          预览 - {previewResource?.c_resource_name}
          <IconButton
            aria-label="close"
            onClick={() => setPreviewOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {previewResource && (
            <Box sx={{ width: '100%', height: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {previewResource.c_type.toLowerCase() === 'pdf' ? (
                <iframe
                  src={`/back/api/study/experiment-resources/${previewResource.c_resource_id}?disposition=inline`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  title={previewResource.c_resource_name}
                />
              ) : ['jpg', 'jpeg', 'png', 'gif'].includes(previewResource.c_type.toLowerCase()) ? (
                <img
                  src={`/back/api/study/experiment-resources/${previewResource.c_resource_id}?disposition=inline`}
                  alt={previewResource.c_resource_name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : ['mp4', 'avi', 'mov'].includes(previewResource.c_type.toLowerCase()) ? (
                <video
                  controls
                  width="100%"
                  height="100%"
                  style={{ objectFit: 'contain' }}
                >
                  <source
                    src={`/back/api/study/experiment-resources/${previewResource.c_resource_id}?disposition=inline`}
                    type={`video/${previewResource.c_type.toLowerCase()}`}
                  />
                  您的浏览器不支持视频播放。
                </video>
              ) : ['doc', 'docx', 'ppt', 'pptx'].includes(previewResource.c_type.toLowerCase()) ? (
                <iframe
                  src={`/back/api/study/experiment-resources/${previewResource.c_resource_id}/office-preview`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  title={previewResource.c_resource_name}
                  onLoad={(e) => {
                    // 检测加载状态
                    const iframe = e.target as HTMLIFrameElement;
                    iframe.style.opacity = '1';
                  }}
                  onError={(e) => {
                  }}
                />
              ) : previewResource.c_type.toLowerCase() === 'txt' ? (
                <iframe
                  src={`/back/api/study/experiment-resources/${previewResource.c_resource_id}?disposition=inline`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none', backgroundColor: 'white' }}
                  title={previewResource.c_resource_name}
                />
              ) : (
                <Box textAlign="center">
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    无法预览此文件类型
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    请下载后查看
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>关闭</Button>
          <Button
            variant="contained"
            onClick={() => previewResource && handleDownloadResource(previewResource)}
          >
            下载
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ExperimentResourceDialog;