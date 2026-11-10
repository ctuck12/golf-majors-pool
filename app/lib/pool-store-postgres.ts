import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, type Sql, type TxSql } from './db';
import { currentSeason, parsePassProduct, tierForLimit, tierInfo, type LeagueTier, type PassAction } from './league-passes';
import { fetchPassPurchases } from './revenuecat';
import {
  canCreateLeagues,
  EMPTY_SESSION,
  isAppAdmin,
  hashPassword,
  maskRostersFor,
  normalizeEmail,
  normalizeJoinCode,
  resolveRosterSubmittedAt,
  sanitizeRoster,
  SESSION_TTL_MS,
  TOURNAMENT_IDS,
  type LeagueRole,
  type LeagueSummary,
  type MemberUpdates,
  type PublicPool,
  type PublicPoolEntry,
  type PublicUser,
  type SessionContext,
  type TournamentId,
  type TournamentPayouts,
} from './pool-store-shared';

// User data in Postgres (Supabase): users, sessions, leagues, league members with roles, and
// rosters per league. Returns the same shapes as the Redis backend so the API routes and UI
// don't change. A user's "active league" is the one the app shows; it falls back to the
// league they joined first.

type AnySql = Sql | TxSql;

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  created_at: Date;
};

type LeagueRow = {
  id: string;
  name: string;
  join_code: string;
  plan: string;
  member_limit: number | null;
  paid_season: number | null;
  role: LeagueRole;
};

type MemberRow = UserRow & { role: LeagueRole };

type RosterData = {
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt: Partial<Record<TournamentId, string>>;
};

const PG_UNIQUE_VIOLATION = '23505';

// Session tokens are stored hashed, so a database read can't be turned into a login.
export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function isTournamentId(value: string): value is TournamentId {
  return TOURNAMENT_IDS.includes(value as TournamentId);
}

function emptyRosterData(): RosterData {
  return { rosters: {}, tieBreaks: {}, rosterSubmittedAt: {} };
}

function toPublicUser(user: UserRow, poolIds: string[], data: RosterData): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    poolIds,
    rosters: data.rosters,
    tieBreaks: data.tieBreaks,
    rosterSubmittedAt: resolveRosterSubmittedAt({
      displayName: user.display_name,
      createdAt: user.created_at.toISOString(),
      rosters: data.rosters,
      rosterSubmittedAt: data.rosterSubmittedAt,
    }),
  };
}

async function findActiveLeague(sql: AnySql, userId: string): Promise<LeagueRow | null> {
  const [league] = await sql<LeagueRow[]>`
    select l.id, l.name, l.join_code, l.plan, l.member_limit, l.paid_season, m.role
    from league_members m
    join leagues l on l.id = m.league_id
    join users u on u.id = m.user_id
    where m.user_id = ${userId}
    order by (l.id = u.active_league_id) desc nulls last, m.joined_at asc, l.id asc
    limit 1
  `;
  return league ?? null;
}

async function requireActiveLeague(sql: AnySql, userId: string) {
  const [user] = await sql`select id from users where id = ${userId}`;
  if (!user) {
    throw new Error('User account was not found.');
  }
  const league = await findActiveLeague(sql, userId);
  if (!league) {
    throw new Error('Pool was not found.');
  }
  return league;
}

async function loadPool(sql: AnySql, league: { id: string; name: string; join_code: string }): Promise<PublicPool> {
  const rows = await sql<{
    tournament_id: string;
    picks_open: boolean | null;
    lineup_locked: boolean | null;
    payout_first: number | null;
    payout_second: number | null;
    payout_third: number | null;
    winner_score: number | null;
  }[]>`
    select tournament_id, picks_open, lineup_locked, payout_first, payout_second, payout_third, winner_score
    from league_tournaments where league_id = ${league.id}
  `;

  const pool: PublicPool = {
    id: league.id,
    name: league.name,
    joinCode: league.join_code,
    lineupLocks: {},
    picksOpen: {},
    payouts: {},
    winnerScores: {},
  };

  for (const row of rows) {
    if (!isTournamentId(row.tournament_id)) continue;
    const tid = row.tournament_id;
    if (row.lineup_locked !== null) pool.lineupLocks[tid] = row.lineup_locked;
    if (row.picks_open !== null) pool.picksOpen[tid] = row.picks_open;
    if (row.payout_first !== null || row.payout_second !== null || row.payout_third !== null) {
      pool.payouts[tid] = {
        first: row.payout_first ?? 0,
        second: row.payout_second ?? 0,
        third: row.payout_third ?? 0,
      };
    }
    if (row.winner_score !== null) pool.winnerScores[tid] = row.winner_score;
  }

  return pool;
}

