"use client";

import React, { useState, useEffect } from 'react';
import { debounce } from 'lodash';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
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
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Pagination from '@mui/material/Pagination';
import SecurityIcon from '@mui/icons-material/Security';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

import { CourseCase, CourseCaseResource, Category, Experiment, CourseCaseResourceFormat, InstanceStatus } from '@/types';
import PageWrapper from '@/components/layout/PageWrapper';
import ResourceViewerModal from '@/components/coursecases/ResourceViewerModal';
import CourseLearnPermissionDialog from '@/components/coursecases/CourseLearnPermissionDialog';
import { apiClientWithToken } from '@/utils/axios';
import { getCookie } from '@/utils/cookie';

const highlightText = (text: string, keyword: string) => {
    if (!keyword || !text) return text;
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span style="color: red">$1</span>');
};

const getFileType = (type: string): CourseCaseResourceFormat => {
    const validExtensions = ['pdf', 'mp4', 'avi', 'pptx', 'docx', 'doc', 'jpg', 'png'];
    if (validExtensions.includes(type.toLowerCase())) {
        return type.toLowerCase() as CourseCaseResourceFormat;
    }
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('mp4')) return 'mp4';
    if (type.includes('x-msvideo') || type.includes('avi')) return 'avi';
    if (type.includes('presentationml.presentation')) return 'pptx';
    if (type.includes('wordprocessingml.document')) return 'docx';
    if (type.includes('msword')) return 'doc';
    if (type.includes('jpeg')) return 'jpg';
    if (type.includes('png')) return 'png';
    return 'other';
};

