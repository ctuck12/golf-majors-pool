import { NextResponse, type NextRequest } from 'next/server';

// API requests from the iPhone app (Capacitor). The app's screens are served from inside the app
// (origin capacitor://localhost), so the browser cookie that signs people in on the website isn't
// available to it. Instead the app sends its session token in an X-Session-Token header; this hands
// it to the API routes as the usual session cookie, so the routes work the same for both.
// CORS response headers for /api/* live in next.config.ts.

const SESSION_COOKIE_NAME = 'golf-pool-session';

export function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token, X-Client-Platform',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const token = request.headers.get('x-session-token');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  const otherCookies = (headers.get('cookie') ?? '')
    .split(/;\s*/)
    .filter((cookie) => cookie && !cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  headers.set('cookie', [...otherCookies, `${SESSION_COOKIE_NAME}=${token}`].join('; '));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: '/api/:path*',
};
