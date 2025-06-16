import { NextRequest, NextResponse } from 'next/server';
import { listDockerImages } from '@/lib/docker';
import { createImage, updateImage, deleteImage } from '@/lib/db/queries';
import { v4 as uuidv4 } from 'uuid';

// 获取镜像列表
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || undefined;
  const role = searchParams.get('role') || 'student';
  const data = await listDockerImages(role, userId || undefined);
  return NextResponse.json(data);
}

// 新建镜像
export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuidv4();
  await createImage({ ...body, id });
  return NextResponse.json({ ok: true, id });
}

// 更新镜像
export async function PUT(req: NextRequest) {
  const body = await req.json();
  await updateImage(body);
  return NextResponse.json({ ok: true });
}

// 删除镜像
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) await deleteImage(id);
  return NextResponse.json({ ok: true });
}
