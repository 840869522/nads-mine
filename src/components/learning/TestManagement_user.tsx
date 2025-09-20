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

  checkSubmissionStatus: async (testId: string, username: string) => {
    if (!testId || !username) {
      throw new Error('检查提交状态失败：test_id或username为空');
    }
    const response = await apiClient.post(
      `/back/api/study/test/checkSubmissionStatus`,
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

  // 当日期筛选条件变化时重置分页
  useEffect(() => {
    if (activeTab === 'practical') {
      setPagePractical(1);
    } else {
      setPageTheoretical(1);
    }
  }, [startDate, endDate, activeTab]);

  // 加载测试列表并检查考试提交状态
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
            test_id: test.c_id.trim().replace(/[{}]/g, ''), // 清理花括号
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
            console.error('过滤无效实验测试数据（缺少c_id）:', test);
            return acc;
          }

          const userPaperId = test.c_paper_id || test.paper_id || '';
          console.log('实验测试数据 - c_id:', test.c_id, 'c_paper_id:', test.c_paper_id);

          acc.push({
            test_id: test.c_id.trim().replace(/[{}]/g, ''), // 清理花括号
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

      // 检查考试的提交状态
      const examTests = [...formattedTheoreticalTests, ...formattedPracticalTests].filter(test => test.c_type === '考试');
      const statusPromises = examTests.map(test =>
        theoryTestApi.checkSubmissionStatus(test.test_id, username)
          .then(response => {
            if (response.code === 200) {
              return { testId: test.test_id, hasSubmitted: response.data.hasSubmitted };
            }
            console.warn(`检查提交状态失败（test_id: ${test.test_id}）: ${response.message}`);
            return { testId: test.test_id, hasSubmitted: false };
          })
          .catch(err => {
            console.error(`检查提交状态错误（test_id: ${test.test_id}）:`, err);
            return { testId: test.test_id, hasSubmitted: false };
          })
      );

      const statuses = await Promise.all(statusPromises);
      const statusMap = statuses.reduce((acc, { testId, hasSubmitted }) => {
        acc[testId] = hasSubmitted;
        return acc;
      }, {} as Record<string, boolean>);
      setSubmissionStatus(statusMap);

    } catch (err: any) {
      console.error('加载测试列表失败:', err);
      setError(err.message || '加载测试列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterTest = async (test: Test) => {
    try {
      setLoading(true);
      // 检查考试提交状态（适用于理论和实验）
      if (test.c_type === '考试') {
        const response = await theoryTestApi.checkSubmissionStatus(test.test_id, username);
        if (response.code === 200 && response.data.hasSubmitted) {
          setErrorDialog({
            open: true,
            title: '无法进入测试',
            details: '试卷已提交，无法再次进入考试。',
            requestParams: null
          });
          return;
        }
      }

      if (test.c_test_type === '理论测试') {
        // 理论测试保持不变
        setCurrentTest(test);
        setCurrentView('theoretical');
      } else {
        // 实验测试：进入场景管理
        setCurrentTest(test);
        setCurrentView('scenario-management');
      }
    } catch (err: any) {
      console.error('进入测试失败:', err);
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

  const theoreticalPageCount = Math.ceil(filteredTheoretical.length / rowsPerPage);
  const practicalPageCount = Math.ceil(filteredPractical.length / rowsPerPage);

  const paginatedTheoretical = filteredTheoretical.slice((pageTheoretical - 1) * rowsPerPage, pageTheoretical * rowsPerPage);
  const paginatedPractical = filteredPractical.slice((pagePractical - 1) * rowsPerPage, pagePractical * rowsPerPage);

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

  const renderTestTable = (tests: Test[], page: number, setPage: (page: number) => void, pageCount: number, isPracticalTestTable = false) => {
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
                const isSubmitted = test.c_type === '考试' && submissionStatus[test.test_id];
                const status = isExpired ? { label: '已结束', color: 'error' } : now.isBefore(start) ? { label: '未开始', color: 'warning' } : { label: '进行中', color: 'success' };

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
                            isExpired ? "测试已结束，无法进入" :
                            isSubmitted ? "试卷已提交，无法再次进入" :
                            "进入测试"
                          }
                          placement="top"
                        >
                          <IconButton
                            size="small"
                            disabled={!isTestValid || (!isPaperValid && !isPracticalTestTable) || isExpired || isSubmitted || loading}
                            onClick={() => handleEnterTest(test)}
                            sx={{
                              backgroundColor: (!isTestValid || (!isPaperValid && !isPracticalTestTable) || isExpired || isSubmitted)
                                ? (isDarkMode ? '#555' : '#ccc')
                                : getButtonColor(),
                              color: '#fff',
                              '&:hover': {
                                backgroundColor: (!isTestValid || (!isPaperValid && !isPracticalTestTable) || isExpired || isSubmitted)
                                  ? (isDarkMode ? '#555' : '#ccc')
                                  : (isDarkMode ? '#303f9f' : '#1565c0')
                              },
                              borderRadius: 1,
                              minWidth: 40
                            }}
                          >
                            {!isTestValid ? <ErrorIcon fontSize="small" /> :
                              (!isPaperValid && !isPracticalTestTable) ? <ErrorIcon fontSize="small" /> :
                              isExpired ? <ErrorIcon fontSize="small" /> :
                              isSubmitted ? <ErrorIcon fontSize="small" /> :
                              loading ? <CircularProgress size={16} /> :
                              <MenuBookIcon fontSize="small" />}
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

  // 视图渲染 - 场景管理页
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

  // 视图渲染 - 场景实例管理页
  if (currentView === 'scenario-instances' && username) {
    return (
      <ScenarioInstanceManagementPage
        username={username}
        scenarioName={selectedScenarioName}
        onBack={() => setCurrentView('scenario-management')}
      />
    );
  }

  // 视图渲染 - 理论测试页（保持不变）
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
        <Box>{renderTestTable(paginatedPractical, pagePractical, setPagePractical, practicalPageCount, true)}</Box>
      )}

      {activeTab === 'theoretical' && (
        <Box>{renderTestTable(paginatedTheoretical, pageTheoretical, setPageTheoretical, theoreticalPageCount, false)}</Box>
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
    </Paper>
  );
};

export default TestManagement_user;