async function loadRosterData(sql: AnySql, leagueId: string, userIds: string[]) {
  const byUser = new Map<string, RosterData>(userIds.map((id) => [id, emptyRosterData()]));
  if (userIds.length === 0) return byUser;

  const rows = await sql<{
    user_id: string;
    tournament_id: string;
    golfer_ids: number[] | null;
    tie_break: number | null;
    submitted_at: Date | null;
  }[]>`
    select user_id, tournament_id, golfer_ids, tie_break, submitted_at
    from rosters
    where league_id = ${leagueId} and user_id in ${sql(userIds)}
  `;

  for (const row of rows) {
    const data = byUser.get(row.user_id);
    if (!data || !isTournamentId(row.tournament_id)) continue;
    const tid = row.tournament_id;
    if (row.golfer_ids !== null) data.rosters[tid] = row.golfer_ids;
    if (row.tie_break !== null) data.tieBreaks[tid] = row.tie_break;
    if (row.submitted_at !== null) data.rosterSubmittedAt[tid] = row.submitted_at.toISOString();
  }

  return byUser;
}

async function loadPoolIds(sql: AnySql, userIds: string[]) {
  const byUser = new Map<string, string[]>(userIds.map((id) => [id, []]));
  if (userIds.length === 0) return byUser;

  const rows = await sql<{ user_id: string; league_id: string }[]>`
    select user_id, league_id from league_members
    where user_id in ${sql(userIds)}
    order by joined_at asc, league_id asc
  `;
  for (const row of rows) byUser.get(row.user_id)?.push(row.league_id);
  return byUser;
}

async function loadLeagueMembers(sql: AnySql, leagueId: string) {
  return sql<MemberRow[]>`
    select u.id, u.email, u.display_name, u.password_hash, u.password_salt, u.created_at, m.role
    from league_members m
    join users u on u.id = m.user_id
    where m.league_id = ${leagueId}
    order by u.created_at asc, u.id asc
  `;
}

// The user as the given league sees them (their picks there).
async function publicUserInLeague(sql: AnySql, user: UserRow, leagueId: string | null) {
  const poolIds = (await loadPoolIds(sql, [user.id])).get(user.id) ?? [];
  const data = leagueId
    ? (await loadRosterData(sql, leagueId, [user.id])).get(user.id) ?? emptyRosterData()
    : emptyRosterData();
  return toPublicUser(user, poolIds, data);
}

// Founder leagues never expire; every other league needs a pass for the current season.
function seasonExpired(league: { plan: string; paid_season: number | null }) {
  return league.plan !== 'founder' && (league.paid_season ?? 0) < currentSeason();
}

async function assertLeagueHasRoom(
  sql: AnySql,
  league: { id: string; plan: string; member_limit: number | null; paid_season: number | null },
) {
  if (seasonExpired(league)) {
    throw new Error("This league's season pass has expired. Ask your commissioner to renew it.");
  }
  if (league.member_limit === null) return;
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from league_members where league_id = ${league.id}
  `;
  if (count >= league.member_limit) {
    throw new Error('This league is full. Ask your commissioner to upgrade their plan.');
  }
}

function setPasswordFields(password: string) {
  const passwordSalt = randomBytes(16).toString('hex');
  return { password_salt: passwordSalt, password_hash: hashPassword(password, passwordSalt) };
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

  try {
    return await db().begin(async (sql) => {
      const [existing] = await sql`select id from users where email = ${email}`;
      if (existing) {
        throw new Error('An account with that email already exists.');
      }

      // A league code is optional: without one the account starts in no league, and the app asks
      // them to join one with a code or invite link (or create one, where allowed).
      const [league] = joinCode
        ? await sql<LeagueRow[]>`select id, name, join_code, plan, member_limit, paid_season from leagues where join_code = ${joinCode}`
        : [];

      if (joinCode && !league) {
        throw new Error('That pool join code was not recognized.');
      }

      if (league) {
        await assertLeagueHasRoom(sql, league);
      }

      const id = randomBytes(12).toString('hex');
      const { password_hash, password_salt } = setPasswordFields(password);
      const [user] = await sql<UserRow[]>`
        insert into users (id, email, display_name, password_hash, password_salt, active_league_id)
        values (${id}, ${email}, ${displayName}, ${password_hash}, ${password_salt}, ${league?.id ?? null})
        returning id, email, display_name, password_hash, password_salt, created_at
      `;
      if (league) {
        await sql`insert into league_members (league_id, user_id) values (${league.id}, ${id})`;
      }

      return toPublicUser(user, league ? [league.id] : [], emptyRosterData());
    });
  } catch (error) {
    if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      throw new Error('An account with that email already exists.');
    }
    throw error;
  }
}

export async function loginUser(input: { email: string; password: string }) {
  const sql = db();
  const email = normalizeEmail(input.email);
  const [user] = await sql<UserRow[]>`
    select id, email, display_name, password_hash, password_salt, created_at from users where email = ${email}
  `;

  if (!user) {
    throw new Error('Email or password is incorrect.');
  }

  const expectedHash = Buffer.from(user.password_hash, 'hex');
  const receivedHash = Buffer.from(hashPassword(input.password, user.password_salt), 'hex');

  if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) {
    throw new Error('Email or password is incorrect.');
  }

  const league = await findActiveLeague(sql, user.id);
  return publicUserInLeague(sql, user, league?.id ?? null);
}

export async function createSession(userId: string) {
  const sql = db();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hashSessionToken(token)}, ${userId}, ${expiresAt})
  `;
  await sql`delete from sessions where user_id = ${userId} and expires_at <= now()`;
  return token;
}

