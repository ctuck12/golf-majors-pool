import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { DEFAULT_POOL_ID, TOURNAMENT_IDS } from './pool-store-shared';
import { getManualSalaries } from './salary-overrides-store';
import { eventHasStarted, getTournamentMeta } from './tournament-config';
import { computePayouts, type PayoutPlan } from './payout-plan';
import { canonicalNameKey } from './name-match';
import { PLAYER_POOL_WITH_PGA_IDS } from './player-pool';
import { getDynamicPlayers } from './dynamic-pool-store';

// The Demo League (the one App Review signs in to) filled with a finished season, so the standings,
// entries, payouts and reports all have something to show while picks are closed.
//
// - 12 made-up members (@example.com addresses, which never get email; see email.ts)
// - a valid team for every member, real ones included, in each 2026 major already played, built
//   from that event's own salary list (6 golfers, under the cap) with a tie-break guess
// - entry fees, a payout plan and a season buy-in, and most members' fees marked paid
// - each event's final standings saved to Past Results, worked out here from the stored final
//   leaderboard (the same golfer points the app shows), so Season Standings and the Hall of
//   Champions are complete, The Players included, without anyone opening each tab
//
// Only a league whose name contains "demo" can be filled, never the founder league. Running it
// again rebuilds every 2026 team; the current season's picks are never touched.

export const DEMO_SEASON = 2026;
const SALARY_CAP = 50000;
const TEAM_SIZE = 6;
const ENTRY_FEE = 25;
const SEASON_FEE = 50;
const PAYOUT_PLAN = { places: [{ mode: 'percent', value: 67.5 }, { mode: 'rest', value: 0 }, { mode: 'fee', value: 2 }], roundTo: 5 };
const SEASON_PAYOUT_PLAN = { places: [{ mode: 'percent', value: 60 }, { mode: 'rest', value: 0 }, { mode: 'fee', value: 1 }], roundTo: 5 };

const DEMO_NAMES = [
  'Mike Dalton', 'Sarah Kim', 'Jake Morrison', 'Tyler Brooks', 'Emily Carter', 'Chris Walsh',
  'Danny Ortiz', 'Megan Price', 'Ryan Fletcher', 'Josh Patel', 'Kevin Nguyen', 'Laura Bennett',
];

const demoUserId = (leagueId: string, index: number) => `demo-${leagueId}-${index + 1}`;
const demoEmail = (leagueId: string, index: number) =>
  `demo${index + 1}.${createHash('sha256').update(leagueId).digest('hex').slice(0, 8)}@example.com`;

// Small seeded random numbers, so a member's team is the same each time the league is filled.
function seededRandom(seed: string) {
  let h = createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A believable team: one or two big names, a few mid-priced players and a value pick, using most of
// the cap without going over.
export function buildTeam(field: { id: number; salary: number }[], seed: string): number[] | null {
  const byPrice = field.filter((p) => p.salary > 0).sort((a, b) => b.salary - a.salary);
  if (byPrice.length < TEAM_SIZE * 3) return null;
  const rand = seededRandom(seed);
  // Where each pick comes from in the price list: a star, then cheaper players down to a value pick.
  const tiers: [number, number][] = [[0, 8], [4, 25], [10, 40], [15, 60], [25, 90], [35, 150]];
  let best: { ids: number[]; total: number } | null = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked: { id: number; salary: number }[] = [];
    let budget = SALARY_CAP;
    for (let slot = 0; slot < TEAM_SIZE; slot++) {
      const rest = byPrice.filter((p) => !picked.includes(p));
      // Leave enough money for the cheapest players in the slots still to fill.
      const need = TEAM_SIZE - slot - 1;
      const reserve = rest.slice(rest.length - need).reduce((sum, p) => sum + p.salary, 0) * (need > 0 ? 1 : 0);
      const affordable = (p: { salary: number }) => p.salary <= budget - reserve;
      const [lo, hi] = tiers[slot];
      let options = byPrice.slice(lo, hi).filter((p) => !picked.includes(p) && affordable(p));
      if (options.length === 0) options = rest.filter(affordable);
      if (options.length === 0) break;
      const choice = options[Math.floor(rand() * options.length)];
      picked.push(choice);
      budget -= choice.salary;
    }
    if (picked.length < TEAM_SIZE) continue;
    const total = SALARY_CAP - budget;
    if (!best || total > best.total) best = { ids: picked.map((p) => p.id), total };
    if (total >= SALARY_CAP * 0.9) break;
  }
  return best?.ids ?? null;
}

export function isDemoLeagueName(name: string) {
  return /demo/i.test(name);
}

export type DemoFillResult = { members: number; demoMembers: number; teams: number; tournaments: string[]; skipped: string[]; standingsSaved: string[] };

