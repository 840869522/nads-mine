"use client";
import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TextField, InputAdornment, useTheme, Chip, CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  IconButton
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

const ScoreManagement: React.FC = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [scoreData, setScoreData] = useState<{ course_id: string; course_name: string; tests: any[]; experiments: any[] } | null>(null);
  const [loadingScores, setLoadingScores] = useState<{ [key: string]: boolean }>({}); // 修改为对象，跟踪每个课程的加载状态

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
      console.error('获取课程及测试实验失败:', error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // 查看课程成绩
  const handleViewScores = async (courseId: string) => {
    setLoadingScores((prev) => ({ ...prev, [courseId]: true })); // 设置当前课程的加载状态
    try {
      const response = await apiClientWithToken.get('/back/api/study/test/get_test_scores', {
        params: { course_id: courseId }
      });
      if (response.data?.code === 200) {
        setScoreData(response.data.data);
        setScoreDialogOpen(true);
      } else {
        alert(response.data?.message || '获取成绩失败');
      }
    } catch (error) {
      console.error('获取成绩失败:', error);
      alert('获取成绩失败');
    } finally {
      setLoadingScores((prev) => ({ ...prev, [courseId]: false })); // 恢复当前课程的加载状态
    }
  };

  // 下载课程成绩
  const handleDownloadScores = (courseId: string) => {
    window.open(`/back/api/study/test/download_test_scores?course_id=${courseId}`, '_blank');
  };

  // 过滤课程
  const filteredCourses = courses.filter(course => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    if (course.course_id.toLowerCase().includes(searchLower)) return true;
    if (course.course_name.toLowerCase().includes(searchLower)) return true;
    return course.items.some(item => 
      item.name.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower)
    );
  });

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
                label="搜索课程ID、名称或测试/实验名称"
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
                  {filteredCourses.length > 0 ? (
                    filteredCourses.map((course) => (
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
                            {itemIndex === 0 && (
                              <TableCell 
                                rowSpan={course.items.length} 
                                sx={{ 
                                  verticalAlign: 'middle',
                                  textAlign: 'center'
                                }}
                              >
                                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<VisibilityIcon />}
                                    onClick={() => handleViewScores(course.course_id)}
                                    disabled={loadingScores[course.course_id] || false} // 修改：仅禁用当前课程的按钮
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
                                    onClick={() => handleDownloadScores(course.course_id)}
                                    sx={{ 
                                      backgroundColor: isDarkMode ? '#0288d1' : '#0288d1',
                                      '&:hover': { backgroundColor: isDarkMode ? '#03a9f4' : '#0277bd' }
                                    }}
                                  >
                                    下载成绩
                                  </Button>
                                </Box>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
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
            {scoreData?.course_name} 成绩详情
            <IconButton onClick={() => setScoreDialogOpen(false)}>
              <CloseIcon sx={{ color: isDarkMode ? '#fff' : '#000' }} />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {scoreData?.tests?.map((test) => (
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
                      {test.scores?.length === 0 && (
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
            {scoreData?.experiments?.map((experiment) => (
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
                      {experiment.history?.length === 0 && (
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
            {scoreData && scoreData.tests.length === 0 && scoreData.experiments.length === 0 && (
              <Typography sx={{ color: isDarkMode ? '#aaa' : '#777', textAlign: 'center' }}>
                无成绩或提交历史
              </Typography>
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