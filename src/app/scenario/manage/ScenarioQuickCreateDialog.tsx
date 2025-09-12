"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Box,
    CircularProgress,
    Alert,
    TextField,
    MenuItem,
    Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FlashOn from '@mui/icons-material/FlashOn';

// 导入拓扑编辑器和相关类型
import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
import { TopologyData } from '@/types'; // 确保类型路径正确
import { customFetch } from '@/utils/fetch';

// 预置场景模板接口
interface SceneTemplate {
    fileName: string;
    topology_json: TopologyData;
}


interface ScenarioQuickCreateDialogProps {
    open: boolean;
    onClose: () => void;
    onSaveSuccess: () => void;
}

const ScenarioQuickCreateDialog: React.FC<ScenarioQuickCreateDialogProps> = ({
    open,
    onClose,
    onSaveSuccess
}) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    // 新增状态：控制是否显示拓扑编辑器
    const [showTopologyEditor, setShowTopologyEditor] = useState(false);
    // 新增状态：存储从API获取的预置场景模板
    const [sceneTemplates, setSceneTemplates] = useState<SceneTemplate[]>([]);
    // 新增状态：场景名称和描述
    const [scenarioName, setScenarioName] = useState<string>('');
    const [scenarioDescription, setScenarioDescription] = useState<string>('');
    // 新增状态：控制保存场景对话框
    const [showSaveDialog, setShowSaveDialog] = useState(false);

    // 加载预置场景模板
    const loadSceneTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/scene-templates');
            if (!response.ok) {
                throw new Error('加载预置场景模板失败');
            }
            const templates = await response.json();
            // 确保 templates 是数组，如果不是则设为空数组
            setSceneTemplates(Array.isArray(templates) ? templates : []);
        } catch (err: any) {
            setError(err.message || '加载预置场景模板失败');
            setSceneTemplates([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 当弹窗打开时，加载预置场景模板
    useEffect(() => {
        if (open) {
            loadSceneTemplates();
            setShowTopologyEditor(false); // 重置为选择界面
        } else {
            // 关闭时重置状态
            setSelectedTemplateId('');
            setIsSaving(false);
            setError(null);
            setShowTopologyEditor(false);
            setScenarioName('');
            setScenarioDescription('');
            setShowSaveDialog(false);
        }
    }, [open, loadSceneTemplates]);

    // 当模板加载完成后，默认选择第一个
    useEffect(() => {
        if (Array.isArray(sceneTemplates) && sceneTemplates.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId('0');
        }
    }, [sceneTemplates, selectedTemplateId]);

    // 根据索引查找当前选中的模板对象
    const selectedTemplate = Array.isArray(sceneTemplates) ? sceneTemplates[parseInt(selectedTemplateId) || 0] : undefined;

    // 处理场景选择确认
    const handleConfirmSelection = () => {
        if (!selectedTemplate) {
            setError("请选择一个模板。");
            return;
        }
        setShowTopologyEditor(true);
        setError(null);
    };



    // 处理保存场景按钮点击
    const handleSaveClick = () => {
        if (!selectedTemplate) {
            setError("请选择一个模板。");
            return;
        }
        // 设置默认的场景名称和描述
        setScenarioName(selectedTemplate.fileName.replace('.json', ''));
        setScenarioDescription('基于预置场景快速创建');
        setShowSaveDialog(true);
        setError(null);
    };

    // 保存场景的逻辑
    const handleSave = async () => {
        if (!selectedTemplate) {
            setError("请选择一个模板。");
            return;
        }
        
        if (!scenarioName.trim()) {
            setError("请输入场景名称。");
            return;
        }
        
        setIsSaving(true);
        setError(null);

        try {
            // 将选中的模板数据发送到后端创建新场景
            const response = await customFetch('/back/api/scenarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: scenarioName.trim(),
                    description: scenarioDescription.trim() || '基于预置场景快速创建',
                    topology: selectedTemplate?.topology_json,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('保存场景失败:', errorData);
                throw new Error(errorData.message || '保存失败');
            }
            onSaveSuccess();
            onClose();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    // 为 TopologyEditor 提供空的回调，因为模板是只读的
    const doNothing = useCallback(() => {}, []);

    return (
        <>
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xl"
            PaperProps={{ sx: { height: '95vh' } }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlashOn color="secondary" />
                    {showTopologyEditor ? `预览场景：${selectedTemplate?.fileName || '未知'}` : '快速创建场景'}
                </Box>
                <IconButton aria-label="close" onClick={onClose} disabled={isSaving}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {!showTopologyEditor ? (
                    // 场景选择界面
                    <>
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <Typography variant="h6" gutterBottom>
                                选择场景模板
                            </Typography>
                            
                            {isLoading ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                                    <CircularProgress />
                                    <Typography variant="body2" sx={{ ml: 2 }}>
                                        加载预置场景模板中...
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                    <TextField
                                        select
                                        fullWidth
                                        label="场景模板"
                                        value={selectedTemplateId}
                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        variant="outlined"
                                        size="small"
                                        disabled={!Array.isArray(sceneTemplates) || sceneTemplates.length === 0}
                                        sx={{ mb: 2 }}
                                    >
                                        {(Array.isArray(sceneTemplates) ? sceneTemplates : []).map((template, index) => (
                                            <MenuItem key={index} value={index}>
                                                <Typography variant="subtitle1">
                                                    {template.fileName}
                                                </Typography>
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    
                                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                                    
                                    <Box sx={{ textAlign: 'center', py: 2 }}>
                                        <Typography variant="h6" gutterBottom>
                                            {selectedTemplate?.fileName || '请选择模板'}
                                        </Typography>
                                    </Box>
                                </>
                            )}
                        </Box>
                        
                        <Box sx={{ flexGrow: 1, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                {isLoading ? '正在加载预置场景模板...' : '点击确认按钮进入拓扑预览界面'}
                            </Typography>
                        </Box>
                    </>
                ) : (
                    // 拓扑编辑器界面
                    <>
                        {error && (
                            <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
                                <Alert severity="error" sx={{ py: 0, px: 1 }}>{error}</Alert>
                            </Box>
                        )}
                        
                        <Box sx={{ flexGrow: 1, position: 'relative' }}>
                            {selectedTemplate ? (
                                <TopologyEditor
                                    // 包装成符合Scenario接口的对象
                                    initialData={{
                                        id: selectedTemplateId,
                                        name: selectedTemplate?.fileName || '预置场景',
                                        description: '快速创建的预设场景',
                                        topology_json: selectedTemplate?.topology_json
                                    }}
                                    // 模板在快速创建时是只读的，不可编辑
                                    onAddNode={doNothing}
                                    onDeleteNode={doNothing}
                                    onUpdateNode={doNothing}
                                    onSaveSuccess={doNothing}
                                />
                            ) : (
                                <Box sx={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
                                    <Typography color="text.secondary">
                                        {Array.isArray(sceneTemplates) && sceneTemplates.length > 0 ? '请选择一个模板来预览' : '没有可用的场景模板'}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSaving}>取消</Button>
                {!showTopologyEditor ? (
                    // 选择界面的按钮
                    <Button 
                        onClick={handleConfirmSelection} 
                        variant="contained" 
                        color="primary" 
                        disabled={!selectedTemplate}
                    >
                        确认选择
                    </Button>
                ) : (
                    // 拓扑编辑器界面的按钮
                    <Button 
                        onClick={handleSaveClick} 
                        variant="contained" 
                        color="secondary" 
                        disabled={isSaving || !selectedTemplate}
                    >
                        {isSaving ? <CircularProgress size={24} /> : '保存场景'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
        
        {/* 保存场景对话框 */}
        <Dialog
            open={showSaveDialog}
            onClose={() => setShowSaveDialog(false)}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                保存场景
            </DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2 }}>
                    <TextField
                        fullWidth
                        label="场景名称"
                        value={scenarioName}
                        onChange={(e) => setScenarioName(e.target.value)}
                        variant="outlined"
                        sx={{ mb: 2 }}
                        required
                        error={!scenarioName.trim() && scenarioName !== ''}
                        helperText={!scenarioName.trim() && scenarioName !== '' ? '请输入场景名称' : ''}
                    />
                    <TextField
                        fullWidth
                        label="场景描述"
                        value={scenarioDescription}
                        onChange={(e) => setScenarioDescription(e.target.value)}
                        variant="outlined"
                        multiline
                        rows={3}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setShowSaveDialog(false)} disabled={isSaving}>
                    取消
                </Button>
                <Button 
                    onClick={handleSave} 
                    variant="contained" 
                    color="primary"
                    disabled={isSaving || !scenarioName.trim()}
                >
                    {isSaving ? <CircularProgress size={24} /> : '确认保存'}
                </Button>
            </DialogActions>
        </Dialog>
        </>
    );
};

export default ScenarioQuickCreateDialog;