import type { NextApiRequest, NextApiResponse } from 'next';
import Docker from 'dockerode';
import { WebSocketServer } from 'ws';
import * as os from 'node:os';

const docker = new Docker(
  os.platform() === 'win32'
    ? { socketPath: '//./pipe/docker_engine' }
    : { socketPath: '/var/run/docker.sock' }
);

async function handleExec(ws: any, containerId: string) {
  try {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', 'bash || sh'],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: true,
      Tty: true,
    });
    const stream = await exec.start({ hijack: true, stdin: true });

    ws.on('message', (msg: Buffer | string) => {
      if (typeof msg === 'string') {
        try {
          const data = JSON.parse(msg);
          if (data.type === 'resize') {
            exec.resize({ h: data.rows, w: data.cols });
            return;
          }
          if (data.type === 'data') {
            stream.write(data.data);
            return;
          }
        } catch {
          stream.write(msg);
          return;
        }
      } else {
        stream.write(msg);
      }
    });
    ws.on('close', () => {
      try { stream.end(); } catch {}
    });

    stream.on('data', (chunk: Buffer) => ws.send(chunk));
    stream.on('end', () => ws.close());
    stream.on('error', () => ws.close());
  } catch {
    ws.close();
  }
}

export const config = {
  api: { bodyParser: false },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.upgrade !== 'websocket') {
    res.status(400).end('Expected websocket');
    return;
  }

  const containerId = req.query.id as string;
  const wss = new WebSocketServer({ noServer: true });
  wss.handleUpgrade(req, req.socket as any, Buffer.alloc(0), (ws) => {
    wss.emit('connection', ws, req);
    handleExec(ws, containerId);
  });
}
