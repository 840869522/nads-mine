import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box } from '@mui/material';

const LOG_WS = 'ws://localhost:8080';

interface ContainerLogsModalProps {
  open: boolean;
  containerId: string | null;
  onClose: () => void;
}

const ContainerLogsModal: React.FC<ContainerLogsModalProps> = ({ open, containerId, onClose }) => {
  const [logs, setLogs] = useState('');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!open || !containerId) return;
    setLogs('');
    const ws = new WebSocket(`${LOG_WS}?mode=logs&id=${containerId}`);
    socketRef.current = ws;
    ws.onmessage = e => setLogs(l => l + e.data);
    return () => ws.close();
  }, [open, containerId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>容器日志</DialogTitle>
      <DialogContent dividers>
        <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {logs || '无日志'}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContainerLogsModal;
