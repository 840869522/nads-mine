"use client";
import React, { useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Guacamole from 'guacamole-common-js';

// ... interface GuacModalProps ...

export default function GuacModal({ open, onClose, type, hostname, port }: GuacModalProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 关键检查点
        if (!open || !ref.current) {
            // 如果因为这个原因退出，我们也需要知道
            // alert(`useEffect exited early. open=${open}, ref.current=${ref.current}`);
            return;
        }

        // [金丝雀测试] 使用 alert 强制弹窗，它不可能被忽略
        alert('GuacModal useEffect IS RUNNING!');

        let client: Guacamole.Client | null = null;
        let ignore = false;

        const params = new URLSearchParams({ type, hostname, port: String(port) }).toString();

        alert(`Step 1: Fetching token with params: ${params}`);

        fetch('/api/guac-token?' + params)
            .then(r => r.json())
            .then(data => {
                alert(`Step 2: Token fetch returned. Data has token: ${!!data.token}`);
                if (ignore || !ref.current || !data.token) return;

                const wsBase = window.location.origin.replace(/^http/, 'ws');
                const ws = wsBase + '/api/guac?token=' + encodeURIComponent(data.token);

                alert(`Step 3: Connecting WebSocket to: ${ws}`);

                const tunnel = new Guacamole.WebSocketTunnel(ws);
                tunnel.onerror = status => alert(`Tunnel ERROR: ${JSON.stringify(status)}`);
                client = new Guacamole.Client(tunnel);
                client.onerror = err => alert(`Client ERROR: ${JSON.stringify(err)}`);
                client.onstatechange = state => console.log('Client state', state); // 状态变化仍然用 console, alert太烦
                ref.current!.innerHTML = '';
                ref.current!.appendChild(client.getDisplay().getElement());
                client.connect();
                alert('Step 4: client.connect() has been called.');
            })
            .catch(err => {
                alert(`CRITICAL ERROR: Token fetch failed! ${err.message}`);
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


