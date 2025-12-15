"use client";
import React, { useState, useEffect, useMemo } from 'react';
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
  MenuItem,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import SearchableSelect from './SearchableSelect';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
// 确保从 types 文件中导入新增的 IptablesRule 类型
import { TopologyNode, NodeConfig, IptablesRule } from '../../../types';
import { customFetch } from '@/utils/fetch';
// 假设 ManagedImage 类型已定义或从其他地方导入
interface ManagedImage {
  id: string;
  name: string;
  version: string;
  description?: string;
}

interface TeamOption {
  id: string;
  name: string;
}

const COMPUTE_RESOURCE_TYPES = ['容器'];
const BRIDGE_TYPES = ['NAT网桥'];
const chineseCharPattern = /[\u4e00-\u9fa5]/;

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopologyNode | null;
  onSave: (nodeId: string, newConfig: NodeConfig, newLabel: string) => void;
  allNodes?: TopologyNode[]; // 新增：接收所有节点的列表
  isEditable?: boolean;
}

const NodeEditModal: React.FC<NodeEditModalProps> = ({ isOpen, onClose, node, onSave, allNodes = [], isEditable = true }) => {
  // --- 状态管理 ---
  const [label, setLabel] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [dockerImage, setDockerImage] = useState('');
  const [ports, setPorts] = useState<{ hostPort: string; containerPort: string }[]>([]);
  const [isTarget, setIsTarget] = useState(false);
  const [envs, setEnvs] = useState<{ key: string; value: string }[]>([]);
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [_errors, setErrors] = useState<{ [key: string]: string }>({});
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [legacyTeamLabel, setLegacyTeamLabel] = useState<string>('');

  // --- 新增：iptables 规则状态 ---
  const [iptablesRules, setIptablesRules] = useState<IptablesRule[]>([]);

  // --- 副作用钩子 ---
  useEffect(() => {
    if (node) {
      // 设置基础信息
      setLabel(node.label);
      setDeviceName(node.config.deviceName);
      setDockerImage(node.config.Image || '');
      setIsTarget(node.config.isTarget || false);
      setErrors({});

      // 解析端口映射 (容器)
      const parsedPorts = node.config.portMappings
          ? node.config.portMappings.split(',').map(p => {
            const [hostPort = '', containerPort = ''] = p.split(':');
            return { hostPort, containerPort };
          })
          : [];
      setPorts(parsedPorts);

      // 解析环境变量 (容器)
      const parsedEnvs = node.config.env
          ? node.config.env.split(',').map(e => {
            const parts = e.split('=');
            const key = parts.shift() || '';
            const value = parts.join('=');
            return { key, value };
          })
          : [];
      setEnvs(parsedEnvs);

      // --- 新增：解析 iptables 规则 (网桥) ---
      setIptablesRules(node.config.iptablesRules || []);

      const { id: extractedTeamId, label: extractedTeamLabel } = extractTeamMeta(node.config);
      setSelectedTeamId(extractedTeamId);
      setLegacyTeamLabel(extractedTeamLabel);

      // 获取镜像列表 (容器)
      if (COMPUTE_RESOURCE_TYPES.includes(node.config.deviceName)) {
        customFetch('/back/api/images')
            .then(res => res.json())
            .then(data => setImages(data))
            .catch(err => console.error("获取镜像列表失败:", err));
      }
    }
  }, [node]);

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

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (node?.type === 'container' && chineseCharPattern.test(label)) {
      newErrors.label = '节点名称不能包含中文字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // --- 端口映射处理函数 (保持不变) ---
  const handleAddPort = () => setPorts([...ports, { hostPort: '', containerPort: '' }]);
  const handleRemovePort = (i: number) => setPorts(ports.filter((_, idx) => idx !== i));
  const handlePortChange = (i: number, key: 'hostPort' | 'containerPort', value: string) => {
    setPorts(ports.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  };

  // --- 环境变量处理函数 (保持不变) ---
  const handleAddEnv = () => setEnvs([...envs, { key: '', value: '' }]);
  const handleRemoveEnv = (i: number) => setEnvs(envs.filter((_, idx) => idx !== i));
  const handleEnvChange = (i: number, key: 'key' | 'value', value: string) => {
    setEnvs(envs.map((e, idx) => (idx === i ? { ...e, [key]: value } : e)));
  };

  // --- 新增：iptables 规则处理函数 ---
  const handleAddIptablesRule = () => {
    setIptablesRules([...iptablesRules, { hostPort: '', instanceName: '', instancePort: '' }]);
  };

  const handleRemoveIptablesRule = (index: number) => {
    setIptablesRules(iptablesRules.filter((_, i) => i !== index));
  };
  
  const handleIptablesRuleChange = (index: number, field: keyof IptablesRule, value: string) => {
    setIptablesRules(
      iptablesRules.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule))
    );
  };


  // --- 保存操作 (更新) ---
  const handleSave = () => {
    if (!isEditable || !node || !validate()) return;

    // --- 容器相关配置 ---
    const portMappingsString = ports.filter(p => p.hostPort && p.containerPort).map(p => `${p.hostPort}:${p.containerPort}`).join(',');
    const envString = envs.filter(e => e.key).map(e => `${e.key}=${e.value}`).join(',');

    const isComputeNode = COMPUTE_RESOURCE_TYPES.includes(deviceName);
    const isBridgeNode = BRIDGE_TYPES.includes(deviceName);

    let newConfig: NodeConfig = {
      ...node.config,
      deviceName,
    };

    if (isComputeNode) {
      newConfig = {
        ...newConfig,
        Image: dockerImage,
        portMappings: portMappingsString,
        env: envString,
        isTarget: isTarget,
      };
    }
    
    // --- 新增：将 iptables 规则添加到配置中 ---
    if (isBridgeNode) {
        newConfig.iptablesRules = iptablesRules.filter(
            rule => rule.hostPort && rule.instanceName && rule.instancePort
        );
    }
    if (selectedTeamId) {
      newConfig.teamId = selectedTeamId;
    } else {
      delete newConfig.teamId;
    }
    delete (newConfig as Record<string, unknown>)['teamAssignment'];

    onSave(node.id, newConfig, label);
    onClose();
  };

  if (!node) return null;

  const showAdvancedConfig = COMPUTE_RESOURCE_TYPES.includes(deviceName);
  const showIptablesConfig = BRIDGE_TYPES.includes(deviceName);

  // 过滤出可作为转发目标的节点（容器和虚拟机）
  const targetableNodes = allNodes.filter(n => ['container', 'virtual_machine'].includes(n.type));
  const disabled = !isEditable;

  return (
      <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>编辑节点: {node?.label}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="节点名称 (标签)"
              value={label}
              onChange={(e) => {
                const value = e.target.value;
                setLabel(value);
                setErrors(prev => ({
                  ...prev,
                  label: node?.type === 'container' && chineseCharPattern.test(value) ? '节点名称不能包含中文字符' : undefined,
                }));
              }}
              required
              fullWidth
              disabled={disabled}
              error={!!_errors.label}
              helperText={_errors.label}
            />
            <TextField label="设备类型/名称" value={deviceName} fullWidth disabled />
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

            {/* 容器的高级配置 */}
            {showAdvancedConfig && (
                <>
                  <SearchableSelect
                    label="Docker 镜像"
                    value={dockerImage}
                    onChange={setDockerImage}
                    disabled={disabled}
                    options={images.map(img => ({
                      id: img.id,
                      name: img.name,
                      version: img.version,
                      description: img.description ?? '',
                      displayName: `${img.name}:${img.version}`
                    }))}
                    required
                    placeholder=""
                    error={!!_errors.dockerImage}
                    helperText={_errors.dockerImage}
                  />
                  <FormControlLabel control={<Checkbox checked={isTarget} onChange={(e) => setIsTarget(e.target.checked)} disabled={disabled} />} label="设置为靶机" />
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>端口映射</Typography>
                    {ports.map((p, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <TextField label="主机端口" size="small" value={p.hostPort} onChange={e => handlePortChange(idx, 'hostPort', e.target.value)} sx={{ flex: 1 }} disabled={disabled}/>
                          <Typography>:</Typography>
                          <TextField label="容器端口" size="small" value={p.containerPort} onChange={e => handlePortChange(idx, 'containerPort', e.target.value)} sx={{ flex: 1 }} disabled={disabled}/>
                          <IconButton onClick={() => handleRemovePort(idx)} size="small" disabled={disabled}><RemoveCircleOutlineIcon /></IconButton>
                        </Box>
                    ))}
                    <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddPort} size="small" disabled={disabled}>添加端口</Button>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>环境变量</Typography>
                    {envs.map((ev, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                          <TextField label="变量名" size="small" value={ev.key} onChange={e => handleEnvChange(idx, 'key', e.target.value)} sx={{ flex: 1 }} disabled={disabled} />
                          <TextField label="值" size="small" value={ev.value} onChange={e => handleEnvChange(idx, 'value', e.target.value)} sx={{ flex: 1 }} disabled={disabled} />
                          <IconButton onClick={() => handleRemoveEnv(idx)} size="small" disabled={disabled}><RemoveCircleOutlineIcon /></IconButton>
                        </Box>
                    ))}
                    <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddEnv} size="small" disabled={disabled}>添加变量</Button>
                  </Box>
                </>
            )}

            {/* --- 新增：网桥的 IPTables 配置 --- */}
            {showIptablesConfig && (
              <Box>
                <Typography variant="h6" gutterBottom>IPTables 端口转发规则</Typography>
                {iptablesRules.map((rule, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1, border: '1px solid #ddd', borderRadius: '4px' }}>
                    <TextField
                      label="主机暴露端口"
                      size="small"
                      value={rule.hostPort}
                      onChange={e => handleIptablesRuleChange(idx, 'hostPort', e.target.value)}
                      sx={{ flex: 1 }}
                      disabled={disabled}
                    />
                    <FormControl size="small" sx={{ flex: 2 }} disabled={disabled}>
                      <InputLabel>转发至实例</InputLabel>
                      <Select
                        value={rule.instanceName}
                        label="转发至实例"
                        onChange={e => handleIptablesRuleChange(idx, 'instanceName', e.target.value)}
                      >
                        <MenuItem value=""><em>-- 选择实例 --</em></MenuItem>
                        {targetableNodes.map(n => (
                          <MenuItem key={n.id} value={n.label}>{n.label} ({n.type})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="实例端口"
                      size="small"
                      value={rule.instancePort}
                      onChange={e => handleIptablesRuleChange(idx, 'instancePort', e.target.value)}
                      sx={{ flex: 1 }}
                      disabled={disabled}
                    />
                    <IconButton onClick={() => handleRemoveIptablesRule(idx)} size="small" disabled={disabled}>
                      <RemoveCircleOutlineIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddIptablesRule} size="small" disabled={disabled}>
                  添加转发规则
                </Button>
              </Box>
            )}

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={disabled}>保存更改</Button>
        </DialogActions>
      </Dialog>
  );
};

export default NodeEditModal;

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
