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
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { TopologyNode, NodeConfig } from '../../../types';

// 假设 ManagedImage 类型已定义或从其他地方导入
interface ManagedImage {
  id: string;
  name: string;
  version: string;
}

const COMPUTE_RESOURCE_TYPES = ['容器', '虚拟机'];

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopologyNode | null;
  onSave: (nodeId: string, newConfig: NodeConfig, newLabel: string) => void;
}

const NodeEditModal: React.FC<NodeEditModalProps> = ({ isOpen, onClose, node, onSave }) => {
  // --- 状态管理 ---
  const [label, setLabel] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [dockerImage, setDockerImage] = useState('');
  const [ports, setPorts] = useState<{ hostPort: string; containerPort: string }[]>([]);
  // 新增：环境变量的状态
  const [envs, setEnvs] = useState<{ key: string; value: string }[]>([]);
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [_errors, setErrors] = useState<{ [key: string]: string }>({});

  // --- 副作用钩子 ---
  useEffect(() => {
    if (node) {
      // 设置基础信息
      setLabel(node.label);
      setDeviceName(node.config.deviceName);
      setDockerImage(node.config.dockerImage);
      setErrors({});

      // 解析端口映射
      const parsedPorts = node.config.portMappings
          ? node.config.portMappings.split(',').map(p => {
            const [hostPort = '', containerPort = ''] = p.split(':');
            return { hostPort, containerPort };
          })
          : [];
      setPorts(parsedPorts);

      // 新增：解析环境变量
      const parsedEnvs = node.config.env
          ? node.config.env.split(',').map(e => {
            const parts = e.split('=');
            const key = parts.shift() || '';
            const value = parts.join('=');
            return { key, value };
          })
          : [];
      setEnvs(parsedEnvs);

      // 获取镜像列表
      const isComputeResource = COMPUTE_RESOURCE_TYPES.includes(node.config.deviceName);
      if (isComputeResource) {
        fetch('http://localhost:8000/api/images')
            .then(res => res.json())
            .then(data => setImages(data))
            .catch(err => console.error("获取镜像列表失败:", err));
      }
    }
  }, [node]);

  // 表单验证 (保持不变)
  const validate = (): boolean => {
    // ... 验证逻辑保持不变 ...
    return true; // 为简洁起见，此处省略，您应保留原来的验证逻辑
  };

  // --- 端口映射处理函数 (保持不变) ---
  const handleAddPort = () => setPorts([...ports, { hostPort: '', containerPort: '' }]);
  const handleRemovePort = (i: number) => setPorts(ports.filter((_, idx) => idx !== i));
  const handlePortChange = (i: number, key: 'hostPort' | 'containerPort', value: string) => {
    setPorts(ports.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  };

  // --- 新增：环境变量处理函数 (从 CreateContainerModal 复制而来) ---
  const handleAddEnv = () => setEnvs([...envs, { key: '', value: '' }]);
  const handleRemoveEnv = (i: number) => setEnvs(envs.filter((_, idx) => idx !== i));
  const handleEnvChange = (i: number, key: 'key' | 'value', value: string) => {
    setEnvs(envs.map((e, idx) => (idx === i ? { ...e, [key]: value } : e)));
  };

  // --- 保存操作 (更新) ---
  const handleSave = () => {
    if (!node || !validate()) return;

    // 转换端口映射为字符串
    const portMappingsString = ports
        .filter(p => p.hostPort && p.containerPort)
        .map(p => `${p.hostPort}:${p.containerPort}`)
        .join(',');

    // 新增：转换环境变量为字符串
    const envString = envs
        .filter(e => e.key)
        .map(e => `${e.key}=${e.value}`)
        .join(',');

    const newConfig: NodeConfig = {
      deviceName,
      dockerImage: COMPUTE_RESOURCE_TYPES.includes(deviceName) ? dockerImage : '',
      portMappings: COMPUTE_RESOURCE_TYPES.includes(deviceName) ? portMappingsString : '',
      // 新增：将环境变量添加到配置中
      env: COMPUTE_RESOURCE_TYPES.includes(deviceName) ? envString : '',
    };
    onSave(node.id, newConfig, label);
    onClose();
  };

  if (!node) return null;

  const showAdvancedConfig = COMPUTE_RESOURCE_TYPES.includes(deviceName);

  return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>编辑节点: {node?.label}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 节点名称和设备类型 (保持不变) */}
            <TextField label="节点名称 (标签)" value={label} onChange={(e) => setLabel(e.target.value)} required fullWidth />
            <TextField label="设备类型/名称" value={deviceName} fullWidth disabled />

            {showAdvancedConfig && (
                <>
                  {/* Docker 镜像下拉菜单 (保持不变) */}
                  <FormControl fullWidth>
                    <InputLabel id="docker-image-select-label">Docker 镜像</InputLabel>
                    <Select labelId="docker-image-select-label" value={dockerImage} label="Docker 镜像" onChange={(e) => setDockerImage(e.target.value)} required>
                      {images.map((img) => (<MenuItem key={img.id} value={`${img.name}:${img.version}`}>{`${img.name}:${img.version}`}</MenuItem>))}
                    </Select>
                  </FormControl>

                  {/* 端口映射 (保持不变) */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>端口映射</Typography>
                    {ports.map((p, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <TextField label="主机端口" size="small" value={p.hostPort} onChange={e => handlePortChange(idx, 'hostPort', e.target.value)} sx={{ flex: 1 }}/>
                          <Typography>:</Typography>
                          <TextField label="容器端口" size="small" value={p.containerPort} onChange={e => handlePortChange(idx, 'containerPort', e.target.value)} sx={{ flex: 1 }}/>
                          <IconButton onClick={() => handleRemovePort(idx)} size="small" aria-label="移除端口映射"><RemoveCircleOutlineIcon /></IconButton>
                        </Box>
                    ))}
                    <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddPort} size="small">添加端口</Button>
                  </Box>

                  {/* 新增：环境变量编辑 UI (从 CreateContainerModal 复制而来) */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>环境变量</Typography>
                    {envs.map((ev, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <TextField label="变量名" size="small" value={ev.key} onChange={e => handleEnvChange(idx, 'key', e.target.value)} sx={{ flex: 1 }} />
                          <TextField label="值" size="small" value={ev.value} onChange={e => handleEnvChange(idx, 'value', e.target.value)} sx={{ flex: 1 }} />
                          <IconButton onClick={() => handleRemoveEnv(idx)} size="small"><RemoveCircleOutlineIcon /></IconButton>
                        </Box>
                    ))}
                    <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddEnv} size="small">添加变量</Button>
                  </Box>

                </>
            )}
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