import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, renewSession, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

// The app asks this every time it opens. A signed-in session is renewed here (see renewSession),
// and the website's cookie is re-set to match, so a player who keeps using the app is never asked
// to sign in again. The iPhone app's token is the same session, so it renews with it.
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);
  if (token && session.user) {
    const renewed = await renewSession(token).catch(() => false);
    if (renewed) {
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }
  return NextResponse.json(session);
}
