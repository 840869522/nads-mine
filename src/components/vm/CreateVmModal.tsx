"use client";
import React, { useEffect, useState } from "react";
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
  MenuItem
} from "@mui/material";

interface VmImage {
  id: string;
  name: string;
  path: string;
}

interface CreateVmModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  fixedImage?: string;
}

export default function CreateVmModal({ open, onClose, onCreated, fixedImage }: CreateVmModalProps) {
  const [images, setImages] = useState<VmImage[]>([]);
  const [form, setForm] = useState({
    vm_name: "",
    base_image: "",
    memory: 2048,
    vcpus: 2,
    disk_gb: 20,
    ssh_key: "",
    admin_password: "",
    static_ip: "",
    guacamole: { url: "", username: "", password: "", folder_id: "ROOT" }
  });

  useEffect(() => {
    if (!open) return;
    if (fixedImage) {
      setForm(f => ({ ...f, base_image: fixedImage }));
      setImages([]);
    } else {
      fetch("/api/php/vms/images")
        .then(res => res.json())
        .then(data => setImages(data));
    }
  }, [open, fixedImage]);

  const resetState = () => {
    setForm({
      vm_name: "",
      base_image: fixedImage || "",
      memory: 2048,
      vcpus: 2,
      disk_gb: 20,
      ssh_key: "",
      admin_password: "",
      static_ip: "",
      guacamole: { url: "", username: "", password: "", folder_id: "ROOT" }
    });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    await fetch("/api/php/vms/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    onCreated?.();
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>创建虚拟机实例</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {fixedImage ? (
            <TextField label="镜像" value={form.base_image} fullWidth disabled />
          ) : (
            <FormControl fullWidth>
              <InputLabel id="img-label">镜像</InputLabel>
              <Select
                labelId="img-label"
                value={form.base_image}
                label="镜像"
                onChange={e => setForm(f => ({ ...f, base_image: e.target.value }))}
              >
                {images.map(img => (
                  <MenuItem key={img.id} value={img.path}>{img.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField label="实例名称" value={form.vm_name}
            onChange={e => setForm(f => ({ ...f, vm_name: e.target.value }))} fullWidth />
          <TextField label="内存 (MB)" type="number" value={form.memory}
            onChange={e => setForm(f => ({ ...f, memory: Number(e.target.value) }))} fullWidth />
          <TextField label="vCPU" type="number" value={form.vcpus}
            onChange={e => setForm(f => ({ ...f, vcpus: Number(e.target.value) }))} fullWidth />
          <TextField label="磁盘 (GB)" type="number" value={form.disk_gb}
            onChange={e => setForm(f => ({ ...f, disk_gb: Number(e.target.value) }))} fullWidth />
          <TextField label="SSH 公钥" value={form.ssh_key}
            onChange={e => setForm(f => ({ ...f, ssh_key: e.target.value }))} fullWidth multiline rows={2} />
          <TextField label="管理员密码 (Windows)" type="password" value={form.admin_password}
            onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} fullWidth />
          <TextField label="静态 IP" value={form.static_ip}
            onChange={e => setForm(f => ({ ...f, static_ip: e.target.value }))} fullWidth />
          <TextField label="Guacamole URL" value={form.guacamole.url}
            onChange={e => setForm(f => ({ ...f, guacamole: { ...f.guacamole, url: e.target.value } }))} fullWidth />
          <TextField label="Guacamole 用户名" value={form.guacamole.username}
            onChange={e => setForm(f => ({ ...f, guacamole: { ...f.guacamole, username: e.target.value } }))} fullWidth />
          <TextField label="Guacamole 密码" type="password" value={form.guacamole.password}
            onChange={e => setForm(f => ({ ...f, guacamole: { ...f.guacamole, password: e.target.value } }))} fullWidth />
          <TextField label="Guacamole Folder ID" value={form.guacamole.folder_id}
            onChange={e => setForm(f => ({ ...f, guacamole: { ...f.guacamole, folder_id: e.target.value } }))} fullWidth />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>创建</Button>
      </DialogActions>
    </Dialog>
  );
}
