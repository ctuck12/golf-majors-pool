import { after } from 'next/server';
import { learnedPlayerFlags, refreshPlayerFlagsIfStale } from '../../lib/player-flags';

export const dynamic = 'force-dynamic';

// Countries learned from the live feeds (normalized name -> flag code), for golfers the app's own
// flag list doesn't have yet. The feeds are re-read in the background at most twice a day.
export async function GET() {
  const flags = await learnedPlayerFlags();
  after(() => refreshPlayerFlagsIfStale().catch(() => {}));
  return Response.json({ flags }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
}
