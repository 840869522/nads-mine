import React, { useState, useEffect } from 'react';
import { 
  Drawer, Box, Typography, Button, IconButton, 
  Toolbar, Divider, List, ListItem, ListItemText, 
  ListItemSecondaryAction, Chip, Avatar, Grid,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, InputAdornment, Checkbox, FormGroup,
  FormControlLabel, Paper, Chip as MuiChip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Check as CheckIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  ArrowRight as ArrowRightIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { apiClientWithToken } from '@/utils/axios';

// 日期格式化函数
const formatDate = (dateString: string | null) => {
  if (!dateString) return '未提交';
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '无效日期' : date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '无效日期';
  }
};

// 接口定义
interface TestUser {
  id?: string;
  username: string;
  name: string;
  email?: string;
  role?: string;
  c_test_id: string;
  c_paper_id: string;
  c_answers: any;
  start_time: string | null;
  end_time: string | null;
  submit_time: string | null;
  score: number;
  correct_status: number;
  correct_status_text: string;
}

interface TestData {
  c_id?: string;
  c_name: string;
  c_course_id: string;
  c_type: string;
  [key: string]: any;
}

interface Paper {
  paperId: string;
  testId: string;
  totalScore: number;
  questionCount: number;
  paperName: string;
}

interface ScoreData {
  course_id: string;
  course_name: string;
  tests: Array<{
    test_id: string;
    test_name: string;
    category: string;
    scores: Array<{
      username: string;
      papers: Array<{
        paper_id: string;
        paper_name: string;
        start_time: string | null;
        submit_time: string | null;
        total_score: number;
        objective_score: number;
        subjective_score: number;
      }>;
    }>;
  }>;
  experiments: Array<{
    test_id: string;
    test_name: string;
    category: string;
    history: Array<{
      username: string;
      history: Array<{
        c_submission_id: string;
        c_username: string;
        c_submitted_at: string;
        c_is_correct: boolean;
        c_attempt_count: number;
        c_points_earned: number;
        c_submitted_flag: string;
        instance_id: string;
        instance_ip: string;
        instance_name: string;
        instance_type: string;
        c_scene_instances_id: string;
      }>;
    }>;
  }>;
}

interface TestUserDrawerProps {
  open: boolean;
  onClose: () => void;
  test: TestData | null;
  testUsers: TestUser[];
  allUsers: any[];
  papers: Paper[];
  onSave: (users: TestUser[]) => Promise<void>;
  loading: boolean;
  onDeleteUser: (user: TestUser, e: React.MouseEvent) => void;
  deletingKey: string | null;
}

