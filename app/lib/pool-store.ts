import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PLAYER_POOL_WITH_PGA_IDS } from './player-pool';
import redis from './redis';

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

type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  // When each tournament's roster was FIRST submitted complete (drives the newest-first
  // sort in the Submitted Picks popup). Absent for rosters saved before this field existed.
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
  createdAt: string;
};

type StoredSession = {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
};

type StoredPool = {
  id: string;
  name: string;
  joinCode: string;
  memberUserIds: string[];
  lineupLocks: Partial<Record<TournamentId, boolean>>;
  picksOpen: Partial<Record<TournamentId, boolean>>;
  payouts: Partial<Record<TournamentId, TournamentPayouts>>;
  winnerScores: Partial<Record<TournamentId, number>>;
  createdAt: string;
};

type StoredDatabase = {
  users: StoredUser[];
  sessions: StoredSession[];
  pools: StoredPool[];
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
};

// The Open 2026 rosters submitted before rosterSubmittedAt existed, in their actual
// submission order (synthetic times on the Monday picks opened; any post-feature
// submission is newer and sorts above them).
const LEGACY_ROSTER_SUBMITTED_AT: Record<string, Partial<Record<TournamentId, string>>> = {
  'Stephen Warren': { open: '2026-07-13T15:00:00.000Z' },
  'Brian Carr':     { open: '2026-07-13T16:00:00.000Z' },
  'Clayton Tucker': { open: '2026-07-13T17:00:00.000Z' },
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

const DB_KEY = 'pool-database';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MAX_PLAYER_ID = Math.max(...PLAYER_POOL_WITH_PGA_IDS.map((player) => player.id));

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeJoinCode(joinCode: string) {
  return joinCode.trim().toUpperCase();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex');
}

function sanitizeRoster(roster: unknown) {
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
function resolveRosterSubmittedAt(user: StoredUser): Partial<Record<TournamentId, string>> {
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

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    poolIds: user.poolIds ?? [],
    rosters: user.rosters ?? {},
    tieBreaks: user.tieBreaks ?? {},
    rosterSubmittedAt: resolveRosterSubmittedAt(user),
  };
}

function createDefaultPool(): StoredPool {
  return {
    id: DEFAULT_POOL_ID,
    name: 'Golf Majors Pool',
    joinCode: DEFAULT_POOL_JOIN_CODE,
    memberUserIds: [],
    lineupLocks: {},
    picksOpen: {},
    payouts: {},
    winnerScores: {},
    createdAt: nowIso(),
  };
}

function createInitialDatabase(): StoredDatabase {
  return {
    users: [],
    sessions: [],
    pools: [createDefaultPool()],
  };
}

function normalizeDatabase(database: StoredDatabase): StoredDatabase {
  database.users = (database.users ?? []).map((user) => ({
    ...user,
    poolIds: user.poolIds ?? [],
    rosters: user.rosters ?? {},
    tieBreaks: user.tieBreaks ?? {},
  }));

  database.pools = (database.pools ?? []).length ? database.pools : [createDefaultPool()];
  database.pools = database.pools.map((pool) => ({
    ...pool,
    memberUserIds: pool.memberUserIds ?? [],
    lineupLocks: pool.lineupLocks ?? {},
    picksOpen: pool.picksOpen ?? {},
    payouts: pool.payouts ?? {},
  }));

  database.sessions = (database.sessions ?? []).filter(
    (session) => new Date(session.expiresAt).getTime() > Date.now(),
  );

  return database;
}

async function readDatabase(): Promise<StoredDatabase> {
  const raw = await redis.get(DB_KEY);
  const stored: StoredDatabase | null = raw ? (JSON.parse(raw) as StoredDatabase) : null;
  return normalizeDatabase(stored ?? createInitialDatabase());
}

async function writeDatabase(database: StoredDatabase): Promise<void> {
  const normalized = normalizeDatabase(database);
  await redis.set(DB_KEY, JSON.stringify(normalized));
}

export async function registerUser(input: {
  displayName: string;
  email: string;
  password: string;
  joinCode?: string;
}) {
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;
  const joinCode = input.joinCode ? normalizeJoinCode(input.joinCode) : '';

  if (displayName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }

  if (!email.includes('@')) {
    throw new Error('Enter a valid email address.');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const database = await readDatabase();

  if (database.users.some((user) => user.email === email)) {
    throw new Error('An account with that email already exists.');
  }

  const passwordSalt = randomBytes(16).toString('hex');
  const user: StoredUser = {
    id: randomBytes(12).toString('hex'),
    email,
    displayName,
    passwordHash: hashPassword(password, passwordSalt),
    passwordSalt,
    poolIds: [],
    rosters: {},
    tieBreaks: {},
    createdAt: nowIso(),
  };

  const poolToJoin = joinCode
    ? database.pools.find((item) => item.joinCode === joinCode)
    : database.pools.find((item) => item.id === DEFAULT_POOL_ID);

  if (!poolToJoin) {
    throw new Error(joinCode ? 'That pool join code was not recognized.' : 'Default pool was not found.');
  }

  if (!poolToJoin.memberUserIds.includes(user.id)) {
    poolToJoin.memberUserIds.push(user.id);
  }

  if (!user.poolIds.includes(poolToJoin.id)) {
    user.poolIds.push(poolToJoin.id);
  }

  database.users.push(user);
  await writeDatabase(database);
  return toPublicUser(user);
}

export async function loginUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const database = await readDatabase();
  const user = database.users.find((item) => item.email === email);

  if (!user) {
    throw new Error('Email or password is incorrect.');
  }

  const expectedHash = Buffer.from(user.passwordHash, 'hex');
  const receivedHash = Buffer.from(hashPassword(password, user.passwordSalt), 'hex');

  if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) {
    throw new Error('Email or password is incorrect.');
  }

  return toPublicUser(user);
}

