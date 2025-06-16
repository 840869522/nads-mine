import { NextRequest, NextResponse } from 'next/server';
import { inspectContainer, getContainerLogs, listBindMounts, getContainerStats, execInContainer, startContainer, stopContainer, pauseContainer, unpauseContainer, removeContainer } from '@/lib/docker';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const id = params.id;
  try {
    switch (action) {
      case 'logs':
        const logs = await getContainerLogs(id);
        return NextResponse.json({ logs });
      case 'inspect':
        const inspect = await inspectContainer(id);
        return NextResponse.json(inspect);
      case 'binds':
        const mounts = await listBindMounts(id);
        return NextResponse.json(mounts);
      case 'stats':
        const stats = await getContainerStats(id);
        return NextResponse.json(stats);
      case 'exec':
        const cmd = searchParams.get('cmd') || 'ls';
        const output = await execInContainer(id, cmd);
        return NextResponse.json({ output });
      case 'files':
        const path = searchParams.get('path') || '/';
        const files = await execInContainer(id, ['ls', '-al', path]);
        return NextResponse.json({ files });
      default:
        const info = await inspectContainer(id);
        return NextResponse.json(info);
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const id = params.id;
  try {
    switch (action) {
      case 'start':
        await startContainer(id);
        break;
      case 'stop':
        await stopContainer(id);
        break;
      case 'pause':
        await pauseContainer(id);
        break;
      case 'unpause':
        await unpauseContainer(id);
        break;
      case 'delete':
        await removeContainer(id);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
