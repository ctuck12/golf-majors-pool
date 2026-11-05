import { createHash, randomBytes } from 'node:crypto';
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

function store() {
  return userDataBackend() === 'postgres' ? postgresStore : redisStore;
}

export const registerUser = (input: { displayName: string; email: string; password: string; joinCode?: string }) =>
  store().registerUser(input);
export const loginUser = (input: { email: string; password: string }) => store().loginUser(input);
export const createSession = (userId: string) => store().createSession(userId);
export const removeSession = (token: string) => store().removeSession(token);
export const getSessionContext = (token: string | undefined) => store().getSessionContext(token);
export const joinPoolForUser = (userId: string, joinCode: string) => store().joinPoolForUser(userId, joinCode);
export const saveRosterForUser = (userId: string, tournamentId: TournamentId, roster: unknown) =>
  store().saveRosterForUser(userId, tournamentId, roster);
export const saveTieBreakForUser = (userId: string, tournamentId: TournamentId, tieBreak: number) =>
  store().saveTieBreakForUser(userId, tournamentId, tieBreak);
export const updateUserAccount = (userId: string, updates: { password?: string; displayName?: string }) =>
  store().updateUserAccount(userId, updates);
export const listPoolMembers = (userId: string) => store().listPoolMembers(userId);
export const updatePoolMember = (requestingUserId: string, memberId: string, updates: MemberUpdates) =>
  store().updatePoolMember(requestingUserId, memberId, updates);
export const deletePoolMember = (requestingUserId: string, memberId: string) =>
  store().deletePoolMember(requestingUserId, memberId);
export const updatePoolLineupLock = (requestingUserId: string, tournamentId: TournamentId, locked: boolean) =>
  store().updatePoolLineupLock(requestingUserId, tournamentId, locked);
export const updatePoolPicksOpen = (requestingUserId: string, tournamentId: TournamentId, open: boolean) =>
  store().updatePoolPicksOpen(requestingUserId, tournamentId, open);
export const autoLockPoolLineup = (tournamentId: TournamentId) => store().autoLockPoolLineup(tournamentId);
export const getSelectedPlayerIdsForTournament = (tournamentId: TournamentId) =>
  store().getSelectedPlayerIdsForTournament(tournamentId);
export const updatePoolPayouts = (requestingUserId: string, tournamentId: TournamentId, payouts: TournamentPayouts) =>
  store().updatePoolPayouts(requestingUserId, tournamentId, payouts);
export const createLeague = (userId: string, input: { name: string; plan: string; memberLimit: number | null }) =>
  userDataBackend() === 'postgres' ? postgresStore.createLeague(userId, input) : redisStore.createLeague();
export const switchActiveLeague = (userId: string, leagueId: string) =>
  userDataBackend() === 'postgres' ? postgresStore.switchActiveLeague(userId, leagueId) : redisStore.switchActiveLeague();
export const setMemberRole = (requestingUserId: string, memberId: string, role: LeagueRole) =>
  userDataBackend() === 'postgres'
    ? postgresStore.setMemberRole(requestingUserId, memberId, role)
    : redisStore.setMemberRole();
export const deleteOwnAccount = (userId: string) =>
  userDataBackend() === 'postgres' ? postgresStore.deleteOwnAccount(userId) : redisStore.deleteOwnAccount();
export const updatePoolWinnerScore = (requestingUserId: string, tournamentId: TournamentId, score: number) =>
  store().updatePoolWinnerScore(requestingUserId, tournamentId, score);

// ── Password reset tokens (Redis, whichever backend holds the accounts) ─────

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
  const user = await store().findUserByEmail(normalized);

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

  return store().setPasswordAndEndSessions(userId, newPassword);
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
