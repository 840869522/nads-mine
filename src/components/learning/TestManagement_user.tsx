import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  Pagination, Grid, Tooltip, Button, IconButton,
  Tabs, Tab, CircularProgress, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions,TablePagination 
} from '@mui/material';
import { 
  Search as SearchIcon,
  Code as CodeIcon, 
  MenuBook as MenuBookIcon,
  Logout as LogoutIcon,
  Error as ErrorIcon,
  FolderOpen as FolderOpenIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import moment from 'moment';
import { useTheme } from '@mui/material/styles';
import { apiClientWithToken } from '@/utils/axios';
import { customFetch } from '@/utils/fetch';
import TheoreticalTestPage from './TheoreticalTestPage';
import ExperimentResourceDialog from './ExperimentResourceDialog';
import ScenarioManagementPage from './manage/Manage_page.tsx';
import ScenarioInstanceManagementPage from './manage/instances/Manage_instances_page.tsx';

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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 添加详细日志
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
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

  

  getUserTestScore: async (courseId: string, username: string, testId: string) => {
    if (!courseId || !username || !testId) {
      throw new Error('获取成绩失败：course_id、username或c_test_id为空');
    }
    const response = await apiClient.post(
      `/back/api/study/test/get_user_test_score`,
      { 
        course_id: courseId,
        username: username,
        c_test_id: testId
      }
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
  const [rowsPerPage, setRowsPerPage] = useState<number>(10); // 默认10
  const [pagePractical, setPagePractical] = useState<number>(1);
  const [pageTheoretical, setPageTheoretical] = useState<number>(1);
  const [currentView, setCurrentView] = useState<'list' | 'practical' | 'theoretical' | 'scenario-management' | 'scenario-instances'>('list');
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
  const [selectedScenarioName, setSelectedScenarioName] = useState<string>('');
  const [submissionStatus, setSubmissionStatus] = useState<Record<string, boolean>>({});
  const [scoresDialog, setScoresDialog] = useState<{
    open: boolean;
    data: any;
    type: 'theory' | 'experiment';
    testName: string;
  }>({ open: false, data: null, type: 'theory', testName: '' });
  const [scoresLoadingMap, setScoresLoadingMap] = useState<Record<string, boolean>>({});

  // 处理页码变化
  const handleChangePage = (event: unknown, newPage: number) => {
    if (activeTab === 'practical') {
      setPagePractical(newPage + 1);
    } else {
      setPageTheoretical(newPage + 1);
    }
  };

  // 处理每页行数变化
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    
    // 重置到第一页
    if (activeTab === 'practical') {
      setPagePractical(1);
    } else {
      setPageTheoretical(1);
    }
  };

  // 修改确认对话框状态，添加提示信息
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    test: Test | null;
    message?: string; // 添加提示消息字段
  }>({ open: false, test: null });

  // 从localStorage读取认证状态
  const getAuthState = (): { isAuthenticated: boolean; username: string } => {
    try {
      const droneSimUserStr = localStorage.getItem('droneSimUser');

      if (!droneSimUserStr) {
        return { isAuthenticated: false, username: '' };
      }

      const droneSimUser = JSON.parse(droneSimUserStr);
      const userInfo = droneSimUser?.user || null;
      const userUsername = userInfo?.c_username || '';

      if (userInfo && userUsername.trim()) {
        return {
          isAuthenticated: true,
          username: userUsername.trim()
        };
      }

      return { isAuthenticated: false, username: '' };
    } catch (err) {
      return { isAuthenticated: false, username: '' };
    }
  };

  // 认证状态检查与数据加载
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
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
      await fetchTests(username);
    };

    if (!auth.isLoading) {
      checkAuthAndLoadData();
    }
  }, [auth.isLoading]);

