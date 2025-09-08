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
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import FixedSizeFormDialog from './TestFormDialog'; 
import TestUserDrawer from './TestUserDrawer';
import TestCorrectionDialog from './TestCorrectionDialog';
import { apiClientWithToken } from "@/utils/axios";

// 应用中文本地化
moment.locale('zh-cn');

// 定义接口类型
interface TestData {
  c_id?: string; // 可选，新增时不传递，更新时必须存在
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

type TestTab = 'practice' | 'theory';

const TestManagement = () => {
  const [tests, setTests] = useState<TestData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>('');
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [pagePractice, setPagePractice] = useState<number>(1);
  const [pageTheory, setPageTheory] = useState<number>(1);
  const [rowsPerPage] = useState<number>(5);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [currentTest, setCurrentTest] = useState<TestData | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TestTab>('practice');
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [loadingPapers, setLoadingPapers] = useState<boolean>(false);
  
  // 删除相关状态
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<TestUser | null>(null);
  const [testToDelete, setTestToDelete] = useState<string | null>(null);

  // 查看测试ID弹窗状态
  const [viewTestIdOpen, setViewTestIdOpen] = useState<boolean>(false);
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);

  // 批改试卷弹窗状态
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState<boolean>(false);
  const [currentTestForCorrection, setCurrentTestForCorrection] = useState<TestData | null>(null);

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
    if (newValue === 'practice') {
      setPagePractice(1);
    } else {
      setPageTheory(1);
    }
  };

  // 获取测试列表
  const fetchTests = async (page: number = 1, pageSize: number = 10) => {
    try {
      setLoading(true);
      const response = await apiClientWithToken.get<ApiResponse>('/back/api/study/test/test_list', {
        params: { page, pageSize }
      });
      
      if (response.data.code === 200) {
        const responseData = response.data.data || {};
        const rawTests = responseData.data || [];
        
        const formattedTests = rawTests.map((item: any) => ({
          c_id: item.c_id, // 列表中需要获取c_id用于后续操作
          c_name: item.c_name,
          c_description: item.c_description,
          c_type: item.c_type,
          c_test_type: item.c_test_type,
          c_course_id: item.c_course_id,
          c_start: item.c_start || null,
          c_end: item.c_end || null,
          c_paper_count: item.c_paper_count || 0,
          c_duration: item.c_duration || 0
        }));
        
        setTests(formattedTests);
        setTotalCount(responseData.count || 0);
      } else {
        showSnackbar('获取测试列表失败: ' + response.data.message, 'error');
      }
    } catch (error: any) {
      console.error('获取测试列表失败:', error);
      showSnackbar('获取测试列表失败: ' + (error.response?.data?.message || error.message), 'error');
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
        return [];
      }
    } catch (error: any) {
      console.error('获取试卷列表失败:', error);
      showSnackbar('获取试卷列表失败: ' + (error.response?.data?.message || error.message), 'error');
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
            id: `${user.test_id}-${user.username}`,
            username: user.username,
            name: userInfo?.name || user.username,
            c_test_id: user.test_id,
            c_paper_id: user.paper_id,
            c_answers: user.answers,
            start_time: user.start_time,
            end_time: user.end_time,
            submit_time: user.submit_time,
            score: user.score || 0,
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

  // 添加测试方法（修复时长传递问题）
const handleAddTest = async (testData: TestData) => {
  try {
    // 验证数据
    if (!testData.c_name.trim()) {
      showSnackbar('测试名称不能为空', 'error');
      return false;
    }
    
    // 关键修复：确保时长正确传递，特别是考试类型
    if (testData.c_type === '考试' && (!testData.c_duration || testData.c_duration <= 0)) {
      showSnackbar('考试类型的测试必须设置有效的时长（分钟）', 'error');
      return false;
    }

      const formatDate = (dateString: string | null) => {
      if (!dateString) return '';
      // 如果只有日期部分，添加默认时间
      if (dateString.length === 10) { // 假设是 YYYY-MM-DD 格式
        return `${dateString} 00:00:00`;
      }
      return dateString;
    };
    
    // 构建提交数据，确保duration字段正确设置
    const { c_id, ...formattedTestData } = {
      name: testData.c_name,
      test_type: testData.c_test_type,
      type: testData.c_type,
      description: testData.c_description,
      paper_count: testData.c_paper_count,
      course_id: testData.c_course_id,
       start: formatDate(testData.c_start),
      end: formatDate(testData.c_end),
      duration: testData.c_duration || 0 // 确保时长正确传递
    };
   

    console.log('提交添加测试数据（包含时长）:', formattedTestData);
    const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_add', formattedTestData);
    
    if (response.data.code === 200) {
      showSnackbar('测试添加成功');
      fetchTests();
      return true;
    } else {
      showSnackbar('测试添加失败: ' + response.data.message, 'error');
      return false;
    }
  } catch (error: any) {
    console.error('添加测试失败:', error);
    showSnackbar('测试添加失败: ' + (error.response?.data?.message || error.message), 'error');
    return false;
  }
};

  // 更新测试（确保传递正确的id）
  const handleUpdateTest = async (testData: TestData) => {
    try {
      // 关键验证：确保更新时有c_id
      if (!testData.c_id) {
        showSnackbar('测试ID不能为空，无法更新', 'error');
        console.error('更新测试失败：c_id为空', testData);
        return false;
      }

      // 验证测试时长是否存在（对于考试类型）
      if (testData.c_type === '考试' && (!testData.c_duration || testData.c_duration <= 0)) {
        showSnackbar('考试类型的测试必须设置有效的时长（分钟）', 'error');
        return false;
      }

      // 构建更新数据，确保包含id字段（后端需要）
      const formattedTestData = {
        id: testData.c_id, // 明确将c_id映射到后端需要的id字段
        name: testData.c_name,
        test_type: testData.c_test_type,
        type: testData.c_type,
        description: testData.c_description,
        paper_count: testData.c_paper_count,
        course_id: testData.c_course_id,
        start: testData.c_start || '',
        end: testData.c_end || '',
        duration: testData.c_duration
      };

      console.log('提交更新测试数据（含id）:', formattedTestData);
      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_update', formattedTestData);
      
      if (response.data.code === 200) {
        showSnackbar('测试更新成功');
        fetchTests();
        return true;
      } else {
        showSnackbar('测试更新失败: ' + response.data.message, 'error');
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
      
      // 先查询该测试是否有关联用户
      const testUsers = await fetchTestUsers(testToDelete);
      if (testUsers.length > 0) {
        showSnackbar(`该测试关联了 ${testUsers.length} 个用户，请先删除用户关联再删除测试`, 'warning');
        setDeletingTestId(null);
        setDeleteConfirmOpen(false);
        setTestToDelete(null);
        return;
      }

      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_del', { id: testToDelete });
      
      if (response.data.code === 200) {
        showSnackbar('测试删除成功');
        fetchTests();
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
      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_info', {
        id: testId
      });
      
      if (response.data.code === 200) {
        return {
          ...response.data.data,
          c_start: response.data.data.c_start || null,
          c_end: response.data.data.c_end || null,
          c_duration: response.data.data.c_duration
        };
      } else {
        showSnackbar('获取测试详情失败: ' + response.data.message, 'error');
        return null;
      }
    } catch (error: any) {
      console.error('获取测试详情失败:', error);
      showSnackbar('获取测试详情失败: ' + (error.response?.data?.message || error.message), 'error');
      return null;
    }
  };

  // 打开查看测试ID弹窗
  const handleOpenViewTestId = (test: TestData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (test.c_id) {
      setCurrentTestId(test.c_id);
      setViewTestIdOpen(true);
    } else {
      showSnackbar('测试ID不存在，无法查看', 'error');
    }
  };

  // 关闭查看测试ID弹窗
  const handleCloseViewTestId = () => {
    setViewTestIdOpen(false);
    setCurrentTestId(null);
  };

  // 复制测试ID到剪贴板
  const copyTestIdToClipboard = () => {
    if (currentTestId) {
      navigator.clipboard.writeText(currentTestId)
        .then(() => {
          showSnackbar('测试ID已成功复制到剪贴板', 'success');
        })
        .catch((err) => {
          console.error('复制失败:', err);
          showSnackbar('复制失败，请手动复制', 'error');
        });
    }
  };

  // 打开批改试卷对话框
  const handleOpenCorrection = (test: TestData, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTestForCorrection(test);
    setIsCorrectionDialogOpen(true);
  };

  // 初始化数据
  useEffect(() => {
    fetchTests();
    fetchAllUsers();
  }, []);

  // 搜索处理
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setPagePractice(1);
    setPageTheory(1);
  };

  // 打开添加测试对话框 - 确保不包含c_id
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
      c_duration: undefined
      // 明确不设置c_id字段
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
  const handleSaveTest = async (testData: TestData) => {
    try {
      console.log('保存测试数据:', testData);
      
      // 根据是否有c_id判断是新增还是更新
      const isSuccess = currentTest?.c_id 
        ? await handleUpdateTest(testData)  // 更新操作，确保传递c_id
        : await handleAddTest(testData);   // 新增操作，不传递c_id
      
      if (isSuccess) {
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error('保存测试失败:', error);
      showSnackbar('保存测试时发生错误', 'error');
    }
  };

  // 保存测试用户（批量添加）
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
  const practiceTests = filteredTests.filter(test => test.c_test_type === '实践操作');
  const theoryTests = filteredTests.filter(test => test.c_test_type === '理论测试');

  // 分页处理
  const pagePracticeCount = Math.ceil(practiceTests.length / rowsPerPage);
  const paginatedPracticeTests = practiceTests.slice(
    (pagePractice - 1) * rowsPerPage, 
    pagePractice * rowsPerPage
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
                <TableCell sx={{ fontWeight: 600 }}>模式</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>描述</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>课程ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>时间范围</TableCell>
                {activeTab === 'theory' && (
                  <TableCell align="center" sx={{ fontWeight: 600 }}>时长(分钟)</TableCell>
                )}
                <TableCell align="center" sx={{ fontWeight: 600 }}>状态</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 300 }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tests.map((test) => {
                const status = getTestStatus(test);
                const startStr = test.c_start ? moment(test.c_start).format('YYYY-MM-DD') : '未设置';
                const endStr = test.c_end ? moment(test.c_end).format('YYYY-MM-DD') : '未设置';
                const isDeleting = deletingTestId === test.c_id;
                const isPractice = test.c_type === '考试'; 
                return (
                  <TableRow key={test.c_id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{test.c_name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={test.c_type} 
                        size="small" 
                        color={test.c_type === '考试' ? 'primary' : 'secondary'}
                        sx={{ borderRadius: 1, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>{test.c_description}</TableCell>
                    <TableCell align="center">{test.c_course_id}</TableCell>
                    <TableCell>
                      <Box fontSize="0.875rem">
                        <div>开始: {startStr}</div>
                        <div>结束: {endStr}</div>
                      </Box>
                    </TableCell>
                    {activeTab === 'theory' && (
                      <TableCell align="center">{test.c_duration || 0}</TableCell>
                    )}
                    <TableCell align="center">
                      <Chip 
                        label={status.label} 
                        color={status.color} 
                        size="small"
                        sx={{ borderRadius: 1, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ width: 300 }}>
                      {/* 查看测试ID按钮 */}
                      <Tooltip title="查看测试ID">
                        <IconButton 
                          onClick={(e) => handleOpenViewTestId(test, e)} 
                          color="info" 
                          disabled={isDeleting}
                          sx={{ mr: 0.5 }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {/* 批改试卷按钮 - 只在考试模式下显示 */}
                      {isPractice && (
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

                      {/* 编辑按钮 */}
                      <Tooltip title="编辑测试">
                        <IconButton onClick={() => handleEditTest(test)} color="primary" disabled={isDeleting} sx={{ mr: 0.5 }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {/* 管理用户按钮 */}
                      <Tooltip title="管理用户">
                        <IconButton onClick={() => handleManageUsers(test)} color="secondary" disabled={isDeleting} sx={{ mr: 0.5 }}>
                          {loadingUsers && currentTest?.c_id === test.c_id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PeopleIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>

                      {/* 删除测试按钮 */}
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
        
        {/* 分页控件 */}
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

  // 渲染查看测试ID弹窗
  const renderViewTestIdDialog = () => {
    return (
      <Dialog
        open={viewTestIdOpen}
        onClose={handleCloseViewTestId}
        maxWidth="xs"
        PaperProps={{ 
          style: { 
            borderRadius: 12,
            boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          } 
        }}
      >
        <Box sx={{ 
          height: 6, 
          width: '100%', 
          backgroundColor: 'primary.main' 
        }} />
        
        <DialogContent sx={{ 
          p: 5, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <Box sx={{ 
            backgroundColor: 'primary.light',
            borderRadius: '50%',
            p: 2,
            mb: 4,
            color: 'white'
          }}>
            <VisibilityIcon sx={{ fontSize: 32 }} />
          </Box>
          
          <Typography variant="h6" sx={{ 
            mb: 3, 
            fontWeight: 600,
            color: 'text.primary'
          }}>
            测试ID信息
          </Typography>

          <Box sx={{ 
            width: '100%',
            mb: 4,
            position: 'relative'
          }}>
            <Typography 
              component="div" 
              sx={{ 
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: 8,
                p: 3,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                fontSize: '1rem',
                color: '#2d3748',
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {currentTestId || '未获取到测试ID'}
            </Typography>
          </Box>
          
          <Typography sx={{ 
            color: 'text.secondary', 
            fontSize: '0.875rem',
            mb: 1,
            maxWidth: '90%'
          }}>
            测试ID用于系统内部标识，可复制用于数据查询和调试
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ 
          p: 3, 
          justifyContent: 'center', 
          gap: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Button 
            onClick={copyTestIdToClipboard}
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            sx={{ 
              textTransform: 'none',
              borderRadius: 20,
              px: 4,
              borderColor: 'grey.300',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'rgba(25, 118, 210, 0.04)'
              }
            }}
          >
            复制ID
          </Button>
          <Button 
            onClick={handleCloseViewTestId}
            variant="contained"
            sx={{ 
              textTransform: 'none',
              borderRadius: 20,
              px: 4,
              backgroundColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.dark'
              }
            }}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 4, position: 'relative' }}>
      {/* 头部标题和添加按钮 */}
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
      
      {/* 搜索和日期筛选 */}
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
      
      {/* 标签页切换 */}
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
            value="practice" 
            label={
              <Box display="flex" alignItems="center">
                <CodeIcon sx={{ mr: 1, fontSize: 18 }} />
                实践操作
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
      
      {/* 测试表格内容 */}
      {activeTab === 'practice' && (
        <Box>
          {renderTestTable(paginatedPracticeTests, pagePractice, setPagePractice, pagePracticeCount)}
        </Box>
      )}
      
      {activeTab === 'theory' && (
        <Box>
          {renderTestTable(paginatedTheoryTests, pageTheory, setPageTheory, pageTheoryCount)}
        </Box>
      )}
      
      {/* 测试表单对话框 */}
      <FixedSizeFormDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveTest}
        test={currentTest}
      />
      
      {/* 测试用户管理抽屉 */}
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

      {/* 批改试卷对话框 */}
      {currentTestForCorrection && (
        <TestCorrectionDialog
          open={isCorrectionDialogOpen}
          onClose={() => setIsCorrectionDialogOpen(false)}
          testId={currentTestForCorrection.c_id || ''}
          testName={currentTestForCorrection.c_name}
        />
      )}

      {/* 确认弹窗 */}
      {renderConfirmDialog()}

      {/* 查看测试ID弹窗 */}
      {renderViewTestIdDialog()}

      {/* 提示消息 */}
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
    </Paper>
  );
};

export default TestManagement;


