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

/* ----------------------- Ports ----------------------- */
const MAIN_PORT      = parseInt(process.env.PORT || '3000', 10);
const TERMINAL_PORT  = parseInt(process.env.TERMINAL_PORT || '3100', 10); // ★ 新增：终端独立端口
const GUAC_INTERNAL_PORT = parseInt(process.env.GUAC_PORT || '3001', 10);
const PHP_API_PORT   = parseInt(process.env.PHP_API_PORT || '8000', 10);
const AI_CHAT_PORT   = parseInt(process.env.AI_CHAT_PORT || '9000', 10);
const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '8080', 10);

/* -------------------- Proxy Targets ------------------ */
const GUAC_TARGET_URL     = `http://127.0.0.1:${GUAC_INTERNAL_PORT}`;
const PHP_TARGET_URL      = `http://127.0.0.1:${PHP_API_PORT}`;
const AI_CHAT_URL         = `http://127.0.0.1:${AI_CHAT_PORT}`;
const WEBSOCKET_TARGET_URL= `http://127.0.0.1:${WEBSOCKET_PORT}`;
const TERMINAL_TARGET_URL = `http://127.0.0.1:${TERMINAL_PORT}`; // ★ 代理到终端服务

let mainHttpServer;
let terminalHttpServer;
let guacServer;

const sockets = new Set();

function now() { return new Date().toISOString(); }
function ipOf(req) {
    return (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
        || req.socket?.remoteAddress
        || 'unknown';
}

/* -------------------- Terminal Server -------------------- */
/**
 * 终端 Socket.IO 独立服务（只接受 WebSocket；HTTP 一律 426）
 * 注意：这里的 path 设置为 "/"；主站代理层会把外部的 "/api/terminal" 改写为 "/"
 */
function startTerminalServer() {
    terminalHttpServer = createServer((req, res) => {
        // 非升级请求一律 426，避免任何悬空/误打
        res.writeHead(426, {
            'Content-Type': 'text/plain',
            'Connection': 'close',
            'Upgrade': 'websocket',
        });
        res.end('WebSocket upgrade required (terminal)');
    });
    terminalHttpServer.requestTimeout = 0;
    terminalHttpServer.headersTimeout = 0;

    const io = new Server(terminalHttpServer, {
        path: '/',                         // ★ 终端服务内部用根路径
        transports: ['websocket'],         // 只用 WebSocket，简化链路
        pingInterval: 25_000,
        pingTimeout: 20_000,
        perMessageDeflate: false,
        maxHttpBufferSize: 1e6,
        allowEIO3: false,                  // 明确只允许 EIO=4
        cors: { origin: true, credentials: true },
        allowRequest: (req, cb) => {
            try {
                // 这里的 req.url 已是被代理改写后的 '/'，但 query 仍保留
                const u = new URL(req.url, 'http://local'); // 仅用于解析
                const id = u.searchParams.get('id');
                const ip = ipOf(req);
                console.log(`[${now()}][TERM allowRequest] url=${req.url} ip=${ip} ua=${req.headers['user-agent']}`);

                // ★ 你可以根据自己的实际规则更严格地校验
                if (!id)         return cb('missing id', false);
                //if (!/^[a-f0-9]{32,128}$/i.test(id)) return cb('bad id format', false);

                // TODO: 如果有鉴权/签名校验（例如 JWT/一次性 token），在这里判定
                // if (!verifyToken(...)) return cb('unauthorized', false);

                return cb(null, true);
            } catch (e) {
                console.error(`[${now()}][TERM allowRequest ERR]`, e);
                return cb('bad request', false);
            }
        },
    });

    // Engine.IO 级别的详细日志
    io.engine.on('initial_headers', (headers, req) => {
        console.log(`[${now()}][TERM EIO initial_headers] ip=${ipOf(req)} url=${req.url}`);
    });
    io.engine.on('headers', (headers, req) => {
        console.log(`[${now()}][TERM EIO headers] ip=${ipOf(req)} url=${req.url}`);
    });
    io.engine.on('connection_error', (err) => {
        console.error(`[${now()}][TERM EIO connection_error]`, {
            code: err.code, message: err.message, context: err.context
        });
    });

    io.on('connection', (socket) => {
        try {
            const { query, auth } = socket.handshake;
            const id = typeof query.id === 'string' ? query.id : (auth?.id ?? undefined);
            const addr = socket.handshake.address;
            console.log(`[${now()}][TERM connected] sid=${socket.id} ip=${addr} id=${id}`);

            if (!id || !/^[a-f0-9]{32,128}$/i.test(id)) {
                console.warn(`[${now()}][TERM invalid id] sid=${socket.id} id=${String(id)}`);
                socket.emit('error', 'invalid id');
                socket.disconnect(true);
                return;
            }

            // 启动 docker exec 的伪终端
            const shell = ptySpawn('docker', ['exec', '-it', id, '/bin/sh'], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: process.env.HOME,
                env: process.env,
            });

            console.log(`[${now()}][PTY spawn] sid=${socket.id} pid=${shell.pid} id=${id}`);

            // 输出 -> 前端
            shell.onData((d) => {
                // 防止异常爆栈：一次性数据过大时截断并记录
                if (d && d.length > 64 * 1024) {
                    console.warn(`[${now()}][PTY large chunk] len=${d.length} sid=${socket.id}`);
                }
                socket.emit('output', d);
            });

            shell.onExit((e) => {
                console.log(`[${now()}][PTY exit] sid=${socket.id} code=${e.exitCode} signal=${e.signal}`);
                try { socket.emit('exit', { code: e.exitCode, signal: e.signal }); } catch {}
                try { socket.disconnect(true); } catch {}
            });

            // 输入 -> PTY
            socket.on('input', (d) => {
                if (typeof d !== 'string') return;
                shell.write(d);
            });

            socket.on('resize', ({ cols, rows }) => {
                if (Number.isFinite(cols) && Number.isFinite(rows)) {
                    shell.resize(cols, rows);
                }
            });

            socket.on('disconnect', (reason) => {
                console.log(`[${now()}][TERM disconnect] sid=${socket.id} reason=${reason}`);
                try { shell.kill(); } catch {}
            });

            socket.on('error', (e) => {
                console.error(`[${now()}][TERM socket error] sid=${socket.id}`, e);
            });
        } catch (e) {
            console.error(`[${now()}][TERM connection handler ERR]`, e);
            try { socket.emit('error', 'internal error'); } catch {}
            try { socket.disconnect(true); } catch {}
        }
    });

    // 健康/资源监控日志
    setInterval(() => {
        const mu = process.memoryUsage();
        console.log(`[${now()}][TERM health] rssMB=${(mu.rss/1048576)|0} heapMB=${(mu.heapUsed/1048576)|0}`);
    }, 60_000).unref();

    terminalHttpServer.listen(TERMINAL_PORT, () => {
        console.log(`> ⚙️  Terminal server listening on http://127.0.0.1:${TERMINAL_PORT} (internal)`);
    });

    return io;
}

