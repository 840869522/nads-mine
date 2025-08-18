import React, { useState, useEffect } from 'react';
import { 
  Box, Button, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  IconButton, LinearProgress, Pagination, Grid, Tooltip,
  Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  People as PeopleIcon,
  Code as CodeIcon, // 实践操作图标
  MenuBook as MenuBookIcon, // 理论测试图标
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import TestFormDialog from './TestFormDialog';
import TestUserDrawer from './TestUserDrawer';
import '@/node_modules/moment/locale/zh-cn';
import { useTheme } from '@mui/material/styles';

// 应用中文本地化
moment.locale('zh-cn');

const TestManagement = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  const [pagePractice, setPagePractice] = useState(1);
  const [pageTheory, setPageTheory] = useState(1);
  const [rowsPerPage] = useState(5); // 调整为5条每页，与用户端保持一致
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentTest, setCurrentTest] = useState(null);
  const [testUsers, setTestUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // 动态颜色函数 - 与用户端保持一致
  const getBgColor = () => isDarkMode ? '#121212' : '#f5f7fa';
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTableRowBgColor = (index: number) => 
    isDarkMode 
      ? (index % 2 === 0 ? '#252525' : '#1e1e1e') 
      : (index % 2 === 0 ? '#fafafa' : '#ffffff');
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#333';
  const getHeaderTextColor = () => isDarkMode ? '#fff' : '#000';
  const getSecondaryTextColor = () => isDarkMode ? '#bbb' : '#666';
  const getButtonColor = () => isDarkMode ? '#3f51b5' : '#1976d2';
  const getAccordionBgColor = () => isDarkMode ? '#2a2a2a' : '#f5f5f5';

  // 模拟API数据
  useEffect(() => {
    setLoading(true);
    
    // 模拟获取测试数据
    setTimeout(() => {
      const mockData = Array.from({ length: 50 }, (_, i) => {
        const isPractice = i % 3 === 0; // 每三个测试中有一个是实践操作
        return {
          c_id: `test-${i + 1}`,
          c_name: `${isPractice ? '实践操作' : '理论测试'} ${i + 1}`,
          c_description: `这是${isPractice ? '实践操作' : '理论测试'} ${i + 1} 的描述信息`,
          c_paper_count: Math.floor(Math.random() * 5) + 1,
          c_start: moment().subtract(Math.random() * 30, 'days').toDate(),
          c_end: moment().add(Math.random() * 30, 'days').toDate(),
          c_create_at: moment().subtract(Math.random() * 100, 'days').toDate(),
          c_course_id: `C${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
          c_type: isPractice ? 'practice' : 'theory' // 添加类型字段
        };
      });
      
      setTests(mockData);
      
      // 模拟获取所有用户数据
      const mockUsers = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i + 1}`,
        username: `user${i + 1}`,
        name: `用户 ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: i % 3 === 0 ? '学生' : i % 3 === 1 ? '教师' : '管理员'
      }));
      
      setAllUsers(mockUsers);
      setLoading(false);
    }, 1000);
  }, []);

  // 获取测试关联的用户
  const fetchTestUsers = (testId) => {
    return new Promise(resolve => {
      setTimeout(() => {
        // 模拟数据 - 随机选择5-10个用户与该测试关联
        const count = Math.floor(Math.random() * 6) + 5;
        const selectedUsers = [];
        
        for (let i = 0; i < count; i++) {
          const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];
          const existing = selectedUsers.find(u => u.id === randomUser.id);
          
          if (!existing) {
            const status = Math.random() > 0.5 ? 2 : 1;
            selectedUsers.push({
              ...randomUser,
              c_test_id: testId,
              c_paper_id: `paper-${Math.floor(Math.random() * 100)}`,
              c_answers: JSON.stringify(Array.from({ length: 10 }, () => 
                Math.random() > 0.3 ? 'A' : '*'
              )),
              c_start: moment().subtract(Math.random() * 30, 'days').toDate(),
              c_end: moment().add(Math.random() * 30, 'days').toDate(),
              c_submit: Math.random() > 0.3 ? 
                moment().subtract(Math.random() * 20, 'days').toDate() : null,
              c_score: Math.floor(Math.random() * 100),
              c_correct: status,
            });
          }
        }
        
        resolve(selectedUsers);
      }, 500);
    });
  };

  const handleSearch = (e) => {
    setSearchText(e.target.value);
    setPagePractice(1);
    setPageTheory(1);
  };

  const handleAddTest = () => {
    setCurrentTest(null);
    setIsDialogOpen(true);
  };

  const handleEditTest = (test) => {
    setCurrentTest(test);
    setIsDialogOpen(true);
  };

  const handleDeleteTest = (testId) => {
    setTests(tests.filter(test => test.c_id !== testId));
  };

  const handleManageUsers = async (test) => {
    setCurrentTest(test);
    setLoading(true);
    
    try {
      const users = await fetchTestUsers(test.c_id);
      setTestUsers(users);
      setIsDrawerOpen(true);
    } catch (error) {
      console.error("获取用户数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTest = (testData) => {
    if (currentTest) {
      // 更新测试
      setTests(tests.map(test => 
        test.c_id === currentTest.c_id ? { ...test, ...testData } : test
      ));
    } else {
      // 添加新测试
      const newTest = {
        c_id: `test-${tests.length + 1}`,
        ...testData,
        c_create_at: new Date(),
      };
      setTests([...tests, newTest]);
    }
    setIsDialogOpen(false);
  };

  const handleSaveTestUsers = (updatedUsers) => {
    setTestUsers(updatedUsers);
    // 在实际应用中，这里会调用API保存更新
  };

  const getTestStatus = (test) => {
    const now = moment();
    const start = moment(test.c_start);
    const end = moment(test.c_end);
    
    if (now.isBefore(start)) {
      return { label: '未开始', color: 'primary' };
    } else if (now.isAfter(end)) {
      return { label: '已结束', color: 'error' };
    } else {
      return { label: '进行中', color: 'success' };
    }
  };

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.c_name.toLowerCase().includes(searchText.toLowerCase()) || 
                          test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
                          test.c_course_id.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesStartDate = !startDate || moment(test.c_start).isSameOrAfter(startDate, 'day');
    const matchesEndDate = !endDate || moment(test.c_end).isSameOrBefore(endDate, 'day');
    
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // 按类型拆分测试数据
  const practiceTests = filteredTests.filter(test => test.c_type === 'practice');
  const theoryTests = filteredTests.filter(test => test.c_type === 'theory');

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

  // 渲染测试表格的函数 - 统一两种测试类型的渲染
  const renderTestTable = (tests, testType, page, setPage, pageCount) => {
    if (tests.length === 0) return null;
    
    return (
      <Accordion 
        defaultExpanded 
        sx={{ 
          backgroundColor: getAccordionBgColor(),
          color: getTextColor(),
          mb: 2,
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon sx={{ color: getTextColor() }} />}
          sx={{ 
            backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
            borderBottom: isDarkMode ? '1px solid #444' : '1px solid #ddd',
            minHeight: '48px !important'
          }}
        >
          <Box display="flex" alignItems="center">
            {testType === 'practice' ? (
              <CodeIcon sx={{ color: '#4caf50', mr: 1.5, fontSize: 24 }} />
            ) : (
              <MenuBookIcon sx={{ color: '#2196f3', mr: 1.5, fontSize: 24 }} />
            )}
            <Typography variant="h6" fontWeight="bold">
              {testType === 'practice' ? '实践操作' : '理论测试'}
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: isDarkMode ? '#333' : '#e8e8e8' }}>
                  <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>测试名称</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>描述</TableCell>
                  {/* 实践操作类型不显示试卷数列 */}
                  {testType !== 'practice' && (
                    <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>试卷数</TableCell>
                  )}
                  <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>课程ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>时间范围</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>状态</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tests.map((test, index) => {
                  const status = getTestStatus(test);
                  
                  return (
                    <TableRow 
                      key={test.c_id} 
                      hover
                      sx={{ backgroundColor: getTableRowBgColor(index) }}
                    >
                      <TableCell sx={{ fontWeight: 500, color: getTextColor() }}>{test.c_name}</TableCell>
                      <TableCell sx={{ maxWidth: 300, color: getTextColor() }}>{test.c_description}</TableCell>
                      {/* 实践操作类型不显示试卷数 */}
                      {testType !== 'practice' && (
                        <TableCell align="center" sx={{ color: getTextColor() }}>{test.c_paper_count}</TableCell>
                      )}
                      <TableCell align="center" sx={{ color: getTextColor() }}>{test.c_course_id}</TableCell>
                      <TableCell sx={{ color: getTextColor() }}>
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
                          <IconButton 
                            onClick={() => handleEditTest(test)}
                            sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="管理用户">
                          <IconButton 
                            onClick={() => handleManageUsers(test)}
                            sx={{ color: isDarkMode ? '#f48fb1' : '#f50057' }}
                          >
                            <PeopleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="删除测试">
                          <IconButton 
                            onClick={() => handleDeleteTest(test.c_id)}
                            sx={{ color: isDarkMode ? '#f44336' : '#d32f2f' }}
                          >
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
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: getTextColor(),
                  },
                  '& .MuiPaginationItem-page.Mui-selected': {
                    backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
                    color: '#fff',
                  }
                }}
              />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

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
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleAddTest}
          sx={{ 
            textTransform: 'none', 
            fontWeight: 500,
            borderRadius: 2,
            px: 3,
            py: 1,
            backgroundColor: getButtonColor(),
            color: '#fff',
            '&:hover': {
              backgroundColor: isDarkMode ? '#303f9f' : '#1565c0'
            }
          }}
        >
          添加测试
        </Button>
      </Box>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={12}>
          <TextField
            fullWidth
            placeholder="搜索测试名称、描述或课程ID"
            variant="outlined"
            size="small"
            value={searchText}
            onChange={handleSearch}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
              style: { 
                color: getTextColor(),
                backgroundColor: isDarkMode ? '#252525' : '#fff'
              }
            }}
            InputLabelProps={{ style: { color: getTextColor() } }}
            sx={{
              width: { xs: '100%', md: 300 }, 
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterMoment}>
            <DatePicker
              label="开始日期"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth 
                  size="small"
                  InputLabelProps={{ style: { color: getTextColor() } }}
                  InputProps={{ style: { color: getTextColor() } }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? '#252525' : '#fff'
                    }
                  }}
                />
              )}
              inputFormat="YYYY/MM/DD"
              displayFormat="YYYY/MM/DD"
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterMoment}>
            <DatePicker
              label="结束日期"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth 
                  size="small"
                  InputLabelProps={{ style: { color: getTextColor() } }}
                  InputProps={{ style: { color: getTextColor() } }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? '#252525' : '#fff'
                    }
                  }}
                />
              )}
              inputFormat="YYYY/MM/DD"
              displayFormat="YYYY/MM/DD"
            />
          </LocalizationProvider>
        </Grid>
      </Grid>
      
      {loading && <LinearProgress />}
      
      {/* 实践操作表格 */}
      {renderTestTable(paginatedPracticeTests, 'practice', pagePractice, setPagePractice, pagePracticeCount)}
      
      {/* 理论测试表格 */}
      {renderTestTable(paginatedTheoryTests, 'theory', pageTheory, setPageTheory, pageTheoryCount)}
      
      {filteredTests.length === 0 && !loading && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 200,
          color: getTextColor()
        }}>
          没有找到匹配的测试
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
    </Paper>
  );
};

export default TestManagement;