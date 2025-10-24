"use client";
import React, { useState } from 'react'; // ★ 1. 引入 useState 用于管理加载和错误状态
import { Dialog, DialogTitle, DialogContent, IconButton, LinearProgress, Alert } from '@mui/material'; // ★ 2. 引入加载条和警告框组件
import CloseIcon from '@mui/icons-material/Close';
import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
import { TopologyData, TopologyNode } from '@/types'; // ★ 3. 假设 TopologyNode 类型已定义
import { customFetch } from '@/utils/fetch'; // ★ 4. 引入 customFetch

// ★ 5. 扩展 Props 接口，增加一个可选的回调函数
interface InstanceTopologyDialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    topology: TopologyData | null | undefined;
    instanceId: string;
    /**
     * (可选) 当拓扑图中的终端按钮被点击时触发的回调。
     * 如果提供了此函数，拓扑图将开启终端交互功能。
     */
    onTerminalClick?: (node: TopologyNode, instanceId: string) => Promise<void>;
}

const InstanceTopologyDialog: React.FC<InstanceTopologyDialogProps> = ({
                                                                           open,
                                                                           onClose,
                                                                           title,
                                                                           topology,
                                                                           instanceId,
                                                                           onTerminalClick, // ★ 6. 接收新的 prop
                                                                       }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initialData = topology
        ? { id: 'instance-topology', name: title || '实例拓扑', description: '', topology_json: topology }
        : null;

    /**
     * ★ 7. 新增：处理从 TopologyEditor 传来的终端点击事件的内部回调函数
     * 这个函数会调用外部传入的 onTerminalClick prop，并管理加载和错误状态。
     */
    const handleInternalTerminalClick = async (node: TopologyNode) => {
        // 如果外部没有提供 onTerminalClick 函数，则不执行任何操作
        if (!onTerminalClick) {
            console.log("Terminal click ignored: onTerminalClick prop not provided.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // 调用从父组件传入的、包含完整业务逻辑的函数
            await onTerminalClick(node, instanceId);
        } catch (err: any) {
            setError(err.message || '执行终端操作时发生未知错误。');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" PaperProps={{ sx: { height: '90vh' } }}>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {title || '实例拓扑'}
                <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* ★ 8. 在弹窗内显示加载和错误状态 */}
            {isLoading && <LinearProgress />}
            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>{error}</Alert>}

            <DialogContent dividers sx={{ p: 0, overflow: 'hidden' }}>
                {/*
          复用 TopologyEditor 进行渲染。
          如果父组件提供了 onTerminalClick，我们就把它传递下去；
          否则，我们传递一个空函数，保持原有的只读行为。
        */}
                <TopologyEditor
                    initialData={initialData as any}
                    onAddNode={() => {}}
                    onDeleteNode={() => {}}
                    onUpdateNode={() => {}}
                    onSaveSuccess={() => {}}
                    // ★ 9. 关键修改：条件性地传递回调函数 ★
                    onTerminalClick={onTerminalClick ? handleInternalTerminalClick : () => {}}
                    scenarioId={null}
                    sceneInstanceId={instanceId}
                />
            </DialogContent>
        </Dialog>
    );
};

export default InstanceTopologyDialog;