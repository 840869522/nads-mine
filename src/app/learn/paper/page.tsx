// src/PaperManagementSystem.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, Box, Card, CardContent, Typography, Chip, 
  CircularProgress, IconButton, Grid, MenuItem, Select, FormControl, InputLabel,
  useTheme
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';

type QuestionType = '单选题' | '多选题' | '判断题' | '主观题';

interface RuleItem {
  type: QuestionType;
  count: number;
  score: number;
}

interface Rule {
  id: string;
  testId: string;
  ruleId: string;
  tag: string;
  items: RuleItem[];
}

interface Question {
  id: string;
  type: QuestionType;
  content: string;
  score: number;
  options?: string[];
}

interface Paper {
  testId: string;
  title: string;
  totalScore: number;
  duration: number;
  questions: Question[];
}

// 本地存储键名
const RULES_STORAGE_KEY = 'paperManagementRules';

const PaperManagementSystem: React.FC = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 初始化规则数据 - 从localStorage加载
  useEffect(() => {
    const savedRules = localStorage.getItem(RULES_STORAGE_KEY);
    if (savedRules) {
      try {
        setRules(JSON.parse(savedRules));
      } catch (error) {
        console.error('解析保存的规则失败:', error);
        initializeDefaultRules();
      }
    } else {
      initializeDefaultRules();
    }
  }, []);

  // 保存规则到localStorage
  useEffect(() => {
    if (rules.length > 0) {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
    }
  }, [rules]);

  // 初始化默认规则
  const initializeDefaultRules = () => {
    const mockRules: Rule[] = [
      {
        id: '1',
        testId: 'EXAM2023-001',
        ruleId: 'R001',
        tag: 'JavaScript基础',
        items: [
          { type: '单选题', count: 5, score: 2 },
          { type: '多选题', count: 3, score: 5 },
          { type: '判断题', count: 2, score: 1 },
          { type: '主观题', count: 1, score: 10 }
        ]
      },
      {
        id: '2',
        testId: 'EXAM2023-001',
        ruleId: 'R002',
        tag: 'React框架',
        items: [
          { type: '单选题', count: 4, score: 2 },
          { type: '多选题', count: 2, score: 4 },
          { type: '判断题', count: 3, score: 1 },
          { type: '主观题', count: 2, score: 15 }
        ]
      },
      {
        id: '3',
        testId: 'EXAM2023-002',
        ruleId: 'R003',
        tag: '全栈开发',
        items: [
          { type: '单选题', count: 8, score: 2 },
          { type: '多选题', count: 4, score: 3 },
          { type: '判断题', count: 5, score: 1 },
          { type: '主观题', count: 3, score: 12 }
        ]
      }
    ];
    setRules(mockRules);
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(mockRules));
  };

  const handleSubmit = () => {
    if (editingRule) {
      // 更新规则
      const updatedRules = rules.map(rule => 
        rule.id === editingRule.id ? editingRule : rule
      );
      setRules(updatedRules);
    } else {
      // 添加新规则
      const newRule: Rule = {
        id: `rule-${Date.now()}`,
        testId: 'EXAM2023-001',
        ruleId: `R${rules.length + 100}`,
        tag: '新标签',
        items: [
          { type: '单选题', count: 0, score: 0 },
          { type: '多选题', count: 0, score: 0 },
          { type: '判断题', count: 0, score: 0 },
          { type: '主观题', count: 0, score: 0 }
        ]
      };
      setRules([...rules, newRule]);
    }
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule({...rule});
    setIsModalOpen(true);
  };

  const handleDelete = (rule: Rule) => {
    if (window.confirm(`确定要删除规则 ${rule.ruleId} 吗？`)) {
      const updatedRules = rules.filter(r => r.id !== rule.id);
      setRules(updatedRules);
    }
  };

  // 根据规则ID生成试卷
  const handleGeneratePaper = (ruleId: string) => {
    setLoading(true);
    
    setTimeout(() => {
      setLoading(false);
      
      // 找到选中的规则
      const rule = rules.find(r => r.ruleId === ruleId);
      if (!rule) return;
      
      // 计算该规则的总分
      const totalScore = rule.items.reduce((sum, item) => sum + (item.count * item.score), 0);
      
      // 生成试卷题目
      const questions: Question[] = [];
      let questionId = 1;
      
      rule.items.forEach(item => {
        for (let i = 0; i < item.count; i++) {
          questions.push({
            id: `Q${questionId++}`,
            type: item.type,
            content: `${item.type}题目 ${i + 1} (${rule.tag})`,
            score: item.score,
            options: item.type !== '主观题' ? ['选项A', '选项B', '选项C', '选项D'] : undefined
          });
        }
      });
      
      // 生成试卷
      const paper: Paper = {
        testId: rule.testId,
        title: `试卷 - ${rule.ruleId} (${rule.tag})`,
        totalScore: totalScore,
        duration: 120,
        questions: questions
      };
      
      setGeneratedPaper(paper);
      setIsPaperModalOpen(true);
    }, 1500);
  };

  const getTypeColor = (type: QuestionType) => {
    switch (type) {
      case '单选题': return 'primary';
      case '多选题': return 'secondary';
      case '判断题': return 'warning';
      case '主观题': return 'success';
      default: return 'default';
    }
  };

  // 更新规则项的值
  const handleRuleItemChange = (index: number, field: 'count' | 'score', value: number) => {
    if (!editingRule) return;
    
    const updatedItems = [...editingRule.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    setEditingRule({
      ...editingRule,
      items: updatedItems
    });
  };

  // 更新规则基本信息
  const handleRuleFieldChange = (field: keyof Rule, value: string) => {
    if (editingRule) {
      setEditingRule({
        ...editingRule,
        [field]: value
      });
    } else {
      // 添加新规则时的处理
      setEditingRule({
        id: `rule-${Date.now()}`,
        testId: 'EXAM2023-001',
        ruleId: field === 'ruleId' ? value : '',
        tag: field === 'tag' ? value : '',
        items: [
          { type: '单选题', count: 0, score: 0 },
          { type: '多选题', count: 0, score: 0 },
          { type: '判断题', count: 0, score: 0 },
          { type: '主观题', count: 0, score: 0 }
        ]
      });
    }
  };

  // 处理测试ID变更
  const handleTestIdChange = (value: string) => {
    if (editingRule) {
      setEditingRule({
        ...editingRule,
        testId: value
      });
    } else {
      setEditingRule({
        id: `rule-${Date.now()}`,
        testId: value,
        ruleId: '',
        tag: '',
        items: [
          { type: '单选题', count: 0, score: 0 },
          { type: '多选题', count: 0, score: 0 },
          { type: '判断题', count: 0, score: 0 },
          { type: '主观题', count: 0, score: 0 }
        ]
      });
    }
  };

  // 获取当前编辑的规则
  const getCurrentRule = () => {
    if (editingRule) return editingRule;
    
    return {
      id: `rule-${Date.now()}`,
      testId: 'EXAM2023-001',
      ruleId: '',
      tag: '',
      items: [
        { type: '单选题', count: 0, score: 0 },
        { type: '多选题', count: 0, score: 0 },
        { type: '判断题', count: 0, score: 0 },
        { type: '主观题', count: 0, score: 0 }
      ]
    };
  };

  const currentRule = getCurrentRule();

  // 获取背景颜色
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
      <Box sx={{ 
        maxWidth: 1200, 
        mx: 'auto',
      }}>
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
              mb: 3
            }}>
              <Typography variant="h5" component="div">
                试卷规则管理系统
              </Typography>
              
              <Box>
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingRule(null);
                    setIsModalOpen(true);
                  }}
                  sx={{ mr: 2 }}
                >
                  添加规则
                </Button>
              </Box>
            </Box>
            
            <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor() }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>规则ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>标签</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>单选题</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>多选题</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>判断题</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>主观题</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.map((rule, index) => (
                    <TableRow 
                      key={rule.id}
                      sx={{ backgroundColor: getTableRowBgColor(index) }}
                    >
                      <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>{rule.ruleId}</TableCell>
                      <TableCell>
                        <Chip 
                          label={rule.tag} 
                          color="primary" 
                          size="small" 
                          sx={{ color: '#fff' }}
                        />
                      </TableCell>
                      
                      {/* 各题型统计 */}
                      {rule.items.map((item, idx) => (
                        <TableCell key={idx} sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                          {item.count > 0 ? (
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {item.count}题
                              </Typography>
                              <Typography variant="body2">
                                {item.score}分/题
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#f44336', mt: 0.5 }}>
                                共{item.count * item.score}分
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                              未设置
                            </Typography>
                          )}
                        </TableCell>
                      ))}
                      
                      <TableCell>
                        <IconButton 
                          onClick={() => handleEdit(rule)}
                          sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          onClick={() => handleDelete(rule)}
                          sx={{ color: isDarkMode ? '#f48fb1' : '#d32f2f' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                        <IconButton 
                          onClick={() => handleGeneratePaper(rule.ruleId)}
                          color="secondary"
                          sx={{ color: isDarkMode ? '#00ffcc6a' : '#00ffcc6a' }}
                        >
                          <PdfIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
        
        {/* 规则编辑模态框 */}
        <Dialog 
          open={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          fullWidth
          maxWidth="md"
          sx={{
            '& .MuiDialog-paper': {
              backgroundColor: getCardBgColor(),
              color: isDarkMode ? '#ffffff' : '#000000'
            }
          }}
        >
          <DialogTitle sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
            {editingRule ? "编辑组卷规则" : "添加新组卷规则"}
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="规则ID"
                  value={currentRule.ruleId}
                  onChange={(e) => handleRuleFieldChange('ruleId', e.target.value)}
                  fullWidth
                  variant="outlined"
                  sx={{ mb: 2 }}
                  InputLabelProps={{ style: { color: isDarkMode ? '#bbb' : '#666' } }}
                  InputProps={{ style: { color: isDarkMode ? '#fff' : '#000' } }}
                />
                
                <TextField
                  label="试题标签"
                  value={currentRule.tag}
                  onChange={(e) => handleRuleFieldChange('tag', e.target.value)}
                  fullWidth
                  variant="outlined"
                  sx={{ mb: 2 }}
                  InputLabelProps={{ style: { color: isDarkMode ? '#bbb' : '#666' } }}
                  InputProps={{ style: { color: isDarkMode ? '#fff' : '#000' } }}
                />
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: isDarkMode ? '#bbb' : '#666' }}>测试ID</InputLabel>
                  <Select
                    value={currentRule.testId}
                    onChange={(e) => handleTestIdChange(e.target.value as string)}
                    label="测试ID"
                    sx={{ color: isDarkMode ? '#fff' : '#000' }}
                  >
                    <MenuItem value="EXAM2023-001">EXAM2023-001</MenuItem>
                    <MenuItem value="EXAM2023-002">EXAM2023-002</MenuItem>
                    <MenuItem value="EXAM2023-003">EXAM2023-003</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ mb: 2, color: isDarkMode ? '#ddd' : '#333' }}>
                  题型设置
                </Typography>
                
                {currentRule.items.map((item, index) => (
                  <Box key={index} sx={{ 
                    mb: 2, 
                    p: 2, 
                    border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                    borderRadius: 1,
                    backgroundColor: isDarkMode ? '#252525' : '#f9f9f9'
                  }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 1.5,
                      borderBottom: `1px solid ${isDarkMode ? '#444' : '#eee'}`,
                      pb: 1
                    }}>
                      <Chip 
                        label={item.type} 
                        color={getTypeColor(item.type)} 
                        size="medium" 
                        sx={{ 
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: '0.9rem'
                        }}
                      />
                      <Typography sx={{ ml: 'auto', fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>
                        总分: {item.count * item.score}分
                      </Typography>
                    </Box>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          label="试题数量"
                          type="number"
                          value={item.count}
                          onChange={(e) => handleRuleItemChange(index, 'count', parseInt(e.target.value) || 0)}
                          fullWidth
                          variant="outlined"
                          InputProps={{ 
                            inputProps: { min: 0, max: 100 },
                            style: { color: isDarkMode ? '#fff' : '#000' }
                          }}
                          InputLabelProps={{ style: { color: isDarkMode ? '#bbb' : '#666' } }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="每题分数"
                          type="number"
                          value={item.score}
                          onChange={(e) => handleRuleItemChange(index, 'score', parseInt(e.target.value) || 0)}
                          fullWidth
                          variant="outlined"
                          InputProps={{ 
                            inputProps: { min: 0, max: 100 },
                            style: { color: isDarkMode ? '#fff' : '#000' }
                          }}
                          InputLabelProps={{ style: { color: isDarkMode ? '#bbb' : '#666' } }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ 
            px: 3, py: 2,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5'
          }}>
            <Button 
              onClick={() => setIsModalOpen(false)}
              sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
            >
              取消
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              color="primary"
            >
              {editingRule ? "更新规则" : "添加规则"}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* 试卷预览模态框 */}
        <Dialog
          open={isPaperModalOpen}
          onClose={() => setIsPaperModalOpen(false)}
          maxWidth="md"
          fullWidth
          sx={{
            '& .MuiDialog-paper': {
              backgroundColor: getCardBgColor(),
              color: isDarkMode ? '#ffffff' : '#000000'
            }
          }}
        >
          <DialogTitle sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
            {generatedPaper?.title || "试卷预览"}
          </DialogTitle>
          <DialogContent dividers>
            {generatedPaper && (
              <Box sx={{ p: 2 }}>
                <Box sx={{ 
                  textAlign: 'center', 
                  mb: 3, 
                  pb: 2,
                  borderBottom: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: 3,
                    flexWrap: 'wrap'
                  }}>
                    <Typography variant="body1" sx={{ color: isDarkMode ? '#bbb' : '#666' }}>
                      规则ID: <strong style={{ color: isDarkMode ? '#fff' : '#000' }}>{generatedPaper.testId}</strong>
                    </Typography>
                    <Typography variant="body1" sx={{ color: isDarkMode ? '#bbb' : '#666' }}>
                      总分: <strong style={{ color: isDarkMode ? '#fff' : '#000' }}>{generatedPaper.totalScore}分</strong>
                    </Typography>
                    <Typography variant="body1" sx={{ color: isDarkMode ? '#bbb' : '#666' }}>
                      考试时长: <strong style={{ color: isDarkMode ? '#fff' : '#000' }}>{generatedPaper.duration}分钟</strong>
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                  {generatedPaper.questions.map((q, index) => (
                    <Box 
                      key={q.id} 
                      sx={{ 
                        mb: 3, 
                        p: 2, 
                        backgroundColor: isDarkMode ? '#252525' : '#f9f9f9',
                        borderLeft: `4px solid ${
                          q.type === '单选题' ? '#3f51b5' : 
                          q.type === '多选题' ? '#f50057' : 
                          q.type === '判断题' ? '#ff9800' : 
                          '#4caf50'
                        }`,
                        borderRadius: '0 4px 4px 0'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" sx={{ 
                          mr: 1,
                          color: isDarkMode ? '#fff' : '#000'
                        }}>
                          {index + 1}.
                        </Typography>
                        <Chip 
                          label={q.type} 
                          color={
                            q.type === '单选题' ? 'primary' : 
                            q.type === '多选题' ? 'secondary' : 
                            q.type === '判断题' ? 'warning' : 'success'
                          } 
                          size="small" 
                          sx={{ mr: 1, color: '#fff' }}
                        />
                        <Typography sx={{ 
                          ml: 'auto', 
                          color: '#f44336', 
                          fontWeight: 'bold'
                        }}>
                          {q.score}分
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ 
                        mb: 1,
                        fontWeight: 'medium',
                        color: isDarkMode ? '#ddd' : '#333'
                      }}>
                        {q.content}
                      </Typography>
                      
                      {q.options && (
                        <Box sx={{ pl: 3 }}>
                          {q.options.map((opt, i) => (
                            <Box 
                              key={i} 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 0.5 
                              }}
                            >
                              <Box sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mr: 1,
                                fontWeight: 'bold',
                                color: isDarkMode ? '#fff' : '#000'
                              }}>
                                {String.fromCharCode(65 + i)}
                              </Box>
                              <Typography variant="body2" sx={{ color: isDarkMode ? '#ddd' : '#333' }}>
                                {opt}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ 
            px: 3, py: 2,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5'
          }}>
            <Button 
              onClick={() => setIsPaperModalOpen(false)}
              sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
            >
              关闭
            </Button>
            <Button 
              variant="contained" 
              startIcon={<PdfIcon />}
              color="primary"
            >
              导出PDF
            </Button>
          </DialogActions>
        </Dialog>
        
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
                试卷生成中，请稍候...
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PaperManagementSystem;