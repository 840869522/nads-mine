import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Rating,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  useTheme,
  InputAdornment
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Grade as GradeIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Score as ScoreIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { apiClientWithToken } from "@/utils/axios";

interface SubjectiveQuestion {
  id: string;
  question_id: string;
  question: string;
  highest_score: number;
  answer: string;
  score: number;
  c_update_at: string;
}

interface TestCorrectionDialogProps {
  open: boolean;
  onClose: () => void;
  testId: string;
  testName: string;
}

interface Student {
  username: string;
  paper_id: string;
  paper_name: string;
  objective_score: number;
  subjective_score: number;
  total_score: number;
  correct_status: number;
  correct_status_text: string;
}

const TestCorrectionDialog: React.FC<TestCorrectionDialogProps> = ({
  open,
  onClose,
  testId,
  testName
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [questions, setQuestions] = useState<SubjectiveQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 颜色函数
  const getBackgroundColor = () => isDarkMode ? '#1a1a1a' : '#f5f5f5';
  const getSurfaceColor = () => isDarkMode ? '#2d2d2d' : '#ffffff';
  const getPrimaryColor = () => theme.palette.primary.main;
  const getTextColor = () => theme.palette.text.primary;
  const getSecondaryTextColor = () => theme.palette.text.secondary;
  const getBorderColor = () => isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const getSuccessColor = () => theme.palette.success.main;
  const getErrorColor = () => theme.palette.error.main;
  const getWarningColor = () => theme.palette.warning.main;
  const getInfoColor = () => theme.palette.info.main;

  // 从本地存储获取用户名
  useEffect(() => {
    try {
      const droneSimUserStr = localStorage.getItem('droneSimUser');
      if (droneSimUserStr) {
        const droneSimUser = JSON.parse(droneSimUserStr);
        const username = droneSimUser?.user?.c_username || '';
        setCurrentUsername(username);
      }
    } catch (err) {
    }
  }, []);

  // 过滤学生列表
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student =>
        student.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.paper_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchTerm, students]);

  // 获取所有考生名单和成绩信息
  const fetchAllStudentsList = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiClientWithToken.post('/back/api/study/test/getAllStudentsObjectiveScore', {
        test_id: testId
      });
      
      if (response.data.code === 200) {
        const studentsData = response.data.data?.students || [];
        
        const allStudentsList: Student[] = [];
        
        studentsData.forEach((studentData: any) => {
          studentData.scores.forEach((score: any) => {
            allStudentsList.push({
              username: studentData.username,
              paper_id: score.paper_id,
              paper_name: score.paper_name,
              objective_score: score.objective_score || 0,
              subjective_score: score.subjective_score || 0,
              total_score: score.total_score || 0,
              correct_status: score.correct_status || 0,
              correct_status_text: score.correct_status_text || '未知状态'
            });
          });
        });
        
        setStudents(allStudentsList);
        setFilteredStudents(allStudentsList);
      } else {
        setError(response.data.message || '获取考生名单失败');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取考生作答详情
  const fetchStudentAnswers = async (username: string, paperId: string) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiClientWithToken.post('/back/api/study/test/get_answers_name_info', {
        test_id: testId,
        username: username,
        paper_id: paperId
      });
      
      if (response.data.code === 200) {
        const subjectiveQuestions = (response.data.data || []).map((q: any) => ({
          ...q,
          score: q.score || 0
        }));
        setQuestions(subjectiveQuestions);
      } else {
        setError(response.data.message || '获取考生作答失败');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取下一个需要批改的学生
  const getNextStudent = (currentStudent: Student | null) => {
    const currentIndex = currentStudent 
      ? filteredStudents.findIndex(s => 
          s.username === currentStudent.username && s.paper_id === currentStudent.paper_id
        )
      : -1;

    // 从下一个学生开始查找未批改的
    for (let i = currentIndex + 1; i < filteredStudents.length; i++) {
      if (filteredStudents[i].correct_status !== 2) { // 2表示已批改
        return filteredStudents[i];
      }
    }

    // 如果后面没有，从开头开始找
    for (let i = 0; i < currentIndex; i++) {
      if (filteredStudents[i].correct_status !== 2) {
        return filteredStudents[i];
      }
    }

    return null; // 所有学生都已批改
  };

  // 提交批改
  const submitCorrection = async () => {
    if (!selectedStudent) {
      setError('请选择考生');
      return;
    }

    const ungradedQuestions = questions.filter(q => q.score === 0);
    if (ungradedQuestions.length > 0) {
      setError('请为所有题目评分');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      
      const batchData = questions.map(q => ({
        question_id: q.question_id.toString().trim(),
        score: parseFloat(q.score.toString())
      }));

      const response = await apiClientWithToken.post('/back/api/study/test/batch_answers_name', {
        test_id: testId,
        username: selectedStudent.username,
        paper_id: selectedStudent.paper_id,
        batch_data: batchData
      });
      
      if (response.data.code === 200) {
        setSuccess(`批改提交成功！主观题得分：${response.data.data?.total_score || 0}分`);
        
        // 刷新学生列表
        await fetchAllStudentsList();
        
        // 自动跳转到下一个需要批改的学生
        setTimeout(async () => {
          const nextStudent = getNextStudent(selectedStudent);
          if (nextStudent) {
            setSelectedStudent(nextStudent);
            await fetchStudentAnswers(nextStudent.username, nextStudent.paper_id);
            setSuccess(`已自动跳转到下一个考生: ${nextStudent.username}`);
          } else {
            setSuccess('所有考生都已批改完成！');
          }
        }, 1000);
        
      } else {
        setError(response.data.message || '批改提交失败');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '网络请求失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 更新题目分数
  const updateQuestionScore = (questionId: string, score: number) => {
    setQuestions(prev => prev.map(q => 
      q.question_id === questionId ? { ...q, score } : q
    ));
  };

  // 计算当前主观题总分
  const currentSubjectiveScore = questions.reduce((sum, q) => sum + q.score, 0);
  const totalScore = (selectedStudent?.objective_score || 0) + currentSubjectiveScore;

  // 重置状态
  const handleClose = () => {
    setStudents([]);
    setFilteredStudents([]);
    setSelectedStudent(null);
    setQuestions([]);
    setError('');
    setSuccess('');
    setSearchTerm('');
    onClose();
  };

  // 选择学生
  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    await fetchStudentAnswers(student.username, student.paper_id);
  };

  useEffect(() => {
    if (open && testId && currentUsername) {
      fetchAllStudentsList();
    }
  }, [open, testId, currentUsername]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '95vh',
          minHeight: '700px',
          backgroundColor: getBackgroundColor(),
          color: getTextColor(),
          border: `1px solid ${getBorderColor()}`,
          boxShadow: theme.shadows[10]
        }
      }}
    >
      <DialogTitle sx={{ 
        backgroundColor: getPrimaryColor(),
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 2.5,
        borderBottom: `1px solid ${getBorderColor()}`
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <GradeIcon sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h5" component="div" fontWeight="bold">
              试卷批改系统
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              {testName}
            </Typography>
          </Box>
        </Box>
        <IconButton 
          onClick={handleClose} 
          sx={{ 
            color: 'white',
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, backgroundColor: getBackgroundColor() }}>
        {/* 消息提示 */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert 
            severity="success" 
            sx={{ mb: 3 }}
            onClose={() => setSuccess('')}
          >
            {success}
          </Alert>
        )}

        <Grid container spacing={3} justifyContent="center">
          {/* 左侧：考生选择面板 */}
          <Grid item xs={12} md={5}>
            <Card sx={{ 
              borderRadius: 2,
              backgroundColor: getSurfaceColor(),
              border: `1px solid ${getBorderColor()}`,
              boxShadow: theme.shadows[2],
              height: '100%'
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <PersonIcon sx={{ color: getPrimaryColor() }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: getPrimaryColor() }}>
                    考生选择
                  </Typography>
                </Box>

                {/* 搜索框 */}
                <TextField
                  fullWidth
                  size="small"
                  placeholder="搜索用户名或试卷名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 2 }}
                />
                
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: getPrimaryColor() }} />
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 250, overflow: 'auto', mb: 2 }}>
                    {filteredStudents.map((student) => (
                      <Chip
                        key={`${student.username}-${student.paper_id}`}
                        label={`${student.username}（${student.paper_name}）${student.correct_status === 2 ? '✓' : ''}`}
                        onClick={() => handleSelectStudent(student)}
                        color={
                          selectedStudent?.username === student.username && 
                          selectedStudent?.paper_id === student.paper_id ? 'primary' : 
                          student.correct_status === 2 ? 'success' : 'default'
                        }
                        variant={
                          selectedStudent?.username === student.username && 
                          selectedStudent?.paper_id === student.paper_id ? 'filled' : 'outlined'
                        }
                        sx={{ m: 0.5 }}
                        size="medium"
                      />
                    ))}
                    {filteredStudents.length === 0 && (
                      <Typography color={getSecondaryTextColor()} sx={{ py: 2, textAlign: 'center' }}>
                        {searchTerm ? '未找到匹配的考生' : '暂无考生数据'}
                      </Typography>
                    )}
                  </Box>
                )}

                <Divider sx={{ my: 3, borderColor: getBorderColor() }} />

                {/* 学生信息和成绩统计 */}
                {selectedStudent && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AssignmentIcon sx={{ color: getPrimaryColor(), fontSize: 20 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: getPrimaryColor() }}>
                        考生信息
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="body2" color={getSecondaryTextColor()}>用户名:</Typography>
                        <Typography variant="body2" fontWeight="bold">{selectedStudent.username}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="body2" color={getSecondaryTextColor()}>试卷:</Typography>
                        <Typography variant="body2" fontWeight="bold">{selectedStudent.paper_name}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color={getSecondaryTextColor()}>批改状态:</Typography>
                        <Typography 
                          variant="body2" 
                          fontWeight="bold"
                          color={selectedStudent.correct_status === 2 ? getSuccessColor() : getWarningColor()}
                        >
                          {selectedStudent.correct_status_text}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <ScoreIcon sx={{ color: getPrimaryColor(), fontSize: 20 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: getPrimaryColor() }}>
                        成绩统计
                      </Typography>
                    </Box>

                    <Box sx={{ 
                      p: 2, 
                      backgroundColor: 'rgba(76, 175, 80, 0.05)', 
                      borderRadius: 1,
                      border: `1px solid ${getSuccessColor()}20`
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="body2" color={getSecondaryTextColor()}>客观题:</Typography>
                        <Typography variant="body2" fontWeight="bold" color={getSuccessColor()}>
                          {selectedStudent.objective_score} 分
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="body2" color={getSecondaryTextColor()}>主观题:</Typography>
                        <Typography variant="body2" fontWeight="bold" color={getPrimaryColor()}>
                          {currentSubjectiveScore} 分
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color={getSecondaryTextColor()}>总分:</Typography>
                        <Typography variant="body2" fontWeight="bold" color={getWarningColor()}>
                          {totalScore} 分
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 1 }}>
                      <Typography variant="body2" color={getSecondaryTextColor()}>
                        主观题数量: {questions.length} 题
                      </Typography>
                      {questions.length > 0 && (
                        <Typography variant="body2" color={getSecondaryTextColor()} sx={{ mt: 0.5 }}>
                          满分: {questions.reduce((sum, q) => sum + q.highest_score, 0)} 分
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 右侧：题目批改区域 */}
          <Grid item xs={12} md={7}>
            <Card sx={{ 
              borderRadius: 2,
              backgroundColor: getSurfaceColor(),
              border: `1px solid ${getBorderColor()}`,
              boxShadow: theme.shadows[2],
              height: '100%'
            }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mb: 3,
                  p: 2,
                  backgroundColor: 'rgba(25, 118, 210, 0.05)',
                  borderRadius: 1
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: getPrimaryColor() }}>
                    主观题批改
                  </Typography>
                  {questions.length > 0 && (
                    <Chip 
                      label={`总分: ${currentSubjectiveScore}分`} 
                      sx={{ 
                        fontWeight: 600,
                        backgroundColor: getPrimaryColor(),
                        color: 'white'
                      }}
                    />
                  )}
                </Box>

                {loading && selectedStudent ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <CircularProgress sx={{ color: getPrimaryColor() }} />
                  </Box>
                ) : questions.length > 0 ? (
                  <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
                    {questions.map((question, index) => (
                      <Paper 
                        key={question.question_id} 
                        sx={{ 
                          mb: 3, 
                          p: 3,
                          backgroundColor: getSurfaceColor(),
                          border: `1px solid ${getBorderColor()}`,
                          borderRadius: 2
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 3 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: getPrimaryColor() }}>
                            第{index + 1}题
                          </Typography>
                          <Chip 
                            label={`满分: ${question.highest_score}分`} 
                            sx={{ 
                              backgroundColor: 'rgba(156, 39, 176, 0.1)',
                              color: getPrimaryColor()
                            }}
                            size="small"
                          />
                        </Box>

                        <Typography variant="body1" paragraph sx={{ 
                          fontWeight: 500, 
                          mb: 3,
                          color: getTextColor(),
                          lineHeight: 1.6
                        }}>
                          {question.question}
                        </Typography>

                        <Box sx={{ 
                          mb: 3, 
                          p: 3, 
                          backgroundColor: 'rgba(0, 0, 0, 0.02)',
                          borderRadius: 2, 
                          border: `1px solid ${getBorderColor()}`
                        }}>
                          <Typography variant="subtitle2" sx={{ 
                            fontWeight: 600, 
                            mb: 2, 
                            color: getPrimaryColor()
                          }}>
                            考生答案:
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            whiteSpace: 'pre-wrap', 
                            lineHeight: 1.6,
                            color: getTextColor()
                          }}>
                            {question.answer || '（未作答）'}
                          </Typography>
                        </Box>

                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 3, 
                          flexWrap: 'wrap',
                          p: 2,
                          backgroundColor: 'rgba(25, 118, 210, 0.03)',
                          borderRadius: 2
                        }}>
                          <Typography variant="body1" sx={{ fontWeight: 600, color: getTextColor() }}>
                            评分:
                          </Typography>
                          <Rating
                            value={question.score}
                            onChange={(event, newValue) => {
                              updateQuestionScore(question.question_id, newValue || 0);
                            }}
                            max={question.highest_score}
                            size="large"
                            sx={{ color: getPrimaryColor() }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            value={question.score}
                            onChange={(e) => {
                              const score = Math.max(0, Math.min(question.highest_score, Number(e.target.value)));
                              updateQuestionScore(question.question_id, score);
                            }}
                            inputProps={{
                              min: 0,
                              max: question.highest_score,
                              step: 0.5
                            }}
                            sx={{ width: 80 }}
                            label="分数"
                          />
                          <Typography variant="body1" sx={{ 
                            fontWeight: 600,
                            color: question.score > 0 ? getSuccessColor() : getTextColor()
                          }}>
                            {question.score} / {question.highest_score}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    flex: 1,
                    flexDirection: 'column',
                    color: getSecondaryTextColor(),
                    p: 4
                  }}>
                    <GradeIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" gutterBottom>
                      {selectedStudent ? '暂无主观题数据' : '请选择考生开始批改'}
                    </Typography>
                    <Typography variant="body2" textAlign="center">
                      {selectedStudent ? '该考生没有需要批改的主观题' : '从左侧选择需要批改的考生'}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ 
        p: 3, 
        justifyContent: 'space-between', 
        backgroundColor: getBackgroundColor(),
        borderTop: `1px solid ${getBorderColor()}`
      }}>
        <Box>
          {selectedStudent && (
            <Typography variant="body2" sx={{ 
              fontWeight: 500,
              color: getSecondaryTextColor()
            }}>
              考生: <span style={{ color: getTextColor() }}>{selectedStudent.username}</span> | 
              试卷: <span style={{ color: getTextColor() }}>{selectedStudent.paper_name}</span> | 
              客观题: <span style={{ color: getSuccessColor() }}>{selectedStudent.objective_score}分</span> | 
              主观题: <span style={{ color: getPrimaryColor() }}>{currentSubjectiveScore}分</span> | 
              总分: <span style={{ color: getWarningColor(), fontWeight: 'bold' }}>{totalScore}分</span>
            </Typography>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            onClick={handleClose} 
            variant="outlined"
          >
            取消
          </Button>
          <Button
            onClick={submitCorrection}
            variant="contained"
            disabled={submitting || questions.length === 0 || !selectedStudent}
            startIcon={submitting ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
          >
            {submitting ? '提交中...' : '提交批改'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default TestCorrectionDialog;