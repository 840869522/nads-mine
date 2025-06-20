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
  Typography,
  Box
} from '@mui/material';
import Card from '@/components/ui/Card';
import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
import { RunningInstance, InstanceStatus, TopologyNode } from '@/types';

// Icons for types
import ComputerIcon from '@mui/icons-material/Computer';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LinkIcon from '@mui/icons-material/Link';
import RouterIcon from '@mui/icons-material/Router';
import DnsIcon from '@mui/icons-material/Dns'; // Using Dns as a proxy for Switch

// This helper function remains unchanged.
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
  // This state holds the list of instances for the table below the editor.
  // It is synchronized with the editor via the callback props.
  const [instances, setInstances] = useState<RunningInstance[]>([]);

  // This function is passed to TopologyEditor.
  // When a node is added inside the editor, it calls this function to notify the ScenarioPage.
  // The page then updates its own `instances` state to keep the list in sync.
  const handleAddNode = useCallback((node: TopologyNode) => {
    const { type, id, label, config } = node;
    let instanceType: string;
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
        status = 'running';
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

    const newInstance: RunningInstance = {
      id: `inst-${id}`,
      name: label,
      type: instanceType,
      status: status,
      ports: config.portMappings || '-',
      imageName: config.dockerImage,
      cpuUsage: isComputeResource ? '0%' : '-',
      memoryUsage: isComputeResource ? '0MB / 1GB' : '-',
      diskUsage: isComputeResource ? '0GB / 20GB' : '-',
      uptime: '0s',
      nodeId: id,
      createdAt: new Date().toISOString(),
    };
    setInstances(prev => [...prev, newInstance]);
  }, []);

  // This callback is passed to the editor to handle node deletions.
  const handleDeleteNode = useCallback((nodeId: string) => {
    setInstances(prev => prev.filter(inst => inst.nodeId !== nodeId));
  }, []);

  // This callback is passed to the editor to handle updates to a node's configuration.
  const handleUpdateNode = useCallback((node: TopologyNode) => {
    setInstances(prev => prev.map(inst => {
      if (inst.nodeId === node.id) {
        return {
          ...inst,
          name: node.label,
          imageName: node.config.dockerImage,
          ports: node.config.portMappings || '-',
        };
      }
      return inst;
    }));
  }, []);

  // The rendering logic is correct.
  // It displays a title and then the self-contained TopologyEditor component.
  return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <Typography variant="h4" component="h1" fontWeight="bold">
            场景配置
          </Typography>
        </div>

        {/* The TopologyEditor is now a "smart" component that handles its own state and actions
          (like saving, undo, redo). This parent page (`ScenarioPage`) only needs to provide
          the callback functions to keep its own instance list in sync with the editor.
          This is a clean and effective architecture.
        */}
        <TopologyEditor
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onUpdateNode={handleUpdateNode}
        />

        {/* This table correctly displays the data from the `instances` state,
          which is kept up-to-date by the callbacks above.
        */}
        <Card title="场景内所有设备列表" className="my-8">
          <TableContainer component={Paper}>
            <Table aria-label="instances table">
              <TableHead>
                <TableRow>
                  <TableCell>名称</TableCell>
                  <TableCell>类型</TableCell>
                  <TableCell>IP 地址 / 映射</TableCell>
                  <TableCell>镜像</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="text.secondary" sx={{ p: 3 }}>
                          暂无设备。请在上面的拓扑编辑器中添加设备。
                        </Typography>
                      </TableCell>
                    </TableRow>
                ) : (
                    instances.map((instance) => (
                        <TableRow key={instance.id} hover>
                          <TableCell>{instance.name}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {getTypeIcon(instance.type)}
                              {instance.type}
                            </Box>
                          </TableCell>
                          <TableCell>{instance.ports}</TableCell>
                          <TableCell>{instance.imageName || '-'}</TableCell>
                        </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </div>
  );
};

export default ScenarioPage;
