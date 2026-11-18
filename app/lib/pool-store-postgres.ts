import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, type Sql, type TxSql } from './db';
import { normalizeVenmoUsername } from './venmo';
import { computePayouts, type PayoutPlan } from './payout-plan';
import type { PaymentStatus } from './pool-store-shared';
import { latestStartedSeason, picksSeason } from './tournament-config';
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
  type LeagueVenmo,
  type MemberUpdates,
  type PastSeasonPicks,
  type PayoutSent,
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
  venmo?: string | null;
  email_verified_at?: Date | null;
  venmo_declined?: boolean;
};

type LeagueRow = {
  id: string;
  name: string;
  join_code: string;
  plan: string;
  member_limit: number | null;
  paid_season: number | null;
  venmo_collector_id: string | null;
  role: LeagueRole;
};

type MemberRow = UserRow & { role: LeagueRole };

type RosterData = {
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt: Partial<Record<TournamentId, string>>;
  pastSeasons: PastSeasonPicks;
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
  return { rosters: {}, tieBreaks: {}, rosterSubmittedAt: {}, pastSeasons: {} };
}

function toPublicUser(user: UserRow, poolIds: string[], data: RosterData): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    venmo: user.venmo ?? null,
    venmoDeclined: user.venmo_declined === true,
    // Rows read without the column (e.g. right after sign-up) count as unconfirmed only when null.
    emailVerified: user.email_verified_at !== null,
    poolIds,
    rosters: data.rosters,
    tieBreaks: data.tieBreaks,
    ...(Object.keys(data.pastSeasons).length ? { pastSeasons: data.pastSeasons } : {}),
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
    select l.id, l.name, l.join_code, l.plan, l.member_limit, l.paid_season, l.venmo_collector_id, m.role
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
    entry_fee: number | null;
    state_season: number | null;
    payouts_season: number | null;
  }[]>`
    select tournament_id, picks_open, lineup_locked, payout_first, payout_second, payout_third, winner_score, entry_fee, state_season, payouts_season
    from league_tournaments where league_id = ${league.id}
  `;
  const [planRow] = await sql<{ payout_plan: PayoutPlan | null; payment_note: string | null; season_fee: number | null; season_payout_plan: PayoutPlan | null }[]>`select payout_plan, payment_note, season_fee, season_payout_plan from leagues where id = ${league.id}`;
  const payoutPlan = planRow?.payout_plan ?? null;
  // Entries per tournament and season: members who have picks in.
  const counts = await sql<{ tournament_id: string; season: number; entries: number }[]>`
    select r.tournament_id, r.season, count(*)::int as entries
    from rosters r
    join league_members m on m.league_id = r.league_id and m.user_id = r.user_id
    where r.league_id = ${league.id} and r.golfer_ids is not null and cardinality(r.golfer_ids) > 0
    group by r.tournament_id, r.season
  `;
  const entriesFor = (tid: string, season: number) =>
    counts.find((row) => row.tournament_id === tid && row.season === season)?.entries ?? 0;
  const entrantRows = await sql<{ tournament_id: string; season: number; user_id: string }[]>`
    select r.tournament_id, r.season, r.user_id
    from rosters r
    join league_members m on m.league_id = r.league_id and m.user_id = r.user_id
    where r.league_id = ${league.id} and r.golfer_ids is not null and cardinality(r.golfer_ids) > 0
  `;
  const paymentRows = await sql<{ tournament_id: string; season: number; user_id: string; status: PaymentStatus }[]>`
    select tournament_id, season, user_id, status from league_entry_payments where league_id = ${league.id}
  `;

  const pool: PublicPool = {
    id: league.id,
    name: league.name,
    joinCode: league.join_code,
    lineupLocks: {},
    picksOpen: {},
    payouts: {},
    winnerScores: {},
    entryFees: {},
    payoutPlan,
    payoutInfo: {},
    entryPayments: {},
    seasonFee: planRow?.season_fee ?? null,
    seasonPayoutPlan: planRow?.season_payout_plan ?? null,
    paymentNote: planRow?.payment_note ?? null,
  };

  for (const row of rows) {
    if (!isTournamentId(row.tournament_id)) continue;
    const tid = row.tournament_id;
    // Picks open / lineup lock / winner score only count for the season they were set in.
    const currentState = (row.state_season ?? 2026) === picksSeason(tid);
    if (currentState && row.lineup_locked !== null) pool.lineupLocks[tid] = row.lineup_locked;
    if (currentState && row.picks_open !== null) pool.picksOpen[tid] = row.picks_open;
    if (currentState && row.winner_score !== null) pool.winnerScores[tid] = row.winner_score;
    if (row.entry_fee !== null && row.entry_fee > 0) pool.entryFees![tid] = row.entry_fee;
  }

  // Payouts for each tournament's event on show: amounts the commissioner typed in for that event,
  // else the league's plan applied to the pot (entry fee × entries).
  for (const tid of TOURNAMENT_IDS) {
    const row = rows.find((r) => r.tournament_id === tid);
    const season = payoutDisplaySeason(tid, (s) => entriesFor(tid, s));
    const entries = entriesFor(tid, season);
    const fee = pool.entryFees![tid] ?? 0;
    const pot = fee * entries;
    const manual =
      !!row &&
      (row.payout_first !== null || row.payout_second !== null || row.payout_third !== null) &&
      (row.payouts_season ?? 2026) === season;
    if (manual) {
      pool.payouts[tid] = { first: row.payout_first ?? 0, second: row.payout_second ?? 0, third: row.payout_third ?? 0 };
    } else if (payoutPlan) {
      const amounts = computePayouts(payoutPlan, pot, fee);
      if (amounts.first + amounts.second + amounts.third > 0) pool.payouts[tid] = amounts;
    }
    const entrants = entrantRows.filter((r) => r.tournament_id === tid && r.season === season).map((r) => r.user_id);
    pool.payoutInfo![tid] = { season, entries, pot, manual, entrants };
    const payments: Record<string, PaymentStatus> = {};
    for (const r of paymentRows) if (r.tournament_id === tid && r.season === season) payments[r.user_id] = r.status;
    pool.entryPayments![tid] = payments;
  }

  return pool;
}