export async function removeSession(token: string) {
  await db()`delete from sessions where token_hash = ${hashSessionToken(token)}`;
}

// A session in use renews itself: once a week of its 30 days has gone, opening the app pushes the
// expiry back out to 30 days. So someone who plays stays signed in, and only a session left unused
// for a month ends. Returns whether it renewed (the caller re-sets the cookie when it did).
export async function renewSession(token: string): Promise<boolean> {
  const renewAfter = new Date(Date.now() + SESSION_TTL_MS - 7 * 24 * 60 * 60 * 1000);
  const rows = await db()`
    update sessions set expires_at = ${new Date(Date.now() + SESSION_TTL_MS)}
    where token_hash = ${hashSessionToken(token)} and expires_at > now() and expires_at < ${renewAfter}
    returning 1
  `;
  return rows.length > 0;
}

export async function getSessionContext(token: string | undefined): Promise<SessionContext> {
  if (!token) {
    return EMPTY_SESSION;
  }

  const sql = db();
  const [user] = await sql<UserRow[]>`
    select u.id, u.email, u.display_name, u.password_hash, u.password_salt, u.created_at
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hashSessionToken(token)} and s.expires_at > now()
  `;

  if (!user) {
    return EMPTY_SESSION;
  }

  const [league, leagues] = await Promise.all([findActiveLeague(sql, user.id), loadLeagueSummaries(sql, user.id)]);
  const userFlags = {
    leagues,
    isAppAdmin: isAppAdmin({ email: user.email, displayName: user.display_name }),
    canCreateLeague: canCreateLeagues({ email: user.email, displayName: user.display_name }),
  };

  if (!league) {
    return { user: await publicUserInLeague(sql, user, null), pool: null, entries: [], ...userFlags };
  }

  const [pool, members] = await Promise.all([loadPool(sql, league), loadLeagueMembers(sql, league.id)]);
  const memberIds = members.map((member) => member.id);
  const [rosterData, poolIds] = await Promise.all([
    loadRosterData(sql, league.id, memberIds),
    loadPoolIds(sql, [user.id]),
  ]);

  const maskRosters = maskRostersFor(pool, league.role === 'commissioner');
  const entries: PublicPoolEntry[] = members.map((member) => {
    const data = rosterData.get(member.id) ?? emptyRosterData();
    return {
      id: member.id,
      name: member.display_name,
      rosters: maskRosters(data.rosters, member.id === user.id),
      tieBreaks: data.tieBreaks,
      rosterSubmittedAt: resolveRosterSubmittedAt({
        displayName: member.display_name,
        createdAt: member.created_at.toISOString(),
        rosters: data.rosters,
        rosterSubmittedAt: data.rosterSubmittedAt,
      }),
    };
  });

  return {
    user: toPublicUser(user, poolIds.get(user.id) ?? [], rosterData.get(user.id) ?? emptyRosterData()),
    pool: {
      id: pool.id,
      name: pool.name,
      joinCode: pool.joinCode,
      lineupLocks: pool.lineupLocks,
      picksOpen: pool.picksOpen,
      payouts: pool.payouts,
      role: league.role,
      plan: league.plan,
      memberLimit: league.member_limit,
      paidSeason: league.paid_season,
      seasonExpired: seasonExpired(league),
      memberCount: members.length,
      commissioners: members
        .filter((member) => member.role === 'commissioner')
        .map((member) => ({ id: member.id, name: member.display_name, email: member.email })),
    },
    entries,
    ...userFlags,
  };
}

async function loadLeagueSummaries(sql: AnySql, userId: string): Promise<LeagueSummary[]> {
  return sql<LeagueSummary[]>`
    select l.id, l.name, m.role
    from league_members m join leagues l on l.id = m.league_id
    where m.user_id = ${userId}
    order by m.joined_at asc, l.id asc
  `;
}

