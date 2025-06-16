import { NextRequest, NextResponse } from 'next/server';
import { getQuestions } from '@/lib/db/queries';

// 获取题库
export async function GET() {
  const questions = await getQuestions();
  return NextResponse.json(questions);
}
