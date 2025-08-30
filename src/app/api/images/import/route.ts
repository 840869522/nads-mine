import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import Busboy from 'busboy';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const docker = new Docker(
    process.platform === 'win32'
      ? { socketPath: '//./pipe/docker_engine' }
      : { socketPath: '/var/run/docker.sock' }
  );
  const headers = Object.fromEntries(req.headers);
  const bb = Busboy({ headers });
  const reqStream = Readable.from(req.body);

  const result = new Promise<void>((resolve, reject) => {
    bb.on('file', async (_name, file) => {
      try {
        await docker.loadImage(file);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
    bb.on('error', reject);
    bb.on('finish', () => resolve());
  });

  reqStream.pipe(bb);
  await result;
  return NextResponse.json({ ok: true });
}