// 当日期筛选条件或每页行数变化时重置分页
 useEffect(() => {
  if (activeTab === 'practical') {
    setPagePractical(1);
  } else {
    setPageTheoretical(1);
  }
}, [startDate, endDate, activeTab, rowsPerPage]); // 添加 rowsPerPage 依赖

  // 加载测试列表并检查考试提交状态
  const fetchTests = async (username: string) => {
    if (!username) return;

    try {
      setLoading(true);

      const [theoreticalTestsData, practicalTestsData] = await Promise.all([
        theoryTestApi.getUserTheoryTests(username),
        theoryTestApi.getUserExperimentTests(username)
      ]);

      let formattedTheoreticalTests: Test[] = [];
      if (theoreticalTestsData?.code === 200) {
        formattedTheoreticalTests = (theoreticalTestsData.data || []).reduce((acc: Test[], test: any) => {
          if (!test.c_id || !test.c_id.trim()) {
            return acc;
          }

          const userPaperId = test.c_paper_id || test.paper_id || '';

          acc.push({
            test_id: test.c_id.trim().replace(/[{}]/g, ''),
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
          });
          return acc;
        }, []);
      }

      let formattedPracticalTests: Test[] = [];
      if (practicalTestsData?.code === 200) {
        formattedPracticalTests = (practicalTestsData.data || []).reduce((acc: Test[], test: any) => {
          if (!test.c_id || !test.c_id.trim()) {
            return acc;
          }

          const userPaperId = test.c_paper_id || test.paper_id || '';

          acc.push({
            test_id: test.c_id.trim().replace(/[{}]/g, ''),
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
            c_paper_id: userPaperId.trim(),
          });
          return acc;
        }, []);
      }

      setTheoreticalTests(formattedTheoreticalTests);
      setPracticalTests(formattedPracticalTests);

      // 关键修改：删除不存在的状态检查
    // 不再调用 checkSubmissionStatus 接口
    
  } catch (err: any) {
    setError(err.message || '加载测试列表失败');
  } finally {
    setLoading(false);
  }
};


  const handleEnterTest = async (test: Test) => {
  try {
    setLoading(true);
    
    // 关键修改：使用 getTestUserRelation 接口检查是否已提交
    if (test.c_type === '考试') {
      const response = await theoryTestApi.getTestUserRelation(test.test_id, username);
      
      // 如果后端返回400状态码且包含"已经提交过考试试卷"的提示，说明已提交
      if (response.code === 400 && response.message.includes('已经提交过考试试卷')) {
        setErrorDialog({
          open: true,
          title: '无法进入测试',
          details: '试卷已提交，无法再次进入考试。',
          requestParams: null
        });
        return;
      }
      
      // 其他错误也阻止进入
      if (response.code !== 200) {
        setErrorDialog({
          open: true,
          title: '无法进入测试',
          details: response.message || '检查测试状态失败',
          requestParams: null
        });
        return;
      }
    }

    // 关键修改：只有实验测试显示确认对话框
    if (test.c_test_type === '实验') {
      setConfirmDialog({
        open: true,
        test: test,
        message: '请注意测试截至时间，超时提交不计成绩。' // 添加实验测试的特定提示
      });
    } else {
      // 理论测试直接进入
      setCurrentTest(test);
      setCurrentView('theoretical');
    }

  } catch (err: any) {
    setErrorDialog({
      open: true,
      title: '进入测试失败',
      details: err.message || '发生未知错误',
      requestParams: { test_id: test.test_id, username }
    });
  } finally {
    setLoading(false);
  }
};

// 确认进入测试
const handleConfirmEnterTest = () => {
  if (!confirmDialog.test) return;
  
  // 直接进入实验测试界面
  setCurrentTest(confirmDialog.test);
  setCurrentView('scenario-management');
  setConfirmDialog({ open: false, test: null });
};