export async function fillDemoLeague(leagueId: string): Promise<DemoFillResult> {
  const sql = db();
  const [league] = await sql<{ id: string; name: string }[]>`select id, name from leagues where id = ${leagueId}`;
  if (!league) throw new Error('League not found.');
  if (league.id === DEFAULT_POOL_ID) throw new Error('The founder league is never filled with demo data.');
  if (!isDemoLeagueName(league.name)) throw new Error('Only a league with "Demo" in its name can be filled with demo data.');

  // The 2026 events already played, each with its salary list (the field and prices that week).
  const events: { tournamentId: string; field: { id: number; salary: number }[]; lockAt: string }[] = [];
  const skipped: string[] = [];
  for (const tid of TOURNAMENT_IDS) {
    const meta = getTournamentMeta(tid, DEMO_SEASON);
    if (!meta || !eventHasStarted(tid, DEMO_SEASON)) continue;
    const salaries = await getManualSalaries(tid, DEMO_SEASON);
    let field = salaries ? Object.entries(salaries.map).map(([id, e]) => ({ id: Number(id), salary: e.salary })) : [];
    // No salary list was saved for that week (the early 2026 events predate per-event lists): build
    // the field from the event's final leaderboard instead, pricing players by world ranking so the
    // teams mix stars and value picks the same way.
    const finished = await fieldFromFinalLeaderboard(tid);
    if (field.length < TEAM_SIZE * 3) field = finished;
    // Only golfers who actually played that week (a salary list can include late withdrawals, who
    // would leave a team one golfer short in the results).
    else if (finished.length >= TEAM_SIZE * 3) {
      const played = new Set(finished.map((p) => p.id));
      field = field.filter((p) => played.has(p.id));
    }
    if (field.length < TEAM_SIZE * 3) { skipped.push(tid); continue; }
    events.push({ tournamentId: tid, field, lockAt: meta.lockAtUtc });
  }
  if (events.length === 0) throw new Error(`No ${DEMO_SEASON} salary lists or final leaderboards were found, so there are no teams to build.`);

  let teams = 0;
  await sql.begin(async (tx) => {
    // Made-up members (made once; their names and emails stay the same on later runs).
    for (let i = 0; i < DEMO_NAMES.length; i++) {
      const id = demoUserId(league.id, i);
      await tx`
        insert into users (id, email, display_name, password_hash, password_salt, active_league_id, email_verified_at, venmo_declined)
        values (${id}, ${demoEmail(league.id, i)}, ${DEMO_NAMES[i]}, ${randomBytes(32).toString('hex')}, ${randomBytes(16).toString('hex')}, ${league.id}, now(), true)
        on conflict (id) do update set display_name = excluded.display_name
      `;
      await tx`
        insert into league_members (league_id, user_id, role, joined_at)
        values (${league.id}, ${id}, 'member', ${new Date(Date.parse(events[0].lockAt) - (20 + i) * 24 * 60 * 60 * 1000)})
        on conflict (league_id, user_id) do nothing
      `;
    }

    const members = await tx<{ user_id: string }[]>`select user_id from league_members where league_id = ${league.id} order by joined_at, user_id`;

    for (const event of events) {
      for (const member of members) {
        const demoIndex = DEMO_NAMES.findIndex((_, i) => demoUserId(league.id, i) === member.user_id);
        const golferIds = buildTeam(event.field, `${league.id}:${member.user_id}:${event.tournamentId}`);
        if (!golferIds) continue;
        const rand = seededRandom(`${member.user_id}:${event.tournamentId}:extras`);
        const tieBreak = 268 + Math.floor(rand() * 16);
        const submittedAt = new Date(Date.parse(event.lockAt) - (2 + rand() * 70) * 60 * 60 * 1000);
        // Every team in the sample season is rebuilt each run (it's a demo league, and the 2026
        // teams are all ones this tool made).
        const rows = await tx`
          insert into rosters (league_id, user_id, tournament_id, season, golfer_ids, tie_break, submitted_at, updated_at)
          values (${league.id}, ${member.user_id}, ${event.tournamentId}, ${DEMO_SEASON}, ${golferIds}, ${tieBreak}, ${submittedAt}, ${submittedAt})
          on conflict (league_id, user_id, tournament_id, season) do update
            set golfer_ids = excluded.golfer_ids, tie_break = excluded.tie_break, submitted_at = excluded.submitted_at, updated_at = excluded.updated_at
          returning 1`;
        teams += rows.length;

        // Entry fees: nearly everyone paid; one member says they paid and is waiting on the
        // commissioner, and one hasn't paid yet, so the tracking has something to show.
        const status = demoIndex === DEMO_NAMES.length - 1 ? null : demoIndex === DEMO_NAMES.length - 2 ? 'reported' : 'confirmed';
        if (status) {
          await tx`
            insert into league_entry_payments (league_id, tournament_id, season, user_id, status)
            values (${league.id}, ${event.tournamentId}, ${DEMO_SEASON}, ${member.user_id}, ${status})
            on conflict (league_id, tournament_id, season, user_id) do nothing
          `;
        }
      }
    }

    // League settings, only where the commissioner hasn't set their own.
    for (const tid of TOURNAMENT_IDS) {
      await tx`
        insert into league_tournaments (league_id, tournament_id, entry_fee)
        values (${league.id}, ${tid}, ${ENTRY_FEE})
        on conflict (league_id, tournament_id) do update set entry_fee = coalesce(league_tournaments.entry_fee, excluded.entry_fee)
      `;
    }
    await tx`update leagues set is_demo = true, payout_plan = coalesce(payout_plan, ${tx.json(PAYOUT_PLAN as never)}) where id = ${league.id}`;
    // The sample season ran a season-long pool (the current season is left for the commissioner to decide).
    await tx`
      insert into league_season_pools (league_id, season, enabled, fee, plan)
      values (${league.id}, ${DEMO_SEASON}, true, ${SEASON_FEE}, ${tx.json(SEASON_PAYOUT_PLAN as never)})
      on conflict (league_id, season) do nothing
    `;
  });

  const standingsSaved: string[] = [];
  for (const event of events) {
    const saved = await saveFinalStandings(league.id, event.tournamentId, new Map(event.field.map((p) => [p.id, p.salary]))).catch(() => false);
    if (saved) standingsSaved.push(event.tournamentId);
  }

  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from league_members where league_id = ${league.id}`;
  return { members: n, demoMembers: DEMO_NAMES.length, teams, tournaments: events.map((e) => e.tournamentId), skipped, standingsSaved };
}

// The stored final leaderboard for a 2026 event, when it's still that season's and finished.
async function finalFeed(tournamentId: string) {
  const { GET } = await import('../api/leaderboard/route');
  const res = await GET(new Request(`http://internal/api/leaderboard?tournamentId=${tournamentId}`));
  const feed = (await res.json()) as { season?: number; tournamentComplete?: boolean; players?: FeedPlayer[] };
  if (feed.season !== DEMO_SEASON || !feed.players?.length) return null;
  const done = (p: FeedPlayer) => p.thru === 'F' || ['CUT', 'WD', 'DQ', 'MDF', 'MC'].includes(String(p.score).toUpperCase());
  if (!feed.tournamentComplete && !feed.players.every(done)) return null;
  return feed.players;
}

