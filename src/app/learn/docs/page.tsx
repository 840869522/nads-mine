"use client";

import { apiClientWithToken } from "@/utils/axios";
import { Box, Paper, Typography, Button, InputAdornment, CircularProgress, TextField, TableContainer, Table, TableHead, TableRow, TableCell, TableSortLabel, TableBody, Tooltip, IconButton, Chip, TablePagination } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from "@mui/icons-material/Edit";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ConfirmActionDialog from "@/components/scenario/ConfirmActionDialog";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from '@mui/icons-material/Visibility';
import QuestionModalForm, { QuestionFormData, QuestionDisplayItem } from "@/components/learning/QuestionModalForm";
import { Array2String, String2Array } from "@/utils/string";
import { ColorMap } from "@/utils/color";
import { toast } from "react-toastify";
import { SafetyCheckOutlined } from "@mui/icons-material";
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
  const [questionsCount, setQuestionsCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [order, setOrder] = useState<Order>("asc");
  const [orderBy, setOrderBy] = useState<SortableQuestionsKeys>("c_id");
  const [questionToEdit, setQuesionToEdit] = useState<QuestionDisplayItem | null>(null);
  const [questionCheck, setQuestionCheck] = useState(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [tableLaoding, setTableLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState({ data: "", flag: false });
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [questionToDelete, setQuesionToDelete] = useState<QuestionDisplayItem | null>(null);
  const [isQuestionsModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);

  useEffect(() => {
    getQuestionData(1, rowsPerPage);
  }, [])

  useEffect(() => {
    if (page === 1 && rowsPerPage == 5)
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

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm({ data: event.target.value.toLowerCase(), flag: true });
    setPage(1);
  };

  const handleSearchSubmit = async () => {
    setTableLoading(true);
    try {
      const res = await apiClientWithToken.post(`/back/api/support/permission/search`, JSON.stringify({
        page: 1,
        pagesize: rowsPerPage,
        name: searchTerm.data || ""
      }));
      if (res.data.code === 200) {
        setQuestions(res.data.data.data);
        setQuestionsCount(res.data.data.count);
        setPage(1);
      } else {
        setQuestions([]);
        toast.error(`搜索权限时发生错误 - ${res.data.message}`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          position: "top-right"
        });
        setQuestionsCount(0);
      }
    }catch (error) {
      toast.error(`搜索权限时发生错误 - ${error.message}`, {
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

  const confirmDeleteQuestion = () => {
    setIsConfirmDeleteOpen(false);
    apiClientWithToken.post("/back/api/study/test/question_del", JSON.stringify({ id: questionToDelete?.c_id })).then(res => {
      if (res.data.code === 200) {
        toast.success(`删除题目 ${questionToDelete?.c_id} 成功`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          position: "top-right"
        });
        setPage(1);
        getQuestionData(1, rowsPerPage);
      } else {
        toast.error(`删除题目 ${questionToDelete?.c_id} 失败`, {
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          position: "top-right"
        });
      }
    });
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

  const handelCheckQuestion = ( question: QuestionDisplayItem) =>{
    setQuestionCheck(question);
    setCheckOpen(true);
  }


  const handelSaveQuestion = (data: QuestionFormData, isNew: boolean) => {
    var requestData = {
      id: data.id,
      question: data.question,
      course_id: data.courseName,
      answer: data.type === 4 ? "*" : data.answer,
      type: data.type,
      tag: Array2String(data.tags),
      content: data.options,
    }
    if (isNew) {
      apiClientWithToken.post("/back/api/study/test/question_add", JSON.stringify(requestData)).then(res => {
        if (res.data.code === 200) {
          setQuestionsCount(prev => prev + 1)
          toast.success(`添加题目 ${requestData.id} ${res.data.message}`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            position: "top-right"
          });
        } else {
          toast.error(`添加题目 ${requestData.id} ${res.data.message}`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            position: "top-right"
          });
        }
      });
    } else {
      apiClientWithToken.post("/back/api/study/test/question_up", JSON.stringify(requestData)).then(res => {
        if (res.data.code === 200) {
          const newQuestion = questions.map(item => item.c_id === data.id ? {
            c_id: requestData.id,
            c_question: requestData.question,
            c_type: requestData.type,
            c_course_id: requestData.course_id,
            c_tag: requestData.tag,
            c_answer: requestData.answer,
            c_create_at: new Date().toLocaleDateString(),
            connect: requestData.content
          } : item);
          setQuestions(newQuestion);
          toast.success(`修改题目 ${requestData.id} ${res.data.message}`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            position: "top-right"
          });
        } else {
          toast.error(`修改题目 ${requestData.id} ${res.data.message}`, {
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            position: "top-right"
          });
        }
      })
    }
  }

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
            size="small"
            onClick={handleSearchSubmit}
            disabled={tableLaoding}
            sx={{ ml: 1, minWidth: 80 }}
          >
            搜索
          </Button>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleAddQuestionClick}
        >
          添加试题
        </Button>
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
                      {question.c_question}
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
                        <IconButton size="small" onClick={()=>handelCheckQuestion(question)} color="default">
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
                      <Typography color="text.secondary">没有找到匹配的权限。</Typography>
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
        onClose={() => setIsQuestionModalOpen(false)}
        initialQuestion={questionToEdit}
      />

      {
        questionCheck && (
          <ViewQuestionModal
            open={checkOpen}
            onCancle={()=>setCheckOpen(false)}
            initialData={questionCheck}
          />
        )
      }


      {questionToDelete && (
        <ConfirmActionDialog
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="确认删除题目"
          message={`您确定要删除权限 "${questionToDelete?.c_id}" 吗？此操作无法撤销。`}
          onConfirm={confirmDeleteQuestion}
        />
      )}
    </Paper >
  );
}

export default QuestionPage;