// 取消进入测试
const handleCancelEnterTest = () => {
  setConfirmDialog({ open: false, test: null });
};


  const handleViewScores = async (test: Test) => {
    try {
      setScoresLoadingMap(prev => ({ ...prev, [test.test_id]: true }));
      const courseId = test.c_course_id || '';
      const response = await theoryTestApi.getUserTestScore(courseId, username, test.test_id);
      if (response.code !== 200) {
        throw new Error(response.message || '获取成绩失败');
      }
      const data = response.data;
      const type = test.c_test_type === '理论测试' ? 'theory' : 'experiment';
      const scoresData = type === 'theory' ? data.tests : data.experiments;
      setScoresDialog({
        open: true,
        data: scoresData[0] || {},
        type,
        testName: test.test_name
      });
    } catch (err: any) {
      setErrorDialog({
        open: true,
        title: '获取成绩失败',
        details: err.message || '发生未知错误',
        requestParams: { course_id: test.c_course_id, username, c_test_id: test.test_id }
      });
    } finally {
      setScoresLoadingMap(prev => ({ ...prev, [test.test_id]: false }));
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setCurrentTest(null);
    setSelectedScenarioName('');
  };

  const handleOpenResources = (test: Test) => {
    setSelectedExperiment(test);
    setResourceDialogOpen(true);
  };

  const handleShowMessage = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleLogout = () => {
    auth.logout();
    window.location.href = '/login';
  };

  const getTextColor = () => isDarkMode ? '#fff' : '#000';
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#fff';
  const getButtonColor = () => isDarkMode ? '#3f51b5' : '#2196f3';

  const filteredTheoretical = theoreticalTests.filter(test => 
    (test.test_name.toLowerCase().includes(searchText.toLowerCase()) ||
     test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
     (test.c_course_name || '').toLowerCase().includes(searchText.toLowerCase())) &&
    (!startDate || moment(test.test_start).isSameOrAfter(startDate, 'day')) &&
    (!endDate || moment(test.test_end).isSameOrBefore(endDate, 'day'))
  );

  const filteredPractical = practicalTests.filter(test => 
    ((test.test_name || '').toLowerCase().includes(searchText.toLowerCase()) ||
     (test.c_description || '').toLowerCase().includes(searchText.toLowerCase()) ||
     (test.c_course_name || '').toLowerCase().includes(searchText.toLowerCase())) &&
    (!startDate || moment(test.test_start).isSameOrAfter(startDate, 'day')) &&
    (!endDate || moment(test.test_end).isSameOrBefore(endDate, 'day'))
  );

  const renderDatePicker = (label: string, value: moment.Moment | null, onChange: (date: moment.Moment | null) => void) => (
    <LocalizationProvider dateAdapter={AdapterMoment}>
      <DatePicker
        label={label}
        value={value}
        onChange={onChange}
        renderInput={(params) => (
          <TextField 
            {...params} 
            size="small" 
            fullWidth 
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} 
            InputProps={{ ...params.InputProps, style: { color: getTextColor(), backgroundColor: isDarkMode ? '#252525' : '#fff' } }} 
            InputLabelProps={{ style: { color: getTextColor() } }} 
          />
        )}
      />
    </LocalizationProvider>
  );

