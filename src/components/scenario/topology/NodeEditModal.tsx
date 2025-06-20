"use client";
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Box,
  Stack,
  Typography,
} from '@mui/material';
// 移除了不再使用的 FormControl, InputLabel, Select, MenuItem, SelectChangeEvent
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { TopologyNode, NodeConfig } from '../../../types';

// 移除了不再需要的 DEVICE_TYPES 常量

// 定义哪些设备类型是“计算资源”，需要显示镜像和端口配置
const COMPUTE_RESOURCE_TYPES = ['容器', '虚拟机'];


interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopologyNode | null;
  onSave: (nodeId: string, newConfig: NodeConfig, newLabel: string) => void;
}

const NodeEditModal: React.FC<NodeEditModalProps> = ({ isOpen, onClose, node, onSave }) => {
  // --- 状态管理 (保持不变) ---
  const [label, setLabel] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [dockerImage, setDockerImage] = useState('');
  const [ports, setPorts] = useState<{ hostPort: string; containerPort: string }[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 副作用钩子 (保持不变)
  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setDeviceName(node.config.deviceName);
      setDockerImage(node.config.dockerImage);
      const parsedPorts = node.config.portMappings
          ? node.config.portMappings
              .split(',')
              .map(p => p.trim())
              .filter(p => p.includes(':'))
              .map(p => {
                const [hostPort, containerPort] = p.split(':');
                return { hostPort: hostPort || '', containerPort: containerPort || '' };
              })
          : [];
      setPorts(parsedPorts);
      setErrors({});
    }
  }, [node]);

  // 表单验证 (保持不变)
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!label.trim()) newErrors.label = '节点名称不能为空';
    if (!deviceName.trim()) newErrors.deviceName = '设备类型不能为空'; // 这个验证仍然有效

    if (COMPUTE_RESOURCE_TYPES.includes(deviceName)) {
      ports.forEach((p, index) => {
        if (!p.hostPort.trim() || !p.containerPort.trim()) {
          newErrors[`port_${index}`] = `第 ${index + 1} 行的端口不能为空`;
        }
        if (isNaN(Number(p.hostPort)) || isNaN(Number(p.containerPort))) {
          newErrors[`port_${index}`] = `第 ${index + 1} 行的端口必须是数字`;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 端口映射处理函数 (保持不变)
  const handleAddPort = () => setPorts([...ports, { hostPort: '', containerPort: '' }]);
  const handleRemovePort = (i: number) => setPorts(ports.filter((_, idx) => idx !== i));
  const handlePortChange = (i: number, key: 'hostPort' | 'containerPort', value: string) => {
    setPorts(ports.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  };

  // 保存操作 (保持不变, deviceName 仍会正确保存)
  const handleSave = () => {
    if (!node || !validate()) return;
    const portMappingsString = ports
        .map(p => `${p.hostPort}:${p.containerPort}`)
        .join(',');

    const newConfig: NodeConfig = {
      deviceName,
      dockerImage: COMPUTE_RESOURCE_TYPES.includes(deviceName) ? dockerImage : '',
      portMappings: COMPUTE_RESOURCE_TYPES.includes(deviceName) ? portMappingsString : ''
    };
    onSave(node.id, newConfig, label);
    onClose();
  };

  if (!node) return null;

  // 判断逻辑保持不变
  const showAdvancedConfig = COMPUTE_RESOURCE_TYPES.includes(deviceName);

  return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>编辑节点: {node?.label}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
                label="节点名称 (标签)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                error={!!errors.label}
                helperText={errors.label}
                required
                fullWidth
            />

            {/* --- 这是主要的修改部分 --- */}
            {/* 将原来的 FormControl 和 Select 组件替换为禁用的 TextField */}
            <TextField
                label="设备类型/名称"
                value={deviceName}
                fullWidth
                disabled // 设置为禁用状态，用户无法修改
            />
            {/* --- 修改部分结束 --- */}


            {/* --- 条件渲染部分逻辑完全不受影响 --- */}
            {showAdvancedConfig && (
                <>
                  <TextField
                      label="Docker 镜像"
                      value={dockerImage}
                      onChange={(e) => setDockerImage(e.target.value)}
                      placeholder="例如: ubuntu:latest"
                      fullWidth
                  />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>端口映射</Typography>
                    {ports.map((p, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <TextField
                              label="主机端口"
                              size="small"
                              value={p.hostPort}
                              onChange={e => handlePortChange(idx, 'hostPort', e.target.value)}
                              sx={{ flex: 1 }}
                          />
                          <Typography>:</Typography>
                          <TextField
                              label="容器端口"
                              size="small"
                              value={p.containerPort}
                              onChange={e => handlePortChange(idx, 'containerPort', e.target.value)}
                              sx={{ flex: 1 }}
                          />
                          <IconButton onClick={() => handleRemovePort(idx)} size="small" aria-label="移除端口映射">
                            <RemoveCircleOutlineIcon />
                          </IconButton>
                        </Box>
                    ))}
                    <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddPort} size="small">
                      添加端口
                    </Button>
                  </Box>
                </>
            )}
            {/* --- 条件渲染结束 --- */}

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button variant="contained" onClick={handleSave}>保存更改</Button>
        </DialogActions>
      </Dialog>
  );
};

export default NodeEditModal;

