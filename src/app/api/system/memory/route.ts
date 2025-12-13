import { NextResponse } from 'next/server';
import { getMemoryUsage } from '@/services/systemMetrics';

export async function GET() {
  try {
    const memory = getMemoryUsage();
    return NextResponse.json(memory);
  } catch (error) {
    console.error('Failed to read memory usage', error);
    return NextResponse.json({ message: 'Failed to read memory usage' }, { status: 500 });
  }
}
