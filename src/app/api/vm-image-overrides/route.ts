import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const dataFile = path.join(process.cwd(), 'src', 'data', 'vmImageOverrides.json');

export async function GET() {
  try {
    const data = await fs.readFile(dataFile, 'utf-8');
    const overrides = data ? JSON.parse(data) : {};
    return NextResponse.json(overrides);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return NextResponse.json({});
    }
    return NextResponse.json({ error: 'Failed to read overrides' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, osType, description } = await req.json();
  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }
  try {
    let overrides: Record<string, { osType?: string; description?: string }> = {};
    try {
      const data = await fs.readFile(dataFile, 'utf-8');
      overrides = data ? JSON.parse(data) : {};
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    overrides[name] = { osType, description };
    await fs.writeFile(dataFile, JSON.stringify(overrides, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save overrides' }, { status: 500 });
  }
}
