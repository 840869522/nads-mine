import { NextRequest, NextResponse } from 'next/server';
import {createQuestion, getQuestions} from '@/lib/db/queries';

// 获取题库
export async function GET() {
  try {
    const questions = await getQuestions();
    return NextResponse.json(questions);
  } catch (error) {
    // 建议的微小优化
    console.error("Failed to get questions:", error); // 增加日志，方便在服务器端排查问题
    return NextResponse.json({ message: '获取问题列表失败' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    // 1. 从前端请求中解析出 JSON 数据
    const body = await request.json();

    // 2. 验证收到的数据
    if (!body.text) {
      return NextResponse.json({ message: '问题文本不能为空' }, { status: 400 });
    }

    // 3. 准备要存入数据库的数据
    const newQuestionData = {
      text: body.text,
      type: 'short-answer', // 根据您的表单，默认为简答题
    };

    // 4. 调用数据库查询函数，将数据存入数据库
    const newQuestion = await createQuestion(newQuestionData);

    // 5. 返回成功创建后的问题数据
    return NextResponse.json(newQuestion, { status: 201 });

  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ message: '创建新问题失败' }, { status: 500 });
  }
}