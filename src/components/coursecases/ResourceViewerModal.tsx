import React, { useState, useEffect } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography, Box, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import mammoth from 'mammoth';
import { CourseCaseResource } from '../../types';
import { apiClientWithToken } from '@/utils/axios';
import { getCookie } from '@/utils/cookie';
import { BACK_IP_PORT } from '@/constants';

interface ResourceViewerModalProps {
    open: boolean;
    onClose: () => void;
    resource: CourseCaseResource | null;
}

const ResourceViewerModal: React.FC<ResourceViewerModalProps> = ({ open, onClose, resource }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [docUrl, setDocUrl] = useState<string | null>(null);
    const [docxHtml, setDocxHtml] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 下载文件
    const handleDownload = async (resource: CourseCaseResource) => {
        try {
            const token = getCookie('_auth');
            if (!token) throw new Error('未登录，请先登录');
            const downloadUrl = resource.isExperimentResource
                ? `/back/api/study/experiment-resources/${resource.c_resource_id}`
                : resource.c_resource_path;
            const response = await apiClientWithToken.get(downloadUrl, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob',
            });

            const contentType = response.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const json = JSON.parse(text);
                if (json.code === 200 && json.data.url) {
                    const link = document.createElement('a');
                    link.href = json.data.url;
                    // 使用 c_resource_name，依赖后端 Content-Disposition 指定文件名
                    link.setAttribute('download', resource.c_resource_name);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    return;
                }
                throw new Error(json.message || '获取下载链接失败');
            }

            if (!contentType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document') && resource.c_type === 'docx') {
                console.warn('Unexpected Content-Type:', contentType);
            }

            const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
            const link = document.createElement('a');
            link.href = url;
            // 使用 c_resource_name，依赖后端 Content-Disposition 指定文件名
            link.setAttribute('download', resource.c_resource_name);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('下载失败:', error);
            const message = error.response?.data?.message || '下载文件失败，请检查网络或文件权限';
            alert(`错误: ${message}`);
        }
    };

    // 获取文件 Blob URL 并处理预览逻辑
    useEffect(() => {
        if (!resource || !resource.c_resource_path) return;

        const fetchResource = async () => {
            setIsLoading(true);
            setError(null);
            setDocUrl(null);
            setDocxHtml(null);

            try {
                const token = getCookie('_auth');
                if (!token) throw new Error('未登录，请先登录');
                const downloadUrl = resource.isExperimentResource
                    ? `/back/api/study/experiment-resources/${resource.c_resource_id}`
                    : resource.c_resource_path;
                const response = await apiClientWithToken.get(downloadUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob',
                });

                const contentType = response.headers['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const text = await response.data.text();
                    const json = JSON.parse(text);
                    throw new Error(json.message || '获取文件失败');
                }

                const blob = new Blob([response.data], { type: contentType });
                const url = URL.createObjectURL(blob);
                setDocUrl(url);

                // 处理 DOCX 转换为 HTML
                if (resource.c_type === 'docx') {
                    try {
                        const arrayBuffer = await response.data.arrayBuffer();
                        const result = await mammoth.convertToHtml({ arrayBuffer });
                        setDocxHtml(result.value);
                    } catch (err) {
                        console.error('转换 DOCX 失败:', err);
                        setError('无法预览 DOCX 文件，请尝试下载');
                    }
                }
            } catch (error: any) {
                console.error('加载文件失败:', error);
                setError('无法加载文件，请尝试下载');
            } finally {
                setIsLoading(false);
            }
        };

        fetchResource();

        return () => {
            if (docUrl) URL.revokeObjectURL(docUrl);
        };
    }, [resource]);

    // 渲染预览内容
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

        if (isLoading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            );
        }

        if (error) {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <Typography variant="body1" color="error">
                        {error}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => handleDownload(resource)}
                        sx={{ mt: 2 }}
                    >
                        下载{resource.isExperimentResource ? '实验资源' : '课程资源'}
                    </Button>
                </Box>
            );
        }

        switch (resource.c_type) {
            case 'pdf':
            case 'doc':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                            暂不支持预览 {resource.c_type.toUpperCase()} 文件，请下载查看
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => handleDownload(resource)}
                            sx={{ mt: 2 }}
                        >
                            下载{resource.isExperimentResource ? '实验资源' : '课程资源'}
                        </Button>
                    </Box>
                );
            case 'docx':
                return docxHtml ? (
                    <Box
                        sx={{
                            maxHeight: '70vh',
                            overflow: 'auto',
                            border: '1px solid #ddd',
                            p: 2,
                            '& img': { maxWidth: '100%' },
                        }}
                        dangerouslySetInnerHTML={{ __html: docxHtml }}
                    />
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                            正在加载 DOCX 文件...
                        </Typography>
                    </Box>
                );
            case 'mp4':
            case 'avi':
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <video
                            controls
                            src={docUrl}
                            style={{ maxWidth: '100%', maxHeight: '70vh' }}
                        >
                            您的浏览器不支持视频播放
                        </video>
                    </Box>
                );
            case 'jpg':
            case 'png':
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <img
                            src={docUrl}
                            alt={resource.c_resource_name}
                            style={{ maxWidth: '100%', maxHeight: '70vh' }}
                        />
                    </Box>
                );
            default:
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                            暂不支持预览 {resource.c_type} 格式的文件
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => handleDownload(resource)}
                            sx={{ mt: 2 }}
                        >
                            下载{resource.isExperimentResource ? '实验资源' : '课程资源'}
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
            <DialogTitle>{resource?.c_resource_name || '资源预览'}</DialogTitle>
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
                {resource && (
                    <Button
                        variant="contained"
                        onClick={() => handleDownload(resource)}
                        sx={{ mt: 2 }}
                    >
                        下载
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ResourceViewerModal;