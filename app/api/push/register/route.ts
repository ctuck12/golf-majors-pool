import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, removePushToken, savePushToken, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

// The iPhone app registers its push token for the signed-in user (POST), or removes it on
// sign-out (DELETE).
async function readToken(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; platform?: unknown };
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  // APNs device tokens are hex strings (64 characters today; Apple allows longer).
  if (!/^[0-9a-fA-F]{32,200}$/.test(token)) return null;
  return { token: token.toLowerCase(), platform: body.platform === 'android' ? 'android' : 'ios' };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const parsed = await readToken(request);
  if (!parsed) return NextResponse.json({ error: 'Bad token.' }, { status: 400 });
  await savePushToken(session.user.id, parsed.token, parsed.platform);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session.user) return NextResponse.json({ ok: true });
  const parsed = await readToken(request);
  if (parsed) await removePushToken(session.user.id, parsed.token);
  return NextResponse.json({ ok: true });
}
