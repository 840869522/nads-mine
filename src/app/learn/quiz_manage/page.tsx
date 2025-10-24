"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, CssBaseline, Toolbar, Typography, Container,
  useMediaQuery, CircularProgress, useTheme
} from '@mui/material';


import TestManagement from '@/components/learning/TestManagement';

// 定义主题模式类型
type ThemeMode = 'light' | 'dark';

// 根据主题模式生成MUI主题


function App() {
  const [activeTab] = useState('tests');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);
  const [hasReceivedPlatformTheme, setHasReceivedPlatformTheme] = useState(false);


  // 处理平台主题消息
  const handlePlatformThemeChange = useCallback((event: MessageEvent) => {
    // 验证消息来源（生产环境应替换为实际父平台域名）
    const trustedOrigins = ['http://localhost:3000', 'http://localhost:8000'];
    if (!trustedOrigins.includes(event.origin)) {
      return;
    }

    // 处理主题消息
    if (event.data?.type === 'theme' && ['light', 'dark'].includes(event.data.mode)) {
      setThemeMode(event.data.mode as ThemeMode);
      setHasReceivedPlatformTheme(true);
      setIsLoading(false);
    }
  }, []);

  // 初始化主题监听
  useEffect(() => {
    window.addEventListener('message', handlePlatformThemeChange);
    
    // 请求平台主题
    window.parent.postMessage({ type: 'request-theme' }, '*');
    
    // 超时处理
    const timeoutId = setTimeout(() => {
      if (!hasReceivedPlatformTheme) {
        setIsLoading(false);
      }
    }, 100);

    // 清理函数
    return () => {
      window.removeEventListener('message', handlePlatformThemeChange);
      clearTimeout(timeoutId);
    };
  }, [handlePlatformThemeChange, hasReceivedPlatformTheme]);

  // 系统主题偏好作为备选
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  useEffect(() => {
    // 仅在未收到平台主题时使用系统偏好
    if (!isLoading && !hasReceivedPlatformTheme) {
      setThemeMode(prefersDarkMode ? 'dark' : 'light');
    }
  }, [prefersDarkMode, isLoading, hasReceivedPlatformTheme]);

  return (

      <AppContent isLoading={isLoading} activeTab={activeTab} />

  );
}

// 应用内容组件
const AppContent: React.FC<{ 
  isLoading: boolean; 
  activeTab: string;
}> = ({ isLoading, activeTab }) => {
  const theme = useTheme(); // 使用useTheme获取当前主题

  return (
    <Box sx={{ 
      display: 'flex',
      minHeight: '100vh',
      bgcolor: theme.palette.background.default, // 使用主题默认背景色
      color: theme.palette.text.primary, // 使用主题文本色
      transition: 'background-color 0.3s ease, color 0.3s ease'
    }}>
      <CssBaseline />
      
      {isLoading ? (
        // 加载状态
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100vh',
          bgcolor: theme.palette.background.default
        }}>
          <CircularProgress color="primary" />
          <Typography variant="body1" sx={{ 
            ml: 2, 
            color: theme.palette.text.primary 
          }}>
        
          </Typography>
        </Box>
      ) : (
        // 主内容区域
        <Box component="main" sx={{ 
          flexGrow: 1, 
          p: { xs: 2, md: 3 }, 
          width: '100%',
          transition: 'padding 0.3s ease'
        }}>
          <Toolbar />
          <Container maxWidth="lg" sx={{ 
            mt: -12, 
            mb: -5,
            transition: 'margin 0.3s ease'
          }}>
            {activeTab === 'tests' && <TestManagement />}
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default App;
    