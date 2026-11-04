import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';

const ESPN_OVERVIEW = 'https://site.api.espn.com/apis/common/v3/sports/golf/pga/athletes';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';

  if (!name) return Response.json({ error: 'name required' });

  const espnId = await getEspnId(name);

  // Raw ESPN search results for debugging
  const espnSearchRaw: Record<string, unknown> = {};
  for (const q of [name, 'Joohyung Kim', 'Tom Kim', 'Kim Joohyung']) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=${encodeURIComponent(q)}&limit=10&type=player`, { cache: 'no-store' });
      const data = res.ok ? await res.json() as { results?: Array<{ contents?: Array<{ uid?: string; description?: string }> }> } : null;
      const contents = data?.results?.[0]?.contents ?? [];
      espnSearchRaw[q] = contents.map((c) => ({ uid: c.uid, description: c.description }));
    } catch (e) { espnSearchRaw[q] = { error: String(e) }; }
  }

  // Fetch ESPN overview raw data
  let overview: Record<string, unknown> | null = null;
  if (espnId) {
    try {
      const res = await fetch(`${ESPN_OVERVIEW}/${espnId}/overview`, { cache: 'no-store' });
      if (res.ok) overview = await res.json() as Record<string, unknown>;
    } catch (e) {
      overview = { error: String(e) };
    }
  }

  // ESPN Core season athlete stats (try multiple URLs)
  const coreSeasonResults: Record<string, unknown> = {};
  if (espnId) {
    const year = new Date().getFullYear();
    const urls = [
      `${ESPN_CORE}/pga/seasons/${year}/athletes/${espnId}/statistics/0`,
      `${ESPN_CORE}/pga/seasons/${year}/athletes/${espnId}/statistics`,
      `${ESPN_CORE}/pga/seasons/${year - 1}/athletes/${espnId}/statistics/0`,
      `${ESPN_CORE}/pga/athletes/${espnId}/statistics/0`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
        coreSeasonResults[url] = { status: res.status, data: res.ok ? await res.json() : null };
      } catch (e) {
        coreSeasonResults[url] = { error: String(e) };
      }
    }
  }

  // PGA Tour GQL: player search by name
  let pgaPlayerSearch: unknown = null;
  try {
    const searchQuery = `
      query Players {
        players {
          id
          firstName
          lastName
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query: searchQuery }),
      signal: AbortSignal.timeout(8000),
    });
    const allPlayers = res.ok ? await res.json() as { data?: { players?: Array<{ id: string; firstName: string; lastName: string }> } } : null;
    const kimPlayers = allPlayers?.data?.players?.filter((p) => p.lastName?.toLowerCase().includes('kim') || p.firstName?.toLowerCase().includes('joohyung'));
    pgaPlayerSearch = { status: res.status, kimPlayers, totalPlayers: allPlayers?.data?.players?.length };
  } catch (e) {
    pgaPlayerSearch = { error: String(e) };
  }

  // PGA Tour GQL: playerProfileStats
  let pgaProfileRaw: unknown = null;
  if (pgaTourId) {
    try {
      const query = `
        query PlayerProfileStats($playerId: ID!) {
          playerProfileStats(playerId: $playerId) {
            stats { statId value rank }
          }
        }
      `;
      const res = await fetch(PGA_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
        body: JSON.stringify({ query, variables: { playerId: pgaTourId } }),
        signal: AbortSignal.timeout(8000),
      });
      pgaProfileRaw = { status: res.status, data: res.ok ? await res.json() : await res.text() };
    } catch (e) {
      pgaProfileRaw = { error: String(e) };
    }
  }

  // PGA Tour GQL: statLeaderboard for stat 107
  let pgaLeaderboard107: unknown = null;
  if (pgaTourId) {
    try {
      const query = `
        query StatLeaderboard($statId: ID!) {
          statLeaderboard(statId: $statId) {
            rows { rank displayValue player { id } }
          }
        }
      `;
      const res = await fetch(PGA_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
        body: JSON.stringify({ query, variables: { statId: '107' } }),
        signal: AbortSignal.timeout(8000),
      });
      const raw = res.ok ? await res.json() as { data?: { statLeaderboard?: { rows?: Array<{ rank?: unknown; displayValue?: unknown; player?: { id?: unknown } }> } } } : null;
      const rows = raw?.data?.statLeaderboard?.rows ?? [];
      const playerRow = rows.find((r) => String(r.player?.id) === String(pgaTourId));
      pgaLeaderboard107 = { status: res.status, totalRows: rows.length, playerRow, first3Rows: rows.slice(0, 3) };
    } catch (e) {
      pgaLeaderboard107 = { error: String(e) };
    }
  }

  // Extract useful parts from ESPN overview
  const summaryStats = (overview?.summaryStatistics as Array<{ name?: string; displayValue?: string }> | undefined) ?? [];
  const categories = ((overview?.seasonRankings as Record<string, unknown>)?.categories as Array<{ name?: string; displayValue?: string; value?: number; rank?: number; average?: number; averageDisplayValue?: string }> | undefined) ?? [];
  const statisticsNames = (overview?.statistics as Record<string, unknown> | undefined)?.names as string[] | undefined;
  const statisticsSplits = (overview?.statistics as Record<string, unknown> | undefined)?.splits as Array<{ displayName?: string; stats?: string[] }> | undefined;

  return Response.json({
    pgaPlayerSearch,
    espnId,
    espnSearchRaw,
    pgaTourId,
    espnSummaryStatNames: summaryStats.map((s) => ({ name: s.name, value: s.displayValue })),
    espnCategoryNames: categories.map((c) => ({ name: c.name, displayValue: c.displayValue, numericValue: c.value, rank: c.rank, average: c.average, averageDisplayValue: c.averageDisplayValue })),
    espnStatisticsNames: statisticsNames ?? [],
    espnStatisticsSplits: (statisticsSplits ?? []).map((sp) => ({ displayName: sp.displayName, stats: sp.stats?.slice(0, 20) })),
    coreSeasonResults,
    pgaProfileRaw,
    pgaLeaderboard107,
  });
}
