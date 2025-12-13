"use client";
import React, { useState, useEffect, useMemo } from 'react';
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

interface TeamOption {
  id: string;
  name: string;
}

interface VirtualMachineEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopologyNode | null;
  onSave: (nodeId: string, newConfig: NodeConfig, newLabel: string) => void;
  isEditable?: boolean;
}

const chineseCharPattern = /[\u4e00-\u9fa5]/;

const VirtualMachineEditModal: React.FC<VirtualMachineEditModalProps> = ({ isOpen, onClose, node, onSave, isEditable = true }) => {
  // --- 状态管理 ---
  const [label, setLabel] = useState('');
  const [baseImage, setBaseImage] = useState('');
  const [isTarget, setIsTarget] = useState(false);
  const [images, setImages] = useState<VMImage[]>([]);
  const [_errors, setErrors] = useState<{ [key: string]: string }>({});
  const [envs, setEnvs] = useState<{ key: string; value: string }[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [legacyTeamLabel, setLegacyTeamLabel] = useState<string>('');
  
  // 资源配置状态
  const [memory, setMemory] = useState('4096');
  const [cpu, setCpu] = useState('4');
  const [diskSize, setDiskSize] = useState('20');

  // --- 副作用钩子 ---
  useEffect(() => {
    if (isOpen && node) {
      // 设置基础信息
      setLabel(node.label);
      setIsTarget(node.config.isTarget || false);
      setBaseImage(node.config.Image || '');
      setErrors({});
      
      // 设置资源配置
      setMemory(node.config.memory || '4096');
      setCpu(node.config.cpu || '4');
      setDiskSize(node.config.diskSize || '20');

      const { id: extractedTeamId, label: extractedTeamLabel } = extractTeamMeta(node.config);
      setSelectedTeamId(extractedTeamId);
      setLegacyTeamLabel(extractedTeamLabel);

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

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchTeams = async () => {
      try {
        const response = await customFetch('/back/api/ad/team?per_page=1000');
        if (!response.ok) {
          throw new Error(`获取队伍列表失败，状态码: ${response.status}`);
        }
        const data = await response.json();
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
        if (!isMounted) return;
        const mappedTeams: TeamOption[] = list
          .map((team: any) => {
            const id = String(team?.c_id ?? team?.id ?? '').trim();
            if (!id) return null;
            const rawName = String(team?.c_name ?? team?.name ?? '').trim();
            return { id, name: rawName || id };
          })
          .filter((team): team is TeamOption => Boolean(team));
        setTeams(mappedTeams);
      } catch (error) {
        console.error('获取队伍列表失败:', error);
      }
    };

    fetchTeams();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const teamOptions = useMemo(() => {
    if (!selectedTeamId) return teams;
    const exists = teams.some(team => team.id === selectedTeamId);
    if (exists) return teams;
    return [
      ...teams,
      { id: selectedTeamId, name: legacyTeamLabel || selectedTeamId },
    ];
  }, [teams, selectedTeamId, legacyTeamLabel]);

  // 表单验证
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!label.trim()) newErrors.label = '节点名称不能为空';
    else if (node?.type === 'virtual_machine' && chineseCharPattern.test(label)) newErrors.label = '节点名称不能包含中文字符';
    if (!baseImage) newErrors.baseImage = '必须选择一个基础镜像';
    if (memory && isNaN(Number(memory))) newErrors.memory = '内存大小必须是数字';
    if (cpu && isNaN(Number(cpu))) newErrors.cpu = 'CPU核心数必须是数字';
    if (diskSize && isNaN(Number(diskSize))) newErrors.diskSize = '磁盘大小必须是数字';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- 保存操作 ---
  const handleSave = () => {
    if (!isEditable || !node || !validate()) return;

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
      env: envString,
      // 添加虚拟机资源配置
      memory: memory,
      cpu: cpu,
      diskSize: diskSize
    };

    if (selectedTeamId) {
      newConfig.teamId = selectedTeamId;
    } else {
      delete newConfig.teamId;
    }
    delete (newConfig as Record<string, unknown>)['teamAssignment'];

    onSave(node.id, newConfig, label);
    onClose();
  };

  const handleAddEnv = () => setEnvs([...envs, { key: '', value: '' }]);
  const handleRemoveEnv = (index: number) => setEnvs(envs.filter((_, i) => i !== index));
  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    setEnvs(envs.map((env, i) => (i === index ? { ...env, [field]: value } : env)));
  };

  if (!node) return null;
  const disabled = !isEditable;

  return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>编辑虚拟机节点: {node?.label}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 节点名称和设备类型 */}
            <TextField
              label="节点名称 (标签)"
              value={label}
              onChange={(e) => {
                const value = e.target.value;
                setLabel(value);
                setErrors(prev => ({
                  ...prev,
                  label: !value.trim()
                    ? '节点名称不能为空'
                    : node?.type === 'virtual_machine' && chineseCharPattern.test(value)
                      ? '节点名称不能包含中文字符'
                      : undefined,
                }));
              }}
              required
              fullWidth
              error={!!_errors.label}
              helperText={_errors.label}
              disabled={disabled}
            />
            <TextField label="设备类型/名称" value={node.config.deviceName} fullWidth disabled />
            <FormControl fullWidth size="small" disabled={disabled}>
              <InputLabel>队伍分配</InputLabel>
              <Select
                value={selectedTeamId}
                label="队伍分配"
                onChange={(e) => setSelectedTeamId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">
                  <em></em>
                </MenuItem>
                {teamOptions.map(team => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
              disabled={disabled}
            />

            {/* 资源配置 */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>资源配置</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="内存 (MB)"
                  type="number"
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  error={!!_errors.memory}
                  helperText={_errors.memory}
                  placeholder="例如: 1024"
                  disabled={disabled}
                />
                <TextField
                  label="CPU 核心数"
                  type="number"
                  value={cpu}
                  onChange={(e) => setCpu(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  error={!!_errors.cpu}
                  helperText={_errors.cpu}
                  placeholder="例如: 2"
                  disabled={disabled}
                />
                <TextField
                  label="磁盘大小 (GB)"
                  type="number"
                  value={diskSize}
                  onChange={(e) => setDiskSize(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  error={!!_errors.diskSize}
                  helperText={_errors.diskSize}
                  placeholder="例如: 20"
                  disabled={disabled}
                />
              </Stack>
            </Box>

            {/* 是否为靶机选项 */}
            <FormControlLabel
                control={<Checkbox checked={isTarget} onChange={(e) => setIsTarget(e.target.checked)} disabled={disabled} />}
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
                    disabled={disabled}
                  />
                  <TextField
                    label="值"
                    size="small"
                    value={env.value}
                    onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                    sx={{ flex: 1 }}
                    disabled={disabled}
                  />
                  <IconButton onClick={() => handleRemoveEnv(idx)} size="small" disabled={disabled}>
                    <RemoveCircleOutlineIcon />
                  </IconButton>
                </Box>
              ))}
              <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddEnv} size="small" disabled={disabled}>
                添加变量
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={disabled}>保存更改</Button>
        </DialogActions>
      </Dialog>
  );
};

export default VirtualMachineEditModal;

function extractTeamMeta(config: NodeConfig): { id: string; label: string } {
  const directId = config.teamId;
  if (directId !== undefined && directId !== null && directId !== '') {
    return { id: String(directId), label: '' };
  }

  const legacyAssignment = (config as any)?.teamAssignment;
  if (legacyAssignment && typeof legacyAssignment === 'object') {
    const legacyId =
      legacyAssignment.id ??
      legacyAssignment.teamId ??
      legacyAssignment.c_id ??
      '';
    const legacyName =
      legacyAssignment.name ??
      legacyAssignment.c_name ??
      legacyAssignment.label ??
      '';

    if (legacyId !== undefined && legacyId !== null && legacyId !== '') {
      return {
        id: String(legacyId),
        label: legacyName ? String(legacyName) : String(legacyId),
      };
    }
  }

  if (typeof legacyAssignment === 'string' && legacyAssignment !== '') {
    return { id: legacyAssignment, label: legacyAssignment };
  }

  return { id: '', label: '' };
}
