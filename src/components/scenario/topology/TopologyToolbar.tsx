"use client";
import React from 'react';
// 注意：这里的 Button 组件是您项目中的自定义 UI 组件
import Button from '../../ui/Button';
import { DeviceType } from '../../../types';
import { TOPOLOGY_DEVICE_TYPES } from '../../../constants';
// 图标库更新：移除了 ArrowDownTrayIcon 和 ArrowUpTrayIcon，增加了 DocumentCheckIcon
import {
  CubeIcon,
  ComputerDesktopIcon,
  LinkIcon,
  ServerStackIcon,
  ServerIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  DocumentCheckIcon // 新增：用于保存按钮的图标
} from '@heroicons/react/24/outline';

// 1. 更新组件的 Props 接口
interface TopologyToolbarProps {
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onSave: () => void; // 新增：保存功能的回调函数
  isSaving?: boolean; // 新增：保存中状态，用于禁用按钮/显示加载
}

const DeviceIcon: React.FC<{ type: DeviceType }> = ({ type }) => {
  const iconClass = "h-8 w-8";
  switch (type) {
    case 'container':
      return <CubeIcon className={`${iconClass} text-blue-500`} />;
    case 'switch':
      return <ServerStackIcon className={`${iconClass} text-teal-500`} />;
    case 'virtual_machine':
      return <ComputerDesktopIcon className={`${iconClass} text-purple-500`} />;
    case 'nat_bridge':
      return <LinkIcon className={`${iconClass} text-orange-500`} />;
    case 'router':
      return <ServerIcon className={`${iconClass} text-indigo-500`} />;
    default:
      return null;
  }
};

// 2. 更新组件的 Props 解构
const TopologyToolbar: React.FC<TopologyToolbarProps> = ({
                                                           onDeleteSelected,
                                                           onUndo,
                                                           canUndo,
                                                           onRedo,
                                                           canRedo,
                                                           onSave, // 新增
                                                           isSaving = false,
                                                         }) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, deviceType: DeviceType) => {
    event.dataTransfer.setData('application/reactflow', deviceType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // 4. 移除了导入功能相关的 ref 和处理函数
  // const importInputRef = React.useRef<HTMLInputElement>(null);
  // const handleImportClick = () => { ... };

  return (
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4 p-2">
          <div className="font-semibold text-neutral-700 dark:text-neutral-300">设备:</div>
          {TOPOLOGY_DEVICE_TYPES.map(device => (
              <div
                  key={device.type}
                  className="flex flex-col items-center p-3 border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-grab shadow-sm"
                  onDragStart={(event) => handleDragStart(event, device.type)}
                  draggable
                  title={`拖拽以添加 ${device.name}`}
              >
                <DeviceIcon type={device.type} />
                <span className="text-xs mt-1 text-neutral-600 dark:text-neutral-400">{device.name}</span>
              </div>
          ))}
          <div className="flex-grow"></div> {/* Spacer */}
          <div className="flex items-center gap-2">
            <Button onClick={onDeleteSelected} disabled={isSaving} variant="danger" size="sm" leftIcon={<TrashIcon className="h-4 w-4"/>} aria-label="删除选中">删除</Button>
            <Button onClick={onUndo} disabled={!canUndo || isSaving} variant="outline" size="sm" leftIcon={<ArrowUturnLeftIcon className="h-4 w-4"/>} aria-label="撤销">撤销</Button>
            <Button onClick={onRedo} disabled={!canRedo || isSaving} variant="outline" size="sm" leftIcon={<ArrowUturnRightIcon className="h-4 w-4"/>} aria-label="重做">重做</Button>

            {/* 3. 替换为“保存”按钮 */}
            <Button onClick={onSave} isLoading={isSaving} disabled={isSaving} variant="secondary" size="sm" leftIcon={<DocumentCheckIcon className="h-4 w-4"/>} aria-label="保存拓扑">{isSaving ? '保存中...' : '保存'}</Button>

            {/* 移除了原来的导出和导入按钮以及隐藏的 input 元素 */}
          </div>
        </div>
      </Card>
  );
};

const Card: React.FC<{children: React.ReactNode, title?: string, className?: string}> = ({children, title, className}) => (
    <div className={`bg-white dark:bg-neutral-800 shadow-md rounded-lg ${className}`}>
      {title && <h3 className="text-lg font-semibold p-4 border-b border-neutral-200 dark:border-neutral-700">{title}</h3>}
      {children}
    </div>
);


export default TopologyToolbar;
