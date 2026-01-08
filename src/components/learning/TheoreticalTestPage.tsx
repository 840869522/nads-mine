import React, { useState, useEffect } from 'react';
import { 
  Box, TextField, Typography, Paper, 
  Button, FormControl, RadioGroup, 
  FormControlLabel, Radio, Checkbox, FormGroup,
  CircularProgress, Snackbar, Alert,
  Chip, Grid
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  Timer as TimerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import moment from 'moment';

interface TheoryTestApi {
  getExamPaper: (testId: string, username: string, testType: string) => Promise<any>;
  submitPaper: (params: any) => Promise<any>;
}

interface TheoryTestProps {
  test: {
    test_id: string;
    c_name: string;
    c_type: '考试' | '练习';
    test_start: string;
    test_end: string;
    c_description: string;
    duration: number;
    c_paper_id: string;
  };
  onBack: () => void;
  theoryTestApi: TheoryTestApi;
  mapFrontendTypeToBackend: (type: 'single' | 'multiple' | 'judgment' | 'text') => number;
}

interface PaperQuestion {
  id: string;
  type: 'single' | 'multiple' | 'judgment' | 'text';
  content: string;
  options?: Array<{ optionId: string; content: string }>;
  answer?: string | string[];
  score: number;
}

interface PaperData {
  paperId: string;
  testId: string;
  duration: number;
  totalScore: number;
  questionCount: number;
  questions: PaperQuestion[];
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

const TheoreticalTestPage = ({ test, onBack, theoryTestApi, mapFrontendTypeToBackend = (type) => {
  const typeMap = {
    'single': 1,
    'multiple': 2,
    'judgment': 3,
    'text': 4
  };
  return typeMap[type] || 1;
} }: TheoryTestProps) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [view, setView] = useState<'intro' | 'test' | 'result'>('intro');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paperData, setPaperData] = useState<PaperData | null>(null);
  const [objectiveScore, setObjectiveScore] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'info'
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ code?: number | string; message?: string; input?: any } | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [hasObjectiveQuestions, setHasObjectiveQuestions] = useState<boolean>(false);
  const [objectiveTotalScore, setObjectiveTotalScore] = useState<number>(0);

  const getCardBgColor = () => isDarkMode ? '#121212' : '#ffffff';
  const getTextColor = () => isDarkMode ? '#f0f0f0' : '#212121';
  const getSecondaryTextColor = () => isDarkMode ? '#bbbbbb' : '#757575';
  const getButtonColor = () => isDarkMode ? '#2196f3' : '#1976d2';
  const getHeaderBgColor = () => isDarkMode ? '#1e1e1e' : '#f5f5f5';
  const getQuestionBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getAccentColor = () => isDarkMode ? '#2196f3' : '#1976d2';
  const getErrorColor = () => isDarkMode ? '#ef5350' : '#d32f2f';
  const getSuccessColor = () => isDarkMode ? '#4caf50' : '#388e3c';

  useEffect(() => {
    try {
      const droneSimUserStr = localStorage.getItem('droneSimUser');
      if (droneSimUserStr) {
        const droneSimUser = JSON.parse(droneSimUserStr);
        const username = droneSimUser?.user?.c_username || '';
        setCurrentUsername(username);
        if (!username) {
          setError('未找到用户信息，请重新登录');
          setErrorDetails({ message: '未找到用户信息，请重新登录' });
          showSnackbar('未找到用户信息，请重新登录', 'error');
        }
      } else {
        setError('用户未登录，请重新登录');
        setErrorDetails({ message: '用户未登录，请重新登录' });
        showSnackbar('用户未登录，请重新登录', 'error');
      }
    } catch (err) {
      setError('用户信息解析失败，请重新登录');
      setErrorDetails({ message: '用户信息解析失败，请重新登录' });
      showSnackbar('用户信息解析失败，请重新登录', 'error');
    }
  }, []);

  useEffect(() => {
    if (view !== 'intro') return;
    if (!currentUsername) {
      return;
    }
    if (!test.c_paper_id || !test.c_paper_id.trim()) {
      setError('试卷ID不存在，无法加载试卷');
      setErrorDetails({ message: '试卷ID不存在，无法加载试卷' });
      showSnackbar('试卷ID不存在，无法加载试卷', 'error');
      return;
    }

    const fetchPaper = async () => {
      try {
        setLoading(true);
        setError(null);
        setErrorDetails(null);

        const res: ApiResponse = await theoryTestApi.getExamPaper(
          test.test_id,
          currentUsername,
          test.c_type
        );

        if (!res || typeof res !== 'object' || res.code === undefined) {
          throw new Error('无效的响应格式');
        }

        if (res.code !== 200) {
          setErrorDetails({ code: res.code, message: res.message });
          throw new Error(res.message || `获取试卷失败 (错误码: ${res.code})`);
        }

        if (!res.data) {
          throw new Error('响应中未包含试卷数据');
        }

        const formattedPaper: PaperData = {
          paperId: res.data.paperInfo?.paperId || test.c_paper_id,
          testId: res.data.testInfo?.testId || test.test_id,
          duration: res.data.paperInfo?.duration || test.duration || 60,
          totalScore: res.data.paperInfo?.totalScore || 0,
          questionCount: res.data.paperInfo?.questionCount || 0,
          questions: res.data.questions || []
        };

        if (!formattedPaper.paperId) {
          throw new Error('试卷ID不存在');
        }

        if (!formattedPaper.questions || formattedPaper.questions.length === 0) {
          throw new Error('试卷中没有题目，请联系管理员');
        }

        // 检查是否有客观题
        const hasObjective = formattedPaper.questions.some(q => 
          q.type === 'single' || q.type === 'multiple' || q.type === 'judgment'
        );
        setHasObjectiveQuestions(hasObjective);

        // 计算客观题总分（单选题、多选题、判断题） - 在这里计算
        const objectiveScoreTotal = formattedPaper.questions.reduce((total, question) => {
          // 判断是否为客观题
          if (question.type === 'single' || question.type === 'multiple' || question.type === 'judgment') {
            return total + (question.score || 0);
          }
          return total;
        }, 0);
        
        setObjectiveTotalScore(objectiveScoreTotal); // 在这里设置客观题总分

        formattedPaper.questions.forEach((question, index) => {
          if (!question.id || !question.type || !question.content || !question.score) {
            throw new Error(`试卷题目 ${question.id || index + 1} 格式错误`);
          }
          if ((question.type === 'single' || question.type === 'multiple') && (!question.options || question.options.length === 0)) {
            throw new Error(`题目 ${question.id} 缺少选项`);
          }
        });

        setPaperData(formattedPaper);
        showSnackbar('试卷加载成功', 'success');
      } catch (err: any) {
        const errorMsg = err.response?.data?.message || err.message || '网络异常，无法获取试卷';
        setError(errorMsg);
        setErrorDetails({ 
          code: err.code || err.response?.data?.code || '未知',
          message: errorMsg,
          input: err.response?.data?.input || {}
        });
        showSnackbar(`${errorMsg} (错误码: ${err.code || err.response?.data?.code || '未知'})`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchPaper();
  }, [view, test.test_id, test.c_type, test.c_paper_id, test.duration, currentUsername, theoryTestApi]);

  useEffect(() => {
    if (!paperData || view !== 'intro' || submitted) return;

     // 练习模式不进行时间检查
    if (test.c_type === '练习') {
      return;
    }

    const savedStartTime = localStorage.getItem(`test_start_time_${test.test_id}`);
    const totalDuration = paperData.duration * 60;

    if (savedStartTime) {
      const start = parseInt(savedStartTime, 10);
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = totalDuration - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
        handleSubmit();
        showSnackbar('考试时间已到，已自动提交试卷', 'info');
      } else {
        setTimeLeft(remaining);
        setStartTime(start);
      }
    } else {
      setTimeLeft(totalDuration);
    }
  }, [paperData, view, test.test_id, submitted]);

  useEffect(() => {
    if (view === 'test' && timeLeft !== null && startTime === null && !submitted) {
      const newStartTime = Date.now();
      setStartTime(newStartTime);
      localStorage.setItem(`test_start_time_${test.test_id}`, newStartTime.toString());
    }
  }, [view, test.test_id, timeLeft, startTime, submitted]);

  useEffect(() => {
    if (test.c_type === '练习') return;
  
  if (timeLeft === null || timeLeft <= 0 || submitted || !startTime) return;
  
  const totalDuration = paperData ? paperData.duration * 60 : test.duration * 60;
  const updateTimeLeft = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = totalDuration - elapsed;
    if (remaining <= 0) {
      setTimeLeft(0);
      handleSubmit();
      showSnackbar('考试时间已到，已自动提交试卷', 'info');
    } else {
      setTimeLeft(remaining);
    }
  };

  const timer = setInterval(updateTimeLeft, 1000);

  return () => clearInterval(timer);
}, [startTime, submitted, view, paperData, test.duration, test.c_type]);

  useEffect(() => {
    const savedAnswers = localStorage.getItem(`test_answers_${test.test_id}`);
    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers));
        showSnackbar('已恢复上次保存的答题进度', 'success');
      } catch (e) {
      }
    }
  }, [test.test_id]);

  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`test_answers_${test.test_id}`, JSON.stringify(answers));
    }
  }, [answers, test.test_id]);

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    let submitParams: any = {};
    try {
      setLoading(true);

      if (!paperData) {
        throw new Error('试卷数据未加载');
      }
      if (!paperData.questions || paperData.questions.length === 0) {
        throw new Error('试卷题目为空，无法提交');
      }
      if (!currentUsername) {
        throw new Error('用户未登录，无法提交');
      }
      if (submitted && test.c_type === '考试') {
        throw new Error('试卷已提交，无法重复提交');
      }

      const answerGroups: Array<{
        type: number;
        data: Array<{ question_id: string; answer: string }>;
      }> = [];

      const typeMap: Record<number, Array<{ question_id: string; answer: string }>> = { 1: [], 2: [], 3: [], 4: [] };
      
      paperData.questions.forEach(question => {
        const backendType = mapFrontendTypeToBackend(question.type);
        const userAnswer = answers[question.id];
        
        if (!userAnswer) {
          return;
        }

        if (!paperData.questions.some(q => q.id === question.id)) {
          return;
        }

        if (question.id === '1') {
          return;
        }

        let formattedAnswer: string;
        if (question.type === 'multiple') {
          formattedAnswer = Array.isArray(userAnswer)
            ? userAnswer
                .map(id => {
                  const option = question.options?.find(opt => opt.optionId === id);
                  if (!option) {
                    return null;
                  }
                  return option.content;
                })
                .filter(Boolean)
                .join(';')
            : userAnswer.toString();
        } else if (question.type === 'single') {
          const option = question.options?.find(opt => opt.optionId === userAnswer);
          if (!option) {
            return;
          }
          formattedAnswer = option.content;
        } else {
          formattedAnswer = userAnswer.toString();
        }

        if (!formattedAnswer) {
          return;
        }

        typeMap[backendType].push({
          question_id: question.id,
          answer: formattedAnswer
        });
      });

      Object.entries(typeMap).forEach(([type, data]) => {
        if (data.length > 0) {
          answerGroups.push({
            type: Number(type),
            data
          });
        }
      });

      // if (answerGroups.length === 0) {
      //   showSnackbar('没有提交任何答案，请至少回答一道题目', 'error');
      //   setLoading(false);
      //   return;
      // }

      submitParams = {
        test_id: test.test_id,
        username: currentUsername,
        paper_id: paperData.paperId,
        answers: answerGroups
      };
      

    const res = await theoryTestApi.submitPaper(submitParams);

    
    if (!res || typeof res !== 'object' || res.code !== 200) {
      throw new Error(res?.message || `交卷失败 (错误码: ${res?.code || '未知'})`);
    }

    if (res.data === undefined) {
      throw new Error('交卷响应数据不完整');
    }

    setSubmitted(true);
    setObjectiveScore(res.data.objective_score);
    setCorrectCount(res.data.correct_count);
    
    // 如果是考试模式，清除保存的答案和开始时间
    if (test.c_type === '考试') {
      localStorage.removeItem(`test_answers_${test.test_id}`);
      localStorage.removeItem(`test_start_time_${test.test_id}`);
    }
    
    if (test.c_type === '考试') {
      setView('result');
      showSnackbar(`考试提交成功！${hasObjectiveQuestions ? `客观题得分：${res.data.objective_score}分` : '试卷已提交，等待人工批改'}`, 'success');
    } else {
      showSnackbar('练习提交成功，可查看参考答案', 'success');
      // 练习模式不清除答案，允许再次练习
    }
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.message || '网络异常，交卷失败';
    const errorCode = err.response?.data?.code || err.code || '未知';
    setError(errorMsg);
    setErrorDetails({ 
      code: errorCode, 
      message: errorMsg,
      input: err.response?.data?.input || submitParams || {}
    });
    showSnackbar(`${errorMsg} (错误码: ${errorCode})`, 'error');
  } finally {
    setLoading(false);
  }
};

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

 const isAnswerCorrect = (question: PaperQuestion) => {
  if (!question.answer || !answers[question.id] || test.c_type !== '练习') return false;
  const userAnswer = answers[question.id];
  const correctAnswer = question.answer;

  // 对于简答题，不进行对错判断
  if (question.type === 'text') {
    return false; // 简答题不显示对错标记
  }

  // 添加调试日志
  console.log('答案比较调试:', {
    questionId: question.id,
    questionType: question.type,
    userAnswer,
    correctAnswer,
    options: question.options
  });

  switch (question.type) {
    case 'single':
      // 单选题：增强比较逻辑
      return isAnswerCorrectForSingle(userAnswer, correctAnswer, question.options);
    
    case 'judgment':
      // 判断题逻辑保持不变
      const normalizeAnswer = (ans: any): string => {
        const str = ans.toString().toLowerCase().trim();
        if (['true', '1', '正确', '是', 'yes', 't'].includes(str)) return '正确';
        if (['false', '0', '错误', '否', 'no', 'f'].includes(str)) return '错误';
        return ans.toString();
      };
      return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
    
    case 'multiple':
      // 多选题：增强比较逻辑
      return isAnswerCorrectForMultiple(userAnswer, correctAnswer, question.options);
    
    case 'text':
      return false; // 简答题不判断对错
    
    default:
      return false;
  }
};

