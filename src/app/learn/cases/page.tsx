"use client";

import React, { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderZipIcon from '@mui/icons-material/FolderZip';

import { CourseCase, CourseCaseFile } from '@/types';
import { COURSE_CASE_CATEGORIES } from '@/constants';
import CourseCaseFormModal from '@/components/coursecases/CourseCaseFormModal';
import FileViewerModal from '@/components/coursecases/FileViewerModal';
import PageWrapper from '@/components/layout/PageWrapper';

// 每行最多显示的分类数量（包括"所有分类"）
const MAX_CATEGORIES_PER_ROW = 7;

const CourseCasesPage: React.FC = () => {
  const [courseCases, setCourseCases] = useState<CourseCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CourseCase | null>(null);
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<CourseCaseFile | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<CourseCase | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [visibleCategories, setVisibleCategories] = useState<string[]>([]);
  const [showMoreButton, setShowMoreButton] = useState(false);

  useEffect(() => {
    fetch('/api/course-cases')
      .then(res => res.json())
      .then(data => {
        setCourseCases(data);
        setIsLoading(false);
      });
  }, []);

  // 初始化可见分类
  useEffect(() => {
    // 第一行显示的分类数量（包括"所有分类"）
    const firstRowCount = MAX_CATEGORIES_PER_ROW - 1; // 减去"所有分类"
    
    // 设置第一行可见的分类
    const visible = COURSE_CASE_CATEGORIES.slice(0, firstRowCount);
    setVisibleCategories(visible);
    
    // 如果有更多分类需要显示
    if (COURSE_CASE_CATEGORIES.length > firstRowCount) {
      setShowMoreButton(true);
    }
  }, []);

  const handleOpenFormModal = (courseCase?: CourseCase) => {
    setEditingCase(courseCase || null);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingCase(null);
  };

  const handleSaveCourseCase = (savedCase: CourseCase) => {
    if (editingCase) {
      fetch('/api/course-cases', { method: 'PUT', body: JSON.stringify(savedCase) }).then(() => {
        setCourseCases(prevCases => prevCases.map(c => (c.id === savedCase.id ? savedCase : c)));
      });
    } else {
      fetch('/api/course-cases', { method: 'POST', body: JSON.stringify(savedCase) })
        .then(res => res.json())
        .then(data => setCourseCases(prevCases => [{ ...savedCase, id: data.id }, ...prevCases]));
    }
    handleCloseFormModal();
  };

  const handleOpenFileViewer = (file: CourseCaseFile) => {
    if (!file.url && file.fileObject) {
      file.url = URL.createObjectURL(file.fileObject);
    }
    setViewingFile(file);
    setIsFileViewerOpen(true);
  };

  const handleCloseFileViewer = () => {
    setIsFileViewerOpen(false);
    setViewingFile(null);
  };

  const handleOpenConfirmDialog = (courseCase: CourseCase) => {
    setCaseToDelete(courseCase);
    setIsConfirmDialogOpen(true);
  };

  const handleCloseConfirmDialog = () => {
    setCaseToDelete(null);
    setIsConfirmDialogOpen(false);
  };

  const handleDeleteCourseCase = () => {
    if (caseToDelete) {
      caseToDelete.files.forEach(file => {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }
      });
      fetch(`/api/course-cases?id=${caseToDelete.id}`, { method: 'DELETE' }).then(() => {
        setCourseCases(prevCases => prevCases.filter(c => c.id !== caseToDelete.id));
      });
    }
    handleCloseConfirmDialog();
  };

  const getFileIcon = (format: CourseCaseFile['format']) => {
    switch (format) {
      case 'pdf': return <PictureAsPdfIcon color="error" />;
      case 'mp4': case 'avi': return <PlayCircleOutlineIcon color="primary" />;
      case 'pptx': case 'docx': return <DescriptionIcon color="info" />;
      default: return <FolderZipIcon color="disabled" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const filteredCases = filterCategory 
    ? courseCases.filter(c => c.category === filterCategory)
    : courseCases;

  if (isLoading) {
    return (
      <PageWrapper>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* 紧凑型头部 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          p: 2,
          bgcolor: '#f5f7fa',
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            课程案例库
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            随时查看和管理课程案例
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => handleOpenFormModal()}
          sx={{ 
            fontWeight: 'bold',
            height: 40,
            px: 3
          }}
        >
          添加案例
        </Button>
      </Box>

      {/* 分类筛选器 - 多行显示 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium', color: '#1976d2' }}>
          分类筛选
        </Typography>
        
        <Box 
          sx={{ 
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            mb: 1
          }}
        >
          <Chip
            label="所有分类"
            variant={filterCategory === '' ? 'filled' : 'outlined'}
            color="primary"
            onClick={() => setFilterCategory('')}
            sx={{ 
              height: 40, 
              px: 2, 
              fontSize: '0.9rem',
              fontWeight: filterCategory === '' ? 'bold' : 'normal'
            }}
          />
          
          {/* 第一行显示的分类 */}
          {visibleCategories.map(category => (
            <Chip
              key={category}
              label={category}
              variant={filterCategory === category ? 'filled' : 'outlined'}
              color="primary"
              onClick={() => setFilterCategory(category)}
              sx={{ 
                height: 40, 
                px: 2, 
                fontSize: '0.9rem',
                fontWeight: filterCategory === category ? 'bold' : 'normal'
              }}
            />
          ))}
          
          {/* 显示"更多"按钮 */}
          {showMoreButton && !categoriesExpanded && (
            <Button
              variant="text"
              color="primary"
              endIcon={<ExpandMoreIcon />}
              onClick={() => setCategoriesExpanded(true)}
              sx={{ height: 40, px: 1 }}
            >
              更多
            </Button>
          )}
        </Box>
        
        {/* 展开的分类区域 */}
        <Collapse in={categoriesExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
            {COURSE_CASE_CATEGORIES.slice(visibleCategories.length).map(category => (
              <Chip
                key={category}
                label={category}
                variant={filterCategory === category ? 'filled' : 'outlined'}
                color="primary"
                onClick={() => setFilterCategory(category)}
                sx={{ 
                  height: 40, 
                  px: 2, 
                  fontSize: '0.9rem',
                  fontWeight: filterCategory === category ? 'bold' : 'normal'
                }}
              />
            ))}
            
            <Button
              variant="text"
              color="primary"
              endIcon={<ExpandLessIcon />}
              onClick={() => setCategoriesExpanded(false)}
              sx={{ height: 40, px: 1 }}
            >
              收起
            </Button>
          </Box>
        </Collapse>
      </Box>

      {filteredCases.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <img src="/no-data.svg" alt="无数据" width={120} style={{ opacity: 0.6 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            当前筛选条件下暂无课程案例，请尝试添加或更换分类。
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {filteredCases.map(courseCase => (
          <Card
            key={courseCase.id}
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              border: '1px solid #e0e0e0',
              borderRadius: 2,
              boxShadow: '0 4px 8px rgba(0,0,0,0.05)',
              transition: 'all 0.3s ease',
              overflow: 'hidden',
              '&:hover': {
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                transform: 'translateY(-3px)',
                '& .action-buttons': {
                  opacity: 1
                }
              }
            }}
          >
            {/* 左侧：课程信息区域 */}
            <Box sx={{ 
              width: { xs: '100%', md: '50%' }, 
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              bgcolor: '#f9f9f9'
            }}>
              {/* 操作按钮 */}
              <Box 
                className="action-buttons"
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                  mb: 1,
                  opacity: 0,
                  transition: 'opacity 0.3s ease'
                }}
              >
                <Tooltip title={`编辑案例 ${courseCase.title}`}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleOpenFormModal(courseCase)} 
                    color="primary" 
                    sx={{ 
                      bgcolor: 'white', 
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      '&:hover': { bgcolor: '#e3f2fd' }
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`删除案例 ${courseCase.title}`}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleOpenConfirmDialog(courseCase)} 
                    color="error" 
                    sx={{ 
                      bgcolor: 'white', 
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      '&:hover': { bgcolor: '#ffebee' }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              
              {/* 分类标签 */}
              <Chip
                label={courseCase.category}
                size="small"
                sx={{ 
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  bgcolor: '#e3f2fd',
                  color: '#1976d2',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  zIndex: 1
                }}
              />
              
              {/* 标题和描述 */}
              <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', mb: 1.5, mt: 4 }}>
                {courseCase.title}
              </Typography>
              
              <Typography 
                variant="body1" 
                color="text.secondary" 
                sx={{ 
                  mb: 2.5,
                  flexGrow: 1,
                  lineHeight: 1.6
                }}
              >
                {courseCase.description || "暂无描述"}
              </Typography>
              
              {/* 元信息 */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 'auto',
                pt: 2,
                borderTop: '1px solid #f0f0f0'
              }}>
                <Typography variant="caption" color="text.secondary">
                  上传日期: {formatDate(courseCase.uploadDate)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {courseCase.files.length} 个附件
                </Typography>
              </Box>
            </Box>
            
            {/* 右侧：附件区域 */}
            <Box sx={{ 
              width: { xs: '100%', md: '50%' }, 
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: '#f5f7fa',
              borderTop: { xs: '1px solid #e0e0e0', md: 'none' },
              borderLeft: { md: '1px solid #e0e0e0' }
            }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                附件列表
              </Typography>
              
              {courseCase.files.length > 0 ? (
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2
                }}>
                  {courseCase.files.map(file => (
                    <Card
                      key={file.id}
                      onClick={() => handleOpenFileViewer(file)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        bgcolor: 'white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        '&:hover': {
                          bgcolor: '#e3f2fd',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          bgcolor: '#e3f2fd',
                          borderRadius: 1
                        }}>
                          {getFileIcon(file.format)}
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {file.size || '未知大小'}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexGrow: 1,
                  py: 4
                }}>
                  <DescriptionIcon sx={{ fontSize: 48, color: '#bdbdbd', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    此案例暂无附件
                  </Typography>
                </Box>
              )}
            </Box>
          </Card>
        ))}
      </Box>

      <Box sx={{ mt: 6, textAlign: 'center', color: 'text.secondary', fontSize: 14 }}>
        当前共 {filteredCases.length} 个课程案例  
      </Box>

      <CourseCaseFormModal
        open={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSave={handleSaveCourseCase}
        courseCase={editingCase}
      />

      {viewingFile && (
        <FileViewerModal
          open={isFileViewerOpen}
          onClose={handleCloseFileViewer}
          file={viewingFile}
        />
      )}

      <Dialog
        open={isConfirmDialogOpen}
        onClose={handleCloseConfirmDialog}
        aria-labelledby="confirm-delete-dialog-title"
      >
        <DialogTitle id="confirm-delete-dialog-title">确认删除课程案例</DialogTitle>
        <DialogContent>
          <DialogContentText>
            您确定要删除课程案例 "{caseToDelete?.title}" 吗？此操作无法撤销，其关联的所有文件也将被移除。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseConfirmDialog} variant="outlined">取消</Button>
          <Button onClick={handleDeleteCourseCase} color="error" variant="contained" autoFocus>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
};

export default CourseCasesPage;