export async function createSession(userId: string) {
  const database = await readDatabase();
  const token = randomBytes(32).toString('hex');

  database.sessions.push({
    token,
    userId,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  await writeDatabase(database);
  return token;
}

export async function removeSession(token: string) {
  const database = await readDatabase();
  database.sessions = database.sessions.filter((session) => session.token !== token);
  await writeDatabase(database);
}

export async function getSessionContext(token: string | undefined) {
  if (!token) {
    return { user: null, pool: null, entries: [] as PublicPoolEntry[] };
  }

  const database = await readDatabase();
  const session = database.sessions.find((item) => item.token === token);

  if (!session) {
    return { user: null, pool: null, entries: [] as PublicPoolEntry[] };
  }

  const user = database.users.find((item) => item.id === session.userId);

  if (!user) {
    return { user: null, pool: null, entries: [] as PublicPoolEntry[] };
  }

  const activePool = database.pools.find((pool) => user.poolIds.includes(pool.id)) ?? null;
  // Pick privacy: another member's picks for a tournament stay hidden while its pick window is
  // open but not yet locked (the pre-start submission window). The commissioner sees everything,
  // and every member always sees their OWN picks. Masking preserves the roster LENGTH (so "who has
  // submitted" counts still work) but replaces the golfer ids with 0 so the actual picks are gone.
  const isCommissionerViewer =
    user.email.trim().toLowerCase() === 'ctuck12@gmail.com' &&
    (user.displayName ?? '').trim() === 'Clayton Tucker';
  const tournamentRevealed = (tid: TournamentId): boolean =>
    !(activePool?.picksOpen?.[tid] === true && activePool?.lineupLocks?.[tid] !== true);
  const maskRosters = (
    rosters: Partial<Record<TournamentId, number[]>> | undefined,
    isSelf: boolean,
  ): Partial<Record<TournamentId, number[]>> => {
    if (isCommissionerViewer || isSelf || !rosters) return rosters ?? {};
    const out: Partial<Record<TournamentId, number[]>> = {};
    for (const key of Object.keys(rosters) as TournamentId[]) {
      const ids = rosters[key] ?? [];
      out[key] = tournamentRevealed(key) ? ids : ids.map(() => 0);
    }
    return out;
  };
  const entries = activePool
    ? database.users
        .filter((item) => activePool.memberUserIds.includes(item.id))
        .map((item) => ({
          id: item.id,
          name: item.displayName,
          rosters: maskRosters(item.rosters, item.id === user.id),
          tieBreaks: item.tieBreaks ?? {},
          rosterSubmittedAt: resolveRosterSubmittedAt(item),
        }))
    : [];

  return {
    user: toPublicUser(user),
    pool: activePool
      ? {
          id: activePool.id,
          name: activePool.name,
          joinCode: activePool.joinCode,
          lineupLocks: activePool.lineupLocks,
          picksOpen: activePool.picksOpen,
          payouts: activePool.payouts,
        }
      : null,
    entries,
  };
}

export async function joinPoolForUser(userId: string, joinCode: string) {
  const normalizedCode = normalizeJoinCode(joinCode);

  if (!normalizedCode) {
    throw new Error('Enter a pool join code.');
  }

  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  const pool = database.pools.find((item) => item.joinCode === normalizedCode);

  if (!pool) {
    throw new Error('That pool join code was not recognized.');
  }

  if (!user.poolIds.includes(pool.id)) {
    user.poolIds.push(pool.id);
  }

  if (!pool.memberUserIds.includes(user.id)) {
    pool.memberUserIds.push(user.id);
  }

  await writeDatabase(database);

  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    lineupLocks: pool.lineupLocks,
    picksOpen: pool.picksOpen,
    payouts: pool.payouts,
    winnerScores: pool.winnerScores ?? {},
  } satisfies PublicPool;
}

export async function saveRosterForUser(userId: string, tournamentId: TournamentId, roster: unknown) {
  if (!TOURNAMENT_IDS.includes(tournamentId)) {
    throw new Error('Unknown tournament.');
  }

  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  const sanitizedRoster = sanitizeRoster(roster);

  if (sanitizedRoster.length !== 6) {
    throw new Error('Roster must include exactly 6 valid golfers.');
  }

  user.rosters = user.rosters ?? {};
  user.rosters[tournamentId] = sanitizedRoster;
  // Stamp the first complete submission only, so later edits keep the original order.
  user.rosterSubmittedAt = user.rosterSubmittedAt ?? {};
  user.rosterSubmittedAt[tournamentId] ??= new Date().toISOString();
  await writeDatabase(database);

  return user.rosters[tournamentId] ?? [];
}

export async function saveTieBreakForUser(userId: string, tournamentId: TournamentId, tieBreak: number) {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  user.tieBreaks = user.tieBreaks ?? {};
  user.tieBreaks[tournamentId] = tieBreak;
  await writeDatabase(database);
}

const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const PASSWORD_RESET_THROTTLE_SECONDS = 60;

// Only the token's hash is stored, so someone reading Redis can't turn a key into a working link.
function passwordResetKey(token: string) {
  return `password-reset:${createHash('sha256').update(token).digest('hex')}`;
}

// Issues a one-time reset token for the account using this email. Returns null when no account
// matches, or when a link was already sent to this email in the last minute (stops email floods).
export async function createPasswordResetToken(email: string) {
  const normalized = normalizeEmail(email);
  const database = await readDatabase();
  const user = database.users.find((item) => item.email === normalized);

  if (!user) {
    return null;
  }

  const firstRequest = await redis.set(
    `password-reset-throttle:${normalized}`,
    '1',
    'EX',
    PASSWORD_RESET_THROTTLE_SECONDS,
    'NX',
  );
  if (firstRequest !== 'OK') {
    return null;
  }

  const token = randomBytes(32).toString('hex');
  await redis.setex(passwordResetKey(token), PASSWORD_RESET_TTL_SECONDS, user.id);
  return { token, email: user.email, displayName: user.displayName };
}

// Lets the next request through right away, e.g. after the reset email failed to send.
export async function clearPasswordResetThrottle(email: string) {
  await redis.del(`password-reset-throttle:${normalizeEmail(email)}`);
}

// Uses up a reset token and sets the new password. Signs the account out everywhere else.
export async function resetPasswordWithToken(token: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const key = passwordResetKey(token);
  const results = await redis.multi().get(key).del(key).exec();
  const userId = results?.[0]?.[1];

  if (typeof userId !== 'string') {
    throw new Error('This reset link is invalid or has expired. Request a new one.');
  }

  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  const passwordSalt = randomBytes(16).toString('hex');
  user.passwordSalt = passwordSalt;
  user.passwordHash = hashPassword(newPassword, passwordSalt);
  database.sessions = database.sessions.filter((session) => session.userId !== user.id);
  await writeDatabase(database);
  return toPublicUser(user);
}

export async function updateUserAccount(
  userId: string,
  updates: {
    password?: string;
    displayName?: string;
  },
) {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  if (typeof updates.displayName === 'string') {
    const displayName = updates.displayName.trim();

    if (displayName.length < 2) {
      throw new Error('Display name must be at least 2 characters.');
    }

    user.displayName = displayName;
  }

  if (typeof updates.password === 'string' && updates.password.length > 0) {
    if (updates.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const passwordSalt = randomBytes(16).toString('hex');
    user.passwordSalt = passwordSalt;
    user.passwordHash = hashPassword(updates.password, passwordSalt);
  }

  await writeDatabase(database);
  return toPublicUser(user);
}

export async function listPoolMembers(userId: string) {
  const database = await readDatabase();
  const user = database.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error('User account was not found.');
  }

  const activePool = database.pools.find((pool) => user.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    return [];
  }

  return database.users
    .filter((item) => activePool.memberUserIds.includes(item.id))
    .map((item) => toPublicUser(item));
}

export async function updatePoolMember(
  requestingUserId: string,
  memberId: string,
  updates: {
    displayName?: string;
    email?: string;
    password?: string;
    rosters?: Partial<Record<TournamentId, unknown>>;
    tieBreaks?: Partial<Record<TournamentId, number | null>>;
  },
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool = database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool || !activePool.memberUserIds.includes(memberId)) {
    throw new Error('Pool member was not found.');
  }

  const member = database.users.find((item) => item.id === memberId);

  if (!member) {
    throw new Error('Pool member was not found.');
  }

  if (typeof updates.displayName === 'string') {
    const displayName = updates.displayName.trim();
    if (displayName.length < 2) {
      throw new Error('Display name must be at least 2 characters.');
    }
    member.displayName = displayName;
  }

  if (typeof updates.email === 'string') {
    const email = normalizeEmail(updates.email);
    if (!email.includes('@')) {
      throw new Error('Enter a valid email address.');
    }
    const existing = database.users.find((item) => item.email === email && item.id !== member.id);
    if (existing) {
      throw new Error('An account with that email already exists.');
    }
    member.email = email;
  }

  if (typeof updates.password === 'string' && updates.password.trim().length > 0) {
    if (updates.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    const passwordSalt = randomBytes(16).toString('hex');
    member.passwordSalt = passwordSalt;
    member.passwordHash = hashPassword(updates.password, passwordSalt);
  }

  if (updates.rosters) {
    member.rosters = member.rosters ?? {};
    for (const tournamentId of TOURNAMENT_IDS) {
      if (Object.prototype.hasOwnProperty.call(updates.rosters, tournamentId)) {
        member.rosters[tournamentId] = sanitizeRoster(updates.rosters[tournamentId]);
        if ((member.rosters[tournamentId] ?? []).length === 6) {
          member.rosterSubmittedAt = member.rosterSubmittedAt ?? {};
          member.rosterSubmittedAt[tournamentId] ??= new Date().toISOString();
        }
      }
    }
  }

  if (updates.tieBreaks) {
    member.tieBreaks = member.tieBreaks ?? {};
    for (const tournamentId of TOURNAMENT_IDS) {
      if (Object.prototype.hasOwnProperty.call(updates.tieBreaks, tournamentId)) {
        const value = updates.tieBreaks[tournamentId];
        if (value === null) {
          delete member.tieBreaks[tournamentId];
        } else if (typeof value === 'number') {
          member.tieBreaks[tournamentId] = value;
        }
      }
    }
  }

  await writeDatabase(database);
  return toPublicUser(member);
}

export async function deletePoolMember(requestingUserId: string, memberId: string) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool = database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool || !activePool.memberUserIds.includes(memberId)) {
    throw new Error('Pool member was not found.');
  }

  database.users = database.users.filter((item) => item.id !== memberId);
  database.sessions = database.sessions.filter((item) => item.userId !== memberId);

  for (const pool of database.pools) {
    pool.memberUserIds = pool.memberUserIds.filter((id) => id !== memberId);
  }

  await writeDatabase(database);
}

