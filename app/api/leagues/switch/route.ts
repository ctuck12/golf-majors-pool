import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME, switchActiveLeague } from '../../../lib/pool-store';

// POST { leagueId } → makes one of the caller's leagues the one the app shows.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to switch leagues.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { leagueId?: string };
    await switchActiveLeague(session.user.id, body.leagueId ?? '');
    return NextResponse.json(await getSessionContext(token));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to switch leagues.' },
      { status: 400 },
    );
  }
}
