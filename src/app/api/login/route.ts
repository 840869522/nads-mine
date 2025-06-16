import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }
  const user = await findUserByUsername(username);
  if (!user || user.passwordHash !== password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  return NextResponse.json({ user: { id: user.id, username: user.username, role: user.role } });
}
