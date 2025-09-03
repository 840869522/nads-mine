// server.js
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import GuacamoleLite from 'guacamole-lite';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch';
import { createProxyMiddleware } from 'http-proxy-middleware';
import process from 'process';

const GUAC_KEY = process.env.GUAC_KEY || '0123456789abcdef0123456789abcdef';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// --- Port Definitions ---
const MAIN_PORT = parseInt(process.env.PORT || '3000', 10);
const GUAC_INTERNAL_PORT = parseInt(process.env.GUAC_PORT || '3001', 10); // Guac 服务的内部端口
const PHP_API_PORT = process.env.PHP_API_PORT || 8000;

// --- Target URLs for Proxies ---
const GUAC_TARGET_URL = `http://127.0.0.1:${GUAC_INTERNAL_PORT}`;
const PHP_TARGET_URL = `http://127.0.0.1:${PHP_API_PORT}`;

let mainHttpServer;
let guacServer;

const sockets = new Set();

app.prepare().then(() => {
  /* =================================================================
     1. PROXY MIDDLEWARE SETUP
     ================================================================= */

  // PHP 服务的代理
  const phpProxy = createProxyMiddleware({
    target: PHP_TARGET_URL,
    changeOrigin: true,
    pathRewrite: { '^/back/': '/' },
    logLevel: dev ? 'debug' : 'info',
  });

  // 为 Guacamole 服务创建一个新的代理
  // 这个代理会将发往主服务器 /connect-guac 的请求转发到内部的 Guacamole 服务器
  const guacProxy = createProxyMiddleware({
    target: GUAC_TARGET_URL,
    changeOrigin: true,
    ws: true, // 这是最关键的一步: 开启 WebSocket 代理
    logLevel: dev ? 'debug' : 'info',
  });


  /* =================================================================
     2. HTTP SERVER SETUP
     ================================================================= */

  // 主服务器，现在充当 Next.js、Socket.IO 和所有代理的统一入口
  mainHttpServer = createServer((req, res) => {
    const url = req.url || '';
    // 主要改动 (2/3): 如果请求是发往 //connect-guac，则使用 guacProxy 处理
    // 注意: 这个处理器会同时处理普通的 HTTP 请求和 WebSocket 的 upgrade 请求
    if (url.startsWith('/connect-guac')) {
      console.log("find guac req！！！！！！！！！！！！！")
      return guacProxy(req, res);
    }
    if (url.startsWith('/back/')) {
      return phpProxy(req, res);
    }

    // 其他所有请求都由 Next.js 处理
    return handle(req, res);
  });

  // 独立的 Guacamole 服务器 (作为内部服务运行，不对外暴露)
  const guacHttpServer = createServer();
  guacServer = new GuacamoleLite(
      { server: guacHttpServer, path: '/connect-guac' },
      { port: 4822 },
      {
        crypt: { cypher: 'AES-256-CBC', key: GUAC_KEY },
        connectionDefaultSettings: {
          rdp: { 'audio': ['audio/L16'] }
        },
        allowedUnencryptedConnectionSettings: {
          rdp: ['hostname', 'port', 'username', 'password', 'security', 'ignore-cert'],
          ssh: ['hostname', 'port', 'username', 'password'],
          vnc: ['hostname', 'port', 'password'],
          join: ['id','width','height','dpi']
        },
        log: { level: 'DEBUG' },
      }
  );
  guacServer.on('open', c => console.log('[Guac OPEN]', c.connectionId));
  guacServer.on('error', (c,e) => console.error('[Guac ERR]', e));
  guacServer.on('close', (c) =>   console.log('[Guac END]', c.connectionId));
  /* =================================================================
     3. SOCKET.IO AND CONNECTION HANDLING
     ================================================================= */

  mainHttpServer.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  mainHttpServer.on('upgrade', (req, socket, head) => {
    console.log('[upgrade] url=', req.url);
    if (req.url.startsWith('/connect-guac')) {
         // 把升级请求交给同一个 guacProxy 实例处理
      console.log("find guac req！！！！！！！！！！！！！")
   guacProxy.upgrade(req, socket, head);
   } else {
     // 其他 WebSocket（例如 /api/terminal）保持现有逻辑
        console.log('[upgrade] non-guac ws →', req.url);
     }
  });
  const io = new Server(mainHttpServer, { path: '/api/terminal' });

  io.on('connection', (socket) => {
    const id = socket.handshake.query.id;
    if (typeof id !== 'string') {
      socket.disconnect(true);
      return;
    }
    const shell = ptySpawn('docker', ['exec', '-it', id, '/bin/sh'], {
      name: 'xterm-color', cols: 80, rows: 24, cwd: process.env.HOME, env: process.env,
    });
    shell.onData((d) => socket.emit('output', d));
    socket.on('input', (d) => shell.write(d));
    socket.on('resize', ({ cols, rows }) => shell.resize(cols, rows));
    socket.on('disconnect', () => shell.kill());
  });


  /* =================================================================
     4. SHUTDOWN
     ================================================================= */

  async function shutdown() {
    console.log('[NodeJS] Shutting down…');
    await new Promise((resolve) => io.close(resolve));
    if (guacServer) guacServer.close();

    // 确保两个服务器都被关闭
    await new Promise((resolve) => mainHttpServer.close(resolve));
    await new Promise((resolve) => guacHttpServer.close(resolve));

    sockets.forEach((s) => s.destroy());
    console.log('[NodeJS] Cleanup done. Exiting.');
    process.exit(0);
  }

  const FORCE_TIMEOUT = 3000;
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


  /* =================================================================
     5. START SERVERS
     ================================================================= */

  mainHttpServer.listen(MAIN_PORT, () => {
    console.log(`> ✅ Main server ready on http://localhost:${MAIN_PORT}`);
    console.log(`> ➡️  PHP proxied from /back/`);
    console.log(`> ➡️  Guacamole proxied from /connect-guac`);
    console.log(`> ➡️  Terminal WebSocket direct at /api/terminal`);
  });

  guacHttpServer.listen(GUAC_INTERNAL_PORT, () => {
    console.log(`> ⚙️  Internal Guacamole server running on port ${GUAC_INTERNAL_PORT}`);
  });
});