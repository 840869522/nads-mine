import { NextRequest, NextResponse } from 'next/server';

// The base URL of our own gateway server, running on port 3000
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

async function handler(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Reconstruct the target URL for the gateway
  // e.g., /api/kibana-proxy/app/discover?id=123 -> http://localhost:3000/api/kibana-proxy/app/discover?id=123
  const targetUrl = `${GATEWAY_URL}${pathname}${search}`;

  try {
    // Forward the request to the gateway
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      redirect: 'manual', // Let the browser handle redirects
    });

    // Return the response from the gateway directly to the client
    return response;

  } catch (error) {
    console.error('[KIBANA NEXT.JS PROXY] Error forwarding request to gateway:', error);
    return NextResponse.json({ error: 'Proxying to gateway failed.' }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };