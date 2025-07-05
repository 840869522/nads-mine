// server.js
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch';
import { createProxyMiddleware } from 'http-proxy-middleware';
import process from 'process';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PHP_API_PORT = process.env.PHP_API_PORT || 8000;
const PHP_API_HOST = process.env.PHP_API_HOST || '127.0.0.1';
const PHP_TARGET_URL = `http://${PHP_API_HOST}:${PHP_API_PORT}`;

let httpServer;
// Track all open TCP sockets so we can destroy them on shutdown
const sockets = new Set();

app.prepare().then(() => {
  /* ---------- 1. PROXY MIDDLEWARE ---------- */

  const phpProxy = createProxyMiddleware({
    target: PHP_TARGET_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/php': '/', '^/api/vms': '/vms' },
    logLevel: dev ? 'debug' : 'info',
    onError: (err, req, res) => {
      console.error('PHP Proxy error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'PHP Proxy Error', error: err.message }));
      }
    },
  });

  /* ---------- 3. CREATE HTTP SERVER ---------- */
  httpServer = createServer((req, res) => {
    if (req.url && (req.url.startsWith('/api/php') || req.url.startsWith('/api/vms'))) {
      return phpProxy(req, res, () => handle(req, res));
    }

    // anything else -> Next.js
    return handle(req, res);
  });

  // 记录所有 TCP 连接
  httpServer.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  /* ---------- 2. SOCKET.IO TERMINAL ---------- */
  const io = new Server(httpServer, { path: '/api/terminal' });

  io.on('connection', (socket) => {
    const id = socket.handshake.query.id;
    if (typeof id !== 'string') {
      socket.disconnect(true);
      return;
    }

    const shell = ptySpawn('docker', ['exec', '-it', id, '/bin/sh'], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME,
      env: process.env,
    });

    shell.onData((d) => socket.emit('output', d));
    socket.on('input', (d) => shell.write(d));
    socket.on('resize', ({ cols, rows }) => shell.resize(cols, rows));
    socket.on('disconnect', () => shell.kill());
  });

  /* ---------- 5. GRACEFUL SHUTDOWN ---------- */
  const FORCE_TIMEOUT = 5000; // 5 s 之后强退

  async function shutdown() {
    console.log('[NodeJS] Shutting down…');

    // 1) 关闭 socket.io (会关闭所有 namespace / room)
    await new Promise((resolve) => io.close(resolve));

    // 2) 关闭 HTTP 服务器（停止接收新连接）
    await new Promise((resolve) => httpServer.close(resolve));

    // 3) 销毁所有仍然存活的 TCP 连接
    sockets.forEach((s) => s.destroy());

    console.log('[NodeJS] Cleanup done. Exiting.');
    process.exit(0);
  }

  // 如果关不掉，强制退出
  function forceExit() {
    console.warn('[NodeJS] Forced exit.');
    process.exit(1);
  }

  process.on('SIGINT', () => {
    shutdown().catch(console.error);
    setTimeout(forceExit, FORCE_TIMEOUT).unref();
  });
  process.on('SIGTERM', () => {
    shutdown().catch(console.error);
    setTimeout(forceExit, FORCE_TIMEOUT).unref();
  });

  /* ---------- 6. START THE SERVER ---------- */
  const port = parseInt(process.env.PORT || '3000', 10);
  httpServer.listen(port, () => {
    console.log(`> Node.js server ready on http://localhost:${port}`);
    console.log(`> PHP proxied at http://localhost:${port}/api/php`);
    console.log(`> Terminal WebSocket at ws://localhost:${port}/api/terminal`);
  });
});
