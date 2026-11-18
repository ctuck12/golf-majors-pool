import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, leaveLeague, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

// POST { leagueId } → the signed-in member leaves that league. Returns the refreshed session.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { leagueId?: string };
    await leaveLeague(session.user.id, body.leagueId ?? '');
    return NextResponse.json(await getSessionContext(token));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to leave the league.' },
      { status: 400 },
    );
  }
}
