import { NextRequest, NextResponse } from 'next/server';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/db/queries';

// 获取用户列表
export async function GET() {
  const users = await getUsers();
  return NextResponse.json(users);
}

// 新建用户
export async function POST(req: NextRequest) {
  const body = await req.json();
  await createUser(body);
  return NextResponse.json({ ok: true });
}

// 更新用户
export async function PUT(req: NextRequest) {
  const body = await req.json();
  await updateUser(body);
  return NextResponse.json({ ok: true });
}

// 删除用户
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) await deleteUser(id);
  return NextResponse.json({ ok: true });
}
