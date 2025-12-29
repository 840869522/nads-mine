"use client";
import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Box, Card, CardContent, Typography, Chip,
  CircularProgress, IconButton, FormControl,
  useTheme, MenuItem, Select, Alert, Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  PictureAsPdf as PdfIcon,
  Description as WordIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { apiClientWithToken } from "@/utils/axios";

type QuestionType = '单选题' | '多选题' | '判断题' | '主观题';

interface RuleItem {
  key?: string;
  tag: string;
  count: number;
  score: number;
  type: number;
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
  options?: { content: string }[];
}

interface Paper {
  paperId: string;
  testId: string;
  totalScore: number;
  questions: Question[];
  questionCount?: number;
  paperName?: string;
}

interface PaperManagementSystemProps {
  testId: string;
}

const PaperManagementSystem: React.FC<PaperManagementSystemProps> = ({ testId }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(false);

  const [editLoading, setEditLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  const [fetchedPapers, setFetchedPapers] = useState<Paper[]>([]);
  const [isPaperListModalOpen, setIsPaperListModalOpen] = useState(false);
  const [loadingPaperDetails, setLoadingPaperDetails] = useState(false);

  // 新增状态：标签相关
  const [availableTags, setAvailableTags] = useState<Record<number, string[]>>({});
  const [loadingTags, setLoadingTags] = useState(false);

  const questionTypeMap: Record<number, QuestionType> = {
    1: '单选题',
    2: '多选题',
    3: '判断题',
    4: '主观题'
  };

  const typeColorMap: Record<number, 'primary' | 'secondary' | 'warning' | 'success'> = {
    1: 'primary',
    2: 'secondary',
    3: 'warning',
    4: 'success'
  };

  useEffect(() => {
    if (testId) {
      fetchRules();
    }
  }, [testId]);

  // 新增函数：根据题型获取标签
  const fetchTagsByType = async (type: number) => {
    if (availableTags[type]) return availableTags[type];
    
    setLoadingTags(true);
    try {
      const response = await apiClientWithToken.get('/back/api/study/test/get_tags_by_type', {
        params: { type }
      });
      
      if (response.data?.code === 200) {
        const tags = response.data.data.tags || [];
        setAvailableTags(prev => ({ ...prev, [type]: tags }));
        return tags;
      }
      return [];
    } catch (error) {
      console.error('获取标签失败:', error);
      return [];
    } finally {
      setLoadingTags(false);
    }
  };

  // 预加载标签数据
  useEffect(() => {
    if (isModalOpen && editingRule) {
      // 预加载所有编辑项中涉及的题型标签
      const uniqueTypes = [...new Set(editingRule.items.map(item => item.type))];
      uniqueTypes.forEach(type => fetchTagsByType(type));
    }
  }, [isModalOpen, editingRule]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await apiClientWithToken.get('/back/api/study/test/getPaperRulesByTestId', {
        params: { test_id: testId }
      });

      const rawData = response.data || {};

      if (rawData.code === 200 && rawData.data) {
        const ruleData = rawData.data;

        const transformedRules = [{
          testId: ruleData.testId || testId,
          testName: ruleData.testName || '未知名称',
          items: Array.isArray(ruleData.items) ? ruleData.items.map((item: any) => ({
            key: item.key || item.c_id || '',
            tag: item.tag || item.c_tag || '',
            type: Number(item.type) || Number(item.c_type) || 1,
            count: Number(item.count) || Number(item.c_count) || 0,
            score: Number(item.score) || Number(item.c_score) || 0
          })) : []
        }];

        setRules(transformedRules);
      } else {
        setRules([{
          testId: testId,
          testName: '暂无规则',
          items: []
        }]);
      }
    } catch (error: any) {
      setRules([{
        testId: testId,
        testName: '获取失败',
        items: []
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    const rule = rules.find(r => r.testId === testId);
    if (rule) {
      setEditingRule({ ...rule });
      setIsModalOpen(true);
      setFormErrors({});
      setSaveError('');
    } else {
      fetchRuleFromApi(testId);
    }
  };

  const fetchRuleFromApi = async (testId: string) => {
    setEditLoading(true);
    try {
      const response = await apiClientWithToken.get(
        '/back/api/study/test/get_paper_rules_info',
        { params: { test_id: testId } }
      );
      const ruleData = response.data?.data || {};
      const items: RuleItem[] = [];
      const typeMap = { single_choice: 1, multiple_choice: 2, true_or_false: 3, subjective: 4 };

      Object.entries(ruleData).forEach(([typeKey, itemData]: [string, any]) => {
        if (itemData && typeMap[typeKey as keyof typeof typeMap]) {
          items.push({
            key: String(itemData.key || itemData.c_id || ''),
            tag: itemData.tag || itemData.c_tag || '',
            count: Number(itemData.count) || Number(itemData.c_count) || 1,
            score: Number(itemData.score) || Number(itemData.c_score) || 1,
            type: typeMap[typeKey as keyof typeof typeMap] || 1
          });
        }
      });

      setEditingRule({
        testId: testId,
        testName: ruleData.testName || '测试规则',
        items
      });
      setIsModalOpen(true);
    } catch (error) {
      alert(`加载规则失败: ${(error as any)?.response?.data?.message || (error as Error).message}`);
    } finally {
      setEditLoading(false);
    }
  };

  const validateRule = (rule: Rule): boolean => {
    const errors: Record<string, string> = {};

    if (!rule.testId.trim()) {
      errors.testId = '测试ID不能为空';
    } else if (rule.testId.length > 50) {
      errors.testId = '测试ID不能超过50个字符';
    }

    if (rule.items.length === 0) {
      errors.emptyItems = '至少需要添加一个规则项';
      setFormErrors(errors);
      return false;
    }

    rule.items.forEach((item, index) => {
      const typeName = questionTypeMap[item.type];

      if (!item.tag.trim()) {
        errors[`item_${index}_tag`] = `${typeName}标签不能为空`;
      } else if (item.tag.length > 50) {
        errors[`item_${index}_tag`] = `${typeName}标签不能超过50个字符`;
      }

      if (!Number.isInteger(item.count) || item.count <= 0) {
        errors[`item_${index}_count`] = `${typeName}题数必须是大于0的整数`;
      }

      if (!Number.isInteger(item.score) || item.score <= 0) {
        errors[`item_${index}_score`] = `${typeName}分数必须是大于0的整数`;
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDeleteRule = async () => {
    if (!testId || testId.trim() === '') {
      alert('错误：测试ID无效，无法执行删除操作');
      return;
    }

    if (!window.confirm(`确定要删除测试ID为 ${testId} 的所有组卷规则吗？此操作会同步删除关联试卷，且不可撤销！`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiClientWithToken.delete(
        '/back/api/study/test/paper_rules_del',
        { params: { test_id: testId.trim() } }
      );

      if (response.data?.code === 200) {
        alert('删除成功！组卷规则及关联试卷已同步删除');
        fetchRules();
        setFetchedPapers([]);
        setIsPaperListModalOpen(false);
      } else {
        alert(`删除失败: ${response.data?.message || '服务器未知错误'}`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '网络错误';
      alert(`删除失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const prepareRuleData = (rule: Rule) => {
    const requestData: any = {
      test_id: rule.testId.trim()
    };

    const typeMap = {
      1: 'single_choice',
      2: 'multiple_choice',
      3: 'true_or_false',
      4: 'subjective'
    };

    rule.items.forEach(item => {
      const typeKey = typeMap[item.type as keyof typeof typeMap];
      if (typeKey) {
        if (!requestData[typeKey]) {
          requestData[typeKey] = [];
        }
        requestData[typeKey].push({
          tag: (item.tag || '').trim(),
          count: Math.max(1, item.count),
          score: Math.max(1, item.score)
        });
      }
    });

    return requestData;
  };

  const handleSubmit = async () => {
    if (!editingRule) return;

    setEditLoading(true);
    setSaveError('');

    if (!validateRule(editingRule)) {
      setEditLoading(false);
      return;
    }

    try {
      const isUpdate = rules.some(r => r.testId === editingRule.testId && r.items.length > 0);
      const requestData = prepareRuleData(editingRule);
      const [url, successMsg] = isUpdate
        ? [
            '/back/api/study/test/paper_rules_update',
            '修改成功！试卷已同步更新'
          ]
        : [
            '/back/api/study/test/paper_rules_add',
            '添加成功！已生成对应试卷'
          ];

      const response = await apiClientWithToken.post(url, requestData);

      if (response.data?.code === 200) {
        alert(successMsg);
        setIsModalOpen(false);
        setEditingRule(null);
        setFormErrors({});
        fetchRules().then(() => {
          if (isUpdate && editingRule.testId) {
            handleQueryPapers(editingRule.testId);
          }
        });
      } else {
        const errorMsg = response.data?.message || '未知错误';
        setSaveError(`${isUpdate ? '更新' : '添加'}失败: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '网络错误';
      setSaveError(`${isUpdate ? '更新' : '添加'}失败: ${errorMsg}`);
    } finally {
      setEditLoading(false);
    }
  };

  const [newRuleItem, setNewRuleItem] = useState<RuleItem>({
    tag: '',
    count: 1,
    score: 1,
    type: 1
  });

  const handleAddRuleItem = () => {
    if (!editingRule) return;

    const tempErrors: Record<string, string> = {};
    const typeName = questionTypeMap[newRuleItem.type];

    if (!newRuleItem.tag.trim()) tempErrors.tag = `${typeName}标签不能为空`;
    if (newRuleItem.count <= 0) tempErrors.count = `${typeName}题数必须大于0`;
    if (newRuleItem.score <= 0) tempErrors.score = `${typeName}分数必须大于0`;

    if (Object.keys(tempErrors).length > 0) {
      setFormErrors(tempErrors);
      return;
    }

    setEditingRule({
      ...editingRule,
      items: [...editingRule.items, newRuleItem]
    });

    setNewRuleItem({
      tag: '',
      count: 1,
      score: 1,
      type: newRuleItem.type
    });

    setFormErrors({});
  };

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

  const handleNewRuleItemChange = (field: string, value: string | number) => {
    let processedValue = value;
    if (field === 'count' || field === 'score') {
      processedValue = Math.max(1, parseInt(value.toString(), 10) || 1);
    } else if (field === 'tag') {
      processedValue = typeof value === 'string' ? value.trim() : String(value || '');
    }

    setNewRuleItem({
      ...newRuleItem,
      [field]: processedValue
    });

    if (formErrors[field]) {
      const newErrors = { ...formErrors };
      delete newErrors[field];
      setFormErrors(newErrors);
    }

    // 当题型变化时，自动加载对应的标签
    if (field === 'type') {
      fetchTagsByType(Number(value));
    }
  };

  const handleRuleItemChange = (index: number, field: string, value: string | number) => {
    if (!editingRule) return;
    const updatedItems = [...editingRule.items];

    let processedValue = value;
    if (field === 'count' || field === 'score') {
      processedValue = Math.max(1, parseInt(value.toString(), 10) || 1);
    } else if (field === 'tag') {
      processedValue = typeof value === 'string' ? value.trim() : String(value || '');
    }

    updatedItems[index] = {
      ...updatedItems[index],
      [field]: processedValue
    };

    setEditingRule({ ...editingRule, items: updatedItems });
    const newErrors = { ...formErrors };
    delete newErrors[`item_${index}_${field}`];
    setFormErrors(newErrors);

    // 当题型变化时，自动加载对应的标签
    if (field === 'type') {
      fetchTagsByType(Number(value));
    }
  };

  const getBgColor = () => isDarkMode ? '#121212' : '#f5f5f5';
  const getCardBgColor = () => isDarkMode ? '#1e1e1e' : '#ffffff';
  const getTableRowBgColor = (index: number) =>
    isDarkMode
      ? (index % 2 === 0 ? '#252525' : '#1e1e1e')
      : (index % 2 === 0 ? '#fafafa' : '#ffffff');

  const handleQueryPapers = async (testId: string) => {
    setLoading(true);
    try {
      const response = await apiClientWithToken.get(`/back/api/study/test/get_papers?test_id=${testId}`);

      let papers = Array.isArray(response.data?.data) ? response.data.data : [];

      papers = papers.map((paper: any, index: number) => ({
        ...paper,
        paperName: `试卷${index + 1}`,
        questionCount: paper.questionCount ? parseInt(paper.questionCount, 10) || 0 :
          (Array.isArray(paper.questions) ? paper.questions.length : 0),
        questions: Array.isArray(paper.questions) ? paper.questions : []
      }));

      setFetchedPapers(papers);
      setIsPaperListModalOpen(true);
    } catch (error) {
      setFetchedPapers([]);
      alert('获取试卷失败，请检查测试ID是否正确');
    } finally {
      setLoading(false);
    }
  };

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
        content: q.content ? q.content.replace(/^\[.*?\]\s*/, '') : '',
        answer: q.answer || '',
        options: Array.isArray(q.options) ? q.options : []
      }));

      return {
        ...paperData,
        questions: questionsWithAnswers,
        questionCount: questions.length
      };
    } catch (error) {
      return null;
    } finally {
      setLoadingPaperDetails(false);
    }
  };

  const handlePaperSelect = async (paperId: string) => {
    const paperDetails = await fetchPaperDetails(paperId);
    if (paperDetails) {
      setGeneratedPaper(paperDetails);
      setIsPaperListModalOpen(false);
      setIsPaperModalOpen(true);
    }
  };

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


              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%',  padding: '0 16px'  }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingRule({
                      testId: testId,
                      testName: '新规则',
                      items: [{
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
                  sx={{ ml: 'auto' }}
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
                  {rules.length > 0 ? (
                    rules.map((rule) => {
                      const testTotal = rule.items.reduce(
                        (sum, item) => sum + item.count * item.score,
                        0
                      );

                      return (
                        <React.Fragment key={rule.testId}>
                          {rule.items.length > 0 ? (
                            rule.items.map((item, itemIndex) => (
                              <TableRow
                                key={`${rule.testId}-${itemIndex}`}
                                sx={{ backgroundColor: getTableRowBgColor(itemIndex) }}
                              >
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

                                <TableCell>
                                  <Chip
                                    label={questionTypeMap[item.type]}
                                    color={typeColorMap[item.type]}
                                    size="small"
                                    sx={{ color: '#fff' }}
                                  />
                                </TableCell>

                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                  {item.tag || '无标签'}
                                </TableCell>

                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                  {item.count}
                                </TableCell>

                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                  {item.score}
                                </TableCell>

                                <TableCell sx={{ color: isDarkMode ? '#fff' : '#000', fontWeight: 'bold' }}>
                                  {item.count * item.score}
                                </TableCell>

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
                                        onClick={handleEdit}
                                        sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
                                        aria-label="编辑规则"
                                      >
                                        <EditIcon />
                                      </IconButton>
                                      <IconButton
                                        onClick={handleDeleteRule}
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
                            ))
                          ) : (
                            <TableRow>
                              <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                {rule.testId}
                              </TableCell>
                              <TableCell sx={{ color: isDarkMode ? '#fff' : '#000' }}>
                                {rule.testName}
                              </TableCell>
                              <TableCell colSpan={6} align="center" sx={{ color: isDarkMode ? '#aaa' : '#777' }}>
                                暂无规则项
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  <IconButton
                                    onClick={handleEdit}
                                    sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
                                    aria-label="编辑规则"
                                  >
                                    <EditIcon />
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
                            </TableRow>
                          )}
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
            {editingRule ? `编辑组卷规则 (测试ID: ${editingRule.testId})` : "添加新组卷规则"}
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
              <Box>
                <TextField
                  label="测试ID"
                  value={editingRule.testId}
                  fullWidth
                  variant="outlined"
                  sx={{ marginTop: 2, marginBottom: 3 }}
                  InputLabelProps={{ style: { color: isDarkMode ? '#bbb' : '#666' } }}
                  InputProps={{
                    style: { color: isDarkMode ? '#fff' : '#000' },
                    readOnly: true
                  }}
                  helperText="测试ID不可修改"
                />

                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                  规则项列表 (共 {editingRule.items.length} 项)
                </Typography>

                {/* 使用 Flexbox 替换 Grid */}
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1,
                    mb: 1,
                    px: 1
                  }}>
                    <Box sx={{ flex: '0 0 15%', fontWeight: 'bold' }}>题型</Box>
                    <Box sx={{ flex: '0 0 55%', fontWeight: 'bold' }}>标签</Box>
                    <Box sx={{ flex: '0 0 10%', fontWeight: 'bold' }}>题数</Box>
                    <Box sx={{ flex: '0 0 10%', fontWeight: 'bold' }}>每题分数</Box>
                    <Box sx={{ flex: '0 0 10%', fontWeight: 'bold' }}>操作</Box>
                  </Box>
                </Box>

                {editingRule.items.map((item, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      display: 'flex', 
                      gap: 0.5,
                      alignItems: 'center',
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: isDarkMode ? '#252525' : '#f5f5f5'
                    }}
                  >
                    <Box sx={{ flex: '0 0 15%' }}>
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
                    </Box>

                    <Box sx={{ flex: '0 0 55%' }}>
                      <FormControl fullWidth>
                        <Autocomplete
                          freeSolo
                          options={availableTags[item.type] || []}
                          value={item.tag}
                          onChange={(_, newValue) => handleRuleItemChange(index, 'tag', newValue || '')}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="标签"
                              error={!!formErrors[`item_${index}_tag`]}
                              helperText={formErrors[`item_${index}_tag`]}
                              onChange={(e) => handleRuleItemChange(index, 'tag', e.target.value)}
                            />
                          )}
                          loading={loadingTags}
                          loadingText="加载中..."
                        />
                      </FormControl>
                    </Box>

                    <Box sx={{ flex: '0 0 10%' }}>
                      <TextField
                        type="number"
                        value={item.count}
                        onChange={(e) => handleRuleItemChange(index, 'count', e.target.value)}
                        label="题数"
                        error={!!formErrors[`item_${index}_count`]}
                        helperText={formErrors[`item_${index}_count`]}
                        fullWidth
                      />
                    </Box>

                    <Box sx={{ flex: '0 0 10%' }}>
                      <TextField
                        type="number"
                        value={item.score}
                        onChange={(e) => handleRuleItemChange(index, 'score', e.target.value)}
                        label="每题分数"
                        error={!!formErrors[`item_${index}_score`]}
                        helperText={formErrors[`item_${index}_score`]}
                        fullWidth
                      />
                    </Box>

                    <Box sx={{ flex: '0 0 10%', textAlign: 'center' }}>
                      <IconButton
                        onClick={() => handleRemoveRuleItem(index)}
                        sx={{ color: isDarkMode ? '#f48fb1' : '#d32f2f' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                ))}

                <Box sx={{ mt: 3, pt: 2, borderTop: `1px dashed ${isDarkMode ? '#444' : '#ccc'}` }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    添加新规则项
                  </Typography>

                  <Box sx={{ 
                    display: 'flex', 
                    gap: 0.5,
                    alignItems: 'center'
                  }}>
                    <Box sx={{ flex: '0 0 15%' }}>
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
                    </Box>

                    <Box sx={{ flex: '0 0 55%' }}>
                      <FormControl fullWidth>
                        <Autocomplete
                          freeSolo
                          options={availableTags[newRuleItem.type] || []}
                          value={newRuleItem.tag}
                          onChange={(_, newValue) => handleNewRuleItemChange('tag', newValue || '')}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="标签"
                              size="small"
                              error={!!formErrors.tag}
                              helperText={formErrors.tag}
                            />
                          )}
                          loading={loadingTags}
                          loadingText="加载中..."
                        />
                      </FormControl>
                    </Box>

                    <Box sx={{ flex: '0 0 10%' }}>
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
                    </Box>

                    <Box sx={{ flex: '0 0 10%' }}>
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
                    </Box>

                    <Box sx={{ flex: '0 0 10%', textAlign: 'center' }}>
                      <IconButton
                        onClick={handleAddRuleItem}
                        sx={{ color: isDarkMode ? '#90caf9' : '#1976d2' }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </Box>
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
              onClick={() => setIsModalOpen(false)}
              startIcon={<CancelIcon />}
              sx={{ color: isDarkMode ? '#bbb' : '#666' }}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={editLoading}
            >
              {editLoading ? <CircularProgress size={16} /> : '保存规则'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isPaperListModalOpen}
          onClose={() => setIsPaperListModalOpen(false)}
          fullWidth
          maxWidth="md"
          sx={{
            '& .MuiDialog-paper': {
              backgroundColor: getCardBgColor(),
              color: isDarkMode ? '#ffffff' : '#000000',
              maxHeight: '80vh'
            }
          }}
        >
          <DialogTitle sx={{
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}>
            试卷列表 
          </DialogTitle>

          <DialogContent sx={{ pt: 3 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : fetchedPapers.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>试卷名称</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>题数</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>总分</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fetchedPapers.map((paper, index) => (
                      <TableRow key={paper.paperId}>
                        <TableCell>{paper.paperName || `试卷${index + 1}`}</TableCell>
                        <TableCell>{paper.questionCount || 0}</TableCell>
                        <TableCell>{paper.totalScore || 0}</TableCell>
                        <TableCell>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handlePaperSelect(paper.paperId)}
                            disabled={loadingPaperDetails}
                          >
                            {loadingPaperDetails ? '加载中...' : '查看详情'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography align="center" sx={{ py: 4 }}>
                未找到相关试卷
              </Typography>
            )}
          </DialogContent>

          <DialogActions sx={{
            px: 3, py: 2,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5'
          }}>
            <Button onClick={() => setIsPaperListModalOpen(false)}>
              关闭
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isPaperModalOpen}
          onClose={() => setIsPaperModalOpen(false)}
          fullWidth
          maxWidth="lg"
          sx={{
            '& .MuiDialog-paper': {
              backgroundColor: getCardBgColor(),
              color: isDarkMode ? '#ffffff' : '#000000',
              maxHeight: '90vh'
            }
          }}
        >
          <DialogTitle sx={{
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>试卷详情 - {generatedPaper?.paperName || '试卷预览'}</span>
            <Button
              variant="contained"
              startIcon={<WordIcon />}
              onClick={exportToWord}
              disabled={!generatedPaper}
            >
              导出Word
            </Button>
          </DialogTitle>

          <DialogContent sx={{ pt: 3 }}>
            {generatedPaper ? (
              <Box>
                <Box sx={{ mb: 3, p: 2, backgroundColor: isDarkMode ? '#252525' : '#f9f9f9', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    试卷信息
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 4 }}>
                    <Box>
                      <Typography><strong>总题数:</strong> {generatedPaper.questionCount}</Typography>
                    </Box>
                    <Box>
                      <Typography><strong>总分:</strong> {generatedPaper.totalScore}</Typography>
                    </Box>
                  </Box>
                </Box>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  题目列表
                </Typography>

                {generatedPaper.questions.map((question, index) => (
                  <Card key={index} sx={{ mb: 2, p: 2, backgroundColor: isDarkMode ? '#252525' : '#ffffff' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        <strong>{index + 1}. {question.content}</strong>
                      </Typography>

                      {question.options && question.options.length > 0 && (
                        <Box sx={{ ml: 2, mt: 1 }}>
                          {question.options.map((option, optIndex) => (
                            <Typography key={optIndex} variant="body2">
                              {String.fromCharCode(65 + optIndex)}. {option.content}
                            </Typography>
                          ))}
                        </Box>
                      )}

                      <Box sx={{ mt: 2, p: 1, backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>答案:</strong> {question.answer || '无答案'}
                        </Typography>
                        <Typography variant="body2">
                          <strong>分数:</strong> {question.score}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Typography align="center" sx={{ py: 4 }}>
                未加载试卷数据
              </Typography>
            )}
          </DialogContent>

          <DialogActions sx={{
            px: 3, py: 2,
            backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5'
          }}>
            <Button onClick={() => setIsPaperModalOpen(false)}>
              关闭
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default PaperManagementSystem;