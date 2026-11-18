export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';
import { resolveChangedAt } from '@/app/lib/changed-at';

// World rankings are listed under ESPN's season. Use this year's, or last year's until the new
// season has a ranking date posted.
const espnSeasonBase = (year: number) => `https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/${year}`;

async function getMostRecentRankings(): Promise<{ base: string; dateKey: string } | null> {
  const year = new Date().getUTCFullYear();
  for (const season of [year, year - 1]) {
    try {
      const base = espnSeasonBase(season);
      const res = await fetch(`${base}/rankings/1`, {
        next: { revalidate: 86400 },
      } as RequestInit);
      if (!res.ok) continue;
      const data = await res.json();
      const rankings = data.rankings as Array<{ $ref?: string }> | undefined;
      if (!Array.isArray(rankings) || rankings.length === 0) continue;
      // First item is the most recent date
      const ref = rankings[0]?.$ref ?? '';
      const match = ref.match(/\/dates\/(\d{8})/);
      if (match?.[1]) return { base, dateKey: match[1] };
    } catch {
      // try the previous season
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ rank: null });

  try {
    const [espnId, latest] = await Promise.all([
      getEspnId(name),
      getMostRecentRankings(),
    ]);

    if (!espnId || !latest) return Response.json({ rank: null });
    const { base, dateKey } = latest;

    const rankRes = await fetch(`${base}/rankings/1/dates/${dateKey}?limit=500`, {
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!rankRes.ok) return Response.json({ rank: null });

    const data = await rankRes.json();

    // ESPN world rankings date entries: try both 'athletes' and 'rankings' array formats
    const entries: Array<Record<string, unknown>> =
      (data.ranks as Array<Record<string, unknown>> | undefined) ??
      [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      // Try direct 'athlete' $ref field
      const athleteVal = entry.athlete as Record<string, string> | string | undefined;
      const ref: string =
        typeof athleteVal === 'string'
          ? athleteVal
          : typeof athleteVal === 'object' && athleteVal
          ? (Object.values(athleteVal)[0] ?? '')
          : '';
      const id = ref.match(/athletes\/(\d+)/)?.[1];
      if (id === espnId) {
        const explicitRank = typeof entry.current === 'number' ? entry.current : i + 1;
        const updatedAt = await resolveChangedAt(`rank-changed:owgr:${name}`, String(explicitRank));
        return Response.json({ rank: explicitRank, updatedAt });
      }
    }

    return Response.json({ rank: null });
  } catch {
    return Response.json({ rank: null });
  }
}
