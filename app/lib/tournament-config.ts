// The pool's tournaments, season by season: dates, first tee times, courses and ESPN ids.
// Pure data and helpers, used by both the app screens and the server.
//
// To set up a new season, add its block to SCHEDULE (and the year to POOL_SEASONS below).
// ESPN assigns event ids a few months ahead; until one is filled in, live scoring finds the
// event on ESPN's scoreboard by name (see app/lib/espn.ts).

export type TournamentKey = 'players' | 'masters' | 'pga' | 'us-open' | 'open';

export const TOURNAMENT_KEYS: TournamentKey[] = ['players', 'masters', 'pga', 'us-open', 'open'];

export type TournamentMeta = {
  // PGA Tour 3-digit tournament code (builds GraphQL ids like R2026100 for the stats APIs).
  // Live scoring is ESPN-only via espnEventId — no paid feeds.
  pgaTournCode: string;
  year: string;
  // Thursday of Round 1 (course's local date).
  startDate: string;
  courseName: string;
  par: number;
  // IANA timezone of the course, for the "Course Time" display.
  timeZone: string;
  espnEventId?: string;
  // UTC ISO — Round 1 first tee time. Picks lock and the cron's notStarted bypass trigger at
  // this time unless a commissioner sets a Pool Lock Time for the week.
  lockAtUtc: string;
};

const PGA_CODES: Record<TournamentKey, string> = {
  players: '011',
  masters: '014',
  pga: '033',
  'us-open': '026',
  open: '100',
};

type SeasonEvent = Omit<TournamentMeta, 'pgaTournCode' | 'year'>;

// ESPN event ids confirmed via site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard.
const SCHEDULE: Record<number, Record<TournamentKey, SeasonEvent>> = {
  2026: {
    players: { startDate: '2026-03-12', courseName: 'TPC Sawgrass', par: 72, timeZone: 'America/New_York', espnEventId: '401811937', lockAtUtc: '2026-03-12T11:40:00Z' }, // 7:40 AM EDT
    masters: { startDate: '2026-04-09', courseName: 'Augusta National Golf Club', par: 72, timeZone: 'America/New_York', espnEventId: '401811941', lockAtUtc: '2026-04-09T11:30:00Z' }, // 7:30 AM EDT
    pga: { startDate: '2026-05-14', courseName: 'Aronimink Golf Club', par: 70, timeZone: 'America/New_York', espnEventId: '401811947', lockAtUtc: '2026-05-14T11:20:00Z' }, // 7:20 AM EDT
    'us-open': { startDate: '2026-06-18', courseName: 'Shinnecock Hills Golf Club', par: 70, timeZone: 'America/New_York', espnEventId: '401811952', lockAtUtc: '2026-06-18T11:15:00Z' }, // 7:15 AM EDT
    open: { startDate: '2026-07-16', courseName: 'Royal Birkdale Golf Club', par: 70, timeZone: 'Europe/London', espnEventId: '401811957', lockAtUtc: '2026-07-16T05:35:00Z' }, // 6:35 AM BST
  },
  // 2027 first tee times are estimates from each event's usual start; a commissioner can set the
  // exact Pool Lock Time once tee times are published (Monday of tournament week).
  2027: {
    players: { startDate: '2027-03-11', courseName: 'TPC Sawgrass', par: 72, timeZone: 'America/New_York', lockAtUtc: '2027-03-11T12:40:00Z' }, // 7:40 AM EST (DST starts Mar 14)
    masters: { startDate: '2027-04-08', courseName: 'Augusta National Golf Club', par: 72, timeZone: 'America/New_York', lockAtUtc: '2027-04-08T11:30:00Z' }, // 7:30 AM EDT
    pga: { startDate: '2027-05-20', courseName: 'Fields Ranch East at PGA Frisco', par: 72, timeZone: 'America/Chicago', lockAtUtc: '2027-05-20T12:00:00Z' }, // 7:00 AM CDT
    'us-open': { startDate: '2027-06-17', courseName: 'Pebble Beach Golf Links', par: 71, timeZone: 'America/Los_Angeles', lockAtUtc: '2027-06-17T13:45:00Z' }, // 6:45 AM PDT
    open: { startDate: '2027-07-15', courseName: 'Old Course, St Andrews', par: 72, timeZone: 'Europe/London', lockAtUtc: '2027-07-15T05:35:00Z' }, // 6:35 AM BST
  },
};

// Seasons the pool has a schedule for, oldest first. Season 1 = 2026.
export const POOL_SEASONS = Object.keys(SCHEDULE).map(Number).sort((a, b) => a - b);

export function getTournamentMeta(tournamentId: string, season: number): TournamentMeta | undefined {
  const event = SCHEDULE[season]?.[tournamentId as TournamentKey];
  if (!event) return undefined;
  return { ...event, pgaTournCode: PGA_CODES[tournamentId as TournamentKey], year: String(season) };
}

// An event is over (for picks) once the Monday after it begins has started.
function concludesAt(meta: TournamentMeta) {
  return Date.parse(`${meta.startDate}T00:00:00Z`) + 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000;
}

// The season a tournament's picks are for right now: its current event until that event is
// over, then the next season's. Past the last scheduled season, stays on the last one.
export function picksSeason(tournamentId: string, now = new Date()): number {
  for (const season of POOL_SEASONS) {
    const meta = getTournamentMeta(tournamentId, season);
    if (meta && now.getTime() < concludesAt(meta)) return season;
  }
  return POOL_SEASONS[POOL_SEASONS.length - 1];
}

// The season of a tournament's most recent event that has started (null before the first one).
// Its results are the ones on show until the next event, and winners are paid for it.
export function latestStartedSeason(tournamentId: string, now = new Date()): number | null {
  let latest: number | null = null;
  for (const season of POOL_SEASONS) {
    const meta = getTournamentMeta(tournamentId, season);
    if (meta && now.getTime() >= Date.parse(meta.lockAtUtc)) latest = season;
  }
  return latest;
}

// The event a tournament's picks, live scoring and lock are about right now.
export function currentTournamentMeta(tournamentId: string, now = new Date()): TournamentMeta | undefined {
  return getTournamentMeta(tournamentId, picksSeason(tournamentId, now));
}

// The lock time in force for an event: the commissioner's override when it was set for that
// event's week (an override left over from a past season doesn't apply), else the schedule's.
export function effectiveLockTime(override: string | undefined, scheduledLockAtUtc: string | undefined): string | undefined {
  if (override && scheduledLockAtUtc) {
    const gap = Math.abs(Date.parse(override) - Date.parse(scheduledLockAtUtc));
    if (gap <= 7 * 24 * 60 * 60 * 1000) return override;
  }
  return override && !scheduledLockAtUtc ? override : scheduledLockAtUtc;
}

// Look up tournament meta by ESPN event ID (any season).
export function getTournamentMetaByEspnId(espnEventId: string): TournamentMeta | undefined {
  for (const season of POOL_SEASONS) {
    for (const key of TOURNAMENT_KEYS) {
      const meta = getTournamentMeta(key, season);
      if (meta?.espnEventId === espnEventId) return meta;
    }
  }
  return undefined;
}

// Returns the active golf season year. The PGA/DP World season rolls over on
// Nov 1 each year (e.g. Nov 1 2026 → season 2027). Adjust cutoff if needed.
export function getActiveSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-based
  return month >= 11 ? year + 1 : year;
}
