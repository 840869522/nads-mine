import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CIPHER = 'AES-256-CBC';
const KEY = process.env.GUAC_KEY || 'MySuperSecretKeyForParamsToken12';

function encryptToken(value: any) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(CIPHER, Buffer.from(KEY), iv);
  let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const data = { iv: iv.toString('base64'), value: encrypted };
  const json = JSON.stringify(data);
  return Buffer.from(json).toString('base64');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const hostname = searchParams.get('hostname');
  const port = searchParams.get('port');
  const username = searchParams.get('username');
  const password = searchParams.get('password');
  if (!type || !hostname || !port) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }
  const settings: Record<string, any> = { hostname, port };
  if (username) settings.username = username;
  if (password) settings.password = password;
  const tokenObj = {
    connection: { type, settings }
  };
  const token = encryptToken(tokenObj);
  return NextResponse.json({ token });
}
