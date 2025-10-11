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
import { DEFAULT_NODE_CONFIG, DEFAULT_EDGE_CONFIG, TOPOLOGY_DEVICE_TYPES, TRAFFIC_SIMULATION_IMAGES, TRAFFIC_MIRRORING_IMAGES } from '../../../constants';
import { canDirectlyLinkNodes, wouldViolateSingleSwitchRule } from './topologyRules';
import TopologyToolbar from './TopologyToolbar';//包含一个 TopologyToolbar，提供撤销、重做、保存、导入/导出等高级功能。
import TopologyCanvas from './TopologyCanvas';//可视化画布
import NodeEditModal from './NodeEditModal';
import EdgeEditModal from './EdgeEditModal';
import VirtualMachineEditModal from './VirtualMachineEditModal'; // 新增：导入VM编辑模态框
import Card from '../../ui/Card';
import { Backdrop, CircularProgress } from '@mui/material';
import SaveScenarioModal from './SaveScenarioModal';//
import { customFetch } from '@/utils/fetch';
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
// 直连与限制规则：改为使用共享规则（topologyRules）

// 函数: 这是一个纯函数，是状态管理的核心。它接收当前的状态 (state)
// 和一个动作 (action)，然后根据动作的类型（如 'ADD_NODE', 'MOVE_NODE'）
// 返回一个全新的状态对象。这种模式使得状态变更的逻辑被集中管理，非常清晰且易于调试。
function topologyReducer(state: TopologyState, action: TopologyAction): TopologyState {
    switch (action.type) {
        case 'ADD_NODE': { const newNode = action.payload.node as TopologyNode; return { ...state, nodes: [...state.nodes, newNode] }; }
        case 'MOVE_NODE': { const { nodeId, newX, newY } = action.payload; return { ...state, nodes: state.nodes.map(n => n.id === nodeId ? { ...n, x: newX, y: newY } : n), }; }
        case 'UPDATE_NODE_CONFIG': { const { nodeId, newConfig, newLabel } = action.payload; return { ...state, nodes: state.nodes.map(n => n.id === nodeId ? { ...n, config: newConfig, label: newLabel } : n), }; }
        case 'ADD_EDGE': {
            const newEdge = action.payload.edge as TopologyEdge;
            const src = state.nodes.find(n => n.id === newEdge.source);
            const tgt = state.nodes.find(n => n.id === newEdge.target);
            if (!canDirectlyLinkNodes(src, tgt)) {
                // 非法边：不添加
                return { ...state, linkingState: null, selectedElement: null };
            }
            // 限制：同一容器/虚拟机仅允许一条到交换机的连接
            if (wouldViolateSingleSwitchRule(src, tgt, state.edges)) {
                return { ...state, linkingState: null, selectedElement: null };
            }
            return { ...state, edges: [...state.edges, newEdge], linkingState: null, selectedElement: null };
        }
        case 'UPDATE_EDGE_CONFIG': { const { edgeId, newConfig } = action.payload; return { ...state, edges: state.edges.map(e => e.id === edgeId ? { ...e, config: newConfig } : e), }; }
        

        case 'DELETE_NODE': { const { nodeId } = action.payload; return { ...state, nodes: state.nodes.filter(n => n.id !== nodeId), edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId), selectedElement: state.selectedElement?.id === nodeId ? null : state.selectedElement, }; }
        case 'DELETE_EDGE': { const { edgeId } = action.payload; return { ...state, edges: state.edges.filter(e => e.id !== edgeId), selectedElement: state.selectedElement?.id === edgeId ? null : state.selectedElement, }; }
        case 'SELECT_ELEMENT': return { ...state, selectedElement: action.payload.element, linkingState: null };
        case 'CLEAR_SELECTION': return { ...state, selectedElement: null, linkingState: null };
        case 'START_LINKING': return { ...state, linkingState: { startNodeId: action.payload.startNodeId } };
        case 'LOAD_TOPOLOGY': {
            const { nodes: loadedNodes, edges: loadedEdges } = action.payload.topologyData as TopologyData;
            // 顺序过滤：与运行期规则保持一致
            const filtered: TopologyEdge[] = [];
            for (const e of loadedEdges) {
                const s = loadedNodes.find(n => n.id === e.source);
                const t = loadedNodes.find(n => n.id === e.target);
                if (!canDirectlyLinkNodes(s, t)) continue; // 允许：switch 或 特殊镜像容器
                if (wouldViolateSingleSwitchRule(s, t, filtered)) continue; // 特殊镜像容器不受单边限制
                filtered.push(e);
            }
            return { ...initialTopologyState, nodes: loadedNodes, edges: filtered };
        }
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
    // 新增：当用于实例拓扑查看/编辑时，传入实例ID，则保存直接更新实例表的 JSON
    sceneInstanceId?: string | null;
}


