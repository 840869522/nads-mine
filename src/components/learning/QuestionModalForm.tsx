"use client";

import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Box,
    useMediaQuery,
    useTheme,
    FormHelperText,
    IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DynamicOptionInputs from "@/components/input/DynamicOptionInputs";
import { Sttring2Array } from "@/utils/string";

export type SelectOption = {
    c_id: string,
    c_question_id?: string,
    c_content: string
}

export type QuestionDisplayItem = {
    c_id: string,
    c_course_id: string,
    c_question: string,
    c_answer: string,
    c_type: string,
    c_tag: string,
    c_create_at: string,
    connect: SelectOption[]
}

export type QuestionFormData = {
    id: string;
    question: string;
    answer: string;
    type: "single" | "multiple" | "true_false" | "essay" | string;
    tags: string[];
    courseName: string;
    options: SelectOption[];
};

export type QuestionModalProps = {
    open: boolean;
    onClose: () => void;
    onSave: (data: QuestionFormData, isNew: boolean) => void;
    initialQuestion: QuestionDisplayItem | null;
};

const QuestionModalForm: React.FC<QuestionModalProps> = ({
    open,
    onClose,
    onSave,
    initialQuestion,
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const [formData, setFormData] = useState<QuestionFormData>({
        id: "",
        question: "",
        answer: "",
        type: "single",
        tags: [''],
        courseName: "",
        options: [{ c_id: "", c_content: "" }]
    });

    const [errors, setErrors] = useState<Record<string, string | string[]>>({
        id: '',
        question: '',
        answer: '',
        type: '',
        courseName: '',
        tags: '',
        options: [''],
    });

    const isNew = !initialQuestion;

    useEffect(() => {
        if (open) {
            if (initialQuestion) {
                setFormData({
                    id: initialQuestion?.c_id,
                    question: initialQuestion?.c_question,
                    answer: initialQuestion?.c_answer,
                    type: initialQuestion?.c_type,
                    tags: Sttring2Array(initialQuestion?.c_tag),
                    courseName: initialQuestion?.c_course_id,
                    options: initialQuestion.connect,
                });
            } else {
                setFormData({
                    id: "",
                    question: "",
                    answer: "",
                    type: "single",
                    tags: [''],
                    courseName: "",
                    options: [{ c_id: "", c_content: "" }]
                })
            }
            setErrors({});
        }
    }, [initialQuestion, open]);

    // 类型选项映射
    const typeOptions = [
        { value: 'single', label: '单选题' },
        { value: 'multiple', label: '多选题' },
        { value: 'true_false', label: '判断题' },
        { value: 'essay', label: '主观题' },
    ];

    // 输入变化处理
    const handleInputChange = (field: keyof QuestionFormData, value: string) => {
        setFormData({ ...formData, [field]: value });
        setErrors({ ...errors, [field]: '' });
    };

    // 标签变化处理
    const handleTagChange = (index: number, value: string) => {
        const newTags = [...formData.tags];
        newTags[index] = value;
        setFormData({ ...formData, tags: newTags });
        if (!value.trim()) setErrors({ ...errors, tags: '标签不能为空' });
        else setErrors({ ...errors, tags: '' });
    };

    // 添加标签
    const handleAddTag = () => {
        setFormData({ ...formData, tags: [...formData.tags, ''] });
    };

    // 删除标签
    const handleRemoveTag = (index: number) => {
        const newTags = formData.tags.filter((_, i) => i !== index);
        setFormData({ ...formData, tags: newTags });
    };

    // 类型选择处理
    const handleTypeChange = (e: React.ChangeEvent<{ value: string }>) => {
        const value = e.target.value as QuestionFormData['type'];
        setFormData({ ...formData, type: value });
        setErrors({ ...errors, type: '' });

        if (value !== 'single' && value !== 'multiple') {
            setFormData({ ...formData, options: [], type: value });
        }
    };

    // 添加选项
    const handleAddOption = () => {
        setFormData({
            ...formData,
            options: [...formData.options, { c_id: '', c_content: '', c_question_id: formData.id }],
        });
        const newErrors = errors.options ? [...errors.options, ''] : [''];
        setErrors({ ...errors, options: newErrors });
    };

    // 删除选项
    const handleRemoveOption = (index: number) => {
        if (formData.options.length <= 1) return;
        const newOptions = formData.options.filter((_, i) => i !== index);
        setFormData({ ...formData, options: newOptions });
        const newErrors = errors.options ? errors.options.filter((_, i) => i !== index) : [];
        setErrors({ ...errors, options: newErrors });
    };

    // 表单验证
    const validateForm = (): boolean => {
        const newErrors: Record<string, string | string[]> = {};

        if (!formData.id.trim()) newErrors.id = 'ID 不能为空';
        if (!formData.question.trim()) newErrors.question = '题干不能为空';
        if (!formData.answer.trim()) newErrors.answer = '答案不能为空';
        if (!formData.type) newErrors.type = '请选择题型';
        if (formData.tags.some((tag) => !tag.trim())) newErrors.tags = '所有标签不能为空';
        if (!formData.courseName.trim()) newErrors.courseName = '课程名不能为空';

        // 选项校验（仅在单选/多选时）
        if (['single', 'multiple'].includes(formData.type)) {
            if (formData.options.length === 0) {
                newErrors.options = ['至少添加一个选项'];
            } else {
                const optionErrors = formData.options.map((opt) => {
                    if (!opt.c_id.trim() || !opt.c_content.trim()) {
                        return '选项和描述不能为空';
                    }
                    return '';
                });
                newErrors.options = optionErrors;
            }
        }
        setErrors(newErrors);
        console.log(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // 提交表单
    const handleSubmit = () => {
        console.log(validateForm());
        if (validateForm()) {
            console.log(111);
            onSave(formData, isNew);
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            fullScreen={fullScreen}
            PaperProps={{ sx: { borderRadius: 2 } }}
        >
            <DialogTitle>{isNew ? '添加新题目' : `编辑题目: ${formData.id}`}</DialogTitle>
            <DialogContent>
                <Box mt={2}>
                    {/* ID */}
                    <TextField
                        fullWidth
                        label="ID"
                        value={formData.id}
                        onChange={(e) => handleInputChange('id', e.target.value)}
                        error={!!errors.id}
                        helperText={errors.id}
                        disabled={!isNew}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    />

                    {/* 题干 */}
                    <TextField
                        fullWidth
                        label="题干"
                        value={formData.question}
                        onChange={(e) => handleInputChange('question', e.target.value)}
                        error={!!errors.question}
                        helperText={errors.question}
                        multiline
                        rows={3}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    />


                    {/* 类型选择 */}
                    <FormControl fullWidth variant="outlined" size="small" sx={{ mb: 2 }}>
                        <InputLabel id="type-select-label">题型</InputLabel>
                        <Select
                            labelId="type-select-label"
                            value={formData.type}
                            onChange={handleTypeChange}
                            label="题型"
                            error={!!errors.type}
                        >
                            {typeOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                        {errors.type && <FormHelperText error>{errors.type}</FormHelperText>}
                    </FormControl>


                    {/* 选项输入（仅在单选/多选时显示） */}
                    {['single', 'multiple','true_false'].includes(formData.type) && (
                        <Box mb={2}>
                            <DynamicOptionInputs
                                options={formData.options}
                                onChange={(options) => setFormData({ ...formData, options })}
                                onAdd={handleAddOption}
                                onRemove={handleRemoveOption}
                                errors={Array.isArray(errors.options) ? errors.options : ['']}
                            />
                        </Box>
                    )}

                    {/* 答案 */}
                    {
                        !['essay'].includes(formData.type) && (
                            <TextField
                                fullWidth
                                label="答案"
                                value={formData.answer}
                                onChange={(e) => handleInputChange('answer', e.target.value)}
                                error={!!errors.answer}
                                helperText={errors.answer}
                                multiline
                                rows={2}
                                variant="outlined"
                                size="small"
                                sx={{ mb: 2 }}
                            />
                        )
                    }


                    {/* 标签管理 */}
                    <Box mb={2}>
                        <Box display="flex" flexDirection="column" gap={1}>
                            {formData.tags.map((tag, index) => (
                                <Box
                                    key={index}
                                    display="flex"
                                    gap={1}
                                    alignItems="center"
                                >
                                    <TextField
                                        fullWidth
                                        label={`标签 ${index + 1}`}
                                        value={tag}
                                        onChange={(e) => handleTagChange(index, e.target.value)}
                                        error={!!errors.tags}
                                        helperText={errors.tags}
                                        variant="outlined"
                                        size="small"
                                    />
                                    <IconButton
                                        color="error"
                                        onClick={() => handleRemoveTag(index)}
                                        disabled={formData.tags.length === 1}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            ))}
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<AddIcon />}
                                onClick={handleAddTag}
                            >
                                添加标签
                            </Button>
                        </Box>
                    </Box>

                    {/* 课程名 */}
                    <TextField
                        fullWidth
                        label="课程名"
                        value={formData.courseName}
                        onChange={(e) => handleInputChange('courseName', e.target.value)}
                        error={!!errors.courseName}
                        helperText={errors.courseName}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    />
                </Box>
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
    );
};

export default QuestionModalForm;