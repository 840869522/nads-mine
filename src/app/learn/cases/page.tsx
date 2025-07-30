"use client";

import React, { useState, useEffect } from 'react';
import { debounce } from 'lodash';
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
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import Pagination from '@mui/material/Pagination';
import SecurityIcon from '@mui/icons-material/Security';


import { CourseCase, CourseCaseResource, Category, Experiment, CourseCaseResourceFormat } from '@/types';
import CourseCaseFormModal from '@/components/coursecases/CourseCaseFormModal';
import CategoryFormModal from '@/components/coursecases/CategoryFormModal';
import ExperimentFormModal from '@/components/coursecases/ExperimentFormModal';
import PageWrapper from '@/components/layout/PageWrapper';
import ResourceViewerModal from '@/components/coursecases/ResourceViewerModal';
import CoursePermissionDialog from '@/components/coursecases/CoursePermissionDialog';
import { apiClientWithToken } from '@/utils/axios';
//import { BACK_IP_PORT } from '@/constants';
import { getCookie } from '@/utils/cookie';

const highlightText = (text: string, keyword: string) => {
  if (!keyword || !text) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<span style="color: red">$1</span>');
};
const getFileType = (type: string): CourseCaseResourceFormat => {
  // 如果已经是扩展名，直接返回
  const validExtensions = ['pdf', 'mp4', 'avi', 'pptx', 'docx', 'doc', 'jpg', 'png'];
  if (validExtensions.includes(type.toLowerCase())) {
    return type.toLowerCase() as CourseCaseResourceFormat;
  }
  // 处理 MIME 类型
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('x-msvideo') || type.includes('avi')) return 'avi';
  if (type.includes('presentationml.presentation')) return 'pptx';
  if (type.includes('wordprocessingml.document')) return 'docx';
  if (type.includes('msword')) return 'doc';
  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('png')) return 'png';
  return 'other'; // 未知类型返回 'other'
};

