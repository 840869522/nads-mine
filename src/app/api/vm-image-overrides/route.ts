import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// When running the Next.js server we execute commands from the `src` directory
// (see package.json scripts). Using `process.cwd()` here therefore already
// points at the `src` folder. Joining another `src` segment caused the
// application to resolve the data path to `src/src/data/...`, which does not
// exist and resulted in 500 errors when saving overrides. We only need to
// append the `data` directory to the current working directory.
const dataFile = path.join(process.cwd(), 'data', 'vmImageOverrides.json');

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