export async function joinPoolForUser(userId: string, joinCode: string) {
  const normalizedCode = normalizeJoinCode(joinCode);

  if (!normalizedCode) {
    throw new Error('Enter a pool join code.');
  }

  return db().begin(async (sql) => {
    const [user] = await sql`select id from users where id = ${userId}`;
    if (!user) {
      throw new Error('User account was not found.');
    }

    const [league] = await sql<LeagueRow[]>`
      select id, name, join_code, plan, member_limit, paid_season from leagues where join_code = ${normalizedCode}
    `;
    if (!league) {
      throw new Error('That pool join code was not recognized.');
    }

    const [membership] = await sql`
      select 1 from league_members where league_id = ${league.id} and user_id = ${userId}
    `;
    if (!membership) {
      await assertLeagueHasRoom(sql, league);
      await sql`insert into league_members (league_id, user_id) values (${league.id}, ${userId})`;
    }
    await sql`update users set active_league_id = ${league.id} where id = ${userId}`;

    return loadPool(sql, league);
  });
}

export async function saveRosterForUser(userId: string, tournamentId: TournamentId, roster: unknown) {
  if (!TOURNAMENT_IDS.includes(tournamentId)) {
    throw new Error('Unknown tournament.');
  }

  const sql = db();
  const league = await requireActiveLeague(sql, userId);
  const sanitizedRoster = sanitizeRoster(roster);

  if (sanitizedRoster.length !== 6) {
    throw new Error('Roster must include exactly 6 valid golfers.');
  }

  // Stamp the first complete submission only, so later edits keep the original order.
  await sql`
    insert into rosters (league_id, user_id, tournament_id, golfer_ids, submitted_at)
    values (${league.id}, ${userId}, ${tournamentId}, ${sql.array(sanitizedRoster, 23)}, now())
    on conflict (league_id, user_id, tournament_id) do update set
      golfer_ids = excluded.golfer_ids,
      submitted_at = coalesce(rosters.submitted_at, excluded.submitted_at),
      updated_at = now()
  `;

  return sanitizedRoster;
}

export async function saveTieBreakForUser(userId: string, tournamentId: TournamentId, tieBreak: number) {
  const sql = db();
  const league = await requireActiveLeague(sql, userId);
  await sql`
    insert into rosters (league_id, user_id, tournament_id, tie_break)
    values (${league.id}, ${userId}, ${tournamentId}, ${tieBreak})
    on conflict (league_id, user_id, tournament_id) do update set
      tie_break = excluded.tie_break,
      updated_at = now()
  `;
}

export async function findUserByEmail(email: string) {
  const [user] = await db()<{ id: string; email: string; display_name: string }[]>`
    select id, email, display_name from users where email = ${normalizeEmail(email)}
  `;
  return user ? { id: user.id, email: user.email, displayName: user.display_name } : null;
}

// Sets a new password and signs the account out of every session.
export async function setPasswordAndEndSessions(userId: string, newPassword: string) {
  return db().begin(async (sql) => {
    const { password_hash, password_salt } = setPasswordFields(newPassword);
    const [user] = await sql<UserRow[]>`
      update users set password_hash = ${password_hash}, password_salt = ${password_salt}
      where id = ${userId}
      returning id, email, display_name, password_hash, password_salt, created_at
    `;
    if (!user) {
      throw new Error('User account was not found.');
    }
    await sql`delete from sessions where user_id = ${userId}`;
    const league = await findActiveLeague(sql, userId);
    return publicUserInLeague(sql, user, league?.id ?? null);
  });
}

export async function updateUserAccount(
  userId: string,
  updates: {
    password?: string;
    displayName?: string;
  },
) {
  return db().begin(async (sql) => {
    const [existing] = await sql`select id from users where id = ${userId}`;
    if (!existing) {
      throw new Error('User account was not found.');
    }

    if (typeof updates.displayName === 'string') {
      const displayName = updates.displayName.trim();
      if (displayName.length < 2) {
        throw new Error('Display name must be at least 2 characters.');
      }
      await sql`update users set display_name = ${displayName} where id = ${userId}`;
    }

    if (typeof updates.password === 'string' && updates.password.length > 0) {
      if (updates.password.length < 8) {
        throw new Error('Password must be at least 8 characters.');
      }
      const { password_hash, password_salt } = setPasswordFields(updates.password);
      await sql`update users set password_hash = ${password_hash}, password_salt = ${password_salt} where id = ${userId}`;
    }

    const [user] = await sql<UserRow[]>`
      select id, email, display_name, password_hash, password_salt, created_at from users where id = ${userId}
    `;
    const league = await findActiveLeague(sql, userId);
    return publicUserInLeague(sql, user, league?.id ?? null);
  });
}

