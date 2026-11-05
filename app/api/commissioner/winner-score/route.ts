import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
  updatePoolWinnerScore,
} from '../../../lib/pool-store';

function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool settings.' }, { status: 401 });
  }

  // League tools: only a commissioner of the user's current league.
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { tournamentId?: string; score?: number };

    if (!body.tournamentId || !isTournamentId(body.tournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }

    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 200 || score > 400) {
      return NextResponse.json({ error: 'Enter a valid total stroke count (200–400).' }, { status: 400 });
    }

    const pool = await updatePoolWinnerScore(session.user.id, body.tournamentId, score);
    return NextResponse.json({ pool });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save winner score.' },
      { status: 400 },
    );
  }
}
