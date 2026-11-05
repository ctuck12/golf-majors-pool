import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  saveRosterForUser,
  saveTieBreakForUser,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
} from '../../lib/pool-store';
import { TOURNAMENT_META } from '../../lib/tournament-config';
import { getLockTimeOverrides } from '../../lib/lock-time-store';
function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to view a saved roster.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId || !isTournamentId(tournamentId)) {
    return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
  }

  return NextResponse.json({ roster: session.user.rosters[tournamentId] ?? [] });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to save a roster.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { tournamentId?: string; roster?: unknown; tieBreak?: unknown };

    if (!body.tournamentId || !isTournamentId(body.tournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }

    // Server-side lock: the commissioner's manual toggle, or the pool lock time
    // (manual override or the built-in schedule) having passed.
    const tournamentId = body.tournamentId;
    if (session.pool?.seasonExpired) {
      return NextResponse.json(
        { error: "This league's season pass has expired. Your commissioner can renew it in the app." },
        { status: 403 },
      );
    }
    if (session.pool?.lineupLocks?.[tournamentId] === true) {
      return NextResponse.json({ error: 'Picks are locked for this tournament.' }, { status: 403 });
    }
    const lockOverrides = await getLockTimeOverrides().catch(() => ({} as Awaited<ReturnType<typeof getLockTimeOverrides>>));
    const lockAtIso = lockOverrides[tournamentId] ?? TOURNAMENT_META[tournamentId]?.lockAtUtc;
    if (lockAtIso && Date.now() >= new Date(lockAtIso).getTime()) {
      return NextResponse.json({ error: 'Picks are locked for this tournament.' }, { status: 403 });
    }

    const roster = await saveRosterForUser(session.user.id, tournamentId, body.roster);

    const tieBreakNum = typeof body.tieBreak === 'number' ? body.tieBreak : parseInt(String(body.tieBreak ?? ''), 10);
    if (!Number.isNaN(tieBreakNum) && tieBreakNum >= 100 && tieBreakNum <= 999) {
      await saveTieBreakForUser(session.user.id, tournamentId, tieBreakNum);
    }
    const refreshedSession = await getSessionContext(token);

    return NextResponse.json({
      roster,
      user: refreshedSession.user,
      pool: refreshedSession.pool,
      entries: refreshedSession.entries,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save roster.' },
      { status: 400 },
    );
  }
}
