import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from "@mui/material";
import { useEffect, useState } from "react";

export type QuizDisplayItem = {
    c_id: string
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
        c_id: ""
    });

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    c_id: initialData.c_id
                });
            } else {
                setFormData({
                    c_id: ""
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