"use client";
import React, { useEffect, useMemo, useState } from "react";
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
    Snackbar,
    Alert,
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
        "from",
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
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success" as "success" | "error",
    });

    const defaultExpandedItems = useMemo(() => {
        return instances.flatMap((inst) => [
            inst.index,
            ...Object.keys(DEFAULT_FIELDS).map((src) => `${inst.index}-${src}`),
        ]);
    }, [instances]);

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
            .then(async ([containers, vms]) => {
                const list: InstanceInfo[] = [];
                const inc: Record<string, Record<string, string[]>> = {};

                containers.forEach((c: any) => {
                    const index = `${c.scene_instance_id || ""}_${c.name}`.toLowerCase();
                    list.push({ index, name: c.name });
                    inc[index] = createDefaultInclude(); // 先用默认
                });
                vms.forEach((v: any) => {
                    const index = `${v.scene_instance_id || ""}_${v.name}`.toLowerCase();
                    list.push({ index, name: v.name });
                    inc[index] = createDefaultInclude();
                });

                setInstances(list);
                setInclude(inc);

                // —— 新增：尝试读取旧 pipeline 的 include，并覆盖默认 —— //
                try {
                    const results = await Promise.all(
                        list.map(async (inst) => {
                            try {
                                const res = await fetch(
                                    `/api/ingest-control?index=${encodeURIComponent(inst.index)}`
                                );
                                const data = await res.json();
                                if (res.ok && data?.ok && data?.found && data?.include) {
                                    return { index: inst.index, include: data.include as Record<string, string[]> };
                                }
                            } catch (e) {
                                // 忽略单个失败，统一在最后弹 snackbar
                            }
                            return null;
                        })
                    );

                    const anyError = results.some((x) => x === null);
                    const merged = { ...inc };
                    for (const r of results) {
                        if (r && r.include) {
                            // 仅覆盖已知 src（最小改动）
                            const current = merged[r.index] || createDefaultInclude();
                            const updated: Record<string, string[]> = {};
                            for (const src of Object.keys(DEFAULT_FIELDS)) {
                                updated[src] = Array.isArray(r.include[src])
                                    ? r.include[src]
                                    : current[src] || [];
                            }
                            merged[r.index] = updated;
                        }
                    }
                    setInclude(merged);
                    if (anyError) {
                        setSnackbar({
                            open: true,
                            message: "部分实例的旧 pipeline 读取失败，已使用默认规则",
                            severity: "error",
                        });
                    }
                } catch {
                    setSnackbar({
                        open: true,
                        message: "读取旧 pipeline 失败，已使用默认规则",
                        severity: "error",
                    });
                }
            })
            .finally(() => setLoading(false));
    }, [open, sceneInstanceId]);

    const handleFieldToggle = (index: string, src: string, field: string) => {
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

    // —— 新增：src 分组全选/全不选 —— //
    const handleGroupToggle = (index: string, src: string) => {
        setInclude((prev) => {
            const all = DEFAULT_FIELDS[src] || [];
            const current = new Set(prev[index]?.[src] ?? []);
            const isAll = all.every((f) => current.has(f));
            const next = isAll ? [] : all.slice(); // 全不选 / 全选
            return {
                ...prev,
                [index]: { ...prev[index], [src]: next },
            };
        });
    };

    const getGroupCheckedState = (index: string, src: string) => {
        const all = DEFAULT_FIELDS[src] || [];
        const selected = include[index]?.[src] ?? [];
        const total = all.length;
        const count = selected.length;
        return {
            checked: count === total && total > 0,
            indeterminate: count > 0 && count < total,
        };
    };

    const handleApply = async (index: string) => {
        try {
            const res = await fetch("/api/ingest-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ index, include: include[index] }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || res.statusText);
            }
            setSnackbar({ open: true, message: "规则已应用", severity: "success" });
        } catch (err: any) {
            setSnackbar({
                open: true,
                message: err.message || "操作失败",
                severity: "error",
            });
        }
    };

    const handlePause = async (index: string, pause: boolean) => {
        try {
            const body = pause ? { index, pause: true } : { index, include: include[index] };
            const res = await fetch("/api/ingest-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || res.statusText);
            }
            setSnackbar({
                open: true,
                message: pause ? "已停止收集" : "已启动收集",
                severity: "success",
            });
        } catch (err: any) {
            setSnackbar({
                open: true,
                message: err.message || "操作失败",
                severity: "error",
            });
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogTitle>日志收集控制</DialogTitle>
                <DialogContent dividers>
                    {loading ? (
                        <CircularProgress />
                    ) : instances.length > 0 ? (
                        <SimpleTreeView
                            slots={{ collapseIcon: ExpandMoreIcon, expandIcon: ChevronRightIcon }}
                            defaultExpandedItems={defaultExpandedItems}
                        >
                            {instances.map((inst) => (
                                <TreeItem
                                    key={inst.index}
                                    itemId={inst.index}
                                    label={
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            {inst.name}
                                            <Button size="small" onClick={() => handlePause(inst.index, false)}>
                                                启动收集
                                            </Button>
                                            <Button size="small" onClick={() => handlePause(inst.index, true)}>
                                                停止收集
                                            </Button>
                                            <Button size="small" onClick={() => handleApply(inst.index)}>
                                                应用规则
                                            </Button>
                                        </Box>
                                    }
                                >
                                    {Object.entries(DEFAULT_FIELDS).map(([src, fields]) => {
                                        const { checked, indeterminate } = getGroupCheckedState(inst.index, src);
                                        return (
                                            <TreeItem
                                                key={`${inst.index}-${src}`}
                                                itemId={`${inst.index}-${src}`}
                                                label={
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={checked}
                                                                indeterminate={indeterminate}
                                                                onChange={() => handleGroupToggle(inst.index, src)}
                                                            />
                                                        }
                                                        label={src}
                                                    />
                                                }
                                            >
                                                {fields.map((f) => (
                                                    <TreeItem
                                                        key={`${inst.index}-${src}-${f}`}
                                                        itemId={`${inst.index}-${src}-${f}`}
                                                        label={
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={include[inst.index]?.[src]?.includes(f) || false}
                                                                        onChange={() => handleFieldToggle(inst.index, src, f)}
                                                                    />
                                                                }
                                                                label={f}
                                                            />
                                                        }
                                                    />
                                                ))}
                                            </TreeItem>
                                        );
                                    })}
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
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: "100%" }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default IngestControlDialog;
