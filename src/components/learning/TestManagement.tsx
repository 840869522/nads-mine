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
  Warning as WarningIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import TestFormDialog from './TestFormDialog';
import TestUserDrawer from './TestUserDrawer';
import { apiClientWithToken } from "@/utils/axios";

// 应用中文本地化
moment.locale('zh-cn');

// 定义接口类型（与后端字段严格匹配）
interface TestData {
  c_id?: string;
  c_name: string;
  c_description: string;
  c_type: string; // 后端存储为"理论测试"或"实践操作"
  c_test_type: string; // 后端存储为"考试"或"练习"
  c_paper_count: number;
  c_course_id: string;
  c_start: string; // 格式：YYYY-MM-DD H:i:s
  c_end: string; // 格式：YYYY-MM-DD H:i:s
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

// 定义标签页类型
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
  
  // 新增：删除相关状态
  const [deletingKey, setDeletingKey] = useState<string | null>(null); // 正在删除的用户标识（避免重复点击）
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false); // 删除确认弹窗
  const [userToDelete, setUserToDelete] = useState<TestUser | null>(null); // 待删除的用户信息

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
        const responseData = response.data.data || [];
        const rawTests = responseData.data || [];
        const filteredTests = rawTests.map((item: any) => ({
          c_id: item.c_id,
          c_name: item.c_name,
          c_description: item.c_description,
          c_type: item.c_type,
          c_test_type: item.c_test_type,
          c_course_id: item.c_course_id,
          c_start: item.c_start,
          c_end: item.c_end
        }));
        
        setTests(filteredTests);
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
        const formattedUsers = response.data.data.map((user: any) => {
          const userInfo = allUsers.find(u => u.username === user.username);
          
          return {
            id: `${user.test_id}-${user.username}`,
            username: user.username,
            name: user.name || userInfo?.name || user.username,
            c_test_id: user.test_id,
            c_paper_id: user.paper_id,
            c_answers: user.answers,
            start_time: user.start_time,
            end_time: user.end_time,
            submit_time: user.submit_time,
            score: user.score,
            correct_status: user.correct_status,
            correct_status_text: user.correct_status_text
          };
        });
        
        return formattedUsers;
      } else {
        showSnackbar('获取用户数据失败: ' + response.data.message, 'error');
        return [];
      }
    } catch (error: any) {
      console.error('获取用户数据失败:', error);
      const errorMsg = error.response?.data?.message || 
                      error.message || 
                      '网络请求失败，请稍后重试';
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
        showSnackbar(`成功添加 ${response.data.data.count} 个用户`);
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

  // 新增：单个删除测试用户（对接后端destroy接口）
  const deleteTestUser = async () => {
    if (!userToDelete || !currentTest?.c_id) return false;
    
    try {
      // 生成唯一删除标识（避免重复点击）
      const deleteKey = `${userToDelete.c_test_id}-${userToDelete.username}-${userToDelete.c_paper_id}`;
      setDeletingKey(deleteKey);
      
      // 调用后端删除接口
      const response = await apiClientWithToken.post<ApiResponse>(
        '/back/api/study/test/destroy', // 与后端路由一致
        {
          c_test_id: userToDelete.c_test_id,
          c_username: userToDelete.username,
          c_paper_id: userToDelete.c_paper_id
        }
      );
      
      if (response.data.code === 200) {
        showSnackbar('用户删除成功');
        // 重新获取用户列表，同步更新界面
        const updatedUsers = await fetchTestUsers(currentTest.c_id);
        setTestUsers(updatedUsers);
        setDeleteConfirmOpen(false);
        setUserToDelete(null);
        return true;
      } else {
        // 处理后端返回的业务错误（如已交卷不允许删除）
        showSnackbar(`删除失败: ${response.data.message}`, 'error');
        return false;
      }
    } catch (error: any) {
      console.error('删除测试用户失败:', error);
      const errorMsg = error.response?.data?.message || 
                      error.message || 
                      '网络请求失败，请稍后重试';
      showSnackbar(`删除用户失败: ${errorMsg}`, 'error');
      return false;
    } finally {
      setDeletingKey(null); // 重置删除状态
    }
  };

  // 添加测试
  const handleAddTest = async (testData: TestData) => {
    try {
      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_add', testData);
      
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

  // 更新测试
  const handleUpdateTest = async (testData: TestData & { id: string }) => {
    try {
      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_update', testData);
      
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
      showSnackbar('测试更新失败: ' + (error.response?.data?.message || error.message), 'error');
      return false;
    }
  };

  // 删除测试
  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('确定要删除这个测试吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_del', { id: testId });
      
      if (response.data.code === 200) {
        showSnackbar('测试删除成功');
        fetchTests();
      } else {
        showSnackbar('测试删除失败: ' + response.data.message, 'error');
      }
    } catch (error: any) {
      console.error('删除测试失败:', error);
      showSnackbar('测试删除失败: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  // 获取测试详情
  const fetchTestInfo = async (testId: string) => {
    try {
      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_info', {
        id: testId
      });
      
      if (response.data.code === 200) {
        return response.data.data;
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

  // 打开添加测试对话框
  const handleAddTestClick = () => {
    setCurrentTest(null);
    setIsDialogOpen(true);
  };

  // 打开编辑测试对话框
  const handleEditTest = async (test: TestData) => {
    setLoading(true);
    const testInfo = await fetchTestInfo(test.c_id || '');
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

  // 保存测试
  const handleSaveTest = async (testData: TestData) => {
    const isSuccess = currentTest 
      ? await handleUpdateTest({ ...testData, id: currentTest.c_id || '' })
      : await handleAddTest(testData);
    
    if (isSuccess) {
      setIsDialogOpen(false);
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

  // 新增：打开删除确认弹窗
  const handleOpenDeleteConfirm = (user: TestUser, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡（避免触发用户详情）
    // 提前判断是否已交卷（前端预校验，减少后端请求）
    if (user.submit_time || user.correct_status === 2) {
      showSnackbar('已交卷/已批改的用户不允许删除', 'warning');
      return;
    }
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  // 新增：关闭删除确认弹窗
  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
  };

  // 获取测试状态
  const getTestStatus = (test: TestData) => {
    const now = moment();
    const start = moment(test.c_start);
    const end = moment(test.c_end);
    
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
    
    const matchesStartDate = !startDate || moment(test.c_start).isSameOrAfter(startDate, 'day');
    const matchesEndDate = !endDate || moment(test.c_end).isSameOrBefore(endDate, 'day');
    
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
                <TableCell sx={{ fontWeight: 600 }}>类型</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>描述</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>课程ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>时间范围</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>状态</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tests.map((test) => {
                const status = getTestStatus(test);
                
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
                        <div>开始: {moment(test.c_start).format('YYYY-MM-DD')}</div>
                        <div>结束: {moment(test.c_end).format('YYYY-MM-DD')}</div>
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
                    <TableCell align="center" sx={{ width: 180 }}>
                      <Tooltip title="编辑测试">
                        <IconButton onClick={() => handleEditTest(test)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="管理用户">
                        <IconButton onClick={() => handleManageUsers(test)} color="secondary">
                          {loadingUsers && currentTest?.c_id === test.c_id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PeopleIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除测试">
                        <IconButton onClick={() => handleDeleteTest(test.c_id || '')} color="error">
                          <DeleteIcon fontSize="small" />
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

  return (
    <Paper sx={{ p: 3, borderRadius: 4, position: 'relative' }}>
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
            sx={{ width: { xs: '100%', md: '100%' }, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
      
      {/* 标签页切换组件 */}
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
      <TestFormDialog
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
        onDeleteUser={handleOpenDeleteConfirm} // 传递删除触发函数
        deletingKey={deletingKey} // 传递删除加载状态
      />

      {/* 删除确认弹窗 */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          style: { borderRadius: 8 }
        }}
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
            onClick={handleCloseDeleteConfirm}
            variant="outlined"
            sx={{ mr: 1 }}
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
    