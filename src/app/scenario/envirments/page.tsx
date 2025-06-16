"use client";
import React, { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  IconButton,
  Tooltip,
  Box
} from '@mui/material';
import {
  STATUS_TRANSLATIONS
} from '@/constants';
import Card from '@/components/ui/Card';
import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
import { RunningInstance, InstanceStatus, TopologyNode, DeviceType } from '@/types';
import InstanceDetailsModal from '@/components/scenario/InstanceDetailsModal';
import ConfirmActionDialog from '@/components/scenario/ConfirmActionDialog';

// Icons for actions & types
import InfoIcon from '@mui/icons-material/Info';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import ComputerIcon from '@mui/icons-material/Computer';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LinkIcon from '@mui/icons-material/Link';
import RouterIcon from '@mui/icons-material/Router';
import DnsIcon from '@mui/icons-material/Dns'; // Using Dns as a proxy for Switch


const getStatusChipColor = (status: InstanceStatus): "success" | "warning" | "error" | "info" | "default" => {
  switch (status) {
    case 'running': return 'success';
    case 'starting':
    case 'stopping':
    case 'deleting':
      return 'warning';
    case 'stopped': return 'default';
    case 'error': return 'error';
    default: return 'info';
  }
};

// The getTypeIcon function is now correct and will not cause a crash.
const getTypeIcon = (type: string) => {
  const iconProps = { sx: { verticalAlign: 'middle', mr: 0.5 }, fontSize: "small" as "small" };
  switch (type) {
    case '虚拟机': return <ComputerIcon {...iconProps} />;
    case '容器': return <ViewInArIcon {...iconProps} />;
    case '交换机': return <DnsIcon {...iconProps} />;
    case '路由器': return <RouterIcon {...iconProps} />;
    case 'NAT网桥': return <LinkIcon {...iconProps} />;
    default: return null;
  }
};

