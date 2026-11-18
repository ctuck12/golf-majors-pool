import redis from './redis';
import { archiveSeasonsFor, saveStandingsArchive } from './pool-store';

// The founder league's 2026 Past Results were first saved in Redis (one shared set). They're
// copied into the database the first time they're needed.

export const legacyRowKey = (tid: string, year: number) => `standings-archive:v1:${tid}:${year}`;
const legacyYearsKey = (tid: string) => `standings-archive-years:v1:${tid}`;

export async function legacyYears(tid: string): Promise<number[]> {
  try {
    const raw = await redis.get(legacyYearsKey(tid));
    if (!raw) return [];
    const arr = JSON.parse(raw as string) as number[];
    return Array.isArray(arr) ? arr.filter((y) => typeof y === 'number') : [];
  } catch {
    return [];
  }
}

// Copies any founder-league results still only in Redis into the database.
export async function copyLegacyArchive(leagueId: string, tournamentIds: string[]) {
  for (const tid of tournamentIds) {
    const saved = new Set(await archiveSeasonsFor(leagueId, tid));
    for (const year of await legacyYears(tid)) {
      if (saved.has(year)) continue;
      try {
        const raw = await redis.get(legacyRowKey(tid, year));
        if (!raw) continue;
        const data = JSON.parse(raw as string) as { standings?: unknown[]; payouts?: unknown };
        if (data.standings?.length) await saveStandingsArchive(leagueId, tid, year, data.standings, data.payouts ?? null);
      } catch {
        // Skip a damaged row; the rest still copy.
      }
    }
  }
}
