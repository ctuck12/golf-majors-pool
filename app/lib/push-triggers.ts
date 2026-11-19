import { canonicalNameKey } from './name-match';
import { getDynamicPlayers } from './dynamic-pool-store';
import { PLAYER_POOL_WITH_PGA_IDS } from './player-pool';
import { formatMoney, placeLabel } from './venmo';
import { readLeaderboardCache } from './scorecard-store';
import { currentTournamentMeta, effectiveLockTime } from './tournament-config';
import { getLockTimeOverrides } from './lock-time-store';
import { allLeagueMemberIds, leaguesForPlacingAlerts, membersMissingPicks, membersWhoPicked, membersWithPicks, pushTokensByUser, type TournamentId } from './pool-store';
import { isPushConfigured, sendPushOnce, sendPushToTokens } from './push';
import { leaguePlacings, nextAlert, type AlertState } from './placing-alerts';
import redis from './redis';

// What the app sends as push notifications, and when. Each is sent at most once (per league,
// event, round or payment as fits), so the every-2-minutes score refresh can call these freely.

const NAMES: Record<TournamentId, string> = {
  players: 'The Players',
  masters: 'The Masters',
  pga: 'the PGA Championship',
  'us-open': 'the U.S. Open',
  open: 'The Open',
};
const TITLE: Record<TournamentId, string> = {
  players: 'The Players',
  masters: 'The Masters',
  pga: 'PGA Championship',
  'us-open': 'U.S. Open',
  open: 'The Open',
};
const DAY = 24 * 60 * 60;

// Picks opened (by the app admin, for every league at once): to everyone in any league.
export async function pushPicksOpen(input: { tournamentId: TournamentId; season: number; adminId: string }) {
  if (!isPushConfigured()) return;
  const members = (await allLeagueMemberIds()).filter((id) => id !== input.adminId);
  await sendPushOnce(`picks-open:all:${input.tournamentId}:${input.season}`, 30 * DAY, members, {
    title: `${TITLE[input.tournamentId]} picks are open ⛳`,
    body: 'The field is set. Pick your 6 golfers before the first tee time.',
    data: { tab: 'My Entries' },
  });
}

// A commissioner paid a winner (through Venmo, or marked as paid another way).
export async function pushYouWerePaid(input: { userId: string; commissionerName: string; tournamentId: TournamentId; place: number; amount: number; season: number }) {
  if (!isPushConfigured()) return;
  await sendPushOnce(`paid:${input.userId}:${input.tournamentId}:${input.season}:${input.place}`, 60 * DAY, [input.userId], {
    title: "You've been paid 💸",
    body: `${input.commissionerName} sent your ${TITLE[input.tournamentId]} ${placeLabel(input.place)} place winnings: ${formatMoney(input.amount)}.`,
  });
}

// From the score refresh: the 2-hour warning, a new solo leader, and final results.
export async function pushFromScoreRefresh(tournamentId: TournamentId, refreshResult: string) {
  if (!isPushConfigured()) return;
  const meta = currentTournamentMeta(tournamentId);
  if (!meta) return;
  const season = Number(meta.year);

  // Picks lock in about 2 hours: to members of leagues with picks open who haven't picked.
  const overrides = await getLockTimeOverrides().catch((): Awaited<ReturnType<typeof getLockTimeOverrides>> => ({}));
  const lockIso = effectiveLockTime(overrides[tournamentId as keyof typeof overrides], meta.lockAtUtc);
  if (lockIso) {
    const untilLock = Date.parse(lockIso) - Date.now();
    if (untilLock > 0 && untilLock <= 2 * 60 * 60 * 1000) {
      const missing = await membersMissingPicks(tournamentId, season);
      await sendPushOnce(`lock-soon:${tournamentId}:${season}`, 7 * DAY, missing, {
        title: `${TITLE[tournamentId]} picks lock soon ⏰`,
        body: `Picks lock at the first tee time, about ${untilLock > 90 * 60 * 1000 ? '2 hours' : 'an hour'} from now. You haven't made yours yet.`,
        data: { tab: 'My Entries' },
      });
    }
  }

  // Only a refresh of this season's live event counts (not last season's results kept on show).
  const live = refreshResult === 'tournament-complete-marked' || refreshResult === 'live-scorecards-refreshed' || refreshResult === 'leaderboard-refreshed' || /^round-\d+-complete/.test(refreshResult);
  if (!live) return;
  const cache = await readLeaderboardCache(tournamentId).catch(() => null);
  if (!cache || cache.notStarted) return;

  // Final results, the moment the event is marked complete.
  if (refreshResult === 'tournament-complete-marked') {
    const players = await membersWithPicks(tournamentId, season);
    await sendPushOnce(`final:${tournamentId}:${season}`, 30 * DAY, players, {
      title: `${TITLE[tournamentId]} is final 🏆`,
      body: `The results are in. See where you finished.`,
      data: { tab: 'Standings' },
    });
    return;
  }

  // A golfer takes the solo lead: to everyone who picked them, once per golfer per round.
  if (cache.tournamentComplete) return;

  // Moving into, or out of, your league's paying places.
  await pushPlacingChanges(tournamentId, season).catch(() => {});
  const leaders = cache.leaderboard.filter((row) => String(row.position).trim() === '1');
  if (leaders.length !== 1) return;
  const leader = leaders[0];
  const name = `${leader.firstName} ${leader.lastName}`.trim();
  const key = canonicalNameKey(name);
  const dynamic = await getDynamicPlayers().catch(() => []);
  const match = [...PLAYER_POOL_WITH_PGA_IDS, ...dynamic].find((p) => canonicalNameKey(p.name) === key);
  if (!match) return;
  const owners = await membersWhoPicked(tournamentId, season, match.id);
  const thru = leader.thru && leader.thru !== 'F' ? ` thru ${leader.thru}` : '';
  await sendPushOnce(`leader:${tournamentId}:${season}:${cache.currentRound}:${match.id}`, 7 * DAY, owners, {
    title: `${name} leads ${NAMES[tournamentId]}! 🔥`,
    body: `Your pick is alone in first at ${leader.total}${thru}.`,
    data: { tab: 'Standings' },
  });
}