export async function updatePoolLineupLock(
  requestingUserId: string,
  tournamentId: TournamentId,
  locked: boolean,
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool =
    database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    throw new Error('Pool was not found.');
  }

  activePool.lineupLocks = activePool.lineupLocks ?? {};
  activePool.lineupLocks[tournamentId] = locked;
  await writeDatabase(database);

  return {
    id: activePool.id,
    name: activePool.name,
    joinCode: activePool.joinCode,
    lineupLocks: activePool.lineupLocks,
    picksOpen: activePool.picksOpen,
    payouts: activePool.payouts,
    winnerScores: activePool.winnerScores ?? {},
  } satisfies PublicPool;
}

export async function updatePoolPicksOpen(
  requestingUserId: string,
  tournamentId: TournamentId,
  open: boolean,
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool =
    database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    throw new Error('Pool was not found.');
  }

  activePool.picksOpen = activePool.picksOpen ?? {};
  activePool.picksOpen[tournamentId] = open;
  // Opening picks begins a fresh pick window: clear any stale lineup lock from the previous cycle so
  // members can edit AND so other members' new picks stay masked (getSessionContext hides rosters
  // while picks are open and unlocked; the auto-lock cron re-locks — and re-reveals — at first tee).
  if (open) {
    activePool.lineupLocks = activePool.lineupLocks ?? {};
    activePool.lineupLocks[tournamentId] = false;
  }
  await writeDatabase(database);

  return {
    id: activePool.id,
    name: activePool.name,
    joinCode: activePool.joinCode,
    lineupLocks: activePool.lineupLocks,
    picksOpen: activePool.picksOpen,
    payouts: activePool.payouts,
    winnerScores: activePool.winnerScores ?? {},
  } satisfies PublicPool;
}