export async function listPoolMembers(userId: string) {
  const sql = db();
  const [user] = await sql`select id from users where id = ${userId}`;
  if (!user) {
    throw new Error('User account was not found.');
  }

  const league = await findActiveLeague(sql, userId);
  if (!league) {
    return [];
  }

  const members = await loadLeagueMembers(sql, league.id);
  const memberIds = members.map((member) => member.id);
  const [rosterData, poolIds] = await Promise.all([
    loadRosterData(sql, league.id, memberIds),
    loadPoolIds(sql, memberIds),
  ]);

  return members.map((member) =>
    toPublicUser(member, poolIds.get(member.id) ?? [], rosterData.get(member.id) ?? emptyRosterData()),
  );
}

export async function updatePoolMember(requestingUserId: string, memberId: string, updates: MemberUpdates) {
  try {
    return await db().begin(async (sql) => {
      const [requester] = await sql`select id from users where id = ${requestingUserId}`;
      if (!requester) {
        throw new Error('User account was not found.');
      }

      const league = await findActiveLeague(sql, requestingUserId);
      const [membership] = league
        ? await sql`select 1 from league_members where league_id = ${league.id} and user_id = ${memberId}`
        : [];
      if (!league || !membership) {
        throw new Error('Pool member was not found.');
      }

      if (typeof updates.displayName === 'string') {
        const displayName = updates.displayName.trim();
        if (displayName.length < 2) {
          throw new Error('Display name must be at least 2 characters.');
        }
        await sql`update users set display_name = ${displayName} where id = ${memberId}`;
      }

      if (typeof updates.email === 'string') {
        const email = normalizeEmail(updates.email);
        if (!email.includes('@')) {
          throw new Error('Enter a valid email address.');
        }
        const [existing] = await sql`select id from users where email = ${email} and id <> ${memberId}`;
        if (existing) {
          throw new Error('An account with that email already exists.');
        }
        await sql`update users set email = ${email} where id = ${memberId}`;
      }

      if (typeof updates.password === 'string' && updates.password.trim().length > 0) {
        if (updates.password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }
        const { password_hash, password_salt } = setPasswordFields(updates.password);
        await sql`update users set password_hash = ${password_hash}, password_salt = ${password_salt} where id = ${memberId}`;
      }

      if (updates.rosters) {
        for (const tournamentId of TOURNAMENT_IDS) {
          if (!Object.prototype.hasOwnProperty.call(updates.rosters, tournamentId)) continue;
          const roster = sanitizeRoster(updates.rosters[tournamentId]);
          // Only a complete roster gets a submission stamp; an existing stamp is kept either way.
          const stamp = roster.length === 6 ? new Date() : null;
          await sql`
            insert into rosters (league_id, user_id, tournament_id, golfer_ids, submitted_at)
            values (${league.id}, ${memberId}, ${tournamentId}, ${sql.array(roster, 23)}, ${stamp})
            on conflict (league_id, user_id, tournament_id) do update set
              golfer_ids = excluded.golfer_ids,
              submitted_at = coalesce(rosters.submitted_at, excluded.submitted_at),
              updated_at = now()
          `;
        }
      }

      if (updates.tieBreaks) {
        for (const tournamentId of TOURNAMENT_IDS) {
          if (!Object.prototype.hasOwnProperty.call(updates.tieBreaks, tournamentId)) continue;
          const value = updates.tieBreaks[tournamentId];
          if (value !== null && typeof value !== 'number') continue;
          await sql`
            insert into rosters (league_id, user_id, tournament_id, tie_break)
            values (${league.id}, ${memberId}, ${tournamentId}, ${value})
            on conflict (league_id, user_id, tournament_id) do update set
              tie_break = excluded.tie_break,
              updated_at = now()
          `;
        }
      }

      const [member] = await sql<UserRow[]>`
        select id, email, display_name, password_hash, password_salt, created_at from users where id = ${memberId}
      `;
      return publicUserInLeague(sql, member, league.id);
    });
  } catch (error) {
    if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      throw new Error('An account with that email already exists.');
    }
    throw error;
  }
}

// Removes the member from the requester's league (and their picks in it). An account left in no
// league at all is deleted, which matches the old single-pool behavior.
export async function deletePoolMember(requestingUserId: string, memberId: string) {
  await db().begin(async (sql) => {
    const [requester] = await sql`select id from users where id = ${requestingUserId}`;
    if (!requester) {
      throw new Error('User account was not found.');
    }

    const league = await findActiveLeague(sql, requestingUserId);
    const [membership] = league
      ? await sql`select 1 from league_members where league_id = ${league.id} and user_id = ${memberId}`
      : [];
    if (!league || !membership) {
      throw new Error('Pool member was not found.');
    }

    const [{ commissioners, memberIsCommissioner }] = await sql<{ commissioners: number; memberIsCommissioner: boolean }[]>`
      select
        (select count(*)::int from league_members where league_id = ${league.id} and role = 'commissioner') as commissioners,
        exists (select 1 from league_members where league_id = ${league.id} and user_id = ${memberId} and role = 'commissioner') as "memberIsCommissioner"
    `;
    if (memberIsCommissioner && commissioners <= 1) {
      throw new Error('A league needs at least one commissioner. Make someone else commissioner first.');
    }

    await sql`delete from league_members where league_id = ${league.id} and user_id = ${memberId}`;
    await sql`
      delete from users where id = ${memberId}
        and not exists (select 1 from league_members where user_id = ${memberId})
    `;
  });
}

