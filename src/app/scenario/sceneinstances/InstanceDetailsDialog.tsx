// src/app/scenario/sceneinstances/InstanceDetailsDialog.tsx
"use client";
import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    IconButton,
    Tabs,
    Tab,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import IngestControlDialog from '@/components/IngestControlDialog';
import CommandPlaybackDialog from '@/components/CommandPlaybackDialog';

// 导入新的标签页组件
import ContainerInstancesTab from './ContainerInstancesTab'; // 替换旧的 docker.tsx
import VmInstancesTab from './VmInstancesTab';
import SwitchInstancesTab from './SwitchInstancesTab';
import InstanceFlagHistory from './InstanceFlagHistory';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ pt: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

interface InstanceDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    scenarioName: string; 
    instanceId: string | null;
}

const InstanceDetailsDialog: React.FC<InstanceDetailsDialogProps> = ({ open, onClose, scenarioName, instanceId }) => {
    const [tabValue, setTabValue] = useState(0);
    const [ingestOpen, setIngestOpen] = useState(false);
    const [playbackOpen, setPlaybackOpen] = useState(false);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };
    
    // 当弹窗关闭时，重置回第一个标签页
    const handleClose = () => {
        onClose();
        setTabValue(0);
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xl" PaperProps={{ sx: { height: '90vh' } }} disableEnforceFocus>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                场景实例详情: {scenarioName}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button size="small" variant="outlined" onClick={() => setPlaybackOpen(true)}>指令回放</Button>
                    <Button size="small" variant="outlined" onClick={() => setIngestOpen(true)}>日志收集</Button>
                    <IconButton onClick={handleClose}><CloseIcon /></IconButton>
                </Box>
            </DialogTitle>
            
            <DialogContent dividers>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="资源类型标签页">
                        <Tab label="容器" id="simple-tab-0" aria-controls="simple-tabpanel-0" />
                        <Tab label="虚拟机" id="simple-tab-1" aria-controls="simple-tabpanel-1" />
                        <Tab label="交换机" id="simple-tab-2" aria-controls="simple-tabpanel-2" />
                        <Tab label="Flag" id="simple-tab-3" aria-controls="simple-tabpanel-3" />
                    </Tabs>
                </Box>
                
                <TabPanel value={tabValue} index={0}>
                    {/* 关键改动：渲染新的组件并传递 instanceId */}
                    <ContainerInstancesTab instanceId={instanceId} />
                </TabPanel>
                <TabPanel value={tabValue} index={1}>
                    <VmInstancesTab instanceId={instanceId}/>
                </TabPanel>
                <TabPanel value={tabValue} index={2}>
                    <SwitchInstancesTab instanceId={instanceId}/>
                </TabPanel>
                <TabPanel value={tabValue} index={3}>
                    <InstanceFlagHistory instanceId={instanceId}/>
                </TabPanel>

            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>关闭</Button>
            </DialogActions>
            <IngestControlDialog open={ingestOpen} onClose={() => setIngestOpen(false)} sceneInstanceId={instanceId} />
            <CommandPlaybackDialog open={playbackOpen} onClose={() => setPlaybackOpen(false)} sceneInstanceId={instanceId} />
        </Dialog>
    );
};

export default InstanceDetailsDialog;