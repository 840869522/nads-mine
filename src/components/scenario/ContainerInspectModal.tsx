import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, useTheme, Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const API_BASE = '/back/api';

interface ContainerInspectModalProps {
  open: boolean;
  containerId: string | null;
  onClose: () => void;
}

const ContainerInspectModal: React.FC<ContainerInspectModalProps> = ({ open, containerId, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (open && containerId) {
      setLoading(true);
      fetch(`${API_BASE}/containers/${containerId}/inspect`)
        .then(res => res.json())
        .then(setData)
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
        容器 Inspect
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
            {data ? JSON.stringify(data, null, 2) : '无数据'}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContainerInspectModal;

