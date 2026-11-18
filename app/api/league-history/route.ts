import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEFAULT_POOL_ID, getSessionContext, readLeagueHistory, SESSION_COOKIE_NAME, TOURNAMENT_IDS, userDataBackend } from '../../lib/pool-store';
import { copyLegacyArchive } from '../../lib/legacy-archive';

export const dynamic = 'force-dynamic';

// Every finished tournament in the signed-in user's league (standings without golfer detail),
// for the season standings and the Hall of Champions.
export async function GET() {
  if (userDataBackend() !== 'postgres') return NextResponse.json({ events: [] });
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session.user || !session.pool) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (session.pool.id === DEFAULT_POOL_ID) await copyLegacyArchive(session.pool.id, [...TOURNAMENT_IDS]).catch(() => {});
  const rows = await readLeagueHistory(session.pool.id);
  return NextResponse.json({
    events: rows.map((row) => ({ tournamentId: row.tournament_id, season: row.season, standings: row.standings, payouts: row.payouts ?? null })),
  });
}
