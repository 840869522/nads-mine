// file: ScenarioCreateDialog.tsx
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
interface ScenarioCreateDialogProps {
    open: boolean;
    onClose: () => void;
    onSaveSuccess: () => void;
}

const ScenarioCreateDialog: React.FC<ScenarioCreateDialogProps> = ({ open, onClose}) => {

    const [_instances, setInstances] = useState<RunningInstance[]>([]);

    // handleAddNode: 当用户在编辑器中添加了一个新节点时，TopologyEditor会调用此函数。函数内部：
    // 接收代表新节点的node对象。
    // 使用switch语句根据节点类型（type）判断它是虚拟机、容器还是网络设备。
    // 创建一个符合RunningInstance接口的新对象，填充好ID、名称、状态、默认资源用量等信息。
    // 通过setInstances将这个新实例添加到_instances状态数组中，触发界面更新。
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
            ports: config.portMappings || '-', imageName: config.Image,
            cpuUsage: isComputeResource ? '0%' : '-', memoryUsage: isComputeResource ? '0MB / 1GB' : '-',
            diskUsage: isComputeResource ? '0GB / 20GB' : '-', uptime: '0s',
            nodeId: id, createdAt: new Date().toISOString(),
        };
        setInstances(prev => [...prev, newInstance]);
    }, []);

    // handleDeleteNode: 当用户在编辑器中删除了一个节点时，此函数被调用。它通过filter方法从_instances数组中移除与nodeId匹配的实例。
    const handleDeleteNode = useCallback((nodeId: string) => {
        setInstances(prev => prev.filter(inst => inst.nodeId !== nodeId));
    }, []);

    // handleUpdateNode: 当用户在编辑器中修改了一个节点的属性（如名称）时，此函数被调用。它通过map方法遍历_instances数组，找到匹配的实例并更新其信息。
    const handleUpdateNode = useCallback((node: TopologyNode) => {
        setInstances(prev => prev.map(inst => {
            if (inst.nodeId === node.id) {
                return { ...inst, name: node.label, imageName: node.config.Image, ports: node.config.portMappings || '-' };
            }
            return inst;
        }));
    }, []);

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
                    onUpdateNode={handleUpdateNode} onSaveSuccess={function (): void {
                    throw new Error('Function not implemented.');
                }}                />
            </DialogContent>
        </Dialog>
    );
};

export default ScenarioCreateDialog;