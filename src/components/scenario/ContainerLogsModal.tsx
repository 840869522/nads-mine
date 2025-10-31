import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, useTheme, Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import {customFetch} from "@/utils/fetch.ts";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ContainerLogsModalProps {
    open: boolean;
    containerId: string | null;
    onClose: () => void;
}

const ContainerLogsModal: React.FC<ContainerLogsModalProps> = ({ open, containerId, onClose }) => {
    const [logs, setLogs] = useState('');
    const [loading, setLoading] = useState(false);
    const theme = useTheme();

    useEffect(() => {
        if (open && containerId) {
            setLoading(true);
            customFetch(`/api/containers/${containerId}?action=logs`)
                .then(res => res.json())
                .then(data => setLogs(data.logs || ''))
                .finally(() => setLoading(false));
        }
    }, [open, containerId]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            TransitionComponent={Transition}
        >
            <DialogTitle sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                容器日志
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box
                        component="pre"
                        sx={{
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                            p: 2,
                            m: 0,
                            overflow: 'auto',
                        }}
                    >
                        {logs || '无日志'}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="outlined">关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ContainerLogsModal;
