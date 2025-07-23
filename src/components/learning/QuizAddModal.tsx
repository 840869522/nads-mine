"use client";

import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    useMediaQuery,
    useTheme
} from "@mui/material";
import { useEffect, useState } from "react";


export type QuizDisplayItem = {
    c_id: string,
    c_name: string,
    c_description: string,
    c_paper_count: number,
    c_start: string,
    c_end: string,
    c_course_id: string,
    c_create_at?: string
}

type QuizAddProps = {
    open: boolean,
    onClose: () => void,
    onSave: (data: QuizDisplayItem, isNew: boolean) => void,
    initialData: QuizDisplayItem | null
}

const QuizAddModal: React.FC<QuizAddProps> = ({
    open,
    onClose,
    onSave,
    initialData
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const isNew = !initialData;
    const [formData, setFormData] = useState<QuizDisplayItem>({
        c_id: "",
        c_course_id: "",
        c_name: "",
        c_description: "",
        c_start: "",
        c_end: "",
        c_paper_count: 0
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    c_id: initialData.c_id,
                    c_course_id: initialData.c_course_id,
                    c_name: initialData.c_name,
                    c_description: initialData.c_description,
                    c_start: initialData.c_start,
                    c_end: initialData.c_end,
                    c_paper_count: initialData.c_paper_count,
                    c_create_at: initialData.c_create_at || ""
                });
            } else {
                setFormData({
                    c_id: "",
                    c_course_id: "",
                    c_name: "",
                    c_description: "",
                    c_start: "",
                    c_end: "",
                    c_paper_count: 0
                })
            }
        }

    }, [open, initialData]);


    const validateForm = () => {
        if (!formData)
            return false;
        else {
            return true;
        }
    }

    const handleSubmit = () => {
        if (validateForm()) {
            onSave(formData, isNew);
            onClose();
        }
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            fullScreen={fullScreen}
            PaperProps={{ sx: { borderRadius: 2 } }}
        >
            <DialogTitle>
                {isNew ? "新增测试" : `编辑测试 - ${initialData?.c_id}`}
            </DialogTitle>
            <DialogContent>

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">
                    取消
                </Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                    {isNew ? '添加' : '保存'}
                </Button>
            </DialogActions>
        </Dialog>
    )
};

export default QuizAddModal;