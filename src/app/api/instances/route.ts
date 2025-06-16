import { NextRequest, NextResponse } from 'next/server';
import { listDockerContainers } from '@/lib/docker';
import { createInstance, updateInstance, deleteInstance } from '@/lib/db/queries';
import { v4 as uuidv4 } from 'uuid';

// 获取实例列表
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || undefined;
  const role = searchParams.get('role') || 'student';
  const data = await listDockerContainers(role, userId || undefined);
  return NextResponse.json(data);
}

// 新建实例
export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuidv4();
  await createInstance({ ...body, id });
  return NextResponse.json({ ok: true, id });
}

// 更新实例
export async function PUT(req: NextRequest) {
  const body = await req.json();
  await updateInstance(body);
  return NextResponse.json({ ok: true });
}

// 删除实例
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) await deleteInstance(id);
  return NextResponse.json({ ok: true });
}
