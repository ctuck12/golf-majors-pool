export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonResults } from '@/app/lib/espn-player-season';
import { getActiveSeason } from '@/app/lib/tournament-config';

export type { SeasonResult } from '@/app/lib/espn-player-season';

const CACHE_TTL = 432000; // 120 hours
// Off-season fallback (last season's results) is re-checked twice a day so the new season's
// results show up soon after its first event.
const FALLBACK_TTL = 43200;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ results: null });

  const season = getActiveSeason();
  const cacheKey = `player-season:${season}:${name}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ results: JSON.parse(cached) });

    // Early in a new season a player has no results yet: show last season's until they do.
    let results = await fetchPlayerSeasonResults(name, season);
    let ttl = CACHE_TTL;
    if (results.length === 0) {
      results = await fetchPlayerSeasonResults(name, season - 1);
      ttl = FALLBACK_TTL;
    }

    if (results.length > 0) {
      await redis.setex(cacheKey, ttl, JSON.stringify(results));
    }
    return Response.json({ results: results.length > 0 ? results : null });
  } catch {
    return Response.json({ results: null });
  }
}
