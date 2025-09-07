
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { TopologyNode, TopologyEdge, DeviceType } from '../../../types';
import { NODE_SIZE, NODE_ICON_SIZE } from '../../../constants';
import { 
  CubeIcon, 
  ComputerDesktopIcon, 
  LinkIcon, 
  ServerStackIcon, // Added for Switch
  ServerIcon     // Added for Router
} from '@heroicons/react/24/solid'; // Using solid for canvas icons

const DRAG_THRESHOLD = 5; // Pixels threshold to differentiate click from drag
const EDGE_TEXT_OFFSET = 10; // Pixels to offset text from the edge line
const EDGE_TEXT_FONT_SIZE = 10;

interface TopologyCanvasProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  selectedElement: { id: string; type: 'node' | 'edge' } | null;
  onNodeSelect: (nodeId: string | null, event: React.MouseEvent) => void;
  onEdgeSelect: (edgeId: string | null, event: React.MouseEvent) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onEdgeDoubleClick: (edgeId: string) => void;
  onCanvasClick: (event: React.MouseEvent) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeMoveCommit: (nodeId: string, x: number, y: number) => void;
  linkingState: { startNodeId: string } | null;
}

const NodeIcon: React.FC<{ type: DeviceType, x: number, y: number, size: number }> = ({ type, x, y, size }) => {
  const iconProps = {
    x: x - size / 2,
    y: y - size / 2,
    width: size,
    height: size,
  };
  switch (type) {
    case 'container':
      return <CubeIcon {...iconProps} className="fill-blue-500" />;
    case 'switch':
      return <ServerStackIcon {...iconProps} className="fill-teal-500" />; // Changed from RectangleGroupIcon
    case 'virtual_machine':
      return <ComputerDesktopIcon {...iconProps} className="fill-purple-500" />;
    case 'nat_bridge':
      return <LinkIcon {...iconProps} className="fill-orange-500" />;
    case 'router':
      return <ServerIcon {...iconProps} className="fill-indigo-500" />; // Changed from ServerIcon
    default:
      return <circle cx={x} cy={y} r={size / 2} className="fill-neutral-400" />;
  }
};


