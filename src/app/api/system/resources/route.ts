import { NextResponse } from 'next/server';
import { getSystemResources } from '@/services/systemMetrics';

export async function GET() {
  try {
    const data = await getSystemResources();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to gather system resources', error);
    return NextResponse.json({ message: 'Failed to gather system resources' }, { status: 500 });
  }
}