async function updateLeagueTournament(
  requestingUserId: string,
  tournamentId: TournamentId,
  apply: (sql: TxSql, leagueId: string) => Promise<unknown>,
) {
  return db().begin(async (sql) => {
    const league = await requireActiveLeague(sql, requestingUserId);
    await sql`
      insert into league_tournaments (league_id, tournament_id) values (${league.id}, ${tournamentId})
      on conflict do nothing
    `;
    await apply(sql, league.id);
    return loadPool(sql, league);
  });
}

export async function updatePoolLineupLock(requestingUserId: string, tournamentId: TournamentId, locked: boolean) {
  return updateLeagueTournament(requestingUserId, tournamentId, (sql, leagueId) => sql`
    update league_tournaments set lineup_locked = ${locked}
    where league_id = ${leagueId} and tournament_id = ${tournamentId}
  `);
}

export async function updatePoolPicksOpen(requestingUserId: string, tournamentId: TournamentId, open: boolean) {
  // Opening picks begins a fresh pick window: clear any stale lineup lock from the previous cycle so
  // members can edit AND so other members' new picks stay masked (getSessionContext hides rosters
  // while picks are open and unlocked; the auto-lock cron re-locks — and re-reveals — at first tee).
  return updateLeagueTournament(requestingUserId, tournamentId, (sql, leagueId) => open
    ? sql`
        update league_tournaments set picks_open = true, lineup_locked = false
        where league_id = ${leagueId} and tournament_id = ${tournamentId}
      `
    : sql`
        update league_tournaments set picks_open = false
        where league_id = ${leagueId} and tournament_id = ${tournamentId}
      `);
}

// Locks this tournament's lineups in every league (tee times are the same for everyone).
export async function autoLockPoolLineup(tournamentId: TournamentId): Promise<void> {
  await db()`
    insert into league_tournaments (league_id, tournament_id, lineup_locked)
    select id, ${tournamentId}, true from leagues
    on conflict (league_id, tournament_id) do update set lineup_locked = true
    where league_tournaments.lineup_locked is distinct from true
  `;
}

export async function getSelectedPlayerIdsForTournament(tournamentId: TournamentId): Promise<Set<number>> {
  const rows = await db()<{ id: number }[]>`
    select distinct unnest(golfer_ids) as id from rosters
    where tournament_id = ${tournamentId} and golfer_ids is not null
  `;
  return new Set(rows.map((row) => row.id));
}

export async function updatePoolPayouts(requestingUserId: string, tournamentId: TournamentId, payouts: TournamentPayouts) {
  return updateLeagueTournament(requestingUserId, tournamentId, (sql, leagueId) => sql`
    update league_tournaments
    set payout_first = ${payouts.first}, payout_second = ${payouts.second}, payout_third = ${payouts.third}
    where league_id = ${leagueId} and tournament_id = ${tournamentId}
  `);
}

export async function updatePoolWinnerScore(requestingUserId: string, tournamentId: TournamentId, score: number) {
  return updateLeagueTournament(requestingUserId, tournamentId, (sql, leagueId) => sql`
    update league_tournaments set winner_score = ${score}
    where league_id = ${leagueId} and tournament_id = ${tournamentId}
  `);
}

// League join codes: 6 characters with no look-alikes (0/O, 1/I/L), so they're easy to read out.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomJoinCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length]).join('');
}

function validLeagueName(input: string) {
  const name = input.trim();
  if (name.length < 3 || name.length > 60) {
    throw new Error('League name must be 3 to 60 characters.');
  }
  return name;
}

// Creates a league with the user as its commissioner and makes it their active league.
export async function createLeague(
  userId: string,
  input: { name: string; plan: string; memberLimit: number | null; paidSeason?: number | null },
) {
  const name = validLeagueName(input.name);
  return db().begin((sql) => createLeagueTx(sql, userId, { ...input, name }));
}

async function createLeagueTx(
  sql: TxSql,
  userId: string,
  input: { name: string; plan: string; memberLimit: number | null; paidSeason?: number | null },
) {
  const name = input.name;
  {
    const [user] = await sql`select id from users where id = ${userId}`;
    if (!user) {
      throw new Error('User account was not found.');
    }

    let joinCode = randomJoinCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const [taken] = await sql`select 1 from leagues where join_code = ${joinCode}`;
      if (!taken) break;
      joinCode = randomJoinCode();
    }

    const id = randomBytes(12).toString('hex');
    await sql`
      insert into leagues (id, name, join_code, plan, member_limit, paid_season, created_by)
      values (${id}, ${name}, ${joinCode}, ${input.plan}, ${input.memberLimit}, ${input.paidSeason ?? null}, ${userId})
    `;
    await sql`insert into league_members (league_id, user_id, role) values (${id}, ${userId}, 'commissioner')`;
    await sql`update users set active_league_id = ${id} where id = ${userId}`;
    return { id, name, joinCode };
  }
}

