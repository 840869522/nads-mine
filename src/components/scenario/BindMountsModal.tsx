import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Slide, useTheme } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import {customFetch} from "@/utils/fetch.ts";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface BindMountsModalProps {
    open: boolean;
    containerId: string | null;
    onClose: () => void;
}

const BindMountsModal: React.FC<BindMountsModalProps> = ({ open, containerId, onClose }) => {
    const [mounts, setMounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const theme = useTheme();

    useEffect(() => {
        if (open && containerId) {
            setLoading(true);
            customFetch(`/api/containers/${containerId}?action=binds`)
                .then(res => res.json())
                .then(setMounts)
                .finally(() => setLoading(false));
        }
    }, [open, containerId]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            TransitionComponent={Transition}
        >
            <DialogTitle sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                绑定挂载
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : mounts.length === 0 ? (
                    <Box sx={{ p: 2 }}>无挂载</Box>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>源</TableCell>
                                <TableCell>目标</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {mounts.map((m, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>{m.Source}</TableCell>
                                    <TableCell>{m.Destination}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="outlined">关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default BindMountsModal;