async function fieldFromFinalLeaderboard(tournamentId: string): Promise<{ id: number; salary: number }[]> {
  const players = await finalFeed(tournamentId).catch(() => null);
  if (!players) return [];
  const dynamic = await getDynamicPlayers().catch(() => []);
  const pool = [...PLAYER_POOL_WITH_PGA_IDS, ...dynamic] as { id: number; name: string; worldRank?: number }[];
  const byName = new Map(pool.map((p) => [canonicalNameKey(p.name), p]));
  const field = new Map<number, number>();
  // The feed also lists pool golfers who weren't in the field (with odds only): skip anyone without
  // a finishing position.
  for (const row of players.filter((r) => r.position && r.position !== '--' && r.scoreBreakdown)) {
    const p = byName.get(canonicalNameKey(row.canonicalName ?? ''));
    if (!p || field.has(p.id)) continue;
    const rank = p.worldRank && p.worldRank > 0 ? p.worldRank : 300;
    field.set(p.id, Math.max(5000, Math.round((12500 - 85 * (rank - 1)) / 100) * 100));
  }
  return [...field.entries()].map(([id, salary]) => ({ id, salary }));
}

type FeedPlayer = { canonicalName?: string; position?: string; score?: string; thru?: string; total?: string; scoreBreakdown?: { totalPoints?: number } };

