// file: ScenarioCreateDialog.tsx
"use client";
import React, {useState, useCallback, useEffect} from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// 导入您项目中的拓扑编辑器和相关类型
import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
import {RunningInstance, InstanceStatus, TopologyNode, TopologyData} from '@/types';
import CircularProgress from "@mui/material/CircularProgress";

// 为了让此文件独立工作，我们需要定义 Scenario 接口
// 关键在于它包含一个 topology_json 字段来存储拓扑数据
interface Scenario {
    id: string | number;
    name: string;
    description: string;
    topology_json: TopologyData; // 假设后端返回的字段名为 topology_json
    // 其他可能的字段...
}


// 1. 修改 Props 接口，增加一个用于接收现有场景数据的属性
interface ScenarioEditDialogProps {
    open: boolean;
    onClose: () => void;
    onSaveSuccess: () => void;
    scenario: Scenario | null; // <-- 新增: 用于接收要编辑的场景对象
}

const ScenarioEditDialog: React.FC<ScenarioEditDialogProps> = ({ open, onClose, scenario, onSaveSuccess }) => {
    // 这个 state 仍然用于与外部组件交互，但它的初始值将由传入的 scenario 决定
    const [_instances, setInstances] = useState<RunningInstance[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // 2. 加载初始数据：使用 useEffect Hook
    // 当 scenario prop 发生变化时（即弹窗打开并接收到数据时），
    // 将接收到的场景拓扑数据转换为 RunningInstance 列表，并更新本地状态
    useEffect(() => {
        // 当弹窗打开并传入了场景数据时
        if (open && scenario && scenario.topology_json?.nodes) {
            setIsLoading(true);
            const initialInstances: RunningInstance[] = scenario.topology_json.nodes.map(node => {
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
                return {
                    id: `inst-${id}`, name: label, type: instanceType, status: status,
                    ports: config.portMappings || '-', imageName: config.Image,
                    cpuUsage: isComputeResource ? '0%' : '-', memoryUsage: isComputeResource ? '0MB / 1GB' : '-',
                    diskUsage: isComputeResource ? '0GB / 20GB' : '-', uptime: '0s',
                    nodeId: id, createdAt: new Date().toISOString(),
                };
            });
            setInstances(initialInstances);
            setIsLoading(false);
        } else {
            // 如果弹窗关闭或没有场景数据，清空实例列表
            setInstances([]);
        }
    }, [open, scenario]); // 依赖项是 open 和 scenario


    // 这些回调函数保持不变，它们仍然负责更新弹窗内部的状态
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

    const handleDeleteNode = useCallback((nodeId: string) => {
        setInstances(prev => prev.filter(inst => inst.nodeId !== nodeId));
    }, []);

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
            {/* 3. 修改标题: 将标题改为动态显示 */}
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {scenario ? `编辑场景：${scenario.name}` : '加载中...'}
                <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0, overflow: 'hidden' }}>
                {isLoading ? <CircularProgress /> : (
                    <TopologyEditor
                        // 我们需要给 TopologyEditor 增加一个 initialData 的 prop
                        // 用于在编辑器初始化时加载现有的拓扑图
                        initialData={scenario}
                        onAddNode={handleAddNode}
                        onDeleteNode={handleDeleteNode}
                        onUpdateNode={handleUpdateNode}
                        // 假设 TopologyEditor 内部有保存逻辑，
                        // 我们把 onSaveSuccess 和 scenarioId 传给它
                        onSaveSuccess={onSaveSuccess}
                        scenarioId={scenario?.id || null}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ScenarioEditDialog;

