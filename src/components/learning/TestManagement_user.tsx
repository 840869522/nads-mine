import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  Pagination, Grid, Tooltip, Button,
  Tabs, Tab, CircularProgress, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  Search as SearchIcon,
  Code as CodeIcon, 
  MenuBook as MenuBookIcon,
  Logout as LogoutIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import moment from 'moment';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';
import TheoreticalTestPage from './TheoreticalTestPage';
import PracticalTestPage from './PracticalTestPage';

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
  c_paper_id: string; // 明确使用c_paper_id作为试卷ID字段
}

// 配置axios实例
const apiClient = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

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
  // 获取用户相关测试
  getUserTheoryTests: async (username: string) => {
    if (!username) {
      throw new Error('获取测试列表失败：用户名为空');
    }
    const response = await apiClient.get(`/back/api/study/test/getUserRelatedTests`, {
      params: { username }
    });
    return response.data;
  },

  // 获取试卷详情 - 严格匹配后端参数要求
  getExamPaperDetails: async (testId: string, username: string, testType: string) => {
    if (!testId || !username) {
      throw new Error('获取试卷详情失败：test_id或username为空');
    }
    const response = await apiClient.post(
      `/back/api/study/test/get_exam_paper_details`,
      { 
        test_id: testId,  // 必传：测试ID
        username: username, // 必传：用户名
        test_type: testType // 必传：考试/练习
      }
    );
    return response.data;
  },

  // 提交试卷
  submitPaper: async (params: any) => {
    // 确保提交参数包含必要字段
    if (!params.test_id || !params.username || !params.c_paper_id) {
      throw new Error('提交试卷失败：缺少test_id、username或c_paper_id');
    }
    const response = await apiClient.post(
      `/back/api/study/test/submit_papers`,
      params
    );
    return response.data;
  },

  // 获取测试用户关联信息
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
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [pagePractical, setPagePractical] = useState<number>(1);
  const [pageTheoretical, setPageTheoretical] = useState<number>(1);
  const [rowsPerPage] = useState<number>(5);
  const [currentView, setCurrentView] = useState<'list' | 'practical' | 'theoretical'>('list');
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
      console.log('获取测试列表，用户名:', username);

      const testsData = await theoryTestApi.getUserTheoryTests(username);

      if (testsData.code === 200) {
        console.log('后端返回的原始测试数据:', testsData.data);

        // 过滤并格式化测试数据，确保test_id和c_paper_id有效
        const formattedTests = (testsData.data || []).reduce((acc: Test[], test: any) => {
          if (!test.c_id || !test.c_id.trim()) {
            console.error('过滤无效测试数据（缺少c_id）:', test);
            return acc;
          }

          // 提取后端返回的c_paper_id（用户专属试卷ID）
          const userPaperId = test.test_users_id || test.c_paper_id || test.paper_id || '';
          const testType = test.c_test_type === '实验' ? '实验' : '理论测试';

          acc.push({
            test_id: test.c_id.trim(),
            c_name: test.c_name || '未知测试',
            test_name: test.test_name || test.c_name || '未命名测试',
            c_test_type: testType,
            c_type: test.c_type === '考试' ? '考试' : '练习',
            c_description: test.c_description || '',
            test_start: test.test_start || test.c_start || moment().format('YYYY-MM-DD HH:mm'),
            test_end: test.test_end || test.c_end || moment().add(1, 'hour').format('YYYY-MM-DD HH:mm'),
            c_course_id: test.c_course_id,
            c_course_name: test.c_course_name || '未知课程',
            test_users_id: test.test_users_id || `${test.c_id}_${username}`,
            duration: test.duration ? Number(test.duration) : undefined,
            // 明确使用c_paper_id字段存储试卷ID
            c_paper_id: userPaperId.trim()
          });
          return acc;
        }, []);

        setTests(formattedTests);
        showSnackbar(`测试列表加载成功（共${formattedTests.length}个测试）`, 'success');
      } else {
        const errorMsg = testsData.message || '获取测试列表失败';
        setError(errorMsg);
        showSnackbar(errorMsg, 'error');

        if (errorMsg.includes('登录')) {
          handleLogout();
        }
      }
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

  // 渲染日期选择器（支持手动输入和日历选择）
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
          // 支持多种日期格式解析
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
              inputProps: { type: 'text' } // 禁用浏览器默认日期控件
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

  // 测试筛选（包含日期筛选）
  const filteredTests = tests.filter((test) => {
    const matchesSearch = searchText.trim() === ''
      ? true
      : test.test_name.toLowerCase().includes(searchText.toLowerCase()) ||
        test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
        (test.c_course_id && test.c_course_id.toLowerCase().includes(searchText.toLowerCase())) ||
        (test.c_course_name && test.c_course_name.toLowerCase().includes(searchText.toLowerCase()));

    // 日期筛选逻辑：只对比日期部分，忽略时间
    const matchesStartDate = !startDate
      ? true
      : (test.test_start && moment(test.test_start).isSameOrAfter(moment(startDate).startOf('day')));

    const matchesEndDate = !endDate
      ? true
      : (test.test_end && moment(test.test_end).isSameOrBefore(moment(endDate).endOf('day')));

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // 测试分类与分页
  const practicalTests = filteredTests.filter(t => t.c_test_type === '实验');
  const theoreticalTests = filteredTests.filter(t => t.c_test_type === '理论测试');
  const practicalPageCount = Math.ceil(practicalTests.length / rowsPerPage);
  const theoreticalPageCount = Math.ceil(theoreticalTests.length / rowsPerPage);
  const paginatedPractical = practicalTests.slice(
    (pagePractical - 1) * rowsPerPage,
    pagePractical * rowsPerPage
  );
  const paginatedTheoretical = theoreticalTests.slice(
    (pageTheoretical - 1) * rowsPerPage,
    pageTheoretical * rowsPerPage
  );

  // 进入测试 - 核心修复：确保c_paper_id正确传递和验证
  const handleEnterTest = async (test: Test) => {
    try {
      // 1. 首要验证test_id和c_paper_id
      if (!test.test_id || !test.test_id.trim()) {
        const errorMsg = '测试ID无效或为空，无法进入测试';
        showErrorDialog('测试ID无效', errorMsg, { testId: test.test_id, test });
        return;
      }
      if (!test.c_paper_id || !test.c_paper_id.trim()) {
        const errorMsg = '当前测试未分配试卷，无法进入理论测试';
        showErrorDialog('试卷ID缺失', errorMsg, { c_paper_id: test.c_paper_id, testId: test.test_id });
        return;
      }

      // 2. 验证用户名
      if (!username || !username.trim()) {
        const errorMsg = '用户信息无效，无法进入测试';
        showErrorDialog('用户信息无效', errorMsg, { username, testId: test.test_id });
        return;
      }

      setLoading(true);
      console.log(`准备进入测试: ${test.test_name}, test_id: ${test.test_id}, 用户名: ${username}, 试卷ID: ${test.c_paper_id}`);

      // 3. 构建请求参数
      const requestParams = {
        test_id: test.test_id.trim(),
        username: username.trim(),
        test_name: test.test_name,
        test_type: test.c_test_type
      };

      // 4. 获取测试关联信息
      const relationResponse = await theoryTestApi.getTestUserRelation(
        requestParams.test_id,
        requestParams.username
      );

      // 5. 处理接口响应
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

      // 6. 验证响应数据完整性
      if (!relationResponse.data) {
        throw new Error('服务器返回数据为空');
      }

      // 7. 理论测试需要验证试卷ID
      if (test.c_test_type === '理论测试' && (!relationResponse.data.paper_id || !relationResponse.data.paper_id.trim())) {
        throw new Error('未找到有效的试卷信息，无法进入理论测试');
      }

      // 8. 构建完整的测试信息对象，确保c_paper_id正确
      const updatedTest: Test = {
        ...test,
        c_test_type: relationResponse.data.c_test_type || test.c_test_type,
        c_start: relationResponse.data.c_start || test.test_start,
        c_end: relationResponse.data.c_end || test.test_end,
        duration: relationResponse.data.c_duration || test.duration,
        // 确保c_paper_id字段正确赋值
        c_paper_id: relationResponse.data.paper_id || test.c_paper_id,
        test_id: relationResponse.data.test_id || test.test_id,
      };

      // 验证updatedTest中的试卷ID
      if (!updatedTest.c_paper_id || !updatedTest.c_paper_id.trim()) {
        throw new Error("后端未返回有效的试卷ID，无法进入测试");
      }

      // 9. 切换到对应测试页面
      setCurrentTest(updatedTest);
      setCurrentView(updatedTest.c_test_type === '实验' ? 'practical' : 'theoretical');

    } catch (err: any) {
      console.error('进入测试失败:', err);
      showSnackbar(err.message || '进入测试失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 返回测试列表
  const handleBackToList = () => {
    setCurrentView('list');
    setCurrentTest(null);
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

    return (
      <Box>
        <TableContainer sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: isDarkMode ? '#333' : '#e8e8e8' }}>
                <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>测试名称</TableCell>
                <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>类型</TableCell>
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
                    <TableCell>
                      <Chip
                        label={test.c_type}
                        size="small"
                        color={test.c_type === '考试' ? 'primary' : 'secondary'}
                        sx={{ borderRadius: 1, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: getTextColor() }}>
                      {test.c_course_name || test.c_course_id || '无'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, color: getTextColor() }}>{test.c_description}</TableCell>
                    <TableCell sx={{ color: getTextColor() }}>
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
                      <Tooltip
                        title={!isTestValid ? "测试ID无效，无法进入" :
                          !isPaperValid ? "试卷ID无效，无法进入" :
                            isExpired ? "测试已结束，无法进入" : "进入测试"}
                        placement="top"
                      >
                        <Button
                          variant="contained"
                          size="small"
                          disabled={!isTestValid || !isPaperValid || isExpired || loading}
                          onClick={() => handleEnterTest(test)}
                          sx={{
                            backgroundColor: (!isTestValid || !isPaperValid || isExpired)
                              ? (isDarkMode ? '#555' : '#ccc')
                              : getButtonColor(),
                            color: (!isTestValid || !isPaperValid || isExpired)
                              ? (isDarkMode ? '#888' : '#666')
                              : '#fff',
                            '&:hover': {
                              backgroundColor: (!isTestValid || !isPaperValid || isExpired)
                                ? (isDarkMode ? '#555' : '#ccc')
                                : (isDarkMode ? '#303f9f' : '#1565c0')
                            },
                            borderRadius: 1,
                            px: 1.5,
                            py: 0.5,
                            minWidth: 90
                          }}
                        >
                          {!isTestValid ? '无效测试' :
                            !isPaperValid ? '无试卷' :
                              loading ? '加载中...' :
                                isExpired ? '已过期' : '进入测试'}
                        </Button>
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

  // 视图渲染 - 实验页
  if (currentView === 'practical' && currentTest && username) {
    return <PracticalTestPage
      testId={currentTest.test_id}
      onBack={handleBackToList}
      username={username}
    />;
  }

  // 视图渲染 - 理论测试页 - 确保c_paper_id正确传递
  if (currentView === 'theoretical' && currentTest && username) {
    return <TheoreticalTestPage
      test={currentTest}
      onBack={handleBackToList}
      theoryTestApi={{
        // 明确传递test_id、username和c_paper_id参数
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
    />;
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

      {/* 搜索和筛选区域 */}
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

      {/* 标签页 */}
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

      {/* 渲染对应标签页的测试列表 */}
      {activeTab === 'practical' && (
        <Box>{renderTestTable(paginatedPractical, pagePractical, setPagePractical, practicalPageCount)}</Box>
      )}

      {activeTab === 'theoretical' && (
        <Box>{renderTestTable(paginatedTheoretical, pageTheoretical, setPageTheoretical, theoreticalPageCount)}</Box>
      )}

      {/* 提示框 */}
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

      {/* 详细错误对话框，显示请求参数 */}
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
