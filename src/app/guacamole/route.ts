import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

async function handler(req: NextRequest) {
    const isRequestingContent = req.nextUrl.searchParams.has('content_only');

    // If the request is for the inner content of the iframe, serve the modified index.html
    if (isRequestingContent) {
        try {
            const filePath = path.join(process.cwd(), 'src', 'public', 'index.html');
            let content = await fs.readFile(filePath, 'utf8');

            const host = req.headers.get('host') || 'localhost:3000';
            const protocol = req.headers.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
            const websocketUrl = `${protocol}://${host}/connect-guac`;

            const configScript = `<script>
                window.GUAC_CONFIG = { websocketUrl: '${websocketUrl}' };
            </script>`;

            // Inject the configuration script into the head of the HTML
            content = content.replace('</head>', `${configScript}\n</head>`);
            return new NextResponse(content, { headers: { 'Content-Type': 'text/html' } });

        } catch (error) {
            console.error("Error serving Guacamole content:", error);
            return new NextResponse("Error serving Guacamole content", { status: 500 });
        }
    }
    // Otherwise, it's the initial request, so serve the wrapper page with the iframe
    else {
        const params = new URLSearchParams(req.nextUrl.search);
        params.set('content_only', 'true');

        const src = `/guacamole?${params.toString()}`;
        const wrapperHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Guacamole</title>
                <style>
                  html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
                  iframe { width: 100%; height: 100%; border: none; display: block; }
                </style>
              </head>
              <body>
                <iframe src="${src}"></iframe>
              </body>
            </html>`;
        return new NextResponse(wrapperHtml, { headers: { 'Content-Type': 'text/html' } });
    }
}

export async function GET(request: NextRequest) {
  return handler(request);
}

// POST requests are used to initiate a connection with specific parameters
export async function POST(request: NextRequest) {
    const contentType = request.headers.get('content-type') || '';
    let params = new URLSearchParams();
    if (contentType.includes('application/json')) {
        const json = await request.json().catch(() => ({}));
        params = new URLSearchParams(json as Record<string, string>);
    } else {
        const text = await request.text();
        params = new URLSearchParams(text);
    }

    params.set('content_only', 'true');

    const src = `/guacamole?${params.toString()}`;
    const wrapperHtml = `
        <!DOCTYPE html>
        <html>
            <head>
            <title>Guacamole</title>
            <style>
                html, body { height: 100%; margin: 0; padding: 0; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; display: block; }
            </style>
            </head>
            <body>
            <iframe src="${src}"></iframe>
            </body>
        </html>`;
    return new NextResponse(wrapperHtml, { headers: { 'Content-Type': 'text/html' } });
}