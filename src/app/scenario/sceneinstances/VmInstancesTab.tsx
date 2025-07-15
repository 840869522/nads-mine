// src/app/scenario/sceneinstances/VmInstancesTab.tsx
"use client";
import React from 'react';
import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Typography
} from '@mui/material';

// 静态数据示例
const staticVms = [
    { id: 'vm1', name: 'Windows-Server-2022', status: 'running', os: 'Windows', ip: '192.168.1.101', cpu: '2 Cores', mem: '4GB' },
    { id: 'vm2', name: 'Ubuntu-Desktop-22.04', status: 'paused', os: 'Linux', ip: '192.168.1.102', cpu: '4 Cores', mem: '8GB' },
    { id: 'vm3', name: 'Firewall-Appliance', status: 'shutoff', os: 'pfSense', ip: '-', cpu: '1 Core', mem: '1GB' },
];

const getStatusChipColor = (status: string) => {
    if (status === 'running') return 'success';
    if (status === 'paused') return 'warning';
    return 'default';
};

const VmInstancesTab: React.FC = () => {
    return (
        <TableContainer component={Paper}>
            <Table stickyHeader aria-label="虚拟机实例列表">
                <TableHead>
                    <TableRow>
                        <TableCell>名称</TableCell>
                        <TableCell>状态</TableCell>
                        <TableCell>操作系统</TableCell>
                        <TableCell>IP地址</TableCell>
                        <TableCell>vCPU</TableCell>
                        <TableCell>内存</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {staticVms.length > 0 ? staticVms.map((vm) => (
                        <TableRow key={vm.id} hover>
                            <TableCell sx={{ fontWeight: 'medium' }}>{vm.name}</TableCell>
                            <TableCell>
                                <Chip label={vm.status} color={getStatusChipColor(vm.status)} size="small" />
                            </TableCell>
                            <TableCell>{vm.os}</TableCell>
                            <TableCell><code>{vm.ip}</code></TableCell>
                            <TableCell>{vm.cpu}</TableCell>
                            <TableCell>{vm.mem}</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} align="center">
                                <Typography color="text.secondary" sx={{ p: 4 }}>
                                    此场景实例中没有虚拟机。
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default VmInstancesTab;