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
import { OS_VARIANTS } from "@/constants/osVariants";

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
    os_variant: "",
    memory: 2048,
    vcpus: 2,
    disk_gb: 20,
    ssh_key: "",
    admin_password: "",
    static_ip: ""
  });

  useEffect(() => {
    if (!open) return;
    if (fixedImage) {
      setForm(f => ({ ...f, base_image: fixedImage }));
      setImages([]);
    } else {
      fetch("/back/api/vms/images")
        .then(res => res.json())
        .then(data => setImages(data));
    }
  }, [open, fixedImage]);

  const resetState = () => {
    setForm({
      vm_name: "",
      base_image: fixedImage || "",
      os_variant: "",
      memory: 2048,
      vcpus: 2,
      disk_gb: 20,
      ssh_key: "",
      admin_password: "",
      static_ip: ""
    });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    await fetch("/back/api/vms/create", {
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
          <FormControl fullWidth>
            <InputLabel id="variant-label">os-variant</InputLabel>
            <Select
              labelId="variant-label"
              value={form.os_variant}
              label="os-variant"
              onChange={e => setForm(f => ({ ...f, os_variant: e.target.value }))}
            >
              {OS_VARIANTS.map(v => (
                <MenuItem key={v} value={v}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>创建</Button>
      </DialogActions>
    </Dialog>
  );
}
