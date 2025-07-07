"use client";

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Pagination from '@mui/material/Pagination';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';

import { CourseCase, CourseCaseFile } from '@/types';
import CourseCaseFormModal from '@/components/coursecases/CourseCaseFormModal';
import CategoryFormModal from '@/components/coursecases/CategoryFormModal';
import FileViewerModal from '@/components/coursecases/FileViewerModal';
import PageWrapper from '@/components/layout/PageWrapper';
import { apiClientWithToken } from '@/utils/axios';
import { headers } from 'next/headers';
import { BACK_IP_PORT } from '@/constants';

const ITEMS_PER_PAGE = 10;

const CourseCasesPage: React.FC = () => {
  const [courseCases, setCourseCases] = useState<CourseCase[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CourseCase | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<CourseCaseFile | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<CourseCase | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCaseForFiles, setSelectedCaseForFiles] = useState<CourseCase | null>(null);
  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Fetch categories and courses on mount or when search/filter changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch categories
        const categoriesResponse = await apiClientWithToken.get('/api/categories');
        const categoriesData = categoriesResponse.data;
        if (categoriesData.code === 200) {
          setCategories(categoriesData.data.map((cat: { c_category_id: string; c_category_name: string }) => cat.c_category_name));
        } else {
          console.error('Failed to fetch categories:', categoriesData.message);
        }

        // Fetch courses with pagination and optional keyword
        const coursesResponse = await apiClientWithToken.get('/api/courses', {
          headers: {
            'Accept': 'application/json',
          },
          params: {
            page: currentPage,
            pageSize: ITEMS_PER_PAGE,
            ...(searchKeyword && { keyword: searchKeyword }),
          },
        });
        const coursesData = coursesResponse.data;
        if (coursesData.code === 200) {
          const mappedCourses = await Promise.all(
            coursesData.data.courses.map(async (course: any) => {
              // Fetch resources for each course
              const resourcesResponse = await apiClientWithToken.get(`/api/courses/${course.c_course_id}/resources`);
              const resourcesData = resourcesResponse.data;
              const files = resourcesData.code === 200 ? resourcesData.data.map((res: any) => ({
                id: res.c_resource_id,
                name: res.c_resource_name,
                format: res.c_type.split('/')[1] || 'other',
                url: `/storage/${res.c_resource_path}`,
                size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
              })) : [];
              return {
                id: course.c_course_id,
                title: course.c_course_name,
                description: course.c_description || '',
                category: course.c_category_id,
                files,
                uploadDate: course.created_at,
              };
            })
          );
          setCourseCases(mappedCourses);
        } else {
          console.error('Failed to fetch courses:', coursesData.message);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentPage, searchKeyword]);

  const handleOpenFormModal = (courseCase?: CourseCase) => {
    setEditingCase(courseCase || null);
    setIsFormModalOpen(true);
  };

  const handleOpenCategoryModal = (category?: { id: string; name: string }) => {
    setEditingCategory(category || null);
    setIsCategoryModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingCase(null);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleSaveCourseCase = async (savedCase: CourseCase) => {
    try {
      const { id, title, description, category, files, uploadDate } = savedCase;
      const courseData = {
        name: title,
        description,
        category_id: category,
        user_id: localStorage.getItem('user_id') || 'default_user',
      };

      let courseId = id;
      if (editingCase) {
        // Update course
        const response = await apiClientWithToken.put(`/back/api/courses/${id}`, courseData);
        const data = response.data;
        if (data.code !== 200) {
          console.error('Failed to update course:', data.message);
          return;
        }
      } else {
        // Create course
        const response = await apiClientWithToken.post('/api/courses', courseData);
        const data = response.data;
        if (data.code !== 201) {
          console.error('Failed to create course:', data.message);
          return;
        }
        courseId = data.data.c_course_id;
      }

      // Handle file uploads
      for (const file of files) {
        if (file.fileObject) {
          const formData = new FormData();
          formData.append('course_id', courseId);
          formData.append('file', file.fileObject);
          const response = await apiClientWithToken.post(`/back/api/courses/${courseId}/resources/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          const data = response.data;
          if (data.code !== 201) {
            console.error('Failed to upload file:', data.message);
          }
        }
      }

      // Refresh course list
      const coursesResponse = await apiClientWithToken.get(`/back/api/courses`, {
        params: {
          page: currentPage,
          pageSize: ITEMS_PER_PAGE,
          ...(searchKeyword && { keyword: searchKeyword }),
        },
      });
      const coursesData = coursesResponse.data;
      if (coursesData.code === 200) {
        const mappedCourses = await Promise.all(
          coursesData.data.courses.map(async (course: any) => {
            const resourcesResponse = await apiClientWithToken.get(`/back/api/courses/${course.c_course_id}/resources`);
            const resourcesData = resourcesResponse.data;
            const files = resourcesData.code === 200 ? resourcesData.data.map((res: any) => ({
              id: res.c_resource_id,
              name: res.c_resource_name,
              format: res.c_type.split('/')[1] || 'other',
              url: `/storage/${res.c_resource_path}`,
              size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
            })) : [];
            return {
              id: course.c_course_id,
              title: course.c_course_name,
              description: course.c_description || '',
              category: course.c_category_id,
              files,
              uploadDate: course.created_at,
            };
          })
        );
        setCourseCases(mappedCourses);
      }
    } catch (error) {
      console.error('Error saving course case:', error);
    }
    handleCloseFormModal();
  };

  const handleSaveCategory = async (category: { id?: string; name: string }) => {
    try {
      if (category.id) {
        // Update category
        const response = await apiClientWithToken.put(`/back/api/categories/${category.id}`, { name: category.name });
        const data = response.data;
        if (data.code === 200) {
          setCategories(prev => prev.map(cat => cat === category.id ? category.name : cat));
        } else {
          console.error('Failed to update category:', data.message);
        }
      } else {
        // Create category
        const response = await apiClientWithToken.post(`/back/api/categories`, { name: category.name });
        const data = response.data;
        if (data.code === 201) {
          setCategories(prev => [...prev, category.name]);
        } else {
          console.error('Failed to create category:', data.message);
        }
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
    handleCloseCategoryModal();
  };

  const handleDeleteCourseCase = async () => {
    if (caseToDelete) {
      caseToDelete.files.forEach(file => {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }
      });
      try {
        const response = await apiClientWithToken.delete(`/back/api/courses/${caseToDelete.id}`);
        const data = response.data;
        if (data.code === 200) {
          setCourseCases(prevCases => prevCases.filter(c => c.id !== caseToDelete.id));
        } else {
          console.error('Failed to delete course:', data.message);
        }
      } catch (error) {
        console.error('Error deleting course case:', error);
      }
    }
    setCaseToDelete(null);
    setIsConfirmDialogOpen(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleCategoryChange = (event: SelectChangeEvent) => {
    setFilterCategory(event.target.value as string);
    setCurrentPage(1); // Reset to first page
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handleOpenFilesDialog = (courseCase: CourseCase) => {
    setSelectedCaseForFiles(courseCase);
    setIsFilesDialogOpen(true);
  };

  const handleCloseFilesDialog = () => {
    setIsFilesDialogOpen(false);
    setSelectedCaseForFiles(null);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKeyword(event.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const filteredCases = filterCategory 
    ? courseCases.filter(c => c.category === filterCategory)
    : courseCases;

  const pageCount = Math.ceil(filteredCases.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentCases = filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            课程案例库
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            随时查看和管理课程案例
          </Typography>
        </Box>
        <Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleOpenFormModal()}
            sx={{ fontWeight: 'bold', mr: 2 }}
          >
            添加案例
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleOpenCategoryModal()}
            sx={{ fontWeight: 'bold' }}
          >
            添加类别
          </Button>
        </Box>
      </Box>

      {/* Search and Category Filter */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="category-filter-label">分类筛选</InputLabel>
            <Select
              labelId="category-filter-label"
              id="category-filter"
              value={filterCategory}
              label="分类筛选"
              onChange={handleCategoryChange}
            >
              <MenuItem value="">所有分类</MenuItem>
              {categories.map(category => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {filterCategory && (
            <Chip
              label={`当前筛选: ${filterCategory}`}
              onDelete={() => setFilterCategory('')}
              color="primary"
              sx={{ height: 40, px: 2 }}
            />
          )}
        </Box>
        <TextField
          label="搜索课程"
          variant="outlined"
          value={searchKeyword}
          onChange={handleSearchChange}
          sx={{ minWidth: 300 }}
          placeholder="输入课程名称或描述"
        />
      </Box>

      {filteredCases.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 8, p: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            当前筛选条件下暂无课程案例，请尝试添加或更换分类。
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main', '& th': { color: 'primary.contrastText' } }}>
                  <TableCell>案例标题</TableCell>
                  <TableCell>分类</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell>上传日期</TableCell>
                  <TableCell>附件数量</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentCases.map(courseCase => (
                  <TableRow key={courseCase.id} hover>
                    <TableCell sx={{ fontWeight: 'medium' }}>{courseCase.title}</TableCell>
                    <TableCell>
                      {categories.find(cat => cat === courseCase.category) || '未知分类'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>{courseCase.description || "暂无描述"}</TableCell>
                    <TableCell>{formatDate(courseCase.uploadDate)}</TableCell>
                    <TableCell>
                      <Button 
                        variant="text" 
                        onClick={() => handleOpenFilesDialog(courseCase)}
                        disabled={courseCase.files.length === 0}
                      >
                        {courseCase.files.length} 个
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <Button 
                        variant="text" 
                        color="primary" 
                        onClick={() => handleOpenFormModal(courseCase)}
                        sx={{ mr: 1 }}
                      >
                        编辑
                      </Button>
                      <Button 
                        variant="text" 
                        color="error"
                        onClick={() => setCaseToDelete(courseCase) && setIsConfirmDialogOpen(true)}
                      >
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {pageCount > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                shape="rounded"
                showFirstButton
                showLastButton
              />
            </Box>
          )}

          <Box sx={{ textAlign: 'center', mt: 2, color: 'text.secondary' }}>
            显示 {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredCases.length)} 条，共 {filteredCases.length} 条
          </Box>
        </>
      )}

      <CourseCaseFormModal
        open={isFormModalOpen}
        onClose={handleCloseFormModal}
        onSave={handleSaveCourseCase}
        courseCase={editingCase}
        categories={categories}
      />

      <CategoryFormModal
        open={isCategoryModalOpen}
        onClose={handleCloseCategoryModal}
        onSave={handleSaveCategory}
        category={editingCategory}
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
        onClose={() => setIsConfirmDialogOpen(false)}
        aria-labelledby="confirm-delete-dialog-title"
      >
        <DialogTitle id="confirm-delete-dialog-title">确认删除课程案例</DialogTitle>
        <DialogContent>
          <DialogContentText>
            您确定要删除课程案例 "{caseToDelete?.title}" 吗？此操作无法撤销，其关联的所有文件也将被移除。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsConfirmDialogOpen(false)} variant="outlined">取消</Button>
          <Button onClick={handleDeleteCourseCase} color="error" variant="contained" autoFocus>
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 附件对话框 */}
      <Dialog
        open={isFilesDialogOpen}
        onClose={handleCloseFilesDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedCaseForFiles?.title} - 附件列表
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>文件名</TableCell>
                  <TableCell>格式</TableCell>
                  <TableCell>大小</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedCaseForFiles?.files.map(file => (
                  <TableRow key={file.id}>
                    <TableCell>{file.name}</TableCell>
                    <TableCell>{file.format.toUpperCase()}</TableCell>
                    <TableCell>{file.size}</TableCell>
                    <TableCell align="right">
                      <Button 
                        variant="text" 
                        color="primary"
                        onClick={() => handleOpenFileViewer(file)}
                      >
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFilesDialog}>关闭</Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
};

export default CourseCasesPage;