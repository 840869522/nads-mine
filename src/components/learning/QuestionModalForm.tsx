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
    Autocomplete,
    CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DynamicOptionInputs from "@/components/input/DynamicOptionInputs";
import { String2Array } from "@/utils/string";
import { apiClientWithToken } from "@/utils/axios";

export type SelectOption = {
    c_id: string,
    c_question_id?: string,
    c_content: string
}

export type CourseItem = {
    c_course_id: string,
    c_course_name: string
}

export type QuestionDisplayItem = {
    c_id: string,
    c_course_id: string,
    c_question: string,
    c_answer: string,
    c_type: number,
    c_tag: string,
    c_create_at: string,
    connect: SelectOption[]
}

export type QuestionFormData = {
    id: string;
    question: string;
    answer: string;
    type: 1 | 2 | 3 | 4 | number;
    tags: string[];
    courseName: string;
    options: SelectOption[];
};

export type QuestionModalProps = {
    open: boolean;
    onClose: () => void;
    onSave: (data: QuestionFormData, isNew: boolean) => void;
    initialQuestion: QuestionDisplayItem | null;
    isSaving?: boolean; 
};

const QuestionModalForm: React.FC<QuestionModalProps> = ({
    open,
    onClose,
    onSave,
    initialQuestion,
    isSaving = false,
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const [formData, setFormData] = useState<QuestionFormData>({
        id: "",
        question: "",
        answer: "",
        type: 1,
        tags: [''],
        courseName: "",
        options: [{ c_id: "", c_content: "" }]
    });

    const [errors, setErrors] = useState<Record<string, string | string[]>>({
        id: '',
        question: '',
        answer: '',
        type: 1,
        courseName: '',
        tags: '',
        options: [''],
    });

    // 课程相关状态
    const [courses, setCourses] = useState<CourseItem[]>([]);
    const [courseLoading, setCourseLoading] = useState<boolean>(false);
    const [courseSearch, setCourseSearch] = useState<string>("");
    const [courseOpen, setCourseOpen] = useState<boolean>(false);

    const isNew = !initialQuestion;

    // 获取课程列表
    const fetchCourses = async (search?: string) => {
        setCourseLoading(true);
        try {
            // 调用你的后端API获取课程列表
            // 注意：这里假设你的API支持搜索参数，如果不支持可以去掉search参数
            const response = await apiClientWithToken.get('/back/api/study/test/getCourses', {
                params: search ? { search } : {}
            });
            
            if (response.data.code === 200) {
                setCourses(response.data.data || []);
            } else {
                setCourses([]);
            }
        } catch (error) {
            console.error("获取课程列表失败:", error);
            setCourses([]);
        } finally {
            setCourseLoading(false);
        }
    };

    // 当下拉框打开时获取课程列表
    useEffect(() => {
        if (courseOpen && courses.length === 0) {
            fetchCourses();
        }
    }, [courseOpen]);

    // 搜索课程
    useEffect(() => {
        if (courseSearch.trim()) {
            const timer = setTimeout(() => {
                fetchCourses(courseSearch);
            }, 500);
            
            return () => clearTimeout(timer);
        }
    }, [courseSearch]);

    useEffect(() => {
        if (open) {
            if (initialQuestion) {
                setFormData({
                    id: initialQuestion?.c_id,
                    question: initialQuestion?.c_question,
                    answer: initialQuestion?.c_type === 4 ? "*" : initialQuestion?.c_answer || "",
                    type: parseInt(initialQuestion?.c_type || '1'),
                    tags: String2Array(initialQuestion?.c_tag),
                    courseName: initialQuestion?.c_course_id,
                    options: initialQuestion.connect,
                });
                console.log(formData);
            } else {
                setFormData({
                    id: "",
                    question: "",
                    answer: "",
                    type: 1,
                    tags: [''],
                    courseName: "",
                    options: [{ c_id: "", c_content: "" }]
                })
            }
            setErrors({});
            
            // 重置时清空课程搜索
            setCourseSearch("");
        }
    }, [initialQuestion, open]);

    // 类型选项映射
    const typeOptions = [
        { value: 1, label: '单选题' },
        { value: 2, label: '多选题' },
        { value: 3, label: '判断题' },
        { value: 4, label: '主观题' },
    ];

    // 判断题选项
    const trueFalseOptions = [
        { value: '正确', label: '正确' },
        { value: '错误', label: '错误' },
    ];

    // 输入变化处理
    const handleInputChange = (field: keyof QuestionFormData, value: string) => {
        setFormData({ ...formData, [field]: value });
        setErrors({ ...errors, [field]: '' });
    };

    // 处理课程选择
    const handleCourseChange = (event: React.SyntheticEvent, value: string | CourseItem | null) => {
        if (value && typeof value === 'object') {
            // 选择的是CourseItem对象
            setFormData({ ...formData, courseName: value.c_course_id });
        } else if (typeof value === 'string') {
            // 输入的是字符串，可能是课程ID或名称
            setFormData({ ...formData, courseName: value });
        } else {
            // 清空选择
            setFormData({ ...formData, courseName: "" });
        }
        setErrors({ ...errors, courseName: '' });
    };

    // 处理课程输入变化（用于搜索）
    const handleCourseInputChange = (event: React.SyntheticEvent, value: string) => {
        setCourseSearch(value);
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
    const handleTypeChange = (e: React.ChangeEvent<{ value: number }>) => {
        const value = e.target.value as QuestionFormData['type'];
        setFormData({ ...formData, type: value });
        setErrors({ ...errors, type: '' });

        if (value !== 1 && value !== 2) {
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
        if ([1, 2].includes(formData.type)) {
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
                if (optionErrors.every(error => error === ""))
                    delete newErrors.options
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // 提交表单
    const handleSubmit = () => {
        if (isSaving) return; // 防止重复提交
        
        if (validateForm()) {
            const processedData = {
                ...formData,
                options: formData.options.map(opt => ({
                    key: opt.c_id,
                    option: opt.c_content
                }))
            };
            
            // 注意：这里不再调用 onClose()，让父组件控制模态框关闭
            onSave(processedData, isNew);
        }
    };

    // 获取当前选中的课程显示值
    const getSelectedCourseDisplay = () => {
        if (!formData.courseName) return null;
        
        const selectedCourse = courses.find(course => course.c_course_id === formData.courseName);
        if (selectedCourse) {
            return selectedCourse;
        }
        
        // 如果没有找到匹配的课程，返回一个占位对象或null
        return null;
    };

    // 渲染答案字段
    const renderAnswerField = () => {
        switch (formData.type) {
             case 1: // 单选题
                return (
                    <TextField
                        fullWidth
                        label="答案"
                        value={formData.answer}
                        onChange={(e) => handleInputChange('answer', e.target.value)}
                        error={!!errors.answer}
                        helperText={errors.answer || "请输入描述中的内容"}
                        multiline
                        rows={2}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    />
                );
            case 2: // 多选题
                return (
                    <TextField
                        fullWidth
                        label="答案"
                        value={formData.answer}
                        onChange={(e) => handleInputChange('answer', e.target.value)}
                        error={!!errors.answer}
                        helperText={errors.answer || "请输入描述中的内容，多个答案请用英文输入法下分号隔开，如1;2"}
                        multiline
                        rows={2}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    />
                );
            
            case 3: // 判断题
                return (
                    <FormControl fullWidth variant="outlined" size="small" sx={{ mb: 2 }}>
                        <InputLabel id="true-false-select-label">答案</InputLabel>
                        <Select
                            labelId="true-false-select-label"
                            value={formData.answer}
                            onChange={(e) => handleInputChange('answer', e.target.value)}
                            label="答案"
                            error={!!errors.answer}
                        >
                            {trueFalseOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                        {errors.answer && <FormHelperText error>{errors.answer}</FormHelperText>}
                    </FormControl>
                );
            
            case 4: // 主观题
                return (
                    <TextField
                        fullWidth
                        label="答案"
                        value={formData.answer}
                        onChange={(e) => handleInputChange('answer', e.target.value)}
                        error={!!errors.answer}
                        helperText="主观题答案，如无标准答案可填写*"
                        multiline
                        rows={3}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    />
                );
            
            default: // 单选题和其他类型
                return (
                    <TextField
                        fullWidth
                        label="答案"
                        value={formData.answer}
                        onChange={(e) => handleInputChange('answer', e.target.value)}
                        error={!!errors.answer}
                        helperText={errors.answer}
                        variant="outlined"
                        size="small"
                        sx={{ mb: 2 }}
                    />
                );
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
                    {[1, 2].includes(formData.type) && (
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

                    {/* 答案 - 根据题型显示不同的输入方式 */}
                    {renderAnswerField()}

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

                    {/* 课程名 - 修改为可搜索的下拉框 */}
                    <FormControl fullWidth error={!!errors.courseName} sx={{ mb: 2 }}>
                        <Autocomplete
                            id="course-select"
                            open={courseOpen}
                            onOpen={() => setCourseOpen(true)}
                            onClose={() => setCourseOpen(false)}
                            value={getSelectedCourseDisplay()}
                            onChange={handleCourseChange}
                            onInputChange={handleCourseInputChange}
                            options={courses}
                            getOptionLabel={(option) => {
                                if (typeof option === 'string') {
                                    return option;
                                }
                                return `${option.c_course_id} - ${option.c_course_name}`;
                            }}
                            isOptionEqualToValue={(option, value) => {
                                return option.c_course_id === value.c_course_id;
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="选择课程"
                                    variant="outlined"
                                    size="small"
                                    error={!!errors.courseName}
                                    helperText={errors.courseName}
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {courseLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    }}
                                />
                            )}
                            renderOption={(props, option) => (
                                <li {...props} key={option.c_course_id}>
                                    {option.c_course_id} - {option.c_course_name}
                                </li>
                            )}
                            noOptionsText={courseLoading ? "正在加载..." : "暂无课程"}
                            loading={courseLoading}
                            loadingText="正在加载课程..."
                            freeSolo={false} // 不允许自由输入
                            disableClearable={false}
                            blurOnSelect
                        />
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button 
                    onClick={onClose} 
                    color="secondary"
                    disabled={isSaving} // 添加禁用状态
                >
                    取消
                </Button>
                <Button 
                    onClick={handleSubmit} 
                    variant="contained" 
                    color="primary"
                    disabled={isSaving} // 添加禁用状态
                >
                    {isSaving ? '保存中...' : (isNew ? '添加' : '保存')} 
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuestionModalForm;