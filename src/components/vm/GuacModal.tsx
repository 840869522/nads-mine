"use client";
import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Guacamole from 'guacamole-common-js';

interface GuacModalProps {
  open: boolean;
  onClose: () => void;
  type: 'ssh' | 'rdp' | 'vnc';
  hostname: string;
  port: number | string;
}

export default function GuacModal({ open, onClose, type, hostname, port }: GuacModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    let client: Guacamole.Client | null = null;
    let ignore = false;
    const params = new URLSearchParams({ type, hostname, port: String(port) }).toString();
    fetch('/api/guac-token?' + params)
      .then(r => r.json())
      .then(data => {
        if (ignore || !ref.current || !data.token) return;
        const wsBase = window.location.origin.replace(/^http/, 'ws');
        const ws = wsBase + '/api/guac?token=' + encodeURIComponent(data.token);
        const tunnel = new Guacamole.WebSocketTunnel(ws);
        tunnel.onerror = status => console.error('Tunnel error', status);
        client = new Guacamole.Client(tunnel);
        client.onerror = err => console.error('Client error', err);
        client.onstatechange = state => console.log('Client state', state);
        ref.current!.innerHTML = '';
        ref.current!.appendChild(client.getDisplay().getElement());
        client.connect();
      });
    const disconnect = () => client?.disconnect();
    window.addEventListener('beforeunload', disconnect);
    return () => {
      ignore = true;
      window.removeEventListener('beforeunload', disconnect);
      client?.disconnect();
    };
  }, [open, type, hostname, port]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle sx={{ m: 0, p: 1 }}>
        远程连接
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <div ref={ref} style={{ width: '100%', height: '100%', background: '#000' }} />
      </DialogContent>
    </Dialog>
  );
}
