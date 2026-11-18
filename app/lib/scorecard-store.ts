import { gzipSync, gunzipSync } from 'zlib';
import redis from './redis';
import type { SlashGolfLeaderboardRow } from './slashgolf';

// ── Name normalization ─────────────────────────────────────────────────────

export function normName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Types ──────────────────────────────────────────────────────────────────

export type StoredHole = { holeNumber: number; par: number; score: number };
export type StoredRound = { roundId: number; holes: StoredHole[] };

export type StoredPlayerScorecards = {
  playerId: string;
  playerName: string;
  rounds: StoredRound[];
  refreshedAt: string;
};

export type ScorecardCacheFile = {
  tournamentId: string;
  lastCompletedRound: number;
  players: Record<string, StoredPlayerScorecards>;
  refreshedAt: string;
  liveRefreshedAt: string | null;
};

export type RoundLeaderEntry = {
  leaders: string[];
  leadScore: number;
  capturedAt: string;
};

export type RoundLeaderStore = Record<
  string,
  Record<string, RoundLeaderEntry | null>
>;

export type TournamentLowRoundStore = Record<
  string,
  Record<string, number | null>
>;

export type LeaderboardCacheFile = {
  cachedAt: string;
  leaderboard: SlashGolfLeaderboardRow[];
  currentRound: number;
  roundStatus: string;
  projectedCut: string | null;
  notStarted?: boolean;
  tournamentComplete?: boolean; // all 4 rounds official; cron and scorecard live-fetch skip this
};

// ── Redis helpers ──────────────────────────────────────────────────────────
// Large values are gzip-compressed (~5-8x smaller) to keep Redis Cloud NETWORK usage down —
// the leaderboard + scorecard blobs move on every cron tick and every client poll, and raw
// JSON was blowing past the plan's monthly bandwidth. Reads transparently handle both the
// compressed ("gz:" prefix) and legacy plain-JSON formats, so no migration is needed.

const GZ_PREFIX = 'gz:';
const GZ_MIN_BYTES = 1024;

async function rget<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  const json = raw.startsWith(GZ_PREFIX)
    ? gunzipSync(Buffer.from(raw.slice(GZ_PREFIX.length), 'base64')).toString('utf8')
    : raw;
  return JSON.parse(json) as T;
}

async function rset(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const json = JSON.stringify(value);
  const payload = json.length >= GZ_MIN_BYTES ? GZ_PREFIX + gzipSync(json).toString('base64') : json;
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, payload);
  } else {
    await redis.set(key, payload);
  }
}

// ── Scorecard cache ────────────────────────────────────────────────────────

function scorecardKey(tournamentId: string) {
  return `scorecard-cache:${tournamentId}`;
}

export async function getScorecardCache(tournamentId: string): Promise<ScorecardCacheFile | null> {
  return rget<ScorecardCacheFile>(scorecardKey(tournamentId));
}

export async function saveScorecardCache(
  tournamentId: string,
  players: Record<string, StoredPlayerScorecards>,
  lastCompletedRound: number,
): Promise<void> {
  await rset(scorecardKey(tournamentId), {
    tournamentId,
    lastCompletedRound,
    players,
    refreshedAt: new Date().toISOString(),
    liveRefreshedAt: null,
  } satisfies ScorecardCacheFile);
}

export async function mergeScorecardCache(
  tournamentId: string,
  updatedPlayers: Record<string, StoredPlayerScorecards>,
): Promise<void> {
  const existing = await getScorecardCache(tournamentId);
  await rset(scorecardKey(tournamentId), {
    tournamentId,
    lastCompletedRound: existing?.lastCompletedRound ?? 0,
    players: { ...(existing?.players ?? {}), ...updatedPlayers },
    refreshedAt: existing?.refreshedAt ?? new Date().toISOString(),
    liveRefreshedAt: new Date().toISOString(),
  } satisfies ScorecardCacheFile);
}

// ── Round leaders ──────────────────────────────────────────────────────────

const ROUND_LEADERS_KEY = 'round-leaders';

export async function getRoundLeaderStore(): Promise<RoundLeaderStore> {
  return (await rget<RoundLeaderStore>(ROUND_LEADERS_KEY)) ?? {};
}

