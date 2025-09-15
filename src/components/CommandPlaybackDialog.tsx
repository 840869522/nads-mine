"use client";
import React, { useMemo, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import useSWR from "swr";
import { customFetch } from "@/utils/fetch";

interface HostOption {
    label: string;
    index: string;
}

interface CommandPlaybackDialogProps {
    open: boolean;
    onClose: () => void;
    sceneInstanceId: string | null;
    isAd?: boolean;
}

const fetcher = (url: string) => customFetch(url).then((r) => r.json());

export default function CommandPlaybackDialog({ open, onClose, sceneInstanceId, isAd }: CommandPlaybackDialogProps) {
    const { data: vms } = useSWR(open && sceneInstanceId ? (isAd ? `/back/api/ad/vms/scene/${sceneInstanceId}` : `/back/api/scenariosinstances/${sceneInstanceId}/vms`) : null, fetcher);
    const { data: containers } = useSWR(open && sceneInstanceId ? `/back/api/scenariosinstances/${sceneInstanceId}` : null, fetcher);

    const hostOptions: HostOption[] = useMemo(() => {
        const opts: HostOption[] = [];
        if (vms) {
            opts.push(
                ...vms.map((vm: any) => ({
                    label: `VM: ${vm.name}`,
                    index: `${(vm.scene_instance_id || "")}_${vm.name}`.toLowerCase(),
                }))
            );
        }
        if (containers) {
            opts.push(
                ...containers.map((c: any) => ({
                    label: `容器: ${c.name}`,
                    index: `${(c.scene_instance_id || "")}_${c.name}`.toLowerCase(),
                }))
            );
        }
        return opts;
    }, [vms, containers]);

    const [selectedIndex, setSelectedIndex] = useState<string>("");
    const [groupBy, setGroupBy] = useState<"session" | "user">("session");
    const [filterNoise, setFilterNoise] = useState<boolean>(true);

    const { data: playbackData, isValidating } = useSWR(() =>
        selectedIndex
            ? `/api/command-playback?index=${encodeURIComponent(selectedIndex)}&groupBy=${groupBy}&filterNoise=${filterNoise}`
            : null,
        fetcher
    );

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>指令回放</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                    <FormControl sx={{ minWidth: 200 }} size="small">
                        <InputLabel id="host-select-label">主机</InputLabel>
                        <Select
                            labelId="host-select-label"
                            value={selectedIndex}
                            label="主机"
                            onChange={(e) => setSelectedIndex(e.target.value)}
                        >
                            {hostOptions.map((opt) => (
                                <MenuItem key={opt.index} value={opt.index}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <InputLabel id="group-select-label">分组</InputLabel>
                        <Select
                            labelId="group-select-label"
                            value={groupBy}
                            label="分组"
                            onChange={(e) => setGroupBy(e.target.value as any)}
                        >
                            <MenuItem value="session">会话</MenuItem>
                            <MenuItem value="user">用户</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={<Switch checked={filterNoise} onChange={(e) => setFilterNoise(e.target.checked)} />}
                        label="智能过滤"
                    />
                </Box>
                {isValidating && <CircularProgress />}
                {!isValidating && playbackData && playbackData.groups && playbackData.groups.length === 0 && (
                    <Typography variant="body2">暂无数据</Typography>
                )}
                {!isValidating && playbackData?.groups?.map((group: any) => (
                    <Accordion key={group.key} defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>{group.key}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <List>
                                {group.logs.map((log: any, idx: number) => (
                                    <ListItem key={idx} alignItems="flex-start">
                                        <ListItemText
                                            primary={log.command}
                                            secondary={`[${new Date(log.timestamp).toLocaleString()}] CWD: ${log.cwd}`}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
}

