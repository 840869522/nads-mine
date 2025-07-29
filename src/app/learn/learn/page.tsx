"use client";

import React, { useState, useEffect } from 'react';
import { debounce } from 'lodash';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Pagination from '@mui/material/Pagination';
import CircularProgress from '@mui/material/CircularProgress';
import PageWrapper from '@/components/layout/PageWrapper';
import ResourceViewerModal from '@/components/coursecases/ResourceViewerModal';
import { apiClientWithToken } from '@/utils/axios';
import { BACK_IP_PORT } from '@/constants';
import { getCookie } from '@/utils/cookie';
import { CourseCase, CourseCaseResource } from '@/types';

const highlightText = (text: string, keyword: string) => {
    if (!keyword || !text) return text;
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span style="color: red">$1</span>');
};

const getFileType = (type: string): string => {
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('mp4')) return 'mp4';
    return 'other';
};

const CourseLearningPage: React.FC = () => {
    const [courseCases, setCourseCases] = useState<CourseCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isResourceViewerOpen, setIsResourceViewerOpen] = useState(false);
    const [viewingResource, setViewingResource] = useState<CourseCaseResource | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCases, setTotalCases] = useState<number>(0);
    const [itemsPerPage] = useState(10);
    const [userRole, setUserRole] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchUserRole = async () => {
            const token = getCookie('_auth');
            if (!token) {
                router.push('/login');
                return;
            }
            try {
                const response = await apiClientWithToken.get(`/back/api/support/user/id`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const userData = response.data;
                if (userData.code === 200) {
                    const roles = userData.data.roles || [];
                    setUserRole(roles.includes('admin') ? 'admin' : 'student');
                } else {
                    setUserRole('student');
                }
            } catch (error) {
                console.error('Failed to fetch user role:', error);
                setUserRole('student');
            }
        };

        fetchUserRole();
    }, [router]);

    useEffect(() => {
        if (userRole === 'admin') {
            router.push('/course-cases'); // 管理员重定向到课程案例页面
        }
    }, [userRole, router]);

    useEffect(() => {
        if (userRole !== 'student') return;

        const debouncedFetchData = debounce(async () => {
            setIsLoading(true);
            try {
                const token = getCookie('_auth');
                if (!token) {
                    window.location.href = '/login';
                    return;
                }

                const params = { page: currentPage, pageSize: itemsPerPage };
                const coursesResponse = await apiClientWithToken.get(`/back/api/study/courses`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params,
                });
                const coursesData = coursesResponse.data;
                if (coursesData.code === 200) {
                    const mappedCourses = await Promise.all(
                        (coursesData.data.courses || []).map(async (course: any) => {
                            let resources: CourseCaseResource[] = [];
                            try {
                                const resourcesResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/resources`, {
                                    headers: { Authorization: `Bearer ${token}` },
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
                                    }));
                                }
                            } catch (error) {
                                console.warn(`获取课程 ${course.c_course_id} 的资源失败`);
                            }
                            return {
                                c_course_id: course.c_course_id,
                                c_course_name: course.c_course_name,
                                c_description: course.c_description || '',
                                c_category_name: course.c_category_name,
                                resources,
                                created_at: course.uploadDate || new Date().toISOString(),
                            };
                        })
                    );
                    setCourseCases(mappedCourses);
                    setTotalCases(coursesData.data.total || 0);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        }, 500);

        debouncedFetchData();
        return () => debouncedFetchData.cancel();
    }, [currentPage, userRole]);

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

    const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
        setCurrentPage(page);
    };

    if (isLoading || userRole === null) {
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
            <Box sx={{ mb: 4, p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
                    课程学习
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    查看你的课程内容
                </Typography>
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
                                <TableCell>{course.c_course_name}</TableCell>
                                <TableCell>{course.c_description || '-'}</TableCell>
                                <TableCell>{course.c_category_name}</TableCell>
                                <TableCell>{formatDate(course.created_at)}</TableCell>
                                <TableCell>
                                    <IconButton
                                        onClick={() => handleOpenResourceViewer(course.resources[0])}
                                        title="查看资源"
                                        disabled={!course.resources.length}
                                    >
                                        <VisibilityIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                    count={Math.ceil(totalCases / itemsPerPage)}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                />
            </Box>

            <ResourceViewerModal
                open={isResourceViewerOpen}
                onClose={handleCloseResourceViewer}
                resource={viewingResource}
            />
        </PageWrapper>
    );
};

export default CourseLearningPage;