export async function saveRoundLeader(
  tournamentId: string,
  roundId: number,
  leaders: string[],
  leadScore: number,
): Promise<void> {
  const store = await getRoundLeaderStore();
  store[tournamentId] ??= {};
  store[tournamentId][String(roundId)] = {
    leaders,
    leadScore,
    capturedAt: new Date().toISOString(),
  };
  await rset(ROUND_LEADERS_KEY, store);
}

export function getRoundLeadersAwarded(
  tournamentId: string,
  playerName: string,
  store: RoundLeaderStore,
): { first: boolean; second: boolean; third: boolean } {
  const rounds = store[tournamentId] ?? {};
  const norm = (s: string) => s.toLowerCase().trim();
  const isLeader = (roundKey: string) =>
    rounds[roundKey]?.leaders.some((n) => norm(n) === norm(playerName)) ?? false;
  return { first: isLeader('1'), second: isLeader('2'), third: isLeader('3') };
}

// ── Tournament low round ───────────────────────────────────────────────────

const LOW_ROUNDS_KEY = 'low-rounds';

export async function getLowRoundStore(): Promise<TournamentLowRoundStore> {
  return (await rget<TournamentLowRoundStore>(LOW_ROUNDS_KEY)) ?? {};
}

export async function saveLowRound(
  tournamentId: string,
  roundId: number,
  lowScore: number,
): Promise<void> {
  const store = await getLowRoundStore();
  store[tournamentId] ??= {};
  store[tournamentId][String(roundId)] = lowScore;
  await rset(LOW_ROUNDS_KEY, store);
}

export function getTournamentLowRoundScore(
  tournamentId: string,
  store: TournamentLowRoundStore,
): number | null {
  const rounds = store[tournamentId] ?? {};
  const scores = Object.values(rounds).filter((s): s is number => s !== null);
  return scores.length ? Math.min(...scores) : null;
}

// ── Leaderboard cache ──────────────────────────────────────────────────────

// not-started entries get a 30-minute TTL so the cron backs off automatically
const NOT_STARTED_TTL_SECONDS = 30 * 60;

function leaderboardKey(tournamentId: string) {
  return `leaderboard-cache:${tournamentId}`;
}

export async function readLeaderboardCache(tournamentId: string): Promise<LeaderboardCacheFile | null> {
  return rget<LeaderboardCacheFile>(leaderboardKey(tournamentId));
}

export async function writeLeaderboardCache(
  tournamentId: string,
  data: LeaderboardCacheFile,
): Promise<void> {
  // not-started entries expire on their own so the cron retries after 30 min
  const ttl = data.notStarted ? NOT_STARTED_TTL_SECONDS : undefined;
  await rset(leaderboardKey(tournamentId), data, ttl);
}

// ── Season rollover ────────────────────────────────────────────────────────
// The live data above is stored per tournament, not per year. Last season's final leaderboard
// stays on show (results view) until the new season's event week begins; then everything from
// that event is cleared so the new one starts clean. `live-season:<id>` records which season the
// stored data belongs to (missing = 2026, the first season) and the ESPN event id in use.

export type LiveSeasonMarker = { season: number; espnEventId?: string };

function liveSeasonKey(tournamentId: string) {
  return `live-season:${tournamentId}`;
}

export async function getLiveSeason(tournamentId: string): Promise<LiveSeasonMarker | null> {
  return rget<LiveSeasonMarker>(liveSeasonKey(tournamentId));
}

export async function setLiveSeason(tournamentId: string, marker: LiveSeasonMarker): Promise<void> {
  await rset(liveSeasonKey(tournamentId), marker);
}

// Clears one tournament's leaderboard, scorecards, round leaders and low rounds.
export async function clearTournamentLiveData(tournamentId: string): Promise<void> {
  await redis.del(leaderboardKey(tournamentId), scorecardKey(tournamentId));
  const [leaders, lows] = await Promise.all([getRoundLeaderStore(), getLowRoundStore()]);
  if (tournamentId in leaders) {
    delete leaders[tournamentId];
    await rset(ROUND_LEADERS_KEY, leaders);
  }
  if (tournamentId in lows) {
    delete lows[tournamentId];
    await rset(LOW_ROUNDS_KEY, lows);
  }
}
