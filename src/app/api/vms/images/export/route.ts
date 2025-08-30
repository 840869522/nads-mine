import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getVmImageDir } from '@/lib/virsh';

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

  let imageDir: string;
  try {
    imageDir = await getVmImageDir();
  } catch {
    return NextResponse.json({ error: 'failed to locate image directory' }, { status: 500 });
  }

  const filePath = path.join(imageDir, name);
  const stream = fs.createReadStream(filePath);
  const webStream = toWebStream(stream);
  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`
    }
  });
}
