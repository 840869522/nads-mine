"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Checkbox,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import { customFetch } from "@/utils/fetch";

interface Props {
  open: boolean;
  index: string;
  onClose: () => void;
  onSaved?: (paused: boolean) => void;
}

interface IncludeMap {
  [key: string]: string[];
}

export default function IngestControlDialog({ open, index, onClose, onSaved }: Props) {
  const [defaults, setDefaults] = useState<IncludeMap>({});
  const [selected, setSelected] = useState<IncludeMap>({});
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await customFetch(`/api/ingest-control?index=${index}`);
      if (!res.ok) throw new Error("获取规则失败");
      const data = await res.json();
      setDefaults(data.defaults || {});
      setSelected(data.include || {});
      setPaused(data.pause || false);
    } catch (err: any) {
      setError(err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [index]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  const handleFieldToggle = (src: string, field: string, checked: boolean) => {
    setSelected((prev) => {
      const set = new Set(prev[src] || []);
      checked ? set.add(field) : set.delete(field);
      return { ...prev, [src]: Array.from(set) };
    });
  };

  const handleSourceToggle = (src: string, checked: boolean) => {
    setSelected((prev) => ({
      ...prev,
      [src]: checked ? defaults[src] : [],
    }));
  };

  const handleAllToggle = (checked: boolean) => {
    const next: IncludeMap = {};
    for (const [src, fields] of Object.entries(defaults)) {
      next[src] = checked ? fields : [];
    }
    setSelected(next);
  };

  const isFieldChecked = (src: string, field: string) => selected[src]?.includes(field);
  const isSourceChecked = (src: string) => selected[src]?.length === defaults[src]?.length;
  const isSourceIndeterminate = (src: string) => {
    const len = selected[src]?.length || 0;
    return len > 0 && len < defaults[src]?.length;
  };
  const isAllChecked = () =>
    Object.keys(defaults).every((src) => isSourceChecked(src));
  const isAllIndeterminate = () =>
    !isAllChecked() && Object.values(selected).some((arr) => arr && arr.length > 0);

  const handleSave = async () => {
    try {
      const res = await customFetch(`/api/ingest-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, include: selected, pause: paused }),
      });
      if (!res.ok) throw new Error("保存失败");
      onSaved?.(paused);
      onClose();
    } catch (err: any) {
      setError(err.message || "保存失败");
    }
  };

  const renderFields = (src: string) =>
    defaults[src]?.map((f) => (
      <TreeItem
        key={`${src}.${f}`}
        itemId={`${src}.${f}`}
        label={
          <FormControlLabel
            control={
              <Checkbox
                checked={isFieldChecked(src, f)}
                onChange={(e) => handleFieldToggle(src, f, e.target.checked)}
              />
            }
            label={f}
          />
        }
      />
    ));

  const renderSources = () =>
    Object.keys(defaults).map((src) => (
      <TreeItem
        key={src}
        itemId={src}
        label={
          <FormControlLabel
            control={
              <Checkbox
                checked={isSourceChecked(src)}
                indeterminate={isSourceIndeterminate(src)}
                onChange={(e) => handleSourceToggle(src, e.target.checked)}
              />
            }
            label={src}
          />
        }
      >
        {renderFields(src)}
      </TreeItem>
    ));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>日志收集规则：{index}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress />
          </Stack>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Stack spacing={2}>
            <FormControlLabel
              control={<Switch checked={!paused} onChange={(e) => setPaused(!e.target.checked)} />}
              label={paused ? "已暂停日志收集" : "日志收集中"}
            />
            <SimpleTreeView>
              <TreeItem
                itemId="root"
                label={
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isAllChecked()}
                        indeterminate={isAllIndeterminate()}
                        onChange={(e) => handleAllToggle(e.target.checked)}
                      />
                    }
                    label={index}
                  />
                }
              >
                {renderSources()}
              </TreeItem>
            </SimpleTreeView>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
