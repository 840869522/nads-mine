
import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { default as MuiGrid } from '@mui/material/Grid'; // Aliased import
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';
import MuiAlert from '@mui/material/Alert'; 
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select'; 
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip'; 

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderZipIcon from '@mui/icons-material/FolderZip';

import { CourseCase, CourseCaseFile } from '../types';
import { MOCK_COURSE_CASES, COURSE_CASE_CATEGORIES } from '../constants';
import CourseCaseFormModal from '../components/coursecases/CourseCaseFormModal';
import FileViewerModal from '../components/coursecases/FileViewerModal';
import PageWrapper from '../components/layout/PageWrapper';

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


  // Simulate fetching data
  useEffect(() => {
    // Clean up object URLs when component unmounts or cases change significantly
    const currentObjectUrls: string[] = [];
    MOCK_COURSE_CASES.forEach(c => c.files.forEach(f => {
        if (f.fileObject && !f.url) { // If fileObject exists but no URL, create one
            const url = URL.createObjectURL(f.fileObject);
            f.url = url; // Mutating constant for demo, in real app, map to new objects
            currentObjectUrls.push(url);
        } else if (f.url && f.url.startsWith('blob:')) {
            currentObjectUrls.push(f.url);
        }
    }));

    setCourseCases(MOCK_COURSE_CASES);
    setIsLoading(false);
    
    return () => {
        currentObjectUrls.forEach(url => URL.revokeObjectURL(url));
    };

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
    setCourseCases(prevCases => {
      if (editingCase) {
        return prevCases.map(c => (c.id === savedCase.id ? savedCase : c));
      }
      return [{ ...savedCase, id: `cc-${Date.now()}` }, ...prevCases];
    });
    handleCloseFormModal();
  };

  const handleOpenFileViewer = (file: CourseCaseFile) => {
    if (!file.url && file.fileObject) { // Create Object URL on demand if not already present for newly added files
        file.url = URL.createObjectURL(file.fileObject);
    }
    setViewingFile(file);
    setIsFileViewerOpen(true);
  };

  const handleCloseFileViewer = () => {
    // If the URL was a temporary blob URL, revoke it if it's for a file that's not persisted in MOCK_COURSE_CASES
    // For this demo, MOCK_COURSE_CASES URLs are empty strings initially or pre-set.
    // Newly added files get blob URLs via handleSaveCourseCase's file processing.
    // It's tricky to manage revocation precisely here without knowing which URLs are "owned" by this component instance.
    // The useEffect cleanup handles the initial MOCK_COURSE_CASES.
    // For files added via CourseCaseFormModal, their object URLs should be revoked if the case is deleted or file removed.
    // A more robust solution would involve managing a Set of active object URLs.
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
      // Revoke object URLs for files associated with the deleted case
      caseToDelete.files.forEach(file => {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }
      });
      setCourseCases(prevCases => prevCases.filter(c => c.id !== caseToDelete!.id));
    }
    handleCloseConfirmDialog();
  };

  const handleFilterChange = (event: SelectChangeEvent<string>) => {
    setFilterCategory(event.target.value as string);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: { xs: 1, md: 0 } }}>
          课程案例库
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center'}}>
        <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel id="filter-category-label">筛选分类</InputLabel>
            <Select
              labelId="filter-category-label"
              value={filterCategory}
              label="筛选分类"
              onChange={handleFilterChange}
            >
              <MenuItem value="">
                <em>所有分类</em>
              </MenuItem>
              {COURSE_CASE_CATEGORIES.map(category => (
                <MenuItem key={category} value={category}>{category}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => handleOpenFormModal()}
            aria-label="添加新课程案例"
          >
            添加案例
          </Button>
        </Box>
      </Box>

      {filteredCases.length === 0 && !isLoading && (
        <MuiAlert severity="info" sx={{mt: 2}}>当前分类下没有课程案例，或题库为空。请尝试其他分类或添加新的案例。</MuiAlert>
      )}

      <MuiGrid container spacing={3}>
        {filteredCases.map(courseCase => (
          <MuiGrid item xs={12} sm={6} md={4} key={courseCase.id}>
            <Box
                sx={{
                    bgcolor: 'background.paper',
                    p: 2.5,
                    borderRadius: 2,
                    boxShadow: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'box-shadow 0.3s ease-in-out',
                    '&:hover': { boxShadow: 6 }
                }}
            >
              <Typography variant="h6" component="h2" gutterBottom sx={{fontWeight: 'medium'}}>
                {courseCase.title}
              </Typography>
              <Chip label={courseCase.category} size="small" sx={{ mb: 1, alignSelf: 'flex-start', bgcolor: 'primary.light', color: 'primary.contrastText' }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1, maxHeight: '6em', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {courseCase.description || "暂无描述"}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
                上传日期: {formatDate(courseCase.uploadDate)}
              </Typography>
              
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>附件:</Typography>
                {courseCase.files.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 100, overflowY:'auto'}}>
                    {courseCase.files.map(file => (
                      <Button
                        key={file.id}
                        size="small"
                        variant="text"
                        startIcon={getFileIcon(file.format)}
                        onClick={() => handleOpenFileViewer(file)}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none', p:0.5, '&:hover': { bgcolor: 'action.hover'} }}
                        title={`查看 ${file.name}`}
                      >
                        {file.name} {file.size ? `(${file.size})` : ''}
                      </Button>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">无附件</Typography>
                )}
              </Box>

              <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end', gap: 1, borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
                <Tooltip title={`编辑案例 ${courseCase.title}`}>
                    <IconButton size="small" onClick={() => handleOpenFormModal(courseCase)} color="primary" aria-label={`编辑案例 ${courseCase.title}`}>
                    <EditIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title={`删除案例 ${courseCase.title}`}>
                    <IconButton size="small" onClick={() => handleOpenConfirmDialog(courseCase)} color="error" aria-label={`删除案例 ${courseCase.title}`}>
                    <DeleteIcon />
                    </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </MuiGrid>
        ))}
      </MuiGrid>

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
        <DialogActions sx={{ px:3, pb:2}}>
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
