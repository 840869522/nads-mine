//
// "use client";
// import React, { useState, useCallback } from 'react';
// import {
//   // 移除了 Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
//   Typography
// } from '@mui/material';
// // 移除了 Card 组件的导入
// import TopologyEditor from '@/components/scenario/topology/TopologyEditor';
// import { RunningInstance, InstanceStatus, TopologyNode } from '@/types';
//
// // 因为不再显示列表，图标和 getTypeIcon 函数可以被安全地移除
// /*
// import ComputerIcon from '@mui/icons-material/Computer';
// // ... 其他图标
// const getTypeIcon = (type: string) => { ... };
// */
//
// const ScenarioPage: React.FC = () => {
//   // 【保留】这个 state 仍然保留，因为 handleAddNode 等函数会更新它，
//   // 而 TopologyEditor 组件需要这些函数作为 props。
//   const [_instances, setInstances] = useState<RunningInstance[]>([]);
//
//   // 【保留】所有这些回调函数都保持不变，以确保 TopologyEditor 不会报错
//   const handleAddNode = useCallback((node: TopologyNode) => {
//     const { type, id, label, config } = node;
//     let instanceType: string;
//     let status: InstanceStatus = 'stopped';
//     let isComputeResource = false;
//
//     switch (type) {
//       case 'virtual_machine':
//         instanceType = '虚拟机';
//         isComputeResource = true;
//         break;
//       case 'container':
//         instanceType = '容器';
//         isComputeResource = true;
//         break;
//       case 'switch':
//         instanceType = '交换机';
//         status = 'running';
//         break;
//       case 'router':
//         instanceType = '路由器';
//         status = 'running';
//         break;
//       case 'nat_bridge':
//         instanceType = 'NAT网桥';
//         status = 'running';
//         break;
//       default:
//         instanceType = '未知设备';
//     }
//
//     const newInstance: RunningInstance = {
//       id: `inst-${id}`,
//       name: label,
//       type: instanceType,
//       status: status,
//       ports: config.portMappings || '-',
//       imageName: config.dockerImage,
//       cpuUsage: isComputeResource ? '0%' : '-',
//       memoryUsage: isComputeResource ? '0MB / 1GB' : '-',
//       diskUsage: isComputeResource ? '0GB / 20GB' : '-',
//       uptime: '0s',
//       nodeId: id,
//       createdAt: new Date().toISOString(),
//     };
//     setInstances(prev => [...prev, newInstance]);
//   }, []);
//
//   const handleDeleteNode = useCallback((nodeId: string) => {
//     setInstances(prev => prev.filter(inst => inst.nodeId !== nodeId));
//   }, []);
//
//   const handleUpdateNode = useCallback((node: TopologyNode) => {
//     setInstances(prev => prev.map(inst => {
//       if (inst.nodeId === node.id) {
//         return {
//           ...inst,
//           name: node.label,
//           imageName: node.config.dockerImage,
//           ports: node.config.portMappings || '-',
//         };
//       }
//       return inst;
//     }));
//   }, []);
//
//
//   return (
//       <div>
//         <div className="flex justify-between items-center mb-8">
//           <Typography variant="h4" component="h1" fontWeight="bold">
//             场景配置
//           </Typography>
//         </div>
//
//         {/* 【保留】TopologyEditor 及其所有 props 保持不变 */}
//         <TopologyEditor
//             onAddNode={handleAddNode}
//             onDeleteNode={handleDeleteNode}
//             onUpdateNode={handleUpdateNode}
//         />
//
//         {/* 【已删除】下方包含设备列表的 Card 和 Table 的 JSX 代码已被完全移除。 */}
//
//       </div>
//   );
// };
//
// export default ScenarioPage;