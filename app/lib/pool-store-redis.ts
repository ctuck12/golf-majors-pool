import { randomBytes, timingSafeEqual } from 'node:crypto';
import redis from './redis';
import {
  DEFAULT_POOL_ID,
  DEFAULT_POOL_JOIN_CODE,
  EMPTY_SESSION,
  hashPassword,
  isAppAdmin,
  maskRostersFor,
  normalizeEmail,
  normalizeJoinCode,
  nowIso,
  resolveRosterSubmittedAt,
  sanitizeRoster,
  SESSION_TTL_MS,
  TOURNAMENT_IDS,
  type MemberUpdates,
  type PublicPool,
  type PublicPoolEntry,
  type PublicUser,
  type SessionContext,
  type TournamentId,
  type TournamentPayouts,
} from './pool-store-shared';

// User data stored as one JSON blob in Redis (the original backend). Kept as the fallback while
// the Postgres backend rolls out; see pool-store.ts for how one is chosen.

export type StoredUser = {
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

export type StoredSession = {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
};

export type StoredPool = {
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

export type StoredDatabase = {
  users: StoredUser[];
  sessions: StoredSession[];
  pools: StoredPool[];
};

const DB_KEY = 'pool-database';

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

function toPublicPool(pool: StoredPool): PublicPool {
  return {
    id: pool.id,
    name: pool.name,
    joinCode: pool.joinCode,
    lineupLocks: pool.lineupLocks,
    picksOpen: pool.picksOpen,
    payouts: pool.payouts,
    winnerScores: pool.winnerScores ?? {},
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

// Raw read for the one-time copy into Postgres (expired sessions already dropped).
export async function readDatabase(): Promise<StoredDatabase> {
  const raw = await redis.get(DB_KEY);
  const stored: StoredDatabase | null = raw ? (JSON.parse(raw) as StoredDatabase) : null;
  return normalizeDatabase(stored ?? createInitialDatabase());
}

async function writeDatabase(database: StoredDatabase): Promise<void> {
  const normalized = normalizeDatabase(database);
  await redis.set(DB_KEY, JSON.stringify(normalized));
}

function findActivePool(database: StoredDatabase, user: StoredUser) {
  return database.pools.find((pool) => user.poolIds.includes(pool.id)) ??
    database.pools.find((pool) => pool.id === DEFAULT_POOL_ID);
}

async function requireActivePool(requestingUserId: string) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool = findActivePool(database, requestingUser);

  if (!activePool) {
    throw new Error('Pool was not found.');
  }

  return { database, activePool };
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

export async function getSessionContext(token: string | undefined): Promise<SessionContext> {
  if (!token) {
    return EMPTY_SESSION;
  }

  const database = await readDatabase();
  const session = database.sessions.find((item) => item.token === token);

  if (!session) {
    return EMPTY_SESSION;
  }

  const user = database.users.find((item) => item.id === session.userId);

  if (!user) {
    return EMPTY_SESSION;
  }

  const activePool = database.pools.find((pool) => user.poolIds.includes(pool.id)) ?? null;
  // In this backend the app admin is the commissioner of the one pool.
  const isCommissioner = isAppAdmin(user);
  const maskRosters = maskRostersFor(activePool, isCommissioner);
  const entries: PublicPoolEntry[] = activePool
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

  const commissioners = activePool
    ? database.users
        .filter((item) => activePool.memberUserIds.includes(item.id) && isAppAdmin(item))
        .map((item) => ({ id: item.id, name: item.displayName, email: item.email }))
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
          role: isCommissioner ? 'commissioner' : 'member',
          plan: 'founder',
          memberLimit: null,
          commissioners,
        }
      : null,
    entries,
    leagues: database.pools
      .filter((pool) => user.poolIds.includes(pool.id))
      .map((pool) => ({ id: pool.id, name: pool.name, role: isCommissioner ? 'commissioner' as const : 'member' as const })),
    isAppAdmin: isCommissioner,
    // Creating and managing multiple leagues needs the Postgres backend.
    canCreateLeague: false,
  };
}

const NEEDS_POSTGRES = 'Leagues need the Postgres backend (USER_DATA_BACKEND=postgres).';

export async function createLeague(): Promise<never> {
  throw new Error(NEEDS_POSTGRES);
}

export async function switchActiveLeague(): Promise<never> {
  throw new Error(NEEDS_POSTGRES);
}

export async function setMemberRole(): Promise<never> {
  throw new Error(NEEDS_POSTGRES);
}

export async function deleteOwnAccount(): Promise<never> {
  throw new Error(NEEDS_POSTGRES);
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
  return toPublicPool(pool);
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

export async function findUserByEmail(email: string) {
  const database = await readDatabase();
  const user = database.users.find((item) => item.email === normalizeEmail(email));
  return user ? { id: user.id, email: user.email, displayName: user.displayName } : null;
}

// Sets a new password and signs the account out of every session.
export async function setPasswordAndEndSessions(userId: string, newPassword: string) {
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

  const activePool = findActivePool(database, user);

  if (!activePool) {
    return [];
  }

  return database.users
    .filter((item) => activePool.memberUserIds.includes(item.id))
    .map((item) => toPublicUser(item));
}

export async function updatePoolMember(requestingUserId: string, memberId: string, updates: MemberUpdates) {
  const database = await readDatabase();
  const requestingUser = database.users.find((item) => item.id === requestingUserId);

  if (!requestingUser) {
    throw new Error('User account was not found.');
  }

  const activePool = findActivePool(database, requestingUser);

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

  const activePool = findActivePool(database, requestingUser);

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

export async function updatePoolLineupLock(requestingUserId: string, tournamentId: TournamentId, locked: boolean) {
  const { database, activePool } = await requireActivePool(requestingUserId);
  activePool.lineupLocks = activePool.lineupLocks ?? {};
  activePool.lineupLocks[tournamentId] = locked;
  await writeDatabase(database);
  return toPublicPool(activePool);
}

export async function updatePoolPicksOpen(requestingUserId: string, tournamentId: TournamentId, open: boolean) {
  const { database, activePool } = await requireActivePool(requestingUserId);
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
  return toPublicPool(activePool);
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

export async function updatePoolPayouts(requestingUserId: string, tournamentId: TournamentId, payouts: TournamentPayouts) {
  const { database, activePool } = await requireActivePool(requestingUserId);
  activePool.payouts = activePool.payouts ?? {};
  activePool.payouts[tournamentId] = {
    first: payouts.first,
    second: payouts.second,
    third: payouts.third,
  };
  await writeDatabase(database);
  return toPublicPool(activePool);
}

export async function updatePoolWinnerScore(requestingUserId: string, tournamentId: TournamentId, score: number) {
  const { database, activePool } = await requireActivePool(requestingUserId);
  activePool.winnerScores = activePool.winnerScores ?? {};
  activePool.winnerScores[tournamentId] = score;
  await writeDatabase(database);
  return toPublicPool(activePool);
}

export async function regenerateJoinCode(): Promise<never> {
  throw new Error(NEEDS_POSTGRES);
}
