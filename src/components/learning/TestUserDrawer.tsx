import React, { useState, useEffect } from 'react';
import { 
  Drawer, Box, Typography, Button, IconButton, 
  Toolbar, Divider, List, ListItem, ListItemText, 
  ListItemSecondaryAction, Chip, Avatar, Grid,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, InputAdornment, Checkbox, FormGroup,
  FormControlLabel, Paper, Chip as MuiChip
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
  [key: string]: any;
}

interface Paper {
  paperId: string;
  testId: string;
  totalScore: number;
  questionCount: number;
  paperName: string;
}

// 新增：接收删除相关 props
interface TestUserDrawerProps {
  open: boolean;
  onClose: () => void;
  test: TestData | null;
  testUsers: TestUser[];
  allUsers: any[];
  papers: Paper[];
  onSave: (users: TestUser[]) => Promise<void>;
  loading: boolean;
  onDeleteUser: (user: TestUser, e: React.MouseEvent) => void; // 删除触发函数
  deletingKey: string | null; // 删除加载状态标识
}

const TestUserDrawer: React.FC<TestUserDrawerProps> = ({ 
  open, onClose, test, testUsers = [], allUsers = [], papers = [], 
  onSave, loading, onDeleteUser, deletingKey 
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // 状态定义
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<TestUser | null>(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [searchUserText, setSearchUserText] = useState('');
  const [tempTestUsers, setTempTestUsers] = useState<TestUser[]>([]);

  // 动态颜色函数
  const getBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getHeaderBgColor = () => isDarkMode ? '#2a2a2a' : '#3f51b5';
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#000000';
  const getSecondaryTextColor = () => isDarkMode ? '#bbb' : '#666';
  const getCardBgColor = () => isDarkMode ? '#252525' : '#f9f9f9';
  const getBorderColor = () => isDarkMode ? '#444' : '#ddd';
  const getSearchBgColor = () => isDarkMode ? '#2d2d2d' : '#f5f5f5';

  // 计算可用用户
  useEffect(() => {
    if (open && test) {
      const associatedUserIds = testUsers.map(u => u.username).filter(id => id != null);
      const filteredUsers = allUsers.filter(user => 
        user.username && !associatedUserIds.includes(user.username)
      );
      setAvailableUsers(filteredUsers);
      setSelectedUsers([]);
      
      // 默认选择第一个试卷
      if (papers.length > 0) {
        setSelectedPaperId(papers[0].paperId);
      }
    }
    setSearchUserText('');
    setTempTestUsers([]);
  }, [open, test, testUsers, allUsers, papers]);

  // 搜索已关联用户
  const getFilteredTestUsers = () => {
    if (!searchUserText.trim()) {
      return testUsers;
    }
    const lowerSearchText = searchUserText.toLowerCase();
    return testUsers.filter(user => 
      user.username.toLowerCase().includes(lowerSearchText) || 
      user.name.toLowerCase().includes(lowerSearchText)
    );
  };

  // 处理用户选择变化
  const handleUserSelectionChange = (username: string) => {
    setSelectedUsers(prev => 
      prev.includes(username)
        ? prev.filter(u => u !== username)
        : [...prev, username]
    );
  };

  // 批量添加用户到测试
  const handleAddSelectedUsers = () => {
    if (selectedUsers.length === 0 || !selectedPaperId || !test?.c_id) {
      return;
    }
    
    const newUsers = selectedUsers.map(username => {
      const userInfo = allUsers.find(u => u.username === username);
      return {
        id: undefined,
        username,
        name: userInfo?.name || username,
        c_test_id: test.c_id,
        c_paper_id: selectedPaperId,
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

  // 处理搜索输入变化
  const handleSearchUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchUserText(e.target.value);
  };

  // 过滤可用用户
  const filteredAvailableUsers = availableUsers.filter(user => 
    user.username.toLowerCase().includes(searchUserText.toLowerCase()) ||
    user.name.toLowerCase().includes(searchUserText.toLowerCase())
  );

  // 生成当前用户的删除标识（与父组件一致）
  const getUserDeleteKey = (user: TestUser) => {
    return `${user.c_test_id}-${user.username}-${user.c_paper_id}`;
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
          
          {/* 试卷选择下拉框 */}
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
          </FormControl>
          
          {/* 搜索可用用户 */}
          <TextField
            size="small"
            placeholder="搜索用户..."
            value={searchUserText}
            onChange={handleSearchUserChange}
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
          
          {/* 可用用户列表 - 支持多选 */}
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
                    label={`${user.name} (${user.username})`}
                    sx={{
                      '& .MuiFormControlLabel-label': { color: getTextColor() },
                      '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                    }}
                  />
                ))}
              </FormGroup>
            )}
          </Box>
          
          {/* 添加按钮 */}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            endIcon={<ArrowRightIcon />}
            onClick={handleAddSelectedUsers}
            disabled={selectedUsers.length === 0 || !selectedPaperId || papers.length === 0 || loading}
            sx={{ 
              mb: 3,
              backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
              color: '#fff',
              '&:hover': {
                backgroundColor: isDarkMode ? '#303f9f' : '#303f9f'
              }
            }}
            fullWidth
          >
            添加选中用户 ({selectedUsers.length})
          </Button>
          
          {/* 待确认添加的用户 */}
          {tempTestUsers.length > 0 && (
            <Paper sx={{ 
              p: 2, 
              mb: 3, 
              backgroundColor: getCardBgColor(),
              border: `1px solid ${getBorderColor()}`
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: getTextColor() }}>
                待添加用户 ({tempTestUsers.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {tempTestUsers.map(user => (
                  <MuiChip
                    key={user.username}
                    label={`${user.name} (${papers.find(p => p.paperId === user.c_paper_id)?.paperName})`}
                    onDelete={() => {
                      setTempTestUsers(tempTestUsers.filter(u => u.username !== user.username));
                      setSelectedUsers(prev => [...prev, user.username]);
                    }}
                    size="small"
                    sx={{ 
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
              value={searchUserText}
              onChange={handleSearchUserChange}
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
                {searchUserText.trim() ? '未找到匹配的用户' : '暂无关联用户'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {searchUserText.trim() 
                  ? '请调整搜索词后重试' 
                  : '请使用上方表单添加用户到此测试'}
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {getFilteredTestUsers().map(user => {
                const paper = papers.find(p => p.paperId === user.c_paper_id);
                const currentDeleteKey = getUserDeleteKey(user);
                const isDeleting = deletingKey === currentDeleteKey; // 判断当前用户是否正在删除
                
                return (
                  <ListItem 
                    key={currentDeleteKey} // 使用删除标识作为key，确保删除时UI更新
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
                          <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
                            试卷: {paper?.paperName || user.c_paper_id}
                          </Typography>
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
                        disabled={isDeleting} // 删除时禁用详情按钮
                      >
                        <InfoIcon color="info" />
                      </IconButton>
                      
                      {/* 删除按钮 - 对接父组件的删除函数 */}
                      <IconButton 
                        edge="end" 
                        onClick={(e) => onDeleteUser(user, e)}
                        sx={{ color: isDarkMode ? '#f44336' : '#d32f2f' }}
                        disabled={isDeleting || !!user.submit_time || user.correct_status === 2} // 已交卷/删除中禁用
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

      {/* 用户详细信息弹窗 */}
      <Dialog
        open={userDetailOpen}
        onClose={() => setUserDetailOpen(false)}
        maxWidth="sm"
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
                    截止时间
                  </Typography>
                  <Typography variant="body1" sx={{ color: getTextColor() }}>
                    {formatDate(selectedUser.end_time)}
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
                    得分
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
              </Grid>
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
    
    
