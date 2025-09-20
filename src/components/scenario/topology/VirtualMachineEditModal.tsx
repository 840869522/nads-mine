"use client";
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  IconButton,
  Box,
  Typography
} from '@mui/material';
import SearchableSelect from './SearchableSelect';
import { TopologyNode, NodeConfig } from '../../../types';
import { customFetch } from '@/utils/fetch';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
// 假设 VMImage 类型
interface VMImage {
  id: string;
  name: string;
  // 根据实际API返回结果调整
}

interface VirtualMachineEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopologyNode | null;
  onSave: (nodeId: string, newConfig: NodeConfig, newLabel: string) => void;
}

const VirtualMachineEditModal: React.FC<VirtualMachineEditModalProps> = ({ isOpen, onClose, node, onSave }) => {
  // --- 状态管理 ---
  const [label, setLabel] = useState('');
  const [baseImage, setBaseImage] = useState('');
  const [isTarget, setIsTarget] = useState(false);
  const [images, setImages] = useState<VMImage[]>([]);
  const [_errors, setErrors] = useState<{ [key: string]: string }>({});
  const [envs, setEnvs] = useState<{ key: string; value: string }[]>([]);

  // --- 副作用钩子 ---
  useEffect(() => {
    if (isOpen && node) {
      // 设置基础信息
      setLabel(node.label);
      setIsTarget(node.config.isTarget || false);
      setBaseImage(node.config.Image || '');
      setErrors({});

      const parsedEnvs = node.config.env
        ? node.config.env.split(',').map(e => {
            const parts = e.split('=');
            const key = parts.shift() || '';
            const value = parts.join('=');
            return { key, value };
          })
        : [];
      setEnvs(parsedEnvs);

      // 获取虚拟机镜像列表
      customFetch("/back/api/vms/images")
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
               setImages(data);
            }
        })
        .catch(err => console.error("获取虚拟机镜像列表失败:", err));

    }
  }, [node, isOpen]);

  // 表单验证
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!label.trim()) newErrors.label = '节点名称不能为空';
    if (!baseImage) newErrors.baseImage = '必须选择一个基础镜像';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- 保存操作 ---
  const handleSave = () => {
    if (!node || !validate()) return;

    const envString = envs
      .filter(e => e.key)
      .map(e => `${e.key}=${e.value}`)
      .join(',');

    const newConfig: NodeConfig = {
      ...node.config, // 保留其他可能存在的配置
      Image: baseImage,
      isTarget: isTarget,
      // 清理掉容器特有的配置
      
      portMappings: '',
      env: envString
    };
    onSave(node.id, newConfig, label);
    onClose();
  };

  const handleAddEnv = () => setEnvs([...envs, { key: '', value: '' }]);
  const handleRemoveEnv = (index: number) => setEnvs(envs.filter((_, i) => i !== index));
  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    setEnvs(envs.map((env, i) => (i === index ? { ...env, [field]: value } : env)));
  };

  if (!node) return null;

  return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>编辑虚拟机节点: {node?.label}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 节点名称和设备类型 */}
            <TextField
              label="节点名称 (标签)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              fullWidth
              error={!!_errors.label}
              helperText={_errors.label}
            />
            <TextField label="设备类型/名称" value={node.config.deviceName} fullWidth disabled />

            {/* 虚拟机镜像选择 */}
            <SearchableSelect
              label="基础镜像"
              value={baseImage}
              onChange={setBaseImage}
              options={images.map(img => ({
                id: img.id || img.name,
                name: img.name,
                displayName: img.name
              }))}
              required
              placeholder=""
              error={!!_errors.baseImage}
              helperText={_errors.baseImage}
            />

            {/* 是否为靶机选项 */}
            <FormControlLabel
                control={<Checkbox checked={isTarget} onChange={(e) => setIsTarget(e.target.checked)} />}
                label="设置为靶机"
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>环境变量</Typography>
              {envs.map((env, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    label="变量名"
                    size="small"
                    value={env.key}
                    onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="值"
                    size="small"
                    value={env.value}
                    onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <IconButton onClick={() => handleRemoveEnv(idx)} size="small">
                    <RemoveCircleOutlineIcon />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddEnv} size="small">
                添加变量
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button variant="contained" onClick={handleSave}>保存更改</Button>
        </DialogActions>
      </Dialog>
  );
};

export default VirtualMachineEditModal;