const CourseLearningPage: React.FC = () => {
    const [courseCases, setCourseCases] = useState<CourseCase[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isResourceViewerOpen, setIsResourceViewerOpen] = useState(false);
    const [viewingResource, setViewingResource] = useState<CourseCaseResource | null>(null);
    const [filterCategoryId, setFilterCategoryId] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCaseForResources, setSelectedCaseForResources] = useState<CourseCase | null>(null);
    const [isResourcesDialogOpen, setIsResourcesDialogOpen] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [tempSearch, setTempSearch] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [totalCases, setTotalCases] = useState<number>(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<CourseCase | null>(null);
    const [experimentStatuses, setExperimentStatuses] = useState<{ [key: string]: InstanceStatus }>({});
    const [isAdmin, setIsAdmin] = useState<boolean>(false); // 标识是否为管理员

    useEffect(() => {
        const debouncedFetchData = debounce(async () => {
            setIsLoading(true);
            setErrorMessage('');
            try {
                const token = getCookie('_auth');
                if (!token) {
                    setErrorMessage('未登录，请先登录');
                    window.location.href = '/login';
                    return;
                }

                // 获取当前用户信息来判断角色
                const userResponse = await apiClientWithToken.get(`/back/api/support/user/me`, {
                    headers: { Authorization: `${token}` },
                });
                const userData = userResponse.data;
                if (userData.code === 200) {
                    const userRoles = userData.data?.role || [];
                    setIsAdmin(userRoles.includes('admin'));
                } else {
                    console.warn('获取用户信息失败:', userData.message);
                }

                // Fetch categories
                const categoriesResponse = await apiClientWithToken.get(`/back/api/study/categories`, {
                    headers: { Authorization: `${token}` },
                });
                const categoriesData = categoriesResponse.data;
                if (categoriesData.code === 200) {
                    setCategories(categoriesData.data.map((cat: { c_category_id: string; c_category_name: string }) => ({
                        c_category_id: cat.c_category_id,
                        c_category_name: cat.c_category_name,
                    })) || []);
                } else {
                    setErrorMessage(`获取类别失败: ${categoriesData.message || '未知错误'}`);
                }

                // Fetch all courses for all users
                const params = {
                    page: currentPage,
                    pageSize: itemsPerPage,
                    ...(searchKeyword && { keyword: searchKeyword }),
                    ...(filterCategoryId && { c_category_id: filterCategoryId }),
                };
                const coursesResponse = await apiClientWithToken.get(`/back/api/study/learn/courses`, {
                    headers: { Authorization: `${token}` },
                    params,
                });
                const coursesData = coursesResponse.data;
                if (coursesData.code === 200 || coursesData.code === 900) {
                    // 检查是否为管理员
                    const isAdminUser = coursesData.data.is_admin || false;
                    setIsAdmin(isAdminUser);
                    
                    const mappedCourses = await Promise.all(
                        (coursesData.data.courses || []).map(async (course: any) => {
                            let resources: CourseCaseResource[] = [];
                            let experiments: Experiment[] = [];
                            try {
                                const resourcesResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/resources`, {
                                    headers: { Authorization: `${token}` },
                                    params: { page: 1, pageSize: 10 },
                                });
                                const resourcesData = resourcesResponse.data;
                                if (resourcesData.code === 200) {
                                    resources = (resourcesData.data.resources || []).map((res: any) => ({
                                        c_resource_id: res.c_resource_id,
                                        c_resource_name: res.c_resource_name,
                                        c_type: getFileType(res.c_type),
                                        c_resource_path: `/back/api/study/resources/${res.c_resource_id}`,
                                        c_size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
                                        isExperimentResource: false,
                                    }));
                                }
                            } catch (error: any) {
                                console.warn(`获取课程 ${course.c_course_id} 的资源失败: ${error.message || '无资源'}`);
                            }
                            try {
                                const experimentsResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/experiments`, {
                                    headers: { Authorization: `${token}` },
                                });
                                const experimentsData = experimentsResponse.data;
                                if (experimentsData.code === 200) {
                                    experiments = await Promise.all(
                                        (experimentsData.data.experiments || []).map(async (exp: any) => {
                                            let status: InstanceStatus = 'stopped';
                                            try {
                                                const instanceResponse = await apiClientWithToken.get(`/back/api/instances?scenario_id=${exp.c_config_id}`, {
                                                    headers: { Authorization: `${token}` },
                                                });
                                                const instanceData = instanceResponse.data;
                                                status = instanceData.length > 0 ? (instanceData[0].status.toLowerCase() as InstanceStatus) : 'stopped';
                                            } catch (error: any) {
                                                console.warn(`获取实验 ${exp.c_experiment_id} 的场景实例状态失败: ${error.message || '无实例'}`);
                                            }
                                            return {
                                                c_experiment_id: exp.c_experiment_id,
                                                c_experiment_name: exp.c_experiment_name,
                                                c_description: exp.c_description || '',
                                                c_config_id: exp.c_config_id,
                                                c_scene_config_id: exp.c_config_id,
                                                c_name: exp.c_name || '',
                                                resources: (exp.resources || []).map((res: any) => ({
                                                    c_resource_id: res.c_resource_id,
                                                    c_resource_name: res.c_resource_name,
                                                    c_type: getFileType(res.c_type),
                                                    c_resource_path: `/back/api/study/experiment-resources/${res.c_resource_id}`,
                                                    c_size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
                                                    isExperimentResource: true,
                                                })),
                                                created_at: exp.created_at || new Date().toISOString(),
                                                status,
                                            };
                                        })
                                    );
                                }
                            } catch (error: any) {
                                console.warn(`获取课程 ${course.c_course_id} 的实验失败: ${error.message || '无实验'}`);
                            }
                            return {
                                c_course_id: course.c_course_id,
                                c_course_name: course.c_course_name,
                                c_description: course.c_description || '',
                                c_category_id: course.c_category_id,
                                c_category_name: course.c_category_name,
                                resources,
                                experiments,
                                created_at: course.created_at || new Date().toISOString(),
                                highlightedTitle: highlightText(course.c_course_name, searchKeyword),
                                highlightedDescription: highlightText(course.c_description || '', searchKeyword),
                            };
                        })
                    );
                    setCourseCases(mappedCourses);
                    setTotalCases(coursesData.data.total || 0);
                    const experimentStatuses: { [key: string]: InstanceStatus } = mappedCourses.reduce((acc: { [key: string]: InstanceStatus }, course) => ({
                        ...acc,
                        ...course.experiments.reduce((expAcc: { [key: string]: InstanceStatus }, exp: Experiment) => ({
                            ...expAcc,
                            [exp.c_experiment_id]: exp.status || 'stopped',
                        }), {}),
                    }), {} as { [key: string]: InstanceStatus });
                    setExperimentStatuses(experimentStatuses);
                } else {
                    setErrorMessage(`获取课程失败: ${coursesData.message || '未知错误'}`);
                }
            } catch (error: any) {
                const message =
                    error.response?.status === 429
                        ? `请求过于频繁，请稍后重试（${error.response?.headers['retry-after'] || 60}秒）`
                        : error.response?.data?.message || error.message || '加载数据失败';
                setErrorMessage(message);
                console.error('Error fetching data:', {
                    message,
                    status: error.response?.status,
                    data: error.response?.data,
                    url: error.config?.url,
                });
            } finally {
                setIsLoading(false);
            }
        }, 500);

        debouncedFetchData();
        return () => debouncedFetchData.cancel();
    }, [currentPage, itemsPerPage, searchKeyword, filterCategoryId]);

    const handleOpenResourcesDialog = async (courseCase: CourseCase) => {  // 移除 tabIndex 参数
    setIsResourcesDialogOpen(true);
    setErrorMessage('');  // 移除 setTabValue(tabIndex);

    try {
        const token = getCookie('_auth');
        if (!token) {
            throw new Error('未登录，请先登录');
        }

        // 获取课程资源
        const resourcesResponse = await apiClientWithToken.get(`/back/api/study/courses/${courseCase.c_course_id}/resources`, {
            headers: { Authorization: `${token}` },
            params: { page: 1, pageSize: 10 },
        });
        const resourcesData = resourcesResponse.data;
        let resources: CourseCaseResource[] = [];
        if (resourcesData.code === 200) {
            resources = (resourcesData.data.resources || []).map((res: any) => ({
                c_resource_id: res.c_resource_id,
                c_resource_name: res.c_resource_name,
                c_type: getFileType(res.c_type),
                c_resource_path: `/back/api/study/resources/${res.c_resource_id}`,
                c_size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
                isExperimentResource: false,
            }));
        } else {
            console.warn(`获取课程 ${courseCase.c_course_id} 的资源失败: ${resourcesData.message || '无资源'}`);
        }

        // 更新 selectedCaseForResources
        setSelectedCaseForResources({
            ...courseCase,
            resources,
            experiments: [], // 不再需要实验数据
        });

        // 更新 courseCases 以保持状态一致
        setCourseCases(prev =>
            prev.map(course =>
                course.c_course_id === courseCase.c_course_id
                    ? { ...course, resources, experiments: [] } // 清空实验数据
                    : course
            )
        );
    } catch (error: any) {
        const message = error.response?.data?.message || error.message || '获取资源失败';
        setErrorMessage(message);
        console.error('Error fetching resources:', {
            message,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url,
        });
    }
};

    const handleOpenPermissionDialog = (course: CourseCase) => {
        setSelectedCourse(course);
        setIsPermissionDialogOpen(true);
    };

    const handleClosePermissionDialog = () => {
        setIsPermissionDialogOpen(false);
        setSelectedCourse(null);
    };

    const handleOpenResourceViewer = (resource: CourseCaseResource) => {
        setViewingResource(resource);
        setIsResourceViewerOpen(true);
    };

    const handleCloseResourceViewer = () => {
        setIsResourceViewerOpen(false);
        setViewingResource(null);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const handleCategoryChange = debounce((event: SelectChangeEvent) => {
        setFilterCategoryId(event.target.value as string);
        setCurrentPage(1);
    }, 300);

    const handleItemsPerPageChange = debounce((event: SelectChangeEvent) => {
        setItemsPerPage(Number(event.target.value));
        setCurrentPage(1);
    }, 300);

    const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
        setCurrentPage(page);
    };

    const handleCloseResourcesDialog = () => {
        setIsResourcesDialogOpen(false);
        setSelectedCaseForResources(null);
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTempSearch(event.target.value);
    };

    const handleSearchSubmit = debounce(() => {
        setSearchKeyword(tempSearch.trim());
        setCurrentPage(1);
    }, 500);


    const getPageNumbers = () => {
        const totalPages = Math.ceil(totalCases / itemsPerPage);
        const pageNumbers = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i);
        }

        return { pageNumbers, totalPages };
    };

    const { pageNumbers, totalPages } = getPageNumbers();

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
            {errorMessage && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
                    {errorMessage}
                </Alert>
            )}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 4,
                    p: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    boxShadow: 1,
                }}
            >
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                        课程学习
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        {isAdmin ? '管理员 - 查看所有课程' : '查看您有权限的课程'}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel id="category-filter-label">分类筛选</InputLabel>
                        <Select
                            labelId="category-filter-label"
                            id="category-filter"
                            value={typeof filterCategoryId === 'string' ? filterCategoryId : ''}
                            label="分类筛选"
                            onChange={handleCategoryChange}
                        >
                            <MenuItem value="">所有分类</MenuItem>
                            {categories.map(category => (
                                <MenuItem key={category.c_category_id} value={category.c_category_id}>
                                    {category.c_category_name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl sx={{ minWidth: 120 }}>
                        <InputLabel id="items-per-page-label">每页条数</InputLabel>
                        <Select
                            labelId="items-per-page-label"
                            id="items-per-page"
                            value={itemsPerPage.toString()}
                            label="每页条数"
                            onChange={handleItemsPerPageChange}
                        >
                            <MenuItem value="10">10 条/页</MenuItem>
                            <MenuItem value="20">20 条/页</MenuItem>
                            <MenuItem value="50">50 条/页</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                        label="搜索课程"
                        variant="outlined"
                        value={tempSearch}
                        onChange={handleSearchChange}
                        onBlur={() => {
                            if (!tempSearch.trim()) {
                                setSearchKeyword('');
                                setCurrentPage(1);
                            }
                        }}
                        sx={{ minWidth: 300 }}
                        placeholder="输入课程名称或描述"
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSearchSubmit}
                        sx={{ height: 40 }}
                    >
                        确认搜索
                    </Button>
                </Box>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>课程名称</TableCell>
                            <TableCell>描述</TableCell>
                            <TableCell>类别</TableCell>
                            <TableCell>创建时间</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {courseCases.map(course => (
                            <TableRow key={course.c_course_id}>
                                <TableCell>
                                    <span dangerouslySetInnerHTML={{ __html: course.highlightedTitle || course.c_course_name }} />
                                </TableCell>
                                <TableCell>
                                    <span dangerouslySetInnerHTML={{ __html: course.highlightedDescription || course.c_description || '-' }} />
                                </TableCell>
                                <TableCell>{course.c_category_name}</TableCell>
                                <TableCell>{formatDate(course.created_at)}</TableCell>
                                <TableCell>
                                    <IconButton
                                        onClick={() => handleOpenResourcesDialog(course)}
                                        title="查看资源"
                                    >
                                        <VisibilityIcon />
                                    </IconButton>
                                    <IconButton onClick={() => handleOpenPermissionDialog(course)} title="查看权限">
                                        <SecurityIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                />
            </Box>
            <Dialog open={isResourcesDialogOpen} onClose={handleCloseResourcesDialog} maxWidth="md" fullWidth>
    <DialogTitle>
        {selectedCaseForResources?.c_course_name} 的资源
    </DialogTitle>
    <DialogContent>
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>课程资源</Typography>
            {selectedCaseForResources?.resources.length ? (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>资源名称</TableCell>
                            <TableCell>类型</TableCell>
                            <TableCell>大小</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {selectedCaseForResources.resources.map(resource => (
                            <TableRow key={resource.c_resource_id}>
                                <TableCell>{resource.c_resource_name}</TableCell>
                                <TableCell>{resource.c_type}</TableCell>
                                <TableCell>{resource.c_size}</TableCell>
                                <TableCell>
                                    <IconButton onClick={() => handleOpenResourceViewer(resource)} title="查看">
                                        <VisibilityIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <Typography color="text.secondary">暂无课程资源</Typography>
            )}
        </Box>
    </DialogContent>
    <DialogActions>
        <Button onClick={handleCloseResourcesDialog}>关闭</Button>
    </DialogActions>
</Dialog>
            <ResourceViewerModal
                open={isResourceViewerOpen}
                onClose={handleCloseResourceViewer}
                resource={viewingResource}
            />
            <CourseLearnPermissionDialog
                open={isPermissionDialogOpen}
                onClose={handleClosePermissionDialog}
                course={selectedCourse}
            />
        </PageWrapper>
    );
};

export default CourseLearningPage;