// 新增：单选题正确性判断辅助函数
const isAnswerCorrectForSingle = (
  userAnswer: string | string[],
  correctAnswer: string | string[],
  options?: Array<{ optionId: string; content: string }>
): boolean => {
  const userStr = userAnswer.toString();
  const correctStr = correctAnswer.toString();
  
  // 1. 直接比较
  if (userStr === correctStr) {
    return true;
  }
  
  // 2. 如果用户答案是 optionId，正确答案是选项内容
  if (options) {
    // 查找用户选择的选项
    const selectedOption = options.find(opt => opt.optionId === userStr);
    if (selectedOption && selectedOption.content === correctStr) {
      return true;
    }
    
    // 3. 如果用户答案是选项内容，正确答案是 optionId
    const correctOption = options.find(opt => opt.optionId === correctStr);
    if (correctOption && correctOption.content === userStr) {
      return true;
    }
    
    // 4. 用户答案可能是选项内容，正确答案也可能是选项内容
    const userOptionByContent = options.find(opt => opt.content === userStr);
    const correctOptionByContent = options.find(opt => opt.content === correctStr);
    if (userOptionByContent && correctOptionByContent && 
        userOptionByContent.optionId === correctOptionByContent.optionId) {
      return true;
    }
  }
  
  return false;
};

