"use client";
import React, { useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Guacamole from 'guacamole-common-js';

interface Params {
  type: string;
  hostname: string;
  port: string;
}

interface GuacModalProps {
  open: boolean;
  params: Params | null;
  onClose: () => void;
}

export default function GuacModal({ open, params, onClose }: GuacModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !params || !ref.current) return;
    let client: Guacamole.Client | null = null;
    let ignore = false;
    const q = new URLSearchParams(params).toString();
    fetch('/api/guac-token?' + q)
      .then(r => r.json())
      .then(data => {
        if (ignore || !ref.current || !data.token) return;
        const wsBase = window.location.origin.replace(/^http/, 'ws');
        const ws = wsBase + '/api/guac?token=' + encodeURIComponent(data.token);
        const tunnel = new Guacamole.WebSocketTunnel(ws);
        tunnel.onerror = s => console.error('Tunnel error', s);
        client = new Guacamole.Client(tunnel);
        client.onerror = e => console.error('Client error', e);
        client.onstatechange = st => console.log('Client state', st);
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
  }, [open, params]);

  if (!open || !params) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: '80vh', bgcolor: 'common.black' } }}>
      <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', color:'common.white', bgcolor:'common.black', p:1 }}>
        {params.type.toUpperCase()} 控制台
        <IconButton onClick={onClose} size="small" sx={{color:'inherit'}}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p:0 }}>
        <div ref={ref} style={{ width:'100%', height:'100%' }} />
      </DialogContent>
    </Dialog>
  );
}
