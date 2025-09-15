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

    // 下载文件（不变，但添加日志）
    const handleDownload = async (resource: CourseCaseResource) => {
        try {
            const token = getCookie('_auth');
            if (!token) throw new Error('未登录，请先登录');
            const downloadUrl = resource.isExperimentResource
                ? `/back/api/study/experiment-resources/${resource.c_resource_id}?disposition=attachment`
                : `/back/api/study/resources/${resource.c_resource_id}?disposition=attachment`;
            const response = await apiClientWithToken.get(downloadUrl, {
                headers: { Authorization: ` ${token}` },
                responseType: 'blob',
            });

            const contentType = response.headers['content-type'] || '';
            const blob = new Blob([response.data], { type: contentType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${resource.c_resource_name}.${resource.c_type}`);  // 修改：确保下载文件名完整
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('下载失败:', error);
            setError(error.response?.data?.message || '下载文件失败，请检查网络或文件权限');
        }
    };

    // 打开查看页面
    useEffect(() => {
        if (!open || !resource || !resource.c_resource_path) return;

        const openViewer = async () => {
            setIsLoading(true);
            setError(null);
            setHtmlContent('');

            try {
                const token = getCookie('_auth');
                if (!token) throw new Error('未登录，请先登录');

                const viewUrl = resource.isExperimentResource
                    ? `/back/api/study/experiment-resources/${resource.c_resource_id}?disposition=inline`
                    : `/back/api/study/resources/${resource.c_resource_id}?disposition=inline`;

                const isWord = resource.c_type === 'doc' || resource.c_type === 'docx';  // 修改：使用扩展名匹配
                const isPptx = resource.c_type === 'pptx';

                if (isWord) {
                    // 获取 DOCX 并转换为 HTML，在模态框显示（优化错误处理）
                    const response = await fetch(viewUrl, {
                        headers: { Authorization: ` ${token}` },
                    });
                    if (!response.ok) {
                        throw new Error(`无法加载文件: ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (!result.value) {
                        throw new Error('文件转换为空，请检查 DOCX 格式');
                    }
                    setHtmlContent(result.value);
                } else if (isPptx) {
                    setHtmlContent('<p>浏览器不支持直接查看 PPTX 文件，请下载查看。</p>');
                } else {
                    // 其他类型（如 PDF/PNG/MP4）在新标签页打开（后端 HTML 处理 title 和下载按钮）
                    window.open(viewUrl, '_blank');
                    onClose();  // 关闭模态框
                }
            } catch (error: any) {
                console.error('预览失败:', error);
                setError(`无法预览文件: ${error.message}。请尝试下载。`);  // 修改：显示错误，不自动下载
            } finally {
                setIsLoading(false);
            }
        };

        openViewer();
    }, [open, resource, onClose]);

    if (!open || !resource) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
            PaperProps={{ sx: { borderRadius: 2 } }}
        >
            <DialogTitle>{resource?.c_resource_name || '资源查看'}</DialogTitle>  {/* 修改：模态框标题显示完整文件名 */}
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
                        <Box sx={{ width: '100%', maxHeight: 'calc(80vh - 100px)', overflowY: 'auto', p: 2, border: '1px solid #ddd' }}>  {/* 修改：添加边框以改善 DOCX 预览视觉 */}
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
                <Button onClick={onClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ResourceViewerModal;