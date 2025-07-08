// server.js
// NOTE: The Python FastAPI backend is still launched for legacy routes.
// PHP now directly invokes `main_cli_local.py`, but this file remains
// unchanged to keep existing Node.js functionality working.
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import GuacamoleLite from 'guacamole-lite';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch';
import { spawn as childProcessSpawn } from 'child_process';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import process from 'process';

const GUAC_KEY = process.env.GUAC_KEY || '0123456789abcdef0123456789abcdef';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

//const PYTHON_API_PORT = process.env.PYTHON_API_PORT || 3010;
//const PYTHON_API_HOST = process.env.PYTHON_API_HOST || '127.0.0.1';
//const FASTAPI_TARGET_URL = `http://${PYTHON_API_HOST}:${PYTHON_API_PORT}`;

const PHP_API_PORT = process.env.PHP_API_PORT || 8000;
const PHP_API_HOST = process.env.PHP_API_HOST || '127.0.0.1';
const PHP_TARGET_URL = `http://${PHP_API_HOST}:${PHP_API_PORT}`;

let httpServer;
let guacServer;
//let fastApiProcess = null; // will hold FastAPI child process

// Track all open TCP sockets so we can destroy them on shutdown
const sockets = new Set();

app.prepare().then(() => {
  /* ---------- 1. START (optionally) THE PYTHON BACKEND ---------- */
  //let canRunPythonBackend = false;
  //let pythonExecutable;

  /*
  if (process.platform === 'linux') {
    canRunPythonBackend = true;
    pythonExecutable = path.join(process.cwd(), '.venv', 'bin', 'python3');
    const scriptToRun = 'main_cli.py';

    console.log(`[NodeJS] Starting FastAPI with: ${pythonExecutable} ${scriptToRun}`);

    fastApiProcess = childProcessSpawn(pythonExecutable, [scriptToRun], {
      stdio: 'pipe',
    });

    fastApiProcess.stdout.on('data', (d) => {
      console.log(`[FastAPI STDOUT]: ${d.toString().trim()}`);
    });

    fastApiProcess.stderr.on('data', (d) => {
      console.error(`[FastAPI STDERR]: ${d.toString().trim()}`);
    });

    fastApiProcess.on('close', (code) => {
      console.log(`[FastAPI] exited with code ${code}`);
    });

    fastApiProcess.on('error', (err) => {
      console.error('[FastAPI] failed to start:', err);
    });

    // 让子进程不阻止 Node 退出；我们自己会 kill 它
    fastApiProcess.unref();
  } else {
    console.warn(`[NodeJS] Platform '${process.platform}' detected; FastAPI backend disabled.`);
  }

  //2. PROXY MIDDLEWARE
  const apiProxy = createProxyMiddleware({
    target: FASTAPI_TARGET_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/vms': '/api/vms' },
    logLevel: dev ? 'debug' : 'info',
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Proxy Error', error: err.message }));
      }
    },
  });
  */

  const phpProxy = createProxyMiddleware({
    target: PHP_TARGET_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/php': '/api' },
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
    /*if (req.url && req.url.startsWith('/api/vms')) {
      if (canRunPythonBackend) {
        return apiProxy(req, res, () => handle(req, res));
      }
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Python backend unavailable on this platform.' }));
      return;
    }*/

    if (req.url && req.url.startsWith('/api/php')) {
      return phpProxy(req, res, () => handle(req, res));
    }

    // anything else -> Next.js
    return handle(req, res);
  });

  // guacamole-lite server
  guacServer = new GuacamoleLite(
    { server: httpServer, path: '/api/guac' },
    { port: parseInt(process.env.GUACD_PORT || '4822', 10) },
    {
      crypt: { cypher: 'AES-256-CBC', key: GUAC_KEY },
      allowedUnencryptedConnectionSettings: {
        rdp: ['hostname', 'port', 'username', 'password', 'security', 'ignore-cert'],
        ssh: ['hostname', 'port', 'username', 'password'],
        vnc: ['hostname', 'port', 'password'],
        join: ['id']
      }
    }
  );

  // 记录所有 TCP 连接
  httpServer.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  /* ---------- 4. SOCKET.IO TERMINAL ---------- */
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

    // 1) 关闭 FastAPI
    if (fastApiProcess && !fastApiProcess.killed) {
      console.log('[NodeJS] Killing FastAPI child process…');
      fastApiProcess.kill('SIGINT');
    }

    // 2) 关闭 socket.io (会关闭所有 namespace / room)
    await new Promise((resolve) => io.close(resolve));

    if (guacServer) {
      guacServer.close();
    }

    // 3) 关闭 HTTP 服务器（停止接收新连接）
    await new Promise((resolve) => httpServer.close(resolve));

    // 4) 销毁所有仍然存活的 TCP 连接
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
    //if (canRunPythonBackend) {
    //  console.log(`> FastAPI proxied at http://localhost:${port}/api/vms`);
    //}
    console.log(`> PHP proxied at http://localhost:${PHP_API_PORT}/api/php`);
    console.log(`> Terminal WebSocket at ws://localhost:${port}/api/terminal`);
  });
});
