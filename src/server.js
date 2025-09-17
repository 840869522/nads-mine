// server.js
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import GuacamoleLite from 'guacamole-lite';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch';
import { createProxyMiddleware } from 'http-proxy-middleware';
import process from 'process';
import axios from 'axios'; // （未使用，仅保留）

const GUAC_KEY = process.env.GUAC_KEY || '0123456789abcdef0123456789abcdef';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// --- Port Definitions ---
const MAIN_PORT = parseInt(process.env.PORT || '3000', 10);
const GUAC_INTERNAL_PORT = parseInt(process.env.GUAC_PORT || '3001', 10); // Guac 服务的内部端口
const PHP_API_PORT = process.env.PHP_API_PORT || 8000;
const AI_CHAT_PORT = process.env.AI_CHAT_PORT || 9000;
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8080; // WebSocket 服务端口

// --- Target URLs for Proxies ---
const GUAC_TARGET_URL = `http://127.0.0.1:${GUAC_INTERNAL_PORT}`;
const PHP_TARGET_URL = `http://127.0.0.1:${PHP_API_PORT}`;
const AI_CHAT_URL = `http://127.0.0.1:${AI_CHAT_PORT}`;
const WEBSOCKET_TARGET_URL = `http://127.0.0.1:${WEBSOCKET_PORT}`; // WebSocket 目标URL

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
        pathRewrite: {
            '^/back/': '/',
            // '^/api/': '/'
        },
        logLevel: dev ? 'debug' : 'info',
    });

    // AI CHAT SERVER PROXY（SSE）
    const aiChatProxy = createProxyMiddleware({
        target: AI_CHAT_URL,
        changeOrigin: true,
        pathRewrite: { '^/chat/': '/' },
        ws: true,
        logLevel: dev ? 'debug' : 'info',
        onProxyRes(proxyRes) {
            proxyRes.headers['Content-Type'] = 'text/event-stream';
        },
    });

    // Guacamole 服务代理（WebSocket）
    const guacProxy = createProxyMiddleware({
        target: GUAC_TARGET_URL,
        changeOrigin: true,
        ws: true,
        logLevel: dev ? 'debug' : 'info',
        // ★ 关键：避免长连被动超时或在升级后注入错误页
        timeout: 0,
        proxyTimeout: 0,
        onError(err, req, res) {
            console.error('[WS proxy error][guac]:', err.message);
            if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('WS proxy error');
            }
        },
        onProxyReqWs(proxyReq, req, socket) {
            proxyReq.setHeader('Connection', 'Upgrade');
            proxyReq.setHeader('Upgrade', 'websocket');
            socket.setKeepAlive?.(true, 30_000);
            socket.setNoDelay?.(true);
        },
    });

    // WebSocket 代理 - 将 WebSocket 请求代理到 Workerman 服务器
    const websocketProxy = createProxyMiddleware({
        target: WEBSOCKET_TARGET_URL,
        changeOrigin: true,
        ws: true,
        logLevel: dev ? 'debug' : 'info',
        timeout: 0,
        proxyTimeout: 0,
        onError: (err, req, res) => {
            console.error('[WS proxy error][/ws]:', err.message);
            if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('WS proxy error');
            }
        },
        onProxyReqWs: (proxyReq, req, socket) => {
            console.log('WebSocket 代理请求:', req.url);
            proxyReq.setHeader('Connection', 'Upgrade');
            proxyReq.setHeader('Upgrade', 'websocket');
            socket.setKeepAlive?.(true, 30_000);
            socket.setNoDelay?.(true);
        },
    });

    /* =================================================================
       2. HTTP SERVER SETUP
       ================================================================= */

    // 主服务器，现在充当 Next.js、Socket.IO 和所有代理的统一入口
    mainHttpServer = createServer((req, res) => {
        const url = req.url || '';

        // ★ 关键：让 Socket.IO 自己处理 /api/terminal 的握手/轮询/升级，避免被 Next 误处理
        if (url.startsWith('/api/terminal')) {
            return; // 不写响应，交给 Socket.IO 挂在同一 server 上的监听器
        }

        if (url.startsWith('/connect-guac')) {
            console.log('find guac req！！！！！！！！！！！！！');
            return guacProxy(req, res);
        }
        if (url.startsWith('/back/')) {
            return phpProxy(req, res);
        }
        if (url.startsWith('/chat/')) {
            return aiChatProxy(req, res);
        }
        if (url.startsWith('/ws')) {
            return websocketProxy(req, res);
        }

        // 其他所有请求都由 Next.js 处理
        return handle(req, res);
    });

    // ★ 放大/关闭可能影响升级/长连的超时
    mainHttpServer.requestTimeout = 0; // 不对请求总时长限时
    mainHttpServer.headersTimeout = 0; // 不对 header 限时（避免偶发影响升级）

    // 独立的 Guacamole 服务器 (作为内部服务运行，不对外暴露)
    const guacHttpServer = createServer();
    guacServer = new GuacamoleLite(
        { server: guacHttpServer, path: '/connect-guac' },
        { port: 4822 },
        {
            crypt: { cypher: 'AES-256-CBC', key: GUAC_KEY },
            connectionDefaultSettings: {
                rdp: { audio: ['audio/L16'] },
            },
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
       3. SOCKET.IO AND CONNECTION HANDLING
       ================================================================= */

    mainHttpServer.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    mainHttpServer.on('upgrade', (req, socket, head) => {
        console.log('[upgrade] url=', req.url);
        socket.setKeepAlive?.(true, 30_000);
        socket.setNoDelay?.(true);

        if (req.url.startsWith('/connect-guac')) {
            // 把升级请求交给 guacProxy 处理
            console.log('find guac req！！！！！！！！！！！！！');
            guacProxy.upgrade(req, socket, head);
        } else if (req.url.startsWith('/ws')) {
            // WebSocket 代理到 Workerman 服务器
            console.log('[upgrade] WebSocket proxy to Workerman:', req.url);
            websocketProxy.upgrade(req, socket, head);
        }
        // /api/terminal 的 upgrade 让 Socket.IO 自己接手
    });

    // ★ Socket.IO（仅 WebSocket、稳定心跳、关闭压缩）
    const io = new Server(mainHttpServer, {
        path: '/api/terminal',
        transports: ['websocket'],
        pingInterval: 25_000,
        pingTimeout: 20_000,
        perMessageDeflate: false,
        maxHttpBufferSize: 1e6,
        cors: { origin: true, credentials: true },
    });

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
        console.log(`> ➡️  PHP proxied from /back/ and /api/`);
        console.log(`> ➡️  AI proxied from /chat/`);
        console.log(`> ➡️  Guacamole proxied from /connect-guac`);
        console.log(`> ➡️  WebSocket proxied from /ws`);
        console.log(`> ➡️  Terminal WebSocket direct at /api/terminal`);
    });

    guacHttpServer.listen(GUAC_INTERNAL_PORT, () => {
        console.log(`> ⚙️  Internal Guacamole server running on port ${GUAC_INTERNAL_PORT}`);
    });
});