const ScenarioPage: React.FC = () => {
  const [instances, setInstances] = useState<RunningInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<RunningInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmActionProps, setConfirmActionProps] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleAddNode = useCallback((node: TopologyNode) => {
    const { type, id, label, config } = node;
    let instanceType: string;
    let cpuUsage = '0%';
    let memoryUsage = '0MB / 1GB';
    let status: InstanceStatus = 'stopped';
    let isComputeResource = false;

    switch (type) {
      case 'virtual_machine':
        instanceType = '虚拟机';
        isComputeResource = true;
        break;
      case 'container':
        instanceType = '容器';
        isComputeResource = true;
        break;
      case 'switch':
        instanceType = '交换机';
        status = 'running'; // Network devices are 'running' by default
        break;
      case 'router':
        instanceType = '路由器';
        status = 'running';
        break;
      case 'nat_bridge':
        instanceType = 'NAT网桥';
        status = 'running';
        break;
      default:
        instanceType = '未知设备';
    }

    if (!isComputeResource) {
      cpuUsage = '-';
      memoryUsage = '-';
    }

    const newInstance: RunningInstance = {
      id: `inst-${id}`,
      name: label,
      type: instanceType,
      status: status,
      ports: config.portMappings || '-',
      imageName: config.dockerImage,
      cpuUsage,
      memoryUsage,
      diskUsage: isComputeResource ? '0GB / 20GB' : '-',
      uptime: '0s',
      nodeId: id,
      createdAt: new Date().toISOString(),
    };
    setInstances(prev => [...prev, newInstance]);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setInstances(prev => prev.filter(inst => inst.nodeId !== nodeId));
  }, []);

  const handleUpdateNode = useCallback((node: TopologyNode) => {
    setInstances(prev => prev.map(inst => {
      if (inst.nodeId === node.id) {
        return {
          ...inst,
          name: node.label,
          imageName: node.config.dockerImage,
        };
      }
      return inst;
    }));
  }, []);

  const handleOpenDetailsModal = (instance: RunningInstance) => {
    setSelectedInstance(instance);
    setIsModalOpen(true);
  };

  const simulateAction = (instanceId: string, targetStatus: InstanceStatus, intermediateStatus?: InstanceStatus, delay: number = 1500) => {
    if (intermediateStatus) {
      setInstances(prev => prev.map(inst => inst.id === instanceId ? { ...inst, status: intermediateStatus } : inst));
    }
    setTimeout(() => {
      setInstances(prev => prev.map(inst => inst.id === instanceId ? { ...inst, status: targetStatus } : inst));
    }, intermediateStatus ? delay : 0);
  };

  const handleAction = (instance: RunningInstance, action: 'start' | 'stop' | 'restart' | 'delete') => {
    let title = '', message = '', onConfirm = () => {
    };

    switch (action) {
      case 'start':
        title = `启动实例: ${instance.name}`;
        message = `您确定要启动实例 "${instance.name}" 吗？`;
        onConfirm = () => simulateAction(instance.id, 'running', 'starting');
        break;
      case 'stop':
        title = `停止实例: ${instance.name}`;
        message = `您确定要停止实例 "${instance.name}" 吗？`;
        onConfirm = () => simulateAction(instance.id, 'stopped', 'stopping');
        break;
      case 'restart':
        title = `重启实例: ${instance.name}`;
        message = `您确定要重启实例 "${instance.name}" 吗？该操作会先停止再启动实例。`;
        onConfirm = () => {
          simulateAction(instance.id, 'starting', 'stopping', 1500);
          setTimeout(() => simulateAction(instance.id, 'running'), 3000);
        };
        break;
      case 'delete':
        title = `删除实例: ${instance.name}`;
        message = `此操作将仅从此列表中移除实例，您需要从拓扑编辑器中删除实际节点。要继续吗？`;
        onConfirm = () => {
          setInstances(prev => prev.filter(inst => inst.id !== instance.id));
        };
        break;
    }

    setConfirmActionProps({ title, message, onConfirm });
    setIsConfirmDialogOpen(true);
  }

  return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <Typography variant="h4" component="h1" fontWeight="bold">
            场景配置
          </Typography>
        </div>

        {/* Network Topology Editor Section */}
        <TopologyEditor
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onUpdateNode={handleUpdateNode}
        />

        {/* Instance List Section */}
        <Card title="场景内所有设备列表" className="my-8">
          <TableContainer component={Paper}>
            <Table aria-label="instances table">
              <TableHead>
                <TableRow>
                  <TableCell>名称</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>IP 地址 / 映射</TableCell>
                  <TableCell>镜像</TableCell>
                  <TableCell>CPU</TableCell>
                  <TableCell>内存</TableCell>
                  <TableCell>运行时间</TableCell>
                  <TableCell>创建于</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        <Typography color="text.secondary" sx={{ p: 3 }}>
                          暂无设备。请在上面的拓扑编辑器中添加设备。
                        </Typography>
                      </TableCell>
                    </TableRow>
                ) : (
                    instances.map((instance) => {
                      const isActionable = !['starting', 'stopping', 'deleting'].includes(instance.status);
                      const isCompute = instance.type === '虚拟机' || instance.type === '容器';

                      return (
                          <TableRow key={instance.id} hover>
                            <TableCell>{instance.name}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {getTypeIcon(instance.type)}
                                {instance.type}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                  label={STATUS_TRANSLATIONS[instance.status] || instance.status}
                                  color={getStatusChipColor(instance.status)}
                                  size="small"
                              />
                            </TableCell>
                            <TableCell>{instance.ports}</TableCell>
                            <TableCell>{instance.imageName}</TableCell>
                            <TableCell>{instance.cpuUsage}</TableCell>
                            <TableCell>{instance.memoryUsage}</TableCell>
                            <TableCell>{instance.uptime}</TableCell>
                            <TableCell>{new Date(instance.createdAt).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric'
                            })}</TableCell>
                            <TableCell align="center">
                              <Tooltip title="详情">
                                <IconButton onClick={() => handleOpenDetailsModal(instance)}
                                            size="small">
                                  <InfoIcon fontSize="small"/>
                                </IconButton>
                              </Tooltip>
                              {isCompute && instance.status === 'running' && (
                                  <>
                                    <Tooltip title="停止">
                                                            <span>
                                                                <IconButton
                                                                    onClick={() => handleAction(instance, 'stop')}
                                                                    size="small" disabled={!isActionable}>
                                                                    <StopIcon fontSize="small"
                                                                              color={isActionable ? "error" : "disabled"}/>
                                                                </IconButton>
                                                            </span>
                                    </Tooltip>
                                    <Tooltip title="重启">
                                                            <span>
                                                                <IconButton
                                                                    onClick={() => handleAction(instance, 'restart')}
                                                                    size="small" disabled={!isActionable}>
                                                                    <RestartAltIcon fontSize="small"
                                                                                    color={isActionable ? "primary" : "disabled"}/>
                                                                </IconButton>
                                                            </span>
                                    </Tooltip>
                                  </>
                              )}
                              {isCompute && instance.status === 'stopped' && (
                                  <Tooltip title="启动">
                                                        <span>
                                                            <IconButton
                                                                onClick={() => handleAction(instance, 'start')}
                                                                size="small" disabled={!isActionable}>
                                                                <PlayArrowIcon fontSize="small"
                                                                               color={isActionable ? "success" : "disabled"}/>
                                                            </IconButton>
                                                        </span>
                                  </Tooltip>
                              )}
                              {isCompute && (instance.status === 'stopped' || instance.status === 'error') && (
                                  <Tooltip title="删除 (仅列表)">
                                                        <span>
                                                            <IconButton
                                                                onClick={() => handleAction(instance, 'delete')}
                                                                size="small" disabled={!isActionable}>
                                                                <DeleteIcon fontSize="small"
                                                                            color={isActionable ? "error" : "disabled"}/>
                                                            </IconButton>
                                                        </span>
                                  </Tooltip>
                              )}
                            </TableCell>
                          </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {selectedInstance && (
            <InstanceDetailsModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                instance={selectedInstance}
            />
        )}

        {confirmActionProps && (
            <ConfirmActionDialog
                open={isConfirmDialogOpen}
                onClose={() => setIsConfirmDialogOpen(false)}
                title={confirmActionProps.title}
                message={confirmActionProps.message}
                onConfirm={() => {
                  confirmActionProps.onConfirm();
                  setIsConfirmDialogOpen(false);
                }}
            />
        )}
      </div>
  );
};

export default ScenarioPage;
