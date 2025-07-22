"use client";

import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    Tooltip,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from "@mui/icons-material/Edit";

import QuizAddModal, { QuizDisplayItem } from "@/components/learning/QuizAddModal";
import { apiClientWithToken } from "@/utils/axios";
import ConfirmActionDialog from "@/components/scenario/ConfirmActionDialog";
import { toast } from "react-toastify";

type Order = "asc" | "desc";

type SortableQuizKeys = keyof Pick<QuizDisplayItem, "c_id" | "c_course_id" | "c_question" | "c_type" | "c_tag">;

const QuizManagePage: React.FC = () => {

    const [page, setPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    const [quizData, setQuizData] = useState<QuizDisplayItem[]>([]);
    const [quizCount, setQuizCount] = useState<number>(0);
    const [tableLoading, setTableLoading] = useState<boolean>(true);


    const [isQuizModalOpen, setIsQuizModalOpen] = useState<boolean>(false);
    const [quizToOperate, setQuizToOperate] = useState<QuizDisplayItem | null>(null);
    const [checkQuizOpen, setQuizCheckOpen] = useState<boolean>(false);

    const [quizToDelete, setQuizToDelete] = useState<QuizDisplayItem | null>(null);
    const [deleteConfirmOpen, setQuizDeleteConfirmOpen] = useState<boolean>(false);

    const [order, setOrder] = useState<Order>("asc");
    const [orderBy, setOrderBy] = useState<SortableQuizKeys>("c_id");

    useEffect(() => {
        getQuizList(page, rowsPerPage);
    }, []);

    useEffect(() => {
        if (page === 1 && rowsPerPage === 10)
            return
        else getQuizList(page, rowsPerPage);
    }, [page, rowsPerPage]);

    const getQuizList = (page: number, pagesize: number) => {
        setTableLoading(true);
        apiClientWithToken.post("/back/api/study/test/test_list", JSON.stringify({
            page: page,
            pageSize: pagesize
        })).then((res) => {
            if (res.data.code === 200) {
                setQuizData(res.data.data.data);
                setQuizCount(res.data.data.count);
            } else {
                setQuizData([]);
                setQuizCount(0);
            }
        }).finally(() => {
            setTableLoading(false);
        });
    }


    const handleAddQuizClick = () => {

    }

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage + 1);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(1);
    };

    const handelSave = (formData: QuizDisplayItem, isNew: boolean) => {
        var data = { ...formData }
        if (isNew) {
            apiClientWithToken.post("/back/api/study/test/test_add", JSON.stringify({
                ...data
            })).then((res) => {
                if (res.data.code === 200) {
                    toast.success(`新增测试 “${quizToDelete?.c_name}” 成功`, {
                        autoClose: 3000,
                        closeOnClick: true,
                        draggable: true,
                        pauseOnHover: true,
                        position: "top-right",
                    })
                } else {
                    toast.error(`新增测试失败 - ${res.data.message}`, {
                        autoClose: 3000,
                        closeOnClick: true,
                        draggable: true,
                        pauseOnHover: true,
                        position: "top-right",
                    })
                }
            }).catch((err) => {
                toast.success(`新增测试失败 - ${err.message}`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    draggable: true,
                    pauseOnHover: true,
                    position: "top-right",
                })
            })
        } else {
            apiClientWithToken.post("/back/api/study/test/test_update", JSON.stringify({
                id: quizToOperate?.c_id,
                data: { ...data }
            })).then((res) => {
                if (res.data.code === 200) {
                    toast.success(`修改测试 “${quizToDelete?.c_name}” 成功`, {
                        autoClose: 3000,
                        closeOnClick: true,
                        draggable: true,
                        pauseOnHover: true,
                        position: "top-right",
                    })
                } else {
                    toast.error(`修改测试失败 - ${res.data.message}`, {
                        autoClose: 3000,
                        closeOnClick: true,
                        draggable: true,
                        pauseOnHover: true,
                        position: "top-right",
                    })
                }
            }).catch((err) => {
                toast.success(`修改测试失败 - ${err.message}`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    draggable: true,
                    pauseOnHover: true,
                    position: "top-right",
                })
            })
        }
    }


    const handleOperateQuiz = (quiz: QuizDisplayItem, check: boolean) => {
        setQuizToOperate(quiz);
        check ? setQuizCheckOpen(true) : setIsQuizModalOpen(true);
    }

    const handelDeleteQuizClicke = (quiz: QuizDisplayItem) => {
        setQuizToDelete(quiz);
        setQuizDeleteConfirmOpen(true);
    }

    const handelDeleteQuiz = () => {
        apiClientWithToken.post("/back/api/study/test/test_del", JSON.stringify({ id: quizToDelete?.c_id })).then(res => {
            if (res.data.code === 200) {
                toast.success(`删除测试 “${quizToDelete?.c_name}” 成功`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    draggable: true,
                    pauseOnHover: true,
                    position: "top-right",
                })
            } else {
                toast.error(`删除测试失败 - ${res.data.message}`, {
                    autoClose: 3000,
                    closeOnClick: true,
                    draggable: true,
                    pauseOnHover: true,
                    position: "top-right",
                })
            }
        }).catch(err => {
            toast.success(`删除测试失败 - ${err.message}`, {
                autoClose: 3000,
                closeOnClick: true,
                draggable: true,
                pauseOnHover: true,
                position: "top-right",
            })
        }).finally(() => {
            setQuizToDelete(null);
            setQuizDeleteConfirmOpen(false);
        })
    };


    const filteredAndSortedQuiz = useMemo(() => {
        let processedpermissions = [...quizData].sort((a, b) => {
          const valA = a[orderBy];
          const valB = b[orderBy];
          if (valB < valA) return order === 'asc' ? 1 : -1;
          if (valB > valA) return order === 'asc' ? -1 : 1;
          return 0;
        });
        return processedpermissions;
      }, [quizData, order, orderBy]);
    
      const handleRequestSort = (property: SortableQuizKeys) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
      };

    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h4" component={'h1'} gutterBottom>
                测试管理页面
            </Typography>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
                <Box>
                    <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={handleAddQuizClick}
                    >
                        添加测试
                    </Button>
                </Box>

                <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
                    <Table aria-label="测试列表">
                        <TableHead sx={{ bgcolor: "action.focus" }}>
                            <TableRow>
                                {
                                    [
                                        { id: 'c_name', label: '测试名' },
                                        { id: "c_course_id", label: "课程ID" },
                                        { id: "c_description", label: "描述" },
                                        { id: "c_paper_count", label: "试卷数" },
                                        { id: "c_start", label: "开始时间" },
                                        { id: "c_end", label: "结束时间" },
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
                                    ))
                                }
                                <TableCell align="center">操作</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {
                                tableLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align='center' sx={{ height: "40vh" }}>
                                            <CircularProgress />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredAndSortedQuiz.length > 0 ? (
                                    filteredAndSortedQuiz.map(quiz => (
                                        <TableRow key={quiz.c_id} hover>
                                            <TableCell>
                                                {quiz.c_name}
                                            </TableCell>
                                            <TableCell>
                                                {quiz.c_course_id}
                                            </TableCell>
                                            <TableCell>
                                                {quiz.c_description}
                                            </TableCell>
                                            <TableCell>
                                                {quiz.c_paper_count}
                                            </TableCell>
                                            <TableCell>
                                                {quiz.c_start}
                                            </TableCell>
                                            <TableCell>
                                                {quiz.c_end}
                                            </TableCell>
                                            <TableCell>
                                                {quiz.c_create_at}
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title="查看试题详细">
                                                    <IconButton size="small" onClick={() => handleOperateQuiz(quiz, true)} color="default">
                                                        <VisibilityIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="编辑试题">
                                                    <IconButton size="small" onClick={() => handleOperateQuiz(quiz, false)} color="primary">
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="删除试题">
                                                    <IconButton size="small" onClick={() => handelDeleteQuizClicke(quiz)} color="error" >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
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
                        count={quizCount}
                        rowsPerPage={rowsPerPage}
                        page={page - 1}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="每页行数:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count !== -1 ? count : `超过 ${to}`}`}
                    />
                </TableContainer>
            </Box >

            <QuizAddModal
                open={isQuizModalOpen}
                onClose={() => setIsQuizModalOpen(false)}
                onSave={handelSave}
                initialData={quizToOperate}
            />


            {
                quizToDelete && (
                    <ConfirmActionDialog
                        open={deleteConfirmOpen}
                        onClose={() => setQuizDeleteConfirmOpen(false)}
                        onConfirm={handelDeleteQuiz}
                        title="确认删除测试"
                        message={`您确定要删除测试 "${quizToDelete?.c_name}" 吗？此操作无法撤销。`}
                    />
                )
            }
        </Paper >
    );
};

export default QuizManagePage;