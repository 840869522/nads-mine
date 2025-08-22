import React, { useState, useEffect } from 'react';
import { 
  Box, TextField, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, 
  LinearProgress, Pagination, Grid, Tooltip, Button,
  Tabs, Tab,
  Card, CardContent, CardActions, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, 
  DialogActions, Radio, RadioGroup, FormControlLabel, 
  Checkbox, FormGroup, FormControl, FormLabel, 
  Backdrop, Snackbar, Alert, Input, IconButton
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
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
  Timer as TimerIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import '@/node_modules/moment/locale/zh-cn';
import { useTheme } from '@mui/material/styles';

// 应用中文本地化
moment.locale('zh-cn');

// 理论测试答题界面组件（导航栏固定顶部版）
const TheoreticalTestPage = ({ test, onBack }: { test: any; onBack: () => void }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // 状态管理
  const [view, setView] = useState('intro'); // intro | test | result
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [answers, setAnswers] = useState<any>({});
  const [submitted, setSubmitted] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('success');
  
  // 动态颜色函数（蓝色系主题）
  const getCardBgColor = () => isDarkMode ? '#121212' : '#ffffff';
  const getTextColor = () => isDarkMode ? '#f0f0f0' : '#212121';
  const getSecondaryTextColor = () => isDarkMode ? '#bbbbbb' : '#757575';
  const getButtonColor = () => isDarkMode ? '#2196f3' : '#1976d2';
  const getHeaderBgColor = () => isDarkMode ? '#1e1e1e' : '#f5f5f5';
  const getQuestionBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getAccentColor = () => isDarkMode ? '#2196f3' : '#1976d2';
  const getErrorColor = () => isDarkMode ? '#ef5350' : '#d32f2f';
  
  // 模拟试卷数据
  const testPaper = {
    id: test.c_id,
    title: test.c_name,
    duration: test.c_test_type === '考试' ? 60 : null,
    questions: [
      {
        id: 'q1',
        type: 'single',
        text: '在计算机网络中，HTTP协议默认使用的端口号是多少？',
        options: [
          { id: 'a', text: '80' },
          { id: 'b', text: '443' },
          { id: 'c', text: '21' },
          { id: 'd', text: '25' }
        ],
        correctAnswer: 'a',
        explanation: 'HTTP协议默认使用80端口，HTTPS使用443端口。'
      },
      {
        id: 'q2',
        type: 'multiple',
        text: '以下哪些是关系型数据库？（多选）',
        options: [
          { id: 'a', text: 'MySQL' },
          { id: 'b', text: 'MongoDB' },
          { id: 'c', text: 'PostgreSQL' },
          { id: 'd', text: 'Redis' }
        ],
        correctAnswer: ['a', 'c'],
        explanation: 'MySQL和PostgreSQL是关系型数据库，MongoDB和Redis是非关系型数据库。'
      },
      {
        id: 'q3',
        type: 'text',
        text: '请简述RESTful API的设计原则。',
        correctAnswer: 'RESTful API的设计原则包括：无状态、统一接口、资源导向、使用HTTP方法表达操作等。'
      },
      {
        id: 'q4',
        type: 'single',
        text: '以下哪个不是JavaScript的数据类型？',
        options: [
          { id: 'a', text: 'Symbol' },
          { id: 'b', text: 'Tuple' },
          { id: 'c', text: 'Undefined' },
          { id: 'd', text: 'BigInt' }
        ],
        correctAnswer: 'b',
        explanation: 'JavaScript的数据类型包括：String, Number, Boolean, Null, Undefined, Symbol, BigInt。Tuple不是JavaScript的原生数据类型。'
      }
    ]
  };
  
  // 初始化答案状态
  useEffect(() => {
    const savedAnswers = localStorage.getItem(`test_answers_${test.c_id}`);
    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
      setSnackbarMessage('已恢复上次保存的答题进度');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    }
  }, [test.c_id]);
  
  // 保存答案到localStorage
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`test_answers_${test.c_id}`, JSON.stringify(answers));
    }
  }, [answers, test.c_id]);
  
  // 开始测试处理函数
  const handleStartTest = () => {
    setView('test');
    if (testPaper.duration) {
      setTimeLeft(testPaper.duration * 60);
    }
  };
  
  // 倒计时效果
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return;
    
    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
      if (timeLeft === 1) {
        handleSubmit();
        setSnackbarMessage('考试时间已到，已自动提交试卷');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [timeLeft, submitted]);
  
  // 处理答案变化
  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev: any) => ({
      ...prev,
      [questionId]: value
    }));
  };
  
  // 提交试卷
  const handleSubmit = () => {
    setSubmitted(true);
    localStorage.removeItem(`test_answers_${test.c_id}`);
    
    if (test.c_test_type === '考试') {
      setView('result');
      setSnackbarMessage('考试已成功提交');
    } else {
      setSnackbarMessage('练习已提交，请查看答案');
    }
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };
  
  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 检查答案是否正确
  const isAnswerCorrect = (question: any) => {
    const userAnswer = answers[question.id];
    if (!userAnswer) return false;
    
    if (question.type === 'single') {
      return userAnswer === question.correctAnswer;
    } else if (question.type === 'multiple') {
      return Array.isArray(userAnswer) && 
             userAnswer.length === question.correctAnswer.length &&
             userAnswer.every((ans: string) => question.correctAnswer.includes(ans));
    }
    return false;
  };
  
  // 关闭提示框
  const handleSnackbarClose = () => setSnackbarOpen(false);
  
  // 返回按钮处理
  const handleBackClick = () => {
    if (view === 'test' && !submitted) {
      if (window.confirm('确定要退出吗？未提交的答案将不会被保存')) {
        onBack();
      }
    } else {
      onBack();
    }
  };
  
  // 全屏容器样式
  const fullscreenContainerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    overflow: 'auto',
    backgroundColor: getCardBgColor()
  };
  
  return (
    <Box sx={fullscreenContainerStyle}>
      {/* 测试介绍视图 */}
      {view === 'intro' && (
        <Box 
          sx={{ 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 2
          }}
        >
          <Paper sx={{ 
            p: 4, 
            borderRadius: 2,
            backgroundColor: getQuestionBgColor(),
            color: getTextColor(),
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: 700,
            width: '100%',
            textAlign: 'center'
          }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3, color: getAccentColor() }}>
              {test.c_name}
            </Typography>
            
            <Box sx={{ 
              backgroundColor: getHeaderBgColor(),
              p: 3, 
              borderRadius: 2, 
              mb: 4,
              textAlign: 'left'
            }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body1" sx={{ display: 'flex', mb: 1.5 }}>
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>测试ID:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor() }}>{test.c_id}</Box>
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" sx={{ display: 'flex', mb: 1.5 }}>
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>类型:</Box> 
                    <Chip 
                      label={test.c_test_type} 
                      size="small" 
                      color={test.c_test_type === '考试' ? 'primary' : 'secondary'}
                      sx={{ borderRadius: 1 }}
                    />
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body1" sx={{ display: 'flex', mb: 1.5 }}>
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>开始时间:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor() }}>
                      {moment(test.c_start).format('YYYY-MM-DD')}
                    </Box>
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" sx={{ display: 'flex', mb: 1.5 }}>
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>结束时间:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor() }}>
                      {moment(test.c_end).format('YYYY-MM-DD')}
                    </Box>
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ display: 'flex', mb: 1.5 }}>
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>考试时长:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor() }}>
                      {testPaper.duration ? `${testPaper.duration} 分钟` : '不限时'}
                    </Box>
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ mb: 1.5 }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>描述:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor(), ml: 1 }}>
                      {test.c_description}
                    </Box>
                  </Typography>
                </Grid>
              </Grid>
            </Box>
            
            <Box sx={{ mb: 4 }}>
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                p: 2,
                backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.1)',
                borderRadius: 2,
                mb: 3
              }}>
                <MenuBookIcon sx={{ color: getAccentColor(), mr: 1.5, fontSize: 24 }} />
                <Typography variant="body1" fontWeight="bold">
                  本次测试包含 {testPaper.questions.length} 道题目
                </Typography>
              </Box>
            </Box>
            
            <Button 
              variant="contained"
              size="medium"
              onClick={handleStartTest}
              startIcon={<PlayArrowIcon />}
              sx={{
                backgroundColor: getAccentColor(),
                '&:hover': { backgroundColor: isDarkMode ? '#1976d2' : '#0d47a1' },
                fontWeight: 600,
                fontSize: '0.9rem',
                px: 4,
                py: 1,
                borderRadius: 1,
                mb: 3
              }}
            >
              开始测试
            </Button>
            
            <Typography variant="body2" color={getSecondaryTextColor()} sx={{ mb: 2 }}>
              {test.c_test_type === '考试' ? 
                '请注意：考试有时间限制，中途退出将不会保存答案' : 
                '练习模式不限时，提交后可查看正确答案'}
            </Typography>
            
            <Button 
              startIcon={<ArrowBackIcon />} 
              onClick={handleBackClick}
              sx={{ 
                color: getButtonColor(),
                '&:hover': { backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(25, 118, 210, 0.1)' }
              }}
            >
              返回上一级
            </Button>
          </Paper>
        </Box>
      )}
      
      {/* 考试提交成功视图 */}
      {view === 'result' && (
        <Box 
          sx={{ 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 2
          }}
        >
          <Paper sx={{ 
            p: 4, 
            borderRadius: 2,
            backgroundColor: getQuestionBgColor(),
            color: getTextColor(),
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
            maxWidth: 500,
            width: '100%',
            textAlign: 'center'
          }}>
            <CheckCircleOutlineIcon sx={{ 
              fontSize: 60, 
              color: getAccentColor(), 
              mb: 3,
              mx: 'auto'
            }} />
            
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 2 }}>
              考试已提交
            </Typography>
            
            <Typography variant="body1" color={getSecondaryTextColor()} sx={{ mb: 4 }}>
              您的试卷已成功提交，成绩将在批改完成后公布
            </Typography>
            
            <Button 
              variant="contained"
              size="medium"
              onClick={onBack}
              startIcon={<ArrowBackIcon />}
              sx={{
                backgroundColor: getAccentColor(),
                '&:hover': { backgroundColor: isDarkMode ? '#1976d2' : '#0d47a1' },
                fontWeight: 600,
                fontSize: '0.9rem',
                px: 4,
                py: 1,
                borderRadius: 1,
                mb: 2
              }}
            >
              返回上一级
            </Button>
          </Paper>
        </Box>
      )}
      
      {/* 测试进行中视图（导航栏固定顶部） */}
      {view === 'test' && (
        <Box sx={{ 
          minHeight: '100vh',
          color: getTextColor(),
          p: 0,
          width: '100%',
          overflowX: 'hidden',
          position: 'relative',
          boxSizing: 'border-box'
        }}>
          {/* 顶部导航栏 - 固定在顶部，始终可见 */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            backgroundColor: getHeaderBgColor(),
            borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
            position: 'fixed', // 固定定位
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000, // 确保在内容之上
            height: 56
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* 返回按钮 */}
              <Button 
                startIcon={<ArrowBackIcon />} 
                onClick={handleBackClick}
                sx={{ 
                  color: getButtonColor(),
                  '&:hover': { backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(25, 118, 210, 0.1)' },
                  p: '8px 12px',
                  mr: 1
                }}
              >
                返回
              </Button>
              <Typography variant="body1" fontWeight="600" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {test.c_name}
              </Typography>
              <Chip 
                label={test.c_test_type} 
                size="small" 
                color={test.c_test_type === '考试' ? 'primary' : 'secondary'}
                sx={{ ml: 2, borderRadius: 1 }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {timeLeft !== null && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  backgroundColor: timeLeft < 300 ? (isDarkMode ? '#d32f2f33' : '#ffebee') : (isDarkMode ? '#1976d222' : '#e3f2fd'),
                  px: 2,
                  py: 0.5,
                  borderRadius: 1,
                  mr: 2,
                  color: timeLeft < 300 ? getErrorColor() : getTextColor()
                }}>
                  <TimerIcon sx={{ mr: 1, fontSize: '1rem' }} />
                  <Typography variant="body1" fontWeight="600">
                    {formatTime(timeLeft)}
                  </Typography>
                </Box>
              )}
              
              {/* 提交试卷按钮（右上角） */}
              <Button 
                variant="contained"
                size="small"
                onClick={handleSubmit}
                sx={{
                  backgroundColor: getAccentColor(),
                  '&:hover': { backgroundColor: isDarkMode ? '#1976d2' : '#0d47a1' },
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  px: 3,
                  py: 0.5,
                  borderRadius: 1,
                  boxShadow: 'none'
                }}
              >
                提交试卷
              </Button>
            </Box>
          </Box>
          
          {/* 试题列表 - 为固定导航栏预留顶部空间 */}
          <Box sx={{ 
            width: '100%',
            minHeight: 'calc(100vh - 56px)', // 减去导航栏高度
            pt: 4, // 为固定导航栏预留空间
            pb: 4,
            p: { xs: 2, md: 10 },
            maxWidth: '100%',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}>
            <Box sx={{
              maxWidth: 1000,
              width: '100%',
              margin: '0 auto'
            }}>
              {testPaper.questions.map((question, index) => (
                <Paper 
                  key={question.id}
                  sx={{ 
                    p: { xs: 2, md: 3 }, 
                    borderRadius: 1,
                    backgroundColor: getQuestionBgColor(),
                    borderLeft: `3px solid ${getAccentColor()}`,
                    mb: 3,
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{
                      minWidth: 26,
                      height: 26,
                      borderRadius: 1,
                      backgroundColor: getAccentColor(),
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      mt: 0.5,
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </Box>
                    <Typography variant="body1" fontWeight="600" sx={{ flexGrow: 1 }}>
                      {question.text}
                    </Typography>
                  </Box>
                  
                  {/* 单选题 */}
                  {question.type === 'single' && (
                    <FormControl component="fieldset" sx={{ width: '100%', mt: 1 }}>
                      <RadioGroup
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        disabled={submitted && test.c_test_type === '练习'}
                      >
                        {question.options.map((option) => (
                          <FormControlLabel
                            key={option.id}
                            value={option.id}
                            control={<Radio color="primary" size="small" />}
                            label={
                              <Typography variant="body2" sx={{ color: getTextColor() }}>
                                {option.text}
                              </Typography>
                            }
                            sx={{ 
                              mb: 1,
                              borderRadius: 1,
                              p: 1.5,
                              backgroundColor: isDarkMode ? '#252525' : '#f9f9f9',
                              '&:hover': {
                                backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f0f0'
                              },
                              '& .MuiFormControlLabel-label': {
                                marginLeft: 1
                              }
                            }}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  )}
                  
                  {/* 多选题 */}
                  {question.type === 'multiple' && (
                    <FormGroup sx={{ mt: 1 }}>
                      {question.options.map((option) => (
                        <FormControlLabel
                          key={option.id}
                          control={
                            <Checkbox 
                              color="primary" 
                              size="small"
                              checked={answers[question.id]?.includes(option.id) || false}
                              onChange={(e) => {
                                const newValue = answers[question.id] || [];
                                if (e.target.checked) {
                                  handleAnswerChange(question.id, [...newValue, option.id]);
                                } else {
                                  handleAnswerChange(question.id, newValue.filter((v: string) => v !== option.id));
                                }
                              }}
                              disabled={submitted && test.c_test_type === '练习'}
                            />
                          }
                          label={
                            <Typography variant="body2" sx={{ color: getTextColor() }}>
                              {option.text}
                            </Typography>
                          }
                          sx={{ 
                            mb: 1,
                            borderRadius: 1,
                            p: 1.5,
                            backgroundColor: isDarkMode ? '#252525' : '#f9f9f9',
                            '&:hover': {
                              backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f0f0'
                            },
                            '& .MuiFormControlLabel-label': {
                              marginLeft: 1
                            }
                          }}
                        />
                      ))}
                    </FormGroup>
                  )}
                  
                  {/* 文本题 */}
                  {question.type === 'text' && (
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      variant="outlined"
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder="请输入您的答案..."
                      sx={{ 
                        mt: 1,
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: isDarkMode ? '#444' : '#ddd'
                          },
                          '& textarea': {
                            fontSize: '0.9rem',
                            color: getTextColor()
                          }
                        }
                      }}
                      disabled={submitted && test.c_test_type === '练习'}
                    />
                  )}
                  
                  {/* 练习提交后显示正确答案 */}
                  {submitted && test.c_test_type === '练习' && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${isDarkMode ? '#444' : '#ddd'}` }}>
                      <Typography variant="body2" fontWeight="600" sx={{ mb: 1, color: getAccentColor() }}>
                        参考答案:
                      </Typography>
                      
                      {question.type === 'text' ? (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: getTextColor(),
                            backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.1)',
                            p: 2,
                            borderRadius: 1,
                            fontSize: '0.9rem'
                          }}
                        >
                          {question.correctAnswer}
                        </Typography>
                      ) : (
                        <Box>
                          {question.type === 'single' && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: getAccentColor(),
                                fontWeight: 500,
                                p: 1,
                                backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.05)' : 'rgba(33, 150, 243, 0.05)',
                                borderRadius: 1
                              }}
                            >
                              {question.options.find((opt: any) => opt.id === question.correctAnswer)?.text}
                            </Typography>
                          )}
                          
                          {question.type === 'multiple' && (
                            <Box sx={{ 
                              backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.05)' : 'rgba(33, 150, 243, 0.05)',
                              p: 1,
                              borderRadius: 1
                            }}>
                              {question.correctAnswer.map((ansId: string) => (
                                <Typography 
                                  key={ansId}
                                  variant="body2" 
                                  sx={{ 
                                    color: getAccentColor(),
                                    fontWeight: 500,
                                    mb: 0.5
                                  }}
                                >
                                  {question.options.find((opt: any) => opt.id === ansId)?.text}
                                </Typography>
                              ))}
                            </Box>
                          )}
                          
                          {!isAnswerCorrect(question) && question.type !== 'text' && (
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: getErrorColor(),
                                mt: 1,
                                fontStyle: 'italic',
                                fontSize: '0.85rem'
                              }}
                            >
                              (您的答案不正确)
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              ))}
            </Box>
          </Box>
        </Box>
      )}
      
      {/* 提示框 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

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
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'practical' | 'theoretical'
  const [currentTest, setCurrentTest] = useState<any>(null);
  // 新增：当前激活的标签页（默认显示实践操作）
  const [activeTab, setActiveTab] = useState<'practical' | 'theoretical'>('practical');

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
    
    // 模拟获取测试数据 - 新增c_test_type字段
    setTimeout(() => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        c_id: `test-${i + 1}`,
        c_name: `测试 ${i + 1}`,
        c_description: `这是测试 ${i + 1} 的描述信息，用于评估学生相关知识掌握情况`,
        c_start: moment().subtract(Math.random() * 30, 'days').toDate(),
        c_end: moment().add(Math.random() * 30, 'days').toDate(),
        c_create_at: moment().subtract(Math.random() * 100, 'days').toDate(),
        c_course_id: `C${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
        // 随机分配测试类型
        c_type: Math.random() > 0.5 ? '实践操作' : '理论测试',
        // 新增测试形式（考试/练习）
        c_test_type: Math.random() > 0.5 ? '考试' : '练习'
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

  // 切换标签页
  const handleTabChange = (event: React.SyntheticEvent, newValue: 'practical' | 'theoretical') => {
    setActiveTab(newValue);
    // 切换时重置对应标签页的页码
    if (newValue === 'practical') {
      setPagePractical(1);
    } else {
      setPageTheoretical(1);
    }
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
  const handleEnterTest = (test: any) => {
    setCurrentTest(test);
    if (test.c_type === '实践操作') {
      setCurrentView('practical');
    } else {
      setCurrentView('theoretical');
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setCurrentTest(null);
  };

  // 渲染测试表格的函数
  const renderTestTable = (tests: any[], page: number, setPage: React.Dispatch<React.SetStateAction<number>>, pageCount: number) => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
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
                <TableCell sx={{ fontWeight: 600, color: getHeaderTextColor() }}>描述</TableCell>
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
                    <TableCell>
                      <Chip 
                        label={test.c_test_type} 
                        size="small" 
                        color={test.c_test_type === '考试' ? 'primary' : 'secondary'}
                        sx={{ borderRadius: 1, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, color: getTextColor() }}>{test.c_description}</TableCell>
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
                            onClick={() => handleEnterTest(test)}
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
      </Box>
    );
  };

  // 根据当前视图渲染不同内容
  if (currentView === 'practical' && currentTest) {
    return <PracticalTestPage testId={currentTest.c_id} onBack={handleBackToList} />;
  }
  
  if (currentView === 'theoretical' && currentTest) {
    return <TheoreticalTestPage test={currentTest} onBack={handleBackToList} />;
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
            value="practical" 
            label={
              <Box display="flex" alignItems="center">
                <CodeIcon sx={{ mr: 1, fontSize: 18 }} />
                实践操作
              </Box>
            } 
          />
          <Tab 
            value="theoretical" 
            label={
              <Box display="flex" alignItems="center">
                <MenuBookIcon sx={{ mr: 1, fontSize: 18 }} />
                理论测试
              </Box>
            } 
          />
        </Tabs>
      </Box>
      
      {loading && <LinearProgress />}
      
      {/* 根据激活的标签页显示对应内容 */}
      {activeTab === 'practical' && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
          </Typography>
          {renderTestTable(paginatedPracticalTests, pagePractical, setPagePractical, practicalPageCount)}
        </Box>
      )}
      
      {activeTab === 'theoretical' && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
          </Typography>
          {renderTestTable(paginatedTheoreticalTests, pageTheoretical, setPageTheoretical, theoreticalPageCount)}
        </Box>
      )}
    </Paper>
  );
};

export default TestManagement_user;