async function loadRosterData(sql: AnySql, leagueId: string, userIds: string[]) {
  const byUser = new Map<string, RosterData>(userIds.map((id) => [id, emptyRosterData()]));
  if (userIds.length === 0) return byUser;

  const rows = await sql<{
    user_id: string;
    tournament_id: string;
    season: number;
    golfer_ids: number[] | null;
    tie_break: number | null;
    submitted_at: Date | null;
  }[]>`
    select user_id, tournament_id, season, golfer_ids, tie_break, submitted_at
    from rosters
    where league_id = ${leagueId} and user_id in ${sql(userIds)}
  `;

  const now = new Date();
  for (const row of rows) {
    const data = byUser.get(row.user_id);
    if (!data || !isTournamentId(row.tournament_id)) continue;
    const tid = row.tournament_id;
    if (row.season !== picksSeason(tid, now)) {
      const past = (data.pastSeasons[row.season] ??= { rosters: {}, tieBreaks: {} });
      if (row.golfer_ids !== null) past.rosters[tid] = row.golfer_ids;
      if (row.tie_break !== null) past.tieBreaks[tid] = row.tie_break;
      continue;
    }
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
    select u.id, u.email, u.display_name, u.password_hash, u.password_salt, u.created_at, u.venmo, u.email_verified_at, u.venmo_declined, m.role
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
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  joinCode?: string;
}) {
  // New sign-ups give a first and last name; the name shown in the pool is both together.
  const firstName = (input.firstName ?? '').trim();
  const lastName = (input.lastName ?? '').trim();
  if (input.firstName !== undefined || input.lastName !== undefined) {
    if (!firstName || !lastName) {
      throw new Error('Enter your first and last name.');
    }
  }
  const displayName = (firstName || lastName ? `${firstName} ${lastName}` : input.displayName ?? '').trim().replace(/\s+/g, ' ');
  const email = normalizeEmail(input.email);
  const password = input.password;
  const joinCode = input.joinCode ? normalizeJoinCode(input.joinCode) : '';

  if (displayName.length < 2) {
    throw new Error('Enter your name (at least 2 characters).');
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
        returning id, email, display_name, password_hash, password_salt, created_at, venmo, email_verified_at, venmo_declined
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
    select id, email, display_name, password_hash, password_salt, created_at, venmo, email_verified_at, venmo_declined from users where email = ${email}
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

// Who members pay entry fees to: the league's commissioner, once they've added their Venmo.
function leagueVenmo(members: MemberRow[]): LeagueVenmo | null {
  const commissioner = members.find((member) => member.role === 'commissioner' && member.venmo);
  return commissioner ? { userId: commissioner.id, name: commissioner.display_name, handle: commissioner.venmo! } : null;
}

// Winners are paid for a tournament's most recent event that has started.
function payoutSeason(tournamentId: string) {
  return latestStartedSeason(tournamentId) ?? picksSeason(tournamentId);
}

// The event whose payouts show for a tournament: the upcoming one once anyone has picks in for it,
// else the most recent one (so winners can still be paid after it ends).
function payoutDisplaySeason(tournamentId: string, entriesIn: (season: number) => number) {
  const upcoming = picksSeason(tournamentId);
  return entriesIn(upcoming) > 0 ? upcoming : payoutSeason(tournamentId);
}

async function loadPayoutsSent(sql: AnySql, leagueId: string) {
  const rows = await sql<{ tournament_id: string; season: number; place: number; user_id: string | null; amount: number; sent_at: Date }[]>`
    select tournament_id, season, place, user_id, amount, sent_at from league_payouts_sent
    where league_id = ${leagueId}
    order by place asc
  `;
  const byTournament: Partial<Record<TournamentId, PayoutSent[]>> = {};
  for (const row of rows) {
    if (!isTournamentId(row.tournament_id) || row.season !== payoutSeason(row.tournament_id)) continue;
    (byTournament[row.tournament_id] ??= []).push({
      place: row.place,
      userId: row.user_id,
      amount: row.amount,
      sentAt: row.sent_at.toISOString(),
    });
  }
  return byTournament;
}

export async function getSessionContext(token: string | undefined): Promise<SessionContext> {
  if (!token) {
    return EMPTY_SESSION;
  }

  const sql = db();
  const [user] = await sql<UserRow[]>`
    select u.id, u.email, u.display_name, u.password_hash, u.password_salt, u.created_at, u.venmo, u.email_verified_at, u.venmo_declined
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

  const isCommissioner = league.role === 'commissioner';
  const [pool, members, payoutsSent] = await Promise.all([
    loadPool(sql, league),
    loadLeagueMembers(sql, league.id),
    isCommissioner ? loadPayoutsSent(sql, league.id) : Promise.resolve(undefined),
  ]);
  const memberIds = members.map((member) => member.id);
  const [rosterData, poolIds] = await Promise.all([
    loadRosterData(sql, league.id, memberIds),
    loadPoolIds(sql, [user.id]),
  ]);

  const maskRosters = maskRostersFor(pool, isCommissioner);
  const entries: PublicPoolEntry[] = members.map((member) => {
    const data = rosterData.get(member.id) ?? emptyRosterData();
    return {
      id: member.id,
      name: member.display_name,
      rosters: maskRosters(data.rosters, member.id === user.id),
      tieBreaks: data.tieBreaks,
      ...(Object.keys(data.pastSeasons).length ? { pastSeasons: data.pastSeasons } : {}),
      ...(isCommissioner ? { venmo: member.venmo ?? null } : {}),
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
      payoutPlan: pool.payoutPlan ?? null,
      payoutInfo: pool.payoutInfo,
      paymentNote: pool.paymentNote ?? null,
      seasonFee: pool.seasonFee ?? null,
      seasonPayoutPlan: pool.seasonPayoutPlan ?? null,
      // Members see only their own entry fee status; the commissioner sees everyone's.
      entryPayments: isCommissioner
        ? pool.entryPayments
        : Object.fromEntries(
            Object.entries(pool.entryPayments ?? {}).map(([tid, byUser]) => [tid, byUser[user.id] ? { [user.id]: byUser[user.id] } : {}]),
          ),
      entryFees: pool.entryFees,
      role: league.role,
      plan: league.plan,
      memberLimit: league.member_limit,
      paidSeason: league.paid_season,
      seasonExpired: seasonExpired(league),
      memberCount: members.length,
      commissioners: members
        .filter((member) => member.role === 'commissioner')
        .map((member) => ({ id: member.id, name: member.display_name, email: member.email, venmo: member.venmo ?? null })),
      venmo: leagueVenmo(members),
      payoutsSent,
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
    insert into rosters (league_id, user_id, tournament_id, season, golfer_ids, submitted_at)
    values (${league.id}, ${userId}, ${tournamentId}, ${picksSeason(tournamentId)}, ${sql.array(sanitizedRoster, 23)}, now())
    on conflict (league_id, user_id, tournament_id, season) do update set
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
    insert into rosters (league_id, user_id, tournament_id, season, tie_break)
    values (${league.id}, ${userId}, ${tournamentId}, ${picksSeason(tournamentId)}, ${tieBreak})
    on conflict (league_id, user_id, tournament_id, season) do update set
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
      select id, email, display_name, password_hash, password_salt, created_at, venmo, email_verified_at, venmo_declined from users where id = ${userId}
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
            insert into rosters (league_id, user_id, tournament_id, season, golfer_ids, submitted_at)
            values (${league.id}, ${memberId}, ${tournamentId}, ${picksSeason(tournamentId)}, ${sql.array(roster, 23)}, ${stamp})
            on conflict (league_id, user_id, tournament_id, season) do update set
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
            insert into rosters (league_id, user_id, tournament_id, season, tie_break)
            values (${league.id}, ${memberId}, ${tournamentId}, ${picksSeason(tournamentId)}, ${value})
            on conflict (league_id, user_id, tournament_id, season) do update set
              tie_break = excluded.tie_break,
              updated_at = now()
          `;
        }
      }

      const [member] = await sql<UserRow[]>`
        select id, email, display_name, password_hash, password_salt, created_at, venmo, email_verified_at, venmo_declined from users where id = ${memberId}
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
      throw new Error("That's the league's commissioner. Make another member commissioner before removing them.");
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
    const season = picksSeason(tournamentId);
    await sql`
      insert into league_tournaments (league_id, tournament_id, state_season) values (${league.id}, ${tournamentId}, ${season})
      on conflict do nothing
    `;
    // A new season's event starts with picks closed, unlocked and no winner score.
    await sql`
      update league_tournaments set picks_open = null, lineup_locked = null, winner_score = null, state_season = ${season}
      where league_id = ${league.id} and tournament_id = ${tournamentId} and coalesce(state_season, 2026) <> ${season}
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
  const season = picksSeason(tournamentId);
  await db()`
    insert into league_tournaments (league_id, tournament_id, lineup_locked, state_season)
    select id, ${tournamentId}, true, ${season} from leagues
    on conflict (league_id, tournament_id) do update set
      lineup_locked = true,
      picks_open = case when coalesce(league_tournaments.state_season, 2026) = ${season} then league_tournaments.picks_open else null end,
      winner_score = case when coalesce(league_tournaments.state_season, 2026) = ${season} then league_tournaments.winner_score else null end,
      state_season = ${season}
    where league_tournaments.lineup_locked is distinct from true
      or coalesce(league_tournaments.state_season, 2026) <> ${season}
  `;
}

