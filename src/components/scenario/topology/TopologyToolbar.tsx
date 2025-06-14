
import React from 'react';
import Button from '../../ui/Button';
import { DeviceType } from '../../../types';
import { TOPOLOGY_DEVICE_TYPES } from '../../../constants';
import { 
  CubeIcon, 
  ComputerDesktopIcon, 
  LinkIcon, 
  ServerStackIcon, // Added for Switch
  ServerIcon,    // Added for Router
  TrashIcon, 
  ArrowUturnLeftIcon, 
  ArrowUturnRightIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon 
} from '@heroicons/react/24/outline';

interface TopologyToolbarProps {
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const DeviceIcon: React.FC<{ type: DeviceType }> = ({ type }) => {
  const iconClass = "h-8 w-8";
  switch (type) {
    case 'container':
      return <CubeIcon className={`${iconClass} text-blue-500`} />;
    case 'switch':
      return <ServerStackIcon className={`${iconClass} text-teal-500`} />; // Changed from RectangleGroupIcon
    case 'virtual_machine':
      return <ComputerDesktopIcon className={`${iconClass} text-purple-500`} />;
    case 'nat_bridge':
      return <LinkIcon className={`${iconClass} text-orange-500`} />;
    case 'router':
      return <ServerIcon className={`${iconClass} text-indigo-500`} />; // Changed from ServerIcon
    default:
      return null;
  }
};

const TopologyToolbar: React.FC<TopologyToolbarProps> = ({
  onDeleteSelected,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onExport,
  onImport
}) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, deviceType: DeviceType) => {
    event.dataTransfer.setData('application/reactflow', deviceType);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  return (
    <Card className="mb-4"> {/* Removed title="工具栏" prop */}
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
          <Button onClick={onDeleteSelected} variant="danger" size="sm" leftIcon={<TrashIcon className="h-4 w-4"/>} aria-label="删除选中">删除</Button>
          <Button onClick={onUndo} disabled={!canUndo} variant="outline" size="sm" leftIcon={<ArrowUturnLeftIcon className="h-4 w-4"/>} aria-label="撤销">撤销</Button>
          <Button onClick={onRedo} disabled={!canRedo} variant="outline" size="sm" leftIcon={<ArrowUturnRightIcon className="h-4 w-4"/>} aria-label="重做">重做</Button>
          <Button onClick={onExport} variant="secondary" size="sm" leftIcon={<ArrowDownTrayIcon className="h-4 w-4"/>} aria-label="导出拓扑">导出</Button>
          <Button onClick={handleImportClick} variant="secondary" size="sm" leftIcon={<ArrowUpTrayIcon className="h-4 w-4"/>} aria-label="导入拓扑">导入</Button>
          <input type="file" ref={importInputRef} onChange={onImport} accept=".json" style={{ display: 'none' }} />
        </div>
      </div>
    </Card>
  );
};

// Minimal Card component stub for standalone toolbar usage (if needed, otherwise parent provides)
// This local Card definition is intentionally kept to maintain existing padding and structure for the toolbar items,
// as per the minimal change request. Removing the 'title' prop ensures its header is not rendered.
const Card: React.FC<{children: React.ReactNode, title?: string, className?: string}> = ({children, title, className}) => (
    <div className={`bg-white dark:bg-neutral-800 shadow-md rounded-lg ${className}`}>
        {title && <h3 className="text-lg font-semibold p-4 border-b border-neutral-200 dark:border-neutral-700">{title}</h3>}
        {children}
    </div>
);


export default TopologyToolbar;