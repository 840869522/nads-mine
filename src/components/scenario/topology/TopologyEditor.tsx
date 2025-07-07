"use client";
import React, { useState, useCallback, useReducer, useEffect, useRef } from 'react';
import {
    TopologyNode,
    TopologyEdge,
    DeviceType,
    NodeConfig,
    EdgeConfig,
    TopologyAction,
    TopologyData,
} from '../../../types';
import { DEFAULT_NODE_CONFIG, DEFAULT_EDGE_CONFIG, TOPOLOGY_DEVICE_TYPES } from '../../../constants';
import TopologyToolbar from './TopologyToolbar';//包含一个 TopologyToolbar，提供撤销、重做、保存、导入/导出等高级功能。
import TopologyCanvas from './TopologyCanvas';//可视化画布
import NodeEditModal from './NodeEditModal';
import EdgeEditModal from './EdgeEditModal';
import Card from '../../ui/Card';
import SaveScenarioModal from './SaveScenarioModal';//

// ... generateId, TopologyState, Reducer, initial state 等代码保持不变 ...
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

// 为了让 `initialData` 包含名称和描述，我们在这里定义一个临时的 Scenario 接口
// 这样可以方便地将初始值传递给保存弹窗
interface Scenario {
    id: string | number;
    name: string;
    description: string;
    topology_json: TopologyData;
}
interface TopologyState {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    selectedElement: { id: string; type: 'node' | 'edge' } | null;
    linkingState: { startNodeId: string } | null;
}
// 函数: 这是一个纯函数，是状态管理的核心。它接收当前的状态 (state)
// 和一个动作 (action)，然后根据动作的类型（如 'ADD_NODE', 'MOVE_NODE'）
// 返回一个全新的状态对象。这种模式使得状态变更的逻辑被集中管理，非常清晰且易于调试。
function topologyReducer(state: TopologyState, action: TopologyAction): TopologyState {
    switch (action.type) {
        case 'ADD_NODE': { const newNode = action.payload.node as TopologyNode; return { ...state, nodes: [...state.nodes, newNode] }; }
        case 'MOVE_NODE': { const { nodeId, newX, newY } = action.payload; return { ...state, nodes: state.nodes.map(n => n.id === nodeId ? { ...n, x: newX, y: newY } : n), }; }
        case 'UPDATE_NODE_CONFIG': { const { nodeId, newConfig, newLabel } = action.payload; return { ...state, nodes: state.nodes.map(n => n.id === nodeId ? { ...n, config: newConfig, label: newLabel } : n), }; }
        case 'ADD_EDGE': { const newEdge = action.payload.edge as TopologyEdge; return { ...state, edges: [...state.edges, newEdge], linkingState: null, selectedElement: null }; }
        case 'UPDATE_EDGE_CONFIG': { const { edgeId, newConfig } = action.payload; return { ...state, edges: state.edges.map(e => e.id === edgeId ? { ...e, config: newConfig } : e), }; }
        case 'DELETE_NODE': { const { nodeId } = action.payload; return { ...state, nodes: state.nodes.filter(n => n.id !== nodeId), edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId), selectedElement: state.selectedElement?.id === nodeId ? null : state.selectedElement, }; }
        case 'DELETE_EDGE': { const { edgeId } = action.payload; return { ...state, edges: state.edges.filter(e => e.id !== edgeId), selectedElement: state.selectedElement?.id === edgeId ? null : state.selectedElement, }; }
        case 'SELECT_ELEMENT': return { ...state, selectedElement: action.payload.element, linkingState: null };
        case 'CLEAR_SELECTION': return { ...state, selectedElement: null, linkingState: null };
        case 'START_LINKING': return { ...state, linkingState: { startNodeId: action.payload.startNodeId } };
        case 'LOAD_TOPOLOGY': const { nodes: loadedNodes, edges: loadedEdges } = action.payload.topologyData as TopologyData; return { ...initialTopologyState, nodes: loadedNodes, edges: loadedEdges };
        default: return state;
    }
}