export async function getSelectedPlayerIdsForTournament(tournamentId: TournamentId): Promise<Set<number>> {
  const rows = await db()<{ id: number }[]>`
    select distinct unnest(golfer_ids) as id from rosters
    where tournament_id = ${tournamentId} and season = ${picksSeason(tournamentId)} and golfer_ids is not null
  `;
  return new Set(rows.map((row) => row.id));
}

export async function updatePoolPayouts(requestingUserId: string, tournamentId: TournamentId, payouts: TournamentPayouts) {
  return updateLeagueTournament(requestingUserId, tournamentId, async (sql, leagueId) => sql`
    update league_tournaments
    set payout_first = ${payouts.first}, payout_second = ${payouts.second}, payout_third = ${payouts.third},
      payouts_season = ${await overrideSeason(sql, leagueId, tournamentId)}
    where league_id = ${leagueId} and tournament_id = ${tournamentId}
  `);
}

// Typed-in amounts are for the event currently shown (see payoutDisplaySeason).
async function overrideSeason(sql: AnySql, leagueId: string, tournamentId: TournamentId) {
  const upcoming = picksSeason(tournamentId);
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from rosters
    where league_id = ${leagueId} and tournament_id = ${tournamentId} and season = ${upcoming}
      and golfer_ids is not null and cardinality(golfer_ids) > 0
  `;
  return (row?.n ?? 0) > 0 ? upcoming : payoutSeason(tournamentId);
}

// Go back to the league's payout plan for this tournament.
export async function clearPoolPayouts(requestingUserId: string, tournamentId: TournamentId) {
  return updateLeagueTournament(requestingUserId, tournamentId, (sql, leagueId) => sql`
    update league_tournaments set payout_first = null, payout_second = null, payout_third = null, payouts_season = null
    where league_id = ${leagueId} and tournament_id = ${tournamentId}
  `);
}

// Save (or, with null, remove) the league's payout plan. Commissioner of the current league only.
export async function setLeaguePayoutPlan(requestingUserId: string, plan: PayoutPlan | null) {
  return db().begin(async (sql) => {
    const league = await requireActiveLeague(sql, requestingUserId);
    if (league.role !== 'commissioner') throw new Error('Only the commissioner can change payouts.');
    await sql`update leagues set payout_plan = ${plan ? sql.json(plan as never) : null} where id = ${league.id}`;
    return loadPool(sql, league);
  });
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
  if (role === 'member') {
    throw new Error('Every league has one commissioner. Hand the role to another member instead.');
  }
  await db().begin(async (sql) => {
    const league = await requireActiveLeague(sql, requestingUserId);
    if (league.role !== 'commissioner') {
      throw new Error('Only the commissioner can hand over the role.');
    }
    await transferCommissionerTx(sql, league.id, memberId);
  });
}

// Each league has exactly one commissioner: this makes `memberId` the commissioner and everyone
// else (the previous commissioner included) a member.
async function transferCommissionerTx(sql: TxSql, leagueId: string, memberId: string) {
  const [membership] = await sql`
    select 1 from league_members where league_id = ${leagueId} and user_id = ${memberId} for update
  `;
  if (!membership) {
    throw new Error('That person is not in this league.');
  }
  await sql`update league_members set role = 'member' where league_id = ${leagueId} and role = 'commissioner' and user_id <> ${memberId}`;
  await sql`update league_members set role = 'commissioner' where league_id = ${leagueId} and user_id = ${memberId}`;
}

// Deletes the user's account (Apple requires this in-app). A league they solely run is deleted
// with them when they're its only member; otherwise they must hand the commissioner role to another member first.
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
      throw new Error(`You're the commissioner of ${blocking.name}. Make another member commissioner first.`);
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

// ── Venmo payments ───────────────────────────────────────────────────────────

// Saves (or clears, with null / "") the user's own Venmo username.
export async function updateUserVenmo(userId: string, venmoInput: unknown) {
  const venmo = normalizeVenmoUsername(venmoInput);
  const sql = db();
  const [user] = await sql<UserRow[]>`
    update users set venmo = ${venmo}, venmo_declined = case when ${venmo}::text is null then venmo_declined else false end where id = ${userId}
    returning id, email, display_name, password_hash, password_salt, created_at, venmo, email_verified_at, venmo_declined
  `;
  if (!user) {
    throw new Error('User account was not found.');
  }
  const league = await findActiveLeague(sql, userId);
  return publicUserInLeague(sql, user, league?.id ?? null);
}

async function requireCommissionerLeague(sql: AnySql, userId: string) {
  const league = await requireActiveLeague(sql, userId);
  if (league.role !== 'commissioner') {
    throw new Error('Only a commissioner can change this.');
  }
  return league;
}

// Entry fee per tournament (0 / null clears it, so members just submit without paying).
export async function updateEntryFees(requestingUserId: string, fees: Partial<Record<TournamentId, number | null>>) {
  await db().begin(async (sql) => {
    const league = await requireCommissionerLeague(sql, requestingUserId);
    for (const tid of TOURNAMENT_IDS) {
      if (!(tid in fees)) continue;
      const raw = fees[tid];
      const fee = raw === null || raw === undefined ? null : Number(raw);
      if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 10000)) {
        throw new Error('Enter entry fees between $0 and $10,000.');
      }
      const value = fee ? Math.round(fee * 100) / 100 : null;
      await sql`
        insert into league_tournaments (league_id, tournament_id, entry_fee) values (${league.id}, ${tid}, ${value})
        on conflict (league_id, tournament_id) do update set entry_fee = excluded.entry_fee
      `;
    }
  });
}

