import React, { useState, useEffect } from 'react';
import { 
  Box, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  LinearProgress, Pagination, Grid, Tooltip, Button,
  Accordion, AccordionSummary, AccordionDetails,
  Card, CardContent, CardActions, CircularProgress
} from '@mui/material';
import { 
  Search as SearchIcon,
  People as PeopleIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Code as CodeIcon, // 实践操作图标
  MenuBook as MenuBookIcon, // 理论测试图标
  ExpandMore as ExpandMoreIcon,
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  Speed as SpeedIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import '@/node_modules/moment/locale/zh-cn';
import { useTheme } from '@mui/material/styles';

// 应用中文本地化
moment.locale('zh-cn');

// 实践操作测试页面组件
const PracticalTestPage = ({ testId, onBack }: { testId: string; onBack: () => void }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testInfo, setTestInfo] = useState<any>(null);
  
  // 动态颜色函数
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#333';
  const getSecondaryTextColor = () => isDarkMode ? '#bbb' : '#666';
  const getButtonColor = () => isDarkMode ? '#4caf50' : '#2e7d32';
  const getHeaderBgColor = () => isDarkMode ? '#2a2a2a' : '#f5f7fa';
  
  // 模拟获取测试场景数据
  useEffect(() => {
    setLoading(true);
    
    // 模拟API调用
    setTimeout(() => {
      // 模拟测试信息
      const mockTestInfo = {
        id: testId,
        name: `实践操作测试 ${testId.split('-')[1]}`,
        description: `这是${testId}的详细描述信息，包含多个实践操作场景，学生需要完成所有场景任务来通过测试`,
        duration: 120, // 分钟
        totalScenes: 5
      };
      
      // 模拟场景数据
      const mockScenes = Array.from({ length: 5 }, (_, i) => ({
        id: `scene-${i + 1}`,
        name: `实践场景 ${i + 1}`,
        description: `这是场景 ${i + 1} 的详细描述，包含需要完成的实践操作任务和要求。学生需要按照指示完成相关操作，系统将自动记录操作过程和结果。`,
        difficulty: ['简单', '中等', '困难'][i % 3],
        testDuration: [15, 30, 45][i % 3], // 测试时长（分钟）
        status: i === 0 ? '进行中' : i > 2 ? '已完成' : '未开始',
        progress: i === 0 ? 40 : i > 2 ? 100 : 0
      }));
      
      setTestInfo(mockTestInfo);
      setScenes(mockScenes);
      setLoading(false);
    }, 800);
  }, [testId]);
  
  const handleStartScene = (sceneId: string) => {
    alert(`开始场景: ${sceneId}`);
    // 实际应用中这里会导航到具体场景操作页面
  };
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case '进行中': return 'primary';
      case '已完成': return 'success';
      default: return 'default';
    }
  };
  
  const getDifficultyColor = (difficulty: string) => {
    switch(difficulty) {
      case '简单': return 'success';
      case '中等': return 'warning';
      case '困难': return 'error';
      default: return 'default';
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Paper sx={{ 
      p: 3, 
      borderRadius: 4,
      backgroundColor: getCardBgColor(),
      color: getTextColor(),
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      {/* 头部信息 */}
      <Box sx={{ 
        backgroundColor: getHeaderBgColor(),
        p: 3, 
        borderRadius: 3, 
        mb: 3,
        borderLeft: `4px solid ${isDarkMode ? '#4caf50' : '#2e7d32'}`
      }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={onBack}
          sx={{ 
            mb: 2,
            color: getButtonColor(),
            '&:hover': {
              backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(46, 125, 50, 0.1)'
            }
          }}
        >
          返回测试列表
        </Button>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              {testInfo.name}
            </Typography>
            <Typography variant="body1" color={getSecondaryTextColor()} sx={{ mb: 2 }}>
              {testInfo.description}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Box sx={{ 
              backgroundColor: isDarkMode ? '#252525' : '#f0f4f8', 
              p: 2, 
              borderRadius: 2 
            }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color={getSecondaryTextColor()}>
                    测试ID:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="500">
                    {testInfo.id}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color={getSecondaryTextColor()}>
                    总时长:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="500">
                    {testInfo.duration} 分钟
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2" color={getSecondaryTextColor()}>
                    场景数量:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" fontWeight="500">
                    {testInfo.totalScenes} 个
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Grid>
        </Grid>
      </Box>
      
      {/* 场景列表 */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, mt: 4 }}>
        实践场景列表
      </Typography>
      
      <Grid container spacing={3}>
        {scenes.map((scene, index) => (
          <Grid item xs={12} md={6} key={scene.id}>
            <Card sx={{ 
              height: '100%', 
              width: { xs: '100%', md: 950 },
              display: 'flex', 
              flexDirection: 'column',
              backgroundColor: getCardBgColor(),
              border: isDarkMode ? '1px solid #333' : '1px solid #e0e0e0',
              boxShadow: 'none',
              transition: 'transform 0.3s, box-shadow 0.3s',
              '&:hover': {
                transform: 'translateY(-5px)',
                boxShadow: isDarkMode ? '0 6px 14px rgba(0,0,0,0.3)' : '0 6px 14px rgba(0,0,0,0.1)'
              }
            }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="h6" fontWeight="600">
                    {scene.name}
                  </Typography>
                  <Chip 
                    label={scene.status} 
                    size="small" 
                    color={getStatusColor(scene.status)}
                    sx={{ 
                      borderRadius: 1, 
                      fontWeight: 500,
                      backgroundColor: scene.status === '进行中' 
                        ? (isDarkMode ?  'rgba(0, 94, 255, 0.66)':'rgba(0, 94, 255, 1)' ) 
                        : undefined
                    }}
                  />
                </Box>
                
                <Typography variant="body2" color={getSecondaryTextColor()} sx={{ mb: 2 }}>
                  {scene.description}
                </Typography>
                
                <Grid container spacing={1} sx={{ mb: 1.5 }}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <SpeedIcon fontSize="small" sx={{ mr: 1, color: getSecondaryTextColor() }} />
                      <Typography variant="body2">
                        难度: 
                        <Chip 
                          label={scene.difficulty} 
                          size="small" 
                          color={getDifficultyColor(scene.difficulty)}
                          sx={{ ml: 1, borderRadius: 1 }}
                        />
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AccessTimeIcon fontSize="small" sx={{ mr: 1, color: getSecondaryTextColor() }} />
                      <Typography variant="body2">
                        测试时长: {scene.testDuration}分钟
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                {scene.status === '进行中' && (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="body2" color={getSecondaryTextColor()} sx={{ mb: 1 }}>
                      完成进度: {scene.progress}%
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={scene.progress} 
                      color="primary"
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: isDarkMode ? '#333' : '#e0e0e0'
                      }}
                    />
                  </Box>
                )}
              </CardContent>
              
              <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                {scene.status === '已完成' ? (
                  <Button 
                    size="small" 
                    color="success"
                    endIcon={<CheckCircleOutlineIcon />}
                    sx={{ fontWeight: 500 }}
                  >
                    已完成
                  </Button>
                ) : (
                  <Button 
                    variant="contained"
                    size="small"
                    onClick={() => handleStartScene(scene.id)}
                    startIcon={scene.status === '进行中' ? <PlayCircleOutlineIcon /> : <PlayArrowIcon />}
                    sx={{
                      backgroundColor: getButtonColor(),
                      '&:hover': {
                        backgroundColor: isDarkMode ? '#388e3c' : '#1b5e20'
                      },
                      fontWeight: 500
                    }}
                  >
                    {scene.status === '进行中' ? '继续测试' : '开始测试'}
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* 底部操作按钮 */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button 
          variant="outlined"
          onClick={onBack}
          sx={{ 
            mr: 2,
            color: getTextColor(),
            borderColor: isDarkMode ? '#555' : '#ddd',
            '&:hover': {
              borderColor: isDarkMode ? '#777' : '#ccc'
            }
          }}
        >
          返回列表
        </Button>
        <Button 
          variant="contained"
          sx={{
            backgroundColor: getButtonColor(),
            '&:hover': {
              backgroundColor: isDarkMode ? '#388e3c' : '#1b5e20'
            }
          }}
        >
          提交所有测试
        </Button>
      </Box>
    </Paper>
  );
};

const TestManagement_user = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState<moment.Moment | null>(null);
  const [endDate, setEndDate] = useState<moment.Moment | null>(null);
  
  // 为两种测试类型分别设置分页
  const [pagePractical, setPagePractical] = useState(1);
  const [pageTheoretical, setPageTheoretical] = useState(1);
  const [rowsPerPage] = useState(5); // 每页显示5条，便于查看分页效果

  // 视图状态管理
  const [currentView, setCurrentView] = useState('list'); // 'list' 或 'test'
  const [currentTestId, setCurrentTestId] = useState('');

  // 动态颜色函数
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
    
    // 模拟获取测试数据 - 新增c_type字段
    setTimeout(() => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        c_id: `test-${i + 1}`,
        c_name: `测试 ${i + 1}`,
        c_description: `这是测试 ${i + 1} 的描述信息，用于评估学生相关知识掌握情况`,
        c_paper_count: Math.floor(Math.random() * 5) + 1,
        c_start: moment().subtract(Math.random() * 30, 'days').toDate(),
        c_end: moment().add(Math.random() * 30, 'days').toDate(),
        c_create_at: moment().subtract(Math.random() * 100, 'days').toDate(),
        c_course_id: `C${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        // 随机分配测试类型
        c_type: Math.random() > 0.5 ? '实践操作' : '理论测试'
      }));
      
      setTests(mockData);
      setLoading(false);
    }, 1000);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setPagePractical(1);
    setPageTheoretical(1);
  };

  const getTestStatus = (test: any) => {
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

  const filteredTests = tests.filter((test: any) => {
    const matchesSearch = test.c_name.toLowerCase().includes(searchText.toLowerCase()) || 
                          test.c_description.toLowerCase().includes(searchText.toLowerCase()) ||
                          test.c_course_id.toLowerCase().includes(searchText.toLowerCase()) ;
    
    const matchesStartDate = !startDate || moment(test.c_start).isSameOrAfter(startDate, 'day');
    const matchesEndDate = !endDate || moment(test.c_end).isSameOrBefore(endDate, 'day');
    
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // 分离两种类型的测试
  const practicalTests = filteredTests.filter((test: any) => test.c_type === '实践操作');
  const theoreticalTests = filteredTests.filter((test: any) => test.c_type === '理论测试');

  // 计算分页
  const practicalPageCount = Math.ceil(practicalTests.length / rowsPerPage);
  const paginatedPracticalTests = practicalTests.slice((pagePractical - 1) * rowsPerPage, pagePractical * rowsPerPage);
  
  const theoreticalPageCount = Math.ceil(theoreticalTests.length / rowsPerPage);
  const paginatedTheoreticalTests = theoreticalTests.slice((pageTheoretical - 1) * rowsPerPage, pageTheoretical * rowsPerPage);

  // 处理进入测试按钮点击
  const handleEnterTest = (testId: string) => {
    setCurrentTestId(testId);
    setCurrentView('test');
  };

  const handleBackToList = () => {
    setCurrentView('list');
  };

  // 渲染测试表格的函数
  const renderTestTable = (tests: any[], testType: string, page: number, setPage: React.Dispatch<React.SetStateAction<number>>, pageCount: number) => {
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
            {testType === '实践操作' ? (
              <CodeIcon sx={{ color: '#4caf50', mr: 1.5, fontSize: 24 }} />
            ) : (
              <MenuBookIcon sx={{ color: '#2196f3', mr: 1.5, fontSize: 24 }} />
            )}
            <Typography variant="h6" fontWeight="bold">
              {testType}
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
                  {testType !== '实践操作' && (
                    <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>试卷数</TableCell>
                  )}
                  <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>课程ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>时间范围</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>状态</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, color: getHeaderTextColor() }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tests.map((test: any, index: number) => {
                  const status = getTestStatus(test);
                  const isExpired = status.label === '已结束';
                  
                  return (
                    <TableRow 
                      key={test.c_id} 
                      hover
                      sx={{ backgroundColor: getTableRowBgColor(index) }}
                    >
                      <TableCell sx={{ fontWeight: 500, color: getTextColor() }}>{test.c_name}</TableCell>
                      <TableCell sx={{ maxWidth: 300, color: getTextColor() }}>{test.c_description}</TableCell>
                      {/* 实践操作类型不显示试卷数 */}
                      {testType !== '实践操作' && (
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
                      <TableCell align="center">
                        <Tooltip 
                          title={isExpired ? "测试已结束，无法进入" : "进入测试"} 
                          placement="top"
                        >
                          <span>
                            <Button
                              variant="contained"
                              size="small"
                              disabled={isExpired}
                              onClick={() => handleEnterTest(test.c_id)}
                              sx={{
                                backgroundColor: isExpired 
                                  ? (isDarkMode ? '#555' : '#ccc') 
                                  : getButtonColor(),
                                color: isExpired 
                                  ? (isDarkMode ? '#888' : '#666') 
                                  : '#fff',
                                '&:hover': {
                                  backgroundColor: isExpired 
                                    ? (isDarkMode ? '#555' : '#ccc') 
                                    : (isDarkMode ? '#303f9f' : '#1565c0')
                                },
                                borderRadius: 1,
                                px: 1.5,
                                py: 0.5,
                                minWidth: 90
                              }}
                            >
                              {isExpired ? '已过期' : '进入测试'}
                            </Button>
                          </span>
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

  // 如果当前视图是测试详情页，则渲染测试详情
  if (currentView === 'test') {
    return <PracticalTestPage testId={currentTestId} onBack={handleBackToList} />;
  }

  // 否则渲染测试列表
  return (
    <Paper sx={{ 
      p: 3, 
      borderRadius: 4, 
      position: 'relative',
      backgroundColor: getCardBgColor(),
      color: getTextColor(),
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" color={getTextColor()}>
          测试管理
        </Typography>
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
      
      {/* 实践操作测试表格 */}
      {renderTestTable(paginatedPracticalTests, '实践操作', pagePractical, setPagePractical, practicalPageCount)}
      
      {/* 理论测试表格 */}
      {renderTestTable(paginatedTheoreticalTests, '理论测试', pageTheoretical, setPageTheoretical, theoreticalPageCount)}
      
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
    </Paper>
  );
};

export default TestManagement_user;