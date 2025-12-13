import { NextResponse } from 'next/server';
import { getCpuUsage } from '@/services/systemMetrics';

export async function GET() {
  try {
    const cpu = await getCpuUsage();
    return NextResponse.json(cpu);
  } catch (error) {
    console.error('Failed to read CPU usage', error);
    return NextResponse.json({ message: 'Failed to read CPU usage' }, { status: 500 });
  }
}
