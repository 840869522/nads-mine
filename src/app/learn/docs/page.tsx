"use client";


import {
  Box,
  Paper,
  Typography,
  Button,
  InputAdornment,
  CircularProgress,
  TextField,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableSortLabel,
  TableBody,
  Tooltip,
  IconButton,
  Chip,
  TablePagination,
  Dialog,
  DialogContent
} from "@mui/material";
import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

import SearchIcon from '@mui/icons-material/Search';
import EditIcon from "@mui/icons-material/Edit";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ConfirmActionDialog from "@/components/scenario/ConfirmActionDialog";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Download as DownloadIcon } from "@mui/icons-material";
import LinearProgress from '@mui/material/LinearProgress';

import { apiClientWithToken } from "@/utils/axios";
import QuestionModalForm, { QuestionFormData, QuestionDisplayItem, SelectOption } from "@/components/learning/QuestionModalForm";
import { Array2String, String2Array } from "@/utils/string";
import { ColorMap } from "@/utils/color";
import ViewQuestionModal from "@/components/learning/ViewQuesitonModal";



type Order = `asc` | `desc`;
type SortableQuestionsKeys = keyof Pick<QuestionDisplayItem, "c_id" | "c_course_id" | "c_question" | "c_type" | "c_tag">;

// 后续支持 批量导入

const TypeMap = {
  1: "单选",
  2: "多选",
  3: "判断",
  4: "简答"
}