/* ---------------------- Main Server ---------------------- */
app.prepare().then(() => {
    // 1) 先启动终端独立服务
    const ioTerminal = startTerminalServer();

    // 2) 代理中间件
    const phpProxy = createProxyMiddleware({
        target: PHP_TARGET_URL,
        changeOrigin: true,
        pathRewrite: { '^/back/': '/' },
        logLevel: dev ? 'debug' : 'info',
    });

    // SSE 不需要 ws:true（保留也无碍）
    const aiChatProxy = createProxyMiddleware({
        target: AI_CHAT_URL,
        changeOrigin: true,
        pathRewrite: { '^/chat/': '/' },
        logLevel: dev ? 'debug' : 'info',
        onProxyRes(proxyRes) {
            proxyRes.headers['Content-Type'] = 'text/event-stream';
        },
    });

    const guacProxy = createProxyMiddleware({
        target: GUAC_TARGET_URL,
        changeOrigin: true,
        ws: true,
        logLevel: dev ? 'debug' : 'info',
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
            console.log(`[${now()}][/ws proxyReqWs] url=${req.url}`);
            proxyReq.setHeader('Connection', 'Upgrade');
            proxyReq.setHeader('Upgrade', 'websocket');
            socket.setKeepAlive?.(true, 30_000);
            socket.setNoDelay?.(true);
        },
    });

    // ★ 终端代理（同时代理 HTTP 和 WS，且重写路径）
    const terminalProxy = createProxyMiddleware({
        target: TERMINAL_TARGET_URL,
        changeOrigin: true,
        ws: true,
        logLevel: dev ? 'debug' : 'info',
        pathRewrite: { '^/api/terminal/?': '/' },   // 外部 /api/terminal -> 内部 /
        timeout: 0,
        proxyTimeout: 0,
        onError(err, req, res) {
            console.error('[WS proxy error][terminal]:', err.message);
            if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('terminal WS proxy error');
            }
        },
        onProxyReqWs(proxyReq, req, socket) {
            console.log(`[${now()}][/api/terminal proxyReqWs] ip=${ipOf(req)} url=${req.url}`);
            proxyReq.setHeader('Connection', 'Upgrade');
            proxyReq.setHeader('Upgrade', 'websocket');
            socket.setKeepAlive?.(true, 30_000);
            socket.setNoDelay?.(true);
        },
    });

    // 3) 主 HTTP 入口
    mainHttpServer = createServer((req, res) => {
        const url = req.url || '';

        // 对 /api/terminal 的普通 HTTP 先快速 426（不走 Next，不悬空）
        if (url.startsWith('/api/terminal')) {
            if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') {
                res.writeHead(426, {
                    'Content-Type': 'text/plain',
                    'Connection': 'close',
                    'Upgrade': 'websocket',
                });
                res.end('WebSocket upgrade required');
                return;
            }
            // 升级的会在 on('upgrade') 里处理
            // 但如果某些代理把 WS 作为普通 request 进来，兜底交给代理中间件：
            return terminalProxy(req, res);
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
        if (url.startsWith('/ws')) {
            return websocketProxy(req, res);
        }

        return handle(req, res);
    });

    // 可长连的超时策略
    mainHttpServer.requestTimeout = 0;
    mainHttpServer.headersTimeout = 0;

    mainHttpServer.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    mainHttpServer.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        // ★ 不要碰 /api/terminal 的 socket，直接交给代理
        if (url.startsWith('/api/terminal')) {
            console.log(`[${now()}][upgrade→terminal] ip=${ipOf(req)} url=${url}`);
            return terminalProxy.upgrade(req, socket, head);
        }

        // 其他升级流量再做通用处理
        console.log(`[${now()}][upgrade] url=${url}`);
        socket.setKeepAlive?.(true, 30_000);
        socket.setNoDelay?.(true);

        if (url.startsWith('/connect-guac')) {
            return guacProxy.upgrade(req, socket, head);
        } else if (url.startsWith('/ws')) {
            return websocketProxy.upgrade(req, socket, head);
        }
    });

    // 4) Guacamole 内部服务
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
    guacServer.on('open',  (c) => console.log('[Guac OPEN]', c.connectionId));
    guacServer.on('error', (c, e) => console.error('[Guac ERR]', e));
    guacServer.on('close', (c) => console.log('[Guac END]', c.connectionId));

    // 5) shutdown
    async function shutdown() {
        console.log('[NodeJS] Shutting down…');

        // 依次关闭：终端 Socket.IO → guac → 主站
        await new Promise((resolve) => ioTerminal.close(resolve));
        if (guacServer) guacServer.close();

        await new Promise((resolve) => mainHttpServer.close(resolve));
        await new Promise((resolve) => terminalHttpServer.close(resolve));
        sockets.forEach((s) => s.destroy());

        console.log('[NodeJS] Cleanup done. Exiting.');
        process.exit(0);
    }
    const FORCE_TIMEOUT = 3000;
    function forceExit() { console.warn('[NodeJS] Forced exit.'); process.exit(1); }

    process.on('SIGINT',  () => { shutdown().catch(console.error); setTimeout(forceExit, FORCE_TIMEOUT).unref(); });
    process.on('SIGTERM', () => { shutdown().catch(console.error); setTimeout(forceExit, FORCE_TIMEOUT).unref(); });

    // 捕获未处理错误，避免进程直接崩
    process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
    process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

    // 6) 启动
    mainHttpServer.listen(MAIN_PORT, () => {
        console.log(`> ✅ Main server ready on http://localhost:${MAIN_PORT}`);
        console.log(`> ➡️  PHP proxied from /back/`);
        console.log(`> ➡️  AI proxied from /chat/`);
        console.log(`> ➡️  Guacamole proxied from /connect-guac`);
        console.log(`> ➡️  WebSocket proxied from /ws`);
        console.log(`> ➡️  Terminal proxied from /api/terminal  → http://127.0.0.1:${TERMINAL_PORT} (WS)`);
    });

    guacHttpServer.listen(GUAC_INTERNAL_PORT, () => {
        console.log(`> ⚙️  Internal Guacamole server running on port ${GUAC_INTERNAL_PORT}`);
    });
});
