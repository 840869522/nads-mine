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
  const [alertSeverity, setAlertSeverity] = useState<'error' | 'success' | 'info'>('error');
  const [isSavingCourse, setIsSavingCourse] = useState(false);

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

        // 获取类别
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

        // 获取课程列表
        const params = {
          page: currentPage,
          pageSize: itemsPerPage,
          ...(searchKeyword && { keyword: searchKeyword }),
          ...(filterCategoryId && { c_category_id: filterCategoryId }),
        };
        const coursesResponse = await apiClientWithToken.get(`/back/api/study/courses`, {
          headers: { Authorization: `${token}` },
          params,
        });
        const coursesData = coursesResponse.data;
        if (coursesData.code === 200 || coursesData.code === 900) {
          const mappedCourses = (coursesData.data.courses || []).map((course: any) => ({
            c_course_id: course.c_course_id,
            c_course_name: course.c_course_name,
            c_description: course.c_description || '',
            c_category_id: course.c_category_id,
            c_category_name: course.c_category_name,
            c_status: course.c_status || 'draft',
            resources: [], // 初始化为空
            experiments: [], // 初始化为空
            created_at: course.created_at || new Date().toISOString(),
            highlightedTitle: highlightText(course.c_course_name, searchKeyword),
            highlightedDescription: highlightText(course.c_description || '', searchKeyword),
          }));
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
      } finally {
        setIsLoading(false);
      }
    }, 500);

    debouncedFetchData();
    return () => debouncedFetchData.cancel();
  }, [currentPage, itemsPerPage, searchKeyword, filterCategoryId]);

  const handleOpenResourcesDialog = async (courseCase: CourseCase, tabIndex: number = 0) => {
    setIsResourcesDialogOpen(true);
    setTabValue(tabIndex);
    setIsLoading(true);
    setErrorMessage('');

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
      } 

      // 获取实验资源
      const experimentsResponse = await apiClientWithToken.get(`/back/api/study/courses/${courseCase.c_course_id}/experiments`, {
        headers: { Authorization: `${token}` },
      });
      const experimentsData = experimentsResponse.data;
      let experiments: Experiment[] = [];
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
      // 直接更新 selectedCaseForResources
      setSelectedCaseForResources({
        ...courseCase,
        resources,
        experiments,
      });

      // 可选：更新 courseCases 以保持状态一致
      setCourseCases(prev =>
          prev.map(course =>
              course.c_course_id === courseCase.c_course_id
                  ? { ...course, resources, experiments }
                  : course
          )
      );
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '获取资源或实验失败';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCategoryManagement = async () => {
    setIsCategoryManagementOpen(true);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }

      // 获取类别
      const categoriesResponse = await apiClientWithToken.get(`/back/api/study/categories`, {
        headers: { Authorization: `${token}` },
      });
      const categoriesData = categoriesResponse.data;
      if (categoriesData.code === 200) {
        setCategories(
            categoriesData.data.map((cat: { c_category_id: string; c_category_name: string }) => ({
              c_category_id: cat.c_category_id,
              c_category_name: cat.c_category_name,
            })) || []
        );
      } else {
        throw new Error(`获取类别失败: ${categoriesData.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '获取类别失败';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFormModal = (courseCase?: CourseCase) => {
    setEditingCase(courseCase || null);
    setIsFormModalOpen(true);
  };

  const handleOpenCategoryModal = (category?: Category) => {
    setEditingCategory(category || null);
    setIsCategoryModalOpen(true);
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

  const handlePermissionSaveSuccess = () => {
    setAlertSeverity('success'); 
    setErrorMessage('权限保存成功');
    setTimeout(() => setErrorMessage(''), 3000);
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

      const experimentData = {
        c_experiment_name: experiment.c_experiment_name,
        c_description: experiment.c_description,
        c_config_id: experiment.c_config_id,
      };

      let experimentId = experiment.c_experiment_id;
      if (experiment.c_experiment_id.startsWith('temp-id-')) {
        const response = await apiClientWithToken.post(`/back/api/study/courses/${courseId}/experiments`, experimentData, {
          headers: { Authorization: `${token}` },
        });
        const data = response.data;
        if (data.code !== 201) {
          throw new Error(`创建实验失败: ${data.message || '未知错误'}`);
        }
        experimentId = data.data.c_experiment_id;
        setErrorMessage('实验创建成功，用户权限已同步');
        setTimeout(() => setErrorMessage(''), 3000);
      } else {
        const response = await apiClientWithToken.put(`/back/api/study/courses/${courseId}/experiments/${experiment.c_experiment_id}`, experimentData, {
          headers: { Authorization: `${token}` },
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
                Authorization: `${token}`,
              },
            });
            const data = response.data;
            if (data.code !== 201) {
              console.warn('Failed to upload experiment resource:', data.message);
            }
          }
        }
      }

      // 刷新实验列表
      await handleRefreshExperiments(courseId);
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '保存实验失败';
      setErrorMessage(message);
    }
    handleCloseExperimentModal();
  };


  const handleSaveCourseCase = async (savedCase: CourseCase) => {
  setIsSavingCourse(true);
  
  try {
    const { c_course_id, c_course_name, c_description, c_category_id, c_status, resources } = savedCase;
    
    const token = getCookie('_auth');
    if (!token) {
      throw new Error('未登录，请先登录');
    }


    let finalCourseId = c_course_id;
    let operationType = editingCase ? '更新' : '创建';
    
    // 1. 保存课程基本信息
    if (editingCase) {
      
      const updateResponse = await apiClientWithToken.put(
        `/back/api/study/courses/${c_course_id}`, 
        {
          c_course_name,
          c_description,
          c_category_id,
          c_status,
        }, 
        {
          headers: { Authorization: `${token}` },
        }
      );
      
      const updateData = updateResponse.data;
      
      if (updateData.code !== 200) {
        throw new Error(`更新课程失败: ${updateData.message || '未知错误'}`);
      }
      
      // 关键：更新后尝试获取新的课程ID
      // 方法1：从响应数据中获取
      if (updateData.data?.c_course_id) {
        finalCourseId = updateData.data.c_course_id;
      } 
      // 方法2：如果响应中没有，重新查询课程列表
      else {
        
        // 根据课程名称重新查询课程ID
        const searchResponse = await apiClientWithToken.get(
          `/back/api/study/courses`,
          {
            headers: { Authorization: `${token}` },
            params: {
              keyword: c_course_name,
              page: 1,
              pageSize: 10
            }
          }
        );
        
        const searchData = searchResponse.data;      
        if (searchData.code === 200 && searchData.data?.courses?.length > 0) {
          // 找到匹配的课程
          const matchingCourse = searchData.data.courses.find(
            (course: any) => course.c_course_name === c_course_name
          );
          
          if (matchingCourse) {
            finalCourseId = matchingCourse.c_course_id;
          } else {
          }
        }
      }
      
      // 更新本地状态（使用新ID）
      if (finalCourseId !== c_course_id) {
        
        // 从列表中移除旧的，添加新的
        setCourseCases(prev => {
          const filtered = prev.filter(course => course.c_course_id !== c_course_id);
          return [...filtered, {
            c_course_id: finalCourseId,
            c_course_name,
            c_description,
            c_category_id,
            c_category_name: savedCase.c_category_name || '',
            c_status,
            resources: [],
            experiments: [],
            created_at: new Date().toISOString(),
            highlightedTitle: c_course_name,
            highlightedDescription: c_description || ''
          }];
        });
      } else {
        // ID未改变，正常更新
        setCourseCases(prev =>
          prev.map(course =>
            course.c_course_id === c_course_id ? { 
              ...course, 
              c_course_name, 
              c_description, 
              c_category_id, 
              c_status 
            } : course
          )
        );
      }
    } else {
      // 创建课程的逻辑
      
      const createResponse = await apiClientWithToken.post(
        `/back/api/study/courses`, 
        {
          c_course_name,
          c_description,
          c_category_id,
          c_status,
        }, 
        {
          headers: { Authorization: `${token}` },
        }
      );
      
      const createData = createResponse.data;
      
      if (createData.code !== 201) {
        throw new Error(`创建课程失败: ${createData.message || '未知错误'}`);
      }
      
      if (!createData.data || !createData.data.c_course_id) {
        throw new Error('创建课程成功但未返回有效的课程ID');
      }
      
      finalCourseId = createData.data.c_course_id;
      operationType = '创建';
    }

    // 2. 验证课程是否存在
    
    try {
      const verifyResponse = await apiClientWithToken.get(
        `/back/api/study/courses/${finalCourseId}`,
        {
          headers: { Authorization: `${token}` },
        }
      );
      
      const verifyData = verifyResponse.data;
      
      if (verifyData.code !== 200) {
        throw new Error(`课程验证失败: ${verifyData.message || '未知错误'}`);
      }
    } catch (verifyError: any) {
      
      // 如果是404，说明课程确实不存在
      if (verifyError.response?.status === 404) {
        throw new Error(`课程ID ${finalCourseId} 不存在，无法上传资源`);
      }
    }

    // 3. 处理资源上传（使用最终确定的课程ID）
    const newResources = resources.filter(resource => resource.fileObject);
    const existingResources = resources.filter(resource => !resource.fileObject);

    let successCount = 0;
    let failCount = 0;
    let failMessages: string[] = [];

    if (newResources.length > 0) {
      
      for (let i = 0; i < newResources.length; i++) {
        const resource = newResources[i];
        
        try {
          
          const formData = new FormData();
          formData.append('c_course_id', finalCourseId);
          formData.append('file', resource.fileObject!);
          
          const response = await apiClientWithToken.post(
            `/back/api/study/courses/${finalCourseId}/resources/upload`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `${token}`,
              },
            }
          );
          
          const data = response.data;
          
          if (data.code === 201) {
            successCount++;
          } else {
            failCount++;
            const errorMsg = `新增资源"${resource.c_resource_name}": ${data.message || '上传失败'}`;
            failMessages.push(errorMsg);
          }
        } catch (error: any) {
          failCount++;
          const errorMsg = error.response?.data?.message || error.message || '上传失败';
          const detailedError = `新增资源"${resource.c_resource_name}": ${errorMsg}`;
          failMessages.push(detailedError);
          
        }
        
        // 资源间添加延迟
        if (i < newResources.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // 4. 构建提示信息
    let successMessage = `${operationType}课程成功！`;
    
    
    if (newResources.length > 0) {
      if (successCount > 0 && failCount === 0) {
        successMessage += ` ${successCount}个新增资源全部上传成功。`;
      } else if (successCount > 0 && failCount > 0) {
        successMessage += ` ${successCount}个新增资源上传成功，${failCount}个新增资源上传失败。`;
        if (failMessages.length > 0) {
          successMessage += ` 失败详情: ${failMessages.join('; ')}`;
        }
      } else if (failCount > 0) {
        successMessage += ` 新增资源上传失败。`;
        if (failMessages.length > 0) {
          successMessage += ` 失败详情: ${failMessages.join('; ')}`;
        }
      }
    } else {
      if (editingCase) {
        successMessage += ` 没有需要上传的新增资源。`;
      } else {
        successMessage += ` 未添加任何资源。`;
      }
    }

  if (editingCase && existingResources.length > 0) {
    successMessage += ` ${existingResources.length}个已有资源保持不变。`;
  }

    // 5. 显示结果
    setAlertSeverity('success');
    setErrorMessage(successMessage);
    
    
    handleCloseFormModal();
    
    // 刷新课程列表
    setTimeout(async () => {
      await handleRefreshCourses();
    }, 1000);

  } catch (error: any) {
    
    setAlertSeverity('error');
    setErrorMessage(`${editingCase ? '更新' : '创建'}课程失败: ${error.message}`);
    
    handleCloseFormModal();
  } finally {
    setIsSavingCourse(false);
  }
};

  const handleRefreshCategories = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('_auth');
      if (!token) {
        throw new Error('未登录，请先登录');
      }
      const response = await apiClientWithToken.get(`/back/api/study/categories`, {
        headers: { Authorization: `${token}` },
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
        headers: { Authorization: `${token}` },
        params,
      });
      const data = response.data;
      if (data.code === 200 || data.code === 900) {
        const mappedCourses = (data.data.courses || []).map((course: any) => ({
          c_course_id: course.c_course_id,
          c_course_name: course.c_course_name,
          c_description: course.c_description || '',
          c_category_id: course.c_category_id,
          c_category_name: course.c_category_name,
          c_status: course.c_status || 'draft',
          resources: [],
          experiments: [],
          created_at: course.created_at || new Date().toISOString(),
          highlightedTitle: highlightText(course.c_course_name, searchKeyword),
          highlightedDescription: highlightText(course.c_description || '', searchKeyword),
        }));
        setCourseCases(mappedCourses);
        setTotalCases(data.data.total || 0);
      } else {
        throw new Error(`刷新课程失败: ${data.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '刷新课程失败';
      setErrorMessage(message);
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
        headers: { Authorization: `${token}` },
      });
      const data = response.data;
      if (data.code === 200) {
        const experiments = (data.data.experiments || []).map((exp: any) => ({
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
        setCourseCases(prev =>
            prev.map(course => {
              if (course.c_course_id === courseId) {
                return { ...course, experiments };
              }
              return course;
            })
        );
        // 更新 selectedCaseForResources
        if (selectedCaseForResources?.c_course_id === courseId) {
          setSelectedCaseForResources(prev => (prev ? { ...prev, experiments } : null));
        }
      } else {
        throw new Error(`刷新实验失败: ${data.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '刷新实验失败';
      setErrorMessage(message);
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

      let successMessage = '';
      
      if (category.c_category_id) {
        const response = await apiClientWithToken.put(`/back/api/study/categories/${category.c_category_id}`, {
          c_category_name: category.c_category_name,
        }, {
          headers: { Authorization: `${token}` },
        });
        const data = response.data;
        if (data.code === 200) {
          setCategories(prev => prev.map(cat => (cat.c_category_id === category.c_category_id ? category : cat)));
          successMessage = '更新类别成功';
        } else {
          throw new Error(`更新类别失败: ${data.message || '未知错误'}`);
        }
      } else {
        const response = await apiClientWithToken.post(`/back/api/study/categories`, {
          c_category_name: category.c_category_name,
        }, {
          headers: { Authorization: `${token}` },
        });
        const data = response.data;
        if (data.code === 201) {
          setCategories(prev => [...prev, { c_category_id: data.data.c_category_id, c_category_name: category.c_category_name }]);
          successMessage = '添加类别成功';
        } else {
          throw new Error(`创建类别失败: ${data.message || '未知错误'}`);
        }
      }
      
      // 显示绿色成功提示
      setAlertSeverity('success');
      setErrorMessage(successMessage);
      
      // 3秒后自动清除提示
      setTimeout(() => {
        setErrorMessage('');
      }, 3000);
      
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '保存类别失败';
      // 显示红色错误提示
      setAlertSeverity('error');
      setErrorMessage(message);
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
          headers: { Authorization: `${token}` },
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
          headers: { Authorization: `${token}` },
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
              headers: { Authorization: `${token}` },
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
          setSelectedCaseForResources(prev =>
              prev
                  ? {
                    ...prev,
                    experiments: prev.experiments?.filter(exp => exp.c_experiment_id !== experimentToDelete.c_experiment_id) || [],
                  }
                  : null
          );
        } else {
          throw new Error(`删除实验失败: ${data.message || '未知错误'}`);
        }
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || '删除实验失败';
        setErrorMessage(message);
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
        headers: { Authorization: `${token}` },
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
        setSelectedCaseForResources(prev =>
            prev
                ? {
                  ...prev,
                  ...(isExperimentResource && experimentId
                      ? {
                        experiments: prev.experiments?.map(exp => {
                          if (exp.c_experiment_id === experimentId) {
                            return {
                              ...exp,
                              resources: exp.resources.filter(r => r.c_resource_id !== resource.c_resource_id),
                            };
                          }
                          return exp;
                        }) || [],
                      }
                      : {
                        resources: prev.resources.filter(r => r.c_resource_id !== resource.c_resource_id),
                      }),
                }
                : null
        );
      } else {
        throw new Error(`删除资源失败: ${data.message || '未知错误'}`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '删除资源失败';
      setErrorMessage(message);
    }
  };

  const handleOpenResourceViewer = (resource: CourseCaseResource) => {
    const token = getCookie('_auth');
    let updatedResource = resource;

    if (resource.c_resource_path && !resource.c_resource_path.startsWith('blob:')) {
      const url = new URL(resource.c_resource_path, window.location.origin);
      url.searchParams.set('token', token);
      updatedResource = { ...resource, c_resource_path: url.toString() };
    } else if (!resource.c_resource_path && resource.fileObject) {
      updatedResource = {
        ...resource,
        c_resource_path: URL.createObjectURL(resource.fileObject)
      };
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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
            <Alert 
              severity={alertSeverity}  // 修改这里
              sx={{ mb: 2 }} 
              onClose={() => setErrorMessage('')}
            >
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
                <TableCell>状态</TableCell>
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
                    <TableCell>
                      <Chip
                          label={course.c_status === 'published' ? '发布' : '草稿'}
                          color={course.c_status === 'published' ? 'success' : 'default'}
                          size="small"
                      />
                    </TableCell>
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
                          title="查看资源"
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
        <Dialog open={isResourcesDialogOpen} onClose={handleCloseResourcesDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {selectedCaseForResources?.c_course_name} 的资源
          </DialogTitle>
          <DialogContent>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>课程资源</Typography>
                  {selectedCaseForResources?.resources?.length ? (
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
                              <IconButton 
                                onClick={() => handleOpenResourceViewer(resource)} 
                                title="查看"
                                size="small"
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                onClick={() => {
                                  if (window.confirm(`确定要删除资源 "${resource.c_resource_name}" 吗？`)) {
                                    handleDeleteResource(resource, false);
                                  }
                                }}
                                title="删除"
                                size="small"
                                sx={{ ml: 1, color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
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
              </>
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
                    {[...categories].sort((a, b) => (a.c_category_id || '').localeCompare(b.c_category_id || '')).map((category, index) => (
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
            isSaving={isSavingCourse}
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