// The season championship's buy-in (null/0: none) and payout plan. Commissioner only.
export async function setSeasonSettings(requestingUserId: string, fee: number | null, plan: PayoutPlan | null) {
  if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 10000)) throw new Error('Enter a season buy-in between $0 and $10,000.');
  return db().begin(async (sql) => {
    const league = await requireCommissionerLeague(sql, requestingUserId);
    await sql`
      update leagues set season_fee = ${fee ? Math.round(fee * 100) / 100 : null}, season_payout_plan = ${plan ? sql.json(plan as never) : null}
      where id = ${league.id}
    `;
    return loadPool(sql, league);
  });
}

// Every finished tournament this league has saved, without the golfer detail (for the season
// standings and the Hall of Champions).
export async function readLeagueHistory(leagueId: string) {
  return db()<{ tournament_id: string; season: number; standings: { id?: string; name: string; place: number; points: number }[]; payouts: unknown }[]>`
    select tournament_id, season,
      coalesce((select jsonb_agg(jsonb_build_object('id', e->'id', 'name', e->'name', 'place', e->'place', 'points', e->'points'))
        from jsonb_array_elements(standings) e), '[]'::jsonb) as standings,
      payouts
    from league_standings_archive
    where league_id = ${leagueId}
    order by season desc, tournament_id
  `;
}

