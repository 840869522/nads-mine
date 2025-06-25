"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { Box, IconButton, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

import '@xterm/xterm/css/xterm.css';

const TERM_WS = 'ws://localhost:8080';

interface ExecTerminalModalProps {
  open: boolean;
  containerId: string | null;
  onClose: () => void;
}

export default function ExecTerminalModal({ open, containerId, onClose }: ExecTerminalModalProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<any>();
  const socketRef = useRef<WebSocket | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<any>(null);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [position, setPosition] = useState(() => ({
    x:
      typeof window !== 'undefined'
        ? window.innerWidth / 2 - 300
        : 0,
    y: 80,
  }));
  const [size, setSize] = useState({ width: 600, height: 400 });
  const prevRef = useRef<{ position: { x: number; y: number }; size: { width: number; height: number } } | null>(null);

  useEffect(() => {
    if (!open || !containerId || !wrapperRef.current) return;
    let term: any;
    let fitAddon: any;
    const container = wrapperRef.current;
    let cancelled = false;
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ]);
      if (cancelled || !container) return;
      container.innerHTML = '';
      term = new Terminal({ convertEol: true });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      const ws = new WebSocket(`${TERM_WS}?id=${containerId}`);
      socketRef.current = ws;

      const sendResize = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));

      ws.onopen = () => {
        term.focus();
        sendResize();
      };
      ws.onmessage = (e) => {
        term.write(e.data);
      };
      ws.onclose = () => term.write('\r\n[connection closed]');
      ws.onerror = () => term.write('\r\n[connection error]');

      term.onData((d: string) => ws.send(JSON.stringify({ type: 'input', data: d })));
      term.onResize(sendResize);
    })();

    return () => {
      cancelled = true;
      socketRef.current?.close();
      termRef.current?.dispose();
      fitAddonRef.current = null;
      if (container) container.innerHTML = '';
    };
  }, [open, containerId]);

  useEffect(() => {
    if (!open || minimized) return;
    fitAddonRef.current?.fit();
    if (termRef.current && socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          type: 'resize',
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        })
      );
    }
  }, [size, maximized, minimized, open]);

  if (!open) return null;

  const paper = (
    <Paper
      sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
      elevation={8}
      ref={dragRef}
    >
      <Box
        className="terminal-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          p: 1,
          cursor: 'move',
        }}
      >
        <Box>{containerId ? `终端 ${containerId.slice(0, 12)}` : '终端'}</Box>
        <Box>
          <IconButton size="small" onClick={() => setMinimized(!minimized)}>
            {minimized ? <OpenInFullIcon fontSize="inherit" /> : <MinimizeIcon fontSize="inherit" />}
          </IconButton>
          {!minimized && (
            <IconButton
              size="small"
              onClick={() => {
                if (maximized) {
                  if (prevRef.current) {
                    setPosition(prevRef.current.position);
                    setSize(prevRef.current.size);
                  }
                  setMaximized(false);
                } else {
                  prevRef.current = { position, size };
                  setPosition({ x: 0, y: 0 });
                  setSize({ width: window.innerWidth, height: window.innerHeight });
                  setMaximized(true);
                }
              }}
            >
              {maximized ? (
                <FullscreenExitIcon fontSize="inherit" />
              ) : (
                <FullscreenIcon fontSize="inherit" />
              )}
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
      </Box>
      {!minimized && (
        <Box sx={{ flex: 1, bgcolor: 'black', position: 'relative' }}>
          <div ref={wrapperRef} style={{ position: 'absolute', inset: 0 }} />
        </Box>
      )}
    </Paper>
  );

  if (minimized) {
    return (
      <Box sx={{ position: 'fixed', bottom: 16, right: 16, width: 240, zIndex: 1300 }} ref={dragRef}>
        {paper}
      </Box>
    );
  }

  if (maximized) {
    return (
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300 }}>{paper}</Box>
    );
  }

  return (
    <Rnd
      size={size}
      position={position}
      onDragStop={(_e, d) => setPosition({ x: d.x, y: d.y })}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        setSize({ width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) });
        setPosition(pos);
      }}
      minWidth={300}
      minHeight={200}
      bounds="window"
      dragHandleClassName="terminal-title"
      style={{ zIndex: 1300, position: 'fixed' }}
    >
      {paper}
    </Rnd>
  );
}
