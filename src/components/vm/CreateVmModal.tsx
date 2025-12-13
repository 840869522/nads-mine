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
  FormControlLabel,
  Checkbox
} from "@mui/material";
import Autocomplete from '@mui/material/Autocomplete';
import {customFetch} from "@/utils/fetch.ts";

const chineseCharPattern = /[\u4e00-\u9fa5]/;

interface VmImage {
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
    image: "",
    ip: "",
    is_target: false
  });
  const [errors, setErrors] = useState<{ vm_name?: string }>({});

  useEffect(() => {
    if (!open) return;
    if (fixedImage) {
      const name = fixedImage.split('/').pop() || fixedImage;
      setForm(f => ({ ...f, image: name }));
      setImages([]);
    } else {
      customFetch("/back/api/vms/images")
        .then(res => res.json())
        .then(data => setImages(data));
    }
  }, [open, fixedImage]);

  const resetState = () => {
    setForm({
      vm_name: "",
      image: fixedImage || "",
      ip: "",
      is_target: false
    });
    setErrors({});
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    const newErrors: { vm_name?: string } = {};
    if (form.vm_name && chineseCharPattern.test(form.vm_name)) {
      newErrors.vm_name = "实例名称不能包含中文字符";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    await customFetch("/back/api/vms/create", {
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
            <TextField label="镜像" value={form.image} fullWidth disabled />
          ) : (
            <Autocomplete
              freeSolo
              options={images.map(img => img.name)}
              value={form.image}
              inputValue={form.image}
              onInputChange={(_, val) => setForm(f => ({ ...f, image: val }))}
              onChange={(_, val) => setForm(f => ({ ...f, image: val || '' }))}
              renderInput={(params) => <TextField {...params} label="镜像" />}
            />
          )}
          <TextField label="实例名称" value={form.vm_name}
            onChange={e => {
              const value = e.target.value;
              setForm(f => ({ ...f, vm_name: value }));
              setErrors(prev => ({ ...prev, vm_name: chineseCharPattern.test(value) ? "实例名称不能包含中文字符" : undefined }));
            }}
            error={!!errors.vm_name}
            helperText={errors.vm_name}
            fullWidth />
          <TextField label="IP 地址" value={form.ip}
            onChange={e => setForm(f => ({ ...f, ip: e.target.value }))} fullWidth />
          <FormControlLabel
            control={<Checkbox checked={form.is_target} onChange={e => setForm(f => ({ ...f, is_target: e.target.checked }))} />}
            label="靶机"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button variant="contained" onClick={handleSubmit}>创建</Button>
      </DialogActions>
    </Dialog>
  );
}
