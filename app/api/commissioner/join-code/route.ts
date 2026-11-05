import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, regenerateJoinCode, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

// POST → replaces the current league's join code. Old codes and invite links stop working.
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage your league.' }, { status: 401 });
  }

  // League tools: only a commissioner of the user's current league.
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    await regenerateJoinCode(session.user.id);
    return NextResponse.json(await getSessionContext(token));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to change the league code.' },
      { status: 400 },
    );
  }
}