export async function autoLockPoolLineup(tournamentId: TournamentId): Promise<void> {
  const database = await readDatabase();
  const pool = database.pools.find((p) => p.id === DEFAULT_POOL_ID);
  if (!pool) return;
  if (pool.lineupLocks?.[tournamentId]) return; // already locked
  pool.lineupLocks = pool.lineupLocks ?? {};
  pool.lineupLocks[tournamentId] = true;
  await writeDatabase(database);
}

export async function getSelectedPlayerIdsForTournament(tournamentId: TournamentId): Promise<Set<number>> {
  const db = await readDatabase();
  const selected = new Set<number>();
  for (const user of db.users) {
    for (const id of user.rosters[tournamentId] ?? []) {
      selected.add(id);
    }
  }
  return selected;
}

// ── Stat overrides (persistent Redis key for manual final-stat corrections) ─

const STAT_OVERRIDES_KEY = 'pool-stat-overrides';

export type StatOverrideEntry = {
  position: string;
  thru: string;
  statLine: {
    par: number;
    birdie: number;
    eagle: number;
    albatross: number;
    holeInOne: number;
    bogey: number;
    doubleBogey: number;
    tripleOrWorse: number;
  };
};

// Key: `${tournamentId}:${canonicalPlayerName}`
export type StatOverrides = Record<string, StatOverrideEntry>;

