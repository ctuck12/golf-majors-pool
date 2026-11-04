import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import { autoLockPoolLineup, TOURNAMENT_IDS, type TournamentId } from '@/app/lib/pool-store';
import redis from '@/app/lib/redis';

// One-shot admin endpoint: clears the notStarted leaderboard cache and locks picks.
// Hit /api/admin/force-tournament-start?tournamentId=pga when ESPN is live but the
// cron is still waiting out its 30-min notStarted TTL.
export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? '';

  if (!TOURNAMENT_IDS.includes(tournamentId as TournamentId)) {
    return Response.json({ error: 'Unknown tournamentId.' }, { status: 400 });
  }

  const meta = TOURNAMENT_META[tournamentId];
  if (!meta) {
    return Response.json({ error: 'No meta for tournament.' }, { status: 400 });
  }

  const cacheKey = `leaderboard-cache:${tournamentId}`;
  const deleted = await redis.del(cacheKey);
  await autoLockPoolLineup(tournamentId as TournamentId);

  return Response.json({
    tournamentId,
    cacheCleared: deleted > 0,
    lineupLocked: true,
    note: 'Cache cleared and picks locked. The next cron run will fetch live ESPN data.',
  });
}
