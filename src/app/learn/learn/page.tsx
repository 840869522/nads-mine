"use client";

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import { CourseCase, CourseCaseFile } from '@/types';
import PageWrapper from '@/components/layout/PageWrapper';
import { apiClientWithToken } from '@/utils/axios';
import { BACK_IP_PORT } from '@/constants';

const CourseLearningPage: React.FC = () => {
    const [courses, setCourses] = useState<CourseCase[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<CourseCase | null>(null);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<string>('');

    // Fetch categories and user's courses on mount or when search changes
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch categories
                const categoriesResponse = await apiClientWithToken.get('/back/api/study/categories');
                const categoriesData = categoriesResponse.data;
                if (categoriesData.code === 200) {
                    setCategories(categoriesData.data.map((cat: { c_category_id: string; c_category_name: string }) => cat.c_category_name));
                } else {
                    console.error('Failed to fetch categories:', categoriesData.message);
                }

                // Fetch user's courses (linked via c_courses_users)
                const coursesResponse = await apiClientWithToken.get('/back/api/study/user/courses', {
                    params: { keyword: searchKeyword },
                });
                const coursesData = coursesResponse.data;
                if (coursesData.code === 200) {
                    const mappedCourses = await Promise.all(
                        coursesData.data.map(async (course: any) => {
                            const resourcesResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/resources`);
                            const resourcesData = resourcesResponse.data;
                            const files = resourcesData.code === 200 ? resourcesData.data.map((res: any) => ({
                                id: res.c_resource_id,
                                name: res.c_resource_name,
                                format: res.c_type.split('/')[1] || 'other',
                                url: `/back/resources/${res.c_resource_id}`,
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
                    setCourses(mappedCourses);
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
    }, [searchKeyword]);

    const handleOpenDetailDialog = (course: CourseCase) => {
        setSelectedCourse(course);
        setIsDetailDialogOpen(true);
    };

    const handleCloseDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setSelectedCourse(null);
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchKeyword(event.target.value);
    };

    const handleCategoryChange = (event: SelectChangeEvent) => {
        setFilterCategory(event.target.value as string);
    };

    const filteredCourses = filterCategory
        ? courses.filter(c => c.category === filterCategory)
        : courses;

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
                        课程学习
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        查看您的课程
                    </Typography>
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

            {filteredCourses.length === 0 ? (
                <Box sx={{ textAlign: 'center', mt: 8, p: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
                    <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                        您当前没有可查看的课程。
                    </Typography>
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'primary.main', '& th': { color: 'primary.contrastText' } }}>
                                <TableCell>课程标题</TableCell>
                                <TableCell>分类</TableCell>
                                <TableCell>描述</TableCell>
                                <TableCell>上传日期</TableCell>
                                <TableCell>附件数量</TableCell>
                                <TableCell align="right">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredCourses.map(course => (
                                <TableRow key={course.id} hover>
                                    <TableCell sx={{ fontWeight: 'medium' }}>{course.title}</TableCell>
                                    <TableCell>{categories.find(cat => cat === course.category) || '未知分类'}</TableCell>
                                    <TableCell sx={{ maxWidth: 300 }}>{course.description || "暂无描述"}</TableCell>
                                    <TableCell>{new Date(course.uploadDate).toLocaleDateString('zh-CN')}</TableCell>
                                    <TableCell>{course.files.length} 个</TableCell>
                                    <TableCell align="right">
                                        <Button variant="text" color="primary" onClick={() => handleOpenDetailDialog(course)}>
                                            查看详情
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Course Detail Dialog */}
            {selectedCourse && (
                <Dialog open={isDetailDialogOpen} onClose={handleCloseDetailDialog} maxWidth="md" fullWidth>
                    <DialogTitle>{selectedCourse.title} - 课程详情</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            <strong>描述：</strong> {selectedCourse.description || "暂无描述"}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            <strong>分类：</strong> {categories.find(cat => cat === selectedCourse.category) || "未知分类"}
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            <strong>上传日期：</strong> {new Date(selectedCourse.uploadDate).toLocaleDateString('zh-CN')}
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>课程资源</Typography>
                        {selectedCourse.files.length > 0 ? (
                            <TableContainer component={Paper}>
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
                                        {selectedCourse.files.map(file => (
                                            <TableRow key={file.id}>
                                                <TableCell>{file.name}</TableCell>
                                                <TableCell>{file.format.toUpperCase()}</TableCell>
                                                <TableCell>{file.size}</TableCell>
                                                <TableCell align="right">
                                                    <Button variant="text" color="primary" href={file.url} target="_blank">
                                                        查看
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                暂无资源
                            </Typography>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDetailDialog}>关闭</Button>
                    </DialogActions>
                </Dialog>
            )}
        </PageWrapper>
    );
};

export default CourseLearningPage;