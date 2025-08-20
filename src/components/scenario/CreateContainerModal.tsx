"use client";
import React, { useEffect, useState } from 'react';
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
  MenuItem,
  InputLabel,
  FormControl,
  Select,
  Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { ManagedImage } from '@/types';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = '/back/api';

interface CreateContainerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /**
   * When provided, the image field will be fixed to this value and
   * the image selection dropdown will be hidden.
   */
  fixedImage?: string;
}

export default function CreateContainerModal({ open, onClose, onCreated, fixedImage }: CreateContainerModalProps) {
  const { user } = useAuth();
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [ports, setPorts] = useState<{ containerPort: string; hostPort: string }[]>([]);
  const [volumes, setVolumes] = useState<{ hostPath: string; containerPath: string }[]>([]);
  const [envs, setEnvs] = useState<{ key: string; value: string }[]>([]);
  const [cmd, setCmd] = useState('');

  useEffect(() => {
    if (!open) return;
    if (fixedImage) {
      setImage(fixedImage);
      setImages([]);
    } else if (user) {
      fetch(`${API_BASE}/images`)
        .then(res => res.json())
        .then(data => setImages(data));
    }
  }, [open, user, fixedImage]);

  const resetState = () => {
    setImage('');
    setName('');
    setPorts([]);
    setVolumes([]);
    setEnvs([]);
    setCmd('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAddPort = () => setPorts([...ports, { containerPort: '', hostPort: '' }]);
  const handleRemovePort = (i: number) => setPorts(ports.filter((_, idx) => idx !== i));
  const handlePortChange = (i: number, key: 'containerPort' | 'hostPort', value: string) => {
    setPorts(ports.map((p, idx) => idx === i ? { ...p, [key]: value } : p));
  };

  const handleAddVolume = () => setVolumes([...volumes, { hostPath: '', containerPath: '' }]);
  const handleRemoveVolume = (i: number) => setVolumes(volumes.filter((_, idx) => idx !== i));
  const handleVolumeChange = (i: number, key: 'hostPath' | 'containerPath', value: string) => {
    setVolumes(volumes.map((v, idx) => idx === i ? { ...v, [key]: value } : v));
  };

  const handleAddEnv = () => setEnvs([...envs, { key: '', value: '' }]);
  const handleRemoveEnv = (i: number) => setEnvs(envs.filter((_, idx) => idx !== i));
  const handleEnvChange = (i: number, key: 'key' | 'value', value: string) => {
    setEnvs(envs.map((e, idx) => idx === i ? { ...e, [key]: value } : e));
  };

  const handleSubmit = async () => {
    if (!user || !image) return;
    await fetch(`${API_BASE}/containers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        name: name || undefined,
        ports: ports.filter(p => p.containerPort),
        volumes: volumes.filter(v => v.hostPath && v.containerPath),
        env: envs.filter(e => e.key).map(e => ({ key: e.key, value: e.value })),
        cmd: cmd.trim() ? cmd.trim().split(/\s+/) : undefined,
        creatorId: user.id,
      }),
    });
    onCreated();
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>创建实例</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {fixedImage ? (
            <TextField label="镜像" value={image} fullWidth disabled />
          ) : (
            <FormControl fullWidth>
              <InputLabel id="image-select-label">镜像</InputLabel>
              <Select
                labelId="image-select-label"
                value={image}
                label="镜像"
                onChange={e => setImage(e.target.value)}
              >
                {images.map(img => (
                  <MenuItem key={img.id} value={`${img.name}:${img.version}`}>{`${img.name}:${img.version}`}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField label="容器名称" value={name} onChange={e => setName(e.target.value)} fullWidth />
          <Box>
            <Typography variant="subtitle2" gutterBottom>端口映射</Typography>
            {ports.map((p, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField label="主机端口" size="small" value={p.hostPort} onChange={e => handlePortChange(idx, 'hostPort', e.target.value)} sx={{ flex: 1 }} />
                <TextField label="容器端口" size="small" value={p.containerPort} onChange={e => handlePortChange(idx, 'containerPort', e.target.value)} sx={{ flex: 1 }} />
                <IconButton onClick={() => handleRemovePort(idx)} size="small"><RemoveCircleOutlineIcon /></IconButton>
              </Box>
            ))}
            <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddPort} size="small">添加端口</Button>
          </Box>
          <Box>
            <Typography variant="subtitle2" gutterBottom>挂载卷</Typography>
            {volumes.map((v, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField label="主机路径" size="small" value={v.hostPath} onChange={e => handleVolumeChange(idx, 'hostPath', e.target.value)} sx={{ flex: 1 }} />
                <TextField label="容器路径" size="small" value={v.containerPath} onChange={e => handleVolumeChange(idx, 'containerPath', e.target.value)} sx={{ flex: 1 }} />
                <IconButton onClick={() => handleRemoveVolume(idx)} size="small"><RemoveCircleOutlineIcon /></IconButton>
              </Box>
            ))}
            <Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddVolume} size="small">添加挂载</Button>
          </Box>
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
          <TextField label="启动参数" value={cmd} onChange={e => setCmd(e.target.value)} fullWidth helperText="可选，空则使用镜像默认命令" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>创建</Button>
      </DialogActions>
    </Dialog>
  );
}
