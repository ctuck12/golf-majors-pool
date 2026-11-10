import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  isAppAdmin,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
} from '../../../lib/pool-store';
import { getRoundLeaderStore } from '../../../lib/scorecard-store';
import redis from '../../../lib/redis';

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool settings.' }, { status: 401 });
  }

  if (!isAppAdmin(session.user)) {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  const round = searchParams.get('round');

  if (!tournamentId || !TOURNAMENT_IDS.includes(tournamentId as TournamentId)) {
    return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
  }

  const roundNum = Number(round);
  if (!round || !Number.isFinite(roundNum) || roundNum < 1 || roundNum > 3) {
    return NextResponse.json({ error: 'Round must be 1, 2, or 3.' }, { status: 400 });
  }

  const store = await getRoundLeaderStore();
  if (store[tournamentId]) {
    delete store[tournamentId][String(roundNum)];
    await redis.set('round-leaders', JSON.stringify(store));
  }

  return NextResponse.json({ success: true });
}
