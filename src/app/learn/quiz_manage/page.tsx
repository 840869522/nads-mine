"use client";

import QuizAddModal, { QuizDisplayItem } from "@/components/learning/QuizAddModal";
import { apiClientWithToken } from "@/utils/axios";
import { Box, Button, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";



const QuizManagePage: React.FC = () => {

    const [page, setPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    const [quizData, setQuizData] = useState<QuizDisplayItem[]>([]);
    const [quizCount, setQuizCount] = useState<number>(0);
    const [tableLoading, setTableLoading] = useState<boolean>(true);


    const [isQuizModalOpen, setIsQuizModalOpen] = useState<boolean>(false);
    const [quizToEdit, setQuizToEdit] = useState<QuizDisplayItem | null>(null);

    useEffect(()=>{
        getQuizList(page,rowsPerPage);
    },[page,rowsPerPage]);

    const getQuizList = (page:number,pagesize:number)=>{
        setTableLoading(true);
        apiClientWithToken.post("/back/study/test/test_list",JSON.stringify({
            page:page,
            pageSize: pagesize
        })).then((res)=>{
            if (res.data.code === 200) {
                setQuizData(res.data.data.data);
                setQuizCount(res.data.data.count);
            }else {
                setQuizData([]);
                setQuizCount(0);
            }
        }).finally(()=>{
            setTableLoading(false);
        });
    }
    

    const handleAddQuizClick = ()=>{

    }

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage + 1);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(1);
    };

    const handelSave = (formData: QuizDisplayItem, isNew: boolean) => {
        if (isNew) {

        } else {

        }
    }

    return (
        <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography>
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
                                        { id: 'c_id', label: '试题id' },
                                        { id: 'c_course_id', label: '课程id' },
                                        { id: "c_question", label: "题干" },
                                        { id: "c_type", label: "类型" },
                                        { id: "c_tag", label: "标签" },
                                        { id: "c_create_at", label: "创建时间" }
                                    ].map((headCell) => (
                                        <TableCell
                                            key={headCell.id}
                                        >
                                            {headCell.label}
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
                                ) : quizData.length > 0 ? (
                                    quizData.map(item =>(
                                        <TableRow key={item.c_id} hover>
                                            <TableCell>
                                                {item.c_id}
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
                initialData={quizToEdit}
            />
        </Paper >
    );
};

export default QuizManagePage;