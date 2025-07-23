import React, { useState, useEffect, ChangeEvent } from 'react';
import {
    Dialog, DialogActions, DialogContent, DialogTitle, TextField, Button, Select,
    MenuItem, FormControl, InputLabel, FormHelperText, Box, Typography, IconButton,
    List, ListItem, ListItemText, ListItemIcon, Stack
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import VideocamIcon from '@mui/icons-material/Videocam';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { Experiment, CourseCaseResource, CourseCaseResourceFormat } from '../../types';
import { SUPPORTED_COURSE_RESOURCE_FORMATS } from '../../constants';

interface ExperimentFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (experiment: Experiment, courseId: string) => void;
    experiment?: Experiment | null;
    courseId: string;
    sceneConfigs: { c_config_id: number; c_name: string }[];
}

const getResourceFormat = (fileName: string): CourseCaseResourceFormat => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'pdf': return 'pdf';
        case 'mp4': return 'mp4';
        case 'avi': return 'avi';
        case 'pptx': return 'pptx';
        case 'docx': return 'docx';
        default: return 'other';
    }
};

const getResourceIcon = (format: CourseCaseResourceFormat) => {
    switch (format) {
        case 'pdf': return <PictureAsPdfIcon />;
        case 'mp4': case 'avi': return <VideocamIcon />;
        case 'pptx': case 'docx': return <DescriptionIcon />;
        default: return <InsertDriveFileIcon />;
    }
};