const CourseCasesPage: React.FC = () => {
  const [courseCases, setCourseCases] = useState<CourseCase[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sceneConfigs, setSceneConfigs] = useState<{ c_config_id: number; c_name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isExperimentModalOpen, setIsExperimentModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CourseCase | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isResourceViewerOpen, setIsResourceViewerOpen] = useState(false);
  const [viewingResource, setViewingResource] = useState<CourseCaseResource | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<CourseCase | null>(null);
  const [experimentToDelete, setExperimentToDelete] = useState<Experiment | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCaseForResources, setSelectedCaseForResources] = useState<CourseCase | null>(null);
  const [isResourcesDialogOpen, setIsResourcesDialogOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [tempSearch, setTempSearch] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [totalCases, setTotalCases] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [tabValue, setTabValue] = useState(0);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseCase | null>(null);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    const debouncedFetchData = debounce(async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const token = getCookie('_auth');
        if (!token) {
          setErrorMessage('未登录，请先登录');
          window.location.href = '/login';
          setIsLoading(false);
          return;
        }

        // Fetch categories
        const categoriesResponse = await apiClientWithToken.get(`/back/api/study/categories`, {
          headers: { Authorization: `Bearer ${token}` },
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

        // Fetch scene configs
        const sceneConfigsResponse = await apiClientWithToken.get(`/back/api/scenarios`, {
          headers: { Authorization: `Bearer ${token}` },

        });
        const sceneConfigsData = sceneConfigsResponse.data;
        try {
          setSceneConfigs(sceneConfigsData.map((config: { id: number; name: string }) => ({
            c_config_id: config.id,
            c_name: config.name,
          })) || []);
        } catch (error: any) {
          setErrorMessage(`获取场景配置失败: ${error.message || '未知错误'}`);
        }

        // Fetch courses
        const params = {
          page: currentPage,
          pageSize: itemsPerPage,
          ...(searchKeyword && { keyword: searchKeyword }),
          ...(filterCategoryId && { c_category_id: filterCategoryId }),
        };
        const coursesResponse = await apiClientWithToken.get(`/back/api/study/courses`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        const coursesData = coursesResponse.data;
        if (coursesData.code === 200 || coursesData.code === 900) {
          const mappedCourses = await Promise.all(
              (coursesData.data.courses || []).map(async (course: any) => {
                let resources: CourseCaseResource[] = [];
                let experiments: Experiment[] = [];
                try {
                  const resourcesResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/resources`, {

                    headers: { Authorization: `Bearer ${token}` },
                    params: {
                      page: 1,
                      pageSize: 10
                    }
                  });
                  const resourcesData = resourcesResponse.data;
                  if (resourcesData.code === 200) {
                    resources = (resourcesData.data.resources || []).map((res: any) => ({
                      c_resource_id: res.c_resource_id,
                      c_resource_name: res.c_resource_name,
                      c_type: getFileType(res.c_type),
                      c_resource_path: `/back/api/study/resources/${res.c_resource_id}`,
                      c_size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
                      isExperimentResource: false, // 标记为课程资源
                    }));
                  }
                } catch (error: any) {
                  console.warn(`获取课程 ${course.c_course_id} 的资源失败: ${error.message || '无资源'}`);
                }
                try {
                  const experimentsResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/experiments`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const experimentsData = experimentsResponse.data;
                  if (experimentsData.code === 200) {
                    experiments = (experimentsData.data.experiments || []).map((exp: any) => ({
                      c_experiment_id: exp.c_experiment_id,
                      c_experiment_name: exp.c_experiment_name,
                      c_description: exp.c_description || '',
                      c_config_id: exp.c_config_id,
                      c_name: exp.c_name || '',
                      resources: (exp.resources || []).map((res: any) => ({
                        c_resource_id: res.c_resource_id,
                        c_resource_name: res.c_resource_name,
                        c_type: getFileType(res.c_type),
                        c_resource_path: `/back/api/study/experiment-resources/${res.c_resource_id}`,
                        c_size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
                        isExperimentResource: true, // 标记为实验资源
                      })),
                      created_at: exp.created_at || new Date().toISOString(),
                    }));
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
    return () => debouncedFetchData.cancel(); // 清理防抖函数
  }, [currentPage, itemsPerPage, searchKeyword, filterCategoryId]);

  const handleOpenFormModal = (courseCase?: CourseCase) => {
    setEditingCase(courseCase || null);
    setIsFormModalOpen(true);
  };

  const handleOpenCategoryModal = (category?: Category) => {
    setEditingCategory(category || null);
    setIsCategoryModalOpen(true);
  };
  const handleOpenCategoryManagement = () => {
    setIsCategoryManagementOpen(true);
  };

  const handleCloseCategoryManagement = () => {
    setIsCategoryManagementOpen(false);
  };
  const handleOpenExperimentModal = (courseId: string, experiment?: Experiment) => {
    setSelectedCourseId(courseId);
    setEditingExperiment(experiment || null);
    setIsExperimentModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditingCase(null);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleCloseExperimentModal = () => {
    setIsExperimentModalOpen(false);
    setEditingExperiment(null);
    setSelectedCourseId(null);
  };
  const handleOpenPermissionDialog = (course: CourseCase) => {
    setSelectedCourse(course);
    setIsPermissionDialogOpen(true);
  };

  const handleClosePermissionDialog = () => {
    setIsPermissionDialogOpen(false);
    setSelectedCourse(null);
  };
  // 添加 handlePermissionSaveSuccess
  const handlePermissionSaveSuccess = () => {
    setErrorMessage('权限保存成功');
    setTimeout(() => setErrorMessage(''), 3000); // 3秒后清除提示
  };

  const handleSaveExperiment = async (experiment: Experiment, courseId: string) => {
    try {
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }
      if (!courseId || courseId === 'new') {
        throw new Error('请先保存课程后再添加实验');
      }

      console.log('Saving experiment:', {
        courseId,
        experimentData: {
          c_experiment_name: experiment.c_experiment_name,
          c_description: experiment.c_description,
          c_config_id: experiment.c_config_id,
        },
      });

      const experimentData = {
        c_experiment_name: experiment.c_experiment_name,
        c_description: experiment.c_description,
        c_config_id: experiment.c_config_id,
      };

      let experimentId = experiment.c_experiment_id;
      if (experiment.c_experiment_id.startsWith('temp-id-')) {
        const response = await apiClientWithToken.post(`/back/api/study/courses/${courseId}/experiments`, experimentData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code !== 201) {
          throw new Error(`创建实验失败: ${data.message || '未知错误'}`);
        }
        experimentId = data.data.c_experiment_id;
        setErrorMessage('实验创建成功，用户权限已同步'); // 添加提示
        setTimeout(() => setErrorMessage(''), 3000);
      } else {
        const response = await apiClientWithToken.put(`/back/api/study/courses/${courseId}/experiments/${experiment.c_experiment_id}`, experimentData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code !== 200) {
          throw new Error(`更新实验失败: ${data.message || '未知错误'}`);
        }
      }

      if (experiment.resources?.length > 0) {
        for (const resource of experiment.resources) {
          if (resource.fileObject) {
            const formData = new FormData();
            formData.append('c_course_id', courseId);
            formData.append('c_experiment_id', experimentId);
            formData.append('file', resource.fileObject);
            const response = await apiClientWithToken.post(`/back/api/study/courses/${courseId}/experiments/${experimentId}/resources/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${token}`,
              },
            });
            const data = response.data;
            if (data.code !== 201) {
              console.warn('Failed to upload experiment resource:', data.message);
            }
          }
        }
      }

      // Refresh experiment list
      const coursesResponse = await apiClientWithToken.get(`/back/api/study/courses/${courseId}/experiments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const experimentsData = coursesResponse.data;
      if (experimentsData.code === 200) {
        setCourseCases(prev =>
            prev.map(course => {
              if (course.c_course_id === courseId) {
                return {
                  ...course,
                  experiments: experimentsData.data.experiments.map((exp: any) => ({
                    c_experiment_id: exp.c_experiment_id,
                    c_experiment_name: exp.c_experiment_name,
                    c_description: exp.c_description,
                    c_config_id: exp.c_config_id,
                    c_name: exp.c_name,
                    resources: exp.resources || [],
                    created_at: exp.created_at,
                  })),
                };
              }
              return course;
            })
        );
      } else {
        throw new Error(`刷新实验列表失败: ${experimentsData.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '保存实验失败';
      setErrorMessage(message);
      console.error('Error saving experiment:', error.response?.status, error.response?.data, error.config?.url);
    }
    handleCloseExperimentModal();
  };

  const handleSaveCourseCase = async (savedCase: CourseCase) => {
    try {
      const { c_course_id, c_course_name, c_description, c_category_id, resources } = savedCase;
      const courseData = {
        c_course_id,
        c_course_name,
        c_description,
        c_category_id,
      };

      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }

      let courseId = c_course_id;
      if (editingCase) {
        const response = await apiClientWithToken.put(`/back/api/study/courses/${c_course_id}`, courseData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code !== 200) {
          throw new Error(`更新课程失败: ${data.message || '未知错误'}`);
        }
      } else {
        const response = await apiClientWithToken.post(`/back/api/study/courses`, courseData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code !== 201) {
          throw new Error(`创建课程失败: ${data.message || '未知错误'}`);
        }
        courseId = data.data.c_course_id;
      }

      if (resources.length > 0) {
        for (const resource of resources) {
          if (resource.fileObject) {
            const formData = new FormData();
            formData.append('c_course_id', courseId);
            formData.append('file', resource.fileObject);
            const response = await apiClientWithToken.post(`/back/api/study/courses/${courseId}/resources/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`,
              },
            });
            const data = response.data;
            if (data.code !== 201) {
              console.warn('Failed to upload resource:', data.message);
            }
          }
        }
      }

      // 刷新课程列表
      const coursesResponse = await apiClientWithToken.get(`/back/api/study/courses`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: currentPage,
          pageSize: itemsPerPage, // 使用动态每页条数
          ...(searchKeyword && { keyword: searchKeyword }),
          ...(filterCategoryId && { c_category_id: filterCategoryId }),
        },
      });
      const coursesData = coursesResponse.data;
      if (coursesData.code === 200 || coursesData.code === 900) {
        const mappedCourses = await Promise.all(
            (coursesData.data.courses || []).map(async (course: any) => {
              let resources: CourseCaseResource[] = [];
              let experiments: Experiment[] = [];
              try {
                const resourcesResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/resources`, {
                  headers: { Authorization: `Bearer ${token}` },
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
              } catch (error: any) {
                console.warn(`获取课程 ${course.c_course_id} 的资源失败: ${error.message || '无资源'}`);
              }
              try {
                const experimentsResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/experiments`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const experimentsData = experimentsResponse.data;
                if (experimentsData.code === 200) {
                  experiments = (experimentsData.data.experiments || []).map((exp: any) => ({
                    c_experiment_id: exp.c_experiment_id,
                    c_experiment_name: exp.c_experiment_name,
                    c_description: exp.c_description || '',
                    c_config_id: exp.c_config_id,
                    c_name: exp.c_name || '',
                    resources: (exp.resources || []).map((res: any) => ({
                      c_resource_id: res.c_resource_id,
                      c_resource_name: res.c_resource_name,
                      c_type: getFileType(res.c_type),
                      c_resource_path: `/back/api/study/resources/${res.c_resource_id}`,
                      c_size: res.c_size ? `${(res.c_size / (1024 * 1024)).toFixed(2)} MB` : '未知',
                    })),
                    created_at: exp.created_at || new Date().toISOString(),
                  }));
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
      } else {
        throw new Error(`刷新课程列表失败: ${coursesData.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '保存课程案例失败';
      setErrorMessage(message);
      console.error('Error saving course case:', error.response?.status, error.response?.data, error.config?.url);
    }
    handleCloseFormModal();
  };
  const handleRefreshCategories = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }
      const response = await apiClientWithToken.get(`/back/api/study/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      if (data.code === 200) {
        setCategories(data.data.map((cat: { c_category_id: string; c_category_name: string }) => ({
          c_category_id: cat.c_category_id,
          c_category_name: cat.c_category_name,
        })) || []);
      } else {
        throw new Error(`刷新类别失败: ${data.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '刷新类别失败';
      setErrorMessage(message);
      console.error('Error refreshing categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshCourses = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }
      const params = {
        page: currentPage,
        pageSize: itemsPerPage,
        ...(searchKeyword && { keyword: searchKeyword }),
        ...(filterCategoryId && { c_category_id: filterCategoryId }),
      };
      const response = await apiClientWithToken.get(`/back/api/study/courses`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const data = response.data;
      if (data.code === 200 || data.code === 900) {
        const mappedCourses = await Promise.all(
            (data.data.courses || []).map(async (course: any) => {
              let resources: CourseCaseResource[] = [];
              let experiments: Experiment[] = [];
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
                    isExperimentResource: false,
                  }));
                }
              } catch (error: any) {
                console.warn(`获取课程 ${course.c_course_id} 的资源失败: ${error.message || '无资源'}`);
              }
              try {
                const experimentsResponse = await apiClientWithToken.get(`/back/api/study/courses/${course.c_course_id}/experiments`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                const experimentsData = experimentsResponse.data;
                if (experimentsData.code === 200) {
                  experiments = (experimentsData.data.experiments || []).map((exp: any) => ({
                    c_experiment_id: exp.c_experiment_id,
                    c_experiment_name: exp.c_experiment_name,
                    c_description: exp.c_description || '',
                    c_config_id: exp.c_config_id,
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
                  }));
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
        setTotalCases(data.data.total || 0);
      } else {
        throw new Error(`刷新课程失败: ${data.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '刷新课程失败';
      setErrorMessage(message);
      console.error('Error refreshing courses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshExperiments = async (courseId: string) => {
    try {
      setIsLoading(true);
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }
      const response = await apiClientWithToken.get(`/back/api/study/courses/${courseId}/experiments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      if (data.code === 200) {
        setCourseCases(prev =>
            prev.map(course => {
              if (course.c_course_id === courseId) {
                return {
                  ...course,
                  experiments: data.data.experiments.map((exp: any) => ({
                    c_experiment_id: exp.c_experiment_id,
                    c_experiment_name: exp.c_experiment_name,
                    c_description: exp.c_description || '',
                    c_config_id: exp.c_config_id,
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
                  })),
                };
              }
              return course;
            })
        );
      } else {
        throw new Error(`刷新实验失败: ${data.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '刷新实验失败';
      setErrorMessage(message);
      console.error('Error refreshing experiments:', error);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSaveCategory = async (category: Category) => {
    try {
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }
      if (!category.c_category_name || category.c_category_name.trim() === '') {
        throw new Error('类别名称不能为空');
      }
      if (category.c_category_name.length > 50) {
        throw new Error('类别名称不能超过50个字符');
      }

      if (category.c_category_id) {
        const response = await apiClientWithToken.put(`/back/api/study/categories/${category.c_category_id}`, {
          c_category_name: category.c_category_name,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code === 200) {
          setCategories(prev => prev.map(cat => (cat.c_category_id === category.c_category_id ? category : cat)));
        } else {
          throw new Error(`更新类别失败: ${data.message || '未知错误'}`);
        }
      } else {
        const response = await apiClientWithToken.post(`/back/api/study/categories`, {
          c_category_name: category.c_category_name,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code === 201) {
          setCategories(prev => [...prev, { c_category_id: data.data.c_category_id, c_category_name: category.c_category_name }]);
        } else {
          throw new Error(`创建类别失败: ${data.message || '未知错误'}`);
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '保存类别失败';
      setErrorMessage(message);
      console.error('Error saving category:', error.response?.status, error.response?.data, error.config?.url);
    }
    handleCloseCategoryModal();
  };
  const handleDeleteCategory = async () => {
    if (categoryToDelete) {
      try {
        const token = getCookie('_auth');
        if (!token) {
          throw new Error('未登录，请先登录');
        }
        const response = await apiClientWithToken.delete(`/back/api/study/categories/${categoryToDelete.c_category_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code === 200) {
          setCategories(prev => prev.filter(cat => cat.c_category_id !== categoryToDelete.c_category_id));
          setCourseCases(prev => prev.filter(course => course.c_category_id !== categoryToDelete.c_category_id));
          setErrorMessage('类别删除成功');
          setTimeout(() => setErrorMessage(''), 3000);
        } else {
          throw new Error(`删除类别失败: ${data.message || '未知错误'}`);
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || '删除类别失败';
        setErrorMessage(message);
        console.error('Error deleting category:', error.response?.status, error.response?.data, error.config?.url);
      }
    }
    setCategoryToDelete(null);
    setIsConfirmDialogOpen(false);
  };
  const handleConfirmDelete = () => {
    if (experimentToDelete) {
      handleDeleteExperiment();
    } else if (caseToDelete) {
      handleDeleteCourseCase();
    } else if (categoryToDelete) {
      handleDeleteCategory();
    }
  };
  const handleDeleteCourseCase = async () => {
    if (caseToDelete) {
      try {
        const token = getCookie('_auth');
        if (!token) {
          throw new Error('未登录，请先登录');
        }
        caseToDelete.resources.forEach(resource => {
          if (resource.c_resource_path && resource.c_resource_path.startsWith('blob:') && resource.fileObject) {
            URL.revokeObjectURL(resource.c_resource_path);
          }
        });
        const response = await apiClientWithToken.delete(`/back/api/study/courses/${caseToDelete.c_course_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        if (data.code === 200) {
          setCourseCases(prevCases => prevCases.filter(c => c.c_course_id !== caseToDelete.c_course_id));
        } else {
          throw new Error(`删除课程失败: ${data.message || '未知错误'}`);
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || '删除课程案例失败';
        setErrorMessage(message);
        console.error('Error deleting course case:', error.response?.status, error.response?.data, error.config?.url);
      }
    }
    setCaseToDelete(null);
    setIsConfirmDialogOpen(false);
  };

  const handleDeleteExperiment = async () => {
    if (experimentToDelete && selectedCaseForResources) {
      try {
        const token = getCookie('_auth');
        if (!token) {
          throw new Error('未登录，请先登录');
        }
        const response = await apiClientWithToken.delete(
            `/back/api/study/courses/${selectedCaseForResources.c_course_id}/experiments/${experimentToDelete.c_experiment_id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
        );
        const data = response.data;
        if (data.code === 200) {
          setCourseCases(prev =>
              prev.map(course => {
                if (course.c_course_id === selectedCaseForResources.c_course_id) {
                  return {
                    ...course,
                    experiments: course.experiments?.filter(exp => exp.c_experiment_id !== experimentToDelete.c_experiment_id) || [],
                  };
                }
                return course;
              })
          );
        } else {
          throw new Error(`删除实验失败: ${data.message || '未知错误'}`);
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || '删除实验失败';
        setErrorMessage(message);
        console.error('Error deleting experiment:', error.response?.status, error.response?.data, error.config?.url);
      }
    }
    setExperimentToDelete(null);
    setIsConfirmDialogOpen(false);
  };

  const handleDeleteResource = async (resource: CourseCaseResource, isExperimentResource: boolean, experimentId?: string) => {
    try {
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }
      if (!selectedCaseForResources) {
        throw new Error('未选择课程');
      }

      let url = '';
      if (isExperimentResource && experimentId) {
        url = `/back/api/study/courses/${selectedCaseForResources.c_course_id}/experiments/${experimentId}/resources/${resource.c_resource_id}`;
      } else {
        url = `/back/api/study/courses/${selectedCaseForResources.c_course_id}/resources/${resource.c_resource_id}`;
      }

      const response = await apiClientWithToken.delete(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      if (data.code === 200) {
        setCourseCases(prev =>
            prev.map(course => {
              if (course.c_course_id === selectedCaseForResources.c_course_id) {
                if (isExperimentResource && experimentId) {
                  return {
                    ...course,
                    experiments: course.experiments?.map(exp => {
                      if (exp.c_experiment_id === experimentId) {
                        return {
                          ...exp,
                          resources: exp.resources.filter(r => r.c_resource_id !== resource.c_resource_id),
                        };
                      }
                      return exp;
                    }) || [],
                  };
                } else {
                  return {
                    ...course,
                    resources: course.resources.filter(r => r.c_resource_id !== resource.c_resource_id),
                  };
                }
              }
              return course;
            })
        );
      } else {
        throw new Error(`删除资源失败: ${data.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '删除资源失败';
      setErrorMessage(message);
      console.error('Error deleting resource:', error.response?.status, error.response?.data, error.config?.url);
    }
  };

  const handleOpenResourceViewer = (resource: CourseCaseResource) => {
    let updatedResource = resource;
    if (!resource.c_resource_path && resource.fileObject) {
      updatedResource = { ...resource, c_resource_path: URL.createObjectURL(resource.fileObject) };
    }
    setViewingResource(updatedResource);
    setIsResourceViewerOpen(true);
  };

  const handleCloseResourceViewer = () => {
    if (viewingResource?.c_resource_path && viewingResource.c_resource_path.startsWith('blob:') && viewingResource.fileObject) {
      URL.revokeObjectURL(viewingResource.c_resource_path);
    }
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
    setCurrentPage(1); // 重置到第一页
  }, 300);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handleOpenResourcesDialog = (courseCase: CourseCase, tabIndex: number = 0) => {
    setSelectedCaseForResources(courseCase);
    setIsResourcesDialogOpen(true);
    setTabValue(tabIndex);
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getPageNumbers = () => {
    const totalPages = Math.ceil(totalCases / itemsPerPage);
    const pageNumbers = [];
    const maxVisiblePages = 5; // 显示的最大页码数
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

            {filterCategoryId && (
                <Chip
                    label={`当前筛选: ${categories.find(cat => cat.c_category_id === filterCategoryId)?.c_category_name || '未知分类'}`}
                    onDelete={() => setFilterCategoryId('')}
                    color="primary"
                    sx={{ height: 40, px: 2 }}
                />
            )}

            <Button
                variant="outlined"
                color="primary"
                onClick={handleOpenCategoryManagement}
                sx={{ height: 40 }}
            >
              管理类别
            </Button>

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

            <Button
                variant="outlined"
                color="primary"
                onClick={handleRefreshCourses}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} /> : <AddIcon />}
                sx={{ height: 40 }}
            >
              刷新课程
            </Button>
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
                      <IconButton onClick={() => handleOpenFormModal(course)} title="编辑">
                        <EditIcon />
                      </IconButton>
                      <IconButton
                          onClick={() => {
                            setCaseToDelete(course);
                            setIsConfirmDialogOpen(true);
                          }}
                          title="删除"
                      >
                        <DeleteIcon />
                      </IconButton>
                      <IconButton
                          onClick={() => handleOpenResourcesDialog(course)}
                          title="查看资源和实验"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton onClick={() => handleOpenPermissionDialog(course)} title="管理权限">
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
        <Dialog open={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)}>
          <DialogTitle>确认删除</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {experimentToDelete
                  ? `确定要删除实验 "${experimentToDelete.c_experiment_name}" 吗？此操作不可撤销。`
                  : caseToDelete
                      ? `确定要删除课程 "${caseToDelete.c_course_name}" 吗？此操作不可撤销。`
                      : categoryToDelete
                          ? `确定要删除类别 "${categoryToDelete.c_category_name}" 吗？此操作将删除该类别下的所有课程，且不可撤销。`
                          : '确定要删除吗？'}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsConfirmDialogOpen(false)}>取消</Button>
            <Button onClick={handleConfirmDelete} color="error" variant="contained">
              删除
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={isResourcesDialogOpen} onClose={handleCloseResourcesDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {selectedCaseForResources?.c_course_name} 的资源和实验
          </DialogTitle>
          <DialogContent>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="资源和实验标签">
              <Tab label="课程资源" />
              <Tab label="实验" />
              <Tab label="实验资源" />
            </Tabs>
            {tabValue === 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">课程资源</Typography>
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
                                  <IconButton
                                      onClick={() => handleDeleteResource(resource, false)}
                                      title="删除"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  ) : (
                      <Typography>无课程资源</Typography>
                  )}
                </Box>
            )}
            {tabValue === 1 && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle1">实验列表</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenExperimentModal(selectedCaseForResources!.c_course_id)}
                      >
                        添加实验
                      </Button>
                      <Button
                          variant="outlined"
                          color="primary"
                          onClick={() => handleRefreshExperiments(selectedCaseForResources!.c_course_id)}
                          disabled={isLoading}
                          startIcon={isLoading ? <CircularProgress size={20} /> : <AddIcon />}
                      >
                        刷新实验
                      </Button>
                    </Box>
                  </Box>
                  {selectedCaseForResources?.experiments?.length ? (
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>实验名称</TableCell>
                            <TableCell>描述</TableCell>
                            <TableCell>场景配置</TableCell>
                            <TableCell>创建时间</TableCell>
                            <TableCell>操作</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedCaseForResources.experiments.map(experiment => (
                              <TableRow key={experiment.c_experiment_id}>
                                <TableCell>{experiment.c_experiment_name}</TableCell>
                                <TableCell>{experiment.c_description || '-'}</TableCell>
                                <TableCell>{experiment.c_name || '-'}</TableCell>
                                <TableCell>{formatDate(experiment.created_at)}</TableCell>
                                <TableCell>
                                  <IconButton
                                      onClick={() => handleOpenExperimentModal(selectedCaseForResources!.c_course_id, experiment)}
                                      title="编辑"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                  <IconButton
                                      onClick={() => {
                                        setExperimentToDelete(experiment);
                                        setIsConfirmDialogOpen(true);
                                      }}
                                      title="删除"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                  <IconButton
                                      onClick={() => handleOpenResourcesDialog(selectedCaseForResources!, 2)}
                                      title="查看实验资源"
                                  >
                                    <VisibilityIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                  ) : (
                      <Typography>无实验</Typography>
                  )}
                </Box>
            )}
            {tabValue === 2 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1">实验资源</Typography>
                  {selectedCaseForResources?.experiments?.some(exp => exp.resources.length > 0) ? (
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>实验名称</TableCell>
                            <TableCell>资源名称</TableCell>
                            <TableCell>类型</TableCell>
                            <TableCell>大小</TableCell>
                            <TableCell>操作</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedCaseForResources?.experiments
                              .filter(exp => exp.resources.length > 0)
                              .flatMap(exp =>
                                  exp.resources.map(resource => ({
                                    experiment: exp,
                                    resource,
                                  }))
                              )
                              .map(({ experiment, resource }, index) => (
                                  <TableRow key={`${experiment.c_experiment_id}-${resource.c_resource_id}-${index}`}>
                                    <TableCell>{experiment.c_experiment_name || '实验名称'}</TableCell>
                                    <TableCell>{resource.c_resource_name}</TableCell>
                                    <TableCell>{resource.c_type}</TableCell>
                                    <TableCell>{resource.c_size}</TableCell>
                                    <TableCell>
                                      <IconButton onClick={() => handleOpenResourceViewer(resource)} title="查看">
                                        <VisibilityIcon />
                                      </IconButton>
                                      <IconButton
                                          onClick={() => handleDeleteResource(resource, true, experiment.c_experiment_id)}
                                          title="删除"
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                              ))}
                        </TableBody>
                      </Table>
                  ) : (
                      <Typography>无实验资源</Typography>
                  )}
                </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseResourcesDialog}>关闭</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={isCategoryManagementOpen} onClose={handleCloseCategoryManagement} maxWidth="md" fullWidth>
          <DialogTitle>管理类别</DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1">类别列表</Typography>
              <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleRefreshCategories}
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} /> : <AddIcon />}
              >
                刷新类别
              </Button>
            </Box>
            {categories.length ? (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>类别 ID</TableCell>
                      <TableCell>类别名称</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categories.map((category, index) => (
                        <TableRow key={category.c_category_id || `temp-${index}`}>
                          <TableCell>{category.c_category_id || '未分配 ID'}</TableCell>
                          <TableCell>{category.c_category_name}</TableCell>
                          <TableCell>
                            <IconButton onClick={() => handleOpenCategoryModal(category)} title="编辑">
                              <EditIcon />
                            </IconButton>
                            <IconButton
                                onClick={() => {
                                  setCategoryToDelete(category);
                                  setIsConfirmDialogOpen(true);
                                }}
                                title="删除"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
            ) : (
                <Typography>暂无类别</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCategoryManagement} disabled={isLoading}>关闭</Button>
          </DialogActions>
        </Dialog>
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
        <ExperimentFormModal
            open={isExperimentModalOpen}
            onClose={handleCloseExperimentModal}
            onSave={handleSaveExperiment}
            experiment={editingExperiment}
            courseId={selectedCourseId || 'new'}
            sceneConfigs={sceneConfigs}
        />
        <ResourceViewerModal
            open={isResourceViewerOpen}
            onClose={handleCloseResourceViewer}
            resource={viewingResource}
        />
        <CoursePermissionDialog
            open={isPermissionDialogOpen}
            onClose={handleClosePermissionDialog}
            course={selectedCourse}
            onSaveSuccess={handlePermissionSaveSuccess}
        />
      </PageWrapper>
  );
};

export default CourseCasesPage;