export async function switchActiveLeague(userId: string, leagueId: string) {
  const sql = db();
  const [membership] = await sql`
    select 1 from league_members where league_id = ${leagueId} and user_id = ${userId}
  `;
  if (!membership) {
    throw new Error('You are not a member of that league.');
  }
  await sql`update users set active_league_id = ${leagueId} where id = ${userId}`;
}

// Promotes or demotes a member of the requester's active league. A league always keeps at
// least one commissioner.
export async function setMemberRole(requestingUserId: string, memberId: string, role: LeagueRole) {
  if (role !== 'member' && role !== 'commissioner') {
    throw new Error('Unknown role.');
  }

  await db().begin(async (sql) => {
    const league = await requireActiveLeague(sql, requestingUserId);
    const [membership] = await sql<{ role: LeagueRole }[]>`
      select role from league_members where league_id = ${league.id} and user_id = ${memberId} for update
    `;
    if (!membership) {
      throw new Error('Pool member was not found.');
    }

    if (role === 'member' && membership.role === 'commissioner') {
      const [{ count }] = await sql<{ count: number }[]>`
        select count(*)::int as count from league_members
        where league_id = ${league.id} and role = 'commissioner'
      `;
      if (count <= 1) {
        throw new Error('A league needs at least one commissioner. Make someone else commissioner first.');
      }
    }

    await sql`update league_members set role = ${role} where league_id = ${league.id} and user_id = ${memberId}`;
  });
}

// Deletes the user's account (Apple requires this in-app). A league they solely run is deleted
// with them when they're its only member; otherwise they must hand it to another commissioner first.
export async function deleteOwnAccount(userId: string) {
  await db().begin(async (sql) => {
    const soleLeagues = await sql<{ id: string; name: string; members: number }[]>`
      select l.id, l.name,
        (select count(*)::int from league_members x where x.league_id = l.id) as members
      from league_members m
      join leagues l on l.id = m.league_id
      where m.user_id = ${userId} and m.role = 'commissioner'
        and not exists (
          select 1 from league_members o
          where o.league_id = l.id and o.role = 'commissioner' and o.user_id <> ${userId}
        )
    `;

    const blocking = soleLeagues.find((league) => league.members > 1);
    if (blocking) {
      throw new Error(`You're the only commissioner of ${blocking.name}. Make another member commissioner first.`);
    }

    for (const league of soleLeagues) {
      await sql`delete from leagues where id = ${league.id}`;
    }
    await sql`delete from users where id = ${userId}`;
  });
}

// Gives the requester's active league a fresh join code. The old code and any invite links built
// from it stop working; people already in the league are unaffected.
export async function regenerateJoinCode(requestingUserId: string) {
  return db().begin(async (sql) => {
    const league = await requireActiveLeague(sql, requestingUserId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const joinCode = randomJoinCode();
      const [taken] = await sql`select 1 from leagues where join_code = ${joinCode}`;
      if (taken) continue;
      await sql`update leagues set join_code = ${joinCode} where id = ${league.id}`;
      return joinCode;
    }
    throw new Error('Could not generate a new code. Please try again.');
  });
}

// ── League season passes ────────────────────────────────────────────────────
// A purchase only counts once RevenueCat confirms it for this user. Each confirmed purchase is
// recorded as a credit and spent once (create / upgrade / renew a league). A purchase whose
// redemption didn't go through (lost signal, app closed) stays as an unused credit.

type PassPlan =
  | { kind: 'create'; name: string; tier: LeagueTier; season: number }
  | { kind: 'upgrade'; leagueId: string; tier: LeagueTier }
  | { kind: 'renew'; leagueId: string; tier: LeagueTier; season: number };

