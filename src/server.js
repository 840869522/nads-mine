// server.js
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import GuacamoleLite from 'guacamole-lite';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch';
import { createProxyMiddleware } from 'http-proxy-middleware';
import process from 'process';
import dotenv from "dotenv";
import { Logger, formatLocalTime } from './logger.js';

dotenv.config();

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
        pathRewrite: { "^/chat/": "/" },
        //ws: true,
        logLevel: dev ? 'debug' : 'info',
        onProxyRes(proxyRes, req, res) {
            proxyRes.headers['Content-Type'] = 'text/event-stream';
        }
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
        Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::${req.method} ${req.url}`, {
            method: req.method,
            url: req.url,
            ip: req.socket.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        const url = req.url || '';

        if (url.startsWith('/socketio/terminal')) {
            return;
        }
        if (url.startsWith('/connect-guac')) {
            Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::find guac req！！！！！！！！！！！！！`)
            return guacProxy(req, res);
        }
        if (url.startsWith('/back/')) {
            return phpProxy(req, res);
        }
        if (url.startsWith('/chat/')) {
            return aiChatProxy(req, res);
        }

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
                join: ['id', 'width', 'height', 'dpi']
            },
            log: { level: 'NORMAL' },
        }
    );
    guacServer.on('open', c => Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::[Guac OPEN] \t${c.connectionId}`));
    guacServer.on('error', (c, e) => Logger.error(`[${formatLocalTime()}]::[server.js]::[INFO]::[Guac ERR] \t${e}`));
    guacServer.on('close', (c) => Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::[Guac END] \t${c.connectionId}`));
    /* =================================================================
       3. SOCKET.IO AND CONNECTION HANDLING
       ================================================================= */

    mainHttpServer.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    mainHttpServer.on('upgrade', (req, socket, head) => {
        Logger.log(`[${formatLocalTime()}]::[server.js]::[INFO]::[upgrade] url= ${req.url}`);
        if (req.url.startsWith('/connect-guac')) {
            // 把升级请求交给同一个 guacProxy 实例处理
            Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::find guac req！！！！！！！！！！！！！`)
            guacProxy.upgrade(req, socket, head);
        } else {
            // 其他 WebSocket（例如 /api/terminal）保持现有逻辑
            Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::[upgrade] non-guac ws →', ${req.url}`);
        }
    });
    const io = new Server(mainHttpServer, { path: '/socketio/terminal' });

    io.on('connection', (socket) => {
        const id = socket.handshake.query.id;
        Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::find socketio！！！！！！！！！！！！！ \t ${id}`)
        if (typeof id !== 'string') {
            socket.disconnect(true);
            Logger.error(`[${formatLocalTime()}]::[server.js]::[INFO]::[Terminal] No container ID provided. Disconnecting.`);
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


    /* =================================================================
       4. SHUTDOWN
       ================================================================= */

    async function shutdown() {
        Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::[NodeJS] Shutting down…`);
        await new Promise((resolve) => io.close(resolve));
        if (guacServer) guacServer.close();

        // 确保两个服务器都被关闭
        await new Promise((resolve) => mainHttpServer.close(resolve));
        await new Promise((resolve) => guacHttpServer.close(resolve));

        sockets.forEach((s) => s.destroy());
        Logger.info(`[${formatLocalTime()}]::[server.js]::[INFO]::[NodeJS] Cleanup done. Exiting.`);
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
        Logger.info(`> ✅ Main server ready on http://localhost:${MAIN_PORT}`);
        Logger.info(`> ➡️  PHP proxied from /back/`);
        Logger.info(`> ➡️  AI proxied from /chat/`);
        Logger.info(`> ➡️  Guacamole proxied from /connect-guac`);
        Logger.info(`> ➡️  Terminal WebSocket direct at /socketio/terminal`);
    });

    guacHttpServer.listen(GUAC_INTERNAL_PORT, () => {
        Logger.info(`> ⚙️  Internal Guacamole server running on port ${GUAC_INTERNAL_PORT}`);
    });
});