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
  DocumentCheckIcon, // 新增：用于保存按钮的图标
  ClipboardDocumentListIcon,
  BeakerIcon,
  ArrowsRightLeftIcon,
  CheckIcon,
  ChevronDownIcon
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
  collectionOptions: {
    zeek: boolean;
    sysdig: boolean;
  };
  onToggleCollectionOption: (option: 'zeek' | 'sysdig') => void;
  simulationEnabled: boolean;
  onToggleSimulation: () => void;
  mirroringEnabled: boolean;
  onToggleMirroring: () => void;
  canOperateTopology: boolean;
  // 新增：流量镜像相关props
  availableSwitches: Array<{id: string, label: string}>; // 可选择的交换机列表
  onSelectSwitchForMirroring: (switchId: string) => void; // 选择交换机进行镜像的回调
  isSelectingSwitchForMirroring: boolean; // 是否正在选择交换机模式
  shouldResetSwitchDropdown?: boolean; // 是否应该重置下拉菜单状态
  // 新增：流量模拟相关props
  onSelectSwitchForSimulation: (switchId: string) => void; // 选择交换机进行模拟的回调
  isSelectingSwitchForSimulation: boolean; // 是否正在选择交换机模式
  shouldResetSimulationDropdown?: boolean; // 是否应该重置下拉菜单状态
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
                                                          collectionOptions,
                                                          onToggleCollectionOption,
                                                          simulationEnabled,
                                                          onToggleSimulation,
                                                          mirroringEnabled,
                                                          onToggleMirroring,
                                                          canOperateTopology,
                                                          // 新增：流量镜像相关props
                                                          availableSwitches,
                                                          onSelectSwitchForMirroring,
                                                          isSelectingSwitchForMirroring,
                                                          shouldResetSwitchDropdown = false,
                                                          // 新增：流量模拟相关props
                                                          onSelectSwitchForSimulation,
                                                          isSelectingSwitchForSimulation,
                                                          shouldResetSimulationDropdown = false,
                                                        }) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, deviceType: DeviceType) => {
    if (!canOperateTopology) return;
    event.dataTransfer.setData('application/reactflow', deviceType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // 下拉菜单状态管理
  const [isCollectionDropdownOpen, setIsCollectionDropdownOpen] = React.useState(false);
  const [isSwitchSelectionDropdownOpen, setIsSwitchSelectionDropdownOpen] = React.useState(false);
  const [isSimulationDropdownOpen, setIsSimulationDropdownOpen] = React.useState(false);
  const collectionDropdownRef = React.useRef<HTMLDivElement>(null);
  const switchSelectionDropdownRef = React.useRef<HTMLDivElement>(null);
  const simulationDropdownRef = React.useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (collectionDropdownRef.current && !collectionDropdownRef.current.contains(event.target as Node)) {
        setIsCollectionDropdownOpen(false);
      }
      if (switchSelectionDropdownRef.current && !switchSelectionDropdownRef.current.contains(event.target as Node)) {
        setIsSwitchSelectionDropdownOpen(false);
      }
      if (simulationDropdownRef.current && !simulationDropdownRef.current.contains(event.target as Node)) {
        setIsSimulationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 监听重置下拉菜单状态
  React.useEffect(() => {
    if (shouldResetSwitchDropdown) {
      setIsSwitchSelectionDropdownOpen(false);
    }
  }, [shouldResetSwitchDropdown]);

  React.useEffect(() => {
    if (shouldResetSimulationDropdown) {
      setIsSimulationDropdownOpen(false);
    }
  }, [shouldResetSimulationDropdown]);

  // 4. 移除了导入功能相关的 ref 和处理函数
  // const importInputRef = React.useRef<HTMLInputElement>(null);
  // const handleImportClick = () => { ... };

  return (
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4 p-2">
          <div className="font-semibold text-neutral-700 dark:text-neutral-300">设备:</div>
          {TOPOLOGY_DEVICE_TYPES.filter(device => device.type !== 'router').map(device => (
              <div
                  key={device.type}
                  className={`flex flex-col items-center p-3 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm ${canOperateTopology ? 'hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-grab active:cursor-grabbing' : 'bg-neutral-200 dark:bg-neutral-700 cursor-not-allowed opacity-60'}`}
                  onDragStart={(event) => handleDragStart(event, device.type)}
                  draggable={canOperateTopology}
                  title={`拖拽以添加 ${device.name}`}
              >
                <DeviceIcon type={device.type} />
                <span className="text-xs mt-1 text-neutral-600 dark:text-neutral-400">{device.name}</span>
              </div>
          ))}
          <div className="flex-grow"></div> {/* Spacer */}
          <div className="flex items-center gap-2">
            {/* 策略分组 */}
            <div className="flex items-center gap-2 pr-3 mr-2 border-r border-neutral-200 dark:border-neutral-700">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">策略:</span>
              
              {/* 流量采集下拉菜单 */}
              <div className="relative" ref={collectionDropdownRef}>
                <Button
                  onClick={() => {
                    if (!canOperateTopology) return;
                    setIsCollectionDropdownOpen(!isCollectionDropdownOpen);
                  }}
                  disabled={isSaving || !canOperateTopology}
                  variant={(collectionOptions.zeek || collectionOptions.sysdig) ? 'secondary' : 'outline'}
                  size="sm"
                  leftIcon={<ClipboardDocumentListIcon className="h-4 w-4"/>}
                  rightIcon={<ChevronDownIcon className="h-4 w-4"/>}
                  aria-label="采集策略"
                  title="采集策略"
                >
                  <span className="flex items-center gap-1">
                    流量采集 
                    {(collectionOptions.zeek || collectionOptions.sysdig) && <CheckIcon className="h-4 w-4"/>}
                  </span>
                </Button>
                
                {/* 下拉菜单内容 */}
                {isCollectionDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md shadow-lg z-50">
                    <div className="py-1">
                      <div
                    className="flex items-center px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                        onClick={() => {
                          if (!canOperateTopology) return;
                          onToggleCollectionOption('zeek');
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="checkbox"
                            checked={collectionOptions.zeek}
                            onChange={() => onToggleCollectionOption('zeek')}
                            className="rounded border-neutral-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500"
                            disabled={!canOperateTopology}
                          />
                          <span>ZEEK</span>
                        </div>
                      </div>
                      <div
                    className="flex items-center px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                        onClick={() => {
                          if (!canOperateTopology) return;
                          onToggleCollectionOption('sysdig');
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="checkbox"
                            checked={collectionOptions.sysdig}
                            onChange={() => onToggleCollectionOption('sysdig')}
                            className="rounded border-neutral-300 dark:border-neutral-600 text-blue-600 focus:ring-blue-500"
                            disabled={!canOperateTopology}
                          />
                          <span>SYSDIG</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* 流量模拟按钮 - 支持交换机选择 */}
              <div className="relative" ref={simulationDropdownRef}>
                <Button
                  onClick={() => {
                    if (!canOperateTopology) return;
                    if (isSelectingSwitchForSimulation) {
                      setIsSimulationDropdownOpen(!isSimulationDropdownOpen);
                    } else {
                      onToggleSimulation();
                      // 当进入选择模式时，自动显示下拉菜单
                      setTimeout(() => {
                        setIsSimulationDropdownOpen(true);
                      }, 0);
                    }
                  }}
                  disabled={isSaving || !canOperateTopology}
                  variant={simulationEnabled ? 'secondary' : 'outline'}
                  size="sm"
                  leftIcon={<BeakerIcon className="h-4 w-4"/>}
                  rightIcon={isSelectingSwitchForSimulation ? <ChevronDownIcon className="h-4 w-4"/> : undefined}
                  aria-label="流量模拟策略"
                  title="流量模拟策略"
                >
                  <span className="flex items-center gap-1">
                    流量模拟 
                    {simulationEnabled && <CheckIcon className="h-4 w-4"/>}
                  </span>
                </Button>
                
                {/* 交换机选择下拉菜单 */}
                {isSelectingSwitchForSimulation && isSimulationDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md shadow-lg z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-600">
                        选择交换机进行模拟
                      </div>
                      {availableSwitches.length > 0 ? (
                        availableSwitches.map(switchItem => (
                          <div
                            key={switchItem.id}
                            className="flex items-center px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            onClick={() => {
                              onSelectSwitchForSimulation(switchItem.id);
                              setIsSimulationDropdownOpen(false);
                            }}
                          >
                            <ServerStackIcon className="h-4 w-4 mr-2 text-teal-500" />
                            <span>{switchItem.label}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                          暂无可用交换机
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* 流量镜像按钮 - 支持交换机选择 */}
              <div className="relative" ref={switchSelectionDropdownRef}>
                <Button
                  onClick={() => {
                    if (!canOperateTopology) return;
                    if (isSelectingSwitchForMirroring) {
                      setIsSwitchSelectionDropdownOpen(!isSwitchSelectionDropdownOpen);
                    } else {
                      onToggleMirroring();
                      // 当进入选择模式时，自动显示下拉菜单
                      setTimeout(() => {
                        setIsSwitchSelectionDropdownOpen(true);
                      }, 0);
                    }
                  }}
                  disabled={isSaving || !canOperateTopology}
                  variant={mirroringEnabled ? 'secondary' : 'outline'}
                  size="sm"
                  leftIcon={<ArrowsRightLeftIcon className="h-4 w-4"/>}
                  rightIcon={isSelectingSwitchForMirroring ? <ChevronDownIcon className="h-4 w-4"/> : undefined}
                  aria-label="流量镜像策略"
                  title="流量镜像策略"
                >
                  <span className="flex items-center gap-1">
                    流量镜像 
                    {mirroringEnabled && <CheckIcon className="h-4 w-4"/>}
                  </span>
                </Button>
                
                {/* 交换机选择下拉菜单 */}
                {isSelectingSwitchForMirroring && isSwitchSelectionDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md shadow-lg z-50">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-600">
                        选择交换机进行镜像
                      </div>
                      {availableSwitches.length > 0 ? (
                        availableSwitches.map(switchItem => (
                          <div
                            key={switchItem.id}
                            className="flex items-center px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
                            onClick={() => {
                              onSelectSwitchForMirroring(switchItem.id);
                              setIsSwitchSelectionDropdownOpen(false);
                            }}
                          >
                            <ServerStackIcon className="h-4 w-4 mr-2 text-teal-500" />
                            <span>{switchItem.label}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                          暂无可用交换机
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={onDeleteSelected} disabled={isSaving || !canOperateTopology} variant="danger" size="sm" leftIcon={<TrashIcon className="h-4 w-4"/>} aria-label="删除选中">删除</Button>
            <Button onClick={onUndo} disabled={!canUndo || isSaving || !canOperateTopology} variant="outline" size="sm" leftIcon={<ArrowUturnLeftIcon className="h-4 w-4"/>} aria-label="撤销">撤销</Button>
            <Button onClick={onRedo} disabled={!canRedo || isSaving || !canOperateTopology} variant="outline" size="sm" leftIcon={<ArrowUturnRightIcon className="h-4 w-4"/>} aria-label="重做">重做</Button>

            {/* 3. 替换为“保存”按钮 */}
            <Button onClick={onSave} isLoading={isSaving} disabled={isSaving || !canOperateTopology} variant="secondary" size="sm" leftIcon={<DocumentCheckIcon className="h-4 w-4"/>} aria-label="保存拓扑">{isSaving ? '保存中...' : '保存'}</Button>

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
