import { NextResponse, type NextRequest } from 'next/server';
import { APP_STORE_URL, GOOGLE_PLAY_URL } from '../lib/pool-message';

// golfmajorspool.com/download: the link commissioners text their pool. iPhones go to the App Store
// and Android phones to Google Play, once those links are filled in (app/lib/pool-message.ts);
// anything else, or a store that isn't live yet, gets the website.
// ?join=CODE carries a league code through to the website's sign-up.
export function GET(request: NextRequest) {
  const agent = request.headers.get('user-agent') ?? '';
  if (APP_STORE_URL && /iPhone|iPad|iPod/i.test(agent)) return NextResponse.redirect(APP_STORE_URL, 302);
  if (GOOGLE_PLAY_URL && /Android/i.test(agent)) return NextResponse.redirect(GOOGLE_PLAY_URL, 302);
  const site = new URL('/', request.nextUrl.origin);
  const join = request.nextUrl.searchParams.get('join');
  if (join) site.searchParams.set('join', join);
  return NextResponse.redirect(site, 302);
}
