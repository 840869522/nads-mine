import { NextRequest, NextResponse } from 'next/server';
import { createDockerContainer } from '@/lib/docker';
import { createInstance } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, name, ports, volumes, env, cmd, creatorId } = body;
    const container = await createDockerContainer({
      image,
      name,
      ports,
      volumes,
      env,
      cmd,
      labels: creatorId ? { creatorId } : undefined,
    });
    await createInstance({
      id: container.id,
      name: name || container.id.slice(0, 12),
      type: 'container',
      status: 'starting',
      ports: ports && ports.length
        ? ports.map((p: any) => p.hostPort ? `${p.containerPort}->${p.hostPort}` : `${p.containerPort}`).join(', ')
        : '',
      imageName: image,
      cpuUsage: '0%',
      memoryUsage: '0/0',
      diskUsage: '0/0',
      uptime: '0',
      nodeId: null,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: container.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
