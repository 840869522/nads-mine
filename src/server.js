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

// --- Target URLs for Proxies ---
const GUAC_TARGET_URL = `http://127.0.0.1:${GUAC_INTERNAL_PORT}`;
const PHP_TARGET_URL = `http://127.0.0.1:${PHP_API_PORT}`;
const AI_CHAT_URL = `http://127.0.0.1:${AI_CHAT_PORT}`;

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

    // AI CHAT SERVER PROXY
    const aiChatProxy = createProxyMiddleware({
        target: AI_CHAT_URL,
        changeOrigin: true,
        pathRewrite : {"^/chat/" : "/"},
        logLevel: dev ? 'debug' : 'info',
        onProxyRes(proxyRes, req, res) {
            proxyRes.headers['Content-Type'] = 'text/event-stream';
        }
    });

    // 为 Guacamole 服务创建一个新的代理
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
        if (url.startsWith('/socketio/terminal')) {
            return ;
        }
        if (url.startsWith('/socketio/drone-control')) { // NEW
            return ;
        }
        if (url.startsWith('/connect-guac')) {
            console.log("find guac req！！！！！！！！！！！！！")
            return guacProxy(req, res);
        }
        if (url.startsWith('/back/')) {
            return phpProxy(req, res);
        }
        if (url.startsWith('/chat/')) {
            return aiChatProxy(req,res);
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
            log: { level: 'NORMAL' },
        }
    );
    guacServer.on('open', c => console.log('[Guac OPEN]', c.connectionId));
    guacServer.on('error', (c,e) => console.error('[Guac ERR]', e));
    guacServer.on('close', (c) =>   console.log('[Guac END]', c.connectionId));

    /* =================================================================
       3. SOCKET.IO AND CONNECTION HANDLING
       ================================================================= */

    // 现有 Socket.IO 处理终端连接
    mainHttpServer.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    // WebSocket 升级请求处理
    mainHttpServer.on('upgrade', (req, socket, head) => {
        console.log('[upgrade] url=', req.url);
        if (req.url.startsWith('/connect-guac')) {
            // 把升级请求交给同一个 guacProxy 实例处理
            guacProxy.upgrade(req, socket, head);
        } else {
            console.log('[upgrade] non-guac ws →', req.url);
        }
    });

    // 现有终端 Socket.IO
    const io = new Server(mainHttpServer, { path: '/socketio/terminal' });
    io.on('connection', (socket) => {
        const id = socket.handshake.query.id;
        console.log("find socketio！！！！！！！！！！！！！"+id)
        if (typeof id !== 'string') {
            socket.disconnect(true);
            console.log('[Terminal] No container ID provided. Disconnecting.');
            return;
        }
        const shell = ptySpawn('docker', ['exec', '-it', id, '/bin/bash'], {
            name: 'xterm-color', cols: 80, rows: 24, cwd: process.env.HOME, env: process.env,
        });
        shell.onData((d) => socket.emit('output', d));
        socket.on('input', (d) => shell.write(d));
        socket.on('resize', ({ cols, rows }) => shell.resize(cols, rows));
        socket.on('disconnect', () => shell.kill());
    });

    // NEW: 第二个 Socket.IO 服务用于无人机控制
    const ioDrone = new Server(mainHttpServer, { path: '/socketio/drone-control' });
    ioDrone.on('connection', (socket) => {
        const session = typeof socket.handshake.query.session === 'string'
            ? socket.handshake.query.session : 'default';
        console.log('[Drone] client connected:', session);

        // 示例事件：接收控制指令、状态查询等
        socket.on('command', (cmd) => {
            // TODO: 将 cmd 转发到你的无人机控制层
            socket.emit('ack', { ok: true, received: cmd });
        });
        socket.on('ping-drone', () => socket.emit('pong-drone'));
        socket.on('disconnect', () => console.log('[Drone] client disconnected:', session));
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
        console.log(`> ➡️  AI proxied from /chat/`);
        console.log(`> ➡️  Guacamole proxied from /connect-guac`);
        console.log(`> ➡️  Terminal WebSocket direct at /socketio/terminal`);
        console.log(`> ➡️  Drone control WebSocket direct at /socketio/drone-control`); // NEW
    });

    guacHttpServer.listen(GUAC_INTERNAL_PORT, () => {
        console.log(`> ⚙️  Internal Guacamole server running on port ${GUAC_INTERNAL_PORT}`);
    });
});