// "You're in the money" / "You dropped out of the money": per league, against the places that
// league pays (its payout plan, or the amounts typed in for this event). Uses the same golfer
// points as the leaderboard. A change has to last 10 minutes, and each member gets at most one
// of these per league every 45 minutes, so live swings don't flood anyone.
async function pushPlacingChanges(tournamentId: TournamentId, season: number) {
  const { GET } = await import('../api/leaderboard/route');
  const res = await GET(new Request(`http://internal/api/leaderboard?tournamentId=${tournamentId}`));
  const feed = (await res.json()) as { season?: number; players?: { canonicalName?: string; scoreBreakdown?: { totalPoints?: number } }[] };
  if (feed.season !== season || !feed.players?.length) return;

  const dynamic = await getDynamicPlayers().catch(() => []);
  const idByName = new Map([...PLAYER_POOL_WITH_PGA_IDS, ...dynamic].map((p) => [canonicalNameKey(p.name), p.id]));
  const pointsByGolfer = new Map<number, number>();
  for (const row of feed.players) {
    const id = idByName.get(canonicalNameKey(row.canonicalName ?? ''));
    if (id != null) pointsByGolfer.set(id, row.scoreBreakdown?.totalPoints ?? 0);
  }

  const now = Date.now();
  for (const league of await leaguesForPlacingAlerts(tournamentId, season)) {
    // Nothing to win or lose when the league pays nobody, or pays everyone who entered.
    if (league.places < 1 || league.entries.length <= league.places) continue;
    const placings = leaguePlacings(league.entries, pointsByGolfer, league.places);
    const key = `push-placing:${league.id}:${tournamentId}:${season}`;
    const stored = await redis.hgetall(key).catch(() => ({} as Record<string, string>));
    const updates: Record<string, string> = {};
    const toSend: { userId: string; inMoney: boolean; rank: number; tied: boolean; points: number }[] = [];
    for (const p of placings) {
      let prev: AlertState | undefined;
      try {
        prev = stored[p.userId] ? (JSON.parse(stored[p.userId]) as AlertState) : undefined;
      } catch {
        prev = undefined;
      }
      const { send, state } = nextAlert(prev, p.inMoney, now);
      if (JSON.stringify(state) !== JSON.stringify(prev ?? null)) updates[p.userId] = JSON.stringify(state);
      if (send) toSend.push(p);
    }
    if (Object.keys(updates).length) {
      await redis.hset(key, updates).catch(() => {});
      await redis.expire(key, 14 * DAY).catch(() => {});
    }
    if (toSend.length === 0) continue;
    const pays = league.places === 1 ? 'winner takes all' : `top ${league.places} get paid`;
    const tokens = await pushTokensByUser(toSend.map((p) => p.userId));
    for (const p of toSend) {
      const userTokens = tokens.get(p.userId) ?? [];
      if (userTokens.length === 0) continue;
      const place = `${p.tied ? 'T' : ''}${placeLabel(p.rank)}`;
      await sendPushToTokens(userTokens, p.inMoney
        ? {
            title: "You're in the money! 💰",
            body: `You're ${place} in ${league.name} for ${TITLE[tournamentId]} with ${p.points} pts (${pays}).`,
            data: { tab: 'Standings' },
          }
        : {
            title: 'You dropped out of the money 📉',
            body: `You're ${place} in ${league.name} for ${TITLE[tournamentId]} now (${pays}). Still time to climb back.`,
            data: { tab: 'Standings' },
          });
    }
  }
}
