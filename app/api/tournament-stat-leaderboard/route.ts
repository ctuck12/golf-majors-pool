export const dynamic = 'force-dynamic';
export const maxDuration = 60; // full-field scrambling build supplements ~74 cut players from scorecards

import redis from '@/app/lib/redis';
import { isPgaStatKey, buildPgaLeaderboard, tournLbCacheKey, tournLbTtl } from '@/app/lib/tournament-sg-leaderboard';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_CORE_ATHLETES = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/athletes';
const BATCH_SIZE = 25;

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };

const LOWER_IS_BETTER = new Set(['scoringAverage', 'puttAverage']);

// Course stats come from ESPN per-event competitor statistics (ESPN has NO tournament SG).
const courseStatDefs: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number }> = [
  { key: 'drivingDistance', espnName: 'driveDistAvg', isPercent: false, decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },
  // NOTE: scrambling is NOT here — ESPN per-event stats carry no scrambling field, so it is sourced
  // from the PGA feed (statId 130) via buildPgaLeaderboard, like SG.
  { key: 'sandSaves', espnName: 'sandSaves', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSavePct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSave', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'bunkerSavePct', isPercent: true, decimals: 1 },
  { key: 'puttAverage', espnName: 'puttsGirAvg', isPercent: false, decimals: 3 },
];

function statNumeric(stats: Stat[], name: string): number | null {
  const s = stats.find((x) => x.name === name);
  if (!s) return null;
  if (s.value != null && !isNaN(s.value) && s.value !== 0) return s.value;
  const dv = parseFloat(s.displayValue ?? '');
  if (!isNaN(dv) && dv !== 0) return dv;
  const av = parseFloat(s.averageDisplayValue ?? '');
  if (!isNaN(av) && av !== 0) return av;
  if (s.average != null && !isNaN(s.average) && s.average !== 0) return s.average;
  return null;
}

function fmtCourse(v: number, key: string): string {
  const def = courseStatDefs.find((d) => d.key === key);
  const str = v.toFixed(def?.decimals ?? 1);
  return def?.isPercent ? `${str}%` : str;
}

async function fetchCompetitorIds(eventId: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
    return (data.items ?? []).map((item) => item.id ?? item.$ref?.match(/competitors\/(\d+)/)?.[1] ?? '').filter(Boolean);
  } catch { return []; }
}

async function fetchCompetitorStats(espnId: string, eventId: string): Promise<Stat[] | null> {
  try {
    const res = await fetch(
      `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics/0`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { splits?: { categories?: Array<{ stats?: Stat[] }> } };
    const stats = data?.splits?.categories?.[0]?.stats;
    return Array.isArray(stats) && stats.length > 0 ? stats : null;
  } catch { return null; }
}

async function fetchAthleteName(espnId: string): Promise<string> {
  try {
    const res = await fetch(`${ESPN_CORE_ATHLETES}/${espnId}?lang=en&region=us`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!res.ok) return '';
    const data = await res.json() as { displayName?: string; fullName?: string; firstName?: string; lastName?: string };
    return data?.displayName ?? data?.fullName ?? ([data?.firstName, data?.lastName].filter(Boolean).join(' ')) ?? '';
  } catch { return ''; }
}

async function batchAll<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    results.push(...await Promise.all(tasks.slice(i, i + size).map((t) => t())));
  }
  return results;
}

type Entry = { rank: number; name: string; value: string };

// Build the full-field tournament leaderboard for a COURSE stat from ESPN competitor stats.
async function buildCourseLeaderboard(eventId: string, statKey: string): Promise<{ entries: Entry[]; fieldAvg: string | null }> {
  const ids = await fetchCompetitorIds(eventId);
  if (ids.length === 0) return { entries: [], fieldAvg: null };
  const allStats = await batchAll(ids.map((id) => () => fetchCompetitorStats(id, eventId)), BATCH_SIZE);
  const defsForKey = courseStatDefs.filter((d) => d.key === statKey);
  const playerValues: Array<{ espnId: string; value: number }> = [];
  for (let i = 0; i < ids.length; i++) {
    const stats = allStats[i];
    if (!stats) continue;
    for (const def of defsForKey) {
      const raw = statNumeric(stats, def.espnName);
      if (raw === null) continue;
      playerValues.push({ espnId: ids[i], value: raw });
      break;
    }
  }
  if (playerValues.length === 0) return { entries: [], fieldAvg: null };
  playerValues.sort((a, b) => LOWER_IS_BETTER.has(statKey) ? a.value - b.value : b.value - a.value);
  const names = await batchAll(playerValues.map((p) => () => fetchAthleteName(p.espnId)), BATCH_SIZE);
  const entries: Entry[] = playerValues
    .map((p, i) => ({ rank: i + 1, name: names[i], value: fmtCourse(p.value, statKey) }))
    .filter((e) => e.name);
  const mean = playerValues.reduce((s, p) => s + p.value, 0) / playerValues.length;
  return { entries, fieldAvg: fmtCourse(mean, statKey) };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  const eventId = searchParams.get('eventId') ?? '';
  if (!statKey || !eventId) return Response.json({ entries: [], fieldAvg: null });

  const cacheKey = tournLbCacheKey(eventId, statKey);
  const bust = searchParams.get('bust') === '1';
  if (!bust) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return Response.json(JSON.parse(cached));
    } catch { /* ignore */ }
  }

  try {
    const result = isPgaStatKey(statKey)
      ? await buildPgaLeaderboard(eventId, statKey)
      : await buildCourseLeaderboard(eventId, statKey);

    if (result.entries.length > 0) {
      // Static (completed/future) events cache long; a LIVE event caches briefly so the card tracks
      // each round instead of freezing on the first warm. (Empty builds are never cached.)
      try { await redis.setex(cacheKey, await tournLbTtl(eventId), JSON.stringify(result)); } catch { /* ignore */ }
    }
    return Response.json(result);
  } catch {
    return Response.json({ entries: [], fieldAvg: null });
  }
}
