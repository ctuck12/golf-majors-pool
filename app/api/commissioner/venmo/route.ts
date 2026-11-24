import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME, setLeagueVenmoEnabled } from '../../../lib/pool-store';

// PATCH { enabled } → turns Venmo on or off for the commissioner's current league.
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);
  if (!session.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'Only the commissioner can change this.' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { enabled?: unknown };
    if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'enabled is required.' }, { status: 400 });
    await setLeagueVenmoEnabled(session.user.id, body.enabled);
    return NextResponse.json(await getSessionContext(token));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update.' }, { status: 400 });
  }
}
