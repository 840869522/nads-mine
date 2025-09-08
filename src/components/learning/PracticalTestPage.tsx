import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, Grid, Button, Chip, 
  LinearProgress, CircularProgress, Tooltip, Card, 
  CardContent, CardActions
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  PlayArrow as PlayArrowIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Speed as SpeedIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface PracticalTestPageProps {
  testId: string;
  onBack: () => void;
}

const PracticalTestPage = ({ testId, onBack }: PracticalTestPageProps) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // 状态管理
  const [scenes, setScenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testInfo, setTestInfo] = useState<any>(null);
  
  // 动态颜色函数（适配明暗模式）
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#333';
  const getSecondaryTextColor = () => isDarkMode ? '#bbb' : '#666';
  const getButtonColor = () => isDarkMode ? '#4caf50' : '#2e7d32';
  const getHeaderBgColor = () => isDarkMode ? '#2a2a2a' : '#f5f7fa';

  /**
   * 模拟API调用：获取实践测试信息和场景数据
   * 实际项目中可替换为真实接口请求（如axios/fetch）
   */
  useEffect(() => {
    setLoading(true);
    
    // 模拟接口延迟
    const timer = setTimeout(() => {
      // 1. 模拟测试基础信息
      const mockTestInfo = {
        id: testId,
        name: `实践操作测试 ${testId.split('-')[1] || '01'}`,
        description: `这是【${testId}】的实践测试描述，包含多个操作场景，需完成所有场景任务以通过测试`,
        duration: 120, // 总时长（分钟）
        totalScenes: 5, // 总场景数
      };
      
      // 2. 模拟场景列表数据
      const mockScenes = Array.from({ length: 5 }, (_, i) => ({
        id: `scene-${i + 1}`,
        name: `实践场景 ${i + 1}`,
        description: `场景 ${i + 1} 任务要求：需完成环境配置、功能验证、结果提交等操作，系统将自动记录操作过程和正确性`,
        difficulty: ['简单', '中等', '困难'][i % 3], // 随机难度
        testDuration: [15, 30, 45][i % 3], // 单场景时长（分钟）
        status: i === 0 ? '进行中' : i > 2 ? '已完成' : '未开始', // 场景状态
        progress: i === 0 ? 40 : i > 2 ? 100 : 0, // 完成进度（%）
      }));
      
      setTestInfo(mockTestInfo);
      setScenes(mockScenes);
      setLoading(false);
    }, 800);
    
    // 清理定时器
    return () => clearTimeout(timer);
  }, [testId]);

  /**
   * 处理场景开始/继续操作
   * @param sceneId 场景ID
   */
  const handleStartScene = (sceneId: string) => {
    // 实际项目中可替换为路由跳转（如useNavigate）
    alert(`进入实践场景：${sceneId}（此处可跳转至具体操作页面）`);
  };

  /**
   * 根据场景状态获取Chip颜色
   * @param status 场景状态（进行中/已完成/未开始）
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case '进行中': return 'primary';
      case '已完成': return 'success';
      default: return 'default';
    }
  };

  /**
   * 根据场景难度获取Chip颜色
   * @param difficulty 难度（简单/中等/困难）
   */
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case '简单': return 'success';
      case '中等': return 'warning';
      case '困难': return 'error';
      default: return 'default';
    }
  };

  // 加载中状态渲染
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 'calc(100vh - 40px)',
        backgroundColor: getCardBgColor()
      }}>
        <CircularProgress sx={{ color: getButtonColor() }} />
      </Box>
    );
  }

  return (
    <Paper sx={{ 
      p: 3, 
      borderRadius: 4,
      backgroundColor: getCardBgColor(),
      color: getTextColor(),
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.08)',
      minHeight: 'calc(100vh - 40px)',
      boxSizing: 'border-box'
    }}>
      {/* 1. 头部信息区域 */}
      <Box sx={{ 
        backgroundColor: getHeaderBgColor(),
        p: 3, 
        borderRadius: 3, 
        mb: 3,
        borderLeft: `4px solid ${getButtonColor()}`
      }}>
        {/* 返回按钮 */}
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
        
        {/* 测试基础信息 */}
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
            {/* 测试统计卡片 */}
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
      
      {/* 2. 场景列表区域 */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, mt: 4 }}>
        实践场景列表
      </Typography>
      
      <Grid container spacing={3}>
        {scenes.map((scene) => (
          <Grid item xs={12} md={6} key={scene.id}>
            {/* 场景卡片 */}
            <Card sx={{ 
              height: '100%', 
              width: '100%',
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
                {/* 场景标题与状态 */}
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
                        ? (isDarkMode ? 'rgba(0, 94, 255, 0.66)' : 'rgba(0, 94, 255, 1)') 
                        : undefined
                    }}
                  />
                </Box>
                
                {/* 场景描述 */}
                <Typography variant="body2" color={getSecondaryTextColor()} sx={{ mb: 2 }}>
                  {scene.description}
                </Typography>
                
                {/* 场景属性（难度/时长） */}
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
                
                {/* 进行中场景进度条 */}
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
              
              {/* 场景操作按钮 */}
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
                  <Tooltip title={scene.status === '进行中' ? '继续该场景测试' : '开始新场景测试'}>
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
                  </Tooltip>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* 3. 底部全局操作按钮 */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button 
          variant="outlined"
          onClick={onBack}
          sx={{ 
            color: getTextColor(),
            borderColor: isDarkMode ? '#555' : '#ddd',
            '&:hover': {
              borderColor: isDarkMode ? '#777' : '#ccc'
            }
          }}
        >
          返回测试列表
        </Button>
        <Button 
          variant="contained"
          sx={{
            backgroundColor: getButtonColor(),
            '&:hover': {
              backgroundColor: isDarkMode ? '#388e3c' : '#1b5e20'
            }
          }}
          disabled={scenes.some(s => s.status !== '已完成')} // 所有场景完成后才允许提交
        >
          提交所有测试
        </Button>
      </Box>
    </Paper>
  );
};

export default PracticalTestPage;