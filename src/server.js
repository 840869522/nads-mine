// server.js
import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import GuacamoleLite from 'guacamole-lite';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch';
import { createProxyMiddleware } from 'http-proxy-middleware';
import process from 'process';
import axios from 'axios';
import { io as socketIOClient } from 'socket.io-client';


const GUAC_KEY = process.env.GUAC_KEY || '0123456789abcdef0123456789abcdef';

// =================================================================
// CLUSTER CONFIGURATION
// =================================================================
const backendHosts = (process.env.BACKEND_HOSTS || 'http://127.0.0.1:8000').split(',').map(h => h.trim());
const localHost = backendHosts.find(h => h.includes('127.0.0.1') || h.includes('localhost'));

// Global cache for resource locations: { resourceId: hostUrl }
const resourceHostMap = new Map();

// Round-robin counter for creation requests
let creationHostIndex = 0;

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
    // =================================================================
    // CLUSTER HELPER FUNCTIONS
    // =================================================================
    const updateResourceMap = (data, host, idKey) => {
        if (!Array.isArray(data)) return;
        data.forEach(item => {
            if (item && typeof item === 'object') {
                const resourceId = item[idKey];
                if (resourceId) {
                    resourceHostMap.set(resourceId.toString(), host);
                }
                // Special case for VMs and VM images, also cache by name
                if (item.name && (item.vcpu !== undefined || item.osType !== undefined || item.pool !== undefined)) {
                     resourceHostMap.set(item.name.toString(), host);
                }
            }
        });
    };

    const aggregateFromHosts = async (req, res, idKey = 'id') => {
        try {
            const requests = backendHosts.map(host => {
                const targetUrl = `${host}${req.url.replace('/back', '')}`;
                console.log(`[AGGREGATE] Forwarding to ${targetUrl}`);
                return axios.get(targetUrl, { headers: { 'X-Forwarded-For': req.socket.remoteAddress } });
            });

            const results = await Promise.allSettled(requests);

            let combinedData = [];
            results.forEach((result, index) => {
                const host = backendHosts[index];
                if (result.status === 'fulfilled' && result.value.data) {
                    const data = result.value.data;
                    updateResourceMap(data, host, idKey);
                    if (Array.isArray(data)) {
                        combinedData = combinedData.concat(data);
                    } else {
                        console.warn(`[AGGREGATE] Response from ${host} for ${req.url} is not an array:`, data);
                    }
                } else {
                    console.error(`[AGGREGATE] Failed to fetch from ${host} for url ${req.url}:`, result.reason?.code);
                }
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(combinedData));
        } catch (error) {
            console.error('[AGGREGATE] Aggregation error:', error.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to aggregate data from hosts.' }));
        }
    };

    const aggregationPaths = [
        { path: '/api/instances', idKey: 'id' },
        { path: '/api/vms', idKey: 'id' },
        { path: '/api/images', idKey: 'id' },
        { path: '/api/vms/images', idKey: 'id' },
        { path: '/api/scenariosinstances', idKey: 'instance_id' },
    ];
    const aggregationRegexPaths = [
        // e.g. /api/scenariosinstances/b8a7b6...
        { regex: new RegExp('^/api/scenariosinstances/[^/]+$'), idKey: 'id' },
        // e.g. /api/scenariosinstances/b8a7b6.../vms
        { regex: new RegExp('^/api/scenariosinstances/[^/]+/vms$'), idKey: 'id' },
    ];


    /* =================================================================
       1. PROXY MIDDLEWARE SETUP
       ================================================================= */

    const targetedApiPatterns = [
        { methods: ['POST'], regex: /^\/back\/api\/containers\/([^/]+)\?action=/, idIndex: 1 },
        { methods: ['GET'], regex: /^\/back\/api\/containers\/([^/]+)\/inspect/, idIndex: 1 },
        { methods: ['GET'], regex: /^\/api\/containers\/([^/]+)\?action=/, idIndex: 1 },
        { methods: ['DELETE'], regex: /^\/back\/api\/instances\?id=([^&]+)/, idIndex: 1 },
        { methods: ['GET'], regex: /^\/back\/api\/vms\/([^/]+)\/guac/, idIndex: 1, lookup: 'name' },
        { methods: ['GET', 'POST', 'DELETE'], regex: /^\/back\/api\/vms\/([^/]+)/, idIndex: 1 },
        { methods: ['DELETE'], regex: /^\/back\/api\/images\?id=([^&]+)/, idIndex: 1 },
        { methods: ['GET'], regex: /^\/api\/images\/export\?name=([^&]+)/, idIndex: 1, lookup: 'name' },
        { methods: ['DELETE'], regex: /^\/api\/vms\/images\?name=([^&]+)/, idIndex: 1, lookup: 'name' },
        { methods: ['GET'], regex: /^\/api\/vms\/images\/export\?name=([^&]+)/, idIndex: 1, lookup: 'name' },
        { methods: ['DELETE', 'POST'], regex: /^\/back\/api\/scenariosinstances\/([^/]+)/, idIndex: 1 },
    ];

    const creationApiPatterns = [
        '/back/api/containers',
        '/back/api/vms/create',
        '/api/images/import',
        '/api/vms/images/import',
    ];

    const smartProxy = createProxyMiddleware({
        changeOrigin: true,
        logLevel: dev ? 'debug' : 'info',
        router: (req) => {
            const url = req.url || '';
            const method = req.method;

            // Creation APIs (Round Robin)
            if (method === 'POST' && creationApiPatterns.some(p => url.startsWith(p))) {
                const target = backendHosts[creationHostIndex];
                creationHostIndex = (creationHostIndex + 1) % backendHosts.length;
                console.log(`[SMART PROXY] Routing creation API ${url} to ${target}`);
                return target;
            }

            // Targeted APIs (Cache Lookup)
            for (const pattern of targetedApiPatterns) {
                if (pattern.methods.includes(method)) {
                    const match = url.match(pattern.regex);
                    if (match) {
                        const key = decodeURIComponent(match[pattern.idIndex]);
                        const target = resourceHostMap.get(key.toString());
                        if (target) {
                            console.log(`[SMART PROXY] Routing targeted API ${url} for key ${key} to ${target}`);
                            return target;
                        } else {
                             console.warn(`[SMART PROXY] No host found for key ${key} in URL ${url}. Falling back.`);
                        }
                    }
                }
            }

            // Fallback for any /back/ request that wasn't routed
            if(url.startsWith('/back/')) return backendHosts[0];

            // Default: do not proxy
            return undefined;
        },
        pathRewrite: (path) => path.replace(/^\/back/, '').replace(/^\/api/, '/api')
    });

    // This is the old proxy, kept as a fallback for un-routed /back/ requests if needed,
    // though the smartProxy router should handle it.
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
        //ws: true,
        logLevel: dev ? 'debug' : 'info',
        onProxyRes(proxyRes, req, res) {
            proxyRes.headers['Content-Type'] = 'text/event-stream';
        }
    });

    // 为 Guacamole 服务创建一个新的代理
    // 这个代理会将发往主服务器 /connect-guac 的请求转发到内部的 Guacamole 服务器
    const guacProxy = createProxyMiddleware({
        changeOrigin: true,
        ws: true,
        logLevel: dev ? 'debug' : 'info',
        router: (req) => {
            // Guacamole's connect string is in a query parameter `id`
            const guacId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('id');
            if (guacId) {
                // The id is a base64 encoded JSON string.
                try {
                    const decoded = Buffer.from(guacId, 'base64').toString('utf8');
                    const params = JSON.parse(decoded);

                    // We need to find the hostname which we assume is the VM name
                    const vmName = params?.connection?.parameters?.hostname;
                    if (vmName) {
                        const targetHost = resourceHostMap.get(vmName);
                        if (targetHost && targetHost !== localHost) {
                            console.log(`[GUAC PROXY] Routing Guacamole request for VM ${vmName} to remote host ${targetHost}`);
                            // We proxy to the main port of the remote host, not the internal guac port
                            return targetHost;
                        }
                    }
                } catch (e) {
                    console.error('[GUAC PROXY] Error decoding Guacamole connection ID:', e);
                }
            }
            // Default to local Guacamole server
            console.log('[GUAC PROXY] Routing Guacamole request to local service.');
            return GUAC_TARGET_URL;
        }
    });


    /* =================================================================
       2. HTTP SERVER SETUP
       ================================================================= */

    // 主服务器，现在充当 Next.js、Socket.IO 和所有代理的统一入口
    mainHttpServer = createServer(async (req, res) => {
        const url = req.url || '';

        // --- CLUSTER ROUTING LOGIC (Aggregation) ---
        const backUrl = url.startsWith('/back') ? url.substring(5) : '';

        if (req.method === 'GET' && backUrl) {
            const simpleMatch = aggregationPaths.find(p => backUrl === p.path);
            if (simpleMatch) {
                console.log(`[CLUSTER] Aggregating list for: ${url}`);
                return aggregateFromHosts(req, res, simpleMatch.idKey);
            }
            const regexMatch = aggregationRegexPaths.find(p => p.regex.test(backUrl));
            if (regexMatch) {
                console.log(`[CLUSTER] Aggregating list for regex path: ${url}`);
                return aggregateFromHosts(req, res, regexMatch.idKey);
            }
        }
        // --- END CLUSTER ROUTING LOGIC ---


        // 主要改动 (2/3): 如果请求是发往 //connect-guac，则使用 guacProxy 处理
        // 注意: 这个处理器会同时处理普通的 HTTP 请求和 WebSocket 的 upgrade 请求
        // Handle the special PUT /back/api/images case
        if (url === '/back/api/images' && req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const imageId = data.id;
                    const targetHost = resourceHostMap.get(imageId.toString());
                    if (targetHost) {
                        console.log(`[SMART PROXY] Routing PUT /back/api/images for ID ${imageId} to ${targetHost}`);
                        // Manually proxy this request
                         createProxyMiddleware({
                            target: targetHost,
                            changeOrigin: true,
                            pathRewrite: { '^/back': '' }
                        })(req, res);

                    } else {
                         console.warn(`[SMART PROXY] No host found for image ID ${imageId}. Cannot route PUT request.`);
                         res.statusCode = 404;
                         res.end(JSON.stringify({ error: `Host for image ${imageId} not found`}));
                    }
                } catch (e) {
                    console.error('[SMART PROXY] Error parsing body for PUT /back/api/images:', e);
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Invalid JSON body'}));
                }
            });
            return;
        }

        if (url.startsWith('/socketio/terminal')) {
            return;
        }

        // Main routing for targeted and creation APIs
        if (url.startsWith('/back/') || url.startsWith('/api/containers/') || url.startsWith('/api/images/') || url.startsWith('/api/vms/')) {
             return smartProxy(req, res);
        }

        if (url.startsWith('/connect-guac')) {
            console.log("find guac req！！！！！！！！！！！！！")
            return guacProxy(req, res);
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
    const io = new Server(mainHttpServer, { path: '/socketio/terminal' });

    io.on('connection', (socket) => {
        const id = socket.handshake.query.id;
        console.log(`[Terminal] New connection request for container: ${id}`);
        if (typeof id !== 'string') {
            socket.disconnect(true);
            console.log('[Terminal] No container ID provided. Disconnecting.');
            return;
        }

        const targetHost = resourceHostMap.get(id);

        if (targetHost && targetHost !== localHost) {
            // REMOTE HOST
            console.log(`[Terminal] Container ${id} is on remote host ${targetHost}. Proxying WebSocket.`);
            const remoteSocket = socketIOClient(targetHost, { path: '/socketio/terminal', query: { id } });

            remoteSocket.on('connect', () => {
                console.log(`[Terminal] Successfully connected to remote socket for ${id}`);
            });

            // Forward events from remote to client
            remoteSocket.on('output', (d) => socket.emit('output', d));

            // Forward events from client to remote
            socket.on('input', (d) => remoteSocket.emit('input', d));
            socket.on('resize', ({ cols, rows }) => remoteSocket.emit('resize', { cols, rows }));

            socket.on('disconnect', () => {
                console.log(`[Terminal] Client disconnected for ${id}. Closing remote connection.`);
                remoteSocket.disconnect();
            });

            remoteSocket.on('disconnect', () => {
                 console.log(`[Terminal] Remote socket for ${id} disconnected.`);
                 socket.disconnect();
            });

             remoteSocket.on('connect_error', (err) => {
                console.error(`[Terminal] Remote connection error for ${id}:`, err.message);
                socket.emit('output', `\r\n\x1b[31mError connecting to remote terminal on ${targetHost}.\x1b[0m\r\n`);
                socket.disconnect();
            });

        } else {
            // LOCAL HOST
            console.log(`[Terminal] Container ${id} is on local host. Spawning pty.`);
             const shell = ptySpawn('docker', ['exec', '-it', id, '/bin/sh'], {
                name: 'xterm-color', cols: 80, rows: 24, cwd: process.env.HOME, env: process.env,
            });
            shell.onData((d) => socket.emit('output', d));
            socket.on('input', (d) => shell.write(d));
            socket.on('resize', ({ cols, rows }) => shell.resize(cols, rows));
            socket.on('disconnect', () => shell.kill());
        }
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
        console.log(`> ➡️  Terminal WebSocket direct at /api/terminal`);
    });

    guacHttpServer.listen(GUAC_INTERNAL_PORT, () => {
        console.log(`> ⚙️  Internal Guacamole server running on port ${GUAC_INTERNAL_PORT}`);
    });
});