const ExperimentFormModal: React.FC<ExperimentFormModalProps> = ({ open, onClose, onSave, experiment, courseId, sceneConfigs }) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [c_experiment_name, setExperimentName] = useState('');
    const [c_description, setDescription] = useState('');
    const [c_config_id, setConfigId] = useState<number | ''>('');
    const [resources, setResources] = useState<CourseCaseResource[]>([]);
    const [selectedRawFiles, setSelectedRawFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        resources.forEach(resource => {
            if (resource.c_resource_path && resource.c_resource_path.startsWith('blob:') && resource.fileObject) {
                URL.revokeObjectURL(resource.c_resource_path);
            }
        });

        if (experiment) {
            setExperimentName(experiment.c_experiment_name || '');
            setDescription(experiment.c_description || '');
            setConfigId(experiment.c_config_id ?? '');
            setResources(experiment.resources?.map(r => ({ ...r })) || []);
        } else {
            setExperimentName('');
            setDescription('');
            setConfigId(sceneConfigs.length > 0 ? sceneConfigs[0].c_config_id : '');
            setResources([]);
        }
        setSelectedRawFiles([]);
        setErrors({});
        return () => {
            resources.forEach(resource => {
                if (resource.c_resource_path && resource.c_resource_path.startsWith('blob:') && resource.fileObject) {
                    URL.revokeObjectURL(resource.c_resource_path);
                }
            });
        };
    }, [experiment, open, sceneConfigs]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newRawFilesArray = Array.from(e.target.files);
            setSelectedRawFiles(prev => [...prev, ...newRawFilesArray]);
            const newExperimentResources: CourseCaseResource[] = newRawFilesArray.map(rawFile => ({
                c_resource_id: `new-${rawFile.name}-${Date.now()}`,
                c_resource_name: rawFile.name,
                c_type: getResourceFormat(rawFile.name),
                c_resource_path: '',
                c_size: `${(rawFile.size / (1024 * 1024)).toFixed(2)} MB`,
                fileObject: rawFile,
            }));
            setResources(prev => [...prev, ...newExperimentResources]);
            e.target.value = '';
        }
    };

    const handleRemoveResource = (resourceIdToRemove: string) => {
        const resourceToRemove = resources.find(r => r.c_resource_id === resourceIdToRemove);
        if (resourceToRemove?.c_resource_path && resourceToRemove.c_resource_path.startsWith('blob:')) {
            URL.revokeObjectURL(resourceToRemove.c_resource_path);
        }
        setResources(prevResources => prevResources.filter(resource => resource.c_resource_id !== resourceIdToRemove));
        setSelectedRawFiles(prevRaw => prevRaw.filter(rawFile => `new-${rawFile.name}-${Date.now()}` !== resourceIdToRemove && rawFile.name !== resourceToRemove?.c_resource_name));
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!c_experiment_name.trim()) newErrors.c_experiment_name = '实验名称不能为空。';
        if (!c_config_id && sceneConfigs.length > 0) newErrors.c_config_id = '请选择一个场景配置。';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            const processedResources = resources.map(resource => {
                if (resource.fileObject && !resource.c_resource_path) {
                    return { ...resource, c_resource_path: URL.createObjectURL(resource.fileObject) };
                }
                return resource;
            });

            const saveData: Experiment = {
                c_experiment_id: experiment?.c_experiment_id || `temp-id-${Date.now()}`,
                c_experiment_name,
                c_description,
                c_config_id: Number(c_config_id),
                c_name: sceneConfigs.find(config => config.c_config_id === c_config_id)?.c_name || '',
                resources: processedResources,
                created_at: experiment?.created_at || new Date().toISOString(),
            };
            onSave(saveData, courseId);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            fullScreen={fullScreen}
            PaperProps={{ component: 'form', onSubmit: (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); handleSubmit(); }, sx: { borderRadius: 2 } }}
        >
            <DialogTitle>
                {experiment ? '编辑实验' : '添加新实验'}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TextField
                        autoFocus
                        name="c_experiment_name"
                        label="实验名称"
                        fullWidth
                        variant="outlined"
                        value={c_experiment_name}
                        onChange={(e) => setExperimentName(e.target.value)}
                        error={!!errors.c_experiment_name}
                        helperText={errors.c_experiment_name}
                        required
                    />
                    <FormControl fullWidth variant="outlined" error={!!errors.c_config_id} required={sceneConfigs.length > 0}>
                        <InputLabel id="scene-config-label">场景配置</InputLabel>
                        <Select
                            labelId="scene-config-label"
                            name="c_config_id"
                            value={c_config_id}
                            onChange={(e) => setConfigId(Number(e.target.value))}
                            label="场景配置"
                            disabled={sceneConfigs.length === 0}
                            MenuProps={{
                                PaperProps: {
                                    style: { maxHeight: 250 },
                                },
                            }}
                        >
                            {sceneConfigs.length === 0 ? (
                                <MenuItem value="" disabled>
                                    无可用场景配置
                                </MenuItem>
                            ) : (
                                [
                                    <MenuItem key="placeholder" value="" disabled>
                                        请选择场景配置
                                    </MenuItem>,
                                    ...sceneConfigs.map(config => (
                                        <MenuItem key={config.c_config_id} value={config.c_config_id}>
                                            {config.c_name}
                                        </MenuItem>
                                    ))
                                ]
                            )}
                        </Select>
                        {errors.c_config_id && <FormHelperText>{errors.c_config_id}</FormHelperText>}
                        {sceneConfigs.length === 0 && (
                            <FormHelperText>请先添加场景配置</FormHelperText>
                        )}
                    </FormControl>
                    <TextField
                        name="c_description"
                        label="实验描述 (可选)"
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={c_description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    <Box mt={1}>
                        <Typography variant="subtitle1" gutterBottom color="text.primary">
                            实验资源（可选）
                        </Typography>
                        <Button
                            variant="outlined"
                            component="label"
                            startIcon={<CloudUploadIcon />}
                            sx={{ mb: 1 }}
                        >
                            选择文件上传
                            <input
                                type="file"
                                hidden
                                multiple
                                onChange={handleFileChange}
                                accept={Object.values(SUPPORTED_COURSE_RESOURCE_FORMATS).join(',')}
                            />
                        </Button>
                        {resources.length > 0 && (
                            <List dense sx={{ maxHeight: 200, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mt: 1 }}>
                                {resources.map((resource) => (
                                    <ListItem
                                        key={resource.c_resource_id}
                                        secondaryAction={
                                            <IconButton edge="end" aria-label="delete resource" onClick={() => handleRemoveResource(resource.c_resource_id)} color="error">
                                                <DeleteIcon fontSize="small"/>
                                            </IconButton>
                                        }
                                        sx={{ borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            {getResourceIcon(resource.c_type)}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={resource.c_resource_name}
                                            primaryTypographyProps={{ variant: 'body2', noWrap: true, maxWidth: 'calc(100% - 50px)' }}
                                            secondary={resource.c_size || '未知大小'}
                                            secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>取消</Button>
                <Button type="submit" variant="contained" disabled={sceneConfigs.length === 0 && !c_config_id}>
                    {experiment ? '保存更改' : '确认添加'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExperimentFormModal;