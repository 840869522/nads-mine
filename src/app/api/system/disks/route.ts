import { NextResponse } from 'next/server';
import { getDiskUsage } from '@/services/systemMetrics';

export async function GET() {
  try {
    const disks = await getDiskUsage();
    return NextResponse.json(disks);
  } catch (error) {
    console.error('Failed to read disk usage', error);
    return NextResponse.json({ message: 'Failed to read disk usage' }, { status: 500 });
  }
}
