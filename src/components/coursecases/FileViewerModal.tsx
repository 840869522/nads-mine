import React from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography,
  Box
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { CourseCaseFile } from '../../types';

interface FileViewerModalProps {
  open: boolean;
  onClose: () => void;
  file: CourseCaseFile;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({ open, onClose, file }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const renderFilePreview = () => {
    if (file.format === 'pdf') {
      return (
        <Box sx={{ width: '100%', height: '60vh' }}>
          <iframe
            src={file.url}
            title={file.name}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </Box>
      );
    } else if (['mp4', 'avi'].includes(file.format)) {
      return (
        <Box sx={{ width: '100%', maxHeight: '60vh' }}>
          <video controls style={{ width: '100%', maxHeight: '100%' }}>
            <source src={file.url} type={`video/${file.format}`} />
            您的浏览器不支持视频播放。
          </video>
        </Box>
      );
    } else {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            不支持预览 {file.format} 格式的文件
          </Typography>
          <Button
            variant="contained"
            href={file.url}
            download={file.name}
            sx={{ mt: 2 }}
          >
            下载文件
          </Button>
        </Box>
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        {file.name}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            文件大小: {file.size || '未知'}
          </Typography>
          {renderFilePreview()}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileViewerModal;