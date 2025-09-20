import React, { useState, useEffect } from 'react';
import {
  Box, Button, TextField, Typography, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip,
  IconButton, Tooltip, Pagination, Grid,
  Snackbar, Alert, CircularProgress, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Code as CodeIcon,
  MenuBook as MenuBookIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  FolderOpen as FolderOpenIcon,
  Description as DescriptionIcon // 新增图标用于试卷管理
} from '@mui/icons-material';
import ExperimentResourceDialog from './ExperimentResourceDialog';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import FixedSizeFormDialog from './TestFormDialog';
import TestUserDrawer from './TestUserDrawer';
import TestCorrectionDialog from './TestCorrectionDialog';
import { apiClientWithToken } from "@/utils/axios";
import PaperManagementSystem from './PaperManagementSystem'; // 导入 PaperManagementSystem 组件

// 应用中文本地化
moment.locale('zh-cn');

// 定义接口类型
interface TestData {
  c_id?: string;
  c_name: string;
  c_description: string;
  c_test_type: string;
  c_type: string;
  c_paper_count: number;
  c_course_id: string;
  c_start: string | null;
  c_end: string | null;
  c_duration?: number;
  c_create_at?: string;
  c_scene_config_id?: number;
  c_scene_name?: string;
}

interface ExperimentData {
  c_id?: string;
  c_experiment_name: string;
  c_description: string;
  c_course_id: string;
  c_config_id: number;
  c_start: string | null;
  c_end: string | null;
  c_duration: number;
  created_at?: string;
  updated_at?: string;
  c_scene_name?: string;
}

interface TestUser {
  id?: string;
  username: string;
  name?: string;
  email?: string;
  role?: string;
  c_test_id: string;
  c_paper_id: string;
  c_answers: any;
  start_time: string | null;
  end_time: string | null;
  submit_time: string | null;
  score: number;
  correct_status: number;
  correct_status_text: string;
}

interface Paper {
  paperId: string;
  testId: string;
  totalScore: number;
  questionCount: number;
  paperName?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

interface SceneConfig {
  c_config_id: number;
  c_name: string;
}

type TestTab = 'experiment' | 'theory';

const TestManagement = () => {
  const [tests, setTests] = useState<TestData[]>([]);
  const [experiments, setExperiments] = useState<ExperimentData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [pageExperiment, setPageExperiment] = useState<number>(1);
  const [pageTheory, setPageTheory] = useState<number>(1);
  const [rowsPerPage] = useState<number>(50);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [currentTest, setCurrentTest] = useState<TestData | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TestTab>('experiment');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [loadingPapers, setLoadingPapers] = useState<boolean>(false);
  const [sceneConfigs, setSceneConfigs] = useState<SceneConfig[]>([]);
  // 新增状态：管理 PaperManagementSystem 的显示
  const [showPaperManagement, setShowPaperManagement] = useState<boolean>(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  // 删除相关状态
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<TestUser | null>(null);
  const [testToDelete, setTestToDelete] = useState<string | null>(null);

  // 批改试卷弹窗状态
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState<boolean>(false);
  const [currentTestForCorrection, setCurrentTestForCorrection] = useState<TestData | null>(null);
  
  // 实验资源管理对话框状态
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState<boolean>(false);
  const [currentResourceTest, setCurrentResourceTest] = useState<TestData | null>(null);

  // 显示提示消息
  const showSnackbar = (message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // 关闭提示消息
  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // 切换标签页
  const handleTabChange = (event: React.SyntheticEvent, newValue: TestTab) => {
    setActiveTab(newValue);
    setSearchText('');
    setStartDate(null);
    setEndDate(null);
    setShowPaperManagement(false); // 切换标签时隐藏试卷管理
    setSelectedTestId(null); // 清空选中的测试 ID

    if (newValue === 'experiment') {
      setPageExperiment(1);
      fetchExperimentTests(1);
    } else {
      setPageTheory(1);
      fetchTheoryTests(1);
    }
  };

  // 获取场景配置
  const fetchSceneConfigs = async () => {
    try {
      console.log('开始获取场景配置...');
      const response = await apiClientWithToken.get('/back/api/scenarios');
      console.log('场景配置API响应:', response);

      const sceneConfigsData = response.data;
      console.log('场景配置原始数据:', sceneConfigsData);

      try {
        let configs = [];
        if (Array.isArray(sceneConfigsData)) {
          configs = sceneConfigsData;
          console.log('直接使用数组数据，共', configs.length, '条');
        } else if (sceneConfigsData && Array.isArray(sceneConfigsData.data)) {
          configs = sceneConfigsData.data;
          console.log('使用data数组数据，共', configs.length, '条');
        } else {
          console.log('数据格式不匹配，使用空数组');
          configs = [];
        }

        const formattedConfigs = configs
          .filter(config => config && (config.id || config.c_config_id) && (config.name || config.c_name))
          .map((config: any) => ({
            c_config_id: Number(config.id || config.c_config_id),
            c_name: String(config.name || config.c_name)
          }));

        console.log('格式化后的场景配置:', formattedConfigs);
        setSceneConfigs(formattedConfigs);

        if (formattedConfigs.length === 0) {
          showSnackbar('当前没有可用的场景配置', 'info');
          console.warn('场景配置为空，请检查数据库');
        } else {
          console.log('成功加载场景配置:', formattedConfigs.length, '条');
        }
      } catch (error: any) {
        console.error('场景配置处理错误:', error);
        showSnackbar('获取场景配置失败: ' + (error.message || '未知错误'), 'error');
        setSceneConfigs([]);
      }
    } catch (error: any) {
      console.error('获取场景配置失败:', error);
      showSnackbar('获取场景配置失败: ' + (error.response?.data?.message || error.message), 'error');
      setSceneConfigs([]);
    }
  };

  // 获取实验测试列表（从c_course_experiments表获取）
  const fetchExperimentTests = async (page: number) => {
    try {
      setLoading(true);
      const params: any = {
        page: page,
        pageSize: rowsPerPage,
      };

      if (searchText) params.search = searchText;
      if (startDate) params.startDate = startDate.format('YYYY-MM-DD');
      if (endDate) params.endDate = endDate.format('YYYY-MM-DD');

      console.log('请求参数:', params);
      console.log('请求URL:', 'back/api/study/experiments');

      const response = await apiClientWithToken.get<ApiResponse>('/back/api/study/experiments', {
        params: params
      });

      console.log('完整响应:', response.data);

      if (response.data.code === 200) {
        const experimentsData = response.data.data?.experiments || [];
        console.log('实验数据:', experimentsData);

        const formattedExperiments = experimentsData.map((item: any) => ({
          c_id: item.c_experiment_id,
          c_name: item.c_experiment_name,
          c_description: item.c_description || '',
          c_type: '实验',
          c_test_type: '实验',
          c_course_id: item.c_course_id,
          c_start: item.c_start || null,
          c_end: item.c_end || null,
          c_paper_count: 0,
          c_duration: item.c_duration || 0,
          c_scene_config_id: item.c_config_id || 0,
          c_scene_name: item.c_name || '',
          created_at: item.created_at,
          resources: item.resources || []
        }));

        console.log('格式化后的数据:', formattedExperiments);

        setTests(formattedExperiments);
        setTotalCount(experimentsData.length);
      } else {
        console.error('API返回错误:', response.data);
        showSnackbar(response.data.message || '获取实验列表失败', 'error');
        setTests([]);
      }
    } catch (error: any) {
      console.error('获取实验测试列表失败详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });

      showSnackbar('获取实验测试列表失败: ' +
        (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 获取理论测试列表（保持原有接口）
  const fetchTheoryTests = async (page: number) => {
    try {
      setLoading(true);
      const response = await apiClientWithToken.get<ApiResponse>('/back/api/study/test/test_list', {
        params: { page, pageSize: rowsPerPage }
      });

      if (response.data.code === 200) {
        const responseData = response.data.data || {};
        const rawTests = responseData.data || [];

        const formattedTests = rawTests.map((item: any) => ({
          c_id: item.c_id,
          c_name: item.c_name,
          c_description: item.c_description,
          c_type: item.c_type,
          c_test_type: item.c_test_type,
          c_course_id: item.c_course_id,
          c_start: item.c_start || null,
          c_end: item.c_end || null,
          c_paper_count: item.c_paper_count || 0,
          c_duration: item.c_duration || 0,
          c_scene_config_id: item.c_scene_config_id || 0,
          c_scene_name: item.c_scene_name || ''
        }));

        setTests(formattedTests);
        setTotalCount(responseData.count || 0);
      } else {
        showSnackbar(response.data.message || '获取测试列表失败', 'error');
        setTests([]);
      }
    } catch (error) {
      console.error('获取测试列表失败:', error);
      showSnackbar('获取测试列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 获取所有用户
  const fetchAllUsers = async () => {
    try {
      const response = await apiClientWithToken.get<ApiResponse>('/back/api/study/test/getAllUsers');
      if (response.data.code === 200) {
        setAllUsers(response.data.data || []);
      } else {
        showSnackbar('获取用户列表失败: ' + response.data.message, 'error');
      }
    } catch (error: any) {
      console.error('获取用户列表失败:', error);
      showSnackbar('获取用户列表失败: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  // 根据测试ID获取试卷
  const fetchPapersByTestId = async (testId: string) => {
    try {
      setLoadingPapers(true);

      if (activeTab === 'experiment') {
        setPapers([]);
        return [];
      } else {
        const response = await apiClientWithToken.get<ApiResponse>('/back/api/study/test/get_papers', {
          params: { test_id: testId }
        });

        if (response.data.code === 200) {
          const papersWithNames = (response.data.data || []).map((paper: any, index: number) => ({
            ...paper,
            paperName: `试卷${index + 1}`
          }));

          setPapers(papersWithNames);
          return papersWithNames;
        } else {
          showSnackbar('获取试卷列表失败: ' + response.data.message, 'error');
          setPapers([]);
          return [];
        }
      }
    } catch (error: any) {
      console.error('获取试卷列表失败:', error);
      showSnackbar('获取试卷列表失败: ' + (error.response?.data?.message || error.message), 'error');
      setPapers([]);
      return [];
    } finally {
      setLoadingPapers(false);
    }
  };

  // 根据测试ID获取关联用户信息
  const fetchTestUsers = async (testId: string) => {
    try {
      setLoadingUsers(true);

      const response = await apiClientWithToken.get<ApiResponse>(
        '/back/api/study/test/getTestUsersByTestId',
        { params: { test_id: testId } }
      );

      if (response.data.code === 200) {
        const usersData = response.data.data || [];
        const formattedUsers = usersData.map((user: any) => {
          const userInfo = allUsers.find(u => u.username === user.username);

          return {
            id: `${testId}-${user.username}`,
            username: user.username,
            name: user.name || userInfo?.name || user.username,
            c_test_id: testId,
            c_paper_id: user.paper_id,
            c_answers: user.answers,
            start_time: user.start_time,
            end_time: user.end_time,
            submit_time: user.submit_time,
            score: user.score || 0,
            c_objective_score: user.c_objective_score || 0,
            c_subjective_score: user.c_subjective_score || 0,
            correct_status: user.correct_status || 0,
            correct_status_text: user.correct_status_text || '未批改'
          };
        });

        return formattedUsers;
      } else {
        showSnackbar('获取用户数据失败: ' + response.data.message, 'error');
        return [];
      }
    } catch (error: any) {
      console.error('获取用户数据失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '网络请求失败，请稍后重试';
      showSnackbar(`获取用户数据失败: ${errorMsg}`, 'error');
      return [];
    } finally {
      setLoadingUsers(false);
    }
  };

  // 批量添加测试用户
  const batchAddTestUsers = async (usersData: any[]) => {
    try {
      const response = await apiClientWithToken.post<ApiResponse>(
        '/back/api/study/test/batchStoreTestUsers',
        { users: usersData }
      );

      if (response.data.code === 200) {
        showSnackbar(`成功添加 ${response.data.data?.count || usersData.length} 个用户`);
        return true;
      } else {
        showSnackbar('批量添加用户失败: ' + response.data.message, 'error');
        return false;
      }
    } catch (error: any) {
      console.error('批量添加用户失败:', error);
      showSnackbar('批量添加用户失败: ' + (error.response?.data?.message || error.message), 'error');
      return false;
    }
  };

  // 单个删除测试用户
  const deleteTestUser = async () => {
    if (!userToDelete || !currentTest?.c_id) return false;

    try {
      const deleteKey = `${userToDelete.c_test_id}-${userToDelete.username}-${userToDelete.c_paper_id}`;
      setDeletingKey(deleteKey);

      const response = await apiClientWithToken.post<ApiResponse>(
        '/back/api/study/test/destroy',
        {
          c_test_id: userToDelete.c_test_id,
          c_username: userToDelete.username,
          c_paper_id: userToDelete.c_paper_id
        }
      );

      if (response.data.code === 200) {
        showSnackbar('用户删除成功');
        const updatedUsers = await fetchTestUsers(currentTest.c_id);
        setTestUsers(updatedUsers);
        setDeleteConfirmOpen(false);
        setUserToDelete(null);
        return true;
      } else {
        showSnackbar(`删除失败: ${response.data.message}`, 'error');
        return false;
      }
    } catch (error: any) {
      console.error('删除测试用户失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '网络请求失败，请稍后重试';
      showSnackbar(`删除用户失败: ${errorMsg}`, 'error');
      return false;
    } finally {
      setDeletingKey(null);
    }
  };

  // 添加测试方法
  const handleAddTest = async (testData: TestData) => {
    try {
      if (!testData.c_name.trim()) {
        showSnackbar('测试名称不能为空', 'error');
        return false;
      }

      if (testData.c_type === '考试' && (!testData.c_duration || testData.c_duration <= 0)) {
        showSnackbar('考试类型的测试必须设置有效的时长（分钟）', 'error');
        return false;
      }

      if (testData.c_test_type === '实验') {
        if (!testData.c_scene_config_id || testData.c_scene_config_id <= 0) {
          showSnackbar('实验类型的测试必须选择场景配置', 'error');
          return false;
        }
        if (!testData.c_duration || testData.c_duration <= 0) {
          showSnackbar('实验类型的测试必须设置有效的时长（分钟）', 'error');
          return false;
        }
      }

      const formatDate = (dateString: string | null) => {
        if (!dateString) return '';
        if (dateString.length === 10) {
          return `${dateString} 00:00:00`;
        }
        return dateString;
      };

      let response;

      if (testData.c_test_type === '实验') {
        const experimentData = {
          c_experiment_name: testData.c_name,
          c_description: testData.c_description,
          c_course_id: testData.c_course_id,
          c_config_id: testData.c_scene_config_id,
          c_start: formatDate(testData.c_start),
          c_end: formatDate(testData.c_end),
          c_duration: testData.c_duration
        };

        console.log('提交添加实验数据:', experimentData);
        response = await apiClientWithToken.post<ApiResponse>(`/back/api/study/experiments`, experimentData);
      } else {
        const testDataFormatted = {
          name: testData.c_name,
          test_type: testData.c_test_type,
          type: testData.c_type,
          description: testData.c_description,
          paper_count: testData.c_paper_count,
          course_id: testData.c_course_id,
          start: formatDate(testData.c_start),
          end: formatDate(testData.c_end),
          duration: testData.c_duration || 0,
          scene_config_id: testData.c_scene_config_id || 0
        };

        console.log('提交添加理论测试数据:', testDataFormatted);
        response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_add', testDataFormatted);
      }

      const isSuccess = response.data.code === 200 || 
                       response.data.code === 0 ||
                       response.data.status === 'success' ||
                       response.data.success === true ||
                       response.data.message?.includes('success') ||
                       response.data.message?.includes('成功') ||
                       response.data.message?.includes('created') ||
                       (response.status >= 200 && response.status < 300);

      if (isSuccess) {
        showSnackbar('测试添加成功');
        if (testData.c_test_type === '实验') {
          fetchExperimentTests(1);
        } else {
          fetchTheoryTests(1);
        }
        return true;
      } else {
        showSnackbar('测试添加失败: ' + (response.data.message || '未知错误'), 'error');
        return false;
      }
    } catch (error: any) {
      console.error('添加测试失败:', error);
      showSnackbar('测试添加失败: ' + (error.response?.data?.message || error.message), 'error');
      return false;
    }
  };

  // 更新测试
  const handleUpdateTest = async (testData: TestData) => {
    try {
      if (!testData.c_id) {
        showSnackbar('测试ID不能为空，无法更新', 'error');
        console.error('更新测试失败：c_id为空', testData);
        return false;
      }

      if (testData.c_type === '考试' && (!testData.c_duration || testData.c_duration <= 0)) {
        showSnackbar('考试类型的测试必须设置有效的时长（分钟）', 'error');
        return false;
      }

      if (testData.c_test_type === '实验') {
        if (!testData.c_scene_config_id || testData.c_scene_config_id <= 0) {
          showSnackbar('实验类型的测试必须选择场景配置', 'error');
          return false;
        }
        if (!testData.c_duration || testData.c_duration <= 0) {
          showSnackbar('实验类型的测试必须设置有效的时长（分钟）', 'error');
          return false;
        }
      }

      let response;

      if (testData.c_test_type === '实验') {
        const experimentData = {
          id: testData.c_id,
          c_experiment_name: testData.c_name,
          c_description: testData.c_description,
          c_course_id: testData.c_course_id,
          c_config_id: testData.c_scene_config_id,
          c_start: testData.c_start || '',
          c_end: testData.c_end || '',
          c_duration: testData.c_duration
        };

        console.log('提交更新实验数据:', experimentData);
        response = await apiClientWithToken.put<ApiResponse>(`/back/api/study/experiments/${testData.c_id}`, experimentData);
      } else {
        const testDataFormatted = {
          id: testData.c_id,
          name: testData.c_name,
          test_type: testData.c_test_type,
          type: testData.c_type,
          description: testData.c_description,
          paper_count: testData.c_paper_count,
          course_id: testData.c_course_id,
          start: testData.c_start || '',
          end: testData.c_end || '',
          duration: testData.c_duration,
          scene_config_id: testData.c_scene_config_id || 0
        };

        console.log('提交更新理论测试数据:', testDataFormatted);
        response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_update', testDataFormatted);
      }

      const isSuccess = response.data.code === 200 || 
                       response.data.code === 0 ||
                       response.data.status === 'success' ||
                       response.data.success === true ||
                       response.data.message?.includes('success') ||
                       response.data.message?.includes('成功') ||
                       response.data.message?.includes('updated') ||
                       (response.status >= 200 && response.status < 300);

      if (isSuccess) {
        showSnackbar('测试更新成功');
        if (testData.c_test_type === '实验') {
          fetchExperimentTests(1);
        } else {
          fetchTheoryTests(1);
        }
        return true;
      } else {
        showSnackbar('测试更新失败: ' + (response.data.message || '未知错误'), 'error');
        return false;
      }
    } catch (error: any) {
      console.error('更新测试失败:', error);
      showSnackbar('更新测试失败: ' + (error.response?.data?.message || error.message), 'error');
      return false;
    }
  };

  // 删除测试
  const handleDeleteTest = async () => {
    if (!testToDelete) return;

    try {
      setDeletingTestId(testToDelete);

      const isExperiment = activeTab === 'experiment';

      const testUsers = await fetchTestUsers(testToDelete);
      if (testUsers.length > 0) {
        showSnackbar(`该测试关联了 ${testUsers.length} 个用户，请先删除用户关联再删除测试`, 'warning');
        setDeletingTestId(null);
        setDeleteConfirmOpen(false);
        setTestToDelete(null);
        return;
      }

      let response;
      if (isExperiment) {
        response = await apiClientWithToken.delete<ApiResponse>(`/back/api/study/experiments/${testToDelete}`);
      } else {
        response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_del', { id: testToDelete });
      }

      if (response.data.code === 200 || response.data.message?.includes('successfully') || response.data.message?.includes('成功') || response.data.message?.includes('deleted')) {
        showSnackbar('测试删除成功');
        if (activeTab === 'experiment') {
          fetchExperimentTests(1);
        } else {
          fetchTheoryTests(1);
        }
      } else {
        showSnackbar(`测试删除失败: ${response.data.message}（可能存在关联数据未清理）`, 'error');
      }
    } catch (error: any) {
      console.error('删除测试失败:', error);
      const errorMsg = error.response?.data?.message
        ? `测试删除失败: ${error.response.data.message}（请联系管理员清理关联数据）`
        : '测试删除失败: 网络异常，请稍后重试';
      showSnackbar(errorMsg, 'error');
    } finally {
      setDeletingTestId(null);
      setDeleteConfirmOpen(false);
      setTestToDelete(null);
    }
  };

  // 获取测试详情
  const fetchTestInfo = async (testId: string) => {
    try {
      let response;

      if (activeTab === 'experiment') {
        response = await apiClientWithToken.get<ApiResponse>(`/back/api/study/experiments/${testId}`);

        if (response.data.code === 200) {
          const data = response.data.data;
          console.log('fetchTestInfo - 实验原始数据:', data);
          
          const result = {
            ...data,
            c_id: data.id || data.c_id || testId, // 确保c_id被正确设置
            c_name: data.c_experiment_name || data.c_name,
            c_start: data.c_start || null,
            c_end: data.c_end || null,
            c_duration: data.c_duration,
            c_scene_config_id: data.c_config_id || 0,
            c_scene_name: data.c_scene_name || '',
            c_test_type: '实验',
            c_type: '实验'
          };
          return result;
        } else {
          showSnackbar('获取实验详情失败: ' + response.data.message, 'error');
          return null;
        }
      } else {
        response = await apiClientWithToken.get<ApiResponse>(`/back/api/study/test/test_info`, {
          params: { id: testId }
        });

        if (response.data.code === 200) {
          const data = response.data.data;
          return {
            ...data,
            c_id: data.c_id || testId,
            c_name: data.c_name,
            c_description: data.c_description,
            c_test_type: data.c_test_type,
            c_type: data.c_type,
            c_course_id: data.c_course_id,
            c_start: data.c_start || null,
            c_end: data.c_end || null,
            c_paper_count: data.c_paper_count || 0,
            c_duration: data.c_duration || 0,
            c_scene_config_id: data.c_scene_config_id || 0,
            c_scene_name: data.c_scene_name || ''
          };
        } else {
          showSnackbar('获取测试详情失败: ' + response.data.message, 'error');
          return null;
        }
      }
    } catch (error: any) {
      console.error('获取测试详情失败:', error);
      showSnackbar('获取测试详情失败: ' + (error.response?.data?.message || error.message), 'error');
      return null;
    }
  };

  // 打开批改试卷对话框
  const handleOpenCorrection = (test: TestData, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTestForCorrection(test);
    setIsCorrectionDialogOpen(true);
  };

  // 打开实验资源对话框
  const handleOpenResourceDialog = (test: TestData, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentResourceTest(test);
    setIsResourceDialogOpen(true);
  };

  // 打开试卷管理
  const handleOpenPaperManagement = (testId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTestId(testId);
    setShowPaperManagement(true);
  };

  // 返回测试管理列表
  const handleBackToTestList = () => {
    setShowPaperManagement(false);
    setSelectedTestId(null);
  };

  // 初始化数据
  useEffect(() => {
    fetchExperimentTests(1);
    fetchAllUsers();
    fetchSceneConfigs();
  }, []);

  // 搜索处理
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setPageExperiment(1);
    setPageTheory(1);
  };

  // 打开添加测试对话框
  const handleAddTestClick = () => {
    setCurrentTest({
      c_name: '',
      c_description: '',
      c_test_type: '',
      c_type: '',
      c_paper_count: 1,
      c_course_id: '',
      c_start: null,
      c_end: null,
      c_duration: undefined,
      c_scene_config_id: undefined
    });
    setIsDialogOpen(true);
  };

  // 打开编辑测试对话框
  const handleEditTest = async (test: TestData) => {
    if (!test.c_id) {
      showSnackbar('测试ID不存在，无法编辑', 'error');
      return;
    }

    setLoading(true);
    const testInfo = await fetchTestInfo(test.c_id);
    setLoading(false);

    console.log('handleEditTest - 原始test对象:', test);
    console.log('handleEditTest - fetchTestInfo返回:', testInfo);
    console.log('handleEditTest - 将设置currentTest为:', testInfo);

    if (testInfo) {
      setCurrentTest(testInfo);
      setIsDialogOpen(true);
    }
  };

  // 管理测试用户
  const handleManageUsers = async (test: TestData) => {
    if (!test.c_id) {
      showSnackbar('测试ID不存在，无法获取用户数据', 'error');
      return;
    }

    setCurrentTest(test);
    setLoadingUsers(true);

    try {
      await fetchPapersByTestId(test.c_id);
      const users = await fetchTestUsers(test.c_id);
      setTestUsers(users);
      setIsDrawerOpen(true);
    } catch (error) {
      console.error("获取用户数据失败:", error);
      showSnackbar('获取用户数据失败，请检查网络连接', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  // 保存测试的方法
  const handleSaveTest = async (testData: TestData, files?: File[]) => {
    try {
      console.log('保存测试数据:', testData);

      // 修复：基于testData.c_id判断是更新还是新增，而不是currentTest?.c_id
      const isSuccess = testData.c_id
        ? await handleUpdateTest(testData)
        : await handleAddTest(testData);

      if (isSuccess && files && files.length > 0 && testData.c_id) {
        if (testData.c_test_type === '实验') {
          const formData = new FormData();
          files.forEach(file => {
            formData.append('files[]', file);
          });
          formData.append('course_id', testData.c_course_id);

          try {
            console.log('开始批量上传实验资源:', {
              experiment_id: testData.c_id,
              course_id: testData.c_course_id,
              fileCount: files.length
            });
            
            const response = await apiClientWithToken.post(`/back/api/study/experiments/${testData.c_id}/resources/upload-multiple`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            console.log('批量上传响应:', response.data);
            
            // 放宽成功判断条件，支持多种成功标识
            const isSuccess = response.data.code === 200 || 
                            response.data.code === 0 ||
                            response.data.status === 'success' ||
                            response.data.message?.includes('success') ||
                            response.data.message?.includes('成功') ||
                            response.data.success === true ||
                            (response.status >= 200 && response.status < 300);

            if (isSuccess) {
              showSnackbar(`实验资源批量上传成功，共上传 ${files.length} 个文件`);
            } else {
              const msg = response.data.message || '上传失败但服务器返回成功状态';
              console.warn('批量上传警告:', msg);
              // 即使服务器返回非标准格式，只要HTTP状态码成功就视为成功
              if (response.status >= 200 && response.status < 300) {
                showSnackbar(`实验资源批量上传成功，共上传 ${files.length} 个文件`);
              } else {
                showSnackbar('实验资源批量上传失败: ' + msg, 'warning');
              }
            }
          } catch (error: any) {
            console.error('批量上传实验资源失败:', error);
            console.error('错误详情:', {
              status: error.response?.status,
              data: error.response?.data,
              message: error.message
            });
            
            // 检查是否是网络错误但实际已上传成功
            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
              showSnackbar('上传可能已完成，请刷新页面查看结果', 'info');
            } else {
              const errorMsg = error.response?.data?.message || error.message || '批量上传实验资源失败';
              showSnackbar(`批量上传实验资源失败: ${errorMsg}`, 'warning');
            }
          }
        }
      }

      if (isSuccess) {
        setIsDialogOpen(false);
      }

      return isSuccess;
    } catch (error) {
      console.error('保存测试失败:', error);
      showSnackbar('保存测试时发生错误', 'error');
      return false;
    }
  };

  // 保存测试用户
  const handleSaveTestUsers = async (updatedUsers: TestUser[]) => {
    const newUsers = updatedUsers.filter(user => !user.id);

    if (newUsers.length > 0 && currentTest?.c_id) {
      const usersData = newUsers.map(user => ({
        c_test_id: currentTest.c_id,
        c_username: user.username,
        c_paper_id: user.c_paper_id
      }));

      const success = await batchAddTestUsers(usersData);

      if (success) {
        const users = await fetchTestUsers(currentTest.c_id);
        setTestUsers(users);
        showSnackbar('用户已成功添加到测试');
      }
    } else {
      setTestUsers(updatedUsers);
      showSnackbar('用户信息已更新');
    }
  };

  // 打开删除用户确认弹窗
  const handleOpenDeleteConfirm = (user: TestUser, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user.submit_time || user.correct_status === 2) {
      showSnackbar('已交卷/已批改的用户不允许删除', 'warning');
      return;
    }
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  // 打开删除测试确认弹窗
  const handleOpenTestDeleteConfirm = (testId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestToDelete(testId);
    setDeleteConfirmOpen(true);
  };

  // 关闭确认弹窗
  const handleCloseConfirm = () => {
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
    setTestToDelete(null);
  };

  // 获取测试状态
  const getTestStatus = (test: TestData) => {
    const now = moment();
    const start = test.c_start ? moment(test.c_start) : moment().add(1, 'hour');
    const end = test.c_end ? moment(test.c_end) : moment().add(2, 'hours');

    if (now.isBefore(start)) {
      return { label: '未开始', color: 'primary' as const };
    } else if (now.isAfter(end)) {
      return { label: '已结束', color: 'error' as const };
    } else {
      return { label: '进行中', color: 'success' as const };
    }
  };

  // 过滤测试
  const filteredTests = tests.filter(test => {
    const matchesSearch = test.c_name.toLowerCase().includes(searchText.toLowerCase()) ||
      test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
      test.c_course_id.toLowerCase().includes(searchText.toLowerCase());

    const matchesStartDate = !startDate ||
      (test.c_start && moment(test.c_start).isSameOrAfter(startDate, 'day'));

    const matchesEndDate = !endDate ||
      (test.c_end && moment(test.c_end).isSameOrBefore(endDate, 'day'));

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // 按类型过滤测试
  const experimentTests = filteredTests.filter(test => test.c_test_type === '实验');
  const theoryTests = filteredTests.filter(test => test.c_test_type === '理论测试');

  // 分页处理
  const pageExperimentCount = Math.ceil(experimentTests.length / rowsPerPage);
  const paginatedExperimentTests = experimentTests.slice(
    (pageExperiment - 1) * rowsPerPage,
    pageExperiment * rowsPerPage
  );

  const pageTheoryCount = Math.ceil(theoryTests.length / rowsPerPage);
  const paginatedTheoryTests = theoryTests.slice(
    (pageTheory - 1) * rowsPerPage,
    pageTheory * rowsPerPage
  );

  // 渲染测试表格
  const renderTestTable = (tests: TestData[], page: number, setPage: React.Dispatch<React.SetStateAction<number>>, pageCount: number) => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (tests.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          没有找到匹配的测试
        </Box>
      );
    }

    return (
      <Box>
        <TableContainer sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>测试名称</TableCell>
                {activeTab === 'theory' && (
                  <TableCell sx={{ fontWeight: 600 }}>模式</TableCell>
                )}
                <TableCell sx={{ fontWeight: 600 }}>描述</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>课程ID</TableCell>
                {activeTab === 'experiment' && (
                  <TableCell align="center" sx={{ fontWeight: 600 }}>场景配置</TableCell>
                )}
                <TableCell sx={{ fontWeight: 600 }}>时间范围</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>时长(分钟)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>状态</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 250 }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tests.map((test) => {
                const status = getTestStatus(test);
                const startStr = test.c_start ? moment(test.c_start).format('YYYY-MM-DD') : '未设置';
                const endStr = test.c_end ? moment(test.c_end).format('YYYY-MM-DD') : '未设置';
                const isDeleting = deletingTestId === test.c_id;
                const isPractice = test.c_test_type === '实验';
                return (
                  <TableRow key={test.c_id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{test.c_name}</TableCell>
                    {activeTab === 'theory' && (
                      <TableCell>
                        <Chip
                          label={test.c_type}
                          size="small"
                          color={test.c_type === '考试' ? 'primary' : 'secondary'}
                          sx={{ borderRadius: 1, fontWeight: 500 }}
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ maxWidth: 300 }}>{test.c_description}</TableCell>
                    <TableCell align="center">{test.c_course_id}</TableCell>
                    {activeTab === 'experiment' && (
                      <TableCell align="center">
                        {test.c_scene_name || '未设置'}
                      </TableCell>
                    )}
                    <TableCell>
                      <Box fontSize="0.875rem">
                        <div>开始: {startStr}</div>
                        <div>结束: {endStr}</div>
                      </Box>
                    </TableCell>
                    <TableCell align="center">{test.c_duration || 0}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                        sx={{ borderRadius: 1, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ width: 250 }}>
                      {test.c_test_type === '实验' && (
                        <Tooltip title="查看实验资源">
                          <IconButton
                            onClick={(e) => handleOpenResourceDialog(test, e)}
                            color="info"
                            disabled={isDeleting}
                            sx={{ mr: 0.5 }}
                          >
                            <FolderOpenIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {test.c_type === '考试' && test.c_test_type !== '实验' && (
                        <Tooltip title="批改试卷">
                          <IconButton
                            onClick={(e) => handleOpenCorrection(test, e)}
                            color="warning"
                            disabled={isDeleting}
                            sx={{ mr: 0.5 }}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="编辑测试">
                        <IconButton onClick={() => handleEditTest(test)} color="primary" disabled={isDeleting} sx={{ mr: 0.5 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="管理用户">
                        <IconButton onClick={() => handleManageUsers(test)} color="secondary" disabled={isDeleting} sx={{ mr: 0.5 }}>
                          {loadingUsers && currentTest?.c_id === test.c_id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PeopleIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      {test.c_test_type === '理论测试' && (
                        <Tooltip title="试卷管理">
                          <IconButton
                            onClick={(e) => handleOpenPaperManagement(test.c_id || '', e)}
                            color="success"
                            disabled={isDeleting}
                            sx={{ mr: 0.5 }}
                          >
                            <DescriptionIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="删除测试">
                        <IconButton
                          onClick={(e) => handleOpenTestDeleteConfirm(test.c_id || '', e)}
                          color="error"
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <CircularProgress size={16} sx={{ color: 'white' }} />
                          ) : (
                            <DeleteIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {pageCount > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <Pagination
              count={pageCount}
              page={page}
              onChange={(e, value) => setPage(value)}
              shape="rounded"
              color="primary"
            />
          </Box>
        )}
      </Box>
    );
  };

  // 渲染确认弹窗
  const renderConfirmDialog = () => {
    if (testToDelete) {
      return (
        <Dialog
          open={deleteConfirmOpen}
          onClose={handleCloseConfirm}
          maxWidth="sm"
          fullWidth
          PaperProps={{ style: { borderRadius: 8 } }}
        >
          <DialogTitle sx={{
            backgroundColor: '#f5f5f5',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            alignItems: 'center'
          }}>
            <WarningIcon color="warning" sx={{ mr: 2 }} />
            确认删除测试
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              确定要删除该测试吗？此操作会同时删除关联的试卷、规则和用户关联，<b style={{ color: '#d32f2f' }}>不可撤销</b>。
              <br />
              <span style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '8px', display: 'block' }}>
                提示：建议先备份测试数据再执行删除操作。
              </span>
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2, justifyContent: 'flex-end' }}>
            <Button
              onClick={handleCloseConfirm}
              variant="outlined"
              sx={{ mr: 1 }}
              disabled={!!deletingTestId}
            >
              取消
            </Button>
            <Button
              onClick={handleDeleteTest}
              variant="contained"
              color="error"
              disabled={!!deletingTestId}
            >
              {deletingTestId ? <CircularProgress size={20} sx={{ color: 'white' }} /> : '确认删除'}
            </Button>
          </DialogActions>
        </Dialog>
      );
    }

    if (userToDelete) {
      return (
        <Dialog
          open={deleteConfirmOpen}
          onClose={handleCloseConfirm}
          maxWidth="sm"
          fullWidth
          PaperProps={{ style: { borderRadius: 8 } }}
        >
          <DialogTitle sx={{
            backgroundColor: '#f5f5f5',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            alignItems: 'center'
          }}>
            <WarningIcon color="warning" sx={{ mr: 2 }} />
            确认删除
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              确定要删除用户 <b>{userToDelete?.name}（{userToDelete?.username}）</b> 与该测试的关联关系吗？
              <br />
              <span style={{ color: '#d32f2f', fontSize: '0.875rem', marginTop: '8px', display: 'block' }}>
                提示：此操作仅解除用户与测试的关联，不会删除用户本身。
              </span>
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2, justifyContent: 'flex-end' }}>
            <Button
              onClick={handleCloseConfirm}
              variant="outlined"
              sx={{ mr: 1 }}
              disabled={!!deletingKey}
            >
              取消
            </Button>
            <Button
              onClick={deleteTestUser}
              variant="contained"
              color="error"
              disabled={!!deletingKey}
            >
              {deletingKey ? <CircularProgress size={20} sx={{ color: 'white' }} /> : '确认删除'}
            </Button>
          </DialogActions>
        </Dialog>
      );
    }

    return null;
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 4, position: 'relative' }}>
      {showPaperManagement && selectedTestId ? (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Button
              variant="outlined"
              onClick={handleBackToTestList}
              sx={{ mr: 2 }}
            >
              返回测试列表
            </Button>
            <Typography variant="h5" fontWeight="bold">
              试卷管理 - 测试ID: {selectedTestId}
            </Typography>
          </Box>
          <PaperManagementSystem testId={selectedTestId} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h5" fontWeight="bold">
              测试管理
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddTestClick}
              sx={{ textTransform: 'none', fontWeight: 500, borderRadius: 2, px: 3, py: 1 }}
            >
              添加测试
            </Button>
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="搜索测试名称、描述或课程ID"
                variant="outlined"
                size="small"
                value={searchText}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <LocalizationProvider dateAdapter={AdapterMoment}>
                <DatePicker
                  label="开始日期"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth size="small" />}
                  inputFormat="YYYY/MM/DD"
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={6} md={3}>
              <LocalizationProvider dateAdapter={AdapterMoment}>
                <DatePicker
                  label="结束日期"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  renderInput={(params) => <TextField {...params} fullWidth size="small" />}
                  inputFormat="YYYY/MM/DD"
                />
              </LocalizationProvider>
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                mb: 2,
                '& .MuiTab-root': {
                  fontSize: '1rem',
                  py: 1.5,
                },
                '& .MuiTabs-indicator': {
                  height: 3,
                }
              }}
            >
              <Tab
                value="experiment"
                label={
                  <Box display="flex" alignItems="center">
                    <CodeIcon sx={{ mr: 1, fontSize: 18 }} />
                    实验
                  </Box>
                }
              />
              <Tab
                value="theory"
                label={
                  <Box display="flex" alignItems="center">
                    <MenuBookIcon sx={{ mr: 1, fontSize: 18 }} />
                    理论测试
                  </Box>
                }
              />
            </Tabs>
          </Box>

          {activeTab === 'experiment' && (
            <Box>
              {renderTestTable(paginatedExperimentTests, pageExperiment, setPageExperiment, pageExperimentCount)}
            </Box>
          )}

          {activeTab === 'theory' && (
            <Box>
              {renderTestTable(paginatedTheoryTests, pageTheory, setPageTheory, pageTheoryCount)}
            </Box>
          )}

          <FixedSizeFormDialog
            open={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onSave={handleSaveTest}
            test={currentTest}
            sceneConfigs={sceneConfigs}
          />

          <TestUserDrawer
            open={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            test={currentTest}
            testUsers={testUsers}
            allUsers={allUsers}
            papers={papers}
            onSave={handleSaveTestUsers}
            loading={loadingUsers || loadingPapers}
            onDeleteUser={handleOpenDeleteConfirm}
            deletingKey={deletingKey}
          />

          {currentTestForCorrection && (
            <TestCorrectionDialog
              open={isCorrectionDialogOpen}
              onClose={() => setIsCorrectionDialogOpen(false)}
              testId={currentTestForCorrection.c_id || ''}
              testName={currentTestForCorrection.c_name}
            />
          )}

          {currentResourceTest && (
            <ExperimentResourceDialog
              open={isResourceDialogOpen}
              onClose={() => setIsResourceDialogOpen(false)}
              experimentId={currentResourceTest.c_id || ''}
              experimentName={currentResourceTest.c_name}
              courseId={currentResourceTest.c_course_id}
              onShowMessage={showSnackbar}
            />
          )}

          {renderConfirmDialog()}

          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </>
      )}
    </Paper>
  );
};

export default TestManagement;