import { requireAdminRequest } from '@/app/lib/admin-auth';
import { db } from '@/app/lib/db';
import { SCHEMA_SQL } from '@/app/lib/db-schema';
import { userDataBackend } from '@/app/lib/pool-store';
import { hashSessionToken } from '@/app/lib/pool-store-postgres';
import { readDatabase } from '@/app/lib/pool-store-redis';
import { isAppAdmin, TOURNAMENT_IDS, type TournamentId } from '@/app/lib/pool-store-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// One-time copy of user data from the Redis blob into Postgres.
//   GET /api/admin/migrate-user-data          → dry run: what would be copied, what Postgres has now
//   GET /api/admin/migrate-user-data?apply=1  → create tables, replace Postgres user data with Redis's
// Redis is only read, never changed. Refuses to apply once the app runs on Postgres
// (USER_DATA_BACKEND=postgres), since that would overwrite newer data.
export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not set.' }, { status: 500 });
  }

  const apply = new URL(request.url).searchParams.get('apply') === '1';
  const source = await readDatabase();
  const plan = buildRows(source);
  const sourceCounts = {
    users: plan.users.length,
    sessions: plan.sessions.length,
    leagues: plan.leagues.length,
    leagueMembers: plan.members.length,
    leagueTournaments: plan.tournaments.length,
    rosters: plan.rosters.length,
  };

  const sql = db();

  if (!apply) {
    return Response.json({
      mode: 'dry-run',
      backend: userDataBackend(),
      redis: sourceCounts,
      postgres: await countRows().catch((error) => ({ error: String(error) })),
    });
  }

  if (userDataBackend() === 'postgres') {
    return Response.json(
      { error: 'The app already runs on Postgres; copying from Redis now would overwrite newer data.' },
      { status: 409 },
    );
  }

  await sql.unsafe(SCHEMA_SQL);

  await sql.begin(async (tx) => {
    await tx`truncate rosters, league_tournaments, league_members, sessions, leagues, users cascade`;
    // Users first without active_league_id (leagues don't exist yet), then set it after.
    if (plan.users.length) {
      await tx`insert into users ${tx(plan.users, 'id', 'email', 'display_name', 'password_hash', 'password_salt', 'created_at')}`;
    }
    if (plan.leagues.length) {
      await tx`insert into leagues ${tx(plan.leagues, 'id', 'name', 'join_code', 'plan', 'member_limit', 'created_at')}`;
    }
    for (const user of plan.users) {
      if (user.active_league_id) {
        await tx`update users set active_league_id = ${user.active_league_id} where id = ${user.id}`;
      }
    }
    if (plan.members.length) {
      await tx`insert into league_members ${tx(plan.members, 'league_id', 'user_id', 'role', 'joined_at')}`;
    }
    if (plan.tournaments.length) {
      await tx`insert into league_tournaments ${tx(plan.tournaments, 'league_id', 'tournament_id', 'picks_open', 'lineup_locked', 'payout_first', 'payout_second', 'payout_third', 'winner_score')}`;
    }
    for (const roster of plan.rosters) {
      await tx`
        insert into rosters (league_id, user_id, tournament_id, golfer_ids, tie_break, submitted_at)
        values (${roster.league_id}, ${roster.user_id}, ${roster.tournament_id},
          ${roster.golfer_ids === null ? null : tx.array(roster.golfer_ids, 23)},
          ${roster.tie_break}, ${roster.submitted_at})
      `;
    }
    if (plan.sessions.length) {
      await tx`insert into sessions ${tx(plan.sessions, 'token_hash', 'user_id', 'created_at', 'expires_at')}`;
    }
  });

  const postgresCounts = await countRows();
  const matches = (Object.keys(sourceCounts) as (keyof typeof sourceCounts)[])
    .every((key) => sourceCounts[key] === postgresCounts[key]);

  return Response.json({ mode: 'applied', matches, redis: sourceCounts, postgres: postgresCounts });
}

