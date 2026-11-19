import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import {
  getSessionContext,
  SESSION_COOKIE_NAME,
  setTournamentStateEverywhere,
  TOURNAMENT_IDS,
  type TournamentId,
} from '../../../lib/pool-store';
import { pushPicksOpen } from '../../../lib/push-triggers';
import { picksSeason } from '../../../lib/tournament-config';

function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

// Opening/closing picks and locking/unlocking lineups: the app admin only, for every league at
// once (every league plays the same field on the same schedule). Commissioners see the status.
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  if (!session.isAppAdmin) {
    return NextResponse.json({ error: 'Picks open and lock for every league at once, so only Golf Majors Pool can change them.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { tournamentId?: string; locked?: boolean; picksOpen?: boolean };

    if (!body.tournamentId || !isTournamentId(body.tournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }
    if (typeof body.locked !== 'boolean' && typeof body.picksOpen !== 'boolean') {
      return NextResponse.json({ error: 'locked or picksOpen is required.' }, { status: 400 });
    }

    const tournamentId = body.tournamentId;
    const pool = await setTournamentStateEverywhere(session.user.id, tournamentId, {
      ...(typeof body.locked === 'boolean' ? { locked: body.locked } : {}),
      ...(typeof body.picksOpen === 'boolean' ? { picksOpen: body.picksOpen } : {}),
    });
    if (body.picksOpen === true) {
      const input = { tournamentId, season: picksSeason(tournamentId), adminId: session.user.id };
      after(() => pushPicksOpen(input).catch(() => {}));
    }
    return NextResponse.json({ pool });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update picks.' },
      { status: 400 },
    );
  }
}
