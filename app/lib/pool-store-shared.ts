import { scryptSync } from 'node:crypto';
import { PLAYER_POOL_WITH_PGA_IDS } from './player-pool';

// Constants, types and helpers shared by the Redis and Postgres user-data backends.

export const SESSION_COOKIE_NAME = 'golf-pool-session';
export const DEFAULT_POOL_ID = 'golf-majors-pool';
export const DEFAULT_POOL_JOIN_CODE = 'MAJORS2026';
export const TOURNAMENT_IDS = ['players', 'masters', 'pga', 'us-open', 'open'] as const;

export type TournamentId = (typeof TOURNAMENT_IDS)[number];
export type TournamentPayouts = {
  first: number;
  second: number;
  third: number;
};

export type LeagueRole = 'member' | 'commissioner';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
};

export type PublicPoolEntry = {
  id: string;
  name: string;
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
};

export type PublicPool = {
  id: string;
  name: string;
  joinCode: string;
  lineupLocks: Partial<Record<TournamentId, boolean>>;
  picksOpen: Partial<Record<TournamentId, boolean>>;
  payouts: Partial<Record<TournamentId, TournamentPayouts>>;
  winnerScores: Partial<Record<TournamentId, number>>;
};

// The pool as the signed-in user sees it: no winner scores, plus their role in it.
export type SessionPool = Omit<PublicPool, 'winnerScores'> & { role: LeagueRole };

export type SessionContext = {
  user: PublicUser | null;
  pool: SessionPool | null;
  entries: PublicPoolEntry[];
};

export const EMPTY_SESSION: SessionContext = { user: null, pool: null, entries: [] };

export type MemberUpdates = {
  displayName?: string;
  email?: string;
  password?: string;
  rosters?: Partial<Record<TournamentId, unknown>>;
  tieBreaks?: Partial<Record<TournamentId, number | null>>;
};

// Season pass per league, priced by member count (leagues.plan / leagues.member_limit).
// 'founder' leagues (the ones that existed before paid plans) are free with no cap.
export const LEAGUE_PLANS = [
  { id: 'six', memberLimit: 6, priceUsd: 8.99 },
  { id: 'small', memberLimit: 12, priceUsd: 24.99 },
  { id: 'standard', memberLimit: 25, priceUsd: 49.99 },
  { id: 'large', memberLimit: 50, priceUsd: 79.99 },
  { id: 'xl', memberLimit: 100, priceUsd: 129.99 },
] as const;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_PLAYER_ID = Math.max(...PLAYER_POOL_WITH_PGA_IDS.map((player) => player.id));

// The app admin runs the app-wide tools (golfer salaries, fields, lock times, ...) for every league.
const APP_ADMIN_EMAIL = 'ctuck12@gmail.com';
const APP_ADMIN_DISPLAY_NAME = 'Clayton Tucker';

export function isAppAdmin(user: { email: string; displayName: string } | null | undefined) {
  return Boolean(
    user &&
      user.email.trim().toLowerCase() === APP_ADMIN_EMAIL &&
      (user.displayName ?? '').trim() === APP_ADMIN_DISPLAY_NAME,
  );
}

// The Open 2026 rosters submitted before rosterSubmittedAt existed, in their actual
// submission order (synthetic times on the Monday picks opened; any post-feature
// submission is newer and sorts above them).
const LEGACY_ROSTER_SUBMITTED_AT: Record<string, Partial<Record<TournamentId, string>>> = {
  'Stephen Warren': { open: '2026-07-13T15:00:00.000Z' },
  'Brian Carr':     { open: '2026-07-13T16:00:00.000Z' },
  'Clayton Tucker': { open: '2026-07-13T17:00:00.000Z' },
};

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeJoinCode(joinCode: string) {
  return joinCode.trim().toUpperCase();
}

export function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex');
}

export function sanitizeRoster(roster: unknown) {
  if (!Array.isArray(roster)) {
    return [];
  }

  const seen = new Set<number>();
  const sanitized: number[] = [];

  for (const value of roster) {
    const numeric = Number(value);

    if (!Number.isInteger(numeric) || numeric < 1 || numeric > MAX_PLAYER_ID || seen.has(numeric)) {
      continue;
    }

    seen.add(numeric);
    sanitized.push(numeric);

    if (sanitized.length === 6) {
      break;
    }
  }

  return sanitized;
}

// Stamp for every complete roster: recorded submission time, else the known legacy order,
// else the member's account-creation time (see LEGACY_ROSTER_SUBMITTED_AT).
export function resolveRosterSubmittedAt(user: {
  displayName: string;
  createdAt: string;
  rosters?: Partial<Record<TournamentId, number[]>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
}): Partial<Record<TournamentId, string>> {
  return Object.fromEntries(
    TOURNAMENT_IDS
      .filter((tid) => (user.rosters?.[tid] ?? []).length === 6)
      .map((tid) => [
        tid,
        user.rosterSubmittedAt?.[tid]
          ?? LEGACY_ROSTER_SUBMITTED_AT[user.displayName]?.[tid]
          ?? user.createdAt,
      ]),
  );
}

// Pick privacy: another member's picks for a tournament stay hidden while its pick window is
// open but not yet locked (the pre-start submission window). The commissioner sees everything,
// and every member always sees their OWN picks. Masking preserves the roster LENGTH (so "who has
// submitted" counts still work) but replaces the golfer ids with 0 so the actual picks are gone.
export function maskRostersFor(
  pool: { picksOpen: Partial<Record<TournamentId, boolean>>; lineupLocks: Partial<Record<TournamentId, boolean>> } | null,
  viewerIsCommissioner: boolean,
) {
  const tournamentRevealed = (tid: TournamentId): boolean =>
    !(pool?.picksOpen?.[tid] === true && pool?.lineupLocks?.[tid] !== true);

  return (
    rosters: Partial<Record<TournamentId, number[]>> | undefined,
    isSelf: boolean,
  ): Partial<Record<TournamentId, number[]>> => {
    if (viewerIsCommissioner || isSelf || !rosters) return rosters ?? {};
    const out: Partial<Record<TournamentId, number[]>> = {};
    for (const key of Object.keys(rosters) as TournamentId[]) {
      const ids = rosters[key] ?? [];
      out[key] = tournamentRevealed(key) ? ids : ids.map(() => 0);
    }
    return out;
  };
}
