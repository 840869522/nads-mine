import { NextRequest, NextResponse } from 'next/server';
import { getRoles, createRole, updateRole, deleteRole } from '@/lib/db/queries';
import { v4 as uuidv4 } from 'uuid';

// 获取角色列表
export async function GET() {
  const data = await getRoles();
  return NextResponse.json(data);
}

// 新建角色
export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuidv4();
  await createRole({ id, ...body });
  return NextResponse.json({ ok: true, id });
}

// 更新角色
export async function PUT(req: NextRequest) {
  const body = await req.json();
  await updateRole(body);
  return NextResponse.json({ ok: true });
}

// 删除角色
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) await deleteRole(id);
  return NextResponse.json({ ok: true });
}
