"use client";

import React, { useState, useEffect } from "react";
import {
    Box, Button, Typography, FormControl, InputLabel, MenuItem, Select, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    CircularProgress, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import { SelectChangeEvent } from "@mui/material/Select";

import { CourseCase, CourseCaseResource, Category } from "@/types";
import PageWrapper from "@/components/layout/PageWrapper";
import { apiClientWithToken } from "@/utils/axios";
import { BACK_IP_PORT } from "@/constants";
import { getCookie } from "@/utils/cookie";
import ResourceViewerModal from "@/components/coursecases/ResourceViewerModal";

const highlightText = (text: string, keyword: string) => {
    if (!keyword || !text) return text;
    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span style="color: red">$1</span>');
};

const CourseLearningPage: React.FC = () => {
    const [courseCases, setCourseCases] = useState<CourseCase[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [tempSearch, setTempSearch] = useState<string>('');
    const [filterCategoryId, setFilterCategoryId] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalCases, setTotalCases] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [viewingResource, setViewingResource] = useState<CourseCaseResource | null>(null);
    const [isResourceViewerOpen, setIsResourceViewerOpen] = useState(false);
    const [selectedCaseForResources, setSelectedCaseForResources] = useState<CourseCase | null>(null);
    const [isResourcesDialogOpen, setIsResourcesDialogOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setErrorMessage('');
            try {
                const token = getCookie("_auth");
                if (!token) {
                    setErrorMessage('未登录，请先登录');
                    setIsLoading(false);
                    return;
                }

                const categoriesRes = await apiClientWithToken.get(`${BACK_IP_PORT}/api/study/categories`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (categoriesRes.data.code === 200) {
                    setCategories(categoriesRes.data.data);
                }

                const params = {
                    page: currentPage,
                    pageSize: itemsPerPage,
                    ...(searchKeyword && { keyword: searchKeyword }),
                    ...(filterCategoryId && { c_category_id: filterCategoryId }),
                };

                const coursesRes = await apiClientWithToken.get(`${BACK_IP_PORT}/api/study/courses`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params,
                });

                if ([200, 900].includes(coursesRes.data.code)) {
                    const mappedCourses = await Promise.all(
                        (coursesRes.data.data.courses || []).map(async (course: any) => {
                            let resources: CourseCaseResource[] = [];
                            try {
                                const res = await apiClientWithToken.get(`${BACK_IP_PORT}/api/study/courses/${course.c_course_id}/resources`, {
                                    headers: { Authorization: `Bearer ${token}` },
                                });
                                if (res.data.code === 200) {
                                    resources = res.data.data.resources.map((r: any) => ({
                                        c_resource_id: r.c_resource_id,
                                        c_resource_name: r.c_resource_name,
                                        c_type: r.c_type?.split('/')?.[1] || 'other',
                                        c_resource_path: `${BACK_IP_PORT}/api/study/resources/${r.c_resource_id}`,
                                        c_size: r.c_size ? `${(r.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
                                    }));
                                }
                            } catch {}
                            return {
                                ...course,
                                resources,
                                highlightedTitle: highlightText(course.c_course_name, searchKeyword),
                                highlightedDescription: highlightText(course.c_description || '', searchKeyword),
                            };
                        })
                    );
                    setCourseCases(mappedCourses);
                    setTotalCases(coursesRes.data.data.total || 0);
                }
            } catch (err: any) {
                setErrorMessage(err.message || '加载失败');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentPage, itemsPerPage, searchKeyword, filterCategoryId]);

    const handleOpenResourceViewer = (resource: CourseCaseResource) => {
        setViewingResource(resource);
        setIsResourceViewerOpen(true);
    };

    const handleCloseResourceViewer = () => {
        setViewingResource(null);
        setIsResourceViewerOpen(false);
    };

    const handleOpenResourcesDialog = (courseCase: CourseCase) => {
        setSelectedCaseForResources(courseCase);
        setIsResourcesDialogOpen(true);
    };

    const handleCloseResourcesDialog = () => {
        setSelectedCaseForResources(null);
        setIsResourcesDialogOpen(false);
    };

    const formatDate = (str: string) => new Date(str).toLocaleDateString("zh-CN");

    const handleCategoryChange = (e: SelectChangeEvent) => {
        setFilterCategoryId(e.target.value);
        setCurrentPage(1);
    };

    const handleItemsPerPageChange = (e: SelectChangeEvent) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempSearch(e.target.value);
    };

    const getPageNumbers = () => {
        const totalPages = Math.ceil(totalCases / itemsPerPage);
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        return { totalPages, pageNumbers: Array.from({ length: end - start + 1 }, (_, i) => start + i) };
    };

    const { pageNumbers, totalPages } = getPageNumbers();

    if (isLoading) {
        return (
            <PageWrapper>
                <Box sx={{ display: "flex", justifyContent: "center", height: "80vh", alignItems: "center" }}>
                    <CircularProgress />
                </Box>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: "bold" }}>课程学习</Typography>
                <Typography variant="subtitle1" color="text.secondary">浏览课程资源</Typography>
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 4 }}>
                <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel id="category-filter-label">分类筛选</InputLabel>
                    <Select
                        labelId="category-filter-label"
                        value={filterCategoryId}
                        label="分类筛选"
                        onChange={handleCategoryChange}
                    >
                        <MenuItem value="">所有分类</MenuItem>
                        {categories.map(c => (
                            <MenuItem key={c.c_category_id} value={c.c_category_id}>{c.c_category_name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {filterCategoryId && (
                    <Chip
                        label={`当前筛选: ${categories.find(c => c.c_category_id === filterCategoryId)?.c_category_name || '未知分类'}`}
                        onDelete={() => setFilterCategoryId("")}
                        color="primary"
                    />
                )}

                <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel id="items-per-page-label">每页条数</InputLabel>
                    <Select
                        labelId="items-per-page-label"
                        value={itemsPerPage.toString()}
                        label="每页条数"
                        onChange={handleItemsPerPageChange}
                    >
                        {[10, 20, 50].map(n => (
                            <MenuItem key={n} value={n}>{n} 条/页</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField
                    label="搜索课程"
                    value={tempSearch}
                    onChange={handleSearchChange}
                    onBlur={() => {
                        if (!tempSearch.trim()) {
                            setSearchKeyword('');
                            setCurrentPage(1);
                        }
                    }}
                    sx={{ minWidth: 300 }}
                />
                <Button variant="contained" onClick={() => {
                    setSearchKeyword(tempSearch.trim());
                    setCurrentPage(1);
                }}>确认搜索</Button>
            </Box>

            {courseCases.length === 0 ? (
                <Typography variant="body1" align="center" color="text.secondary">暂无课程内容</Typography>
            ) : (
                <>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'primary.main', '& th': { color: 'white' } }}>
                                    <TableCell>标题</TableCell>
                                    <TableCell>分类</TableCell>
                                    <TableCell>描述</TableCell>
                                    <TableCell>日期</TableCell>
                                    <TableCell>资源数</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {courseCases.map(c => (
                                    <TableRow key={c.c_course_id}>
                                        <TableCell dangerouslySetInnerHTML={{ __html: c.highlightedTitle }} />
                                        <TableCell>{c.c_category_name}</TableCell>
                                        <TableCell sx={{ maxWidth: 300 }} dangerouslySetInnerHTML={{ __html: c.highlightedDescription }} />
                                        <TableCell>{formatDate(c.created_at)}</TableCell>
                                        <TableCell>
                                            <Button onClick={() => handleOpenResourcesDialog(c)}>
                                                {c.resources?.length || 0} 个
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 1 }}>
                        <Button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>{'<'}</Button>
                        {pageNumbers.map(p => (
                            <Button key={p} variant={p === currentPage ? "contained" : "outlined"} onClick={() => setCurrentPage(p)}>{p}</Button>
                        ))}
                        {totalPages > pageNumbers.length && (
                            <>
                                <span>...</span>
                                <Button onClick={() => setCurrentPage(totalPages)}>{totalPages}</Button>
                            </>
                        )}
                        <Button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>{'>'}</Button>
                    </Box>
                    <Box sx={{ mt: 1 }}>共 {totalCases} 条</Box>
                </>
            )}

            {viewingResource && (
                <ResourceViewerModal
                    open={isResourceViewerOpen}
                    onClose={handleCloseResourceViewer}
                    resource={viewingResource}
                />
            )}

            <Dialog open={isResourcesDialogOpen} onClose={handleCloseResourcesDialog} maxWidth="md" fullWidth>
                <DialogTitle>{selectedCaseForResources?.c_course_name} - 资源列表</DialogTitle>
                <DialogContent>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>名称</TableCell>
                                <TableCell>格式</TableCell>
                                <TableCell>大小</TableCell>
                                <TableCell align="right">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {selectedCaseForResources?.resources?.map(r => (
                                <TableRow key={r.c_resource_id}>
                                    <TableCell>{r.c_resource_name}</TableCell>
                                    <TableCell>{r.c_type?.toUpperCase()}</TableCell>
                                    <TableCell>{r.c_size}</TableCell>
                                    <TableCell align="right">
                                        <Button onClick={() => handleOpenResourceViewer(r)}>查看</Button>
                                    </TableCell>
                                </TableRow>
                            )) || (
                                <TableRow>
                                    <TableCell colSpan={4} align="center">无资源</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseResourcesDialog}>关闭</Button>
                </DialogActions>
            </Dialog>
        </PageWrapper>
    );
};

export default CourseLearningPage;
