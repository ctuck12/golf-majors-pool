import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  isAppAdmin,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
  setStatOverride,
} from '../../../lib/pool-store';

function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

// POST /api/commissioner/player-status
// Body: { tournamentId, playerName, status: 'WD' | 'DQ' | 'MDF' }
// Sets a position/score override so the player shows the correct status on the leaderboard.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool settings.' }, { status: 401 });
  }

  if (!isAppAdmin(session.user)) {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  const body = (await request.json()) as { tournamentId?: string; playerName?: string; status?: string };

  if (!body.tournamentId || !isTournamentId(body.tournamentId)) {
    return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
  }
  if (!body.playerName || typeof body.playerName !== 'string') {
    return NextResponse.json({ error: 'playerName is required.' }, { status: 400 });
  }
  const status = (body.status ?? '').toUpperCase();
  if (!['WD', 'DQ', 'MDF'].includes(status)) {
    return NextResponse.json({ error: 'status must be WD, DQ, or MDF.' }, { status: 400 });
  }

  await setStatOverride(body.tournamentId, body.playerName, {
    position: status,
    thru: '--',
    statLine: { par: 0, birdie: 0, eagle: 0, albatross: 0, holeInOne: 0, bogey: 0, doubleBogey: 0, tripleOrWorse: 0 },
  });

  return NextResponse.json({ ok: true, set: `${body.tournamentId}:${body.playerName} → ${status}` });
}
