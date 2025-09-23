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
const AI_CHAT_PORT = process.env.AI_CHAT_PORT || 9000;

// NEW: Socket.IO 内部端口
const SOCKETIO_INTERNAL_PORT = parseInt(process.env.SIO_PORT || '3002', 10);

// --- Target URLs for Proxies ---
const GUAC_TARGET_URL = `http://127.0.0.1:${GUAC_INTERNAL_PORT}`;
const PHP_TARGET_URL = `http://127.0.0.1:${PHP_API_PORT}`;
const AI_CHAT_URL = `http://127.0.0.1:${AI_CHAT_PORT}`;
// NEW: Socket.IO 代理目标
const SOCKETIO_TARGET_URL = `http://127.0.0.1:${SOCKETIO_INTERNAL_PORT}`;

let mainHttpServer;
let guacServer;
// NEW: 保存 Socket.IO 内部 HTTP Server
let socketIoHttpServer;

const sockets = new Set();

app.prepare().then(() => {
    /* =================================================================
       1. PROXY MIDDLEWARE SETUP
       ================================================================= */

    // PHP 服务代理
    const phpProxy = createProxyMiddleware({
        target: PHP_TARGET_URL,
        changeOrigin: true,
        pathRewrite: { '^/back/': '/' },
        logLevel: dev ? 'debug' : 'info',
    });

    // AI CHAT SERVER 代理（SSE）
    const aiChatProxy = createProxyMiddleware({
        target: AI_CHAT_URL,
        changeOrigin: true,
        pathRewrite: { '^/chat/': '/' },
        // ws: true,
        logLevel: dev ? 'debug' : 'info',
        onProxyRes(proxyRes, req, res) {
            proxyRes.headers['Content-Type'] = 'text/event-stream';
        },
    });

    // Guacamole 代理（HTTP + WS）
    const guacProxy = createProxyMiddleware({
        target: GUAC_TARGET_URL,
        changeOrigin: true,
        ws: true,
        logLevel: dev ? 'debug' : 'info',
    });

    // NEW: Socket.IO 代理（HTTP + WS）
    const socketioProxy = createProxyMiddleware({
        target: SOCKETIO_TARGET_URL,
        changeOrigin: true,
        ws: true,
        logLevel: dev ? 'debug' : 'info',
    });

    /* =================================================================
       2. HTTP SERVER SETUP
       ================================================================= */

    // 主服务器：统一入口
    mainHttpServer = createServer((req, res) => {
        const url = req.url || '';

        // CHANGED: /socketio/terminal 交给 socketioProxy（支持 polling/XHR）
        if (url.startsWith('/socketio/terminal')) {
            return socketioProxy(req, res);
        }

        if (url.startsWith('/connect-guac')) {
            return guacProxy(req, res);
        }
        if (url.startsWith('/back/')) {
            return phpProxy(req, res);
        }
        if (url.startsWith('/chat/')) {
            return aiChatProxy(req, res);
        }

        // 其他走 Next
        return handle(req, res);
    });

    /* =================================================================
       2.1 Guacamole 内部服务
       ================================================================= */
    const guacHttpServer = createServer();
    guacServer = new GuacamoleLite(
        { server: guacHttpServer, path: '/connect-guac' },
        { port: 4822 },
        {
            crypt: { cypher: 'AES-256-CBC', key: GUAC_KEY },
            connectionDefaultSettings: { rdp: { audio: ['audio/L16'] } },
            allowedUnencryptedConnectionSettings: {
                rdp: ['hostname', 'port', 'username', 'password', 'security', 'ignore-cert'],
                ssh: ['hostname', 'port', 'username', 'password'],
                vnc: ['hostname', 'port', 'password'],
                join: ['id', 'width', 'height', 'dpi'],
            },
            log: { level: 'NORMAL' },
        }
    );
    guacServer.on('open', (c) => console.log('[Guac OPEN]', c.connectionId));
    guacServer.on('error', (c, e) => console.error('[Guac ERR]', e));
    guacServer.on('close', (c) => console.log('[Guac END]', c.connectionId));

    /* =================================================================
       2.2 NEW: Socket.IO 内部服务（独立 http server）
       ================================================================= */
    socketIoHttpServer = createServer();

    // CHANGED: io 不再绑定 mainHttpServer，而是绑定内部 server
    const io = new Server(socketIoHttpServer, { path: '/socketio/terminal' });

    io.on('connection', (socket) => {
        const id = socket.handshake.query.id;
        console.log('find socketio！！！！！！！！！！！！！' + id);
        if (typeof id !== 'string') {
            socket.disconnect(true);
            console.log('[Terminal] No container ID provided. Disconnecting.');
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

    /* =================================================================
       3. CONNECTION & UPGRADE HANDLING
       ================================================================= */

    mainHttpServer.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    mainHttpServer.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        console.log('[upgrade] url=', url);

        // CHANGED: 把 /socketio/terminal 的 WS 升级转发到内部 Socket.IO
        if (url.startsWith('/socketio/terminal')) {
            return socketioProxy.upgrade(req, socket, head);
        }

        if (url.startsWith('/connect-guac')) {
            return guacProxy.upgrade(req, socket, head);
        }

        // 其他 WS（如 Next HMR）让默认处理
        // 不主动处理，避免抢占
    });

    /* =================================================================
       4. SHUTDOWN
       ================================================================= */

    async function shutdown() {
        console.log('[NodeJS] Shutting down…');

        // NEW: 关闭 io（在内部 server 上）
        await new Promise((resolve) => io.close(resolve));
        if (guacServer) guacServer.close();

        // 关闭两个内部 HTTP server 与主 server
        await new Promise((resolve) => mainHttpServer.close(resolve));
        await new Promise((resolve) => socketIoHttpServer.close(resolve)); // NEW
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
        console.log(`> ➡️  AI proxied from /chat/`);
        console.log(`> ➡️  Guacamole proxied from /connect-guac`);
        console.log(`> ➡️  Terminal WebSocket proxied from /socketio/terminal`); // CHANGED
    });

    guacHttpServer.listen(GUAC_INTERNAL_PORT, () => {
        console.log(`> ⚙️  Internal Guacamole server running on port ${GUAC_INTERNAL_PORT}`);
    });

    // NEW: 启动 Socket.IO 内部服务
    socketIoHttpServer.listen(SOCKETIO_INTERNAL_PORT, () => {
        console.log(`> 🔌 Internal Socket.IO server running on port ${SOCKETIO_INTERNAL_PORT} (path: /socketio/terminal)`);
    });
});
