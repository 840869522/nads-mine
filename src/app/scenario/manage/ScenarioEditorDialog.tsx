// file: ScenarioEditorDialog.tsx
"use client";
import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// 导入您项目中的拓扑编辑器和相关类型
import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
import { RunningInstance, InstanceStatus, TopologyNode } from '@/types';

// 定义这个弹窗组件需要接收的属性(props)
interface ScenarioEditorDialogProps {
    open: boolean;
    onClose: () => void;
    onSaveSuccess: () => void;
}

const ScenarioEditorDialog: React.FC<ScenarioEditorDialogProps> = ({ open, onClose}) => {
    // ▼▼▼ 以下是从 ScenarioPage.tsx 搬运过来的逻辑 ▼▼▼

    // 这个 state 现在属于弹窗组件，用于和编辑器交互
    const [_instances, setInstances] = useState<RunningInstance[]>([]);

    // 这些回调函数也一并搬运过来
    const handleAddNode = useCallback((node: TopologyNode) => {
        const { type, id, label, config } = node;
        let instanceType: string;
        let status: InstanceStatus = 'stopped';
        let isComputeResource = false;
        switch (type) {
            case 'virtual_machine': instanceType = '虚拟机'; isComputeResource = true; break;
            case 'container': instanceType = '容器'; isComputeResource = true; break;
            case 'switch': instanceType = '交换机'; status = 'running'; break;
            case 'router': instanceType = '路由器'; status = 'running'; break;
            case 'nat_bridge': instanceType = 'NAT网桥'; status = 'running'; break;
            default: instanceType = '未知设备';
        }
        const newInstance: RunningInstance = {
            id: `inst-${id}`, name: label, type: instanceType, status: status,
            ports: config.portMappings || '-', imageName: config.dockerImage,
            cpuUsage: isComputeResource ? '0%' : '-', memoryUsage: isComputeResource ? '0MB / 1GB' : '-',
            diskUsage: isComputeResource ? '0GB / 20GB' : '-', uptime: '0s',
            nodeId: id, createdAt: new Date().toISOString(),
        };
        setInstances(prev => [...prev, newInstance]);
    }, []);

    const handleDeleteNode = useCallback((nodeId: string) => {
        setInstances(prev => prev.filter(inst => inst.nodeId !== nodeId));
    }, []);

    const handleUpdateNode = useCallback((node: TopologyNode) => {
        setInstances(prev => prev.map(inst => {
            if (inst.nodeId === node.id) {
                return { ...inst, name: node.label, imageName: node.config.dockerImage, ports: node.config.portMappings || '-' };
            }
            return inst;
        }));
    }, []);

    // ▲▲▲ 搬运逻辑结束 ▲▲▲

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xl"
            PaperProps={{ sx: { height: '90vh' } }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                创建新场景
                <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0, overflow: 'hidden' }}>
                {/*
          将拓扑编辑器嵌入到弹窗内容中, 并把所有需要的 props 传递给它。
          我们还把 onClose 和 onSaveSuccess 传递下去，以便编辑器内部的按钮可以调用它们。
        */}
                <TopologyEditor
                    onAddNode={handleAddNode}
                    onDeleteNode={handleDeleteNode}
                    onUpdateNode={handleUpdateNode}

                />
            </DialogContent>
        </Dialog>
    );
};

export default ScenarioEditorDialog;