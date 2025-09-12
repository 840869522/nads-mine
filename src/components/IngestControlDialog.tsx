"use client";
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { customFetch } from "@/utils/fetch";

const API_BASE = "/back";

const DEFAULT_FIELDS: Record<string, string[]> = {
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

function createDefaultInclude(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(DEFAULT_FIELDS).map(([k, v]) => [k, [...v]])
  );
}

interface IngestControlDialogProps {
  open: boolean;
  onClose: () => void;
  sceneInstanceId: string | null;
}

interface InstanceInfo {
  index: string;
  name: string;
}

const IngestControlDialog: React.FC<IngestControlDialogProps> = ({
  open,
  onClose,
  sceneInstanceId,
}) => {
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [include, setInclude] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !sceneInstanceId) return;
    setLoading(true);
    Promise.all([
      customFetch(`${API_BASE}/api/scenariosinstances/${sceneInstanceId}`).then((r) =>
        r.ok ? r.json() : []
      ),
      customFetch(
        `${API_BASE}/api/scenariosinstances/${sceneInstanceId}/vms`
      ).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([containers, vms]) => {
        const list: InstanceInfo[] = [];
        const inc: Record<string, Record<string, string[]>> = {};
        containers.forEach((c: any) => {
          const index = `${c.scene_instance_id || ""}_${c.name}`.toLowerCase();
          list.push({ index, name: c.name });
          inc[index] = createDefaultInclude();
        });
        vms.forEach((v: any) => {
          const index = `${v.scene_instance_id || ""}_${v.name}`.toLowerCase();
          list.push({ index, name: v.name });
          inc[index] = createDefaultInclude();
        });
        setInstances(list);
        setInclude(inc);
      })
      .finally(() => setLoading(false));
  }, [open, sceneInstanceId]);

  const handleFieldToggle = (
    index: string,
    src: string,
    field: string
  ) => {
    setInclude((prev) => {
      const fields = new Set(prev[index]?.[src] ?? []);
      if (fields.has(field)) fields.delete(field);
      else fields.add(field);
      return {
        ...prev,
        [index]: { ...prev[index], [src]: Array.from(fields) },
      };
    });
  };

  const handleApply = async (index: string) => {
    await fetch("/api/ingest-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, include: include[index] }),
    });
  };

  const handlePause = async (index: string, pause: boolean) => {
    const body = pause
      ? { index, pause: true }
      : { index, include: include[index] };
    await fetch("/api/ingest-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>日志收集控制</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <CircularProgress />
        ) : instances.length > 0 ? (
          <SimpleTreeView
            slots={{ collapseIcon: ExpandMoreIcon, expandIcon: ChevronRightIcon }}
            defaultExpanded={instances.flatMap((inst) => [
              inst.index,
              ...Object.keys(DEFAULT_FIELDS).map((src) => `${inst.index}-${src}`),
            ])}
          >
            {instances.map((inst) => (
              <TreeItem
                key={inst.index}
                itemId={inst.index}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {inst.name}
                    <Button
                      size="small"
                      onClick={() => handlePause(inst.index, false)}
                    >
                      启动收集
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handlePause(inst.index, true)}
                    >
                      停止收集
                    </Button>
                    <Button size="small" onClick={() => handleApply(inst.index)}>
                      应用规则
                    </Button>
                  </Box>
                }
              >
                {Object.entries(DEFAULT_FIELDS).map(([src, fields]) => (
                  <TreeItem
                    key={`${inst.index}-${src}`}
                    itemId={`${inst.index}-${src}`}
                    label={src}
                  >
                    {fields.map((f) => (
                      <TreeItem
                        key={`${inst.index}-${src}-${f}`}
                        itemId={`${inst.index}-${src}-${f}`}
                        label={
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={
                                  include[inst.index]?.[src]?.includes(f) || false
                                }
                                onChange={() =>
                                  handleFieldToggle(inst.index, src, f)
                                }
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
        ) : (
          <Box sx={{ color: "text.secondary" }}>暂无实例可配置</Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default IngestControlDialog;
