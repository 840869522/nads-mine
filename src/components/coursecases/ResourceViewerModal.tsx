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
import { CourseCaseResource } from '../../types';

interface ResourceViewerModalProps {
    open: boolean;
    onClose: () => void;
    resource: CourseCaseResource | null; // 允许 null
}

const ResourceViewerModal: React.FC<ResourceViewerModalProps> = ({ open, onClose, resource }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const renderResourcePreview = () => {
        if (!resource || !resource.c_resource_path) {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                        无法加载资源
                    </Typography>
                </Box>
            );
        }
        if (resource.c_type === 'pdf') {
            return (
                <Box sx={{ width: '100%', height: '60vh' }}>
                    <iframe
                        src={resource.c_resource_path}
                        title={resource.c_resource_name}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                </Box>
            );
        } else if (['mp4', 'avi'].includes(resource.c_type)) {
            return (
                <Box sx={{ width: '100%', maxHeight: '60vh' }}>
                    <video controls style={{ width: '100%', maxHeight: '100%' }}>
                        <source src={resource.c_resource_path} type={`video/${resource.c_type}`} />
                        您的浏览器不支持视频播放。
                    </video>
                </Box>
            );
        } else {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                        不支持预览 {resource.c_type} 格式的文件
                    </Typography>
                    <Button
                        variant="contained"
                        href={resource.c_resource_path}
                        download={resource.c_resource_name}
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
                {resource?.c_resource_name || '资源预览'}
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        文件大小: {resource?.c_size || '未知'}
                    </Typography>
                    {renderResourcePreview()}
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ResourceViewerModal;