// ── Push notification tokens and audiences ──────────────────────────────────

export async function savePushToken(userId: string, token: string, platform: string) {
  await db()`
    insert into push_tokens (token, user_id, platform) values (${token}, ${userId}, ${platform})
    on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()
  `;
}

export async function removePushToken(userId: string, token: string) {
  await db()`delete from push_tokens where token = ${token} and user_id = ${userId}`;
}

export async function deletePushTokens(tokens: string[]) {
  if (tokens.length) await db()`delete from push_tokens where token in ${db()(tokens)}`;
}

export async function pushTokensFor(userIds: string[]) {
  if (userIds.length === 0) return [];
  const rows = await db()<{ token: string }[]>`select token from push_tokens where user_id in ${db()(userIds)}`;
  return rows.map((row) => row.token);
}

// Everyone in a league except one person (e.g. the commissioner who opened picks).
export async function leagueMemberIds(leagueId: string, exceptUserId?: string) {
  const rows = await db()<{ user_id: string }[]>`select user_id from league_members where league_id = ${leagueId}`;
  return rows.map((row) => row.user_id).filter((id) => id !== exceptUserId);
}

// Members of leagues with picks open for an event who haven't made picks yet.
export async function membersMissingPicks(tournamentId: TournamentId, season: number) {
  const rows = await db()<{ user_id: string }[]>`
    select distinct m.user_id
    from league_tournaments lt
    join league_members m on m.league_id = lt.league_id
    left join rosters r on r.league_id = m.league_id and r.user_id = m.user_id and r.tournament_id = lt.tournament_id
      and r.season = ${season} and r.golfer_ids is not null and cardinality(r.golfer_ids) > 0
    where lt.tournament_id = ${tournamentId} and lt.picks_open = true and coalesce(lt.state_season, 2026) = ${season}
      and r.user_id is null
  `;
  return rows.map((row) => row.user_id);
}

// Members (in any league) who picked a golfer for an event.
export async function membersWhoPicked(tournamentId: TournamentId, season: number, golferId: number) {
  const rows = await db()<{ user_id: string }[]>`
    select distinct user_id from rosters
    where tournament_id = ${tournamentId} and season = ${season} and ${golferId} = any(golfer_ids)
  `;
  return rows.map((row) => row.user_id);
}