// 新增：多选题正确性判断辅助函数
const isAnswerCorrectForMultiple = (
  userAnswer: string | string[],
  correctAnswer: string | string[],
  options?: Array<{ optionId: string; content: string }>
): boolean => {
  // 标准化用户答案（转为 optionId 数组）
  let userIds: string[] = [];
  if (Array.isArray(userAnswer)) {
    userIds = userAnswer;
  } else {
    userIds = userAnswer.toString().split(';').filter(Boolean);
  }
  
  // 标准化正确答案（转为 optionId 数组）
  let correctIds: string[] = [];
  if (Array.isArray(correctAnswer)) {
    // 如果正确答案是数组，可能是 optionId 或内容
    correctIds = correctAnswer.map(item => item.toString());
  } else {
    // 如果正确答案是字符串，按分号分割
    const answerParts = correctAnswer.toString().split(';').filter(Boolean);
    
    if (options) {
      // 尝试将每个部分转为 optionId
      answerParts.forEach(part => {
        // 先检查是否是 optionId
        if (options.some(opt => opt.optionId === part)) {
          correctIds.push(part);
        } 
        // 如果不是 optionId，尝试通过内容查找 optionId
        else {
          const option = options.find(opt => opt.content === part);
          if (option) {
            correctIds.push(option.optionId);
          } else {
            // 无法转换，保留原值
            correctIds.push(part);
          }
        }
      });
    } else {
      correctIds = answerParts;
    }
  }
  
  // 现在比较两个 optionId 数组
  if (userIds.length !== correctIds.length) {
    return false;
  }
  
  // 排序后比较
  const sortedUserIds = [...userIds].sort();
  const sortedCorrectIds = [...correctIds].sort();
  
  return sortedUserIds.every((id, index) => id === sortedCorrectIds[index]);
};

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleBackClick = () => {
    if (view === 'test' && !submitted && test.c_type === '考试') {
      // 只在考试模式下显示确认提示
      if (window.confirm('确定要退出吗？考试倒计时不会暂停')) {
        onBack();
      }
      return;
    }
    // 练习模式直接返回，不显示确认提示
    onBack();
  };

  const handleQuestionNavigation = (index: number) => {
    setCurrentQuestionIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextQuestion = () => {
    if (paperData && currentQuestionIndex < paperData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading && (view === 'intro' || view === 'test')) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: getCardBgColor()
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: getTextColor(), mb: 2 }}>
            {view === 'intro' ? '加载专属试卷中...' : '提交试卷中...'}
          </Typography>
          <CircularProgress sx={{ color: getAccentColor() }} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: getCardBgColor(),
        p: 2
      }}>
        <Paper sx={{ 
          p: 4, 
          borderRadius: 2,
          backgroundColor: getQuestionBgColor(),
          color: getTextColor(),
          boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
          maxWidth: 600,
          width: '100%',
          textAlign: 'center'
        }}>
          <ErrorIcon sx={{ color: getErrorColor(), fontSize: 48, mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 2, color: getErrorColor() }}>
            加载失败
          </Typography>
          <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
            {error}
          </Typography>
          <Typography variant="body2" color={getSecondaryTextColor()} sx={{ mb: 4 }}>
            调试信息:
            <br />错误码: {errorDetails?.code || '未知'}
            <br />错误详情: {errorDetails?.message || '无详细信息'}
            <br />试卷ID: {test.c_paper_id || '未提供'}
            <br />测试ID: {test.test_id || '未提供'}
            <br />用户名: {currentUsername || '未提供'}
            <br />输入参数: {JSON.stringify(errorDetails?.input || {}, null, 2)}
          </Typography>
          <Button 
            variant="contained"
            startIcon={<ArrowBackIcon />} 
            onClick={handleBackClick}
            sx={{
              backgroundColor: getAccentColor(),
              '&:hover': { backgroundColor: isDarkMode ? '#1976d2' : '#0d47a1' }
            }}
          >
            返回测试列表
          </Button>
        </Paper>
      </Box>
    );
  }

  if (view === 'intro' && !paperData && !loading && !error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: getCardBgColor()
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: getTextColor(), mb: 2 }}>
            准备试卷数据中...
          </Typography>
          <CircularProgress sx={{ color: getAccentColor() }} />
        </Box>
      </Box>
    );
  }

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
      {view === 'intro' && paperData && (
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
                  <Typography 
                    component="div"  // 改为渲染为 div
                    variant="body1" 
                    sx={{ display: 'flex', mb: 1.5 }}
                  >
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>类型:</Box> 
                    <Chip 
                      label={test.c_type} 
                      size="small" 
                      color={test.c_type === '考试' ? 'primary' : 'secondary'}
                      sx={{ borderRadius: 1 }}
                    />
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" sx={{ display: 'flex', mb: 1.5 }}>
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>开始时间:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor() }}>
                      {moment(test.test_start).format('YYYY-MM-DD HH:mm')}
                    </Box>
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" sx={{ display: 'flex', mb: 1.5 }}>
                    <Box component="span" sx={{ minWidth: 80, fontWeight: 600 }}>结束时间:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor() }}>
                      {moment(test.test_end).format('YYYY-MM-DD HH:mm')}
                    </Box>
                  </Typography>
                </Grid>
                 <Grid item xs={12}>
                  <Typography variant="body1" sx={{ mb: 1.5 }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>考试时长:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor() }}>
                      {test.c_type === '练习' ? '不限时' : `${paperData.duration} 分钟`}
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
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ mb: 1.5 }}>
                    <Box component="span" sx={{ fontWeight: 600 }}>试卷信息:</Box> 
                    <Box component="span" sx={{ color: getSecondaryTextColor(), ml: 1 }}>
                      总分：{paperData.totalScore}分，共{paperData.questionCount}题
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
                <HelpIcon sx={{ color: getAccentColor(), mr: 1.5, fontSize: 24 }} />
                <Typography variant="body1" fontWeight="bold">
                  本次测试包含 {paperData.questionCount} 道题目
                </Typography>
              </Box>
            </Box>
            <Button 
              variant="contained"
              size="medium"
              onClick={() => setView('test')}
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
              {test.c_type === '考试' ? 
                '请注意：考试有时间限制，倒计时结束后将自动提交试卷' : 
                '练习模式不限时，提交后可查看正确答案和解析'}
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

    {view === 'result' && paperData && (
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
      {/* 顶部图标 */}
      <Box sx={{ 
        width: 60, 
        height: 60, 
        borderRadius: '50%',
        backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : 'rgba(33, 150, 243, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        border: `2px solid ${getAccentColor()}`
      }}>
        <CheckCircleIcon sx={{ color: getAccentColor(), fontSize: 30 }} />
      </Box>
      
      {/* 标题 */}
      <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 3, color: getAccentColor() }}>
        {test.c_type === '考试' ? '考试提交成功' : '练习完成'}
      </Typography>
      
      {/* 分数卡片 - 只在有客观题时显示 */}
      {hasObjectiveQuestions && (
        <Box sx={{ 
          p: 3,
          borderRadius: 2,
          mb: 4,
          border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`
        }}>
          <Typography variant="h6" sx={{ mb: 2, color: getTextColor() }}>
            客观题得分
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', mb: 2 }}>
            <Typography variant="h3" sx={{ 
              color: getAccentColor(),
              fontWeight: 'bold'
            }}>
              {objectiveScore}
            </Typography>
            <Typography variant="h6" sx={{ color: getSecondaryTextColor(), ml: 1 }}>
              / {objectiveTotalScore} 分  {/* 改为客观题总分 */}
            </Typography>
          </Box>

          <Typography variant="body2" color={getSecondaryTextColor()} sx={{ mb: 2 }}>
            正确题数: {correctCount} / {paperData?.questions?.filter(q => 
              q.type === 'single' || q.type === 'multiple' || q.type === 'judgment'
            ).length || 0} 题  {/* 显示客观题数量 */}
          </Typography>
        </Box>
      )}
      
      {/* 提示信息 */}
      {test.c_type === '考试' ? (
        <Box sx={{ 
          p: 2,
          borderRadius: 1,
          mb: 4,
          backgroundColor: isDarkMode ? 'rgba(255, 193, 7, 0.05)' : 'rgba(255, 193, 7, 0.03)'
        }}>
          <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
            {hasObjectiveQuestions 
              ? `客观题得分：${objectiveScore}/${objectiveTotalScore}分。主观题将在人工批改后更新总分，可在测试列表查看最终成绩`
              : '试卷已提交，所有题目将进行人工批改，可在测试列表查看最终成绩'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ 
          p: 2,
          borderRadius: 1,
          mb: 4,
          backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.05)' : 'rgba(76, 175, 80, 0.03)'
        }}>
          <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
            练习模式可以反复进行，点击返回后可再次练习
          </Typography>
        </Box>
      )}
      
      {/* 返回按钮 */}
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
          borderRadius: 1
        }}
      >
        返回测试列表
      </Button>
    </Paper>
  </Box>
)}

          {view === 'test' && paperData && (
        <Box sx={{ 
          minHeight: '100vh',
          color: getTextColor(),
          p: 0,
          width: '100%',
          overflowX: 'hidden',
          position: 'relative',
          boxSizing: 'border-box'
        }}>
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            backgroundColor: getHeaderBgColor(),
            borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            height: 56
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                label={test.c_type} 
                size="small" 
                color={test.c_type === '考试' ? 'primary' : 'secondary'}
                sx={{ ml: 2, borderRadius: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {test.c_type === '考试' && timeLeft !== null && (
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
              <Button 
                variant="contained"
                size="small"
                onClick={handleSubmit}
                disabled={submitted}
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
                {submitted ? '已提交' : '提交试卷'}
              </Button>
            </Box>
          </Box>
          
          <Box sx={{ 
            width: '100%',
            minHeight: 'calc(100vh - 56px)',
            pt: 4,
            pb: 4,
            p: { xs: 2, md: 4 },
            maxWidth: '100%',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}>
            <Box sx={{
              maxWidth: 1000,
              width: '100%',
              margin: '0 auto',
              mt: 8
            }}>
              <Box sx={{
                mb: 4,
                p: 2,
                backgroundColor: getHeaderBgColor(),
                borderRadius: 1,
                overflowX: 'auto'
              }}>
                <Typography variant="body2" sx={{ mb: 2, color: getSecondaryTextColor() }}>
                  题目导航 ({currentQuestionIndex + 1}/{paperData.questions.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {paperData.questions.map((_, index) => {
                    const hasAnswered = answers[paperData.questions[index].id] !== undefined;
                    return (
                      <Button
                        key={index}
                        variant={currentQuestionIndex === index ? "contained" : "outlined"}
                        size="small"
                        onClick={() => handleQuestionNavigation(index)}
                        sx={{
                          minWidth: 30,
                          height: 30,
                          p: 0,
                          backgroundColor: currentQuestionIndex === index ? getAccentColor() : 'transparent',
                          borderColor: hasAnswered ? getSuccessColor() : (isDarkMode ? '#444' : '#ddd'),
                          color: currentQuestionIndex === index ? '#fff' : getTextColor(),
                          '&:hover': {
                            backgroundColor: currentQuestionIndex === index ? 
                              (isDarkMode ? '#1976d2' : '#0d47a1') : 
                              (isDarkMode ? '#333' : '#f0f0f0')
                          }
                        }}
                      >
                        {index + 1}
                      </Button>
                    );
                  })}
                </Box>
              </Box>

              {paperData.questions.length > 0 && (
                <Paper 
                  key={paperData.questions[currentQuestionIndex].id}
                  sx={{ 
                    p: { xs: 2, md: 3 }, 
                    borderRadius: 1,
                    backgroundColor: getQuestionBgColor(),
                    borderLeft: `3px solid ${getAccentColor()}`,
                    mb: 4
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    题目 {currentQuestionIndex + 1}（{paperData.questions[currentQuestionIndex].type === 'single' ? '单选题' : 
                      paperData.questions[currentQuestionIndex].type === 'multiple' ? '多选题' : 
                      paperData.questions[currentQuestionIndex].type === 'judgment' ? '判断题' : '主观题'}，{paperData.questions[currentQuestionIndex].score}分）
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {paperData.questions[currentQuestionIndex].content}
                  </Typography>

                  {paperData.questions[currentQuestionIndex].type === 'single' && (
                    <FormControl component="fieldset">
                      <RadioGroup
                        value={answers[paperData.questions[currentQuestionIndex].id] || ''}
                        onChange={(e) => handleAnswerChange(paperData.questions[currentQuestionIndex].id, e.target.value)}
                      >
                        {paperData.questions[currentQuestionIndex].options?.map((option) => (
                          <FormControlLabel
                            key={option.optionId}
                            value={option.optionId}
                            control={<Radio disabled={submitted} />}
                            label={option.content}
                            sx={{ mb: 1 }}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  )}

                  {paperData.questions[currentQuestionIndex].type === 'multiple' && (
                    <FormControl component="fieldset">
                      <FormGroup>
                        {paperData.questions[currentQuestionIndex].options?.map((option) => (
                          <FormControlLabel
                            key={option.optionId}
                            control={
                              <Checkbox
                                checked={Array.isArray(answers[paperData.questions[currentQuestionIndex].id]) 
                                  ? (answers[paperData.questions[currentQuestionIndex].id] as string[]).includes(option.optionId)
                                  : false}
                                onChange={(e) => {
                                  const currentAnswers = Array.isArray(answers[paperData.questions[currentQuestionIndex].id])
                                    ? (answers[paperData.questions[currentQuestionIndex].id] as string[])
                                    : [];
                                  const newAnswers = e.target.checked
                                    ? [...currentAnswers, option.optionId]
                                    : currentAnswers.filter((ans) => ans !== option.optionId);
                                  handleAnswerChange(paperData.questions[currentQuestionIndex].id, newAnswers);
                                }}
                                disabled={submitted}
                              />
                            }
                            label={option.content}
                            sx={{ mb: 1 }}
                          />
                        ))}
                      </FormGroup>
                    </FormControl>
                  )}

                  {paperData.questions[currentQuestionIndex].type === 'judgment' && (
                    <FormControl component="fieldset">
                      <RadioGroup
                        value={answers[paperData.questions[currentQuestionIndex].id] || ''}
                        onChange={(e) => handleAnswerChange(paperData.questions[currentQuestionIndex].id, e.target.value)}
                      >
                        <FormControlLabel value="正确" control={<Radio disabled={submitted} />} label="正确" />
                        <FormControlLabel value="错误" control={<Radio disabled={submitted} />} label="错误" />
                      </RadioGroup>
                    </FormControl>
                  )}

                  {paperData.questions[currentQuestionIndex].type === 'text' && (
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      value={answers[paperData.questions[currentQuestionIndex].id] || ''}
                      onChange={(e) => handleAnswerChange(paperData.questions[currentQuestionIndex].id, e.target.value)}
                      disabled={submitted}
                      variant="outlined"
                      placeholder="请输入您的答案"
                      sx={{ mt: 2 }}
                    />
                  )}

                  {test.c_type === '练习' && submitted && paperData.questions[currentQuestionIndex].answer && (
                          <Box sx={{ 
                            mt: 3, 
                            p: 2, 
                            borderRadius: 1,
                            border: `1px solid ${
                              paperData.questions[currentQuestionIndex].type === 'text' 
                                ? (isDarkMode ? '#444' : '#e0e0e0')
                                : isAnswerCorrect(paperData.questions[currentQuestionIndex]) 
                                  ? getSuccessColor() 
                                  : getErrorColor()
                            }`,
                            backgroundColor: paperData.questions[currentQuestionIndex].type === 'text'
                              ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)')
                              : isAnswerCorrect(paperData.questions[currentQuestionIndex]) 
                                ? (isDarkMode ? 'rgba(76, 175, 80, 0.08)' : 'rgba(76, 175, 80, 0.04)')
                                : (isDarkMode ? 'rgba(239, 83, 80, 0.08)' : 'rgba(239, 83, 80, 0.04)')
                          }}>
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              mb: 1 
                            }}>
                              <Typography variant="body2" sx={{ 
                                color: getSecondaryTextColor(),
                                fontWeight: 'medium'
                              }}>
                                参考答案：
                              </Typography>
                              
                              {paperData.questions[currentQuestionIndex].type !== 'text' && (
                                isAnswerCorrect(paperData.questions[currentQuestionIndex]) ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2" sx={{ 
                                      color: getSuccessColor(),
                                      mr: 0.5
                                    }}>
                                      正确
                                    </Typography>
                                    <CheckCircleIcon sx={{ color: getSuccessColor(), fontSize: 16 }} />
                                  </Box>
                                ) : (
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2" sx={{ 
                                      color: getErrorColor(),
                                      mr: 0.5
                                    }}>
                                      错误
                                    </Typography>
                                    <ErrorIcon sx={{ color: getErrorColor(), fontSize: 16 }} />
                                  </Box>
                                )
                              )}
                              
                              {paperData.questions[currentQuestionIndex].type === 'text' && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Typography variant="body2" sx={{ 
                                    color: getSecondaryTextColor(),
                                    mr: 0.5,
                                    fontSize: '0.8rem'
                                  }}>
                                    简答题
                                  </Typography>
                                  <HelpIcon sx={{ color: getSecondaryTextColor(), fontSize: 16 }} />
                                </Box>
                              )}
                            </Box>
                            
                            {/* 显示参考答案 */}
                            <Typography variant="body1" sx={{ 
                              color: getTextColor(),
                              fontWeight: 500,
                              p: 1,
                              borderRadius: 0.5,
                              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                            }}>
                              {(() => {
                                const answer = paperData.questions[currentQuestionIndex].answer;
                                const questionType = paperData.questions[currentQuestionIndex].type;
                                
                                if (questionType === 'single') {
                                  const option = paperData.questions[currentQuestionIndex].options?.find(
                                    opt => opt.optionId === answer
                                  );
                                  
                                  if (option) {
                                    return option.content;
                                  } else {
                                    const optionByContent = paperData.questions[currentQuestionIndex].options?.find(
                                      opt => opt.content === answer
                                    );
                                    return optionByContent ? optionByContent.content : answer;
                                  }
                                  
                                } else if (questionType === 'multiple') {
                                  const answerArr = Array.isArray(answer) ? answer : answer.toString().split(';').filter(Boolean);
                                  const options = paperData.questions[currentQuestionIndex].options || [];
                                  
                                  if (answerArr.length === 0) {
                                    return '无参考答案';
                                  }
                                  
                                  const selectedOptionsById = options.filter(opt => answerArr.includes(opt.optionId));
                                  if (selectedOptionsById.length > 0) {
                                    return selectedOptionsById.map(opt => opt.content).join('; ');
                                  }
                                  
                                  const selectedOptionsByContent = options.filter(opt => answerArr.includes(opt.content));
                                  if (selectedOptionsByContent.length > 0) {
                                    return selectedOptionsByContent.map(opt => opt.content).join('; ');
                                  }
                                  
                                  return Array.isArray(answer) ? answer.join('; ') : answer;
                                  
                                } else if (questionType === 'judgment') {
                                  if (answer === 'true' || answer === '1' || answer === '正确' || answer === '是') {
                                    return '正确';
                                  } else if (answer === 'false' || answer === '0' || answer === '错误' || answer === '否') {
                                    return '错误';
                                  } else {
                                    return answer;
                                  }
                                  
                                } else if (questionType === 'text') {
                                  return Array.isArray(answer) ? answer.join('; ') : (answer || '无参考答案');
                                  
                                } else {
                                  return Array.isArray(answer) ? answer.join('; ') : answer;
                                }
                              })()}
                            </Typography>
                            
                            {/* 显示用户答案 - 简答题总是显示，其他题型只在错误时显示 */}
                            <Box sx={{ 
                              mt: 2, 
                              pt: 2, 
                              borderTop: `1px dashed ${isDarkMode ? '#444' : '#e0e0e0'}` 
                            }}>
                              <Typography variant="body2" sx={{ 
                                color: getSecondaryTextColor(),
                                mb: 0.5,
                                fontWeight: 'medium'
                              }}>
                                您的答案：
                              </Typography>
                              
                              <Typography variant="body1" sx={{ 
                                color: paperData.questions[currentQuestionIndex].type === 'text' 
                                  ? getTextColor() 
                                  : (isAnswerCorrect(paperData.questions[currentQuestionIndex]) ? getSuccessColor() : getErrorColor()),
                                fontWeight: 500,
                                p: 1,
                                borderRadius: 0.5,
                                backgroundColor: paperData.questions[currentQuestionIndex].type === 'text'
                                  ? (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)')
                                  : (isAnswerCorrect(paperData.questions[currentQuestionIndex])
                                    ? (isDarkMode ? 'rgba(76, 175, 80, 0.08)' : 'rgba(76, 175, 80, 0.04)')
                                    : (isDarkMode ? 'rgba(239, 83, 80, 0.1)' : 'rgba(239, 83, 80, 0.05)'))
                              }}>
                                {(() => {
                                  const userAnswer = answers[paperData.questions[currentQuestionIndex].id];
                                  const questionType = paperData.questions[currentQuestionIndex].type;
                                  
                                  if (!userAnswer) return '未作答';
                                  
                                  if (questionType === 'single') {
                                    const option = paperData.questions[currentQuestionIndex].options?.find(
                                      opt => opt.optionId === userAnswer
                                    );
                                    return option ? option.content : userAnswer;
                                  } else if (questionType === 'multiple') {
                                    const userArr = Array.isArray(userAnswer) ? userAnswer : userAnswer.toString().split(';').filter(Boolean);
                                    const options = paperData.questions[currentQuestionIndex].options || [];
                                    const selectedOptions = options.filter(opt => userArr.includes(opt.optionId));
                                    return selectedOptions.map(opt => opt.content).join('; ');
                                  } else if (questionType === 'judgment') {
                                    return userAnswer === 'true' ? '正确' : (userAnswer === 'false' ? '错误' : userAnswer);
                                  } else {
                                    return Array.isArray(userAnswer) ? userAnswer.join('; ') : userAnswer.toString();
                                  }
                                })()}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                  
                  {/* 上下题按钮 */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                    <Button
                      variant="outlined"
                      disabled={currentQuestionIndex === 0}
                      onClick={handlePrevQuestion}
                      sx={{ color: getButtonColor(), borderColor: getButtonColor() }}
                    >
                      上一题
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={paperData && currentQuestionIndex === paperData.questions.length - 1}
                      onClick={handleNextQuestion}
                      sx={{ color: getButtonColor(), borderColor: getButtonColor() }}
                    >
                      下一题
                    </Button>
                  </Box>
                </Paper>
              )}
            </Box>
          </Box>
        </Box>
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
 </Box> 
  );
};

export default TheoreticalTestPage;
