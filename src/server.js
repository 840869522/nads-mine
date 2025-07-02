import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch'; // Renamed to avoid conflict
import { spawn as childProcessSpawn } from 'child_process'; // For launching FastAPI
import { createProxyMiddleware } from 'http-proxy-middleware';
// import path from 'path'; // No longer needed for uvicorn executable path

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PYTHON_API_PORT = process.env.PYTHON_API_PORT || 8000;
const PYTHON_API_HOST = process.env.PYTHON_API_HOST || '127.0.0.1'; // Use 127.0.0.1 for proxy target
const FASTAPI_TARGET_URL = `http://${PYTHON_API_HOST}:${PYTHON_API_PORT}`;

app.prepare().then(() => {
  let pythonExecutable;
  let canRunPythonBackend = false;
  let fastApiProcess = null; // Declare fastApiProcess here to be accessible in cleanup and for checks

  if (process.platform === 'linux') { // WSL typically reports 'linux'
    pythonExecutable = 'python3';
    canRunPythonBackend = true;
    console.log('[NodeJS] Detected Linux (or WSL) platform. Using "python3" to start FastAPI backend.');
  } else {
    console.warn(`[NodeJS] WARNING: Current platform is '${process.platform}'.`);
    console.warn('[NodeJS] The Python backend is configured for Libvirt on Linux/WSL (uses local Unix socket).');
    console.warn('[NodeJS] Python backend will NOT be started on this platform. API calls to /api/vm/* will return 503.');
  }

  if (canRunPythonBackend) {
    console.log('Attempting to start FastAPI server...');
    const scriptPath = 'src/main.py'; // Path relative to project root
    console.log(`[NodeJS] Attempting to execute Python script: ${pythonExecutable} ${scriptPath}`);

    fastApiProcess = childProcessSpawn( // Assign to the outer scope variable
      pythonExecutable,
      [scriptPath], // Argument is the script to run
      { stdio: 'pipe', cwd: process.cwd() } // Run from project root
    );

    fastApiProcess.stdout.on('data', (data) => {
      console.log(`[FastAPI STDOUT]: ${data.toString().trim()}`);
    });

    fastApiProcess.stderr.on('data', (data) => {
      console.error(`[FastAPI STDERR]: ${data.toString().trim()}`);
    });

    fastApiProcess.on('close', (code) => {
      console.log(`FastAPI server process closed with code ${code}`);
      // Check if fastApiProcess exists before accessing killed, as it might not have been initialized if canRunPythonBackend was false
      if (code !== 0 && fastApiProcess && !fastApiProcess.killed) {
          console.error('FastAPI server exited unexpectedly. Check logs.');
      }
    });

    fastApiProcess.on('error', (err) => {
      console.error('Failed to start FastAPI server process:', err);
    });

    // Graceful shutdown for FastAPI process
    const cleanupFastApi = () => {
      // Check if fastApiProcess was initialized and not already killed
      if (fastApiProcess && !fastApiProcess.killed) {
          console.log('Attempting to shut down FastAPI server...');
          fastApiProcess.kill('SIGINT'); // Or 'SIGTERM'
      }
    };
    process.on('SIGINT', cleanupFastApi);
    process.on('SIGTERM', cleanupFastApi);
    process.on('exit', cleanupFastApi);
  } else {
    console.log('[NodeJS] Python backend startup skipped due to incompatible platform.');
  }

  // Proxy middleware for /api/vm requests
  console.log('[Debug HPM] Intended Proxy Target URL:', FASTAPI_TARGET_URL);
  const apiProxy = createProxyMiddleware({
    target: FASTAPI_TARGET_URL,
    changeOrigin: true,
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
    if (req.url && req.url.startsWith('/api/vm')) {
      if (canRunPythonBackend) { // Only proxy if backend is supposed to be running
        return apiProxy(req, res, (err) => {
          if (err) {
              console.error('Error in proxy middleware execution:', err);
              if (!res.headersSent) {
                  res.writeHead(500, { 'Content-Type': 'text/plain' });
                  res.end('Proxy middleware error.');
              }
          } else {
            // Fallback to Next.js handler if proxy doesn't fully handle (should not happen for matched path)
            return handle(req, res);
          }
        });
      } else {
        // Python backend is not running on this platform, return 503 Service Unavailable
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Python backend service (for /api/vm) is unavailable on this platform.' }));
        return;
      }
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
