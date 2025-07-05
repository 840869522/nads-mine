'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Typography,
  Snackbar,
  Alert,
  IconButton,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { apiClientWithToken as api } from '@/utils/axios';
import FileViewerModal from '@/components/coursecases/FileViewerModal';
import CourseCaseFormModal from '@/components/coursecases/CourseCaseFormModal';
import CategoryFormModal from '@/components/coursecases/CategoryFormModal';
import { CourseCase, CourseCaseFile } from '@/types';

const CourseCaseList = () => {
  const [courseCases, setCourseCases] = useState<CourseCase[]>([]);
  const [categories, setCategories] = useState<[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [categoryId, setCategoryId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<CourseCaseFile | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CourseCase | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  useEffect(() => {
    api
      .get('/api/categories')
      .then((res) => setCategories(res.data ||[]))
      .catch((err) => {
        setSnackbar({ open: true, message: '获取分类失败', severity: 'error' });
      });
  }, []);

  useEffect(() => {
    api
      .get('/api/course-cases', { params: { page, category_id: categoryId, search } })
      .then((res) => {
        setCourseCases(res.data.data);
        setTotalRows(res.data.last_page * 10); // Assuming 10 items per page
      })
      .catch((err) => {
        setSnackbar({ open: true, message: '获取课程案例失败', severity: 'error' });
      });
  }, [page, categoryId, search]);

  const handleOpenFileViewer = (file: CourseCaseFile) => {
    setViewingFile({
      ...file,
      url: `${process.env.NEXT_PUBLIC_API_URL}/storage/${file.resource_path}`,
      format: file.type?.includes('pdf')
        ? 'pdf'
        : file.type?.includes('mp4')
        ? 'mp4'
        : file.type?.includes('avi')
        ? 'avi'
        : file.type?.includes('ppt')
        ? 'pptx'
        : file.type?.includes('doc')
        ? 'docx'
        : file.type?.includes('image')
        ? 'image'
        : 'other',
    });
    setIsFileViewerOpen(true);
  };

  const handleOpenFormModal = (courseCase: CourseCase | null = null) => {
    if (!isAuthenticated) {
      setSnackbar({ open: true, message: '请先登录', severity: 'error' });
      window.location.href = '/login';
      return;
    }
    setEditingCase(courseCase);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setEditingCase(null);
    setIsFormModalOpen(false);
  };

  const handleSaveCourseCase = (savedCase: CourseCase) => {
    const formData = new FormData();
    formData.append('course_name', savedCase.course_name);
    formData.append('description', savedCase.description || '');
    formData.append('category_id', String(savedCase.category.category_id));
    if (savedCase.resources) {
      savedCase.resources.forEach((file) => {
        if (file.fileObject) formData.append('files[]', file.fileObject);
      });
    }
    const request = editingCase
      ? api.put(`/api/course-cases/${editingCase.course_id}`, formData)
      : api.post('/api/course-cases', formData);
    request
      .then((res) => {
        setCourseCases((prev) =>
          editingCase
            ? prev.map((c) => (c.course_id === res.data.course_id ? res.data : c))
            : [res.data, ...prev]
        );
        setSnackbar({ open: true, message: '保存成功', severity: 'success' });
        handleCloseFormModal();
      })
      .catch((err) => {
        setSnackbar({
          open: true,
          message: err.response?.data?.message || '保存失败',
          severity: 'error',
        });
      });
  };

  const handleDeleteCourseCase = (courseId: number) => {
    if (!isAuthenticated) {
      setSnackbar({ open: true, message: '请先登录', severity: 'error' });
      window.location.href = '/login';
      return;
    }
    api
      .delete(`/api/course-cases/${courseId}`)
      .then(() => {
        setCourseCases((prev) => prev.filter((c) => c.course_id !== courseId));
        setSnackbar({ open: true, message: '删除成功', severity: 'success' });
      })
      .catch((err) => {
        setSnackbar({
          open: true,
          message: err.response?.data?.message || '删除失败',
          severity: 'error',
        });
      });
  };

  const handleAddCategory = (newCategory: string) => {
    if (!isAuthenticated) {
      setSnackbar({ open: true, message: '请先登录', severity: 'error' });
      window.location.href = '/login';
      return;
    }
    api
      .post('/api/categories', { category_name: newCategory })
      .then((res) => {
        setCategories((prev) => [...prev, res.data]);
        setSnackbar({ open: true, message: '分类添加成功', severity: 'success' });
        setIsCategoryModalOpen(false);
      })
      .catch((err) => {
        setSnackbar({
          open: true,
          message: err.response?.data?.message || '分类添加失败',
          severity: 'error',
        });
      });
  };

  const columns: GridColDef[] = [
    { field: 'course_name', headerName: '案例标题', flex: 1 },
    { field: 'category', headerName: '分类', flex: 1, valueGetter: (params) => params.row.category.category_name },
    { field: 'created_at', headerName: '上传时间', flex: 1 },
    {
      field: 'actions',
      headerName: '操作',
      flex: 1,
      renderCell: (params) => (
        <Box>
          {params.row.resources.map((file: CourseCaseFile) => (
            <IconButton key={file.id} onClick={() => handleOpenFileViewer(file)}>
              <VisibilityIcon />
            </IconButton>
          ))}
          {isAuthenticated && (
            <>
              <IconButton onClick={() => handleOpenFormModal(params.row)}>
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => handleDeleteCourseCase(params.row.course_id)}>
                <DeleteIcon />
              </IconButton>
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        课程案例管理
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>分类</InputLabel>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            label="分类"
          >
            <MenuItem value="">所有分类</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.category_id} value={cat.category_id}>
                {cat.category_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="搜索案例标题"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isAuthenticated && (
          <>
            <Button variant="contained" onClick={() => handleOpenFormModal()}>
              添加案例
            </Button>
            <Button variant="contained" onClick={() => setIsCategoryModalOpen(true)}>
              添加分类
            </Button>
          </>
        )}
      </Box>
      {categories && categories.length === 0 && (
        <Typography variant="body1" sx={{ p: 2, textAlign: 'center' }}>
          暂无分类，请先添加分类
        </Typography>
      )}
      {categories && courseCases?.length === 0 && categories?.length > 0 && (
        <Typography variant="body1" sx={{ p: 2, textAlign: 'center' }}>
          暂无课程案例
        </Typography>
      )}
      {categories && categories?.length > 0 && courseCases?.length > 0 && (
        <DataGrid
          rows={courseCases}
          columns={columns}
          getRowId={(row) => row.course_id}
          pagination
          paginationMode="server"
          rowCount={totalRows}
          pageSizeOptions={[10]}
          paginationModel={{ page: page - 1, pageSize: 10 }}
          onPaginationModelChange={({ page }) => setPage(page + 1)}
          sx={{ height: 400 }}
        />
      )}
      <FileViewerModal
        open={isFileViewerOpen}
        onClose={() => setIsFileViewerOpen(false)}
        file={viewingFile}
      />
      <CourseCaseFormModal
        open={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSave={handleSaveCourseCase}
        courseCase={editingCase}
        categories={categories}
      />
      <CategoryFormModal
        open={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleAddCategory}
        categories={categories}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CourseCaseList;