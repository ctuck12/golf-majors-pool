export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';
import { getActiveSeason } from '@/app/lib/tournament-config';
import { resolveChangedAt } from '@/app/lib/changed-at';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

// Fallback FedEx Cup rank straight from the PGA Tour's own standings (statDetails 02671 =
// FedExCup Season Points) — used when ESPN's leaders feed is down (it 500'd during Open week
// 2026). Matches by pgaTourId when known, else by normalized name.
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const normPga = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();

async function fedexRankFromPgaTour(pgaTourId: string, name: string): Promise<number | null> {
  try {
    const query = `
      query StatDetails($statId: String!) {
        statDetails(tourCode: R, statId: $statId) {
          rows {
            ... on StatDetailsPlayer {
              playerId
              playerName
              rank
            }
          }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { statId: '02671' } }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: { statDetails?: { rows?: Array<{ playerId?: string; playerName?: string; rank?: number | string }> } };
    };
    const rows = data?.data?.statDetails?.rows ?? [];
    const want = normPga(name);
    const hit = rows.find((r) => (pgaTourId && String(r.playerId ?? '') === pgaTourId) || (r.playerName && normPga(r.playerName) === want));
    if (!hit) return null;
    const rank = Number(hit.rank);
    return Number.isFinite(rank) && rank > 0 ? rank : null;
  } catch {
    return null;
  }
}

async function getRankFromLeaders(
  standingsRes: Response,
  espnId: string,
  categoryName: string,
): Promise<number | null> {
  if (!standingsRes.ok) return null;
  const data = await standingsRes.json();
  const cat = (data.categories as Array<{ name: string; leaders: unknown[] }> | undefined)?.find(
    (c) => c.name === categoryName,
  );
  if (!cat) return null;
  const leaders = cat.leaders as Array<{ value?: number; athlete: Record<string, string> }>;
  const idx = leaders.findIndex((l) => {
    const ref = Object.values(l.athlete)[0] ?? '';
    return ref.match(/athletes\/(\d+)/)?.[1] === espnId;
  });
  if (idx === -1) return null;
  // A player with 0 FedEx Cup points has no meaningful ranking — e.g. a past champion who played
  // one event (the Masters) and missed the cut still appears in the tail of ESPN's leaders list,
  // producing a bogus "rank". Only report a rank when the player has actually earned points.
  const value = leaders[idx].value;
  if (typeof value === 'number' && value <= 0) return null;
  return idx + 1;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const pgaTourId = searchParams.get('pgaTourId') ?? '';
  if (!name) return Response.json({ rank: null });

  try {
    const season = getActiveSeason();
    const [espnId, fedexRes] = await Promise.all([
      getEspnId(name),
      fetch(
        `${ESPN_CORE}/pga/seasons/${season}/types/2/leaders?limit=336`,
        { next: { revalidate: 3600 } },
      ),
    ]);

    const fedexFromEspn = espnId ? await getRankFromLeaders(fedexRes, espnId, 'cupPoints') : null;
    // ESPN's leaders feed has been unreliable — fall back to the PGA Tour's own standings.
    const fedexRank = fedexFromEspn ?? await fedexRankFromPgaTour(pgaTourId !== '0' ? pgaTourId : '', name);

    const updatedAt = await resolveChangedAt(`rank-changed:fedex:${name}`, String(fedexRank ?? ''));
    return Response.json({ rank: fedexRank, updatedAt });
  } catch {
    const fallback = await fedexRankFromPgaTour(pgaTourId !== '0' ? pgaTourId : '', name).catch(() => null);
    return Response.json({ rank: fallback });
  }
}
