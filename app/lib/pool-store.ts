import { createHash, randomBytes } from 'node:crypto';
import { ensureSchema } from './db';
import type { PassAction } from './league-passes';
import * as postgresStore from './pool-store-postgres';
import * as redisStore from './pool-store-redis';
import { normalizeEmail, type LeagueRole, type MemberUpdates, type TournamentId, type TournamentPayouts } from './pool-store-shared';
import redis from './redis';

export {
  canCreateLeagues,
  DEFAULT_POOL_ID,
  DEFAULT_POOL_JOIN_CODE,
  isAppAdmin,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type LeagueContact,
  type LeagueRole,
  type LeagueSummary,
  type LeagueVenmo,
  type PayoutSent,
  type PublicPool,
  type PublicPoolEntry,
  type PublicUser,
  type SessionContext,
  type SessionPool,
  type TournamentId,
  type TournamentPayouts,
} from './pool-store-shared';

// User data (accounts, sessions, pools and picks) lives in Postgres when USER_DATA_BACKEND is
// "postgres", otherwise in the original Redis blob. Flipping the variable back is the rollback.
export function userDataBackend(): 'postgres' | 'redis' {
  return process.env.USER_DATA_BACKEND === 'postgres' ? 'postgres' : 'redis';
}

async function store() {
  if (userDataBackend() !== 'postgres') return redisStore;
  await ensureSchema();
  return postgresStore;
}

export const registerUser = async (input: { displayName?: string; firstName?: string; lastName?: string; email: string; password: string; joinCode?: string }) =>
  userDataBackend() === 'postgres'
    ? (await store() as typeof postgresStore).registerUser(input)
    : redisStore.registerUser({ ...input, displayName: input.displayName ?? `${input.firstName ?? ''} ${input.lastName ?? ''}`.trim() });
export const loginUser = async (input: { email: string; password: string }) =>
  (await store()).loginUser(input);
export const createSession = async (userId: string) =>
  (await store()).createSession(userId);
export const removeSession = async (token: string) =>
  (await store()).removeSession(token);
export const getSessionContext = async (token: string | undefined) =>
  (await store()).getSessionContext(token);
export const renewSession = async (token: string) =>
  (await store()).renewSession(token);
export const joinPoolForUser = async (userId: string, joinCode: string) =>
  (await store()).joinPoolForUser(userId, joinCode);
export const saveRosterForUser = async (userId: string, tournamentId: TournamentId, roster: unknown) =>
  (await store()).saveRosterForUser(userId, tournamentId, roster);
export const saveTieBreakForUser = async (userId: string, tournamentId: TournamentId, tieBreak: number) =>
  (await store()).saveTieBreakForUser(userId, tournamentId, tieBreak);
export const updateUserAccount = async (userId: string, updates: { password?: string; displayName?: string }) =>
  (await store()).updateUserAccount(userId, updates);
export const listPoolMembers = async (userId: string) =>
  (await store()).listPoolMembers(userId);
export const updatePoolMember = async (requestingUserId: string, memberId: string, updates: MemberUpdates) =>
  (await store()).updatePoolMember(requestingUserId, memberId, updates);
export const deletePoolMember = async (requestingUserId: string, memberId: string) =>
  (await store()).deletePoolMember(requestingUserId, memberId);
export const updatePoolLineupLock = async (requestingUserId: string, tournamentId: TournamentId, locked: boolean) =>
  (await store()).updatePoolLineupLock(requestingUserId, tournamentId, locked);
export const updatePoolPicksOpen = async (requestingUserId: string, tournamentId: TournamentId, open: boolean) =>
  (await store()).updatePoolPicksOpen(requestingUserId, tournamentId, open);
export const autoLockPoolLineup = async (tournamentId: TournamentId) =>
  (await store()).autoLockPoolLineup(tournamentId);
export const getSelectedPlayerIdsForTournament = async (tournamentId: TournamentId) =>
  (await store()).getSelectedPlayerIdsForTournament(tournamentId);
export const updatePoolPayouts = async (requestingUserId: string, tournamentId: TournamentId, payouts: TournamentPayouts) =>
  (await store()).updatePoolPayouts(requestingUserId, tournamentId, payouts);
// Multiple leagues, roles and passes exist only in Postgres.
async function postgresOnly() {
  if (userDataBackend() !== 'postgres') {
    throw new Error('Leagues need the Postgres backend (USER_DATA_BACKEND=postgres).');
  }
  await ensureSchema();
  return postgresStore;
}

export const createLeague = async (userId: string, input: { name: string; plan: string; memberLimit: number | null }) =>
  (await postgresOnly()).createLeague(userId, input);
export const switchActiveLeague = async (userId: string, leagueId: string) =>
  (await postgresOnly()).switchActiveLeague(userId, leagueId);
export const setMemberRole = async (requestingUserId: string, memberId: string, role: LeagueRole) =>
  (await postgresOnly()).setMemberRole(requestingUserId, memberId, role);
export const deleteOwnAccount = async (userId: string) =>
  (await postgresOnly()).deleteOwnAccount(userId);
export const checkPassAction = async (userId: string, productId: string, action: PassAction) =>
  (await postgresOnly()).checkPassAction(userId, productId, action);
export const listUnusedPasses = async (userId: string) =>
  (await postgresOnly()).listUnusedPasses(userId);
export const redeemPass = async (userId: string, productId: string, action: PassAction) =>
  (await postgresOnly()).redeemPass(userId, productId, action);
export const regenerateJoinCode = async (requestingUserId: string) =>
  (await postgresOnly()).regenerateJoinCode(requestingUserId);
