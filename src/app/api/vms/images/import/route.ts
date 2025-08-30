import { NextRequest, NextResponse } from 'next/server';
import Busboy from 'busboy';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { getVmImageDir } from '@/lib/virsh';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const headers = Object.fromEntries(req.headers);
  const bb = Busboy({ headers });
  const reqStream = Readable.from(req.body);

  let imageDir: string;
  try {
    imageDir = await getVmImageDir();
  } catch {
    return NextResponse.json({ error: 'failed to locate image directory' }, { status: 500 });
  }

  const result = new Promise<void>((resolve, reject) => {
    bb.on('file', (_name, file, info) => {
      const filePath = path.join(imageDir, info.filename);
      const out = fs.createWriteStream(filePath);
      pipeline(file, out).then(() => resolve()).catch(reject);
    });
    bb.on('error', reject);
    bb.on('finish', () => resolve());
  });

  reqStream.pipe(bb);
  await result;
  return NextResponse.json({ ok: true });
}