async function countRows() {
  const [row] = await db()<{
    users: number;
    sessions: number;
    leagues: number;
    leagueMembers: number;
    leagueTournaments: number;
    rosters: number;
  }[]>`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from sessions) as sessions,
      (select count(*)::int from leagues) as leagues,
      (select count(*)::int from league_members) as "leagueMembers",
      (select count(*)::int from league_tournaments) as "leagueTournaments",
      (select count(*)::int from rosters) as rosters
  `;
  return row;
}

type Source = Awaited<ReturnType<typeof readDatabase>>;

function buildRows(source: Source) {
  const userIds = new Set(source.users.map((user) => user.id));
  const poolIds = new Set(source.pools.map((pool) => pool.id));

  // Membership is recorded on both sides of the blob; take the union of the two.
  const memberships = new Map<string, Set<string>>();
  const addMembership = (leagueId: string, userId: string) => {
    if (!poolIds.has(leagueId) || !userIds.has(userId)) return;
    if (!memberships.has(leagueId)) memberships.set(leagueId, new Set());
    memberships.get(leagueId)!.add(userId);
  };
  for (const pool of source.pools) for (const userId of pool.memberUserIds) addMembership(pool.id, userId);
  for (const user of source.users) for (const poolId of user.poolIds) addMembership(poolId, user.id);

  const users = source.users.map((user) => ({
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    password_hash: user.passwordHash,
    password_salt: user.passwordSalt,
    created_at: new Date(user.createdAt),
    active_league_id: user.poolIds.find((id) => memberships.get(id)?.has(user.id)) ?? null,
  }));

  // Every league that exists today predates paid plans, so it's a founder league: free, no cap.
  const leagues = source.pools.map((pool) => ({
    id: pool.id,
    name: pool.name,
    join_code: pool.joinCode,
    plan: 'founder',
    member_limit: null as number | null,
    created_at: new Date(pool.createdAt ?? Date.now()),
  }));

  const usersById = new Map(source.users.map((user) => [user.id, user]));
  const members = [...memberships.entries()].flatMap(([leagueId, ids]) =>
    [...ids].map((userId) => ({
      league_id: leagueId,
      user_id: userId,
      role: isAppAdmin(usersById.get(userId)) ? 'commissioner' : 'member',
      joined_at: new Date(usersById.get(userId)!.createdAt),
    })),
  );

  const tournaments = source.pools.flatMap((pool) =>
    TOURNAMENT_IDS.flatMap((tid) => {
      const payouts = pool.payouts?.[tid];
      const row = {
        league_id: pool.id,
        tournament_id: tid,
        picks_open: pool.picksOpen?.[tid] ?? null,
        lineup_locked: pool.lineupLocks?.[tid] ?? null,
        payout_first: payouts?.first ?? null,
        payout_second: payouts?.second ?? null,
        payout_third: payouts?.third ?? null,
        winner_score: pool.winnerScores?.[tid] ?? null,
      };
      const hasData = [row.picks_open, row.lineup_locked, row.payout_first, row.winner_score].some((v) => v !== null);
      return hasData ? [row] : [];
    }),
  );

  // Picks were stored per user, not per pool; copy them into each league the user belongs to.
  const rosters = members.flatMap(({ league_id, user_id }) => {
    const user = usersById.get(user_id)!;
    const tids = TOURNAMENT_IDS.filter(
      (tid) => user.rosters?.[tid] !== undefined || user.tieBreaks?.[tid] !== undefined,
    );
    return tids.map((tid: TournamentId) => ({
      league_id,
      user_id,
      tournament_id: tid,
      golfer_ids: user.rosters?.[tid] ?? null,
      tie_break: user.tieBreaks?.[tid] ?? null,
      submitted_at: user.rosterSubmittedAt?.[tid] ? new Date(user.rosterSubmittedAt[tid]!) : null,
    }));
  });

  // Hash the existing session tokens so everyone stays signed in across the switch.
  const sessions = source.sessions
    .filter((session) => userIds.has(session.userId))
    .map((session) => ({
      token_hash: hashSessionToken(session.token),
      user_id: session.userId,
      created_at: new Date(session.createdAt),
      expires_at: new Date(session.expiresAt),
    }));

  return { users, leagues, members, tournaments, rosters, sessions };
}
