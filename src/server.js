import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch'; // Renamed to avoid conflict
import { spawn as childProcessSpawn } from 'child_process'; // For launching FastAPI
import { createProxyMiddleware } from 'http-proxy-middleware';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PYTHON_API_PORT = process.env.PYTHON_API_PORT || 8000;
const PYTHON_API_HOST = process.env.PYTHON_API_HOST || '127.0.0.1'; // Use 127.0.0.1 for proxy target
const FASTAPI_TARGET_URL = `http://${PYTHON_API_HOST}:${PYTHON_API_PORT}`;

app.prepare().then(() => {
  // Start the FastAPI server
  console.log('Attempting to start FastAPI server...');
  // Ensure main.py is executable or called via python interpreter
  // Use src.main:app to correctly reference the app object within main.py in src/
  const fastApiProcess = childProcessSpawn(
    'uvicorn',
    ['main:app', '--host', '0.0.0.0', '--port', String(PYTHON_API_PORT)], // Changed 'src.main:app' to 'main:app'
    { stdio: 'pipe', cwd: 'src' } // Changed cwd to 'src'
  );

  fastApiProcess.stdout.on('data', (data) => {
    console.log(`[FastAPI STDOUT]: ${data.toString().trim()}`);
  });

  fastApiProcess.stderr.on('data', (data) => {
    console.error(`[FastAPI STDERR]: ${data.toString().trim()}`);
  });

  fastApiProcess.on('close', (code) => {
    console.log(`FastAPI server process closed with code ${code}`);
    if (code !== 0 && !fastApiProcess.killed) {
        console.error('FastAPI server exited unexpectedly. Check logs.');
        // Optionally, attempt to restart or notify admin
    }
  });

  fastApiProcess.on('error', (err) => {
    console.error('Failed to start FastAPI server:', err);
    // process.exit(1); // Optional: exit if FastAPI fails to start
  });

  // Graceful shutdown for FastAPI process
  const cleanupFastApi = () => {
    console.log('Shutting down FastAPI server...');
    if (!fastApiProcess.killed) {
        fastApiProcess.kill('SIGINT'); // Or 'SIGTERM'
    }
  };
  process.on('SIGINT', cleanupFastApi);
  process.on('SIGTERM', cleanupFastApi);
  process.on('exit', cleanupFastApi);


  // Proxy middleware for /api/vm requests
  console.log('[Debug HPM] Intended Proxy Target URL:', FASTAPI_TARGET_URL); // Added for debugging
  const apiProxy = createProxyMiddleware('/api/vm', {
    target: FASTAPI_TARGET_URL,
    changeOrigin: true, // Recommended for virtual hosted sites
    pathRewrite: { '^/api/vm': '/api/vm' }, // Keep /api/vm in the path to FastAPI
    logLevel: dev ? 'debug' : 'info', // More logs in development
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        if (res && !res.headersSent) { // Check if headersSent before trying to send a response
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Proxy Error', error: err.message }));
        }
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Request to FastAPI: ${req.method} ${req.url} -> ${FASTAPI_TARGET_URL}${proxyReq.path}`);
    },
     onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] Response from FastAPI: ${proxyRes.statusCode} for ${req.url}`);
    }
  });

  const httpServer = createServer((req, res) => {
    // Check if the request path starts with /api/vm for proxying
    if (req.url && req.url.startsWith('/api/vm')) {
      return apiProxy(req, res, (err) => { // Pass a callback to handle errors from the proxy itself
        if (err) {
            console.error('Error in proxy middleware execution:', err);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Proxy middleware error.');
            }
        } else {
            // This block should ideally not be reached if proxy handles the request
            // or if an error occurs and is handled by the proxy's onError.
            // If it is reached, it means the proxy decided not to handle it,
            // which shouldn't happen for a path it's configured for.
            // Fallback to Next.js handler if proxy doesn't handle it for some reason.
            return handle(req, res);
        }
      });
    }
    // Default to Next.js handler for other requests
    return handle(req, res);
  });

  const io = new Server(httpServer, { path: '/api/terminal' }); // Existing WebSocket for terminal

  io.on('connection', socket => {
    const id = socket.handshake.query.id;
    if (typeof id !== 'string') {
      socket.disconnect(true);
      return;
    }
    // Use ptySpawn (renamed import)
    const shell = ptySpawn('docker', ['exec', '-it', id, '/bin/sh'], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME,
      env: process.env,
    });

    shell.onData(data => socket.emit('output', data));
    socket.on('input', data => shell.write(data));
    socket.on('resize', ({ cols, rows }) => shell.resize(cols, rows));
    socket.on('disconnect', () => shell.kill());
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  httpServer
    .once("error", (err) => {
      console.error('HTTP Server Error:', err);
      cleanupFastApi(); // Attempt to clean up FastAPI process too
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Node.js server ready on http://localhost:${port}`);
      console.log(`> FastAPI (Python) API available via proxy at http://localhost:${port}/api/vm`);
      console.log(`> Terminal WebSocket available at ws://localhost:${port}/api/terminal`);
    });
});