const QuestionPage: React.FC = () => {

  const [questions, setQuestions] = useState<QuestionDisplayItem[]>([]);
  const [firstFlag, setFirstFlag] = useState<boolean>(true);
  const [questionsCount, setQuestionsCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [order, setOrder] = useState<Order>("asc");
  const [orderBy, setOrderBy] = useState<SortableQuestionsKeys>("c_id");
  const [questionToEdit, setQuesionToEdit] = useState<QuestionDisplayItem | null>(null);
  const [questionCheck, setQuestionCheck] = useState<QuestionDisplayItem | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [tableLaoding, setTableLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState({ data: "", flag: false });
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [questionToDelete, setQuesionToDelete] = useState<QuestionDisplayItem | null>(null);
  const [isQuestionsModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const [saveProgressMessage, setSaveProgressMessage] = useState<string>('');



  useEffect(() => {
    getQuestionData(1, rowsPerPage);
    setFirstFlag(false);
  }, [])

  useEffect(() => {
    if (firstFlag)
      return
    else {
      if (searchTerm.data.trim() && searchTerm.flag)
        getQuestionDataByName(page, rowsPerPage, searchTerm.data);
      else
        getQuestionData(page, rowsPerPage);
    }
  }, [page, rowsPerPage, searchTerm]);


  const getQuestionData = (page: number, pagesize: number) => {
    setTableLoading(true);
    apiClientWithToken.post(`/back/api/study/test/question_list`, JSON.stringify({
      page: page,
      pageSize: pagesize
    })).then(res => {
      if (res.data.code === 200) {
        setQuestions(res.data.data.data);
        setQuestionsCount(res.data.data.count);
      } else {
        setQuestions([]);
        setQuestionsCount(0);
      }
    }).finally(() => {
      setTimeout(() => {
        setTableLoading(false);
      }, 300);
    })
  }

  const getQuestionDataByName = (page: number, pagesize: number, searchName: string) => {
  setTableLoading(true);
  apiClientWithToken.post(`/back/api/study/test/question_search`, JSON.stringify({
    page: page,
    pagesize: pagesize,
    name: searchName
  })).then(res => {
    if (res.data.code === 200) {
      setQuestions(res.data.data.data);
      setQuestionsCount(res.data.data.count);
    } else {
      setQuestions([]);
      setQuestionsCount(0);
    }
  }).finally(() => {
    setTimeout(() => {
      setTableLoading(false);
    }, 300);
  })
}

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm({ data: event.target.value.toLowerCase(), flag: true });
    setPage(1);
  };

 const handleSearchSubmit = async () => {
  setTableLoading(true);
  try {
    const res = await apiClientWithToken.post(`/back/api/study/test/question_search`, JSON.stringify({
      page: page,
      pagesize: rowsPerPage,
      name: searchTerm.data || ""
    }));
    if (res.data.code === 200) {
      setQuestions(res.data.data.data);
      setQuestionsCount(res.data.data.count);
      setPage(1);
    } else {
      setQuestions([]);
      toast.error(`搜索题目时发生错误 - ${res.data.message}`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        position: "top-right"
      });
      setQuestionsCount(0);
    }
  } catch (error) {
    toast.error(`搜索题目时发生错误 - ${error.message}`, {
      autoClose: 3000,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      position: "top-right"
    });
  } finally {
    setTableLoading(false);
  }
};

  const handleAddQuestionClick = () => {
    setIsQuestionModalOpen(true);
    setQuesionToEdit(null);
  }

  const confirmDeleteQuestion = async () => {
  setIsConfirmDeleteOpen(false);
  
  if (!questionToDelete?.c_id) return;
  
  setIsProcessing(true); // 复用已有的 isProcessing 状态
  
  try {
    const response = await apiClientWithToken.post("/back/api/study/test/question_del", JSON.stringify({ id: questionToDelete.c_id }));
    
    if (response.data.code === 200) {
      toast.success(`删除题目 ${questionToDelete.c_id} 成功`, {
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        position: "top-right"
      });
      
      setPage(1);
      
      if (searchTerm.data.trim() && searchTerm.flag) {
        await getQuestionDataByName(1, rowsPerPage, searchTerm.data);
      } else {
        await getQuestionData(1, rowsPerPage);
      }
      
    } else {
      throw new Error(response.data.message || '删除失败');
    }
    
  } catch (error: any) {
    toast.error(`删除题目 ${questionToDelete.c_id} 失败: ${error.message}`, {
      autoClose: 3000,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      position: "top-right"
    });
  } finally {
    setIsProcessing(false);
  }
};

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage + 1);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  const handleEditQuestionClick = (question: QuestionDisplayItem) => {
    setQuesionToEdit(question);
    setIsQuestionModalOpen(true);
  };

  const handelDeleteQuestionClick = (question: QuestionDisplayItem) => {
    setIsConfirmDeleteOpen(true);
    setQuesionToDelete(question);
  }

  const handelCheckQuestion = (question: QuestionDisplayItem) => {
    setQuestionCheck(question);
    setCheckOpen(true);
  }

  /**
   * 批量导入功能实现
   */
  const handelImpoerQuestionFromCSV = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  // 解析题目类型
  const parseQuestionType = (type: string) => {
    switch (type?.toLowerCase()) {
      case '单选': return 1;
      case '多选': return 2;
      case '判断': return 3;
      case '简答': return 4;
      default: return 1;
    }
  };

  // 解析标签
  const parseTags = (tags: string) => {
    return tags
  };

  // 解析选项
  const parseOptions = (question: any) => {
    const options = [];
    const indexStart = 65;
    for (let i = 0; i < 4; i++) {
      let index = String.fromCharCode(indexStart + i)
      if (question[`${index}`]) {
        options.push({
          c_id: index,
          c_content: question[index],
          c_question_id: question['试题ID']
        });
      }
    }
    return options;
  };

  // 验证答案是否正确
  const checkAnswer = (data: {
    type: number,
    options: SelectOption[]
  }, answer: string) => {
    if (data.type == 2) {
      let answerList = answer.split(";");
      return answerList.every(item => data.options.some(option => option.c_content == item));
    } else if (data.type == 1) {
      return data.options.some(item => item.c_content == answer);
    }
    return true;
  };


  const parseGetAnswer = (data : any)=>{
    if(data['题目类型'] === "单选") {
      return data[data['答案']]
    }else if (data['题目类型'] === "多选"){
      let answer = data['答案'].split(",")
      answer = answer.map((item: string)=>{
        return data[item];
      })
      return answer.join(';');
    }else {
      return data['答案']
    }
  }

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setIsProcessing(true);

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // 将数据转为JSON数组
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 处理数据（假设第一行为标题）
        const headers = jsonData[0] as string[];
        const questionsData = jsonData.slice(1).map(row => {
          const rowData = row as any[];
          return headers.reduce((acc, header, index) => {
            acc[header] = rowData[index];
            return acc;
          }, {} as Record<string, any>);
        });

        // 验证并转换数据
        let processedData = questionsData.map(question => ({
          id: question['试题ID']+'' || null,
          question: question['题干'],
          course_id: question['课程ID'],
          answer: parseGetAnswer(question),
          type: parseQuestionType(question['题目类型']),
          tags: parseTags(question['标签']),
          options: parseOptions(question),
        }));
        processedData = processedData.filter(
          item => item.id !== null && checkAnswer(item, item.answer)
        )

        // 调用API批量导入
        const res = await apiClientWithToken.post("/back/api/study/test/batch_question_add", {
          questions: processedData
        })
        if (res.data.code === 200) {
          toast.success(`成功导入 ${processedData.length} 道题目`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            position: "top-right"
          });
          getQuestionData(1, rowsPerPage);
        } else {
          toast.error(`${res.data.message}`, {
            autoClose: 3000,
            draggable: true,
            closeOnClick: true,
            pauseOnHover: true
          })
        }
        setImportLoading(false);
          setIsProcessing(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        
      } catch (error) {
        toast.error('文件解析失败，请确认文件格式正确', {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          position: "top-right"
        });
        setImportLoading(false);
      } finally {
        setImportLoading(false);
        setIsProcessing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadImportTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['试题ID', '课程ID', '题干', '题目类型', '标签', '答案', 'A', 'B', 'C', 'D'],
      ['1001', 'MATH101', '1+1等于？', '单选', '数学,基础,多个标签使用,分割', 'A', '选项A', '选项B', '选项C', '选项D'],
      [
        '1002',
        '1001',
        '关于数据库服务器、数据库和表的关系，正确的说法是()',
        '单选',
        '难度1,简单',
        'B',
        '一个数据库服务器只能管理一个数据库，一个数据库只能包含一个表',
        '一个数据库服务器可以管理多个数据库，一个数据库可以包含多个表',
        '一个数据库服务器只能管理一个数据库，一个数据库可以包含多个表',
        '一个数据库服务器可以管理多个数据库，一个数据库只能包含一个表'
      ]

    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '题库模板');

    XLSX.writeFile(workbook, '题库导入模板.xlsx');
  };

  /**
   * 功能实现结束
   */

  const handelSaveQuestion = async (data: QuestionFormData, isNew: boolean) => {
  setIsSavingQuestion(true);
  setSaveProgress(10);
  setSaveProgressMessage('正在准备保存数据...');
  
  try {
    // 修复：简答题的答案应该使用实际的答案内容，而不是硬编码的"*"
    const requestData = {
      id: data.id,
      question: data.question,
      course_id: data.courseName,
      answer: data.answer, // 直接使用表单中的答案，无论什么题型
      type: parseInt(data.type),
      tag: Array2String(data.tags),
      content: data.options,
    };

    setSaveProgress(30);
    setSaveProgressMessage('正在连接服务器...');

    let apiUrl = "";
    let successMessage = "";
    let operationType = isNew ? "添加" : "修改";

    if (isNew) {
      apiUrl = "/back/api/study/test/question_add";
      successMessage = `添加题目 ${requestData.id}`;
    } else {
      apiUrl = "/back/api/study/test/question_up";
      successMessage = `修改题目 ${requestData.id}`;
    }


    setSaveProgress(50);
    setSaveProgressMessage(`正在${operationType}题目数据...`);

    const response = await apiClientWithToken.post(apiUrl, JSON.stringify(requestData));
    
    setSaveProgress(80);
    setSaveProgressMessage(`正在处理服务器响应...`);

    const res = response.data;
    
    if (res.code === 200) {
      setSaveProgress(100);
      setSaveProgressMessage(`${operationType}题目成功！`);
      
      if (isNew) {
        setQuestionsCount(prev => prev + 1);
        toast.success(`${successMessage} ${res.message}`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          position: "top-right"
        });
      } else {
        const newQuestion = questions.map(item => item.c_id === data.id ? {
          c_id: requestData.id,
          c_question: requestData.question,
          c_type: requestData.type as number,
          c_course_id: requestData.course_id,
          c_tag: requestData.tag,
          c_answer: requestData.answer,
          c_create_at: new Date().toLocaleDateString(),
          connect: requestData.content
        } : item);
        setQuestions(newQuestion);
        toast.success(`${successMessage} ${res.message}`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          position: "top-right"
        });
      }

      // 延迟关闭进度条和模态框
      setTimeout(() => {
        setIsSavingQuestion(false);
        setSaveProgress(0);
        setSaveProgressMessage('');
        setIsQuestionModalOpen(false); // 先关闭模态框
        
        // 然后刷新数据
        if (searchTerm.data.trim() && searchTerm.flag) {
          getQuestionDataByName(page, rowsPerPage, searchTerm.data);
        } else {
          getQuestionData(page, rowsPerPage);
        }
      }, 1000);
      
    } else {
      throw new Error(res.message || `${operationType}题目失败`);
    }

  } catch (error: any) {
    setIsSavingQuestion(false);
    setSaveProgress(0);
    setSaveProgressMessage('');
    
    const operationType = isNew ? "添加" : "修改";
    toast.error(`${operationType}题目失败: ${error.message}`, {
      autoClose: 3000,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      position: "top-right"
    });
  }
};

  const filteredAndSortedQuestions = useMemo(() => {
    let processedpermissions = [...questions].sort((a, b) => {
      const valA = a[orderBy];
      const valB = b[orderBy];
      if (valB < valA) return order === 'asc' ? 1 : -1;
      if (valB > valA) return order === 'asc' ? -1 : 1;
      return 0;
    });
    return processedpermissions;
  }, [questions, order, orderBy]);

  const handleRequestSort = (property: SortableQuestionsKeys) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  return (
  <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
    {/* 进度条遮罩层 */}
    {(isSavingQuestion || importLoading) && (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}
      >
        <Box
          sx={{
            backgroundColor: 'white',
            padding: 3,
            borderRadius: 2,
            minWidth: 300,
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            {isSavingQuestion ? '保存题目中...' : '导入题目中...'}
          </Typography>
          
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={isSavingQuestion ? saveProgress : undefined} 
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            {isSavingQuestion ? saveProgressMessage : '正在处理文件，请勿关闭窗口...'}
          </Typography>
          
          {isSavingQuestion && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {saveProgress}% 完成
            </Typography>
          )}
        </Box>
      </Box>
    )}
      <Typography variant="h4" component={'h1'} gutterBottom>
        题库管理
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        此页面用于管理平台试题。
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="搜索试题..."
            value={searchTerm.data}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: tableLaoding ? (
                <CircularProgress size={20} />
              ) : null
            }}
            sx={{ minWidth: { sm: 300 } }}
          />
          <Button
            variant="contained"
            onClick={handleSearchSubmit}
            disabled={tableLaoding}
            sx={{ ml: 1, minWidth: 80 }}
          >
            搜索
          </Button>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleAddQuestionClick}
          >
            添加试题
          </Button>
          <Button
            variant="outlined"
            onClick={downloadImportTemplate}
            startIcon={<DownloadIcon />}
          >
            下载导入模板
          </Button>
          <Box>
            <Button
              variant="contained"
              disabled={importLoading}
              onClick={handelImpoerQuestionFromCSV}
            >
              从EXCEL文件导入
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
          </Box>
        </Box>

      </Box>
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table aria-label="试题列表">
          <TableHead sx={{ bgcolor: "action.focus" }}>
            <TableRow>
              {[
                { id: 'c_id', label: '试题id' },
                { id: 'c_course_id', label: '课程id' },
                { id: "c_question", label: "题干" },
                { id: "c_type", label: "类型" },
                { id: "c_tag", label: "标签" },
                { id: "c_create_at", label: "创建时间" }
              ].map((headCell) => (
                <TableCell
                  key={headCell.id}
                  sortDirection={orderBy === headCell.id ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === headCell.id}
                    direction={orderBy === headCell.id ? order : 'asc'}
                    onClick={() => handleRequestSort(headCell.id as SortableQuestionsKeys)}
                  >
                    {headCell.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {
              tableLaoding ? (
                <TableRow>
                  <TableCell colSpan={7} align='center' sx={{ height: "40vh" }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedQuestions.length > 0 ?
                filteredAndSortedQuestions.map(question => (
                  <TableRow key={question.c_id} hover>
                    <TableCell sx={{ fontWeight: "medium" }}>
                      {question.c_id}
                    </TableCell>
                    <TableCell>
                      {question.c_course_id}
                    </TableCell>
                    <TableCell>
                      {question.c_question.length > 20 ? question.c_question.slice(0, 19) + "..." : question.c_question}
                    </TableCell>
                    <TableCell>
                      {TypeMap[question.c_type]}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {String2Array(question.c_tag).map((role, index) => (
                          <Chip
                            key={role}
                            label={role}
                            size="small"
                            color={ColorMap[index % ColorMap.length]}
                            sx={{ m: 0.5 }}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {question.c_create_at}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="查看试题详细">
                        <IconButton size="small" onClick={() => handelCheckQuestion(question)} color="default">
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑试题">
                        <IconButton size="small" onClick={() => handleEditQuestionClick(question)} color="primary">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除试题">
                        <IconButton size="small" onClick={() => handelDeleteQuestionClick(question)} color="error" >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">暂无相关数据。</Typography>
                    </TableCell>
                  </TableRow>
                )
            }
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 30, 50]}
          component="div"
          count={questionsCount}
          rowsPerPage={rowsPerPage}
          page={page - 1}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每页行数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`}
        />
      </TableContainer>

      {/* 编辑试题modal */}

     <QuestionModalForm
    open={isQuestionsModalOpen}
    onSave={handelSaveQuestion}
    onClose={() => {
        if (!isSavingQuestion) { // 只在非保存状态下允许关闭
            setIsQuestionModalOpen(false);
        }
    }}
    initialQuestion={questionToEdit}
    isSaving={isSavingQuestion} // 传递保存状态
/>

      <Dialog
        open={isProcessing}
        PaperProps={{ style: { backgroundColor: 'transparent', boxShadow: 'none' } }}
        aria-labelledby="processing-dialog-title"
        aria-describedby="processing-dialog-description"
      >
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2, color: 'white' }}>
            正在处理文件...
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'white' }}>
            请勿关闭窗口
          </Typography>
        </DialogContent>
      </Dialog>

      {
        questionCheck && (
          <ViewQuestionModal
            open={checkOpen}
            onCancle={() => setCheckOpen(false)}
            initialData={questionCheck}
          />
        )
      }


      {questionToDelete && (
        <ConfirmActionDialog
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="确认删除题目"
          message={`您确定要删除试题 "${questionToDelete?.c_id}" 吗？此操作无法撤销。`}
          onConfirm={confirmDeleteQuestion}
          isProcessing={isProcessing} // 添加这个prop
        />
      )}
    </Paper >
  );
}

export default QuestionPage;