export const updateUserVenmo = async (userId: string, venmo: unknown) =>
  (await postgresOnly()).updateUserVenmo(userId, venmo);
export const declineVenmo = async (userId: string) =>
  (await postgresOnly()).declineVenmo(userId);
export const markEmailVerified = async (userId: string) =>
  (await postgresOnly()).markEmailVerified(userId);
export const updateEntryFees = async (requestingUserId: string, fees: Partial<Record<TournamentId, number | null>>) =>
  (await postgresOnly()).updateEntryFees(requestingUserId, fees);
export const setPayoutSent = async (
  requestingUserId: string,
  input: { tournamentId: TournamentId; place: number; userId: string | null; amount: number; sent: boolean },
) => (await postgresOnly()).setPayoutSent(requestingUserId, input);
export const adminListLeagues = async () =>
  (await postgresOnly()).adminListLeagues();
export const adminListLeagueMembers = async (leagueId: string) =>
  (await postgresOnly()).adminListLeagueMembers(leagueId);
export const adminSetCommissioner = async (leagueId: string, memberId: string) =>
  (await postgresOnly()).adminSetCommissioner(leagueId, memberId);
export const adminGrantFreeSeason = async (leagueId: string) =>
  (await postgresOnly()).adminGrantFreeSeason(leagueId);
export const archiveSeasonsFor = async (leagueId: string, tournamentId: string) =>
  (await postgresOnly()).archiveSeasonsFor(leagueId, tournamentId);
export const readStandingsArchive = async (leagueId: string, tournamentId: string, season: number) =>
  (await postgresOnly()).readStandingsArchive(leagueId, tournamentId, season);
export const saveStandingsArchive = async (leagueId: string, tournamentId: string, season: number, standings: unknown[], payouts: unknown) =>
  (await postgresOnly()).saveStandingsArchive(leagueId, tournamentId, season, standings, payouts);
export const leaveLeague = async (userId: string, leagueId: string) =>
  (await postgresOnly()).leaveLeague(userId, leagueId);
export const updatePoolWinnerScore = async (requestingUserId: string, tournamentId: TournamentId, score: number) =>
  (await store()).updatePoolWinnerScore(requestingUserId, tournamentId, score);

// ── Password reset tokens (Redis, whichever backend holds the accounts) ─────

const PASSWORD_RESET_TTL_SECONDS = 60 * 60;
const PASSWORD_RESET_THROTTLE_SECONDS = 60;

// Only the token's hash is stored, so someone reading Redis can't turn a key into a working link.
function passwordResetKey(token: string) {
  return `password-reset:${createHash('sha256').update(token).digest('hex')}`;
}

// ── Email confirmation codes (Redis) ────────────────────────────────────────
// A new account gets a 6-digit code by email. Only its hash is stored, it expires in 30 minutes,
// allows 5 wrong tries, and a new one can be sent once a minute.

const EMAIL_CODE_TTL_SECONDS = 30 * 60;
const EMAIL_CODE_RESEND_SECONDS = 60;
const EMAIL_CODE_MAX_ATTEMPTS = 5;

function emailCodeKey(userId: string) {
  return `email-verify:${userId}`;
}

function hashEmailCode(userId: string, code: string) {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

// Returns a new code to email, or null if one was sent less than a minute ago.
export async function createEmailVerificationCode(userId: string): Promise<string | null> {
  const throttled = await redis.set(`email-verify-throttle:${userId}`, '1', 'EX', EMAIL_CODE_RESEND_SECONDS, 'NX');
  if (throttled !== 'OK') return null;
  const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
  await redis.set(emailCodeKey(userId), JSON.stringify({ hash: hashEmailCode(userId, code), attempts: 0 }), 'EX', EMAIL_CODE_TTL_SECONDS);
  return code;
}

// Checks a code; on success marks the account's email confirmed.
export async function confirmEmailWithCode(userId: string, code: string) {
  const raw = await redis.get(emailCodeKey(userId));
  if (!raw) {
    throw new Error('That code has expired. Tap "Send a new code".');
  }
  const stored = JSON.parse(raw) as { hash: string; attempts: number };
  if (stored.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    throw new Error('Too many tries. Tap "Send a new code".');
  }
  if (stored.hash !== hashEmailCode(userId, code.trim())) {
    const ttl = await redis.ttl(emailCodeKey(userId));
    await redis.set(emailCodeKey(userId), JSON.stringify({ ...stored, attempts: stored.attempts + 1 }), 'EX', Math.max(ttl, 1));
    throw new Error("That code isn't right. Check the email and try again.");
  }
  await redis.del(emailCodeKey(userId));
  await (await postgresOnly()).markEmailVerified(userId);
}

// Issues a one-time reset token for the account using this email. Returns null when no account
// matches, or when a link was already sent to this email in the last minute (stops email floods).
export async function createPasswordResetToken(email: string) {
  const normalized = normalizeEmail(email);
  const user = await (await store()).findUserByEmail(normalized);

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

  return (await store()).setPasswordAndEndSessions(userId, newPassword);
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

// Drops every manual stat correction for one tournament (when its new season begins).
export async function clearStatOverrides(tournamentId: string): Promise<void> {
  const overrides = await getStatOverrides();
  const keep = Object.fromEntries(Object.entries(overrides).filter(([key]) => !key.startsWith(`${tournamentId}:`)));
  if (Object.keys(keep).length !== Object.keys(overrides).length) {
    await redis.set(STAT_OVERRIDES_KEY, JSON.stringify(keep));
  }
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
