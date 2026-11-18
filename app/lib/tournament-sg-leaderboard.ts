import redis from '@/app/lib/redis';
import { metaForEspnEvent } from '@/app/lib/espn-event-ids';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const sgFmt = (n: number) => n.toFixed(3);
const pctFmt = (n: number) => `${n.toFixed(1)}%`;

// Tournament stats sourced from the PGA Tour `statDetails` feed (EVENT_ONLY) rather than ESPN. The SG
// stats live only here; scrambling is here too because ESPN's per-event stats carry no scrambling
// field. Each entry maps a card stat key to its PGA statId, the value column to read, and how to format
// it. SG uses the per-round "Avg" column (matches the card); scrambling uses the "%" column.
type PgaStatCfg = { statId: string; column: string; fmt: (n: number) => string };
const PGA_STATS: Record<string, PgaStatCfg> = {
  sgTotal: { statId: '02675', column: 'Avg', fmt: sgFmt },
  sgTeeToGreen: { statId: '02674', column: 'Avg', fmt: sgFmt },
  sgOffTee: { statId: '02567', column: 'Avg', fmt: sgFmt },
  sgApproach: { statId: '02568', column: 'Avg', fmt: sgFmt },
  sgAroundGreen: { statId: '02569', column: 'Avg', fmt: sgFmt },
  sgPutting: { statId: '02564', column: 'Avg', fmt: sgFmt },
  scrambling: { statId: '130', column: '%', fmt: pctFmt },
};

// Card stat keys served from the PGA feed (so callers can route these here instead of ESPN).
export const PGA_STAT_KEYS = new Set(Object.keys(PGA_STATS));
export function isPgaStatKey(statKey: string): boolean {
  return PGA_STATS[statKey] !== undefined;
}

export type TournLbEntry = { rank: number; name: string; value: string };
export type TournLbResult = { entries: TournLbEntry[]; fieldAvg: string | null };

export function tournLbCacheKey(eventId: string, statKey: string): string {
  return `tourn-stat-lb:v13:${eventId}:${statKey}`;
}

// Cache TTL for a tournament leaderboard. Completed (or not-yet-started) events are static, so cache
// long (7 days). While an event is LIVE its stats change every round, so cache briefly (~10 min) and
// let the cron keep it fresh — otherwise the first warm of round 1 would freeze the card all weekend.
// Live window: from ~1 day before lock through ~5 days after (covers Thu–Sun play + Monday finalize).
export async function tournLbTtl(eventId: string): Promise<number> {
  const meta = await metaForEspnEvent(eventId);
  if (!meta?.lockAtUtc) return 604800;
  const lock = Date.parse(meta.lockAtUtc);
  if (isNaN(lock)) return 604800;
  const now = Date.now();
  const dayMs = 86400000;
  if (now >= lock - dayMs && now <= lock + 5 * dayMs) return 600; // live → refresh every ~10 min
  return 604800; // static (completed or future) → long cache
}

function parseNum(raw: string | undefined): number {
  // Handles "+1.234", "1,234", "50.00%" — parseFloat stops at the % sign.
  return parseFloat(String(raw ?? '').replace(/\+/g, '').replace(/,/g, '').trim());
}

// Dispatch a PGA-sourced tournament leaderboard build. SG stats come straight from the PGA Tour
// `statDetails` feed (EVENT_ONLY) — one cheap GraphQL call for the whole ranked field. Scrambling is
// special: the statDetails feed only ranks players who MADE THE CUT (~82), so cut players would show
// no scrambling rank while every other course stat (sourced from ESPN's full-field competitor stats)
// ranks all ~156 players. To make scrambling behave like the other course stats, we build the FULL
// field for it — statDetails for made-cut players, supplemented by each cut player's scorecard.
export async function buildPgaLeaderboard(eventId: string, statKey: string): Promise<TournLbResult> {
  if (statKey === 'scrambling') return buildFullFieldScramblingLeaderboard(eventId);
  return buildStatDetailsLeaderboard(eventId, statKey);
}

