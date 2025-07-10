"use client";

import React, { useState } from "react";
import { Dialog, DialogTitle, useMediaQuery } from "@mui/material";
import { useTheme } from '@mui/material/styles';

export type QuestionModalFormData = {
    c_id: string
}

interface QuestionModalFormProps {
    open: boolean;
    onClose: () => void;
    onSave: (role: QuestionModalFormData, isNew: boolean) => void;
    initialQuestion: QuestionModalFormData | null;
}

const QuestionModalForm: React.FC<QuestionModalFormProps> = ({
    open,
    onClose,
    onSave,
    initialQuestion
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [formData, setFormData] = useState<QuestionModalFormData>({ c_id: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const isNewRole = !initialQuestion;
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
                {isNewRole ? '添加新权限' : `编辑权限: ${initialQuestion?.c_id}`}
            </DialogTitle>
        </Dialog>
    );
}

export default QuestionModalForm;