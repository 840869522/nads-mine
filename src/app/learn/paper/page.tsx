"use client";
import React, { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, 
  TextField, Box, Card, CardContent, Typography, Chip, 
  CircularProgress, IconButton, Grid, FormControl, InputAdornment,
  useTheme, MenuItem, Select, Alert
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  PictureAsPdf as PdfIcon,
  Description as WordIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { apiClientWithToken } from "@/utils/axios";

type QuestionType = '单选题' | '多选题' | '判断题' | '主观题';

interface RuleItem {
  key: string; // 规则唯一标识（对应后端的c_id）
  tag: string;
  count: number;
  score: number;
  type: number; // 1: 单选题, 2: 多选题, 3: 判断题, 4: 主观题
}

interface Rule {
  testId: string;
  testName: string;
  items: RuleItem[];
}

interface Question {
  id: string;
  type: QuestionType;
  content: string;
  score: number;
  answer: string;
  options?: {content: string}[];
}

interface Paper {
  paperId: string;
  testId: string;
  totalScore: number;
  questions: Question[];
  questionCount?: number;
}

const PaperManagementSystem: React.FC = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editLoading, setEditLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  
  const [inputTestId, setInputTestId] = useState('');
  const [fetchedPapers, setFetchedPapers] = useState<Paper[]>([]);
  const [isPaperListModalOpen, setIsPaperListModalOpen] = useState(false);
  const [loadingPaperDetails, setLoadingPaperDetails] = useState(false);

  // 题型映射
  const questionTypeMap: Record<number, QuestionType> = {
    1: '单选题',
    2: '多选题',
    3: '判断题',
    4: '主观题'
  };

  // 题型颜色映射
  const typeColorMap: Record<number, 'primary' | 'secondary' | 'warning' | 'success'> = {
    1: 'primary',
    2: 'secondary',
    3: 'warning',
    4: 'success'
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // 获取所有规则（修复字段映射问题）
  const fetchRules = async () => {
    setLoading(true);
    try {
      const apiUrl = '/back/api/study/test/get_all_paper_rules';
      console.log('请求规则列表接口:', apiUrl);
      
      const response = await apiClientWithToken.get(apiUrl);
      console.log('接口返回原始数据:', response.data);
      
      // 正确提取后端返回的数据（后端数据在data字段中）
      const rawData = response.data || {};
      const rawRules = Array.isArray(rawData.data) ? rawData.data : [];
      
      console.log('提取的原始规则数据:', rawRules);
      
      // 转换数据结构为前端需要的格式（关键修复：使用后端返回的实际字段名）
      const transformedRules = rawRules.map((rule: any) => ({
        testId: rule.testId || rule.c_test_id || '未知ID',
        testName: rule.testName || '未知名称',
        // 修复：使用后端返回的items数组，字段名无需c_前缀
        items: (Array.isArray(rule.items) ? rule.items : []).map((item: any) => ({
          key: item.key || '',         // 规则唯一标识（对应后端c_id）
          tag: item.tag || '',         // 修复：使用tag而非c_tag
          type: Number(item.type) || 1, // 修复：转换为数字类型
          count: Number(item.count) || 0, // 修复：转换为数字类型
          score: Number(item.score) || 0  // 修复：转换为数字类型
        }))
      }));
      
      setRules(transformedRules);
    } catch (error: any) {
      console.error('获取规则失败详情:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  // 从已加载的规则中直接获取数据
  const handleEdit = (testId: string) => {
    const rule = rules.find(r => r.testId === testId);
    
    if (rule) {
      setEditingRule({...rule});
      setIsModalOpen(true);
      setFormErrors({});
      setSaveError('');
    } else {
      fetchRuleFromApi(testId);
    }
  };

  // 从API获取规则（修复字段映射）
  const fetchRuleFromApi = async (testId: string) => {
    setEditLoading(true);
    try {
      const response = await apiClientWithToken.post(`/back/api/study/test/get_paper_rules_info?test_id=${testId}`);
      const ruleData = response.data?.data || {};
      const items: RuleItem[] = [];

      // 后端返回的题型键映射
      const typeMap = {
        single_choice: 1,
        multiple_choice: 2,
        true_or_false: 3,
        subjective: 4
      };

      // 解析后端数据
      Object.entries(ruleData).forEach(([typeKey, itemData]: [string, any]) => {
        if (itemData && typeMap[typeKey as keyof typeof typeMap]) {
          items.push({
            key: itemData.key || '',
            tag: itemData.tag || '',
            count: Number(itemData.count) || 1,
            score: Number(itemData.score) || 1,
            type: typeMap[typeKey as keyof typeof typeMap] || 1
          });
        }
      });

      setEditingRule({ 
        testId, 
        testName: '',
        items 
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error('加载规则失败:', error);
      alert(`加载规则失败: ${(error as any)?.response?.data?.message || (error as Error).message}`);
    } finally {
      setEditLoading(false);
    }
  };

  // 表单验证
  const validateRule = (rule: Rule): boolean => {
    const errors: Record<string, string> = {};

    // 验证test_id
    if (!rule.testId.trim()) {
      errors.testId = '测试ID不能为空';
    } else if (rule.testId.length > 50) {
      errors.testId = '测试ID不能超过50个字符';
    }

    // 验证至少有一个规则项
    if (rule.items.length === 0) {
      errors.emptyItems = '至少需要添加一个规则项';
      setFormErrors(errors);
      return false;
    }

    // 验证每个规则项
    rule.items.forEach((item, index) => {
      const typeName = questionTypeMap[item.type];

      // 验证tag
      if (!item.tag.trim()) {
        errors[`item_${index}_tag`] = `${typeName}标签不能为空`;
      } else if (item.tag.length > 50) {
        errors[`item_${index}_tag`] = `${typeName}标签不能超过50个字符`;
      }

      // 验证count
      if (!Number.isInteger(item.count) || item.count <= 0) {
        errors[`item_${index}_count`] = `${typeName}题数必须是大于0的整数`;
      }

      // 验证score
      if (!Number.isInteger(item.score) || item.score <= 0) {
        errors[`item_${index}_score`] = `${typeName}分数必须是大于0的整数`;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 删除规则处理函数
  const handleDeleteRule = async (testId: string) => {
    if (!testId || testId.trim() === '') {
      alert('测试ID不能为空，无法执行删除操作');
      return;
    }
    
    if (!window.confirm(`确定要删除测试ID为 ${testId} 的所有组卷规则吗？此操作不可撤销，且会删除关联试卷！`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await apiClientWithToken.post(
        '/back/api/study/test/paper_rules_del', 
        { params: { test_id: testId.trim() } }
      );
      
      if (response.data?.code === 200) {
        alert('删除成功！');
        fetchRules(); // 重新加载规则列表
      } else {
        alert(`删除失败: ${response.data?.message || '服务器未知错误'}`);
      }
    } catch (error: any) {
      console.error('删除规则失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '网络错误';
      alert(`删除失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

 // 修复准备提交给后端的规则数据函数
const prepareRuleData = (rule: Rule) => {
  const requestData: any = { 
    test_id: rule.testId.trim()
  };
  
  // 题型映射：前端type -> 后端字段名
  const typeMap = {
    1: 'single_choice',
    2: 'multiple_choice',
    3: 'true_or_false',
    4: 'subjective'
  };
  
  // 只添加有数据的题型
  rule.items.forEach(item => {
    const typeKey = typeMap[item.type as keyof typeof typeMap];
    if (typeKey) {
      // 确保key是字符串类型，避免trim()错误
      const keyValue = typeof item.key === 'string' ? item.key : String(item.key || '');
      
      requestData[typeKey] = {
        key: keyValue.trim(), // 现在可以安全调用trim()
        tag: (item.tag || '').trim(), // 同样处理tag
        count: Number.isInteger(item.count) ? item.count : Math.floor(item.count),
        score: Number.isInteger(item.score) ? item.score : Math.floor(item.score)
      };
    }
  });
  
  return requestData;
};

  // 添加规则
  const addRule = async (rule: Rule) => {
    if (!validateRule(rule)) return false;
    
    try {
      const requestData = prepareRuleData(rule);
      const response = await apiClientWithToken.post('/back/api/study/test/paper_rules_add', requestData);
      
      if (response.data?.code === 200) {
        fetchRules();
        return true;
      } else {
        const errorMsg = response.data?.message || '未知错误';
        setSaveError(`添加失败: ${errorMsg}`);
        return false;
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      setSaveError(`添加失败: ${errorMsg}`);
      return false;
    }
  };

  // 更新规则
  const updateRule = async (rule: Rule) => {
    if (!validateRule(rule)) return false;
    
    try {
      const requestData = prepareRuleData(rule);
      const response = await apiClientWithToken.post('/back/api/study/test/paper_rules_update', requestData);
      
      if (response.data?.code === 200) {
        fetchRules();
        return true;
      } else {
        setSaveError(`更新失败 [${response.data?.code}]: ${response.data?.message || '未知错误'}`);
        return false;
      }
    } catch (error: any) {
      const errorDetails = error.response?.data ? 
        `[${error.response.data.code}]: ${error.response.data.message}` : 
        error.message;
      setSaveError(`更新失败: ${errorDetails}`);
      return false;
    }
  };

  // 处理规则提交
  const handleSubmit = async () => {
    if (!editingRule) return;
    
    setEditLoading(true);
    setSaveError('');
    
    const success = rules.some(r => r.testId === editingRule.testId)
      ? await updateRule(editingRule)
      : await addRule(editingRule);
    
    if (success) {
      setIsModalOpen(false);
      setEditingRule(null);
      setFormErrors({});
    }
    setEditLoading(false);
  };

  // 初始化新规则项
  const [newRuleItem, setNewRuleItem] = useState<RuleItem>({
    key: '',
    tag: '',
    count: 1,
    score: 1,
    type: 1
  });

  // 添加规则项
  const handleAddRuleItem = () => {
    if (!editingRule) return;
    
    // 基础验证
    const tempErrors: Record<string, string> = {};
    const typeName = questionTypeMap[newRuleItem.type];
    
    if (!newRuleItem.tag.trim()) tempErrors.tag = `${typeName}标签不能为空`;
    if (newRuleItem.count <= 0) tempErrors.count = `${typeName}题数必须大于0`;
    if (newRuleItem.score <= 0) tempErrors.score = `${typeName}分数必须大于0`;
    
    if (Object.keys(tempErrors).length > 0) {
      setFormErrors(tempErrors);
      return;
    }
    
    // 添加新规则项
    setEditingRule({
      ...editingRule,
      items: [...editingRule.items, newRuleItem]
    });
    
    // 重置新规则项表单
    setNewRuleItem({
      key: '',
      tag: '',
      count: 1,
      score: 1,
      type: newRuleItem.type
    });
    
    setFormErrors({});
  };

  // 删除规则项
  const handleRemoveRuleItem = (index: number) => {
    if (!editingRule) return;
    
    if (editingRule.items.length <= 1) {
      alert('至少保留一个规则项');
      return;
    }
    
    const updatedItems = [...editingRule.items];
    updatedItems.splice(index, 1);
    
    setEditingRule({
      ...editingRule,
      items: updatedItems
    });
  };

// 修改规则项更新函数，确保key始终为字符串
const handleRuleItemChange = (index: number, field: string, value: string | number) => {
  if (!editingRule) return;
  const updatedItems = [...editingRule.items];
  
  // 处理key字段，确保为字符串
  let processedValue = value;
  if (field === 'key') {
    processedValue = typeof value === 'string' ? value : String(value || '');
  }
  // 处理count和score：转换为整数，最小为1
  else if (field === 'count' || field === 'score') {
    processedValue = Math.max(1, parseInt(value.toString(), 10) || 1);
  }
  
  updatedItems[index] = {
   ...updatedItems[index],
    [field]: processedValue
  };
  
  setEditingRule({...editingRule, items: updatedItems});
  const newErrors = {...formErrors};
  delete newErrors[`item_${index}_${field}`];
  setFormErrors(newErrors);
};

  // 过滤规则
  const filteredRules = Array.isArray(rules) 
    ? rules.filter(rule => {
        if (!searchTerm) return true;
        if (rule.testId?.toLowerCase().includes(searchTerm.toLowerCase())) return true;
        if (rule.testName?.toLowerCase().includes(searchTerm.toLowerCase())) return true;
        return rule.items?.some(item => 
          item.tag?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
    : [];

  // 样式辅助函数
  const getBgColor = () => isDarkMode ? '#121212' : '#f5f5f5';
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTableRowBgColor = (index: number) => 
    isDarkMode 
      ? (index % 2 === 0 ? '#252525' : '#1e1e1e') 
      : (index % 2 === 0 ? '#fafafa' : '#ffffff');

  // 获取试卷列表
  const handleQueryPapers = async (testId: string) => {
    setInputTestId(testId);
    setLoading(true);
    try {
      const response = await apiClientWithToken.get(`/back/api/study/test/get_papers?test_id=${testId}`);
      
      let papers = Array.isArray(response.data?.data) ? response.data.data : [];
      
      papers = papers.map((paper: any) => ({
        ...paper,
        questionCount: paper.questionCount ? parseInt(paper.questionCount, 10) || 0 : 
                      (Array.isArray(paper.questions) ? paper.questions.length : 0),
        questions: Array.isArray(paper.questions) ? paper.questions : []
      }));
      
      setFetchedPapers(papers);
      setIsPaperListModalOpen(true);
    } catch (error) {
      console.error('获取试卷失败:', error);
      setFetchedPapers([]);
      alert('获取试卷失败，请检查测试ID是否正确');
    } finally {
      setLoading(false);
    }
  };

  // 获取试卷详情
  const fetchPaperDetails = async (paperId: string) => {
    setLoadingPaperDetails(true);
    try {
      const response = await apiClientWithToken.get(
        '/back/api/study/test/get_paper_details', 
        { params: { paper_id: paperId } }
      );
      
      const paperData = response.data?.data || null;
      if (!paperData) return null;

      const questions = Array.isArray(paperData.questions) ? paperData.questions : [];
      
      const questionsWithAnswers = questions.map((q: any) => ({
        ...q,
        answer: q.answer || '',
        options: Array.isArray(q.options) ? q.options : []
      }));

      return {
        ...paperData,
        questions: questionsWithAnswers,
        questionCount: questions.length
      };
    } catch (error) {
      console.error('获取试卷详情失败:', error);
      return null;
    } finally {
      setLoadingPaperDetails(false);
    }
  };

  // 选择试卷查看详情
  const handlePaperSelect = async (paperId: string) => {
    const paperDetails = await fetchPaperDetails(paperId);
    if (paperDetails) {
      setGeneratedPaper(paperDetails);
      setIsPaperListModalOpen(false);
      setIsPaperModalOpen(true);
    }
  };

  // 导出试卷到Word
  const exportToWord = async () => {
    if (!generatedPaper) return;
    
    try {
      const response = await apiClientWithToken.post(
        '/back/api/study/test/export_paper_to_word',
        { paper_id: generatedPaper.paperId },
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      );
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `试卷_${generatedPaper.testId}_${generatedPaper.paperId}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出试卷失败:', error);
      alert('导出试卷失败，请稍后再试: ' + (error as any)?.response?.data?.message || (error as Error).message);
    }
  };

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
                试卷规则管理系统
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="搜索测试ID、名称或标签"
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
                
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingRule({
                      testId: '',
                      testName: '',
                      items: [{
                        key: '',
                        tag: '',
                        count: 1,
                        score: 1,
                        type: 1
                      }]
                    });
                    setIsModalOpen(true);
                    setFormErrors({});
                    setSaveError('');
                  }}
                >
                  添加规则
                </Button>
              </Box>
            </Box>
            
            <TableContainer component={Paper} sx={{ backgroundColor: getCardBgColor() }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>测试ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>测试名称</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>题型</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>标签</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>题数</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>每题分数</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>题型总分</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>试卷总分</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: isDarkMode ? '#fff' : '#000' }}>操作</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredRules.length > 0 ? (
                    filteredRules.map((rule) => {
                      // 计算当前测试ID的总分
                      const testTotal = rule.items.reduce(
                        (sum, item) => sum + item.count * item.score, 
                        0
                      );
                      
                      return (
                        <React.Fragment key={rule.testId}>
                          {rule.items.map((item, itemIndex) => (
                            <TableRow 
                              key={`${rule.testId}-${itemIndex}`}
                              sx={{ backgroundColor: getTableRowBgColor(itemIndex) }}
                            >
                              {/* 测试ID：合并行 */}
                              {itemIndex === 0 && (
                                <TableCell 
                                  rowSpan={rule.items.length} 
                                  sx={{ 
                                    color: isDarkMode ? '#fff' : '#000',
                                    verticalAlign: 'middle',
                                    textAlign: 'center',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {rule.testId}
                                </TableCell>
                              )}
                              
                              {/* 测试名称：合并行 */}
                              {itemIndex === 0 && (
                                <TableCell 
                                  rowSpan={rule.items.length} 
                                  sx={{ 
                                    color: isDarkMode ? '#fff' : '#000',
                                    verticalAlign: 'middle',
                                    textAlign: 'center'
                                  }}
                                >
                                  {rule.testName}
                                </TableCell>
                              )}
                              
                              {/* 题型 */}
                              <TableCell>
                                <Chip 
                                  label={questionTypeMap[item.type]} 
                                  color={typeColorMap[item.type]} 
                                  size="small" 
                                  sx={{ color: '#fff' }}
                                />
                              </TableCell>
                              
                              {/* 标签 */}
                              <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                {item.tag || '无标签'}  {/* 显示标签，默认无标签 */}
                              </TableCell>
                              
                              {/* 题数 */}
                              <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                {item.count}
                              </TableCell>
                              
                              {/* 每题分数 */}
                              <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                {item.score}
                              </TableCell>
                              
                              {/* 题型总分 */}
                              <TableCell sx={{ color: isDarkMode ? '#fff' : '#000', fontWeight: 'bold' }}>
                                {item.count * item.score}
                              </TableCell>
                              
                              {/* 试卷总分：合并行 */}
                              {itemIndex === 0 && (
                                <TableCell 
                                  rowSpan={rule.items.length} 
                                  sx={{ 
                                    color: isDarkMode ? '#fff' : '#000',
                                    verticalAlign: 'middle',
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    backgroundColor: isDarkMode ? '#2a3c5a' : '#e3f2fd'
                                  }}
                                >
                                  {testTotal}
                                </TableCell>
                              )}
                              
                              {/* 操作：合并行 */}
                              {itemIndex === 0 && (
                                <TableCell 
                                  rowSpan={rule.items.length} 
                                  sx={{ 
                                    verticalAlign: 'middle',
                                    textAlign: 'center'
                                  }}
                                >
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                    <IconButton 
                                      onClick={() => handleEdit(rule.testId)}
                                      sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
                                      aria-label="编辑规则"
                                    >
                                      <EditIcon />
                                    </IconButton>
                                    <IconButton 
                                      onClick={() => handleDeleteRule(rule.testId)}
                                      sx={{ color: isDarkMode ? '#f48fb1' : '#d32f2f' }}
                                      aria-label="删除规则"
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                    <IconButton 
                                      onClick={() => handleQueryPapers(rule.testId)}
                                      sx={{ color: isDarkMode ? '#a5d6a7' : '#43a047' }}
                                      aria-label="查询试卷"
                                    >
                                      <PdfIcon />
                                    </IconButton>
                                  </Box>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                        {loading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <CircularProgress size={20} sx={{ mr: 1 }} />
                            加载中...
                          </Box>
                        ) : '未找到匹配的规则'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
        
        {/* 规则编辑模态框 */}
        <Dialog 
          open={isModalOpen} 
          onClose={() => {
            setIsModalOpen(false);
            setTimeout(() => {
              setEditingRule(null);
              setFormErrors({});
              setSaveError('');
            }, 300);
          }}
          fullWidth
          maxWidth="md"
          sx={{
            '& .MuiDialog-paper': {
              backgroundColor: getCardBgColor(),
              color: isDarkMode ? '#ffffff' : '#000000',
              maxHeight: '90vh',
              overflow: 'auto'
            }
          }}
        >
          <DialogTitle sx={{ 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}>
            {editingRule && rules.some(r => r.testId === editingRule.testId) 
              ? `编辑组卷规则 (测试ID: ${editingRule.testId})` 
              : "添加新组卷规则"}
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3, pb: 1 }}>
            {saveError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {saveError}
              </Alert>
            )}
            
            {editLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : editingRule ? (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    label="测试ID"
                    value={editingRule.testId}
                    onChange={(e) => {
                      setEditingRule({ ...editingRule, testId: e.target.value.trim() });
                      if (formErrors.testId) {
                        const newErrors = {...formErrors};
                        delete newErrors.testId;
                        setFormErrors(newErrors);
                      }
                    }}
                    fullWidth
                    variant="outlined"
                    sx={{ marginTop: 2 }}
                    InputLabelProps={{ style: { color: isDarkMode ? '#bbb' : '#666' } }}
                    InputProps={{ style: { color: isDarkMode ? '#fff' : '#000' } }}
                    error={!!formErrors.testId}
                    helperText={
                      <>
                        {formErrors.testId || '测试ID用于关联试卷和规则，一旦创建不可修改'}
                      </>
                    }
                    disabled={rules.some(r => r.testId === editingRule.testId)}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                    规则项列表 (共 {editingRule.items.length} 项)
                  </Typography>
                  
                  {/* 规则项标题行 */}
                  <Grid container spacing={2} sx={{ mb: 1 }}>
                    <Grid item xs={2}>题型</Grid>
                    <Grid item xs={3}>标签</Grid>
                    <Grid item xs={2}>题数</Grid>
                    <Grid item xs={2}>每题分数</Grid>
                    <Grid item xs={3}>操作</Grid>
                  </Grid>
                  
                  {/* 显示所有规则项 */}                          
                  {editingRule.items.map((item, index) => (
                    <Grid container spacing={2} key={index} alignItems="center" sx={{ mb: 1, p: 1, borderRadius: 1, backgroundColor: isDarkMode ? '#252525' : '#f5f5f5' }}>
                      <Grid item xs={2}>
                        <FormControl fullWidth>
                          <Select
                            value={item.type}
                            onChange={(e) => handleRuleItemChange(index, 'type', e.target.value)}
                            sx={{ backgroundColor: isDarkMode ? '#333' : '#fff' }}
                          >
                            <MenuItem value={1}>单选题</MenuItem>
                            <MenuItem value={2}>多选题</MenuItem>
                            <MenuItem value={3}>判断题</MenuItem>
                            <MenuItem value={4}>主观题</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={3}>
                        <TextField
                          value={item.tag}
                          onChange={(e) => handleRuleItemChange(index, 'tag', e.target.value.trim())}
                          label="标签"
                          error={!!formErrors[`item_${index}_tag`]}
                          helperText={formErrors[`item_${index}_tag`]}
                        />
                      </Grid>
                      
                      <Grid item xs={2}>
                        <TextField
                          type="number"
                          value={item.count}
                          onChange={(e) => handleRuleItemChange(index, 'count', e.target.value)}
                          label="题数"
                          error={!!formErrors[`item_${index}_count`]}
                          helperText={formErrors[`item_${index}_count`]}
                        />
                      </Grid>
                      
                      <Grid item xs={2}>
                        <TextField
                          type="number"
                          value={item.score}
                          onChange={(e) => handleRuleItemChange(index, 'score', e.target.value)}
                          label="每题分数"
                          error={!!formErrors[`item_${index}_score`]}
                          helperText={formErrors[`item_${index}_score`]}
                        />
                      </Grid>
                      
                      <Grid item xs={3}>
                        <IconButton 
                          onClick={() => handleRemoveRuleItem(index)}
                          sx={{ color: isDarkMode ? '#f48fb1' : '#d32f2f' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  ))}
                  
                  {/* 添加新规则项区域 */}
                  <Box sx={{ mt: 3, pt: 2, borderTop: `1px dashed ${isDarkMode ? '#444' : '#ccc'}` }}>
                    <Typography variant="subtitle2" sx={{ mb: 2 }}>添加新规则项</Typography>
                    
                    <Grid  container spacing={2} alignItems="center">
                      <Grid item xs={2}>
                        <FormControl fullWidth>
                          <Select
                            value={newRuleItem.type}
                            onChange={(e) => handleNewRuleItemChange('type', e.target.value)}
                            sx={{ backgroundColor: isDarkMode ? '#333' : '#fff' }}
                          >
                            <MenuItem value={1}>单选题</MenuItem>
                            <MenuItem value={2}>多选题</MenuItem>
                            <MenuItem value={3}>判断题</MenuItem>
                            <MenuItem value={4}>主观题</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={3}>
                        <TextField
                          label="标签"
                          value={newRuleItem.tag}
                          onChange={(e) => handleNewRuleItemChange('tag', e.target.value)}
                          fullWidth
                          size="small"
                          error={!!formErrors.tag}
                          helperText={formErrors.tag}
                        />
                      </Grid>
                      <Grid item xs={2}>
                        <TextField
                          label="题数"
                          type="number"
                          value={newRuleItem.count}
                          onChange={(e) => handleNewRuleItemChange('count', parseInt(e.target.value) || 0)}
                          fullWidth
                          size="small"
                          inputProps={{ min: 0 }}
                          error={!!formErrors.count}
                          helperText={formErrors.count}
                        />
                      </Grid>
                      <Grid item xs={2}>
                        <TextField
                          label="每题分数"
                          type="number"
                          value={newRuleItem.score}
                          onChange={(e) => handleNewRuleItemChange('score', parseInt(e.target.value) || 0)}
                          fullWidth
                          size="small"
                          inputProps={{ min: 0 }}
                          error={!!formErrors.score}
                          helperText={formErrors.score}
                        />
                      </Grid>
                      <Grid item xs={3}>
                        <IconButton 
                          onClick={handleAddRuleItem}
                          sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
                        >
                          <AddIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Typography align="center" sx={{ py: 4 }}>
                未加载规则数据
              </Typography>
            )}
          </DialogContent>
          
          <DialogActions sx={{ 
            px: 3, py: 2,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
            position: 'sticky',
            bottom: 0,
            zIndex: 1
          }}>
            <Button 
              onClick={() => {
                setIsModalOpen(false);
                setTimeout(() => {
                  setEditingRule(null);
                }, 300);
              }}
              startIcon={<CancelIcon />}
            >
              取消
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!editingRule || editingRule.items.length === 0 || editLoading}
              loading={editLoading}
            >
              {rules.some(r => r.testId === editingRule?.testId) ? "保存修改" : "添加规则"}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* 试卷列表模态框 */}
        <Dialog
          open={isPaperListModalOpen}
          onClose={() => setIsPaperListModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>选择试卷 ({inputTestId})</DialogTitle>
          <DialogContent dividers>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : fetchedPapers.length > 0 ? (
              <Box>
                <Typography sx={{ mb: 2 }}>共找到 {fetchedPapers.length} 份试卷</Typography>
                <Box sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                  {fetchedPapers.map((paper, index) => {
                    const questionCount = paper.questionCount ?? 0;
                    
                    return (
                      <Box 
                        key={index}
                        sx={{ 
                          p: 2, 
                          mb: 1,
                          backgroundColor: getTableRowBgColor(index),
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: isDarkMode ? '#333' : '#eee' }
                        }}
                        onClick={() => handlePaperSelect(paper.paperId)}
                      >
                        <Typography variant="subtitle1">试卷 {index + 1}</Typography>
                        <Typography variant="body2">
                          共 {questionCount} 题，总分: {paper.totalScore}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : (
              <Typography align="center" sx={{ py: 3 }}>未找到相关试卷</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsPaperListModalOpen(false)}>关闭</Button>
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
              color: isDarkMode ? '#ffffff' : '#000000',
              maxHeight: '90vh',
              overflow: 'auto'
            }
          }}
        >
          <DialogTitle sx={{ 
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}>
            {generatedPaper ? `试卷预览 (${generatedPaper.paperId})` : "试卷预览"}
          </DialogTitle>
          <DialogContent dividers>
            {loadingPaperDetails ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : generatedPaper ? (
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
                      测试ID: <strong style={{ color: isDarkMode ? '#fff' : '#000' }}>{generatedPaper.testId}</strong>
                    </Typography>
                    <Typography variant="body1" sx={{ color: isDarkMode ? '#bbb' : '#666' }}>
                      试卷ID: <strong style={{ color: isDarkMode ? '#fff' : '#000' }}>{generatedPaper.paperId}</strong>
                    </Typography>
                    <Typography variant="body1" sx={{ color: isDarkMode ? '#bbb' : '#666' }}>
                      总分: <strong style={{ color: isDarkMode ? '#fff' : '#000' }}>{generatedPaper.totalScore}分</strong>
                    </Typography>
                    <Typography variant="body1" sx={{ color: isDarkMode ? '#bbb' : '#666' }}>
                      题数: <strong style={{ color: isDarkMode ? '#fff' : '#000' }}>
                        {generatedPaper.questionCount || 0}题
                      </strong>
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ maxHeight: '50vh', overflow: 'auto', p: 1 }}>
                  {Array.isArray(generatedPaper.questions) && generatedPaper.questions.map((q, index) => (
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
                      
                      {q.type !== '主观题' && q.options && q.options.length > 0 && (
                        <Box sx={{ pl: 3, mt: 1 }}>
                          {q.options.map((opt, i) => (
                            <Box 
                              key={`${q.id}-opt-${i}`}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                mb: 1
                              }}
                            >
                              <Box sx={{
                                minWidth: 24,
                                height: 24,
                                borderRadius: '50%',
                                backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mr: 1.5,
                                mt: 0.5,
                                flexShrink: 0
                              }}>
                                <Typography variant="body2" sx={{ 
                                  fontWeight: 'bold', 
                                  color: isDarkMode ? '#fff' : '#000',
                                  lineHeight: 1
                                }}>
                                  {String.fromCharCode(65 + i)}
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ 
                                color: isDarkMode ? '#ddd' : '#333',
                                lineHeight: 1.6
                              }}>
                                {opt.content}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
                
                {/* 答案区域 */}
                {Array.isArray(generatedPaper.questions) && generatedPaper.questions.length > 0 && (
                  <Box sx={{ 
                    mt: 4, 
                    pt: 3, 
                    borderTop: `2px solid ${isDarkMode ? '#444' : '#ccc'}` 
                  }}>
                    <Typography variant="h6" sx={{ mb: 2, color: '#d32f2f', fontWeight: 'bold' }}>
                      参考答案
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      {generatedPaper.questions.map((q, index) => (
                        <Box key={`answer-${q.id}`} sx={{ mb: 1 }}>
                          <Typography sx={{ 
                            fontWeight: 'bold',
                            display: 'inline'
                          }}>
                            {index + 1}. 
                          </Typography>
                          <Typography sx={{ display: 'inline' }}>
                            {q.answer || '无答案'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography variant="body1" align="center" sx={{ py: 3, color: isDarkMode ? '#aaa' : '#777' }}>
                未加载试卷数据
              </Typography>
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
              startIcon={<WordIcon />}
              color="primary"
              onClick={exportToWord}
              disabled={!generatedPaper}
            >
              导出Word
            </Button>
          </DialogActions>
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

export default PaperManagementSystem;


