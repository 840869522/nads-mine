import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const KEY = Buffer.from(process.env.GUAC_KEY || '0123456789abcdef0123456789abcdef')

function generateToken(obj: any) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()])
  const payload = {
    iv: iv.toString('base64'),
    value: ct.toString('base64')
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const token = generateToken(data)
  return NextResponse.json({ token })
}
