import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — 147 players × ESPN calls needs time

import redis from '@/app/lib/redis';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { fetchPlayerSeasonResults } from '@/app/lib/espn-player-season';

const CACHE_TTL = 432000; // 120 hours
const BATCH_SIZE = 5;

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  const players = PLAYER_POOL_WITH_PGA_IDS;
  let cached = 0;
  let fetched = 0;
  let empty = 0;
  let errors = 0;

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (player) => {
        const cacheKey = `player-season:2026:${player.name}`;
        try {
          if (!force) {
            const existing = await redis.get(cacheKey);
            if (existing) { cached++; return; }
          }
          const results = await fetchPlayerSeasonResults(player.name);
          if (results.length > 0) {
            await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
            fetched++;
          } else {
            empty++;
          }
        } catch {
          errors++;
        }
      }),
    );
  }

  return Response.json({
    total: players.length,
    alreadyCached: cached,
    freshlyFetched: fetched,
    noResults: empty,
    errors,
  });
}
