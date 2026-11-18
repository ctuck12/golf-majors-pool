import { NextResponse, type NextRequest } from 'next/server';
import { APP_STORE_URL } from '../lib/pool-message';

// golfmajorspool.com/download: the link commissioners text their pool. Opens the app's App Store
// page once the app is live (APP_STORE_URL); before that, and on Android, opens the website.
// ?join=CODE carries a league code through to the website's sign-up.
export function GET(request: NextRequest) {
  const join = request.nextUrl.searchParams.get('join');
  const isAndroid = /android/i.test(request.headers.get('user-agent') ?? '');
  if (APP_STORE_URL && !isAndroid) return NextResponse.redirect(APP_STORE_URL, 302);
  const site = new URL('/', request.nextUrl.origin);
  if (join) site.searchParams.set('join', join);
  return NextResponse.redirect(site, 302);
}
