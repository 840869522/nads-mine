import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function toWebStream(stream: Readable) {
  return new ReadableStream({
    start(controller) {
      stream.on('data', chunk => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', err => controller.error(err));
    }
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const docker = new Docker(
    process.platform === 'win32'
      ? { socketPath: '//./pipe/docker_engine' }
      : { socketPath: '/var/run/docker.sock' }
  );
  const image = docker.getImage(name);
  let size: number | undefined;
  try {
    const info = await image.inspect();
    size = info.Size;
  } catch {
    size = undefined;
  }
  const stream = await image.get();
  const webStream = toWebStream(stream);
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-tar',
    'Content-Disposition': `attachment; filename="${name.replace(/[\\/:]/g, '_')}.tar"`
  };
  if (typeof size === 'number') headers['Content-Length'] = String(size);
  return new NextResponse(webStream, { headers });
}
