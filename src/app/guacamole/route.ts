import { NextResponse } from 'next/server';

function renderHtml(params: URLSearchParams) {
  const query = params.toString();
  const src = query ? `/index.html?${query}` : '/index.html';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Guacamole</title>
        <style>
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
          }
        </style>
      </head>
      <body>
        <iframe src="${src}"></iframe>
      </body>
    </html>`;
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  let params = new URLSearchParams();
  if (contentType.includes('application/json')) {
    const json = await request.json().catch(() => ({}));
    params = new URLSearchParams(json as Record<string, string>);
  } else {
    const text = await request.text();
    params = new URLSearchParams(text);
  }
  return new NextResponse(renderHtml(params), { headers: { 'Content-Type': 'text/html' } });
}

export async function GET(request: Request) {
  const params = request.nextUrl.searchParams;
  return new NextResponse(renderHtml(params), { headers: { 'Content-Type': 'text/html' } });
}