const initialTopologyState: TopologyState = { nodes: [], edges: [], selectedElement: null, linkingState: null, };
interface TopologyEditorProps {
    onAddNode: (node: TopologyNode) => void;
    onDeleteNode: (nodeId: string) => void;
    onUpdateNode: (node: TopologyNode) => void;
    initialData?: Scenario | null;
    onSaveSuccess: () => void;
    scenarioId?: string | number | null;
}


const TopologyEditor: React.FC<TopologyEditorProps> = ({
    onAddNode,
    onDeleteNode,
    onUpdateNode,
    initialData,
    // onSaveSuccess,
    scenarioId
}) => {
    // 所有节点和边的实时、完整信息，都统一存储在 TopologyEditor 组件的 currentTopologyState
    // 这个状态对象中的 nodes 和 edges 数组里。handleConfirmSave 函数正是从这里读取数据的。
    const [currentTopologyState, dispatch] = useReducer(topologyReducer, initialTopologyState);


    const { nodes, edges, selectedElement, linkingState } = currentTopologyState;
    const [undoStack, setUndoStack] = useState<TopologyAction[]>([]);
    const [redoStack, setRedoStack] = useState<TopologyAction[]>([]);
    const [isNodeEditModalOpen, setIsNodeEditModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<TopologyNode | null>(null);
    const [isEdgeEditModalOpen, setIsEdgeEditModalOpen] = useState(false);
    const [editingEdge, setEditingEdge] = useState<TopologyEdge | null>(null);
    const [nodeMoveInitialPosition, setNodeMoveInitialPosition] = useState<{ id: string, x: number, y: number} | null>(null);
    const svgCanvasRef = useRef<HTMLDivElement>(null);
    // 添加一个状态来控制保存按钮的加载动画
    const [isSaving, setIsSaving] = useState(false);
    //添加 state 来控制保存弹窗
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    //添加 useEffect: 监听 initialData prop 的变化
    useEffect(() => {
        // 从 initialData 中提取拓扑信息
        const topology = initialData?.topology_json;
        if (topology && (topology.nodes?.length > 0 || topology.edges?.length > 0)) {
            dispatch({ type: 'LOAD_TOPOLOGY', payload: { topologyData: topology } });

            // 清空并同步外部的 instance 列表状态
            onDeleteNode('all'); // 假设父组件支持 'all' 来清空
            topology.nodes.forEach(onAddNode);

        } else {
            dispatch({ type: 'LOAD_TOPOLOGY', payload: { topologyData: initialTopologyState } });
            onDeleteNode('all'); // 同样清空
        }

        setUndoStack([]);
        setRedoStack([]);
    }, [initialData, onAddNode, onDeleteNode]);

    //交互逻辑处理函数 (handle...)
    // 这些函数定义了用户在界面上的操作会产生什么效果。
    const pushToUndoStack = useCallback((action: TopologyAction) => { setUndoStack(prev => [...prev, action]); setRedoStack([]); }, []);
    // 当从工具栏拖拽一个设备到画布上时，此函数被调用。它会生成一个唯一的ID，
    // 创建一个新的节点对象，然后 dispatch 一个 'ADD_NODE' 动作。
    // 同时，它也会调用从父组件传来的 onAddNode 回调，通知父组件（ScenarioCreateDialog）状态已变更。
    // --- 【关键修改】在这里将中文标签改为英文 ---
    const addNode = useCallback((type: DeviceType, x: number, y: number) => {
        const nodeCount = nodes.filter(n => n.type === type).length + 1;
        const deviceDetails = TOPOLOGY_DEVICE_TYPES.find(dt => dt.type === type) || { name: '设备' };
        
        let englishLabel = '';
        // 根据中文名映射为英文名
        switch (deviceDetails.name) {
            case '容器':
                englishLabel = `Container-${nodeCount}`;
                break;
            case '虚拟机':
                englishLabel = `VM-${nodeCount}`;
                break;
            case '交换机':
                englishLabel = `Switch-${nodeCount}`;
                break;
            case '路由器':
                englishLabel = `Router-${nodeCount}`;
                break;
            case 'NAT网桥':
                englishLabel = `NAT-Bridge-${nodeCount}`;
                break;
            default:
                // 如果有其他类型，保留原样或指定一个通用英文名
                englishLabel = `Device-${nodeCount}`;
        }

        const newNode: TopologyNode = {
            id: generateId(type),
            type,
            label: englishLabel, // 使用新的英文标签
            x,
            y,
            config: { ...DEFAULT_NODE_CONFIG[type] }
        };
        const action: TopologyAction = { type: 'ADD_NODE', payload: { node: newNode } };
        dispatch(action);
        onAddNode(newNode);
        pushToUndoStack(action);
    }, [nodes, pushToUndoStack, onAddNode]);
    // --- 修改结束 ---
    const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => { const node = currentTopologyState.nodes.find(n => n.id === nodeId); if (node) { if (!nodeMoveInitialPosition || nodeMoveInitialPosition.id !== nodeId) setNodeMoveInitialPosition({ id: nodeId, x: node.x, y: node.y }); dispatch({ type: 'MOVE_NODE', payload: { nodeId, newX: x, newY: y } }); } }, [currentTopologyState.nodes, dispatch, nodeMoveInitialPosition]);
    const handleNodeMoveCommit = useCallback((nodeId: string, finalX: number, finalY: number) => { if (nodeMoveInitialPosition && nodeMoveInitialPosition.id === nodeId) { if (nodeMoveInitialPosition.x !== finalX || nodeMoveInitialPosition.y !== finalY) { const action: TopologyAction = { type: 'MOVE_NODE', payload: { nodeId, oldX: nodeMoveInitialPosition.x, oldY: nodeMoveInitialPosition.y, newX: finalX, newY: finalY } }; pushToUndoStack(action); } } setNodeMoveInitialPosition(null); }, [nodeMoveInitialPosition, pushToUndoStack]);
    const handleNodeSelect = useCallback((nodeId: string | null, event?: React.MouseEvent) => { event?.stopPropagation(); if (!nodeId) { dispatch({ type: 'CLEAR_SELECTION', payload: null }); return; } if (linkingState) { if (linkingState.startNodeId === nodeId) { dispatch({ type: 'SELECT_ELEMENT', payload: { element: { id: nodeId, type: 'node' } } }); } else { const sourceNode = nodes.find(n => n.id === linkingState.startNodeId); const targetNode = nodes.find(n => n.id === nodeId); if (sourceNode && targetNode) { const edgeExists = edges.some(edge => (edge.source === sourceNode.id && edge.target === targetNode.id) || (edge.source === targetNode.id && edge.target === sourceNode.id)); if (!edgeExists) { const newEdge: TopologyEdge = { id: generateId('edge'), source: sourceNode.id, target: targetNode.id, config: { ...DEFAULT_EDGE_CONFIG, sourceIp: `10.0.${nodes.length + edges.length + 1}.1/24`, targetIp: `10.0.${nodes.length + edges.length + 1}.2/24` } }; const action: TopologyAction = { type: 'ADD_EDGE', payload: { edge: newEdge } }; dispatch(action); pushToUndoStack(action); } else { dispatch({ type: 'CLEAR_SELECTION', payload: null }); } } else { dispatch({ type: 'CLEAR_SELECTION', payload: null }); } } } else { dispatch({ type: 'SELECT_ELEMENT', payload: { element: { id: nodeId, type: 'node' } } }); dispatch({ type: 'START_LINKING', payload: { startNodeId: nodeId } }); } }, [linkingState, nodes, edges, dispatch, pushToUndoStack]);
    const handleEdgeSelect = useCallback((edgeId: string | null) => { if (edgeId) { dispatch({ type: 'SELECT_ELEMENT', payload: { element: { id: edgeId, type: 'edge' } } }); } else { dispatch({ type: 'CLEAR_SELECTION', payload: null }); } }, [dispatch]);
    const handleCanvasClick = useCallback(() => { dispatch({ type: 'CLEAR_SELECTION', payload: null }); }, [dispatch]);
    const handleNodeDoubleClick = (nodeId: string) => { const node = nodes.find(n => n.id === nodeId); if (node) { setEditingNode(node); setIsNodeEditModalOpen(true); } };
    const handleEdgeDoubleClick = (edgeId: string) => { const edge = edges.find(e => e.id === edgeId); if (edge) { setEditingEdge(edge); setIsEdgeEditModalOpen(true); } };
    const saveNodeChanges = (nodeId: string, newConfig: NodeConfig, newLabel: string) => { const oldNode = nodes.find(n => n.id === nodeId); if (oldNode) { const action: TopologyAction = { type: 'UPDATE_NODE_CONFIG', payload: { nodeId, oldConfig: oldNode.config, oldLabel: oldNode.label, newConfig, newLabel } }; dispatch(action); onUpdateNode({ ...oldNode, config: newConfig, label: newLabel }); pushToUndoStack(action); } setIsNodeEditModalOpen(false); setEditingNode(null); };
    const saveEdgeChanges = (edgeId: string, newConfig: EdgeConfig) => { const oldEdge = edges.find(e => e.id === edgeId); if (oldEdge) { const action: TopologyAction = { type: 'UPDATE_EDGE_CONFIG', payload: { edgeId, oldConfig: oldEdge.config, newConfig } }; dispatch(action); pushToUndoStack(action); } setIsEdgeEditModalOpen(false); setEditingEdge(null); };
    const handleDeleteSelected = () => { if (!selectedElement) return; if (selectedElement.type === 'node') { const nodeToDelete = nodes.find(n => n.id === selectedElement.id); if (nodeToDelete) { const connectedEdges = edges.filter(e => e.source === nodeToDelete.id || e.target === nodeToDelete.id); const action: TopologyAction = { type: 'DELETE_NODE', payload: { nodeId: nodeToDelete.id, deletedNode: nodeToDelete, deletedEdges: connectedEdges } }; dispatch(action); onDeleteNode(nodeToDelete.id); pushToUndoStack(action); } } else if (selectedElement.type === 'edge') { const edgeToDelete = edges.find(e => e.id === selectedElement.id); if (edgeToDelete) { const action: TopologyAction = { type: 'DELETE_EDGE', payload: { edgeId: edgeToDelete.id, deletedEdge: edgeToDelete } }; dispatch(action); pushToUndoStack(action); } } };
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); const deviceType = event.dataTransfer.getData('application/reactflow') as DeviceType | ''; if (!deviceType || !svgCanvasRef.current) return; const svgElement = svgCanvasRef.current.querySelector('svg'); if (!svgElement) return; const pt = svgElement.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY; const svgP = pt.matrixTransform(svgElement.getScreenCTM()?.inverse()); addNode(deviceType, svgP.x, svgP.y); }, [addNode]);
    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; };
    const handleUndo = () => { const lastAction = undoStack[undoStack.length - 1]; if (!lastAction) return; switch (lastAction.type) { case 'ADD_NODE': const addedNode = lastAction.payload.node as TopologyNode; dispatch({ type: 'DELETE_NODE', payload: { nodeId: addedNode.id } }); onDeleteNode(addedNode.id); break; case 'DELETE_NODE': const deletedNode = lastAction.payload.deletedNode as TopologyNode; dispatch({ type: 'ADD_NODE', payload: { node: deletedNode } }); onAddNode(deletedNode); lastAction.payload.deletedEdges.forEach((edge: TopologyEdge) => dispatch({ type: 'ADD_EDGE', payload: { edge } })); break; case 'MOVE_NODE': dispatch({ type: 'MOVE_NODE', payload: { nodeId: lastAction.payload.nodeId, newX: lastAction.payload.oldX, newY: lastAction.payload.oldY } }); break; case 'UPDATE_NODE_CONFIG': const oldNodeConfig = nodes.find(n => n.id === lastAction.payload.nodeId); if (oldNodeConfig) { dispatch({ type: 'UPDATE_NODE_CONFIG', payload: { nodeId: lastAction.payload.nodeId, newConfig: lastAction.payload.oldConfig, newLabel: lastAction.payload.oldLabel } }); onUpdateNode({ ...oldNodeConfig, config: lastAction.payload.oldConfig, label: lastAction.payload.oldLabel }); } break; case 'ADD_EDGE': dispatch({ type: 'DELETE_EDGE', payload: { edgeId: (lastAction.payload.edge as TopologyEdge).id } }); break; case 'DELETE_EDGE': dispatch({ type: 'ADD_EDGE', payload: { edge: lastAction.payload.deletedEdge } }); break; case 'UPDATE_EDGE_CONFIG': dispatch({ type: 'UPDATE_EDGE_CONFIG', payload: { edgeId: lastAction.payload.edgeId, newConfig: lastAction.payload.oldConfig } }); break; default: return; } setUndoStack(prev => prev.slice(0, -1)); setRedoStack(prev => [lastAction, ...prev]); };
    const handleRedo = () => { const lastRedoAction = redoStack[0]; if (!lastRedoAction) return; if (lastRedoAction.type === 'MOVE_NODE') { dispatch({ type: 'MOVE_NODE', payload: { nodeId: lastRedoAction.payload.nodeId, newX: lastRedoAction.payload.newX, newY: lastRedoAction.payload.newY } }); } else { dispatch(lastRedoAction); } if (lastRedoAction.type === 'ADD_NODE') onAddNode(lastRedoAction.payload.node); else if (lastRedoAction.type === 'DELETE_NODE') onDeleteNode(lastRedoAction.payload.nodeId); else if (lastRedoAction.type === 'UPDATE_NODE_CONFIG') { const updatedNode = nodes.find(n => n.id === lastRedoAction.payload.nodeId); if (updatedNode) onUpdateNode({ ...updatedNode, config: lastRedoAction.payload.newConfig, label: lastRedoAction.payload.newLabel }); } setRedoStack(prev => prev.slice(1)); setUndoStack(prev => [...prev, lastRedoAction]); };

    // 3. 原来的 handleSave 现在只负责打开弹窗
    const handleSave = () => {
        setIsSaveModalOpen(true);
    };

    // 这是一个新函数，专门负责处理真正的保存逻辑。它会在用户在 <SaveScenarioModal> 中填写完信息并点击“确认保存”后被调用。
    // 准备数据: 它从 currentTopologyState 中获取当前的 nodes 和 edges，并连同用户输入的name和description一起，组装成一个 payload 对象。
    // 发送API请求: 使用 fetch 函数向后端的 http://127.0.0.1:8000/api/scenarios 地址发送一个 POST 请求，请求体就是刚才组装好的 JSON 数据。
    // 处理响应: 对请求的成功或失败进行处理。如果失败，会尝试解析后端返回的错误信息并用 alert 提示用户。
    // 模式判断: 通过 const isEditing = !!scenarioId; 来判断当前是“编辑”模式还是“创建”模式。scenarioId prop 是从父组件传递过来的，只有在编辑时才会有值。
    // 动态URL和方法: 根据 isEditing 的值，动态地确定API的URL（包含ID或不包含ID）和HTTP请求方法（PUT或POST）。
    // 统一的Payload: 无论创建还是更新，发送的数据载荷 payload 结构都是相同的。
    // 统一的API调用: fetch 函数现在使用动态的 url 和 method 来发送请求。
    // 用户反馈:
    // 添加了 isSaving state，在API请求期间设置为 true，你可以将它传递给 SaveScenarioModal 来禁用按钮并显示加载动画。
    // 成功后的提示信息现在也会根据 isEditing 的值显示“更新成功”或“创建成功”。
    // 无论成功或失败，finally 块都会将 isSaving 设回 false。
    // 成功回调: 保存成功后，会调用 onSaveSuccess()，通知父组件关闭弹窗并刷新列表。
    const handleConfirmSave = async (name: string, description: string) => {
        setIsSaving(true); // 开始保存，显示加载状态

        // 1. 判断当前是创建还是编辑模式
        const isEditing = !!scenarioId;

        // 2. 准备要发送的数据
        const topologyData: TopologyData = { nodes, edges };
        const payload = {
            name,
            description,
            topology: topologyData
        };

        // 3. 根据模式确定 API 的 URL 和请求方法
        const url = isEditing
            ? `http://127.0.0.1:8000/api/scenarios/${scenarioId}`
            : 'http://127.0.0.1:8000/api/scenarios';

        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`服务器错误: ${errorData.message || response.statusText}`);
            }

            const result = await response.json();
            const successMessage = result.message || (isEditing ? '场景更新成功！' : '场景创建成功！');
            alert(successMessage);

            // 4. 操作成功后，关闭弹窗并调用父组件的回调函数
            setIsSaveModalOpen(false);
            // onSaveSuccess();

        } catch (error: any) {
            console.error('保存场景时出错:', error);
            alert(`保存失败: ${error.message}`);
        } finally {
            setIsSaving(false); // 结束保存，隐藏加载状态
        }
    };


    // const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    //     const file = event.target.files?.[0];
    //     if (!file) return;
    //     const reader = new FileReader();
    //     reader.onload = (e) => {
    //         try {
    //             const jsonString = e.target?.result as string;
    //             const importedData = JSON.parse(jsonString);
    //
    //             // 兼容旧格式和新格式
    //             const topologyData = importedData.topology || importedData;
    //
    //             if (topologyData && Array.isArray(topologyData.nodes) && Array.isArray(topologyData.edges)) {
    //                 dispatch({ type: 'LOAD_TOPOLOGY', payload: { topologyData } });
    //                 nodes.forEach(node => onDeleteNode(node.id));
    //                 topologyData.nodes.forEach(onAddNode);
    //                 setUndoStack([]);
    //                 setRedoStack([]);
    //             } else {
    //                 alert('无效的拓扑文件格式。');
    //             }
    //         } catch (error) {
    //             console.error("导入拓扑时出错:", error);
    //             alert('导入拓扑失败。');
    //         }
    //     };
    //     reader.readAsText(file);
    //     event.target.value = '';
    // };

    return (
        <Card title="网络拓扑编辑器" className="mt-8">
            <TopologyToolbar
                onDeleteSelected={handleDeleteSelected}
                onUndo={handleUndo}
                canUndo={undoStack.length > 0}
                onRedo={handleRedo}
                canRedo={redoStack.length > 0}
                onSave={handleSave} // 保持不变，它现在会打开弹窗
                // onExport={handleExport}
                // onImport={handleImport}
                onClearSelection={() => dispatch({type: 'CLEAR_SELECTION', payload: null})}
            />
            <div
                ref={svgCanvasRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="topology-canvas-droppable-area"
            >
                <TopologyCanvas
                    nodes={nodes}
                    edges={edges}
                    selectedElement={selectedElement}
                    onNodeSelect={handleNodeSelect}
                    onEdgeSelect={handleEdgeSelect}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onEdgeDoubleClick={handleEdgeDoubleClick}
                    onCanvasClick={handleCanvasClick}
                    onNodeMove={handleNodeMove}
                    onNodeMoveCommit={handleNodeMoveCommit}
                    linkingState={linkingState}
                />
            </div>
            <NodeEditModal
                isOpen={isNodeEditModalOpen}
                onClose={() => setIsNodeEditModalOpen(false)}
                node={editingNode}
                onSave={saveNodeChanges}
            />
            <EdgeEditModal
                isOpen={isEdgeEditModalOpen}
                onClose={() => setIsEdgeEditModalOpen(false)}
                edge={editingEdge}
                sourceNode={nodes.find(n => n.id === editingEdge?.source)}
                targetNode={nodes.find(n => n.id === editingEdge?.target)}
                onSave={saveEdgeChanges}
            />
            {/* 5. 在 JSX 中渲染弹窗组件 */}
            <SaveScenarioModal
                open={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleConfirmSave} isSaving={false}            />
            <SaveScenarioModal
                open={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleConfirmSave}
                initialName={initialData?.name}
                initialDescription={initialData?.description}
                isSaving={isSaving}
            />
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400 italic p-4">
                说明：从工具栏拖动设备到画布创建节点。单击节点开始连接，再单击另一个节点完成连接。双击节点或连接进行编辑。
            </p>
        </Card>
    );
};

export default TopologyEditor;

