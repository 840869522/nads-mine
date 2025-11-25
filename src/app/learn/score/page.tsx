"use client";
import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TextField, InputAdornment, useTheme, Chip, CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  IconButton,TablePagination 
} from '@mui/material';
import { Search as SearchIcon, Visibility as VisibilityIcon, Download as DownloadIcon, Close as CloseIcon } from '@mui/icons-material';
import { apiClientWithToken } from "@/utils/axios";

interface CourseItem {
  id: string;
  name: string;
  description: string;
  start: string;
  end: string;
  type: string;
  category: '理论测试' | '实验';
}

interface Course {
  course_id: string;
  course_name: string;
  items: CourseItem[];
}

interface TheoryScore {
  username: string;
  papers: Array<{
    paper_id: string;
    paper_name: string;
    start_time: string;
    submit_time: string;
    total_score: number;
    objective_score: number;
    subjective_score: number;
  }>;
}

interface ExperimentHistory {
  username: string;
  history: Array<{
    c_submission_id: string;
    c_submitted_at: string;
    c_is_correct: boolean;
    c_attempt_count: number;
    c_points_earned: number;
    instance_ip: string;
    instance_name: string;
    instance_type: string;
  }>;
}

interface TestScoreData {
  course_id: string;
  course_name: string;
  test_id: string;
  test_name: string;
  category: '理论测试' | '实验' | '课程整体';
  scores?: TheoryScore[];
  history?: ExperimentHistory[];
  // 新增课程整体成绩字段
  tests?: Array<{
    test_id: string;
    test_name: string;
    category: string;
    scores: TheoryScore[];
  }>;
  experiments?: Array<{
    test_id: string;
    test_name: string;
    category: string;
    history: ExperimentHistory[];
  }>;
}

