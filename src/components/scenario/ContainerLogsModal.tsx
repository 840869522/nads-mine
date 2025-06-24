import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress } from '@mui/material';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface ContainerLogsModalProps {
  open: boolean;
  containerId: string | null;
  onClose: () => void;
}

const ContainerLogsModal: React.FC<ContainerLogsModalProps> = ({ open, containerId, onClose }) => {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && containerId) {
      setLoading(true);
      fetch(`${API_BASE}/api/containers/${containerId}?action=logs`)
        .then(res => res.json())
        .then(data => setLogs(data.logs || ''))
        .finally(() => setLoading(false));
    }
  }, [open, containerId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>容器日志</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
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