// The same rules run before the user pays (check) and when the pass is spent (redeem).
async function validatePassAction(sql: AnySql, userId: string, productId: string, action: PassAction): Promise<PassPlan> {
  const product = parsePassProduct(productId);
  if (!product) {
    throw new Error('That pass was not recognized.');
  }
  const season = currentSeason();

  if (action.type === 'create') {
    if (product.kind !== 'season') {
      throw new Error('Choose a season pass to create a league.');
    }
    return { kind: 'create', name: validLeagueName(action.name ?? ''), tier: product.tier, season };
  }

  const [league] = await sql<(LeagueRow & { members: number })[]>`
    select l.id, l.name, l.join_code, l.plan, l.member_limit, l.paid_season, m.role,
      (select count(*)::int from league_members x where x.league_id = l.id) as members
    from leagues l
    join league_members m on m.league_id = l.id and m.user_id = ${userId}
    where l.id = ${action.leagueId}
    for update of l
  `;
  if (!league) {
    throw new Error('League was not found.');
  }
  if (league.role !== 'commissioner') {
    throw new Error('Only a commissioner can buy passes for this league.');
  }
  if (league.plan === 'founder') {
    throw new Error('This is a founder league: it is free and has no member limit.');
  }

  if (action.type === 'upgrade') {
    if (product.kind !== 'upgrade') {
      throw new Error('Choose an upgrade to change the member limit.');
    }
    if (seasonExpired(league)) {
      throw new Error(`This league's pass has expired. Renew it for the ${season} season instead.`);
    }
    const currentTier = tierForLimit(league.member_limit);
    if (currentTier !== product.from) {
      throw new Error(`This league is on the ${currentTier ? tierInfo(currentTier).label.toLowerCase() : 'current'} plan; choose an upgrade from that plan.`);
    }
    return { kind: 'upgrade', leagueId: league.id, tier: product.to };
  }

  if (product.kind !== 'season') {
    throw new Error('Choose a season pass to renew this league.');
  }
  if (!seasonExpired(league)) {
    throw new Error(`This league is already paid for the ${season} season.`);
  }
  if (product.tier < league.members) {
    throw new Error(`This league has ${league.members} members; choose a pass for at least that many.`);
  }
  return { kind: 'renew', leagueId: league.id, tier: product.tier, season };
}

// Before buying: throws with a message the app can show if the pass can't be used for this.
export async function checkPassAction(userId: string, productId: string, action: PassAction) {
  await validatePassAction(db(), userId, productId, action);
}

async function recordPurchases(sql: AnySql, userId: string, purchases: Awaited<ReturnType<typeof fetchPassPurchases>>) {
  for (const purchase of purchases) {
    await sql`
      insert into league_purchases (id, user_id, product_id, store, is_sandbox, purchased_at)
      values (${purchase.id}, ${userId}, ${purchase.productId}, ${purchase.store}, ${purchase.isSandbox},
        ${purchase.purchasedAt ? new Date(purchase.purchasedAt) : null})
      on conflict (id) do nothing
    `;
  }
}

// Passes this user bought that haven't been used yet.
export async function listUnusedPasses(userId: string) {
  const purchases = await fetchPassPurchases(userId);
  const sql = db();
  await recordPurchases(sql, userId, purchases);
  return sql<{ id: string; product_id: string; purchased_at: Date | null }[]>`
    select id, product_id, purchased_at from league_purchases
    where user_id = ${userId} and redeemed_at is null
    order by purchased_at asc nulls last, recorded_at asc
  `;
}

// Spends one confirmed, unused purchase of this product on the action. Returns the league id.
export async function redeemPass(userId: string, productId: string, action: PassAction) {
  const purchases = await fetchPassPurchases(userId);

  return db().begin(async (sql) => {
    await recordPurchases(sql, userId, purchases);
    const plan = await validatePassAction(sql, userId, productId, action);

    const [credit] = await sql<{ id: string }[]>`
      select id from league_purchases
      where user_id = ${userId} and product_id = ${productId} and redeemed_at is null
      order by purchased_at asc nulls last, recorded_at asc
      limit 1
      for update skip locked
    `;
    if (!credit) {
      throw new Error("We couldn't confirm that purchase yet. Wait a moment and try again; you won't be charged twice.");
    }

    let leagueId: string;
    let season: number | null = null;
    if (plan.kind === 'create') {
      const league = await createLeagueTx(sql, userId, {
        name: plan.name,
        plan: tierInfo(plan.tier).plan,
        memberLimit: plan.tier,
        paidSeason: plan.season,
      });
      leagueId = league.id;
      season = plan.season;
    } else if (plan.kind === 'upgrade') {
      leagueId = plan.leagueId;
      await sql`
        update leagues set plan = ${tierInfo(plan.tier).plan}, member_limit = ${plan.tier} where id = ${leagueId}
      `;
    } else {
      leagueId = plan.leagueId;
      season = plan.season;
      await sql`
        update leagues set plan = ${tierInfo(plan.tier).plan}, member_limit = ${plan.tier}, paid_season = ${season}
        where id = ${leagueId}
      `;
    }

    await sql`update users set active_league_id = ${leagueId} where id = ${userId}`;
    await sql`
      update league_purchases
      set league_id = ${leagueId}, action = ${plan.kind}, season = ${season}, redeemed_at = now()
      where id = ${credit.id}
    `;
    return leagueId;
  });
}