const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  edges,
  selectedElement,
  onNodeSelect,
  onEdgeSelect,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onCanvasClick,
  onNodeMove,
  onNodeMoveCommit,
  linkingState,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingNodeInfo, setDraggingNodeInfo] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    initialScreenX: number;
    initialScreenY: number;
  } | null>(null);

  const [isDraggingInternally, setIsDraggingInternally] = useState(false);

  const getSVGCoordinates = useCallback((event: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const { x, y } = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x, y };
  }, []);

  const handleNodeMouseDown = (event: React.MouseEvent, nodeId: string) => {
    event.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const { x: svgX, y: svgY } = getSVGCoordinates(event);
      setDraggingNodeInfo({
        id: nodeId,
        offsetX: svgX - node.x,
        offsetY: svgY - node.y,
        initialScreenX: event.clientX,
        initialScreenY: event.clientY,
      });
      setIsDraggingInternally(false);
    }
  };

  const handleGlobalMouseMove = useCallback((event: MouseEvent) => {
    if (!draggingNodeInfo || !svgRef.current) return;
    event.preventDefault();

    if (!isDraggingInternally) {
      const dx = Math.abs(event.clientX - draggingNodeInfo.initialScreenX);
      const dy = Math.abs(event.clientY - draggingNodeInfo.initialScreenY);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        setIsDraggingInternally(true);
        if (linkingState) {
            onCanvasClick(event as any);
        }
      }
    }

    if (isDraggingInternally) {
        const { x: svgX, y: svgY } = getSVGCoordinates(event);
        const newX = svgX - draggingNodeInfo.offsetX;
        const newY = svgY - draggingNodeInfo.offsetY;
        onNodeMove(draggingNodeInfo.id, newX, newY);
    }
  }, [draggingNodeInfo, isDraggingInternally, getSVGCoordinates, onNodeMove, onCanvasClick, linkingState]);

  const handleGlobalMouseUp = useCallback((event: MouseEvent) => {
    if (draggingNodeInfo) {
      if (isDraggingInternally) {
        const draggedNode = nodes.find(n => n.id === draggingNodeInfo.id);
        if (draggedNode) {
          onNodeMoveCommit(draggingNodeInfo.id, draggedNode.x, draggedNode.y);
        }
      }
      setDraggingNodeInfo(null);
      setIsDraggingInternally(false);
    }

    if (event.target === svgRef.current && !isDraggingInternally && !draggingNodeInfo) {
       onCanvasClick(event as any);
    }

  }, [draggingNodeInfo, isDraggingInternally, nodes, onNodeMoveCommit, onCanvasClick]);


  useEffect(() => {
    if (draggingNodeInfo) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingNodeInfo, handleGlobalMouseMove, handleGlobalMouseUp]);


  const handleNodeClick = (event: React.MouseEvent, nodeId: string) => {
    event.stopPropagation();
    if (isDraggingInternally) {
      return;
    }
    if (!draggingNodeInfo) {
        onNodeSelect(nodeId, event);
    }
  };

  const handleEdgeClick = (event: React.MouseEvent, edgeId: string) => {
    event.stopPropagation();
    if (isDraggingInternally) return;
    onEdgeSelect(edgeId, event);
  };

  return (
    <div
        className="w-full h-[600px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-md overflow-hidden relative shadow-inner"
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onClick={(e) => {
            if (e.target === svgRef.current && !isDraggingInternally) onCanvasClick(e);
        }}
        className="cursor-default select-none"
      >
        <defs>
          <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(var(--color-neutral-300-rgb, 200,200,200),0.2)" strokeWidth="0.5"/>
          </pattern>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#smallGrid)"/>
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(var(--color-neutral-300-rgb, 200,200,200),0.3)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {edges.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;
          // 安全过滤：仅渲染“至少一端为交换机”的边
          const edgeAllowed = sourceNode.type === 'switch' || targetNode.type === 'switch';
          if (!edgeAllowed) return null;

          const isSelected = selectedElement?.type === 'edge' && selectedElement.id === edge.id;

          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;

          const radAngle = Math.atan2(dy, dx);
          const sourceTextX = midX + Math.sin(radAngle) * EDGE_TEXT_OFFSET;
          const sourceTextY = midY - Math.cos(radAngle) * EDGE_TEXT_OFFSET;
          const targetTextX = midX - Math.sin(radAngle) * EDGE_TEXT_OFFSET;
          const targetTextY = midY + Math.cos(radAngle) * EDGE_TEXT_OFFSET;
          
          const sourceLabel = `${edge.config.sourceInterface ?? ''} ${edge.config.sourceIp ?? ''}`;
          const targetLabel = `${edge.config.targetInterface ?? ''} ${edge.config.targetIp ?? ''}`;

          let displayAngle = angle;
          if (angle > 90 || angle < -90) {
            displayAngle = angle + 180;
          }

          return (
            <g key={edge.id}>
              <line
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isSelected ? 'var(--color-primary-500, #3b82f6)' : 'var(--color-neutral-400, #a3a3a3)'}
                strokeWidth={isSelected ? 3 : 2}
                onClick={(e) => handleEdgeClick(e, edge.id)}
                onDoubleClick={(e) => { e.stopPropagation(); if (!isDraggingInternally) onEdgeDoubleClick(edge.id); }}
                className="cursor-pointer"
              />
              <text
                x={sourceTextX}
                y={sourceTextY}
                transform={`rotate(${displayAngle} ${sourceTextX} ${sourceTextY})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={EDGE_TEXT_FONT_SIZE}
                className="fill-neutral-700 dark:fill-neutral-300 pointer-events-none select-none"
              >
                {sourceLabel}
              </text>
              <text
                x={targetTextX}
                y={targetTextY}
                transform={`rotate(${displayAngle} ${targetTextX} ${targetTextY})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={EDGE_TEXT_FONT_SIZE}
                className="fill-neutral-700 dark:fill-neutral-300 pointer-events-none select-none"
              >
                {targetLabel}
              </text>
            </g>
          );
        })}

        {nodes.map(node => {
          const isSelected = selectedElement?.type === 'node' && selectedElement.id === node.id;
          const isLinkingStart = linkingState?.startNodeId === node.id;
          const fillLinking = "rgba(59, 130, 246, 0.3)";
          const fillSelected = "rgba(59, 130, 246, 0.2)";
          const fillBase = "rgba(115, 115, 115, 0.1)";

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onClick={(e) => handleNodeClick(e, node.id)}
              onDoubleClick={(e) => { e.stopPropagation(); if (!isDraggingInternally) onNodeDoubleClick(node.id); }}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle
                cx="0"
                cy="0"
                r={NODE_SIZE / 2 + (isSelected || isLinkingStart ? 4 : 0)}
                fill={ isLinkingStart ? fillLinking : (isSelected ? fillSelected : fillBase)}
                stroke={ isLinkingStart || isSelected ? 'var(--color-primary-500, #3b82f6)' : 'var(--color-neutral-400, #a3a3a3)'}
                strokeWidth={isSelected || isLinkingStart ? 2 : 1}
              />
               <circle
                cx="0"
                cy="0"
                r={NODE_SIZE / 2 -2}
                className="fill-white dark:fill-neutral-700"
              />
              <NodeIcon type={node.type} x={0} y={0} size={NODE_ICON_SIZE} />
              <text
                x="0"
                y={NODE_SIZE / 2 + 15}
                textAnchor="middle"
                fontSize="12"
                className="fill-neutral-700 dark:fill-neutral-200 pointer-events-none select-none"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default TopologyCanvas;
