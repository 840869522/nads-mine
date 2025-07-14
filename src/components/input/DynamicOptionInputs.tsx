"use client";

import React, { useState } from 'react';
import {
    TextField,
    Button,
    IconButton,
    Stack,
    Box,
    Grid,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { SelectOption } from '../learning/QuestionModalForm';



type DynamicOptionInputsProps = {
    options: SelectOption[];
    onChange: (options: SelectOption[]) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
    errors?: string[];
};

const DynamicOptionInputs: React.FC<DynamicOptionInputsProps> = ({
        options,
        onChange,
        onAdd,
        onRemove,
        errors = [],
    }) => {
    // 处理输入值变化
    const handleInputChange = (index: number, field: 'c_id' | 'c_content', value: string) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], [field]: value };
        onChange(newOptions);
    };

    // 添加新输入项
    // const handleAddInput = () => {
    //     setInputFields([
    //         ...inputFields,
    //         { option: '', description: '' },
    //     ]);
    //     setErrors([
    //         ...errors,
    //         { option: '', description: '' },
    //     ]);
    // };

    // // 删除指定索引的输入项
    // const handleRemoveInput = (index: number) => {
    //     if (inputFields.length === 1) return;
    //     const newFields = inputFields.filter((_, i) => i !== index);
    //     setInputFields(newFields);
    //     const newErrors = errors.filter((_, i) => i !== index);
    //     setErrors(newErrors);
    // };

    // 表单验证
    // const validateForm = (): boolean => {
    //     const newErrors: ErrorType[] = inputFields.map((item, index) => {
    //         const errors = {} as ErrorType;
    //         if (!item.option.trim()) {
    //             errors.option = '选项不能为空';
    //         }
    //         if (!item.description.trim()) {
    //             errors.description = '描述不能为空';
    //         }
    //         return errors;
    //     });

    //     setErrors(newErrors);
    //     return newErrors.every((error) =>
    //         Object.values(error).every((msg) => !msg)
    //     );
    // };

    // // 提交表单
    // const handleSubmit = (e: React.FormEvent) => {
    //     e.preventDefault();
    //     if (validateForm()) {
    //         console.log('表单数据有效，可提交:', inputFields);
    //         // 可以在这里执行实际的提交逻辑
    //     } else {
    //         console.log('表单数据无效，请检查输入');
    //     }
    // };

    return (
        <Stack spacing={2} >
            {options.map((item, index) => (
                <Box key={index}>
                    <Grid container spacing={2} columns={16} alignItems="center">
                        <Grid size={5}>
                            <TextField
                                fullWidth
                                label={`选项 ${index + 1}`}
                                value={item.c_id}
                                onChange={(e) =>
                                    handleInputChange(index, 'c_id', e.target.value)
                                }
                                error={!!errors[index]}
                                helperText={errors[index]}
                                variant="outlined"
                                size="small"
                            />
                        </Grid>
                        <Grid size={10}>
                            <TextField
                                fullWidth
                                label={`描述 ${index + 1}`}
                                value={item.c_content}
                                onChange={(e) =>
                                    handleInputChange(index, 'c_content', e.target.value)
                                }
                                error={!!errors[index]}
                                helperText={errors[index]}
                                variant="outlined"
                                size="small"
                            />
                        </Grid>
                        <Grid size={1}>
                            <IconButton
                                color="error"
                                onClick={() => onRemove(index)}
                                disabled={options.length === 1}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Grid>
                    </Grid>
                </Box>
            ))}
            <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={onAdd}
                sx={{ mb: 2 }}
            >
                添加选项与描述
            </Button>
        </Stack>
    );
};

export default DynamicOptionInputs;