// For "in the money" alerts: every league with picks in for an event, how many places it pays
// (its typed-in amounts for this event, else its payout plan), and each entry's golfers.
export async function leaguesForPlacingAlerts(tournamentId: TournamentId, season: number) {
  const leagues = await db()<{
    id: string;
    name: string;
    payout_plan: PayoutPlan | null;
    payout_first: number | null;
    payout_second: number | null;
    payout_third: number | null;
    payouts_season: number | null;
  }[]>`
    select l.id, l.name, l.payout_plan, lt.payout_first, lt.payout_second, lt.payout_third, lt.payouts_season
    from leagues l
    left join league_tournaments lt on lt.league_id = l.id and lt.tournament_id = ${tournamentId}
    where exists (select 1 from rosters r where r.league_id = l.id and r.tournament_id = ${tournamentId} and r.season = ${season})
  `;
  const rosters = await db()<{ league_id: string; user_id: string; golfer_ids: number[] }[]>`
    select r.league_id, r.user_id, r.golfer_ids
    from rosters r
    join league_members m on m.league_id = r.league_id and m.user_id = r.user_id
    where r.tournament_id = ${tournamentId} and r.season = ${season} and r.golfer_ids is not null and cardinality(r.golfer_ids) > 0
  `;
  return leagues.map((l) => {
    const manual = (l.payout_first !== null || l.payout_second !== null || l.payout_third !== null) && (l.payouts_season ?? 2026) === season;
    const places = manual
      ? [l.payout_first, l.payout_second, l.payout_third].filter((amount) => (amount ?? 0) > 0).length
      : l.payout_plan?.places.length ?? 0;
    return {
      id: l.id,
      name: l.name,
      places,
      entries: rosters.filter((r) => r.league_id === l.id).map((r) => ({ userId: r.user_id, golferIds: r.golfer_ids })),
    };
  });
}

export async function pushTokensByUser(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string[]>();
  const rows = await db()<{ user_id: string; token: string }[]>`select user_id, token from push_tokens where user_id in ${db()(userIds)}`;
  const byUser = new Map<string, string[]>();
  for (const row of rows) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.token]);
  return byUser;
}

// Everyone with picks in for an event, in any league.
export async function membersWithPicks(tournamentId: TournamentId, season: number) {
  const rows = await db()<{ user_id: string }[]>`
    select distinct r.user_id from rosters r
    join league_members m on m.league_id = r.league_id and m.user_id = r.user_id
    where r.tournament_id = ${tournamentId} and r.season = ${season} and r.golfer_ids is not null and cardinality(r.golfer_ids) > 0
  `;
  return rows.map((row) => row.user_id);
}

// How members pay when it isn't through the commissioner's Venmo (null clears it).
export async function setPaymentNote(requestingUserId: string, note: string | null) {
  const clean = note?.trim().slice(0, 200) || null;
  await db().begin(async (sql) => {
    const league = await requireCommissionerLeague(sql, requestingUserId);
    await sql`update leagues set payment_note = ${clean} where id = ${league.id}`;
  });
}

// A member says they paid (or takes it back). A confirmed payment stays confirmed.
export async function reportEntryPayment(userId: string, tournamentId: TournamentId, paid: boolean) {
  await db().begin(async (sql) => {
    const league = await requireActiveLeague(sql, userId);
    const season = await overrideSeason(sql, league.id, tournamentId);
    if (paid) {
      await sql`
        insert into league_entry_payments (league_id, tournament_id, season, user_id, status)
        values (${league.id}, ${tournamentId}, ${season}, ${userId}, 'reported')
        on conflict do nothing
      `;
    } else {
      await sql`
        delete from league_entry_payments
        where league_id = ${league.id} and tournament_id = ${tournamentId} and season = ${season} and user_id = ${userId} and status = 'reported'
      `;
    }
  });
}

// The commissioner marks a member paid (confirmed), back to "says paid", or not paid (null).
export async function setEntryPaymentStatus(requestingUserId: string, tournamentId: TournamentId, memberId: string, status: PaymentStatus | null) {
  return db().begin(async (sql) => {
    const league = await requireCommissionerLeague(sql, requestingUserId);
    const [member] = await sql`select 1 from league_members where league_id = ${league.id} and user_id = ${memberId}`;
    if (!member) throw new Error('That member is not in your league.');
    const season = await overrideSeason(sql, league.id, tournamentId);
    if (status) {
      await sql`
        insert into league_entry_payments (league_id, tournament_id, season, user_id, status)
        values (${league.id}, ${tournamentId}, ${season}, ${memberId}, ${status})
        on conflict (league_id, tournament_id, season, user_id) do update set status = excluded.status, updated_at = now()
      `;
    } else {
      await sql`
        delete from league_entry_payments
        where league_id = ${league.id} and tournament_id = ${tournamentId} and season = ${season} and user_id = ${memberId}
      `;
    }
    return loadPool(sql, league);
  });
}

export const REMINDER_COOLDOWN_HOURS = 6;

// Who a reminder goes to: 'pay' = members with picks in who haven't paid; 'picks' = members
// without picks. Never the commissioner. Claims the send (one per kind every few hours), so it
// throws if one went out recently.
export async function claimReminder(requestingUserId: string, tournamentId: TournamentId, kind: 'pay' | 'picks') {
  return db().begin(async (sql) => {
    const league = await requireCommissionerLeague(sql, requestingUserId);
    const season = kind === 'picks' ? picksSeason(tournamentId) : await overrideSeason(sql, league.id, tournamentId);
    const claimed = await sql`
      insert into league_reminders_sent (league_id, tournament_id, season, kind) values (${league.id}, ${tournamentId}, ${season}, ${kind})
      on conflict (league_id, tournament_id, season, kind) do update set sent_at = now()
        where league_reminders_sent.sent_at < now() - make_interval(hours => ${REMINDER_COOLDOWN_HOURS})
      returning 1
    `;
    if (claimed.length === 0) throw new Error(`A reminder went out in the last ${REMINDER_COOLDOWN_HOURS} hours. Try again later.`);
    const recipients = await sql<{ email: string; display_name: string }[]>`
      select u.email, u.display_name
      from league_members m
      join users u on u.id = m.user_id
      left join rosters r on r.league_id = m.league_id and r.user_id = m.user_id and r.tournament_id = ${tournamentId}
        and r.season = ${season} and r.golfer_ids is not null and cardinality(r.golfer_ids) > 0
      left join league_entry_payments p on p.league_id = m.league_id and p.user_id = m.user_id and p.tournament_id = ${tournamentId} and p.season = ${season}
      where m.league_id = ${league.id} and m.role <> 'commissioner'
        and ${kind === 'picks' ? sql`r.user_id is null` : sql`r.user_id is not null and p.user_id is null`}
    `;
    const [fee] = await sql<{ entry_fee: number | null }[]>`select entry_fee from league_tournaments where league_id = ${league.id} and tournament_id = ${tournamentId}`;
    return { leagueName: league.name, entryFee: fee?.entry_fee ?? 0, recipients };
  });
}

// Records that the commissioner paid a winner through Venmo this season (or undoes it).
export async function setPayoutSent(
  requestingUserId: string,
  input: { tournamentId: TournamentId; place: number; userId: string | null; amount: number; sent: boolean },
) {
  if (!Number.isInteger(input.place) || input.place < 1 || input.place > 3) {
    throw new Error('Unknown place.');
  }
  await db().begin(async (sql) => {
    const league = await requireCommissionerLeague(sql, requestingUserId);
    const season = payoutSeason(input.tournamentId);
    if (!input.sent) {
      await sql`
        delete from league_payouts_sent
        where league_id = ${league.id} and tournament_id = ${input.tournamentId} and season = ${season} and place = ${input.place}
      `;
      return;
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Enter a valid amount.');
    }
    if (input.userId) {
      const [member] = await sql`
        select 1 from league_members where league_id = ${league.id} and user_id = ${input.userId}
      `;
      if (!member) {
        throw new Error('That person is not in this league.');
      }
    }
    await sql`
      insert into league_payouts_sent (league_id, tournament_id, season, place, user_id, amount, sent_by)
      values (${league.id}, ${input.tournamentId}, ${season}, ${input.place}, ${input.userId}, ${input.amount}, ${requestingUserId})
      on conflict (league_id, tournament_id, season, place) do update
        set user_id = excluded.user_id, amount = excluded.amount, sent_by = excluded.sent_by, sent_at = now()
    `;
  });
}

// The user says they don't use Venmo: stop asking them to add it.
export async function declineVenmo(userId: string) {
  await db()`update users set venmo_declined = true where id = ${userId}`;
}

export async function markEmailVerified(userId: string) {
  await db()`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${userId}`;
}

// Whether the account has confirmed its email (accounts from before codes existed count as confirmed).
export async function isEmailVerified(userId: string) {
  const [row] = await db()<{ verified: boolean }[]>`select email_verified_at is not null as verified from users where id = ${userId}`;
  return row?.verified ?? false;
}

// ── App admin: every league ──────────────────────────────────────────────────

export type AdminLeagueRow = {
  id: string;
  name: string;
  joinCode: string;
  plan: string;
  memberLimit: number | null;
  paidSeason: number | null;
  seasonExpired: boolean;
  memberCount: number;
  createdAt: string;
  commissioner: { id: string; name: string; email: string; venmo: string | null } | null;
};

