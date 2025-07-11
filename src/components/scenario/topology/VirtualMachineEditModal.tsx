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
  Checkbox
} from '@mui/material';
import { TopologyNode, NodeConfig } from '../../../types';

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

  // --- 副作用钩子 ---
  useEffect(() => {
    if (isOpen && node) {
      // 设置基础信息
      setLabel(node.label);
      setIsTarget(node.config.isTarget || false);
      setBaseImage(node.config.Image || '');
      setErrors({});

      // 获取虚拟机镜像列表
      fetch("/back/api/vms/images")
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

    const newConfig: NodeConfig = {
      ...node.config, // 保留其他可能存在的配置
      Image: baseImage,
      isTarget: isTarget,
      // 清理掉容器特有的配置
      
      portMappings: '',
      env: ''
    };
    onSave(node.id, newConfig, label);
    onClose();
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

            {/* 虚拟机镜像下拉菜单 */}
            <FormControl fullWidth required error={!!_errors.baseImage}>
              <InputLabel id="vm-image-select-label">基础镜像</InputLabel>
              <Select
                labelId="vm-image-select-label"
                value={baseImage}
                label="基础镜像"
                onChange={(e) => setBaseImage(e.target.value)}
              >
                {images.map((img) => (
                  <MenuItem key={img.id || img.name} value={img.name}>
                    {img.name}
                  </MenuItem>
                ))}
              </Select>
              {_errors.baseImage && <p className="text-red-500 text-xs mt-1">{_errors.baseImage}</p>}
            </FormControl>

            {/* 是否为靶机选项 */}
            <FormControlLabel
                control={<Checkbox checked={isTarget} onChange={(e) => setIsTarget(e.target.checked)} />}
                label="设置为靶机"
            />
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