// A finished event's standings for the league, ranked the way the app ranks them (points, then the
// tie-break guess closest to the winner's strokes, then picking the winner, then best golfer), and
// saved as that event's Past Results. Only when the stored leaderboard is still that season's final.
async function saveFinalStandings(leagueId: string, tournamentId: string, salaries: Map<number, number>) {
  const feedPlayers = await finalFeed(tournamentId);
  if (!feedPlayers) return false;
  const feed = { players: feedPlayers };

  const dynamic = await getDynamicPlayers().catch(() => []);
  const pool = [...PLAYER_POOL_WITH_PGA_IDS, ...dynamic];
  const idByName = new Map(pool.map((p) => [canonicalNameKey(p.name), p.id]));
  const nameById = new Map(pool.map((p) => [p.id, p.name]));
  const byId = new Map<number, FeedPlayer>();
  for (const row of feed.players) {
    const id = idByName.get(canonicalNameKey(row.canonicalName ?? ''));
    if (id != null && !byId.has(id)) byId.set(id, row);
  }
  const champion = feed.players.find((p) => String(p.position).trim() === '1');
  const championId = champion ? idByName.get(canonicalNameKey(champion.canonicalName ?? '')) ?? null : null;
  const winnerStrokes = champion?.total ? parseInt(String(champion.total), 10) : NaN;

  const sql = db();
  const rows = await sql<{ user_id: string; display_name: string; golfer_ids: number[]; tie_break: number | null }[]>`
    select r.user_id, u.display_name, r.golfer_ids, r.tie_break
    from rosters r
    join league_members m on m.league_id = r.league_id and m.user_id = r.user_id
    join users u on u.id = r.user_id
    where r.league_id = ${leagueId} and r.tournament_id = ${tournamentId} and r.season = ${DEMO_SEASON}
      and r.golfer_ids is not null and cardinality(r.golfer_ids) = ${TEAM_SIZE}
  `;
  if (rows.length === 0) return false;

  const entries = rows.map((r) => {
    const golfers = r.golfer_ids.map((id) => {
      const g = byId.get(id);
      return {
        name: g?.canonicalName ?? nameById.get(id) ?? 'Unknown',
        score: g?.score ?? 'CUT',
        points: g?.scoreBreakdown?.totalPoints ?? 0,
        position: g?.position ?? '--',
        salary: salaries.get(id) ?? 0,
      };
    });
    const tieBreak = r.tie_break ?? 275;
    return {
      id: r.user_id,
      name: r.display_name,
      points: Math.round(golfers.reduce((sum, g) => sum + g.points, 0) * 10) / 10,
      tieBreak,
      hasChampion: championId != null && r.golfer_ids.includes(championId),
      golfers,
    };
  });
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (!Number.isNaN(winnerStrokes)) {
      const diff = Math.abs(a.tieBreak - winnerStrokes) - Math.abs(b.tieBreak - winnerStrokes);
      if (diff !== 0) return diff;
    }
    if (a.hasChampion !== b.hasChampion) return a.hasChampion ? -1 : 1;
    const ap = a.golfers.map((g) => g.points).sort((x, y) => y - x);
    const bp = b.golfers.map((g) => g.points).sort((x, y) => y - x);
    for (let i = 0; i < TEAM_SIZE; i++) if (ap[i] !== bp[i]) return (bp[i] ?? 0) - (ap[i] ?? 0);
    return 0;
  });
  const standings = entries.map((e, index) => ({
    id: e.id, place: index + 1, name: e.name, points: e.points, holesRemaining: 0, tieBreak: e.tieBreak, golfers: e.golfers,
  }));

  const [league] = await sql<{ payout_plan: PayoutPlan | null }[]>`select payout_plan from leagues where id = ${leagueId}`;
  const [fees] = await sql<{ entry_fee: number | null }[]>`select entry_fee from league_tournaments where league_id = ${leagueId} and tournament_id = ${tournamentId}`;
  const fee = fees?.entry_fee ?? 0;
  const payouts = league?.payout_plan && fee > 0 ? computePayouts(league.payout_plan, fee * standings.length, fee) : null;

  await sql`
    insert into league_standings_archive (league_id, tournament_id, season, standings, payouts)
    values (${leagueId}, ${tournamentId}, ${DEMO_SEASON}, ${sql.json(standings as never)}, ${payouts ? sql.json(payouts as never) : null})
    on conflict (league_id, tournament_id, season) do update set standings = excluded.standings, payouts = excluded.payouts, saved_at = now()
  `;
  return true;
}

// Takes the made-up members (and everything of theirs) back out of the league.
export async function clearDemoLeague(leagueId: string): Promise<number> {
  const sql = db();
  const [league] = await sql<{ id: string; name: string }[]>`select id, name from leagues where id = ${leagueId}`;
  if (!league || league.id === DEFAULT_POOL_ID || !isDemoLeagueName(league.name)) throw new Error('Not a demo league.');
  const ids = DEMO_NAMES.map((_, i) => demoUserId(league.id, i));
  const removed = await sql`delete from users where id in ${sql(ids)} returning 1`;
  await sql`update leagues set is_demo = false where id = ${league.id}`;
  // Their Past Results rows go too (the real members' views save fresh ones).
  await sql`delete from league_standings_archive where league_id = ${league.id} and season = ${DEMO_SEASON}`;
  return removed.length;
}
