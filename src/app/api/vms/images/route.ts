import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getVmImageDir } from '@/lib/virsh';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }
  let imageDir: string;
  try {
    imageDir = await getVmImageDir();
  } catch {
    return NextResponse.json({ error: 'failed to locate image directory' }, { status: 500 });
  }
  const filePath = path.join(imageDir, name);
  try {
    await fs.promises.unlink(filePath);
  } catch {
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