export async function getStatOverrides(): Promise<StatOverrides> {
  const raw = await redis.get(STAT_OVERRIDES_KEY);
  return raw ? (JSON.parse(raw) as StatOverrides) : {};
}

export async function setStatOverride(
  tournamentId: string,
  playerName: string,
  entry: StatOverrideEntry,
): Promise<void> {
  const overrides = await getStatOverrides();
  overrides[`${tournamentId}:${playerName}`] = entry;
  await redis.set(STAT_OVERRIDES_KEY, JSON.stringify(overrides));
}

export async function updatePoolPayouts(
  requestingUserId: string,
  tournamentId: TournamentId,
  payouts: TournamentPayouts,
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool =
    database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    throw new Error('Pool was not found.');
  }

  activePool.payouts = activePool.payouts ?? {};
  activePool.payouts[tournamentId] = {
    first: payouts.first,
    second: payouts.second,
    third: payouts.third,
  };
  await writeDatabase(database);

  return {
    id: activePool.id,
    name: activePool.name,
    joinCode: activePool.joinCode,
    lineupLocks: activePool.lineupLocks,
    picksOpen: activePool.picksOpen,
    payouts: activePool.payouts,
    winnerScores: activePool.winnerScores ?? {},
  } satisfies PublicPool;
}

export async function updatePoolWinnerScore(
  requestingUserId: string,
  tournamentId: TournamentId,
  score: number,
) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool =
    database.pools.find((pool) => requestingUser.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);

  if (!activePool) {
    throw new Error('Pool was not found.');
  }

  activePool.winnerScores = activePool.winnerScores ?? {};
  activePool.winnerScores[tournamentId] = score;
  await writeDatabase(database);

  return {
    id: activePool.id,
    name: activePool.name,
    joinCode: activePool.joinCode,
    lineupLocks: activePool.lineupLocks,
    picksOpen: activePool.picksOpen,
    payouts: activePool.payouts,
    winnerScores: activePool.winnerScores,
  } satisfies PublicPool;
}
