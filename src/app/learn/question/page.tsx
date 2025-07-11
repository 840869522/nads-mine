"use client";

import { apiClientWithToken } from "@/utils/axios";
import { Box, Paper, Typography, Alert as MuiAlert, Button, InputAdornment, CircularProgress, TextField, TableContainer, Table, TableHead, TableRow, TableCell, TableSortLabel, TableBody, Tooltip, IconButton } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from "@mui/icons-material/Edit";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ConfirmActionDialog from "@/components/scenario/ConfirmActionDialog";
import DeleteIcon from "@mui/icons-material/Delete";
import QuestionModalForm, { QuestionFormData } from "@/components/learning/QuestionModalForm";

type SelectOption = {
    c_id: string,
    c_question_id: string,
    c_content: string
}

type QuestionDisplayItem = {
    c_id: string,
    c_course_id: string,
    c_question: string,
    c_type: string,
    c_tag: string,
    c_create_at: string,
    connect: SelectOption[]
}

type Order = `asc` | `desc`;
type SortableQuestionsKeys = keyof Pick<QuestionDisplayItem, "c_id" | "c_course_id" | "c_question" | "c_type" | "c_tag">;


const BACK_BASE_URL = "/back/api/";

const QuestionPage: React.FC = () => {

    const [questions, setQuestions] = useState<QuestionDisplayItem[]>([]);
    const [questionsCount, setQuestionsCount] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(5);
    const [order, setOrder] = useState<Order>("asc");
    const [orderBy, setOrderBy] = useState<SortableQuestionsKeys>("c_id");
    const [questionToEdit, setQuesionToEdit] = useState(null);

    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | "error", text: string } | null>(null);
    const [tableLaoding, setTableLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState({ data: "", flag: false });
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [questionToDelete, setQuesionToDelete] = useState<QuestionDisplayItem | null>(null);
    const [isQuestionsModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);



    useEffect(() => {
        if (searchTerm.data.trim())
            getQuestionDataByName(page, rowsPerPage, searchTerm.data);
        else
            getQuestionData(page, rowsPerPage);

    }, [page, rowsPerPage, searchTerm]);


    const getQuestionData = (page: number, pagesize: number) => {
        setTableLoading(true);
        apiClientWithToken.post(`/back/api/study/test/question_list`, JSON.stringify({
            page: page,
            pagesize: pagesize
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
            pagesize: pagesize
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
                name: searchTerm.data
            }));

            if (res.data.code === 200) {
                setQuestions(res.data.data.data);
                setQuestionsCount(res.data.data.count);
                setPage(1);
            } else {
                setQuestions([]);
                setFeedbackMessage({ type: 'error', text: '搜索权限时发生错误' });
                setQuestionsCount(0);
            }
        } finally {
            setTableLoading(false);
        }
    };

    const handleAddQuestionClick = () => {
        setIsQuestionModalOpen(true);
        setQuesionToEdit(null);
    }

    const confirmDeleteQuestion = () => {

    };




    const handleEditQuestionClick = (question: QuestionDisplayItem) => {
        apiClientWithToken.post("/back/api/study/test/question_info", JSON.stringify({
            id: question.c_id
        })).then((res) => {
            if (res.data.code === 200) {

            }
        }).finally(() => {
            setIsQuestionModalOpen(true);
        })
    };

    const handelDeleteQuestionClick = (question: QuestionDisplayItem) => {
        setIsQuestionModalOpen(true);
    }


    const onSave = (data: QuestionFormData, isNew: boolean) => {

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
            {feedbackMessage && (
                <MuiAlert severity={feedbackMessage.type} sx={{ mb: 2 }} onClose={() => setFeedbackMessage(null)}>
                    {feedbackMessage.text}
                </MuiAlert>
            )}

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
                    <TextField
                        variant="outlined"
                        size="small"
                        placeholder="搜索权限..."
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
                                            {question.c_type}
                                        </TableCell>
                                        <TableCell>
                                            {question.c_tag}
                                        </TableCell>
                                        <TableCell>
                                            {question.c_create_at}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="编辑权限">
                                                <IconButton size="small" onClick={() => handleEditQuestionClick(question)} color="primary">
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="删除权限">
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
            </TableContainer>

            {/* 编辑试题modal */}

            <QuestionModalForm
                open={isQuestionsModalOpen}
                onSave={onSave}
                onClose={() => setIsQuestionModalOpen(false)}
                initialQuestion={questionToEdit}
            />


            {questionToDelete && (
                <ConfirmActionDialog
                    open={isConfirmDeleteOpen}
                    onClose={() => setIsConfirmDeleteOpen(false)}
                    title="确认删除权限"
                    message={`您确定要删除权限 "${questionToDelete?.c_id}" 吗？此操作无法撤销。`}
                    onConfirm={confirmDeleteQuestion}
                />
            )}
        </Paper >
    );
}

export default QuestionPage;