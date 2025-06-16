"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, CircularProgress, Typography } from '@mui/material';
import '@xterm/xterm/css/xterm.css';

interface ExecTerminalModalProps {
  open: boolean;
  containerId: string | null;
  onClose: () => void;
}

const ExecTerminalModal: React.FC<ExecTerminalModalProps> = ({ open, containerId, onClose }) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<any>();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'closed'>('idle');

  useEffect(() => {
    let term: any;
    let fitAddon: any;
    if (open && containerId && terminalRef.current) {
      setStatus('connecting');
      Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]).then(([m, fit]) => {
        const { Terminal } = m as any;
        const { FitAddon } = fit as any;
        fitAddon = new FitAddon();
        term = new Terminal({ convertEol: true });
        term.loadAddon(fitAddon);
        term.open(terminalRef.current!);
        fitAddon.fit();
        termRef.current = term;
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${protocol}://${window.location.host}/api/containers/${containerId}/exec`);
        wsRef.current = ws;
        const sendResize = () => {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        };
        ws.onopen = () => {
          setStatus('connected');
          term.focus();
          sendResize();
        };
        ws.onmessage = (e) => {
          const data = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
          term.write(data);
        };
        ws.onclose = () => {
          setStatus('closed');
          term.writeln('\r\n[connection closed]');
        };
        ws.onerror = () => setStatus('closed');
        term.onData(data => ws.send(JSON.stringify({ type: 'data', data })));
        term.onResize(sendResize);
        setTimeout(() => fitAddon.fit(), 0);
      }).catch(() => setStatus('closed'));
    }
    return () => {
      wsRef.current?.close();
      termRef.current?.dispose();
      termRef.current = undefined;
    };
  }, [open, containerId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>终端</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ position: 'relative', height: 400, bgcolor: 'black', color: 'white', p: 1 }}>
          <Box ref={terminalRef} sx={{ position: 'absolute', inset: 0 }} />
          {status !== 'connected' && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.6)' }}>
              {status === 'connecting' && (<CircularProgress color="inherit" />)}
              {status === 'closed' && (
                <Typography variant="body2" color="white">连接已关闭</Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExecTerminalModal;