const TopologyEditor: React.FC<TopologyEditorProps> = ({
    onAddNode,
    onDeleteNode,
    onUpdateNode,
    initialData,
    // onSaveSuccess,
    scenarioId,
    sceneInstanceId
}) => {
    // 所有节点和边的实时、完整信息，都统一存储在 TopologyEditor 组件的 currentTopologyState
    // 这个状态对象中的 nodes 和 edges 数组里。handleConfirmSave 函数正是从这里读取数据的。
    const [currentTopologyState, dispatch] = useReducer(topologyReducer, initialTopologyState);
    const [isVMEditModalOpen, setIsVMEditModalOpen] = useState(false); // 新增：VM模态框状态
    const [editingVMNode, setEditingVMNode] = useState<TopologyNode | null>(null); // 新增：正在编辑的VM节点状态

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
    
    // 场景级策略开关
    const [collectionOptions, setCollectionOptions] = useState({
        zeek: false,
        sysdig: false
    });
    const [simulationEnabled, setSimulationEnabled] = useState(false);
    const [mirroringEnabled, setMirroringEnabled] = useState(false);
    // 新增：流量镜像交换机选择相关状态
    const [isSelectingSwitchForMirroring, setIsSelectingSwitchForMirroring] = useState(false);
    const [shouldResetSwitchDropdown, setShouldResetSwitchDropdown] = useState(false);
    // 新增：流量模拟交换机选择相关状态
    const [isSelectingSwitchForSimulation, setIsSelectingSwitchForSimulation] = useState(false);
    const [shouldResetSimulationDropdown, setShouldResetSimulationDropdown] = useState(false);
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
                englishLabel = `C-${nodeCount}`;
                break;
            case '虚拟机':
                englishLabel = `VM-${nodeCount}`;
                break;
            case '交换机':
                englishLabel = `S-${nodeCount}`;
                break;
            case '路由器':
                englishLabel = `R-${nodeCount}`;
                break;
            case 'NAT网桥':
                englishLabel = `br0`;
                break;
            default:
                // 如果有其他类型，保留原样或指定一个通用英文名
                englishLabel = `Device-${nodeCount}`;
        }

        // 获取默认配置
        let nodeConfig = { ...DEFAULT_NODE_CONFIG[type] };
        
        // 如果是容器或虚拟机，根据当前的采集选项设置环境变量
        if (type === 'container' || type === 'virtual_machine') {
            const currentEnv = nodeConfig.env || '';
            const envVars = currentEnv.split(',').filter(v => v.trim());
            
            // 移除现有的ZEEK_ENABLED和SYSDIG_ENABLED
            const filteredEnvVars = envVars.filter(v => 
                !v.includes('ZEEK_ENABLED=') && !v.includes('SYSDIG_ENABLED=')
            );
            
            // 添加新的环境变量
            const newEnvVars = [
                ...filteredEnvVars,
                `ZEEK_ENABLED=${collectionOptions.zeek ? '1' : '0'}`,
                `SYSDIG_ENABLED=${collectionOptions.sysdig ? '1' : '0'}`
            ];
            
            nodeConfig = {
                ...nodeConfig,
                env: newEnvVars.join(',')
            };
        }

        const newNode: TopologyNode = {
            id: generateId(type),
            type,
            label: englishLabel, // 使用新的英文标签
            x,
            y,
            config: nodeConfig
        };
        const action: TopologyAction = { type: 'ADD_NODE', payload: { node: newNode } };
        dispatch(action);
        onAddNode(newNode);
        pushToUndoStack(action);
    }, [nodes, pushToUndoStack, onAddNode, collectionOptions]);
    // --- 修改结束 ---
    const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => { const node = currentTopologyState.nodes.find(n => n.id === nodeId); if (node) { if (!nodeMoveInitialPosition || nodeMoveInitialPosition.id !== nodeId) setNodeMoveInitialPosition({ id: nodeId, x: node.x, y: node.y }); dispatch({ type: 'MOVE_NODE', payload: { nodeId, newX: x, newY: y } }); } }, [currentTopologyState.nodes, dispatch, nodeMoveInitialPosition]);
    const handleNodeMoveCommit = useCallback((nodeId: string, finalX: number, finalY: number) => { if (nodeMoveInitialPosition && nodeMoveInitialPosition.id === nodeId) { if (nodeMoveInitialPosition.x !== finalX || nodeMoveInitialPosition.y !== finalY) { const action: TopologyAction = { type: 'MOVE_NODE', payload: { nodeId, oldX: nodeMoveInitialPosition.x, oldY: nodeMoveInitialPosition.y, newX: finalX, newY: finalY } }; pushToUndoStack(action); } } setNodeMoveInitialPosition(null); }, [nodeMoveInitialPosition, pushToUndoStack]);
    // 使用包含特殊镜像容器规则的直连判定
    // 允许：至少一端为交换机，或任一端为特殊镜像容器
    // 统一与 reducer 的 canDirectlyLinkNodes 逻辑保持一致

    const handleNodeSelect = useCallback((nodeId: string | null, event?: React.MouseEvent) => {
        event?.stopPropagation();
        if (!nodeId) {
            dispatch({ type: 'CLEAR_SELECTION', payload: null });
            return;
        }

        if (linkingState) {
            if (linkingState.startNodeId === nodeId) {
                dispatch({ type: 'SELECT_ELEMENT', payload: { element: { id: nodeId, type: 'node' } } });
            } else {
                const sourceNode = nodes.find(n => n.id === linkingState.startNodeId);
                const targetNode = nodes.find(n => n.id === nodeId);
                if (sourceNode && targetNode) {
                    if (!canDirectlyLinkNodes(sourceNode, targetNode)) {
                        return;
                    }

                    // 前置限制：容器/虚拟机仅能连接一个交换机
                    if (wouldViolateSingleSwitchRule(sourceNode, targetNode, edges)) {
                        return;
                    }

                    const edgeExists = edges.some(edge =>
                        (edge.source === sourceNode.id && edge.target === targetNode.id) ||
                        (edge.source === targetNode.id && edge.target === sourceNode.id)
                    );
                    if (!edgeExists) {
                        const newEdge: TopologyEdge = {
                            id: generateId('edge'),
                            source: sourceNode.id,
                            target: targetNode.id,
                            config: { ...DEFAULT_EDGE_CONFIG, sourceInterface: '', targetInterface: '', sourceIp: '', targetIp: '' }
                        };
                        const action: TopologyAction = { type: 'ADD_EDGE', payload: { edge: newEdge } };
                        dispatch(action);
                        pushToUndoStack(action);
                    } else {
                        dispatch({ type: 'CLEAR_SELECTION', payload: null });
                    }
                } else {
                    dispatch({ type: 'CLEAR_SELECTION', payload: null });
                }
            }
        } else {
            // 第一次点击：任意节点可作为起点；后续由 canDirectlyLink 判定目标是否合法
            dispatch({ type: 'SELECT_ELEMENT', payload: { element: { id: nodeId, type: 'node' } } });
            dispatch({ type: 'START_LINKING', payload: { startNodeId: nodeId } });
        }
    }, [linkingState, nodes, edges, dispatch, pushToUndoStack]);
    const handleEdgeSelect = useCallback((edgeId: string | null) => { if (edgeId) { dispatch({ type: 'SELECT_ELEMENT', payload: { element: { id: edgeId, type: 'edge' } } }); } else { dispatch({ type: 'CLEAR_SELECTION', payload: null }); } }, [dispatch]);
    const handleCanvasClick = useCallback(() => { dispatch({ type: 'CLEAR_SELECTION', payload: null }); }, [dispatch]);

    const saveVMChanges = (nodeId: string, newConfig: NodeConfig, newLabel: string) => {
        const oldNode = nodes.find(n => n.id === nodeId);
        if (oldNode) {
            const action: TopologyAction = {
                type: 'UPDATE_NODE_CONFIG',
                payload: { nodeId, oldConfig: oldNode.config, oldLabel: oldNode.label, newConfig, newLabel }
            };
            dispatch(action);
            onUpdateNode({ ...oldNode, config: newConfig, label: newLabel });
            pushToUndoStack(action);
        }
        setIsVMEditModalOpen(false);
        setEditingVMNode(null);
    };
    const handleNodeDoubleClick = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            if (node.type === 'virtual_machine') {
                setEditingVMNode(node);
                setIsVMEditModalOpen(true);
            } else {
                setEditingNode(node);
                setIsNodeEditModalOpen(true);
            }
        }
    };
    const handleEdgeDoubleClick = (edgeId: string) => { const edge = edges.find(e => e.id === edgeId); if (edge) { setEditingEdge(edge); setIsEdgeEditModalOpen(true); } };
    const saveNodeChanges = (nodeId: string, newConfig: NodeConfig, newLabel: string) => { const oldNode = nodes.find(n => n.id === nodeId); if (oldNode) { const action: TopologyAction = { type: 'UPDATE_NODE_CONFIG', payload: { nodeId, oldConfig: oldNode.config, oldLabel: oldNode.label, newConfig, newLabel } }; dispatch(action); onUpdateNode({ ...oldNode, config: newConfig, label: newLabel }); pushToUndoStack(action); } setIsNodeEditModalOpen(false); setEditingNode(null); };
    const saveEdgeChanges = (edgeId: string, newConfig: EdgeConfig) => { const oldEdge = edges.find(e => e.id === edgeId); if (oldEdge) { const action: TopologyAction = { type: 'UPDATE_EDGE_CONFIG', payload: { edgeId, oldConfig: oldEdge.config, newConfig } }; dispatch(action); pushToUndoStack(action); } setIsEdgeEditModalOpen(false); setEditingEdge(null); };
    const handleDeleteSelected = () => { if (!selectedElement) return; if (selectedElement.type === 'node') { const nodeToDelete = nodes.find(n => n.id === selectedElement.id); if (nodeToDelete) { const connectedEdges = edges.filter(e => e.source === nodeToDelete.id || e.target === nodeToDelete.id); const action: TopologyAction = { type: 'DELETE_NODE', payload: { nodeId: nodeToDelete.id, deletedNode: nodeToDelete, deletedEdges: connectedEdges } }; dispatch(action); onDeleteNode(nodeToDelete.id); pushToUndoStack(action); } } else if (selectedElement.type === 'edge') { const edgeToDelete = edges.find(e => e.id === selectedElement.id); if (edgeToDelete) { const action: TopologyAction = { type: 'DELETE_EDGE', payload: { edgeId: edgeToDelete.id, deletedEdge: edgeToDelete } }; dispatch(action); pushToUndoStack(action); } } };
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); const deviceType = event.dataTransfer.getData('application/reactflow') as DeviceType | ''; if (!deviceType || !svgCanvasRef.current) return; const svgElement = svgCanvasRef.current.querySelector('svg'); if (!svgElement) return; const pt = svgElement.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY; const svgP = pt.matrixTransform(svgElement.getScreenCTM()?.inverse()); addNode(deviceType, svgP.x, svgP.y); }, [addNode]);
    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; };
    const handleUndo = () => { const lastAction = undoStack[undoStack.length - 1]; if (!lastAction) return; switch (lastAction.type) { case 'ADD_NODE': const addedNode = lastAction.payload.node as TopologyNode; dispatch({ type: 'DELETE_NODE', payload: { nodeId: addedNode.id } }); onDeleteNode(addedNode.id); break; case 'DELETE_NODE': const deletedNode = lastAction.payload.deletedNode as TopologyNode; dispatch({ type: 'ADD_NODE', payload: { node: deletedNode } }); onAddNode(deletedNode); lastAction.payload.deletedEdges.forEach((edge: TopologyEdge) => dispatch({ type: 'ADD_EDGE', payload: { edge } })); break; case 'MOVE_NODE': dispatch({ type: 'MOVE_NODE', payload: { nodeId: lastAction.payload.nodeId, newX: lastAction.payload.oldX, newY: lastAction.payload.oldY } }); break; case 'UPDATE_NODE_CONFIG': const oldNodeConfig = nodes.find(n => n.id === lastAction.payload.nodeId); if (oldNodeConfig) { dispatch({ type: 'UPDATE_NODE_CONFIG', payload: { nodeId: lastAction.payload.nodeId, newConfig: lastAction.payload.oldConfig, newLabel: lastAction.payload.oldLabel } }); onUpdateNode({ ...oldNodeConfig, config: lastAction.payload.oldConfig, label: lastAction.payload.oldLabel }); } break; case 'ADD_EDGE': dispatch({ type: 'DELETE_EDGE', payload: { edgeId: (lastAction.payload.edge as TopologyEdge).id } }); break; case 'DELETE_EDGE': dispatch({ type: 'ADD_EDGE', payload: { edge: lastAction.payload.deletedEdge } }); break; case 'UPDATE_EDGE_CONFIG': dispatch({ type: 'UPDATE_EDGE_CONFIG', payload: { edgeId: lastAction.payload.edgeId, newConfig: lastAction.payload.oldConfig } }); break; default: return; } setUndoStack(prev => prev.slice(0, -1)); setRedoStack(prev => [lastAction, ...prev]); };
    const handleRedo = () => { const lastRedoAction = redoStack[0]; if (!lastRedoAction) return; if (lastRedoAction.type === 'MOVE_NODE') { dispatch({ type: 'MOVE_NODE', payload: { nodeId: lastRedoAction.payload.nodeId, newX: lastRedoAction.payload.newX, newY: lastRedoAction.payload.newY } }); } else { dispatch(lastRedoAction); } if (lastRedoAction.type === 'ADD_NODE') onAddNode(lastRedoAction.payload.node); else if (lastRedoAction.type === 'DELETE_NODE') onDeleteNode(lastRedoAction.payload.nodeId); else if (lastRedoAction.type === 'UPDATE_NODE_CONFIG') { const updatedNode = nodes.find(n => n.id === lastRedoAction.payload.nodeId); if (updatedNode) onUpdateNode({ ...updatedNode, config: lastRedoAction.payload.newConfig, label: lastRedoAction.payload.newLabel }); } setRedoStack(prev => prev.slice(1)); setUndoStack(prev => [...prev, lastRedoAction]); };

    // 更新所有容器和虚拟机的环境变量
    const updateAllContainersEnvVars = useCallback((options: { zeek: boolean; sysdig: boolean }) => {
        const zeekValue = options.zeek ? '1' : '0';
        const sysdigValue = options.sysdig ? '1' : '0';
        
        // 遍历当前所有节点，更新容器和虚拟机的环境变量
        nodes.forEach(node => {
            if (node.type === 'container' || node.type === 'virtual_machine') {
                const currentEnv = node.config.env || '';
                const envVars = currentEnv.split(',').filter(v => v.trim());
                
                // 移除现有的ZEEK_ENABLED和SYSDIG_ENABLED
                const filteredEnvVars = envVars.filter(v => 
                    !v.includes('ZEEK_ENABLED=') && !v.includes('SYSDIG_ENABLED=')
                );
                
                // 添加新的环境变量
                const newEnvVars = [
                    ...filteredEnvVars,
                    `ZEEK_ENABLED=${zeekValue}`,
                    `SYSDIG_ENABLED=${sysdigValue}`
                ];
                
                const newEnv = newEnvVars.join(',');
                
                // 更新节点配置
                dispatch({
                    type: 'UPDATE_NODE_CONFIG',
                    payload: {
                        nodeId: node.id,
                        newConfig: {
                            ...node.config,
                            env: newEnv
                        },
                        newLabel: node.label
                    }
                });
            }
        });
    }, [nodes]);

    const handleToggleCollectionOption = useCallback((option: 'zeek' | 'sysdig') => {
        setCollectionOptions(prev => {
            const newOptions = { ...prev, [option]: !prev[option] };
            
            // 更新所有容器和虚拟机的环境变量
            updateAllContainersEnvVars(newOptions);
            
            return newOptions;
        });
    }, [updateAllContainersEnvVars]);
    const handleToggleSimulation = useCallback(() => {
        if (!simulationEnabled) {
            // 如果当前未启用模拟，则进入交换机选择模式
            setIsSelectingSwitchForSimulation(true);
        } else {
            // 如果当前已启用模拟，则关闭模拟功能
            setSimulationEnabled(false);
            setIsSelectingSwitchForSimulation(false);
        }
    }, [simulationEnabled]);
    const handleToggleMirroring = useCallback(() => {
        if (!mirroringEnabled) {
            // 如果当前未启用镜像，则进入交换机选择模式
            setIsSelectingSwitchForMirroring(true);
        } else {
            // 如果当前已启用镜像，则关闭镜像功能
            setMirroringEnabled(false);
            setIsSelectingSwitchForMirroring(false);
        }
    }, [mirroringEnabled]);

    // 新增：处理交换机选择进行镜像的函数
    const handleSelectSwitchForMirroring = useCallback((switchId: string) => {
        const selectedSwitch = nodes.find(node => node.id === switchId && node.type === 'switch');
        if (!selectedSwitch) {
            console.error('未找到选中的交换机');
            return;
        }

        // 创建默认的Docker镜像容器
        const containerCount = nodes.filter(n => n.type === 'container').length + 1;
        const containerLabel = `Mirror-${containerCount}`;
        
        // 生成容器节点
        const mirrorContainer: TopologyNode = {
            id: generateId('container'),
            type: 'container',
            label: containerLabel,
            x: selectedSwitch.x + 200, // 在交换机右侧放置
            y: selectedSwitch.y,
            config: {
                ...DEFAULT_NODE_CONFIG.container,
                Image: TRAFFIC_MIRRORING_IMAGES.SURICATA,
                env: `ELASTICSEARCH_HOST=10.100.88.88,ELASTICSEARCH_PORT=9200,TZ=Asia/Shanghai,ZEEK_ENABLED=1,SYSDIG_ENABLED=1`
            }
        };

        // 创建容器到交换机的连接
        const mirrorEdge: TopologyEdge = {
            id: generateId('edge'),
            source: mirrorContainer.id,
            target: switchId,
            config: {
                ...DEFAULT_EDGE_CONFIG,
                sourceInterface: '',
                targetInterface: '',
                sourceIp: '',
                targetIp: ''
            }
        };

        // 添加容器节点
        const addContainerAction: TopologyAction = { type: 'ADD_NODE', payload: { node: mirrorContainer } };
        dispatch(addContainerAction);
        onAddNode(mirrorContainer);
        pushToUndoStack(addContainerAction);

        // 添加连接边
        const addEdgeAction: TopologyAction = { type: 'ADD_EDGE', payload: { edge: mirrorEdge } };
        dispatch(addEdgeAction);
        pushToUndoStack(addEdgeAction);

        // 启用镜像功能并退出选择模式
        setMirroringEnabled(true);
        setIsSelectingSwitchForMirroring(false);
        setShouldResetSwitchDropdown(true);
    }, [nodes, dispatch, onAddNode, pushToUndoStack]);

    // 新增：处理交换机选择进行模拟的函数
    const handleSelectSwitchForSimulation = useCallback((switchId: string) => {
        const selectedSwitch = nodes.find(node => node.id === switchId && node.type === 'switch');
        if (!selectedSwitch) {
            console.error('未找到选中的交换机');
            return;
        }

        // 创建两个不同的Docker镜像名称
        const containerCount = nodes.filter(n => n.type === 'container').length;
        
        // 创建两个模拟容器
        const simulationContainer1: TopologyNode = {
            id: generateId('container'),
            type: 'container',
            label: `Sim-${containerCount + 1}`,
            x: selectedSwitch.x - 200, // 在交换机左侧放置
            y: selectedSwitch.y - 50,
            config: {
                ...DEFAULT_NODE_CONFIG.container,
                Image: TRAFFIC_SIMULATION_IMAGES.SURICATA,
                env: `ELASTICSEARCH_HOST=10.100.88.88,ELASTICSEARCH_PORT=9200,TZ=Asia/Shanghai,ZEEK_ENABLED=1,SYSDIG_ENABLED=1`
            }
        };

        const simulationContainer2: TopologyNode = {
            id: generateId('container'),
            type: 'container',
            label: `Sim-${containerCount + 2}`,
            x: selectedSwitch.x - 200, // 在交换机左侧放置
            y: selectedSwitch.y + 50,
            config: {
                ...DEFAULT_NODE_CONFIG.container,
                Image: TRAFFIC_SIMULATION_IMAGES.IPERF,
                env: `ELASTICSEARCH_HOST=10.100.88.88,ELASTICSEARCH_PORT=9200,TZ=Asia/Shanghai,ZEEK_ENABLED=1,SYSDIG_ENABLED=1`
            }
        };

        // 创建两个容器到交换机的连接
        const simulationEdge1: TopologyEdge = {
            id: generateId('edge'),
            source: simulationContainer1.id,
            target: switchId,
            config: {
                ...DEFAULT_EDGE_CONFIG,
                sourceInterface: '',
                targetInterface: '',
                sourceIp: '',
                targetIp: ''
            }
        };

        const simulationEdge2: TopologyEdge = {
            id: generateId('edge'),
            source: simulationContainer2.id,
            target: switchId,
            config: {
                ...DEFAULT_EDGE_CONFIG,
                sourceInterface: '',
                targetInterface: '',
                sourceIp: '',
                targetIp: ''
            }
        };

        // 添加两个容器节点
        const addContainer1Action: TopologyAction = { type: 'ADD_NODE', payload: { node: simulationContainer1 } };
        const addContainer2Action: TopologyAction = { type: 'ADD_NODE', payload: { node: simulationContainer2 } };
        dispatch(addContainer1Action);
        dispatch(addContainer2Action);
        onAddNode(simulationContainer1);
        onAddNode(simulationContainer2);
        pushToUndoStack(addContainer1Action);
        pushToUndoStack(addContainer2Action);

        // 添加两个连接边
        const addEdge1Action: TopologyAction = { type: 'ADD_EDGE', payload: { edge: simulationEdge1 } };
        const addEdge2Action: TopologyAction = { type: 'ADD_EDGE', payload: { edge: simulationEdge2 } };
        dispatch(addEdge1Action);
        dispatch(addEdge2Action);
        pushToUndoStack(addEdge1Action);
        pushToUndoStack(addEdge2Action);

        // 启用模拟功能并退出选择模式
        setSimulationEnabled(true);
        setIsSelectingSwitchForSimulation(false);
        setShouldResetSimulationDropdown(true);
    }, [nodes, dispatch, onAddNode, pushToUndoStack]);

    // 新增：获取可用交换机列表
    const availableSwitches = nodes.filter(node => node.type === 'switch').map(node => ({
        id: node.id,
        label: node.label
    }));

    // 重置下拉菜单状态的effect
    useEffect(() => {
        if (shouldResetSwitchDropdown) {
            setShouldResetSwitchDropdown(false);
        }
    }, [shouldResetSwitchDropdown]);

    useEffect(() => {
        if (shouldResetSimulationDropdown) {
            setShouldResetSimulationDropdown(false);
        }
    }, [shouldResetSimulationDropdown]);

    // 3. 原来的 handleSave 现在只负责打开弹窗
    const handleSave = () => {
        // 如果是实例模式，直接提交到实例更新接口；否则打开保存场景弹窗
        if (sceneInstanceId) {
            handleSaveInstanceTopology();
        } else {
            setIsSaveModalOpen(true);
        }
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
            ? `/back/api/scenarios/${scenarioId}`
            : '/back/api/scenarios';

        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await customFetch(url, {
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

    // 新增：实例模式下的直接保存逻辑（不弹窗）
    const handleSaveInstanceTopology = async () => {
        try {
            setIsSaving(true);
            const topologyData: TopologyData = { nodes, edges };
            const response = await customFetch(`/back/api/scenariosinstances/${sceneInstanceId}/scene-config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ topology: topologyData }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || `更新失败，状态码 ${response.status}`);
            }
            const result = await response.json().catch(() => ({}));
            alert(result.message || '实例拓扑已保存');
        } catch (e: any) {
            alert(`保存失败: ${e.message || e}`);
        } finally {
            setIsSaving(false);
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
                onSave={handleSave} // 在实例模式下直接保存并展示等待动画
                isSaving={isSaving}
                collectionOptions={collectionOptions}
                onToggleCollectionOption={handleToggleCollectionOption}
                simulationEnabled={simulationEnabled}
                onToggleSimulation={handleToggleSimulation}
                mirroringEnabled={mirroringEnabled}
                onToggleMirroring={handleToggleMirroring}
                // 新增：流量镜像相关props
                availableSwitches={availableSwitches}
                onSelectSwitchForMirroring={handleSelectSwitchForMirroring}
                isSelectingSwitchForMirroring={isSelectingSwitchForMirroring}
                shouldResetSwitchDropdown={shouldResetSwitchDropdown}
                // 新增：流量模拟相关props
                onSelectSwitchForSimulation={handleSelectSwitchForSimulation}
                isSelectingSwitchForSimulation={isSelectingSwitchForSimulation}
                shouldResetSimulationDropdown={shouldResetSimulationDropdown}
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
                allNodes={nodes} 
            />
            <VirtualMachineEditModal
                isOpen={isVMEditModalOpen}
                onClose={() => setIsVMEditModalOpen(false)}
                node={editingVMNode}
                onSave={saveVMChanges}
            />
            <EdgeEditModal
                isOpen={isEdgeEditModalOpen}
                onClose={() => setIsEdgeEditModalOpen(false)}
                edge={editingEdge}
                sourceNode={nodes.find(n => n.id === editingEdge?.source)}
                targetNode={nodes.find(n => n.id === editingEdge?.target)}
                onSave={saveEdgeChanges}
            />
            {/* 仅在模板保存模式下渲染保存弹窗；实例模式不使用弹窗 */}
            {!sceneInstanceId && (
                <>
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
                </>
            )}
            {/* 全局等待遮罩，防操作过多 */}
            <Backdrop open={isSaving} sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: '#fff' }}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400 italic p-4">
                说明：从工具栏拖动设备到画布创建节点。单击节点开始连接，再单击另一个节点完成连接。双击节点或连接进行编辑。
            </p>
        </Card>
    );
};

export default TopologyEditor;
