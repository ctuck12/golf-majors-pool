import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
  updatePoolLineupLock,
  updatePoolPicksOpen,
} from '../../../lib/pool-store';

function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage lineup locks.' }, { status: 401 });
  }

  // League tools: only a commissioner of the user's current league.
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { tournamentId?: string; locked?: boolean; picksOpen?: boolean };

    if (!body.tournamentId || !isTournamentId(body.tournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }

    if (typeof body.locked !== 'boolean' && typeof body.picksOpen !== 'boolean') {
      return NextResponse.json({ error: 'locked or picksOpen is required.' }, { status: 400 });
    }

    let pool;
    if (typeof body.locked === 'boolean') {
      pool = await updatePoolLineupLock(session.user.id, body.tournamentId, body.locked);
    }
    if (typeof body.picksOpen === 'boolean') {
      pool = await updatePoolPicksOpen(session.user.id, body.tournamentId, body.picksOpen);
    }
    return NextResponse.json({ pool });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update lineup lock.' },
      { status: 400 },
    );
  }
}