// Build the tournament leaderboard for a PGA-sourced stat from the PGA Tour `statDetails` feed
// (EVENT_ONLY). One cheap GraphQL call returns the ranked field (made-cut players only for percentage
// stats like scrambling), so this is safe to run on demand.
async function buildStatDetailsLeaderboard(eventId: string, statKey: string): Promise<TournLbResult> {
  const cfg = PGA_STATS[statKey];
  if (!cfg) return { entries: [], fieldAvg: null };
  const meta = await metaForEspnEvent(eventId);
  if (!meta) return { entries: [], fieldAvg: null };
  const pgaTournId = pgaTourTournId(meta.pgaTournCode, meta.year);
  const year = parseInt(meta.year, 10);

  const query = `
    query TournStatLeaderboard($statId: String!, $tournamentId: String!, $year: Int!) {
      statDetails(tourCode: R, statId: $statId, year: $year, eventQuery: { tournamentId: $tournamentId, queryType: EVENT_ONLY }) {
        rows {
          ... on StatDetailsPlayer {
            playerName
            rank
            stats { ... on CategoryPlayerStat { statName statValue } }
          }
        }
      }
    }
  `;
  type Row = { playerName?: string; rank?: number; stats?: Array<{ statName?: string; statValue?: string }> };
  let rows: Row[] = [];
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { statId: cfg.statId, tournamentId: pgaTournId, year } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { entries: [], fieldAvg: null };
    const data = await res.json() as { data?: { statDetails?: { rows?: Row[] } } };
    rows = data?.data?.statDetails?.rows ?? [];
  } catch { return { entries: [], fieldAvg: null }; }
  if (rows.length === 0) return { entries: [], fieldAvg: null };

  const parsed = rows
    .map((r) => {
      const stats = Array.isArray(r.stats) ? r.stats : [];
      const value = parseNum(stats.find((s) => s.statName === cfg.column)?.statValue);
      const rankNum = typeof r.rank === 'number' ? r.rank : parseInt(String(r.rank ?? '').replace(/^\s*T/i, '').trim());
      return { rank: rankNum, value, name: r.playerName ?? '' };
    })
    .filter((r) => !isNaN(r.rank) && r.rank > 0 && r.name && !isNaN(r.value));
  if (parsed.length === 0) return { entries: [], fieldAvg: null };
  parsed.sort((a, b) => a.rank - b.rank);
  const entries: TournLbEntry[] = parsed.map((r) => ({ rank: r.rank, name: r.name, value: cfg.fmt(r.value) }));
  const mean = parsed.reduce((s, r) => s + r.value, 0) / parsed.length;
  const fieldAvg = !isNaN(mean) ? cfg.fmt(mean) : null;
  return { entries, fieldAvg };
}

// Normalize a player name for matching PGA statDetails names against leaderboardV2 names.
function normScrName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae')
    .toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

type FieldPlayer = { id: string; name: string };

// Fetch the tournament field (every player who teed off) with PGA Tour player ids from leaderboardV2.
// This is how we discover the cut players that the statDetails scrambling feed omits.
async function fetchPgaField(pgaTournId: string): Promise<FieldPlayer[]> {
  const query = `
    query LB($id: ID!) {
      leaderboardV2(id: $id) {
        players { ... on PlayerRowV2 { player { id displayName } } }
      }
    }
  `;
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { id: pgaTournId } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { data?: { leaderboardV2?: { players?: Array<{ player?: { id?: string; displayName?: string } }> } } };
    const rows = data?.data?.leaderboardV2?.players ?? [];
    return rows
      .map((r) => ({ id: r.player?.id ?? '', name: r.player?.displayName ?? '' }))
      .filter((p) => p.id && p.name);
  } catch { return []; }
}

// Fetch one player's tournament scrambling % (statId 130) from their scorecard. Available for ALL
// players including those who missed the cut — the value the card already shows for cut players.
async function fetchScorecardScramblingPct(pgaTournId: string, playerId: string): Promise<number | null> {
  const query = `query SC($id: ID!, $playerId: ID!) { scorecardStatsV3(id: $id, playerId: $playerId) { rounds { round performance { statId total } } } }`;
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { id: pgaTournId, playerId } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { scorecardStatsV3?: { rounds?: Array<{ round?: string; performance?: Array<{ statId?: string; total?: string }> }> } } };
    const rounds = data?.data?.scorecardStatsV3?.rounds ?? [];
    const all = rounds.find((r) => r.round === '-1') ?? rounds[rounds.length - 1];
    const raw = (all?.performance ?? []).find((p) => p.statId === '130')?.total; // e.g. "52.94% (9/17)"
    if (!raw) return null;
    const n = parseNum(raw);
    return isNaN(n) ? null : n;
  } catch { return null; }
}

