// src/app/ad/instances/InstanceDetailsDialog.tsx
"use client";
import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    IconButton,
    Tabs,
    Tab,
    CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import IngestControlDialog from '@/components/IngestControlDialog';
import { PlaybackModal } from '@/components/playback/PlaybackModal';
import { customFetch } from '@/utils/fetch';
import { RunningInstance, VmInstance } from '@/types'; // Assuming types are in @/types

// 导入新的标签页组件
import ContainerInstancesTab from './ContainerInstancesTab'; // 替换旧的 docker.tsx
import VmInstancesTab from './VmInstancesTab';
import SwitchInstancesTab from './SwitchInstancesTab';

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
    const [isPlaybackModalOpen, setPlaybackModalOpen] = useState(false);
    const [playbackHosts, setPlaybackHosts] = useState<{ name: string; indexName: string }[]>([]);
    const [isFetchingHosts, setIsFetchingHosts] = useState(false);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleOpenPlaybackModal = async () => {
        if (!instanceId) return;
        setIsFetchingHosts(true);
        try {
            // NOTE: The API endpoint for AD instances might be different.
            // Assuming it's the same structure for now based on file similarity.
            const [containersRes, vmsRes] = await Promise.all([
                customFetch(`/back/api/scenariosinstances/${instanceId}`),
                customFetch(`/back/api/scenariosinstances/${instanceId}/vms`)
            ]);

            if (!containersRes.ok || !vmsRes.ok) {
                throw new Error('Failed to fetch host details');
            }

            const containers: RunningInstance[] = await containersRes.json();
            const vms: VmInstance[] = await vmsRes.json();

            const containerHosts = containers.map(instance => ({
                name: instance.name,
                indexName: `${instance.scene_instance_id || ''}_${instance.name}`.toLowerCase()
            }));

            const vmHosts = vms.map(vm => ({
                name: vm.name,
                indexName: `${vm.scene_instance_id || ''}_${vm.name}`.toLowerCase()
            }));

            setPlaybackHosts([...containerHosts, ...vmHosts]);
            setPlaybackModalOpen(true);
        } catch (error) {
            console.error("Error fetching hosts for playback:", error);
        } finally {
            setIsFetchingHosts(false);
        }
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
                    <Button
                        size="small"
                        variant="contained"
                        onClick={handleOpenPlaybackModal}
                        disabled={isFetchingHosts}
                        startIcon={isFetchingHosts ? <CircularProgress size={14} color="inherit" /> : null}
                    >
                        指令回放
                    </Button>
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

            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>关闭</Button>
            </DialogActions>
            <IngestControlDialog open={ingestOpen} onClose={() => setIngestOpen(false)} sceneInstanceId={instanceId} />
            {isPlaybackModalOpen && (
                <PlaybackModal
                    open={isPlaybackModalOpen}
                    onClose={() => setPlaybackModalOpen(false)}
                    hosts={playbackHosts}
                />
            )}
        </Dialog>
    );
};

export default InstanceDetailsDialog;