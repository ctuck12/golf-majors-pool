import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
  updatePoolPayouts,
} from '../../../lib/pool-store';

function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage payouts.' }, { status: 401 });
  }

  // League tools: only a commissioner of the user's current league.
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      tournamentId?: string;
      first?: number;
      second?: number;
      third?: number;
    };

    if (!body.tournamentId || !isTournamentId(body.tournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }

    const first = Number(body.first);
    const second = Number(body.second);
    const third = Number(body.third);

    if ([first, second, third].some((value) => !Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: 'Enter valid payout amounts.' }, { status: 400 });
    }

    const pool = await updatePoolPayouts(session.user.id, body.tournamentId, {
      first,
      second,
      third,
    });

    return NextResponse.json({ pool });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update payouts.' },
      { status: 400 },
    );
  }
}
