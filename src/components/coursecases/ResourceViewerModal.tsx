import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography, Box, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { CourseCaseResource } from '../../types';
import { apiClientWithToken } from '@/utils/axios';
import { getCookie } from '@/utils/cookie';
import mammoth from 'mammoth';

interface ResourceViewerModalProps {
    open: boolean;
    onClose: () => void;
    resource: CourseCaseResource | null;
}

const ResourceViewerModal: React.FC<ResourceViewerModalProps> = ({ open, onClose, resource }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    const handleDownload = async (resource: CourseCaseResource) => {
        try {
            const token = getCookie('_auth');
            if (!token) throw new Error('未登录，请先登录');
            const downloadUrl = resource.isExperimentResource
                ? `/back/api/study/experiment-resources/${resource.c_resource_id}?disposition=attachment`
                : `/back/api/study/resources/${resource.c_resource_id}?disposition=attachment`;
            const response = await apiClientWithToken.get(downloadUrl, {
                headers: { Authorization: `${token}` },
                responseType: 'blob',
            });

            const contentType = response.headers['content-type'] || '';
            const blob = new Blob([response.data], { type: contentType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${resource.c_resource_name}.${resource.c_type}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('下载失败:', error);
            setError(error.response?.data?.message || '下载文件失败，请检查网络或文件权限');
        }
    };

    const cleanupObjectUrl = () => {
        if (objectUrl) {
            window.URL.revokeObjectURL(objectUrl);
            setObjectUrl(null);
        }
    };

    useEffect(() => {
        if (!open || !resource || !resource.c_resource_path) return;

        const openViewer = async () => {
            setIsLoading(true);
            setError(null);
            setHtmlContent('');
            cleanupObjectUrl();

            try {
                const token = getCookie('_auth');
                if (!token) throw new Error('未登录，请先登录');

                const isWord = resource.c_type === 'doc' || resource.c_type === 'docx';
                const isPptx = resource.c_type === 'pptx';
                const isPdf = resource.c_type === 'pdf';
                const isImage = resource.c_type === 'jpg' || resource.c_type === 'jpeg' || resource.c_type === 'png';
                const isVideo = resource.c_type === 'mp4' || resource.c_type === 'avi';

                let viewUrl = resource.isExperimentResource
                    ? `/back/api/study/experiment-resources/${resource.c_resource_id}?disposition=inline`
                    : `/back/api/study/resources/${resource.c_resource_id}?disposition=inline`;

                if (isPptx) {
                    // 调用 PPTX 转 PDF 端点
                    viewUrl = resource.isExperimentResource
                        ? `/back/api/study/experiment-resources/${resource.c_resource_id}/convert-to-pdf?disposition=inline`
                        : `/back/api/study/resources/${resource.c_resource_id}/convert-to-pdf?disposition=inline`;

                    const response = await fetch(viewUrl, {
                        headers: { Authorization: `${token}` },
                    });
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 420) {
                            throw new Error('token失效，请重新登录');
                        }
                        throw new Error(`无法加载文件: ${response.statusText}`);
                    }
                    const blob = await response.blob();
                    const tempUrl = URL.createObjectURL(blob);
                    setObjectUrl(tempUrl);

                    // 新标签页预览 PDF
                    window.open(tempUrl, '_blank');
                    onClose(); // 关闭模态框
                } else if (isWord) {
                    const response = await fetch(viewUrl, {
                        headers: { Authorization: `${token}` },
                    });
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 420) {
                            throw new Error('token失效，请重新登录');
                        }
                        throw new Error(`无法加载文件: ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (!result.value) {
                        throw new Error('文件转换为空，请检查 DOCX 格式');
                    }
                    setHtmlContent(result.value);
                } else if (isPdf || isImage || isVideo) {
                    const response = await fetch(viewUrl, {
                        headers: { Authorization: `${token}` },
                    });
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 420) {
                            throw new Error('token失效，请重新登录');
                        }
                        throw new Error(`无法加载文件: ${response.statusText}`);
                    }
                    const blob = await response.blob();
                    const contentType = response.headers.get('content-type') || 'application/octet-stream';
                    const tempUrl = URL.createObjectURL(blob);
                    setObjectUrl(tempUrl);

                    // 新标签页预览
                    window.open(tempUrl, '_blank');
                    onClose();
                } else {
                    const response = await fetch(viewUrl, {
                        headers: { Authorization: `${token}` },
                    });
                    if (!response.ok) {
                        if (response.status === 401 || response.status === 420) {
                            throw new Error('token失效，请重新登录');
                        }
                        throw new Error(`无法加载文件: ${response.statusText}`);
                    }
                    const blob = await response.blob();
                    const contentType = response.headers.get('content-type') || 'application/octet-stream';
                    const tempUrl = URL.createObjectURL(blob);
                    setObjectUrl(tempUrl);

                    setHtmlContent(`
                        <object data="${tempUrl}" type="${contentType}" width="100%" height="100%">
                            <p style="text-align: center; color: #555; font-size: 16px;">
                                浏览器不支持预览此文件类型，请
                                <a href="${tempUrl}" download="${resource.c_resource_name}.${resource.c_type}" style="color: #1976d2; text-decoration: underline;">
                                    下载查看
                                </a>。
                            </p>
                        </object>
                    `);
                }
            } catch (error: any) {
                console.error('预览失败:', error);
                setError(`无法预览文件: ${error.message}。请尝试下载。`);
                if (error.message.includes('token失效')) {
                    window.location.href = '/login';
                }
            } finally {
                setIsLoading(false);
            }
        };

        openViewer();

        return () => {
            cleanupObjectUrl();
        };
    }, [open, resource, onClose]);

    const handleClose = () => {
        cleanupObjectUrl();
        onClose();
    };

    if (!open || !resource) return null;

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
            PaperProps={{ sx: { borderRadius: 2 } }}
        >
            <DialogTitle>{resource?.c_resource_name || '资源查看'}</DialogTitle>
            <DialogContent dividers sx={{ maxHeight: '80vh', overflowY: 'auto' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        文件大小: {resource?.c_size || '未知'}
                    </Typography>
                    {isLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}
                    {error && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                            <Typography variant="body1" color="error">
                                {error}
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={() => handleDownload(resource)}
                                sx={{ mt: 2 }}
                            >
                                下载文件
                            </Button>
                        </Box>
                    )}
                    {htmlContent && (
                        <Box sx={{ width: '100%', maxHeight: 'calc(80vh - 100px)', overflowY: 'auto', p: 2, border: '1px solid #ddd' }}>
                            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                        </Box>
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                {htmlContent && (
                    <Button
                        variant="contained"
                        onClick={() => handleDownload(resource)}
                        sx={{ mr: 2 }}
                    >
                        下载文件
                    </Button>
                )}
                <Button onClick={handleClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ResourceViewerModal;