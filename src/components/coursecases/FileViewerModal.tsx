import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { CourseCaseFile } from '../../types';

interface FileViewerModalProps {
  open: boolean;
  onClose: () => void;
  file: CourseCaseFile | null;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({ open, onClose, file }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && file?.url) {
      setIsLoading(true);
      setError(null);
      fetch(file.url)
        .then(res => {
          if (!res.ok) throw new Error('无法加载文件');
          setIsLoading(false);
        })
        .catch(() => {
          setError('无法加载文件，请检查文件是否存在');
          setIsLoading(false);
        });
    }
  }, [open, file]);

  if (!file) return null;

  const renderFileContent = () => {
    if (isLoading) {
      return <Typography sx={{ p: 3 }}>加载中...</Typography>;
    }
    if (error) {
      return <Typography color="error" sx={{ p: 3 }}>{error}</Typography>;
    }
    if (!file.url) {
      return <Typography color="error" sx={{ p: 3 }}>文件URL无效或丢失，无法预览。</Typography>;
    }
    switch (file.format) {
      case 'pdf':
        return (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              查看 PDF 文档
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              由于浏览器安全设置，PDF 文件可能无法在此直接显示。请点击下方按钮在新标签页中打开查看。
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              文件名: {file.name} | 大小: {(file.size / (1024 * 1024)).toFixed(2)} MB
            </Typography>
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 2 }}
            >
              在新标签页中打开 PDF
            </Button>
          </Box>
        );
      case 'mp4':
      case 'avi':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2, bgcolor: 'common.black' }}>
            <video
              controls
              autoPlay
              src={file.url}
              style={{ maxWidth: '100%', maxHeight: '70vh', outline: 'none' }}
              onError={(e) => setError('视频播放失败')}
            >
              您的浏览器不支持视频标签。
              {file.format === 'avi' && (
                <Typography variant="caption" color="warning.main" display="block" mt={1}>
                  .avi 格式可能无法在所有浏览器中直接播放。
                </Typography>
              )}
            </video>
          </Box>
        );
      case 'image':
        return (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <img
              src={file.url}
              alt={file.name}
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              onError={() => setError('图片加载失败')}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              文件名: {file.name} | 大小: {(file.size / (1024 * 1024)).toFixed(2)} MB
            </Typography>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              href={file.url}
              download={file.name}
              sx={{ mt: 2 }}
            >
              下载图片
            </Button>
          </Box>
        );
      case 'pptx':
      case 'docx':
      case 'other':
        return (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              不支持直接预览此文件格式。
            </Typography>
            <Typography variant="body1" gutterBottom>
              文件名: {file.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              大小: {(file.size / (1024 * 1024)).toFixed(2)} MB
            </Typography>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              href={file.url}
              download={file.name}
              sx={{ mt: 2 }}
              target="_blank"
              rel="noopener noreferrer"
            >
              下载文件
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
              提示：如果下载未开始，请尝试右键点击按钮并选择“链接另存为...”。
            </Typography>
          </Box>
        );
      default:
        return <Typography sx={{ p: 3 }}>未知或不支持的文件格式。</Typography>;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={file.format === 'mp4' || file.format === 'avi' ? 'lg' : 'md'}
      fullWidth
      PaperProps={{ sx: { minHeight: file.format === 'mp4' || file.format === 'avi' ? '70vh' : 'auto', maxHeight: '90vh', display: 'flex', flexDirection: 'column' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="span" noWrap sx={{ maxWidth: 'calc(100% - 48px)' }}>
          {file.name}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: (file.format === 'mp4' || file.format === 'avi' ? 0 : 2), flexGrow: 1, overflowY: 'auto' }}>
        {renderFileContent()}
      </DialogContent>
      {(file.format !== 'mp4' && file.format !== 'avi') && (
        <DialogActions sx={{ borderTop: 1, borderColor: 'divider', p: 2 }}>
          <Button onClick={onClose} variant="outlined">关闭</Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default FileViewerModal;