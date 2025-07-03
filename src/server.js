import Fastify from 'fastify';
import fastifyProxy from '@fastify/http-proxy';
import fastifyNext from '@fastify/nextjs';
import { Server } from 'socket.io';
import { spawn as ptySpawn } from '@homebridge/node-pty-prebuilt-multiarch'; // Renamed to avoid conflict
import { spawn as childProcessSpawn } from 'child_process'; // For launching FastAPI
import path from 'path'; // Ensure path is imported

const dev = process.env.NODE_ENV !== 'production';
const fastify = Fastify({ logger: dev });

const PYTHON_API_PORT = process.env.PYTHON_API_PORT || 3010;
const PYTHON_API_HOST = process.env.PYTHON_API_HOST || '127.0.0.1'; // Use 127.0.0.1 for proxy target
const FASTAPI_TARGET_URL = `http://${PYTHON_API_HOST}:${PYTHON_API_PORT}`;
const PHP_API_PORT = process.env.PHP_API_PORT || 8000;
const PHP_API_HOST = process.env.PHP_API_HOST || '127.0.0.1';
const PHP_TARGET_URL = `http://${PHP_API_HOST}:${PHP_API_PORT}`;

fastify.register(fastifyNext, { dev }).after(() => {
  let pythonExecutable;
  let canRunPythonBackend = false;
  let fastApiProcess = null; // Declare fastApiProcess here to be accessible in cleanup and for checks
  // Graceful shutdown for FastAPI process
  const cleanupFastApi = () => {
    // Check if fastApiProcess was initialized and not already killed
    if (fastApiProcess && !fastApiProcess.killed) {
      console.log('Attempting to shut down FastAPI server...');
      fastApiProcess.kill('SIGINT'); // Or 'SIGTERM'
    }
  };
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
    // pythonExecutable is already 'python3' if we are in this block.
    // Now, construct the path to python3 *inside* the .venv
    pythonExecutable = path.join(process.cwd(), '.venv', 'bin', 'python3');
    const scriptToRun = 'main.py'; // The script to run, relative to the new CWD

    console.log(`[NodeJS] Attempting to start FastAPI server using venv Python.`);
    console.log(`[NodeJS Debug] Python executable (from .venv): ${pythonExecutable}`);
    console.log(`[NodeJS Debug] Script to run: ${scriptToRun}`);
    console.log(`[NodeJS] Executing: ${pythonExecutable} ${scriptToRun}`);

    fastApiProcess = childProcessSpawn( // Assign to the outer scope variable
      pythonExecutable,
      [scriptToRun],
      { stdio: 'pipe' } // Set CWD for the python script to 'src'
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


    process.on('SIGINT', cleanupFastApi);
    process.on('SIGTERM', cleanupFastApi);
    process.on('exit', cleanupFastApi);
  } else {
    console.log('[NodeJS] Python backend startup skipped due to incompatible platform.');
  }



  fastify.register(fastifyProxy, {
    upstream: FASTAPI_TARGET_URL,
    prefix: '/api/vm',
    rewritePrefix: '/api/vm',
    preHandler: (request, reply, done) => {
      console.log(`[Proxy] Request to FastAPI: ${request.method} ${request.raw.url} -> ${FASTAPI_TARGET_URL}${request.raw.url}`);
      if (!canRunPythonBackend) {
        reply.code(503).send({ message: 'Python backend service (for /api/vm) is unavailable on this platform.' });
        return;
      }
      done();
    },
    replyOptions: {
      onResponse(request, reply, res) {
        console.log(`[Proxy] Response from FastAPI: ${res.statusCode} for ${request.raw.url}`);
      }
    }
  });

  fastify.register(fastifyProxy, {
    upstream: PHP_TARGET_URL,
    prefix: '/api/php',
    rewritePrefix: '/',
    preHandler: (request, reply, done) => {
      console.log(`[Proxy] Request to PHP: ${request.method} ${request.raw.url} -> ${PHP_TARGET_URL}${request.raw.url.replace(/^\/api\/php/, '')}`);
      done();
    },
    replyOptions: {
      onResponse(request, reply, res) {
        console.log(`[Proxy] Response from PHP: ${res.statusCode} for ${request.raw.url}`);
      }
    }
  });

  fastify.next('/*');

  const io = new Server(fastify.server, { path: '/api/terminal' }); // Existing WebSocket for terminal

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
  fastify
    .listen({ port }, (err) => {
      if (err) {
        console.error('HTTP Server Error:', err);
        cleanupFastApi(); // Attempt to clean up FastAPI process too
        process.exit(1);
      }
      console.log(`> Node.js server ready on http://localhost:${port}`);
      console.log(`> FastAPI (Python) API available via proxy at http://localhost:${port}/api/vm`);
      console.log(`> PHP API available via proxy at http://localhost:${port}/api/php`);
      console.log(`> Terminal WebSocket available at ws://localhost:${port}/api/terminal`);
    });
});
