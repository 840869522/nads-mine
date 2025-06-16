import { NextRequest, NextResponse } from 'next/server';
import { getCourseCases, createCourseCase, updateCourseCase, deleteCourseCase } from '@/lib/db/queries';
import { v4 as uuidv4 } from 'uuid';

// 获取课程案例列表
export async function GET() {
  const cases = await getCourseCases();
  return NextResponse.json(cases);
}

// 新建课程案例
export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuidv4();
  const files = body.files.map((f: any) => ({ ...f, id: uuidv4() }));
  await createCourseCase({ ...body, id, files });
  return NextResponse.json({ ok: true, id });
}

// 更新课程案例
export async function PUT(req: NextRequest) {
  const body = await req.json();
  await updateCourseCase(body);
  return NextResponse.json({ ok: true });
}

// 删除课程案例
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) await deleteCourseCase(id);
  return NextResponse.json({ ok: true });
}