async function batchMap<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

// Build a FULL-FIELD scrambling leaderboard so cut players get a rank like every other course stat.
// made-cut values come from the cheap statDetails feed; cut players are supplemented from their
// scorecards, then the whole field is ranked together (standard competition ranking, ties share a
// rank — matching the statDetails style). Falls back to the made-cut-only leaderboard if the field
// feed is unavailable, so scrambling never regresses to empty.
export async function buildFullFieldScramblingLeaderboard(eventId: string): Promise<TournLbResult> {
  const meta = await metaForEspnEvent(eventId);
  if (!meta) return { entries: [], fieldAvg: null };
  const pgaTournId = pgaTourTournId(meta.pgaTournCode, meta.year);

  // made-cut values (percent numbers keyed by normalized name)
  const madeCut = await buildStatDetailsLeaderboard(eventId, 'scrambling');
  // No statDetails scrambling for this event (e.g. the Masters feed, or an event that hasn't produced
  // scrambling data yet) — return empty cheaply instead of firing a scorecard fetch for every player.
  if (madeCut.entries.length === 0) return madeCut;
  const valueByName = new Map<string, number>();
  const displayByName = new Map<string, string>();
  for (const e of madeCut.entries) {
    const v = parseNum(e.value);
    if (!isNaN(v)) { const k = normScrName(e.name); valueByName.set(k, v); displayByName.set(k, e.name); }
  }

  // Full field — if unavailable, return the made-cut leaderboard unchanged (no regression).
  const field = await fetchPgaField(pgaTournId);
  if (field.length === 0) return madeCut.entries.length > 0 ? madeCut : { entries: [], fieldAvg: null };

  // Cut players are those in the field with no statDetails scrambling value — supplement from scorecards.
  const missing: FieldPlayer[] = [];
  const seenMissing = new Set<string>();
  for (const p of field) {
    const k = normScrName(p.name);
    if (valueByName.has(k) || seenMissing.has(k)) continue;
    seenMissing.add(k);
    missing.push(p);
  }
  const supplemented = await batchMap(missing, 15, async (p) => ({ name: p.name, value: await fetchScorecardScramblingPct(pgaTournId, p.id) }));
  for (const s of supplemented) {
    if (s.value == null) continue;
    const k = normScrName(s.name);
    if (valueByName.has(k)) continue;
    valueByName.set(k, s.value);
    displayByName.set(k, s.name);
  }

  // Rank the combined field. Round to 1 decimal so ties are clean and match the statDetails display.
  const combined = Array.from(valueByName.entries())
    .map(([k, v]) => ({ name: displayByName.get(k) ?? '', value: Math.round(v * 10) / 10 }))
    .filter((c) => c.name);
  if (combined.length === 0) return madeCut;
  combined.sort((a, b) => b.value - a.value);
  const entries: TournLbEntry[] = [];
  let prevVal: number | null = null;
  let prevRank = 0;
  combined.forEach((c, i) => {
    const rank = (prevVal !== null && c.value === prevVal) ? prevRank : i + 1;
    prevVal = c.value;
    prevRank = rank;
    entries.push({ rank, name: c.name, value: `${c.value.toFixed(1)}%` });
  });
  const mean = combined.reduce((s, c) => s + c.value, 0) / combined.length;
  return { entries, fieldAvg: `${mean.toFixed(1)}%` };
}

// Read the PGA leaderboard from cache; if cold, build it (one GraphQL call) and cache it. This keeps the
// player card's tournament rank+value identical to the popup even when the warming cron hasn't run.
export async function getOrBuildPgaLeaderboard(eventId: string, statKey: string): Promise<TournLbResult | null> {
  const cacheKey = tournLbCacheKey(eventId, statKey);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached as string);
  } catch { /* fall through to build */ }
  const result = await buildPgaLeaderboard(eventId, statKey);
  if (result.entries.length > 0) {
    try { await redis.setex(cacheKey, await tournLbTtl(eventId), JSON.stringify(result)); } catch { /* ignore */ }
    return result;
  }
  return null;
}
