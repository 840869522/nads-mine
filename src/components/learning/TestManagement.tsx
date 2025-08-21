import React, { useState, useEffect } from 'react';
import { 
  Box, Button, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  IconButton, Tooltip, Pagination, Grid,
  Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert,
  CircularProgress, Tabs, Tab
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  People as PeopleIcon,
  Code as CodeIcon,
  MenuBook as MenuBookIcon,
  ExpandMore as ExpandMoreIcon
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
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  c_test_id: string;
  c_paper_id: string;
  c_answers: string;
  c_start: Date;
  c_end: Date;
  c_submit: Date | null;
  c_score: number;
  c_correct: number;
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
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [totalCount, setTotalCount] = useState<number>(0);
  // 新增：当前激活的标签页（默认显示实践操作）
  const [activeTab, setActiveTab] = useState<TestTab>('practice');

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
    // 切换时重置对应标签页的页码
    if (newValue === 'practice') {
      setPagePractice(1);
    } else {
      setPageTheory(1);
    }
  };

  // 获取测试列表（带字段过滤，只保留表格所需字段）
  const fetchTests = async (page: number = 1, pageSize: number = 10) => {
    try {
      setLoading(true);
      // 发送GET请求获取测试列表
      const response = await apiClientWithToken.get<ApiResponse>('/back/api/study/test/test_list', {
        params: { page, pageSize }
      });
      if (response.data.code === 200) {
        const responseData = response.data.data || [];
        const rawTests = responseData.data || [];
        // 过滤无用字段，只保留表格需要展示的字段
        const filteredTests = rawTests.map((item: any) => ({
          c_id: item.c_id,                  // 测试ID（用于编辑/删除等操作）
          c_name: item.c_name,              // 测试名称（表格展示）
          c_description: item.c_description, // 测试描述（表格展示）
          c_type: item.c_type,              // 测试类型（实践/理论，用于分类展示）
          c_test_type: item.c_test_type,    // 测试子类型（考试/练习，表格展示）
          c_course_id: item.c_course_id,    // 课程ID（表格展示）
          c_start: item.c_start,            // 开始时间（表格展示）
          c_end: item.c_end                 // 结束时间（表格展示）
        }));
        
        // 更新状态，存储过滤后的数据
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
    

  // 添加测试
  const handleAddTest = async (testData: TestData) => {
    try {
      const response = await apiClientWithToken.post<ApiResponse>('/back/api/study/test/test_add', testData);
      
      if (response.data.code === 200) {
        showSnackbar('测试添加成功');
        fetchTests(); // 刷新列表
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
        fetchTests(); // 刷新列表
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
        fetchTests(); // 刷新列表
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
    console.log('组件初始化，调用fetchTests');
    fetchTests();
  }, []);

  // 搜索处理
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    // 搜索时重置两个标签页的页码
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
    setCurrentTest(test);
    setLoading(true);
    
    try {
      // 模拟数据（实际项目替换为真实API）
      const mockUsers: TestUser[] = Array.from({ length: 10 }, (_, i) => ({
        id: `user-${i + 1}`,
        username: `user${i + 1}`,
        name: `用户 ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: i % 3 === 0 ? '学生' : i % 3 === 1 ? '教师' : '管理员',
        c_test_id: test.c_id || '',
        c_paper_id: `paper-${Math.floor(Math.random() * 100)}`,
        c_answers: JSON.stringify(Array.from({ length: 10 }, () => Math.random() > 0.3 ? 'A' : '*')),
        c_start: moment().subtract(Math.random() * 30, 'days').toDate(),
        c_end: moment().add(Math.random() * 30, 'days').toDate(),
        c_submit: Math.random() > 0.3 ? moment().subtract(Math.random() * 20, 'days').toDate() : null,
        c_score: Math.floor(Math.random() * 100),
        c_correct: Math.random() > 0.5 ? 2 : 1,
      }));
      
      setTestUsers(mockUsers);
      setIsDrawerOpen(true);
    } catch (error) {
      console.error("获取用户数据失败:", error);
      showSnackbar('获取用户数据失败', 'error');
    } finally {
      setLoading(false);
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

  // 保存测试用户
  const handleSaveTestUsers = (updatedUsers: TestUser[]) => {
    setTestUsers(updatedUsers);
    showSnackbar('用户信息已更新');
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

  // 过滤测试（支持搜索和日期筛选）
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

  // 实践操作测试分页
  const pagePracticeCount = Math.ceil(practiceTests.length / rowsPerPage);
  const paginatedPracticeTests = practiceTests.slice(
    (pagePractice - 1) * rowsPerPage, 
    pagePractice * rowsPerPage
  );

  // 理论测试分页
  const pageTheoryCount = Math.ceil(theoryTests.length / rowsPerPage);
  const paginatedTheoryTests = theoryTests.slice(
    (pageTheory - 1) * rowsPerPage, 
    pageTheory * rowsPerPage
  );

  // 渲染测试表格（移除Accordion，直接展示表格）
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
                        label={test.c_test_type} 
                        size="small" 
                        color={test.c_test_type === '考试' ? 'primary' : 'secondary'}
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
                          <PeopleIcon fontSize="small" />
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
      
      {/* 新增：标签页切换组件 */}
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
      
      {/* 根据激活的标签页显示对应内容 */}
      {activeTab === 'practice' && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
          </Typography>
          {renderTestTable(paginatedPracticeTests, pagePractice, setPagePractice, pagePracticeCount)}
        </Box>
      )}
      
      {activeTab === 'theory' && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
          </Typography>
          {renderTestTable(paginatedTheoryTests, pageTheory, setPageTheory, pageTheoryCount)}
        </Box>
      )}
      
      <TestFormDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveTest}
        test={currentTest}
      />
      
      <TestUserDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        test={currentTest}
        testUsers={testUsers}
        allUsers={allUsers}
        onSave={handleSaveTestUsers}
      />

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