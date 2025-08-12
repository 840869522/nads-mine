import React, { useState, useEffect } from 'react';
import { 
  Drawer, Box, Typography, Button, IconButton, 
  Toolbar, Divider, List, ListItem, ListItemText, 
  ListItemSecondaryAction, Chip, Avatar, Grid,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Check as CheckIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// 日期格式化函数（增强安全性）
const formatDate = (dateString) => {
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

const TestUserDrawer = ({ open, onClose, test, testUsers = [], allUsers = [], onSave }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [newUser, setNewUser] = useState('');
  const [newPaperId, setNewPaperId] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);

  // 动态颜色函数
  const getBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getHeaderBgColor = () => isDarkMode ? '#2a2a2a' : '#3f51b5';
  const getTextColor = () => isDarkMode ? '#f5f5f5' : '#000000';
  const getSecondaryTextColor = () => isDarkMode ? '#bbb' : '#666';
  const getCardBgColor = () => isDarkMode ? '#252525' : '#f9f9f9';
  const getBorderColor = () => isDarkMode ? '#444' : '#ddd';

  useEffect(() => {
    if (open && test) {
      // 安全地计算可用用户
      const associatedUserIds = testUsers.map(u => u.id).filter(id => id != null);
      const filteredUsers = allUsers.filter(user => 
        user.id && !associatedUserIds.includes(user.id)
      );
      setAvailableUsers(filteredUsers);
      
      // 设置默认值
      if (filteredUsers.length > 0) {
        setNewUser(filteredUsers[0].id);
      }
      setNewPaperId(`paper-${Math.floor(Math.random() * 1000)}`);
    }
  }, [open, test, testUsers, allUsers]);

  const handleAddUser = () => {
    if (!newUser || !newPaperId) return;
    
    const userToAdd = allUsers.find(u => u.id === newUser);
    if (!userToAdd) return;
    
    const newUserAssociation = {
      ...userToAdd,
      c_test_id: test?.c_id || '',
      c_paper_id: newPaperId,
      c_answers: JSON.stringify([]),
      c_start: new Date().toISOString(),
      c_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天后
      c_submit: null,
      c_score: 0,
      c_correct: 1
    };
    
    onSave([...testUsers, newUserAssociation]);
    
    // 重置表单
    const updatedAvailableUsers = availableUsers.filter(u => u.id !== newUser);
    setAvailableUsers(updatedAvailableUsers);
    
    if (updatedAvailableUsers.length > 0) {
      setNewUser(updatedAvailableUsers[0].id);
    } else {
      setNewUser('');
    }
    
    setNewPaperId(`paper-${Math.floor(Math.random() * 1000)}`);
  };

  const handleRemoveUser = (userId, e) => {
    e.stopPropagation();
    const updatedUsers = testUsers.filter(u => u.id !== userId);
    onSave(updatedUsers);
    
    // 将用户添加回可用列表
    const removedUser = allUsers.find(u => u.id === userId);
    if (removedUser) {
      setAvailableUsers([...availableUsers, removedUser]);
    }
  };

  const handleOpenDetail = (user, e) => {
    e.stopPropagation();
    setSelectedUser(user);
    setUserDetailOpen(true);
  };

  const getStatusLabel = (status) => {
    return status === 2 ? '已完成' : '未完成';
  };

  const getStatusColor = (status) => {
    return status === 2 ? 'success' : 'warning';
  };

  const renderScore = (user) => {
    if (user.c_correct === 2) {
      return (
        <Typography variant="body2" color={user.c_score > 60 ? 'success.main' : 'error.main'}>
          分数: {user.c_score}
        </Typography>
      );
    }
    return (
      <Typography variant="body2" color={getSecondaryTextColor()}>
        分数: 未完成
      </Typography>
    );
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
        
        <Box sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: getTextColor() }}>
            添加用户到测试
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 180, flexGrow: 1 }}>
              <InputLabel sx={{ color: getSecondaryTextColor() }}>选择用户</InputLabel>
              <Select
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                label="选择用户"
                disabled={availableUsers.length === 0}
                sx={{ color: getTextColor() }}
              >
                {availableUsers.map(user => (
                  <MenuItem key={user.id} value={user.id} sx={{ color: getTextColor() }}>
                    {user.name} ({user.username})
                  </MenuItem>
                ))}
                {availableUsers.length === 0 && (
                  <MenuItem disabled sx={{ color: getSecondaryTextColor() }}>无可用用户</MenuItem>
                )}
              </Select>
            </FormControl>
            
            <TextField
              label="试卷ID"
              value={newPaperId}
              onChange={(e) => setNewPaperId(e.target.value)}
              fullWidth
              sx={{ flexGrow: 1 }}
              InputLabelProps={{ style: { color: getSecondaryTextColor() } }}
              InputProps={{ style: { color: getTextColor() } }}
            />
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddUser}
              disabled={!newUser || !newPaperId || availableUsers.length === 0}
              sx={{ 
                height: 56, 
                alignSelf: 'flex-end',
                backgroundColor: isDarkMode ? '#3f51b5' : '#3f51b5',
                color: '#fff',
                '&:hover': {
                  backgroundColor: isDarkMode ? '#303f9f' : '#303f9f'
                }
              }}
            >
              添加
            </Button>
          </Box>
          
          <Divider sx={{ my: 3, borderColor: getBorderColor() }} />
          
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mb: 2, color: getTextColor() }}>
            已关联用户 ({testUsers.length})
          </Typography>
          
          {testUsers.length === 0 ? (
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
              <Typography variant="body1">暂无关联用户</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                请使用上方表单添加用户到此测试
              </Typography>
            </Box>
          ) : (
            <List sx={{ maxHeight: 500, overflow: 'auto' }}>
              {testUsers.map(user => (
                <ListItem 
                  key={user.id}
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
                    {user.name?.charAt(0) || '?'}
                  </Avatar>
                  <ListItemText
                    primary={<Typography sx={{ color: getTextColor() }}>{user.name || '未知用户'}</Typography>}
                    secondary={
                      <>
                        <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
                          {user.username || '无用户名'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
                          试卷: {user.c_paper_id}
                        </Typography>
                      </>
                    }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mr: 10 }}>
                    <Chip 
                      label={getStatusLabel(user.c_correct)} 
                      size="small" 
                      color={getStatusColor(user.c_correct)}
                      sx={{ mb: 1 }}
                    />
                    {renderScore(user)}
                  </Box>
                  <ListItemSecondaryAction>
                    {/* 查看详情按钮 */}
                    <IconButton 
                      edge="end" 
                      onClick={(e) => handleOpenDetail(user, e)}
                      sx={{ mr: 1 }}
                    >
                      <InfoIcon color="info" />
                    </IconButton>
                    
                    {/* 删除按钮 */}
                    <IconButton 
                      edge="end" 
                      onClick={(e) => handleRemoveUser(user.id, e)}
                      sx={{ color: isDarkMode ? '#f44336' : '#d32f2f' }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
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
                  {selectedUser.name?.charAt(0) || '?'}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: getTextColor() }}>
                    {selectedUser.name || '未知用户'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: getSecondaryTextColor() }}>
                    {selectedUser.username || '无用户名'}
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2, borderColor: getBorderColor() }} />
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                    试卷ID
                  </Typography>
                  <Typography variant="body1" sx={{ color: getTextColor() }}>
                    {selectedUser.c_paper_id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                    测试状态
                  </Typography>
                  <Chip 
                    label={getStatusLabel(selectedUser.c_correct)} 
                    color={getStatusColor(selectedUser.c_correct)}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                    开始时间
                  </Typography>
                  <Typography variant="body1" sx={{ color: getTextColor() }}>
                    {formatDate(selectedUser.c_start)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                    截止时间
                  </Typography>
                  <Typography variant="body1" sx={{ color: getTextColor() }}>
                    {formatDate(selectedUser.c_end)}
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                    提交时间
                  </Typography>
                  <Typography variant="body1" sx={{ color: getTextColor() }}>
                    {formatDate(selectedUser.c_submit)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" sx={{ color: getSecondaryTextColor() }}>
                    得分
                  </Typography>
                  {selectedUser.c_correct === 2 ? (
                    <Typography 
                      variant="body1" 
                      color={selectedUser.c_score > 60 ? 'success.main' : 'error.main'}
                      fontWeight="bold"
                    >
                      {selectedUser.c_score} 分
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