export async function adminListLeagues(): Promise<AdminLeagueRow[]> {
  const rows = await db()<{
    id: string; name: string; join_code: string; plan: string; member_limit: number | null; paid_season: number | null;
    created_at: Date; member_count: number; c_id: string | null; c_name: string | null; c_email: string | null; c_venmo: string | null;
  }[]>`
    select l.id, l.name, l.join_code, l.plan, l.member_limit, l.paid_season, l.created_at,
      (select count(*)::int from league_members x where x.league_id = l.id) as member_count,
      u.id as c_id, u.display_name as c_name, u.email as c_email, u.venmo as c_venmo
    from leagues l
    left join league_members m on m.league_id = l.id and m.role = 'commissioner'
    left join users u on u.id = m.user_id
    order by (l.plan = 'founder') desc, l.created_at asc
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    joinCode: row.join_code,
    plan: row.plan,
    memberLimit: row.member_limit,
    paidSeason: row.paid_season,
    seasonExpired: seasonExpired(row),
    memberCount: row.member_count,
    createdAt: row.created_at.toISOString(),
    commissioner: row.c_id ? { id: row.c_id, name: row.c_name ?? '', email: row.c_email ?? '', venmo: row.c_venmo } : null,
  }));
}

export async function adminListLeagueMembers(leagueId: string) {
  return db()<{ id: string; name: string; email: string; role: LeagueRole }[]>`
    select u.id, u.display_name as name, u.email, m.role
    from league_members m join users u on u.id = m.user_id
    where m.league_id = ${leagueId}
    order by (m.role = 'commissioner') desc, u.display_name asc
  `;
}

// The app admin can make any member of any league its commissioner.
export async function adminSetCommissioner(leagueId: string, memberId: string) {
  await db().begin(async (sql) => {
    await transferCommissionerTx(sql, leagueId, memberId);
  });
}

// Gives a paid league the current season free (a comp from the app admin), keeping its size.
export async function adminGrantFreeSeason(leagueId: string) {
  const season = currentSeason();
  const [league] = await db()<{ plan: string; paid_season: number | null }[]>`
    select plan, paid_season from leagues where id = ${leagueId}
  `;
  if (!league) throw new Error('League not found.');
  if (league.plan === 'founder') throw new Error('This league is already free for life.');
  if ((league.paid_season ?? 0) >= season) throw new Error(`This league already has the ${season} season.`);
  await db()`update leagues set paid_season = ${season} where id = ${leagueId}`;
}

// ── Past Results (each league's final standings) ─────────────────────────────

export async function archiveSeasonsFor(leagueId: string, tournamentId: string): Promise<number[]> {
  const rows = await db()<{ season: number }[]>`
    select season from league_standings_archive
    where league_id = ${leagueId} and tournament_id = ${tournamentId}
    order by season desc
  `;
  return rows.map((row) => row.season);
}

export async function readStandingsArchive(leagueId: string, tournamentId: string, season: number) {
  const [row] = await db()<{ standings: unknown[]; payouts: unknown; saved_at: Date }[]>`
    select standings, payouts, saved_at from league_standings_archive
    where league_id = ${leagueId} and tournament_id = ${tournamentId} and season = ${season}
  `;
  return row ? { standings: row.standings, payouts: row.payouts ?? null, savedAt: row.saved_at.toISOString() } : null;
}

// Saves a league's final standings unless a larger snapshot is already saved (a partly loaded
// screen must never replace a complete one). Returns false when skipped.
export async function saveStandingsArchive(
  leagueId: string,
  tournamentId: string,
  season: number,
  standings: unknown[],
  payouts: unknown,
): Promise<boolean> {
  const rows = await db()`
    insert into league_standings_archive (league_id, tournament_id, season, standings, payouts)
    values (${leagueId}, ${tournamentId}, ${season}, ${db().json(standings as never)}, ${payouts === undefined || payouts === null ? null : db().json(payouts as never)})
    on conflict (league_id, tournament_id, season) do update set
      standings = excluded.standings, payouts = excluded.payouts, saved_at = now()
    where jsonb_array_length(league_standings_archive.standings) <= jsonb_array_length(excluded.standings)
    returning 1
  `;
  return rows.length > 0;
}

// A member leaves a league (their picks there go with them). The commissioner hands the role to
// another member first. If it was the league they were viewing, the app switches to another one.
export async function leaveLeague(userId: string, leagueId: string) {
  await db().begin(async (sql) => {
    const [membership] = await sql<{ role: LeagueRole; name: string }[]>`
      select m.role, l.name from league_members m join leagues l on l.id = m.league_id
      where m.league_id = ${leagueId} and m.user_id = ${userId} for update
    `;
    if (!membership) {
      throw new Error("You're not in that league.");
    }
    if (membership.role === 'commissioner') {
      throw new Error(`You're the commissioner of ${membership.name}. Make another member commissioner before leaving.`);
    }
    await sql`delete from league_members where league_id = ${leagueId} and user_id = ${userId}`;
    await sql`
      update users set active_league_id = (
        select league_id from league_members where user_id = ${userId} order by joined_at asc limit 1
      )
      where id = ${userId} and (active_league_id = ${leagueId} or active_league_id is null)
    `;
  });
}