const ScoreManagement: React.FC = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [scoreData, setScoreData] = useState<TestScoreData | null>(null);
  const [loadingScores, setLoadingScores] = useState<{ [key: string]: boolean }>({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 处理页码变化
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // 处理每页行数变化
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 题型颜色映射
  const typeColorMap: Record<string, 'primary' | 'secondary' | 'warning' | 'success' | 'info'> = {
    '单选题': 'primary',
    '多选题': 'secondary',
    '判断题': 'warning',
    '主观题': 'success',
    '理论测试': 'primary',
    '实验': 'info'
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // 获取所有课程及测试实验数据
  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await apiClientWithToken.get('/back/api/study/test/get_course_tests_experiments');
      const rawData = response.data?.data || [];
      setCourses(rawData);
    } catch (error) {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

// 查看课程成绩
const handleViewCourseScores = async (courseId: string) => {
  setLoadingScores((prev) => ({ ...prev, [courseId]: true }));
  try {
    const response = await apiClientWithToken.get('/back/api/study/test/get_test_scores', {
      params: { course_id: courseId }
    });
    if (response.data?.code === 200) {
      // 直接使用后端返回的数据结构，不要重新映射
      setScoreData({
        ...response.data.data,
        // 添加必要的字段用于显示
        test_id: courseId,
        test_name: response.data.data.course_name,
        category: '课程整体'
      });
      setScoreDialogOpen(true);
    } else {
      alert(response.data?.message || '获取成绩失败');
    }
  } catch (error) {
    alert('获取课程成绩失败');
  } finally {
    setLoadingScores((prev) => ({ ...prev, [courseId]: false }));
  }
};

  // 查看单个测试/实验成绩（新增功能）
  const handleViewTestScores = async (courseId: string, testId: string, testName: string, category: '理论测试' | '实验') => {
    const loadingKey = `${courseId}-${testId}`;
    setLoadingScores((prev) => ({ ...prev, [loadingKey]: true }));
    try {
      const response = await apiClientWithToken.get('/back/api/study/test/get_test_score_detail', {
        params: { 
          course_id: courseId,
          test_id: testId,
          category: category
        }
      });
      if (response.data?.code === 200) {
        setScoreData(response.data.data);
        setScoreDialogOpen(true);
      } else {
        alert(response.data?.message || '获取成绩失败');
      }
    } catch (error) {
      alert('获取成绩失败');
    } finally {
      setLoadingScores((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  // 下载课程成绩（原有功能）
  const handleDownloadCourseScores = (courseId: string) => {
    window.open(`/back/api/study/test/download_test_scores?course_id=${courseId}`, '_blank');
  };

  // 下载单个测试/实验成绩（新增功能）
  const handleDownloadTestScores = (courseId: string, testId: string, category: '理论测试' | '实验') => {
    window.open(`/back/api/study/test/download_test_score_detail?course_id=${courseId}&test_id=${testId}&category=${category}`, '_blank');
  };

    // 过滤课程和测试项
  const filteredCourses = courses.map(course => {
    if (!searchTerm) return course;
    
    const searchLower = searchTerm.toLowerCase();
    
    // 如果搜索词匹配课程信息，返回整个课程
    if (
      course.course_id.toLowerCase().includes(searchLower) ||
      course.course_name.toLowerCase().includes(searchLower)
    ) {
      return course;
    }
    
    // 如果搜索词匹配测试项，只返回匹配的测试项
    const filteredItems = course.items.filter(item => 
      item.name.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower)
    );
    
    if (filteredItems.length > 0) {
      return {
        ...course,
        items: filteredItems
      };
    }
    
    return null;
  }).filter(Boolean) as Course[];

  // 计算分页后的数据
  const paginatedCourses = filteredCourses.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // 样式辅助函数
  const getBgColor = () => isDarkMode ? '#121212' : '#f5f5f5';
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTableRowBgColor = (index: number) => 
    isDarkMode 
      ? (index % 2 === 0 ? '#252525' : '#1e1e1e') 
      : (index % 2 === 0 ? '#fafafa' : '#ffffff');

  return (
    <Box sx={{ 
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: getBgColor(),
      color: isDarkMode ? '#ffffff' : '#000000'
    }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Card sx={{ 
          borderRadius: 2, 
          mb: 3,
          backgroundColor: getCardBgColor(),
        }}>
          <CardContent>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 3,
              flexWrap: 'wrap',
              gap: 2
            }}>
              <Typography variant="h5" component="div">
                成绩管理系统
              </Typography>
              
              <TextField
                label="搜索课程名称、测试名称或描述"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  backgroundColor: isDarkMode ? '#333' : '#fff',
                  minWidth: 300
                }}
              />
            </Box>
            
            <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor() }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>课程名称</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>名称</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>类型</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>开始时间</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>结束时间</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>描述</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                 {paginatedCourses.length > 0 ? (
                      paginatedCourses.map((course) => (
                        <React.Fragment key={course.course_id}>
                          {course.items.map((item, itemIndex) => (
                            <TableRow 
                              key={`${course.course_id}-${item.id}`}
                              sx={{ backgroundColor: getTableRowBgColor(itemIndex) }}
                            >
                            {itemIndex === 0 && (
                              <TableCell 
                                rowSpan={course.items.length} 
                                sx={{ 
                                  color: isDarkMode ? '#fff' : '#000',
                                  verticalAlign: 'middle',
                                  textAlign: 'center',
                                  fontWeight: 'bold'
                                }}
                              >
                                {course.course_name}
                              </TableCell>
                            )}
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                              {item.name}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={item.category === '实验' ? '实验' : item.type} 
                                color={typeColorMap[item.type] || 'info'} 
                                size="small" 
                                sx={{ color: '#fff' }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                              {item.start}
                            </TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                              {item.end}
                            </TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                              {item.description || '无描述'}
                            </TableCell>
                            <TableCell sx={{ verticalAlign: 'middle' }}>
                              <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                                {/* 单个测试/实验的操作按钮 */}
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<VisibilityIcon />}
                                  onClick={() => handleViewTestScores(course.course_id, item.id, item.name, item.category)}
                                  disabled={loadingScores[`${course.course_id}-${item.id}`] || false}
                                  sx={{ 
                                    backgroundColor: isDarkMode ? '#3f51b5' : '#1976d2',
                                    '&:hover': { backgroundColor: isDarkMode ? '#5c6bc0' : '#1565c0' }
                                  }}
                                >
                                  查看成绩
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<DownloadIcon />}
                                  onClick={() => handleDownloadTestScores(course.course_id, item.id, item.category)}
                                  sx={{ 
                                    backgroundColor: isDarkMode ? '#0288d1' : '#0288d1',
                                    '&:hover': { backgroundColor: isDarkMode ? '#03a9f4' : '#0277bd' }
                                  }}
                                >
                                  下载成绩
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* 课程级别的操作按钮 */}
                        <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                          <TableCell colSpan={6} sx={{ 
                            color: isDarkMode ? '#fff' : '#000',
                            fontWeight: 'bold',
                            textAlign: 'right'
                          }}>
                            课程整体操作：
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'middle' }}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<VisibilityIcon />}
                                onClick={() => handleViewCourseScores(course.course_id)}
                                disabled={loadingScores[course.course_id] || false}
                                sx={{ 
                                  borderColor: isDarkMode ? '#3f51b5' : '#1976d2',
                                  color: isDarkMode ? '#fff' : '#1976d2'
                                }}
                              >
                                查看课程成绩
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<DownloadIcon />}
                                onClick={() => handleDownloadCourseScores(course.course_id)}
                                sx={{ 
                                  borderColor: isDarkMode ? '#0288d1' : '#0288d1',
                                  color: isDarkMode ? '#fff' : '#0288d1'
                                }}
                              >
                                下载课程成绩
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                        {loading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            加载中...
                          </Box>
                        ) : '未找到匹配的课程或测试/实验'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
             <TablePagination
                rowsPerPageOptions={[10, 30, 50]}
                component="div"
                count={filteredCourses.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="每页行数:"
                labelDisplayedRows={({ from, to, count }) => 
                  `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`
                }
                sx={{
                  color: isDarkMode ? '#fff' : '#000',
                  backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
                  '& .MuiTablePagination-selectIcon': {
                    color: isDarkMode ? '#fff' : '#000'
                  }
                }}
              />
            </TableContainer>
          </CardContent>
        </Card>

        {/* 成绩查看模态框 */}
        <Dialog
          open={scoreDialogOpen}
          onClose={() => setScoreDialogOpen(false)}
          maxWidth="lg"
          fullWidth
          sx={{ '& .MuiDialog-paper': { backgroundColor: getCardBgColor() } }}
        >
          <DialogTitle sx={{ color: isDarkMode ? '#fff' : '#000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {scoreData?.test_name} 成绩详情
            <IconButton onClick={() => setScoreDialogOpen(false)}>
              <CloseIcon sx={{ color: isDarkMode ? '#fff' : '#000' }} />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {/* 课程整体成绩显示 - 新增 */}
            {scoreData?.category === '课程整体' && (
              <>
                {/* 显示理论测试成绩 */}
                {scoreData.tests?.map((test) => (
                  <Box key={test.test_id} sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ color: isDarkMode ? '#fff' : '#000', mb: 2 }}>
                      理论测试: {test.test_name}
                    </Typography>
                    <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor() }}>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>用户名</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>试卷名称</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>开始时间</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>提交时间</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>总分</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>客观题分</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>主观题分</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {test.scores?.map((user: TheoryScore) =>
                            user.papers.map((paper, index) => (
                              <TableRow key={`${user.username}-${paper.paper_id}`} sx={{ backgroundColor: getTableRowBgColor(index) }}>
                                {index === 0 && (
                                  <TableCell rowSpan={user.papers.length} sx={{ color: isDarkMode ? '#fff' : '#000', verticalAlign: 'middle' }}>
                                    {user.username}
                                  </TableCell>
                                )}
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.paper_name}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.start_time}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.submit_time}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.total_score}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.objective_score}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.subjective_score}</TableCell>
                              </TableRow>
                            ))
                          )}
                          {(!test.scores || test.scores.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={7} align="center" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                                无成绩记录
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ))}
                
                {/* 显示实验成绩 */}
                {scoreData.experiments?.map((experiment) => (
                  <Box key={experiment.test_id} sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ color: isDarkMode ? '#fff' : '#000', mb: 2 }}>
                      实验: {experiment.test_name}
                    </Typography>
                    <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor() }}>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>用户名</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>提交时间</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>是否正确</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>尝试次数</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>获得积分</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>靶机IP</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>靶机名称</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>靶机类型</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {experiment.history?.map((user: ExperimentHistory) =>
                            user.history.map((record, index) => (
                              <TableRow key={`${user.username}-${record.c_submission_id}`} sx={{ backgroundColor: getTableRowBgColor(index) }}>
                                {index === 0 && (
                                  <TableCell rowSpan={user.history.length} sx={{ color: isDarkMode ? '#fff' : '#000', verticalAlign: 'middle' }}>
                                    {user.username}
                                  </TableCell>
                                )}
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_submitted_at}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_is_correct ? '是' : '否'}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_attempt_count}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_points_earned}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.instance_ip}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.instance_name}</TableCell>
                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.instance_type}</TableCell>
                              </TableRow>
                            ))
                          )}
                          {(!experiment.history || experiment.history.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={8} align="center" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                                无提交历史
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ))}           
              </>
            )}

            {/* 理论测试成绩显示 */}
            {scoreData?.category === '理论测试' && scoreData.scores && (
              <Box sx={{ mb: 4 }}>
                <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor() }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>用户名</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>试卷名称</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>开始时间</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>提交时间</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>总分</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>客观题分</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>主观题分</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scoreData.scores.map((user: TheoryScore) =>
                        user.papers.map((paper, index) => (
                          <TableRow key={`${user.username}-${paper.paper_id}`} sx={{ backgroundColor: getTableRowBgColor(index) }}>
                            {index === 0 && (
                              <TableCell rowSpan={user.papers.length} sx={{ color: isDarkMode ? '#fff' : '#000', verticalAlign: 'middle' }}>
                                {user.username}
                              </TableCell>
                            )}
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.paper_name}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.start_time}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.submit_time}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.total_score}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.objective_score}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{paper.subjective_score}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {scoreData.scores.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                            无成绩记录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* 实验成绩显示 */}
            {scoreData?.category === '实验' && scoreData.history && (
              <Box sx={{ mb: 4 }}>
                <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor() }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>用户名</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>提交时间</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>是否正确</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>尝试次数</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>获得积分</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>靶机IP</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>靶机名称</TableCell>
                        <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>靶机类型</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scoreData.history.map((user: ExperimentHistory) =>
                        user.history.map((record, index) => (
                          <TableRow key={`${user.username}-${record.c_submission_id}`} sx={{ backgroundColor: getTableRowBgColor(index) }}>
                            {index === 0 && (
                              <TableCell rowSpan={user.history.length} sx={{ color: isDarkMode ? '#fff' : '#000', verticalAlign: 'middle' }}>
                                {user.username}
                              </TableCell>
                            )}
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_submitted_at}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_is_correct ? '是' : '否'}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_attempt_count}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.c_points_earned}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.instance_ip}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.instance_name}</TableCell>
                            <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{record.instance_type}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {scoreData.history.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                            无提交历史
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* 全局加载指示器 */}
        {loading && (
          <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}>
            <Box sx={{ 
              backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', 
              p: 4, 
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxShadow: 3
            }}>
              <CircularProgress size={60} sx={{ mb: 2, color: '#3f51b5' }} />
              <Typography variant="h6" sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                加载中，请稍候...
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ScoreManagement;