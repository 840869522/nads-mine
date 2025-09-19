import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  Pagination, Grid, Tooltip, Button, IconButton,
  Tabs, Tab, CircularProgress, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  Search as SearchIcon,
  Code as CodeIcon, 
  MenuBook as MenuBookIcon,
  Logout as LogoutIcon,
  Error as ErrorIcon,
  FolderOpen as FolderOpenIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import moment from 'moment';
import { useTheme } from '@mui/material/styles';
import { apiClientWithToken } from '@/utils/axios';
import { customFetch } from '@/utils/fetch'; // 新增：引入 customFetch 用于场景启动
import TheoreticalTestPage from './TheoreticalTestPage';
import PracticalTestPage from './PracticalTestPage';
import ExperimentResourceDialog from './ExperimentResourceDialog';
import ScenarioInstanceManagementPage from './manage/Manage_page.tsx'; // 新增：导入场景实例管理页面

// 应用中文本地化
moment.locale('zh-cn');

// AuthContext类型定义
interface AuthContextType {
  user: { c_username?: string; c_email?: string; [key: string]: any } | null;
  role: string[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// API响应与测试数据类型
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

interface Test {
  test_id: string;
  c_name?: string;
  test_name: string;
  c_test_type: '理论测试' | '实验';
  c_type: '考试' | '练习';
  c_description: string;
  test_start: string;
  test_end: string;
  c_course_id?: string;
  c_course_name?: string;
  test_users_id: string;
  duration?: number;
  c_paper_id: string;
}

// 使用带认证的API客户端
const apiClient = apiClientWithToken;

// 请求拦截器 - 添加详细日志
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API请求] ${config.method?.toUpperCase()} ${config.url}`);
    console.log('[请求参数]', config.params || config.data);
    return config;
  },
  (error) => {
    console.error('[请求错误]', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 添加详细日志
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API响应] ${response.config.url}`);
    console.log('[响应数据]', response.data);
    return response;
  },
  (error) => {
    console.error('[响应错误]', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// 测试接口 - 完全匹配后端要求
const theoryTestApi = {
  getUserTheoryTests: async (username: string) => {
    if (!username) {
      throw new Error('获取测试列表失败：用户名为空');
    }
    const response = await apiClient.get(`/back/api/study/test/getUserRelatedTests`, {
      params: { username }
    });
    return response.data;
  },

  getUserExperimentTests: async (username: string) => {
    if (!username) {
      throw new Error('获取实验列表失败：用户名为空');
    }
    const response = await apiClient.get(`/back/api/study/test/getUserRelatedExperiments`, {
      params: { username }
    });
    return response.data;
  },

  getExamPaperDetails: async (testId: string, username: string, testType: string) => {
    if (!testId || !username) {
      throw new Error('获取试卷详情失败：test_id或username为空');
    }
    const response = await apiClient.post(
      `/back/api/study/test/get_exam_paper_details`,
      { 
        test_id: testId,
        username: username,
        test_type: testType
      }
    );
    return response.data;
  },

  submitPaper: async (params: any) => {
    if (!params.test_id || !params.username || !params.c_paper_id) {
      throw new Error('提交试卷失败：缺少test_id、username或c_paper_id');
    }
    const response = await apiClient.post(
      `/back/api/study/test/submit_papers`,
      params
    );
    return response.data;
  },

  getTestUserRelation: async (testId: string, username: string) => {
    if (!testId || !username) {
      const error = new Error('请求参数不完整（test_id或username为空）');
      (error as any).isParameterError = true;
      (error as any).parameters = { testId, username };
      throw error;
    }

    const response = await apiClient.post(
      `/back/api/study/test/getTestUserRelation`,
      { test_id: testId, username }
    );
    return response.data;
  },
};

// 题目类型映射
const mapFrontendTypeToBackend = (type: 'single' | 'multiple' | 'judgment' | 'text'): number => {
  switch (type) {
    case 'single': return 1;
    case 'multiple': return 2;
    case 'judgment': return 3;
    case 'text': return 4;
    default: return 4;
  }
};

const TestManagement_user = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const auth = useAuth() as unknown as AuthContextType;

  // 状态管理
  const [theoreticalTests, setTheoreticalTests] = useState<Test[]>([]);
  const [practicalTests, setPracticalTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [pagePractical, setPagePractical] = useState<number>(1);
  const [pageTheoretical, setPageTheoretical] = useState<number>(1);
  const [rowsPerPage] = useState<number>(5);
  const [currentView, setCurrentView] = useState<'list' | 'practical' | 'theoretical' | 'scenario-instances'>('list');
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [activeTab, setActiveTab] = useState<'practical' | 'theoretical'>('theoretical');
  const [snackbar, setSnackbar] = useState<{
    open: boolean; message: string; severity: 'success' | 'error' | 'info'
  }>({ open: false, message: '', severity: 'success' });
  const [username, setUsername] = useState<string>('');
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    details: string;
    requestParams?: any;
  }>({ open: false, title: '', details: '', requestParams: null });
  const [startingScenarioId, setStartingScenarioId] = useState<string | null>(null);
  const [resourceDialogOpen, setResourceDialogOpen] = useState<boolean>(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Test | null>(null);
  const [selectedScenarioName, setSelectedScenarioName] = useState<string>(''); // 新增：存储当前场景名称

  // 从localStorage读取认证状态
  const getAuthState = (): { isAuthenticated: boolean; username: string } => {
    try {
      const droneSimUserStr = localStorage.getItem('droneSimUser');
      console.log('读取droneSimUser:', droneSimUserStr);

      if (!droneSimUserStr) {
        console.log('认证失败：未找到droneSimUser');
        return { isAuthenticated: false, username: '' };
      }

      const droneSimUser = JSON.parse(droneSimUserStr);
      const userInfo = droneSimUser?.user || null;
      const userUsername = userInfo?.c_username || '';

      if (userInfo && userUsername.trim()) {
        console.log('认证成功：用户名=', userUsername.trim());
        return {
          isAuthenticated: true,
          username: userUsername.trim()
        };
      }

      console.log('认证失败：droneSimUser结构异常或无c_username');
      return { isAuthenticated: false, username: '' };
    } catch (err) {
      console.error('解析droneSimUser失败:', err);
      return { isAuthenticated: false, username: '' };
    }
  };

  // 认证状态检查与数据加载
  useEffect(() => {
    const checkAuthAndLoadData = () => {
      const { isAuthenticated, username } = getAuthState();

      if (!isAuthenticated || !username) {
        setError('请先登录');
        setLoading(false);
        const timer = setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
        return () => clearTimeout(timer);
      }

      setUsername(username);
      setError('');
      fetchTests(username);
    };

    if (!auth.isLoading) {
      checkAuthAndLoadData();
    }
  }, [auth.isLoading]);

  // 当日期筛选条件变化时重置分页
  useEffect(() => {
    if (activeTab === 'practical') {
      setPagePractical(1);
    } else {
      setPageTheoretical(1);
    }
  }, [startDate, endDate, activeTab]);

  // 加载测试列表 - 确保test_id和c_paper_id正确获取
  const fetchTests = async (username: string) => {
    if (!username) return;

    try {
      setLoading(true);
      console.log('=== 开始获取测试列表 ===');
      console.log('当前用户名:', username);
      console.log('理论测试API地址:', '/back/api/study/test/getUserRelatedTests');
      console.log('实验测试API地址:', '/back/api/study/test/getUserRelatedExperiments');

      const [theoreticalTestsData, practicalTestsData] = await Promise.all([
        theoryTestApi.getUserTheoryTests(username),
        theoryTestApi.getUserExperimentTests(username)
      ]);

      console.log('=== 后端API响应结果 ===');
      console.log('理论测试API状态码:', theoreticalTestsData?.code);
      console.log('理论测试API消息:', theoreticalTestsData?.message);
      console.log('理论测试数据数量:', theoreticalTestsData?.data ? theoreticalTestsData.data.length : 0);
      console.log('实验测试API状态码:', practicalTestsData?.code);
      console.log('实验测试API消息:', practicalTestsData?.message);
      console.log('实验测试数据数量:', practicalTestsData?.data ? practicalTestsData.data.length : 0);
      console.log('理论测试原始数据:', theoreticalTestsData?.data);
      console.log('实验测试原始数据:', practicalTestsData?.data);

      let formattedTheoreticalTests: Test[] = [];
      if (theoreticalTestsData?.code === 200) {
        formattedTheoreticalTests = (theoreticalTestsData.data || []).reduce((acc: Test[], test: any) => {
          if (!test.c_id || !test.c_id.trim()) {
            console.error('过滤无效理论测试数据（缺少c_id）:', test);
            return acc;
          }

          const userPaperId = test.c_paper_id || test.paper_id || '';
          console.log('理论测试数据 - c_id:', test.c_id, 'c_paper_id:', test.c_paper_id);

          acc.push({
            test_id: test.c_id.trim(),
            c_name: test.c_name || '未知测试',
            test_name: test.test_name || test.c_name || '未命名测试',
            c_test_type: '理论测试',
            c_type: test.c_type === '考试' ? '考试' : '练习',
            c_description: test.c_description || '',
            test_start: test.test_start || test.c_start || moment().format('YYYY-MM-DD HH:mm'),
            test_end: test.test_end || test.c_end || moment().add(1, 'hour').format('YYYY-MM-DD HH:mm'),
            c_course_id: test.c_course_id,
            c_course_name: test.c_course_name || '未知课程',
            test_users_id: `${test.c_id}_${username}`,
            duration: test.duration ? Number(test.duration) : undefined,
            c_paper_id: userPaperId.trim(),
            test_uuid: test.test_uuid || ''
          });
          return acc;
        }, []);
      }

      let formattedPracticalTests: Test[] = [];
      if (practicalTestsData?.code === 200) {
        formattedPracticalTests = (practicalTestsData.data || []).reduce((acc: Test[], test: any) => {
          if (!test.c_id || !test.c_id.trim()) {
            console.error('过滤无效实验测试数据（缺少c_id）:', test);
            return acc;
          }

          const userPaperId = test.c_paper_id || test.paper_id || '';
          console.log('实验测试数据 - c_id:', test.c_id, 'c_paper_id:', test.c_paper_id);

          acc.push({
            test_id: test.c_id.trim(),
            c_name: test.c_name || '未知测试',
            test_name: test.test_name || test.c_name || '未命名测试',
            c_test_type: '实验',
            c_type: test.c_type === '考试' ? '考试' : '练习',
            c_description: test.c_description || '',
            test_start: test.test_start || test.c_start || moment().format('YYYY-MM-DD HH:mm'),
            test_end: test.test_end || test.c_end || moment().add(1, 'hour').format('YYYY-MM-DD HH:mm'),
            c_course_id: test.c_course_id,
            c_course_name: test.c_course_name || '未知课程',
            test_users_id: `${test.c_id}_${username}`,
            duration: test.duration ? Number(test.duration) : undefined,
            c_paper_id: userPaperId.trim()
          });
          return acc;
        }, []);
      }

      setTheoreticalTests(formattedTheoreticalTests);
      setPracticalTests(formattedPracticalTests);
      console.log('=== 数据处理结果 ===');
      console.log('格式化后理论测试数量:', formattedTheoreticalTests.length);
      console.log('格式化后实验测试数量:', formattedPracticalTests.length);
      console.log('理论测试详情:', formattedTheoreticalTests);
      console.log('实验测试详情:', formattedPracticalTests);
      showSnackbar(`测试列表加载成功（理论测试：${formattedTheoreticalTests.length}个，实验测试：${formattedPracticalTests.length}个）`, 'success');
    } catch (err: any) {
      const errorMsg = err.message || '网络异常，无法加载测试';
      setError(errorMsg);
      showSnackbar(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 登出处理
  const handleLogout = () => {
    console.log('执行登出操作');
    if (typeof auth.logout === 'function') {
      auth.logout();
    }
    localStorage.removeItem('droneSimUser');
    setUsername('');
    window.location.href = '/login';
  };

  // 样式辅助函数
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTableRowBgColor = (index: number) =>
    isDarkMode ? (index % 2 === 0 ? '#252525' : '#1e1e1e') : (index % 2 === 0 ? '#fafafa' : '#ffffff');
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#333';
  const getHeaderTextColor = () => isDarkMode ? '#fff' : '#000';
  const getButtonColor = () => isDarkMode ? '#3f51b5' : '#1976d2';

  // 提示框控制
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // 显示详细错误对话框，包含请求参数
  const showErrorDialog = (title: string, details: string, requestParams?: any) => {
    setErrorDialog({
      open: true,
      title,
      details,
      requestParams: requestParams ? JSON.stringify(requestParams, null, 2) : undefined
    });
  };

  // 处理资源对话框的消息显示
  const handleShowMessage = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    const mappedSeverity = severity === 'warning' ? 'info' : severity;
    showSnackbar(message, mappedSeverity);
  };

  // 渲染日期选择器
  const renderDatePicker = (
    label: string,
    selectedDate: moment.Moment | null,
    onDateChange: (newValue: moment.Moment | null) => void
  ) => (
    <LocalizationProvider dateAdapter={AdapterMoment}>
      <DatePicker
        label={label}
        value={selectedDate}
        onChange={onDateChange}
        allowManualInput
        inputFormat="YYYY/MM/DD"
        onInputChange={(inputValue) => {
          if (!inputValue) {
            onDateChange(null);
            return;
          }
          const parsedDate = moment(inputValue, ['YYYY/MM/DD', 'YYYY-MM-DD', 'MM/DD/YYYY'], true);
          if (parsedDate.isValid()) {
            onDateChange(parsedDate);
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            size="small"
            placeholder={`例如：${moment().format('YYYY/MM/DD')}`}
            InputProps={{
              ...params.InputProps,
              style: { color: getTextColor() },
              inputProps: { type: 'text' }
            }}
            InputLabelProps={{ style: { color: getTextColor() } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? '#252525' : '#fff'
              }
            }}
          />
        )}
      />
    </LocalizationProvider>
  );

  // 测试筛选
  const filteredTheoreticalTests = theoreticalTests.filter((test) => {
    const matchesSearch = searchText.trim() === ''
      ? true
      : test.test_name.toLowerCase().includes(searchText.toLowerCase()) ||
        test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
        (test.c_course_id && test.c_course_id.toLowerCase().includes(searchText.toLowerCase())) ||
        (test.c_course_name && test.c_course_name.toLowerCase().includes(searchText.toLowerCase()));

    const matchesStartDate = !startDate
      ? true
      : (test.test_start && moment(test.test_start).isSameOrAfter(moment(startDate).startOf('day')));

    const matchesEndDate = !endDate
      ? true
      : (test.test_end && moment(test.test_end).isSameOrBefore(moment(endDate).endOf('day')));

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const filteredPracticalTests = practicalTests.filter((test) => {
    const matchesSearch = searchText.trim() === ''
      ? true
      : test.test_name.toLowerCase().includes(searchText.toLowerCase()) ||
        test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
        (test.c_course_id && test.c_course_id.toLowerCase().includes(searchText.toLowerCase())) ||
        (test.c_course_name && test.c_course_name.toLowerCase().includes(searchText.toLowerCase()));

    const matchesStartDate = !startDate
      ? true
      : (test.test_start && moment(test.test_start).isSameOrAfter(moment(startDate).startOf('day')));

    const matchesEndDate = !endDate
      ? true
      : (test.test_end && moment(test.test_end).isSameOrBefore(moment(endDate).endOf('day')));

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // 测试分页
  const practicalPageCount = Math.ceil(filteredPracticalTests.length / rowsPerPage);
  const theoreticalPageCount = Math.ceil(filteredTheoreticalTests.length / rowsPerPage);
  const paginatedPractical = filteredPracticalTests.slice(
    (pagePractical - 1) * rowsPerPage,
    pagePractical * rowsPerPage
  );
  const paginatedTheoretical = filteredTheoreticalTests.slice(
    (pageTheoretical - 1) * rowsPerPage,
    pageTheoretical * rowsPerPage
  );

  // 启动场景
  const startScenarioByTestId = async (testId: string, testName: string) => {
    try {
      if (!testId || !testId.trim()) {
        const errorMsg = '测试ID无效或为空，无法启动场景';
        showErrorDialog('测试ID无效', errorMsg, { testId });
        return;
      }

      if (!username || !username.trim()) {
        const errorMsg = '用户信息无效，无法启动场景';
        showErrorDialog('用户信息无效', errorMsg, { username, testId });
        return;
      }

      setLoading(true);
      setStartingScenarioId(testId);
      console.log(`准备启动场景: test_id: ${testId}, 用户名: ${username}`);

      if (!window.confirm(`您确定要启动测试 “${testName}” 的场景演练吗？`)) {
        setLoading(false);
        setStartingScenarioId(null);
        return;
      }

      const response = await customFetch(`/back/api/scenarios/${testId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error('启动失败');
      }

      const result = await response.json();
      if (result.code !== 200) {
        throw new Error(result.message || '启动失败');
      }

      showSnackbar(result.message || '场景启动成功', 'success');
      setSelectedScenarioName(testName);
      setCurrentView('scenario-instances');
    } catch (err: any) {
      console.error('启动场景失败:', err);
      showSnackbar(`启动失败: ${err.message || '未知错误'}`, 'error');
    } finally {
      setLoading(false);
      setStartingScenarioId(null);
    }
  };

  // 进入测试 - 修改：实验测试调用startScenarioByTestId并跳转到场景实例管理
  const handleEnterTest = async (test: Test) => {
    try {
      if (!test.test_id || !test.test_id.trim()) {
        const errorMsg = '测试ID无效或为空，无法进入测试';
        showErrorDialog('测试ID无效', errorMsg, { testId: test.test_id, test });
        return;
      }

      if (!username || !username.trim()) {
        const errorMsg = '用户信息无效，无法进入测试';
        showErrorDialog('用户信息无效', errorMsg, { username, testId: test.test_id });
        return;
      }

      setLoading(true);
      console.log(`准备进入测试: ${test.test_name}, test_id: ${test.test_id}, 用户名: ${username}`);

      if (test.c_test_type === '实验') {
        await startScenarioByTestId(test.test_id, test.test_name);
        return;
      }

      if (!test.c_paper_id || !test.c_paper_id.trim()) {
        const errorMsg = '当前测试未分配试卷，无法进入理论测试';
        showErrorDialog('试卷ID缺失', errorMsg, { c_paper_id: test.c_paper_id, testId: test.test_id });
        setLoading(false);
        return;
      }

      const requestParams = {
        test_id: test.test_id.trim(),
        username: username.trim(),
        test_name: test.test_name,
        test_type: test.c_type
      };

      const relationResponse = await theoryTestApi.getTestUserRelation(
        requestParams.test_id,
        requestParams.username
      );

      if (!relationResponse) {
        throw new Error('未收到服务器响应');
      }

      if (relationResponse.code !== 200) {
        showErrorDialog(
          '进入测试失败',
          `错误代码: ${relationResponse.code || '未知'}\n` +
          `错误信息: ${relationResponse.message || '无详细信息'}`,
          requestParams
        );
        throw new Error(relationResponse.message || '获取测试信息失败');
      }

      if (!relationResponse.data) {
        throw new Error('服务器返回数据为空');
      }

      if (!relationResponse.data.paper_id || !relationResponse.data.paper_id.trim()) {
        throw new Error('未找到有效的试卷信息，无法进入理论测试');
      }

      const updatedTest: Test = {
        ...test,
        c_test_type: relationResponse.data.c_test_type || test.c_test_type,
        test_start: relationResponse.data.c_start || test.test_start,
        test_end: relationResponse.data.c_end || test.test_end,
        duration: relationResponse.data.c_duration || test.duration,
        c_paper_id: relationResponse.data.paper_id || test.c_paper_id,
        test_id: relationResponse.data.test_id || test.test_id,
      };

      if (!updatedTest.c_paper_id || !updatedTest.c_paper_id.trim()) {
        throw new Error("后端未返回有效的试卷ID，无法进入测试");
      }

      setCurrentTest(updatedTest);
      setCurrentView('theoretical');
    } catch (err: any) {
      console.error('进入测试失败:', err);
      showSnackbar(err.message || '进入测试失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 打开资源对话框
  const handleOpenResources = (test: Test) => {
    setSelectedExperiment(test);
    setResourceDialogOpen(true);
  };

  // 返回测试列表
  const handleBackToList = () => {
    setCurrentView('list');
    setCurrentTest(null);
    setSelectedScenarioName('');
  };

  // 判断测试状态
  const getTestStatus = (test: Test) => {
    const now = moment();
    const start = test.test_start ? moment(test.test_start) : moment().add(1, 'hour');
    const end = test.test_end ? moment(test.test_end) : moment().add(2, 'hours');

    if (!start.isValid()) {
      console.warn(`测试 ${test.test_name} 的开始时间无效: ${test.test_start}`);
      return { label: '时间无效', color: 'error' as const };
    }
    if (!end.isValid()) {
      console.warn(`测试 ${test.test_name} 的结束时间无效: ${test.test_end}`);
      return { label: '时间无效', color: 'error' as const };
    }

    if (now.isBefore(start)) {
      return { label: '未开始', color: 'primary' as const };
    } else if (now.isAfter(end)) {
      return { label: '已结束', color: 'error' as const };
    } else {
      return { label: '进行中', color: 'success' as const };
    }
  };

  // 渲染测试表格
  const renderTestTable = (
    tests: Test[],
    page: number,
    setPage: React.Dispatch<React.SetStateAction<number>>,
    pageCount: number
  ) => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, color: 'error.main' }}>
          {error}
        </Box>
      );
    }

    if (tests.length === 0) {
      return (
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 200,
          color: getTextColor()
        }}>
          没有找到匹配的测试
        </Box>
      );
    }

    const isPracticalTestTable = tests[0]?.c_test_type === '实验';

    return (
      <Box>
        <TableContainer sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: isDarkMode ? '#333' : '#e8e8e8' }}>
                <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>测试名称</TableCell>
                {!isPracticalTestTable && (
                  <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>类型</TableCell>
                )}
                <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>课程名称</TableCell>
                <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>描述</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>时间范围</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>状态</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tests.map((test, index) => {
                const status = getTestStatus(test);
                const isExpired = status.label === '已结束';
                const isTestValid = !!test.test_id && test.test_id.trim() !== '';
                const isPaperValid = !!test.c_paper_id && test.c_paper_id.trim() !== '';

                return (
                  <TableRow
                    key={test.test_id || `test_${index}`}
                    hover
                    sx={{ backgroundColor: getTableRowBgColor(index) }}
                  >
                    <TableCell sx={{ fontWeight: 500, color: getTextColor() }}>
                      {test.test_name}
                    </TableCell>
                    {!isPracticalTestTable && (
                      <TableCell>
                        <Chip
                          label={test.c_type}
                          size="small"
                          color={test.c_type === '考试' ? 'primary' : 'secondary'}
                          sx={{ borderRadius: 1, fontWeight: 500 }}
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ color: getTextColor() }}>
                      {test.c_course_name || test.c_course_id || '无'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, color: getTextColor() }}>{test.c_description}</TableCell>
                    <TableCell align="center" sx={{ color: getTextColor() }}>
                      <Box fontSize="0.875rem">
                        <div>开始: {test.test_start ? moment(test.test_start).format('YYYY-MM-DD HH:mm') : '无效时间'}</div>
                        <div>结束: {test.test_end ? moment(test.test_end).format('YYYY-MM-DD HH:mm') : '无效时间'}</div>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                        sx={{ borderRadius: 1, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip
                          title={!isTestValid ? "测试ID无效，无法进入" :
                            !isPaperValid && !isPracticalTestTable ? "试卷ID无效，无法进入" :
                              isExpired ? "测试已结束，无法进入" : "进入测试"}
                          placement="top"
                        >
                          <IconButton
                            size="small"
                            disabled={!isTestValid || (!isPaperValid && !isPracticalTestTable) || isExpired || loading}
                            onClick={() => handleEnterTest(test)}
                            sx={{
                              backgroundColor: (!isTestValid || (!isPaperValid && !isPracticalTestTable) || isExpired)
                                ? (isDarkMode ? '#555' : '#ccc')
                                : getButtonColor(),
                              color: '#fff',
                              '&:hover': {
                                backgroundColor: (!isTestValid || (!isPaperValid && !isPracticalTestTable) || isExpired)
                                  ? (isDarkMode ? '#555' : '#ccc')
                                  : (isDarkMode ? '#303f9f' : '#1565c0')
                              },
                              borderRadius: 1,
                              minWidth: 40
                            }}
                          >
                            {!isTestValid ? <ErrorIcon fontSize="small" /> :
                              (!isPaperValid && !isPracticalTestTable) ? <ErrorIcon fontSize="small" /> :
                                loading ? <CircularProgress size={16} /> :
                                  isExpired ? <ErrorIcon fontSize="small" /> : <MenuBookIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        {isPracticalTestTable && (
                          <Tooltip title="查看资源" placement="top">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenResources(test)}
                              disabled={!isTestValid || loading}
                              sx={{
                                color: (!isTestValid || loading) ? (isDarkMode ? '#666' : '#999') : getTextColor(),
                                '&:hover': {
                                  backgroundColor: (!isTestValid || loading) ? 'transparent' : (isDarkMode ? '#303f9f' : '#e3f2fd')
                                },
                                borderRadius: 1
                              }}
                            >
                              <FolderOpenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
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
              sx={{
                '& .MuiPaginationItem-root': { color: getTextColor() },
                '& .MuiPaginationItem-page.Mui-selected': {
                  backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
                  color: '#fff',
                }
              }}
            />
          </Box>
        )}
      </Box>
    );
  };

  // 视图渲染 - 场景实例管理页
  if (currentView === 'scenario-instances' && username) {
    return (
      <ScenarioInstanceManagementPage
        username={username}
        scenarioName={selectedScenarioName}
        onBack={handleBackToList}
        onSwitchView={() => {}} // 未提供具体切换逻辑，保持为空函数
      />
    );
  }

  // 视图渲染 - 理论测试页
  if (currentView === 'theoretical' && currentTest && username) {
    return (
      <TheoreticalTestPage
        test={currentTest}
        onBack={handleBackToList}
        theoryTestApi={{
          getExamPaper: () => {
            if (!currentTest.test_id || !username || !currentTest.c_paper_id) {
              throw new Error('获取试卷失败：test_id、username或c_paper_id为空');
            }
            return theoryTestApi.getExamPaperDetails(
              currentTest.test_id,
              username,
              currentTest.c_type || '考试'
            );
          },
          submitPaper: (params) => {
            if (!currentTest.test_id || !username || !currentTest.c_paper_id) {
              throw new Error('提交试卷失败：test_id、username或c_paper_id为空');
            }
            return theoryTestApi.submitPaper({
              ...params,
              test_id: currentTest.test_id,
              username: username,
              c_paper_id: currentTest.c_paper_id
            });
          }
        }}
        mapFrontendTypeToBackend={mapFrontendTypeToBackend}
      />
    );
  }

  // 获取当前用户信息
  const { isAuthenticated } = getAuthState();

  // 未认证且加载中状态
  if (!isAuthenticated && auth.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>检查认证状态...</Typography>
      </Box>
    );
  }

  // 测试列表视图
  return (
    <Paper sx={{
      p: 3,
      borderRadius: 4,
      position: 'relative',
      backgroundColor: getCardBgColor(),
      color: getTextColor(),
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" color={getTextColor()}>
          测试管理
        </Typography>

        {isAuthenticated && username && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ mr: 2 }}>
              当前用户: {username}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              退出登录
            </Button>
          </Box>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            placeholder="搜索测试名称、描述或课程名称"
            variant="outlined"
            size="small"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
              style: { color: getTextColor(), backgroundColor: isDarkMode ? '#252525' : '#fff' }
            }}
            InputLabelProps={{ style: { color: getTextColor() } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          {renderDatePicker("开始日期", startDate, setStartDate)}
        </Grid>
        <Grid item xs={6} md={3}>
          {renderDatePicker("结束日期", endDate, setEndDate)}
        </Grid>
      </Grid>

      <Box sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          sx={{
            mb: 2,
            '& .MuiTab-root': { fontSize: '1rem', py: 1.5 },
            '& .MuiTabs-indicator': { height: 3 }
          }}
        >
          <Tab
            value="practical"
            label={<Box display="flex" alignItems="center"><CodeIcon sx={{ mr: 1, fontSize: 18 }} />实验</Box>}
          />
          <Tab
            value="theoretical"
            label={<Box display="flex" alignItems="center"><MenuBookIcon sx={{ mr: 1, fontSize: 18 }} />理论测试</Box>}
          />
        </Tabs>
      </Box>

      {activeTab === 'practical' && (
        <Box>{renderTestTable(paginatedPractical, pagePractical, setPagePractical, practicalPageCount)}</Box>
      )}

      {activeTab === 'theoretical' && (
        <Box>{renderTestTable(paginatedTheoretical, pageTheoretical, setPageTheoretical, theoreticalPageCount)}</Box>
      )}

      {selectedExperiment && (
        <ExperimentResourceDialog
          open={resourceDialogOpen}
          onClose={() => {
            setResourceDialogOpen(false);
            setSelectedExperiment(null);
          }}
          experimentId={selectedExperiment.test_id}
          experimentName={selectedExperiment.test_name}
          courseId={selectedExperiment.c_course_id || ''}
          onShowMessage={handleShowMessage}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={errorDialog.open}
        onClose={() => setErrorDialog(prev => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
          <ErrorIcon sx={{ mr: 1 }} />
          {errorDialog.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {errorDialog.details.split('\n').map((line, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>{line}</div>
            ))}
          </DialogContentText>

          {errorDialog.requestParams && (
            <Box sx={{ mt: 2, p: 2, bgColor: '#f5f5f5', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>请求参数:</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                {errorDialog.requestParams}
              </pre>
            </Box>
          )}

          <DialogContentText sx={{ mt: 2 }}>
            请记录以上错误信息并联系系统管理员解决
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorDialog(prev => ({ ...prev, open: false }))}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TestManagement_user;