const renderTestTable = (tests: Test[], isPracticalTestTable = false) => {
  // 计算当前页的数据
  const currentPage = activeTab === 'practical' ? pagePractical : pageTheoretical;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedTests = tests.slice(startIndex, endIndex);
    return (
    <Box>
      <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor(), boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: getTextColor() }}>测试名称</TableCell>
              {!isPracticalTestTable && (
                <TableCell sx={{ fontWeight: 600, color: getTextColor() }}>类型</TableCell>
              )}
              <TableCell sx={{ fontWeight: 600, color: getTextColor() }}>课程</TableCell>
              <TableCell sx={{ fontWeight: 600, color: getTextColor() }}>描述</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: getTextColor() }}>时间</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: getTextColor() }}>状态</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, color: getTextColor() }}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tests.map((test) => {
              const isTestValid = !!test.test_id?.trim();
              const isPaperValid = !!test.c_paper_id?.trim();
              const now = moment();
              const start = moment(test.test_start);
              const end = moment(test.test_end);
              const isExpired = now.isAfter(end);
              const isNotStarted = now.isBefore(start);
              const isInProgress = !isNotStarted && !isExpired; // 关键修改：定义进行中状态
              const isSubmitted = false; // 关键修改：不再依赖不存在的状态检查
              const status = isExpired ? { label: '已结束', color: 'error' } : 
                           isNotStarted ? { label: '未开始', color: 'warning' } : 
                           { label: '进行中', color: 'success' };
              const isScoresLoading = scoresLoadingMap[test.test_id] || false;

              return (
                <TableRow key={test.test_id} hover>
                  <TableCell sx={{ fontWeight: 500, color: getTextColor() }}>{test.test_name}</TableCell>
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
                        title={
                          !isTestValid ? "测试ID无效，无法进入" :
                          !isPaperValid && !isPracticalTestTable ? "试卷ID无效，无法进入" :
                          !isInProgress ? "测试未开始或已结束，无法进入" : // 关键修改
                          isSubmitted && !isPracticalTestTable ? "试卷已提交，无法再次进入" :
                          "进入测试"
                        }
                        placement="top"
                      >
                        <IconButton
                          size="small"
                        // 修改进入测试按钮的禁用逻辑
                            disabled={
                              !isTestValid || 
                              (!isPaperValid && !isPracticalTestTable) || 
                              !isInProgress || 
                              loading
                            }
                          onClick={() => handleEnterTest(test)}
                          sx={{
                            backgroundColor: (
                              !isTestValid || 
                              (!isPaperValid && !isPracticalTestTable) || 
                              !isInProgress || 
                              (isSubmitted && !isPracticalTestTable)
                            )
                              ? (isDarkMode ? '#555' : '#ccc')
                              : getButtonColor(),
                            color: '#fff',
                            '&:hover': {
                              backgroundColor: (
                                !isTestValid || 
                                (!isPaperValid && !isPracticalTestTable) || 
                                !isInProgress || 
                                (isSubmitted && !isPracticalTestTable)
                              )
                                ? (isDarkMode ? '#555' : '#ccc')
                                : (isDarkMode ? '#303f9f' : '#1565c0')
                            },
                            borderRadius: 1,
                            minWidth: 40
                          }}
                        >
                          {!isTestValid ? <ErrorIcon fontSize="small" /> :
                            (!isPaperValid && !isPracticalTestTable) ? <ErrorIcon fontSize="small" /> :
                            !isInProgress ? <ErrorIcon fontSize="small" /> : // 关键修改
                            (isSubmitted && !isPracticalTestTable) ? <ErrorIcon fontSize="small" /> :
                            loading ? <CircularProgress size={16} /> :
                            <MenuBookIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      {isPracticalTestTable && (
                        <Tooltip 
                          title={!isInProgress ? "测试未开始或已结束，无法查看资源" : "查看资源"} 
                          placement="top"
                        >
                          <IconButton
                            size="small"
                            onClick={() => handleOpenResources(test)}
                            disabled={!isTestValid || !isInProgress || loading} // 关键修改：只有进行中才能查看资源
                            sx={{
                              color: (!isTestValid || !isInProgress || loading) ? (isDarkMode ? '#666' : '#999') : getTextColor(),
                              '&:hover': {
                                backgroundColor: (!isTestValid || !isInProgress || loading) ? 'transparent' : (isDarkMode ? '#303f9f' : '#e3f2fd')
                              },
                              borderRadius: 1
                            }}
                          >
                            <FolderOpenIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    <Tooltip 
                      title="查看成绩" 
                      placement="top"
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleViewScores(test)}
                        disabled={!isTestValid || isScoresLoading} // 关键修改：移除 !isInProgress 条件
                        sx={{
                          color: (!isTestValid || isScoresLoading) ? (isDarkMode ? '#666' : '#999') : getTextColor(),
                          '&:hover': {
                            backgroundColor: (!isTestValid || isScoresLoading) ? 'transparent' : (isDarkMode ? '#303f9f' : '#e3f2fd')
                          },
                          borderRadius: 1
                        }}
                      >
                        {isScoresLoading ? <CircularProgress size={16} /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 30, 50]}
        component="div"
        count={tests.length}  // 这里传递总数据量
        rowsPerPage={rowsPerPage}
        page={currentPage - 1}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="每页行数:"
        labelDisplayedRows={({ from, to, count }) => 
          `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`
        }
        sx={{
          color: getTextColor(),
          '& .MuiTablePagination-selectIcon': {
            color: getTextColor()
          }
        }}
      />
    </Box>
  );
};

  if (currentView === 'scenario-management' && currentTest && username) {
    return (
      <ScenarioManagementPage
        testId={currentTest.test_id}
        username={username}
        onBack={handleBackToList}
        onViewInstances={(name: string) => {
          setSelectedScenarioName(name);
          setCurrentView('scenario-instances');
        }}
      />
    );
  }

  if (currentView === 'scenario-instances' && currentTest && username) {
    return (
      <ScenarioInstanceManagementPage
        testId={currentTest.test_id}
        username={username}
        scenarioName={selectedScenarioName}
        onBack={() => setCurrentView('scenario-management')}
      />
    );
  }

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

  const { isAuthenticated } = getAuthState();

  if (!isAuthenticated && auth.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress />
      <Typography sx={{ ml: 2 }}>检查认证状态...</Typography>
    </Box>
    );
  }

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
          用户测试
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
                  <Box>{renderTestTable(filteredPractical, true)}</Box>
                )}

            {activeTab === 'theoretical' && (
                  <Box>{renderTestTable(filteredTheoretical, false)}</Box>
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
          hideDeleteButton={true}
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
        open={confirmDialog.open}
        onClose={handleCancelEnterTest}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>确认进入测试</DialogTitle>
        <DialogContent>
          <DialogContentText component="div"> {/* 关键修改：改为 div */}
            {confirmDialog.test && confirmDialog.test.c_test_type === '实验' ? (
              <>
                <Typography 
                  component="span"
                  color="warning.main" 
                  sx={{ 
                    mb: 1, 
                    fontWeight: 'bold',
                    display: 'block' // 确保换行显示
                  }}
                >
                  请注意测试截至时间，超时提交不计成绩。
                </Typography>
                <Typography component="span" sx={{ display: 'block' }}>
                  您即将进入实验测试：<strong>{confirmDialog.test.test_name}</strong>
                </Typography>
                <Typography 
                  component="span"
                  variant="body2" 
                  sx={{ 
                    mt: 1, 
                    color: 'text.secondary',
                    display: 'block'
                  }}
                >
                  测试结束时间：{moment(confirmDialog.test.test_end).format('YYYY-MM-DD HH:mm')}
                </Typography>
              </>
            ) : (
              <Typography component="span" sx={{ display: 'block' }}>
                您即将进入测试：<strong>{confirmDialog.test?.test_name}</strong>
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEnterTest}>取消</Button>
          <Button onClick={handleConfirmEnterTest} variant="contained" autoFocus>
            确认进入
          </Button>
        </DialogActions>
      </Dialog>


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
          <DialogContentText component="div">
            {errorDialog.details.split('\n').map((line, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>{line}</div>
            ))}
          </DialogContentText>

          {errorDialog.requestParams && (
            <Box sx={{ mt: 2, p: 2, bgColor: '#f5f5f5', borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>请求参数:</Typography>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                {JSON.stringify(errorDialog.requestParams, null, 2)}
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

      <Dialog
        open={scoresDialog.open}
        onClose={() => setScoresDialog(prev => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          {scoresDialog.testName} - {scoresDialog.type === 'theory' ? '理论测试成绩' : '实验Flag提交历史'}
        </DialogTitle>
        <DialogContent>
          {Object.values(scoresLoadingMap).some(v => v) ? (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {scoresDialog.type === 'theory' && scoresDialog.data?.scores?.length > 0 ? (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>用户名</TableCell>
                        <TableCell>试卷名称</TableCell>
                        <TableCell>开始时间</TableCell>
                        <TableCell>提交时间</TableCell>
                        <TableCell>总分</TableCell>
                        <TableCell>客观分</TableCell>
                        <TableCell>主观分</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scoresDialog.data.scores.flatMap((score: any) =>
                        score.papers.map((paper: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{score.username}</TableCell>
                            <TableCell>{paper.paper_name}</TableCell>
                            <TableCell>{paper.start_time || '无'}</TableCell>
                            <TableCell>{paper.submit_time || '无'}</TableCell>
                            <TableCell>{paper.total_score}</TableCell>
                            <TableCell>{paper.objective_score}</TableCell>
                            <TableCell>{paper.subjective_score}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : scoresDialog.type === 'theory' ? (
                <Typography>暂无理论测试成绩</Typography>
              ) : null}

              {scoresDialog.type === 'experiment' && scoresDialog.data?.history?.length > 0 ? (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>用户名</TableCell>
                        <TableCell>提交时间</TableCell>
                        <TableCell>是否正确</TableCell>
                        <TableCell>尝试次数</TableCell>
                        <TableCell>获得积分</TableCell>
                        <TableCell>靶机IP</TableCell>
                        <TableCell>靶机名称</TableCell>
                        <TableCell>靶机类型</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scoresDialog.data.history.flatMap((hist: any) =>
                        hist.history.map((record: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{hist.username}</TableCell>
                            <TableCell>{record.c_submitted_at || '无'}</TableCell>
                            <TableCell>{record.c_is_correct ? '是' : '否'}</TableCell>
                            <TableCell>{record.c_attempt_count}</TableCell>
                            <TableCell>{record.c_points_earned}</TableCell>
                            <TableCell>{record.instance_ip}</TableCell>
                            <TableCell>{record.instance_name}</TableCell>
                            <TableCell>{record.instance_type}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : scoresDialog.type === 'experiment' ? (
                <Typography>暂无实验成绩</Typography>
              ) : null}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScoresDialog(prev => ({ ...prev, open: false }))}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TestManagement_user;