const TestUserDrawer: React.FC<TestUserDrawerProps> = ({ 
  open, onClose, test, testUsers = [], allUsers = [], papers = [], 
  onSave, loading, onDeleteUser, deletingKey 
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // 状态定义
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState<boolean>(false);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<TestUser | null>(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [addUserSearchText, setAddUserSearchText] = useState(''); // 添加用户区域搜索
  const [associatedUserSearchText, setAssociatedUserSearchText] = useState(''); // 已关联用户区域搜索
  const [tempTestUsers, setTempTestUsers] = useState<TestUser[]>([]);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null); // 成绩数据
  const [loadingScores, setLoadingScores] = useState<boolean>(false); // 加载成绩状态

  // 动态颜色函数
  const getBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getHeaderBgColor = () => isDarkMode ? '#2a2a2a' : '#3f51b5';
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#000000';
  const getSecondaryTextColor = () => isDarkMode ? '#bbb' : '#666';
  const getCardBgColor = () => isDarkMode ? '#252525' : '#f9f9f9';
  const getBorderColor = () => isDarkMode ? '#444' : '#ddd';
  const getSearchBgColor = () => isDarkMode ? '#2d2d2d' : '#f5f5f5';

  // 过滤可用用户
  const filteredAvailableUsers = availableUsers.filter(user => 
    user.username.toLowerCase().includes(addUserSearchText.toLowerCase()) ||
    user.name.toLowerCase().includes(addUserSearchText.toLowerCase())
  );

  // 判断是否为实验类型
  const isExperiment = test?.c_type === '实验';

  // 计算可用用户
  // 在计算可用用户的 useEffect 中修改
  useEffect(() => {
  if (open && test) {
    const associatedUserIds = testUsers.map(u => u.username).filter(id => id != null);
    const filteredUsers = allUsers.filter(user => 
      user.username && !associatedUserIds.includes(user.username)
    );
    setAvailableUsers(filteredUsers);
    setSelectedUsers([]);
    setIsSelectAll(false);
    
    if (!isExperiment && papers.length > 0) {
      setSelectedPaperId(papers[0].paperId);
    } else if (isExperiment) {
      setSelectedPaperId('experiment_default');
    } else {
      // 关键修改：理论测试且没有试卷时清空 selectedPaperId
      setSelectedPaperId('');
    }
  }
  setAddUserSearchText('');
  setAssociatedUserSearchText('');
  setTempTestUsers([]);
}, [open, test, testUsers, allUsers, papers, isExperiment]);
  // 全选状态管理
  useEffect(() => {
    const filtered = filteredAvailableUsers;
    if (filtered.length === 0 || selectedUsers.length !== filtered.length) {
      setIsSelectAll(false);
    } else {
      setIsSelectAll(true);
    }
  }, [selectedUsers, filteredAvailableUsers]);

  // 搜索已关联用户
  const getFilteredTestUsers = () => {
    if (!associatedUserSearchText.trim()) {
      return testUsers;
    }
    const lowerSearchText = associatedUserSearchText.toLowerCase();
    return testUsers.filter(user => 
      user.username.toLowerCase().includes(lowerSearchText) || 
      user.name.toLowerCase().includes(lowerSearchText)
    );
  };

  // 获取用户成绩
  useEffect(() => {
    const fetchUserScores = async () => {
      if (!selectedUser || !test?.c_id || !test.c_course_id) return;
      setLoadingScores(true);
      try {
        const response = await apiClientWithToken.post('/back/api/study/test/get_user_test_score', {
          course_id: test.c_course_id,
          username: selectedUser.username,
          c_test_id: test.c_id
        });
        if (response.data.code === 200) {
          setScoreData(response.data.data);
        } else {
          setScoreData(null);
          console.error('获取成绩失败:', response.data.message);
        }
      } catch (error: any) {
        setScoreData(null);
        console.error('获取成绩失败:', error);
      } finally {
        setLoadingScores(false);
      }
    };

    if (userDetailOpen && selectedUser) {
      fetchUserScores();
    } else {
      setScoreData(null);
    }
  }, [userDetailOpen, selectedUser, test]);

  // 处理用户选择变化
  const handleUserSelectionChange = (username: string) => {
    setSelectedUsers(prev => 
      prev.includes(username)
        ? prev.filter(u => u !== username)
        : [...prev, username]
    );
  };

  // 全选/取消全选逻辑
  const handleSelectAllChange = () => {
    const filtered = filteredAvailableUsers;
    if (isSelectAll) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filtered.map(user => user.username));
    }
  };

  // 批量添加用户到测试
  // 在 handleAddSelectedUsers 函数中也添加验证
