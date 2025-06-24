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
import TopologyToolbar from './TopologyToolbar';
import TopologyCanvas from './TopologyCanvas';
import NodeEditModal from './NodeEditModal';
import EdgeEditModal from './EdgeEditModal';
import Card from '../../ui/Card';
// 1. 导入新的弹窗组件
import SaveScenarioModal from './SaveScenarioModal';

// ... generateId, TopologyState, Reducer, initial state 等代码保持不变 ...
const generateId = (prefix: string = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

interface TopologyState {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    selectedElement: { id: string; type: 'node' | 'edge' } | null;
    linkingState: { startNodeId: string } | null;
}

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
interface TopologyEditorProps { onAddNode: (node: TopologyNode) => void; onDeleteNode: (nodeId: string) => void; onUpdateNode: (node: TopologyNode) => void; }


const TopologyEditor: React.FC<TopologyEditorProps> = ({ onAddNode, onDeleteNode, onUpdateNode }) => {
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

    // 2. 添加 state 来控制保存弹窗
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

    // ... 所有其他交互函数 (addNode, handleNodeMove, etc.) 保持不变 ...
    const pushToUndoStack = useCallback((action: TopologyAction) => { setUndoStack(prev => [...prev, action]); setRedoStack([]); }, []);
    const addNode = useCallback((type: DeviceType, x: number, y: number) => { const nodeCount = nodes.filter(n => n.type === type).length + 1; const deviceDetails = TOPOLOGY_DEVICE_TYPES.find(dt => dt.type === type) || { name: '设备' }; const newNode: TopologyNode = { id: generateId(type), type, label: `${deviceDetails.name}-${nodeCount}`, x, y, config: { ...DEFAULT_NODE_CONFIG[type] } }; const action: TopologyAction = { type: 'ADD_NODE', payload: { node: newNode } }; dispatch(action); onAddNode(newNode); pushToUndoStack(action); }, [nodes, pushToUndoStack, onAddNode]);
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

    // 4. 新的 handleConfirmSave 函数负责处理API请求
    const handleConfirmSave = async (name: string, description: string) => {
        // 准备拓扑数据和载荷 (payload) 的逻辑保持不变
        const topologyData: TopologyData = { nodes, edges };
        const payload = {
            name,
            description,
            createdAt: new Date().toISOString(),
            topology: topologyData
        };

        try {
            // --- 主要修改点在这里 ---
            // 将 URL 修改为您的 Laravel 后端的完整地址
            const response = await fetch('http://127.0.0.1:8000/api/scenarios', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json', // 明确希望接收 JSON 响应
                },
                body: JSON.stringify(payload),
            });

            // 处理响应的逻辑保持不变
            if (!response.ok) {
                // 尝试解析后端返回的错误信息
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`服务器错误: ${errorData.message || response.statusText}`);
            }

            const result = await response.json();
            console.log('后端返回成功信息:', result);
            alert(result.message || '拓扑场景已成功保存到服务器！');

        } catch (error) {
            console.error('保存场景时出错:', error);
            alert(`保存失败: ${error.message}`);
        }
    };


    const handleExport = () => {
        const topologyData: TopologyData = { nodes, edges };
        const jsonString = JSON.stringify(topologyData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'topology.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonString = e.target?.result as string;
                const importedData = JSON.parse(jsonString);

                // 兼容旧格式和新格式
                const topologyData = importedData.topology || importedData;

                if (topologyData && Array.isArray(topologyData.nodes) && Array.isArray(topologyData.edges)) {
                    dispatch({ type: 'LOAD_TOPOLOGY', payload: { topologyData } });
                    nodes.forEach(node => onDeleteNode(node.id));
                    topologyData.nodes.forEach(onAddNode);
                    setUndoStack([]);
                    setRedoStack([]);
                } else {
                    alert('无效的拓扑文件格式。');
                }
            } catch (error) {
                console.error("导入拓扑时出错:", error);
                alert('导入拓扑失败。');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <Card title="网络拓扑编辑器" className="mt-8">
            <TopologyToolbar
                onDeleteSelected={handleDeleteSelected}
                onUndo={handleUndo}
                canUndo={undoStack.length > 0}
                onRedo={handleRedo}
                canRedo={redoStack.length > 0}
                onSave={handleSave} // 保持不变，它现在会打开弹窗
                onExport={handleExport}
                onImport={handleImport}
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
                onSave={handleConfirmSave}
            />
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400 italic p-4">
                说明：从工具栏拖动设备到画布创建节点。单击节点开始连接，再单击另一个节点完成连接。双击节点或连接进行编辑。
            </p>
        </Card>
    );
};

export default TopologyEditor;

