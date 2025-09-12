"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Typography,
} from "@mui/material";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import { PlayArrow, Stop } from "@mui/icons-material";
import { customFetch } from "@/utils/fetch";
import { RunningInstance } from "@/types";

interface VmInstance {
  id: string;
  name: string;
  scene_instance_id?: string;
}

interface IngestControlDialogProps {
  open: boolean;
  onClose: () => void;
  instanceId: string | null;
}

const FIELD_SPECS: Record<string, string[]> = {
  snoopy: [
    "timestamp",
    "unixtime",
    "scene_id",
    "log_type",
    "user",
    "session_id",
    "working_dir",
    "full_command",
    "message",
    "uid",
    "sid",
    "tty",
    "cwd",
    "filename",
    "command",
  ],
  zeek_conn: [
    "ts",
    "uid",
    "id.orig_h",
    "id.orig_p",
    "id.resp_h",
    "id.resp_p",
    "proto",
    "service",
    "duration",
    "orig_bytes",
    "resp_bytes",
    "conn_state",
    "local_orig",
    "local_resp",
    "missed_bytes",
    "history",
    "orig_pkts",
    "orig_ip_bytes",
    "resp_pkts",
    "resp_ip_bytes",
    "tunnel_parents",
    "scene_id",
    "from",
  ],
  sysdig: ["message", "scene_id", "from"],
};

const SOURCES = Object.keys(FIELD_SPECS);

interface InstanceItem {
  index: string; // index name
  name: string; // display name
}

const IngestControlDialog: React.FC<IngestControlDialogProps> = ({ open, onClose, instanceId }) => {
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selected, setSelected] = useState<Record<string, Record<string, Set<string>>>>({});

  const buildIndexName = (sceneId: string | undefined, name: string) =>
    `${sceneId || ""}_${name}`.toLowerCase();

  const fetchInstances = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const [containerRes, vmRes] = await Promise.all([
        customFetch(`/back/api/scenariosinstances/${instanceId}`),
        customFetch(`/back/api/scenariosinstances/${instanceId}/vms`),
      ]);
      const containers: RunningInstance[] = containerRes.ok ? await containerRes.json() : [];
      const vms: VmInstance[] = vmRes.ok ? await vmRes.json() : [];
      const items: InstanceItem[] = [];
      const initial: Record<string, Record<string, Set<string>>> = {};
      containers.forEach((c) => {
        const index = buildIndexName(c.scene_instance_id, c.name);
        items.push({ index, name: c.name });
        initial[index] = {
          snoopy: new Set(FIELD_SPECS.snoopy),
          zeek_conn: new Set(FIELD_SPECS.zeek_conn),
          sysdig: new Set(FIELD_SPECS.sysdig),
        };
      });
      vms.forEach((v) => {
        const index = buildIndexName(v.scene_instance_id, v.name);
        items.push({ index, name: v.name });
        initial[index] = {
          snoopy: new Set(FIELD_SPECS.snoopy),
          zeek_conn: new Set(FIELD_SPECS.zeek_conn),
          sysdig: new Set(FIELD_SPECS.sysdig),
        };
      });
      setInstances(items);
      setSelected(initial);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (open) {
      fetchInstances();
    }
  }, [open, fetchInstances]);

  const toggleField = (idx: string, src: string, field: string, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      const srcSet = new Set(next[idx][src]);
      if (checked) srcSet.add(field); else srcSet.delete(field);
      next[idx] = { ...next[idx], [src]: srcSet };
      return next;
    });
  };

  const toggleSource = (idx: string, src: string, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      next[idx] = {
        ...next[idx],
        [src]: checked ? new Set(FIELD_SPECS[src]) : new Set(),
      };
      return next;
    });
  };

  const toggleInstance = (idx: string, checked: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      const value = checked ?
        {
          snoopy: new Set(FIELD_SPECS.snoopy),
          zeek_conn: new Set(FIELD_SPECS.zeek_conn),
          sysdig: new Set(FIELD_SPECS.sysdig),
        } : {
          snoopy: new Set(),
          zeek_conn: new Set(),
          sysdig: new Set(),
        };
      next[idx] = value;
      return next;
    });
  };

  const isSourceChecked = (idx: string, src: string) => {
    const selectedFields = selected[idx]?.[src];
    if (!selectedFields) return false;
    return selectedFields.size === FIELD_SPECS[src].length;
  };

  const isSourceIndeterminate = (idx: string, src: string) => {
    const selectedFields = selected[idx]?.[src];
    if (!selectedFields) return false;
    return selectedFields.size > 0 && selectedFields.size < FIELD_SPECS[src].length;
  };

  const isInstanceChecked = (idx: string) => SOURCES.every((s) => isSourceChecked(idx, s));
  const isInstanceIndeterminate = (idx: string) => !isInstanceChecked(idx) && SOURCES.some((s) => selected[idx]?.[s]?.size);

  const sendRequest = async (body: any) => {
    await fetch("/api/ingest-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  const handleStart = async (idx: string) => {
    const include = Object.fromEntries(
      SOURCES.map((s) => [s, Array.from(selected[idx][s])])
    );
    await sendRequest({ index: idx, include });
  };

  const handleStop = async (idx: string) => {
    await sendRequest({ index: idx, pause: true });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>日志收集控制</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : instances.length === 0 ? (
          <Typography>暂无实例</Typography>
        ) : (
          <SimpleTreeView>
            {instances.map((inst) => (
              <TreeItem
                key={inst.index}
                itemId={inst.index}
                label={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isInstanceChecked(inst.index)}
                          indeterminate={isInstanceIndeterminate(inst.index)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => toggleInstance(inst.index, e.target.checked)}
                        />
                      }
                      label={inst.name}
                    />
                    <Button
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStart(inst.index);
                      }}
                    >
                      启动
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Stop />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStop(inst.index);
                      }}
                    >
                      停止
                    </Button>
                  </Box>
                }
              >
                {SOURCES.map((src) => (
                  <TreeItem
                    key={`${inst.index}-${src}`}
                    itemId={`${inst.index}-${src}`}
                    label={
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isSourceChecked(inst.index, src)}
                            indeterminate={isSourceIndeterminate(inst.index, src)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => toggleSource(inst.index, src, e.target.checked)}
                          />
                        }
                        label={src}
                      />
                    }
                  >
                    {FIELD_SPECS[src].map((f) => (
                      <TreeItem
                        key={`${inst.index}-${src}-${f}`}
                        itemId={`${inst.index}-${src}-${f}`}
                        label={
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={selected[inst.index]?.[src]?.has(f) || false}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => toggleField(inst.index, src, f, e.target.checked)}
                              />
                            }
                            label={f}
                          />
                        }
                      />
                    ))}
                  </TreeItem>
                ))}
              </TreeItem>
            ))}
          </SimpleTreeView>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default IngestControlDialog;