const handleAddSelectedUsers = () => {
  if (selectedUsers.length === 0 || !test?.c_id) {
    return;
  }
  
  // 关键修改：理论测试必须选择试卷且必须有可用试卷
  if (!isExperiment && (!selectedPaperId || papers.length === 0)) {
    return;
  }
  
  const newUsers = selectedUsers.map(username => {
    const userInfo = allUsers.find(u => u.username === username);
    return {
      id: undefined,
      username,
      name: userInfo?.name || username,
      c_test_id: test.c_id,
      c_paper_id: isExperiment ? 'experiment_default' : selectedPaperId,
      c_answers: [],
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      submit_time: null,
      score: 0,
      correct_status: 1,
      correct_status_text: '未完成'
    };
  });
  
  setTempTestUsers([...tempTestUsers, ...newUsers]);
  setSelectedUsers([]);
  setIsSelectAll(false);
};
    

  // 确认添加临时用户
  const handleConfirmAddUsers = async () => {
    if (tempTestUsers.length === 0) return;
    await onSave([...testUsers, ...tempTestUsers]);
    setTempTestUsers([]);
  };

  // 查看用户详情
  const handleOpenDetail = (user: TestUser, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUser(user);
    setUserDetailOpen(true);
  };

  // 获取状态标签文本
  const getStatusLabel = (status: number) => {
    switch(status) {
      case 0: return '未交卷';
      case 1: return '未完成';
      case 2: return '已完成';
      default: return '未知状态';
    }
  };

  // 获取状态标签颜色
  const getStatusColor = (status: number) => {
    switch(status) {
      case 0: return 'error' as const;
      case 1: return 'warning' as const;
      case 2: return 'success' as const;
      default: return 'default' as const;
    }
  };

  // 渲染分数显示
  const renderScore = (user: TestUser) => {
    if (user.correct_status === 2) {
      return (
        <Typography variant="body2" color={user.score > 60 ? 'success.main' : 'error.main'}>
          分数: {user.score}
        </Typography>
      );
    }
    return (
      <Typography variant="body2" color={getSecondaryTextColor()}>
        分数: 未完成
      </Typography>
    );
  };

  // 生成当前用户的删除标识
  const getUserDeleteKey = (user: TestUser) => {
    return `${user.c_test_id}-${user.username}-${user.c_paper_id}`;
  };

  // 渲染成绩详情
  const renderScoreDetails = () => {
    if (loadingScores) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (!scoreData) {
      return (
        <Typography variant="body1" sx={{ color: getSecondaryTextColor(), textAlign: 'center', p: 2 }}>
          暂无成绩数据
        </Typography>
      );
    }

    if (isExperiment) {
      // 实验测试：显示 Flag 提交历史表格
      const history = scoreData.experiments[0]?.history[0]?.history || [];
      if (history.length === 0) {
        return (
          <Typography variant="body1" sx={{ color: getSecondaryTextColor(), textAlign: 'center', p: 2 }}>
            暂无实验成绩
          </Typography>
        );
      }

      return (
        <TableContainer component={Paper} sx={{ mt: 2, backgroundColor: getCardBgColor() }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: getTextColor() }}>提交时间</TableCell>
                <TableCell sx={{ color: getTextColor() }}>是否正确</TableCell>
                <TableCell sx={{ color: getTextColor() }}>尝试次数</TableCell>
                <TableCell sx={{ color: getTextColor() }}>获得积分</TableCell>
                <TableCell sx={{ color: getTextColor() }}>靶机IP</TableCell>
                <TableCell sx={{ color: getTextColor() }}>靶机名称</TableCell>
                <TableCell sx={{ color: getTextColor() }}>靶机类型</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((record: any, index: number) => (
                <TableRow key={index}>
                  <TableCell sx={{ color: getTextColor() }}>{formatDate(record.c_submitted_at)}</TableCell>
                  <TableCell>
                    <Chip
                      label={record.c_is_correct ? '是' : '否'}
                      color={record.c_is_correct ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ color: getTextColor() }}>{record.c_attempt_count}</TableCell>
                  <TableCell sx={{ color: getTextColor() }}>{record.c_points_earned}</TableCell>
                  <TableCell sx={{ color: getTextColor() }}>{record.instance_ip}</TableCell>
                  <TableCell sx={{ color: getTextColor() }}>{record.instance_name}</TableCell>
                  <TableCell sx={{ color: getTextColor() }}>{record.instance_type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    } else {
      // 理论测试：删除成绩详情及表格，返回空
      return null;
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 600 },
            backgroundColor: getBgColor(),
            color: getTextColor(),
            display: 'flex',
            flexDirection: 'column'
          },
        }}
      >
        <Toolbar sx={{ 
          bgcolor: getHeaderBgColor(), 
          color: 'white' 
        }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {test ? test.c_name : '测试'} - 用户管理
          </Typography>
          <IconButton edge="end" color="inherit" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
        
        <Box sx={{ p: 3, overflow: 'auto', flexGrow: 1 }}>
          {/* 添加用户区域 */}
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: getTextColor() }}>
            添加用户到测试
          </Typography>
          
          {/* 试卷选择下拉框 - 仅在非实验类型时显示 */}
         {!isExperiment && (
  <FormControl fullWidth sx={{ mb: 2, minWidth: 180 }}>
    <InputLabel sx={{ color: getSecondaryTextColor() }}>选择试卷</InputLabel>
    <Select
      value={selectedPaperId}
      onChange={(e) => setSelectedPaperId(e.target.value as string)}
      label="选择试卷"
      disabled={papers.length === 0 || loading}
      sx={{ color: getTextColor() }}
    >
      {papers.map(paper => (
        <MenuItem key={paper.paperId} value={paper.paperId} sx={{ color: getTextColor() }}>
          {paper.paperName} (题目数: {paper.questionCount}, 总分: {paper.totalScore})
        </MenuItem>
      ))}
      {papers.length === 0 && (
        <MenuItem disabled sx={{ color: getSecondaryTextColor() }}>
          {loading ? '加载试卷中...' : '无可用试卷'}
        </MenuItem>
      )}
    </Select>
    
    {/* 在这里添加提示 */}
    {papers.length === 0 && !loading && (
      <Typography variant="body2" color="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
        请先创建试卷才能添加用户
      </Typography>
    )}
  </FormControl>
)}
           
          
          {/* 搜索可用用户 */}
          <TextField
            size="small"
            placeholder="搜索用户..."
            value={addUserSearchText}
            onChange={(e) => {
              setAddUserSearchText(e.target.value);
              setIsSelectAll(false);
            }}
            sx={{ 
              width: '100%', 
              mb: 2,
              backgroundColor: getSearchBgColor(),
              borderRadius: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
                '& fieldset': { borderColor: getBorderColor() },
                '&:hover fieldset': { borderColor: isDarkMode ? '#666' : '#aaa' },
                '&.Mui-focused fieldset': { borderColor: '#3f51b5' },
              },
              '& .MuiInputBase-input': { color: getTextColor() },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: getSecondaryTextColor(), fontSize: 16 }} />
                </InputAdornment>
              ),
            }}
          />
          
          {/* 可用用户列表 - 支持多选 + 全选Checkbox */}
          <Box sx={{ 
            maxHeight: 200, 
            overflow: 'auto', 
            mb: 2,
            border: `1px solid ${getBorderColor()}`,
            borderRadius: 1,
            p: 1
          }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : filteredAvailableUsers.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: 150,
                color: getSecondaryTextColor()
              }}>
                没有可用用户
              </Box>
            ) : (
              <FormGroup>
                {/* 全选Checkbox行 */}
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={isSelectAll}
                      onChange={handleSelectAllChange}
                      color="primary"
                      disabled={filteredAvailableUsers.length === 0}
                    />
                  }
                  label={
                    <Typography sx={{ color: getTextColor(), fontWeight: 500 }}>
                      全选（{selectedUsers.length}/{filteredAvailableUsers.length}）
                    </Typography>
                  }
                  sx={{
                    '& .MuiFormControlLabel-label': { color: getTextColor() },
                    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                    borderBottom: `1px dashed ${getBorderColor()}`,
                    pb: 1,
                    mb: 1
                  }}
                />
                
                {/* 可用用户列表 */}
                {filteredAvailableUsers.map(user => (
                  <FormControlLabel
                    key={user.username}
                    control={
                      <Checkbox 
                        checked={selectedUsers.includes(user.username)}
                        onChange={() => handleUserSelectionChange(user.username)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ 
                          bgcolor: isDarkMode ? '#3f51b5' : '#3f51b5', 
                          mr: 1, 
                          width: 24, 
                          height: 24,
                          fontSize: '0.875rem',
                          color: '#fff'
                        }}>
                          {user.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography sx={{ color: getTextColor() }}>
                          {user.name} ({user.username})
                        </Typography>
                      </Box>
                    }
                    sx={{
                      '& .MuiFormControlLabel-label': { color: getTextColor() },
                      '&:hover': { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
                    }}
                  />
                ))}
              </FormGroup>
            )}
          </Box>
          
          {/* 批量添加按钮 */}
          {filteredAvailableUsers.length > 0 && (
            <Paper sx={{ p: 2, mb: 2, backgroundColor: getCardBgColor() }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: getTextColor() }}>
                  已选择 {selectedUsers.length} 个用户
                </Typography>
               
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddSelectedUsers}
                      disabled={
                        selectedUsers.length === 0 || 
                        // 关键修改：理论测试必须选择试卷且必须有可用试卷
                        (!isExperiment && (!selectedPaperId || papers.length === 0)) || 
                        loading
                      }
                      sx={{ 
                        backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
                        color: '#fff',
                        '&:hover': {
                          backgroundColor: isDarkMode ? '#303f9f' : '#303f9f'
                        },
                        '&:disabled': {
                          backgroundColor: isDarkMode ? '#555' : '#ccc',
                          color: isDarkMode ? '#888' : '#666'
                        }
                      }}
                    >
                      添加到测试
                    </Button>
              </Box>
              {tempTestUsers.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ color: getTextColor(), mb: 1 }}>
                    待确认用户：
                  </Typography>
                  <Box sx={{ maxHeight: 100, overflow: 'auto' }}>
                    {tempTestUsers.map(user => (
                      <MuiChip
                        key={user.username}
                        label={`${user.name} (${user.username})`}
                        onDelete={() => setTempTestUsers(tempTestUsers.filter(u => u.username !== user.username))}
                        sx={{ 
                          m: 0.5, 
                          backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
                          color: getTextColor()
                        }}
                      />
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CheckIcon />}
                    onClick={handleConfirmAddUsers}
                    sx={{ mt: 2 }}
                  >
                    确认添加
                  </Button>
                </Box>
              )}
            </Paper>
          )}
          
          <Divider sx={{ my: 3, borderColor: getBorderColor() }} />
          
          {/* 已关联用户区域 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: getTextColor() }}>
              已关联用户 ({getFilteredTestUsers().length}/{testUsers.length})
            </Typography>
            
            {/* 搜索已关联用户 */}
            <TextField
              size="small"
              placeholder="搜索姓名/用户名..."
              value={associatedUserSearchText}
              onChange={(e) => setAssociatedUserSearchText(e.target.value)}
              sx={{ 
                width: { xs: '100%', sm: 220 }, 
                mt: { xs: 1, sm: 0 },
                backgroundColor: getSearchBgColor(),
                borderRadius: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1,
                  '& fieldset': { borderColor: getBorderColor() },
                },
                '& .MuiInputBase-input': { color: getTextColor() },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: getSecondaryTextColor(), fontSize: 16 }} />
                  </InputAdornment>
                ),
              }}
              InputLabelProps={{ style: { display: 'none' } }}
            />
          </Box>
          
          {/* 已关联用户列表 */}
          {loading ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: 200
            }}>
              <CircularProgress />
            </Box>
          ) : getFilteredTestUsers().length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: 200,
              textAlign: 'center',
              color: getSecondaryTextColor()
            }}>
              <PersonIcon sx={{ fontSize: 48, mb: 1, color: getSecondaryTextColor() }} />
              <Typography variant="body1">
                {associatedUserSearchText.trim() ? '未找到匹配的用户' : '暂无关联用户'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {associatedUserSearchText.trim() 
                  ? '请调整搜索词后重试' 
                  : '请使用上方表单添加用户到此测试'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {getFilteredTestUsers().map(user => {
                const paper = papers.find(p => p.paperId === user.c_paper_id);
                const currentDeleteKey = getUserDeleteKey(user);
                const isDeleting = deletingKey === currentDeleteKey;
                
                return (
                  <ListItem 
                    key={currentDeleteKey}
                    sx={{
                      borderBottom: `1px solid ${getBorderColor()}`,
                      '&:last-child': {
                        borderBottom: 'none'
                      },
                      backgroundColor: getCardBgColor(),
                      '&:hover': {
                        backgroundColor: isDarkMode ? '#333' : '#f0f0f0'
                      }
                    }}
                  >
                    <Avatar sx={{ 
                      bgcolor: isDarkMode ? '#3f51b5' : '#3f51b5', 
                      mr: 2,
                      color: '#fff'
                    }}>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <ListItemText
                      primary={<Typography sx={{ color: getTextColor() }}>{user.name}</Typography>}
                      secondary={
                        <>
                          <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
                            用户名: {user.username}
                          </Typography>
                          {!isExperiment && (
                            <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
                              试卷: {paper?.paperName || user.c_paper_id}
                            </Typography>
                          )}
                        </>
                      }
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 10 }}>
                      <Chip 
                        label={user.correct_status_text || getStatusLabel(user.correct_status)} 
                        size="small" 
                        color={getStatusColor(user.correct_status)}
                        sx={{ mb: 1 }}
                      />
                      {renderScore(user)}
                    </Box>
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        onClick={(e) => handleOpenDetail(user, e)}
                        sx={{ mr: 1 }}
                        disabled={isDeleting}
                      >
                        <InfoIcon color="info" />
                      </IconButton>
                      
                      <IconButton 
                        edge="end" 
                        onClick={(e) => onDeleteUser(user, e)}
                        sx={{ color: isDarkMode ? '#f44336' : '#d32f2f' }}
                        disabled={isDeleting || !!user.submit_time || user.correct_status === 2}
                      >
                        {isDeleting ? <CircularProgress size={16} /> : <DeleteIcon />}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
        
        <Box sx={{ p: 2, bgcolor: isDarkMode ? '#2a2a2a' : '#f5f5f5', mt: 'auto' }}>
          <Button
            variant="contained"
            fullWidth
            onClick={onClose}
            startIcon={<CheckIcon />}
            sx={{
              backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
              color: '#fff',
              '&:hover': {
                backgroundColor: isDarkMode ? '#303f9f' : '#303f9f'
              }
            }}
          >
            完成管理
          </Button>
        </Box>
      </Drawer>

      {/* 用户详细详细信息弹窗 */}
      <Dialog
        open={userDetailOpen}
        onClose={() => setUserDetailOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          style: {
            backgroundColor: getBgColor(),
            color: getTextColor()
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: getHeaderBgColor(), 
          color: '#fff' 
        }}>
          <Box display="flex" alignItems="center">
            <PersonIcon sx={{ mr: 1 }} />
            用户测试详情
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser && (
            <>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ 
                  bgcolor: isDarkMode ? '#3f51b5' : '#3f51b5', 
                  mr: 2, 
                  width: 56, 
                  height: 56,
                  fontSize: '1.5rem',
                  color: '#fff'
                }}>
                  {selectedUser.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: getTextColor() }}>
                    {selectedUser.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
                    用户名: {selectedUser.username}
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2, borderColor: getBorderColor() }} />
              
              <Grid container spacing={2}>
                {!isExperiment && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                        试卷
                      </Typography>
                      <Typography variant="body1" sx={{ color: getTextColor() }}>
                        {papers.find(p => p.paperId === selectedUser.c_paper_id)?.paperName || selectedUser.c_paper_id}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                        测试状态
                      </Typography>
                      <Chip 
                        label={selectedUser.correct_status_text || getStatusLabel(selectedUser.correct_status)} 
                        color={getStatusColor(selectedUser.correct_status)}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                        开始时间
                      </Typography>
                      <Typography variant="body1" sx={{ color: getTextColor() }}>
                        {formatDate(selectedUser.start_time)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                        提交时间
                      </Typography>
                      <Typography variant="body1" sx={{ color: getTextColor() }}>
                        {formatDate(selectedUser.submit_time)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                        客观题得分
                      </Typography>
                      {selectedUser.correct_status === 2 ? (
                        <Typography 
                          variant="body1" 
                          color={getTextColor()}
                        >
                          {selectedUser.c_objective_score || 0} 分
                        </Typography>
                      ) : (
                        <Typography variant="body1" sx={{ color: getSecondaryTextColor() }}>
                          未完成
                        </Typography>
                      )}
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                        主观题得分
                      </Typography>
                      {selectedUser.correct_status === 2 ? (
                        <Typography 
                          variant="body1" 
                          color={getTextColor()}
                        >
                          {selectedUser.c_subjective_score || 0} 分
                        </Typography>
                      ) : (
                        <Typography variant="body1" sx={{ color: getSecondaryTextColor() }}>
                          未完成
                        </Typography>
                      )}
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                        总得分
                      </Typography>
                      {selectedUser.correct_status === 2 ? (
                        <Typography 
                          variant="body1" 
                          color={selectedUser.score > 60 ? 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {selectedUser.score} 分
                        </Typography>
                      ) : (
                        <Typography variant="body1" sx={{ color: getSecondaryTextColor() }}>
                          未完成
                        </Typography>
                      )}
                    </Grid>
                  </>
                )}
                
              </Grid>

              {/* 成绩详情 */}
              {isExperiment && (
                <>
                  {renderScoreDetails()}
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          px: 3, 
          py: 2,
          backgroundColor: getHeaderBgColor()
        }}>
          <Button 
            onClick={() => setUserDetailOpen(false)}
            variant="contained"
            color="primary"
            sx={{
              backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
              color: '#fff',
              '&:hover': {
                backgroundColor: isDarkMode ? '#303f9f' : '#303f9f'
              }
            }}
          >
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TestUserDrawer;