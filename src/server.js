import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';
import { spawn } from '@homebridge/node-pty-prebuilt-multiarch';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, { path: '/api/terminal' });

  io.on('connection', socket => {
    const id = socket.handshake.query.id;
    if (typeof id !== 'string') {
      socket.disconnect(true);
      return;
    }
    const shell = spawn('docker', ['exec', '-it', id, '/bin/sh'], {
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
    console.error(err);
    process.exit(1);
  })
      .listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });

});
