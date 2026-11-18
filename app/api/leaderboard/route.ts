export const dynamic = 'force-dynamic';

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { getDynamicPlayers } from '@/app/lib/dynamic-pool-store';
import { parseMongo, type SlashGolfLeaderboardRow } from '@/app/lib/slashgolf';
import { currentTournamentMeta, getTournamentMeta, type TournamentMeta } from '@/app/lib/tournament-config';
import { espnEventIdFor } from '@/app/lib/espn-event-ids';
import {
  getScorecardCache,
  getRoundLeaderStore,
  getRoundLeadersAwarded,
  getLowRoundStore,
  getTournamentLowRoundScore,
  getLiveSeason,
  readLeaderboardCache,
  normName,
} from '@/app/lib/scorecard-store';
import {
  computeFullScoreBreakdown,
  buildPlaceholderScoreBreakdown,
} from '@/app/lib/scoring';
import {
  getStatOverrides,
  TOURNAMENT_IDS,
  type TournamentId,
  type StatOverrideEntry,
} from '@/app/lib/pool-store';
import redis from '@/app/lib/redis';

// ── Field parsing ─────────────────────────────────────────────────────────

function normalizeScore(row: SlashGolfLeaderboardRow): string {
  const status = String(row.status ?? '').toLowerCase();
  if (status === 'cut' || status === 'mc') return 'CUT';
  if (status === 'wd') return 'WD';
  if (status === 'dq') return 'DQ';
  if (status === 'mdf') return 'MDF';
  const raw = String(row.total ?? '').trim();
  if (!raw || raw === '--') return '--';
  return raw;
}

function normalizeThru(row: SlashGolfLeaderboardRow): string {
  return String(row.thru ?? '').trim() || '--';
}

function normalizePosition(row: SlashGolfLeaderboardRow): string {
  return String(row.position ?? '--');
}

function normalizeTotalStrokes(row: SlashGolfLeaderboardRow): string {
  return String(row.totalStrokesFromCompletedRounds ?? '--');
}

function computeOriginalScore(row: SlashGolfLeaderboardRow): string | undefined {
  const status = String(row.status ?? '').toLowerCase();
  if (status !== 'cut' && status !== 'mc' && status !== 'wd' && status !== 'dq' && status !== 'mdf') return undefined;
  const rounds = (row.rounds ?? []) as Array<{ scoreToPar?: unknown }>;
  if (rounds.length === 0) return undefined;
  let total = 0;
  let hasData = false;
  for (const r of rounds) {
    const s = String(r.scoreToPar ?? '').trim();
    if (!s || s === '--') continue;
    hasData = true;
    if (s === 'E') continue;
    const n = parseInt(s, 10);
    if (!isNaN(n)) total += n;
  }
  if (!hasData) return undefined;
  return total === 0 ? 'E' : total > 0 ? `+${total}` : String(total);
}

// ── Odds ──────────────────────────────────────────────────────────────────

// Odds lock at 8 AM Central on the Monday of tournament week.
function oddsLockAt(meta: TournamentMeta) {
  return Date.parse(`${meta.startDate}T13:00:00Z`) - 3 * 24 * 60 * 60 * 1000;
}

const TOURNAMENT_ODDS_PAGES: Record<string, string> = {
  players: 'https://www.oddschecker.com/us/golf/the-players-championship/winner',
  masters: 'https://www.oddschecker.com/us/golf/the-masters/winner',
  pga: 'https://www.oddschecker.com/us/golf/pga-championship/winner',
  'us-open': 'https://www.oddschecker.com/us/golf/us-open/winner',
  open: 'https://www.oddschecker.com/us/golf/the-open-championship/winner',
};

const LOCKED_ODDS_KEY = 'locked-odds';

type OddsRow = { canonicalName: string; odds: string };
type LockedOddsSnapshot = { fetchedAt: string; lockedAt: string; players: OddsRow[] };

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlToLines(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const blockBreaks = withoutScripts.replace(
    /<\/(tr|table|thead|tbody|p|div|li|ul|ol|section|article|header|footer|h1|h2|h3|h4|h5|br)>/gi,
    '\n',
  );
  return decodeHtml(blockBreaks)
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractWinnerSection(lines: string[]) {
  const winnerIndex = lines.findIndex((line) => line === 'Winner');
  if (winnerIndex < 0) return lines;
  const endIndex = lines.findIndex(
    (line, index) =>
      index > winnerIndex &&
      (line === 'Top 10 Finish' ||
        line === 'Top 5 Finish' ||
        line === 'Top 20 Finish' ||
        line === '1st Round Leader' ||
        line === 'Compare All Odds' ||
        line === 'Picks' ||
        line === 'More Insights'),
  );
  return lines.slice(winnerIndex, endIndex > winnerIndex ? endIndex : undefined);
}

function extractOddsFromSection(lines: string[], watchedPlayers: string[]): OddsRow[] {
  const americanOddsPattern = /^[+-]\d{2,5}$/;
  const section = extractWinnerSection(lines);
  const players: OddsRow[] = [];
  for (const watchedPlayer of watchedPlayers) {
    const normalized = normName(watchedPlayer);
    const playerIndex = section.findIndex((line) => normName(line) === normalized);
    if (playerIndex < 0) continue;
    let foundOdds: string | null = null;
    for (let i = playerIndex + 1; i <= Math.min(playerIndex + 4, section.length - 1); i++) {
      if (americanOddsPattern.test(section[i])) { foundOdds = section[i]; break; }
    }
    if (!foundOdds) continue;
    players.push({ canonicalName: watchedPlayer, odds: foundOdds });
  }
  return players;
}

async function readLockedOddsStore(): Promise<Record<string, LockedOddsSnapshot>> {
  const raw = await redis.get(LOCKED_ODDS_KEY);
  return raw ? (JSON.parse(raw) as Record<string, LockedOddsSnapshot>) : {};
}

async function saveLockedOddsSnapshot(tournamentId: string, snapshot: LockedOddsSnapshot) {
  const store = await readLockedOddsStore();
  store[tournamentId] = snapshot;
  await redis.set(LOCKED_ODDS_KEY, JSON.stringify(store));
}

async function getOdds(
  tournamentId: string,
  watchedPlayers: string[],
  meta: TournamentMeta,
): Promise<{ source: string; players: OddsRow[] }> {
  const lockedAt = new Date(oddsLockAt(meta)).toISOString();
  const shouldLock = Date.now() >= oddsLockAt(meta);

  if (shouldLock) {
    const store = await readLockedOddsStore();
    const snap = store[tournamentId];
    if (snap) return { source: `Locked Monday odds (${snap.lockedAt})`, players: snap.players };
  }

  const oddsPageUrl = TOURNAMENT_ODDS_PAGES[tournamentId];
  let live: { source: string; players: OddsRow[] } = { source: 'no odds page configured', players: [] };

  if (oddsPageUrl) {
    try {
      const res = await fetch(oddsPageUrl, {
        cache: 'no-store',
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });
      if (res.ok) {
        const ps = extractOddsFromSection(htmlToLines(await res.text()), watchedPlayers);
        live = { source: ps.length ? 'Oddschecker scrape' : 'odds fallback (no matches)', players: ps };
      } else {
        live = { source: `odds fallback (${res.status})`, players: [] };
      }
    } catch {
      live = { source: 'odds fallback (fetch error)', players: [] };
    }
  }

  if (shouldLock && live.players.length) {
    await saveLockedOddsSnapshot(tournamentId, {
      fetchedAt: new Date().toISOString(),
      lockedAt,
      players: live.players,
    });
    return { source: `Locked Monday odds (${lockedAt})`, players: live.players };
  }

  return live;
}

// ── Synthetic round builder ───────────────────────────────────────────────

function buildSyntheticRounds(statLine: {
  par: number; birdie: number; eagle: number; albatross: number;
  holeInOne: number; bogey: number; doubleBogey: number; tripleOrWorse: number;
  numRounds?: number;
}): import('@/app/lib/scoring').ScorecardRound[] {
  type Hole = { par: number; score: number };
  const numRounds = statLine.numRounds ?? 4;
  const buckets: Hole[][] = Array.from({ length: numRounds }, () => []);
  let nextExtra = 0;

  const distribute = (count: number, parVal: number, scoreVal: number) => {
    const base = Math.floor(count / numRounds);
    const extras = count % numRounds;
    for (let r = 0; r < numRounds; r++) {
      let isExtra = false;
      for (let e = 0; e < extras; e++) {
        if (r === (nextExtra + e) % numRounds) { isExtra = true; break; }
      }
      const n = base + (isExtra ? 1 : 0);
      for (let i = 0; i < n; i++) buckets[r].push({ par: parVal, score: scoreVal });
    }
    nextExtra = (nextExtra + extras) % numRounds;
  };

  distribute(statLine.holeInOne, 3, 1);
  distribute(statLine.albatross, 5, 2);
  distribute(statLine.eagle, 5, 3);
  distribute(statLine.birdie, 4, 3);
  distribute(statLine.par, 4, 4);
  distribute(statLine.bogey, 4, 5);
  distribute(statLine.doubleBogey, 4, 6);
  distribute(statLine.tripleOrWorse, 4, 7);

  return buckets.map((bucket, r) => {
    while (bucket.length < 18) bucket.push({ par: 4, score: 4 });
    const under = bucket.filter((h) => h.score < h.par);
    const other = bucket.filter((h) => h.score >= h.par);
    const seq: Hole[] = [];
    let ui = 0, oi = 0;
    while (ui < under.length || oi < other.length) {
      if (ui < under.length) seq.push(under[ui++]);
      if (oi < other.length) seq.push(other[oi++]);
    }
    return {
      roundId: r + 1,
      holes: seq.slice(0, 18).map((h, i) => ({ holeNumber: i + 1, par: h.par, score: h.score })),
    };
  });
}

// ── Main handler ──────────────────────────────────────────────────────────

// Vercel edge cache: every pool member polls this route every 60s, and each origin hit reads
// the full leaderboard + scorecard blobs from Redis. Letting the CDN serve it for 25s collapses
// all concurrent viewers into ~2 Redis reads/minute per tournament (cron refreshes every 2 min,
// so 25s of staleness is invisible).
const EDGE_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=25, stale-while-revalidate=120' };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? 'pga';
  const current = currentTournamentMeta(tournamentId);

  if (!current) {
    return Response.json({ error: 'Unknown tournament id.' }, { status: 400 });
  }

  // ── 1. Read leaderboard from Redis (cron keeps it fresh) ──────────────
  const [cached, liveSeason] = await Promise.all([readLeaderboardCache(tournamentId), getLiveSeason(tournamentId)]);
  // The stored data is last season's until the cron rolls this tournament over (Monday of the new
  // event's week), so its par and odds come from that season.
  const dataSeason = liveSeason?.season ?? (cached ? 2026 : Number(current.year));
  const meta: TournamentMeta = getTournamentMeta(tournamentId, dataSeason) ?? current;

  if (!cached) {
    return Response.json({
      source: 'loading',
      oddsSource: 'no odds page configured',
      tournamentId,
      status: 'Loading…',
      projectedCut: null,
      fetchedAt: new Date().toISOString(),
      players: [],
      odds: [],
    }, { headers: EDGE_CACHE_HEADERS });
  }

  if (cached.notStarted) {
    return Response.json({
      source: 'not-started',
      oddsSource: 'no odds page configured',
      tournamentId,
      status: 'Not Started',
      projectedCut: null,
      fetchedAt: cached.cachedAt,
      players: [],
      odds: [],
    }, { headers: EDGE_CACHE_HEADERS });
  }

  const rows = cached.leaderboard;
  const currentRound = cached.currentRound;
  const roundStatus = cached.roundStatus;
  const projectedCut = cached.projectedCut;

  // ── 2. Load scoring support data (all from Redis) ─────────────────────
  const [scorecardCache, roundLeaderStore, lowRoundStore, statOverrides, dynamicPool] = await Promise.all([
    getScorecardCache(tournamentId),
    getRoundLeaderStore(),
    getLowRoundStore(),
    getStatOverrides(),
    getDynamicPlayers().catch(() => []),
  ]);

  const tournamentLowRound = getTournamentLowRoundScore(tournamentId, lowRoundStore);
  // Full-field bonus achievements with round attribution (same definitions as lib/scoring) —
  // powers the Bonus Points popup's info icons crediting players not picked in the pool.
  const fieldBonusEvents: Record<string, { name: string; rounds: number[]; count?: number }[]> = {
    lowRound: [], threeBirdieStreaks: [], bogeyFreeRounds: [], eagles: [], holeInOne: [], albatross: [],
  };
  if (scorecardCache) {
    for (const p of Object.values(scorecardCache.players)) {
      const byCat: Record<string, Set<number>> = { lowRound: new Set(), threeBirdieStreaks: new Set(), bogeyFreeRounds: new Set(), eagles: new Set(), holeInOne: new Set(), albatross: new Set() };
      const catCounts: Record<string, number> = { lowRound: 0, threeBirdieStreaks: 0, bogeyFreeRounds: 0, eagles: 0, holeInOne: 0, albatross: 0 };
      for (const rnd of p.rounds) {
        if (!rnd.holes.length) continue;
        let consecutiveBirdies = 0;
        let bogeyFree = true;
        let total = 0;
        for (const hole of rnd.holes) {
          const diff = hole.score - hole.par;
          total += hole.score;
          if (hole.score === 1) { byCat.holeInOne.add(rnd.roundId); catCounts.holeInOne++; }
          else if (diff <= -3) { byCat.albatross.add(rnd.roundId); catCounts.albatross++; }
          else if (diff === -2) { byCat.eagles.add(rnd.roundId); catCounts.eagles++; }
          if (diff >= 1) bogeyFree = false;
          // 3-birdie streak: non-overlapping, resets after awarding (matches lib/scoring)
          if (diff === -1) {
            consecutiveBirdies++;
            if (consecutiveBirdies === 3) { byCat.threeBirdieStreaks.add(rnd.roundId); catCounts.threeBirdieStreaks++; consecutiveBirdies = 0; }
          } else {
            consecutiveBirdies = 0;
          }
        }
        if (bogeyFree && rnd.holes.length === 18) { byCat.bogeyFreeRounds.add(rnd.roundId); catCounts.bogeyFreeRounds++; }
        if (rnd.holes.length === 18 && tournamentLowRound !== null && total === tournamentLowRound) { byCat.lowRound.add(rnd.roundId); catCounts.lowRound++; }
      }
      for (const [cat, set] of Object.entries(byCat)) {
        if (set.size) fieldBonusEvents[cat].push({ name: p.playerName, rounds: Array.from(set).sort((a, b) => a - b), count: catCounts[cat] });
      }
    }
  }
  // Round leaders (from the awarded store) — same shape, one entry per leader per round.
  {
    const rlRounds = roundLeaderStore[tournamentId] ?? {};
    for (const rk of ['1', '2', '3'] as const) {
      fieldBonusEvents[`round${rk}Leader`] = (rlRounds[rk]?.leaders ?? []).map((n) => ({ name: n, rounds: [parseInt(rk, 10)], count: 1 }));
    }
  }

  // ── 3. Build scored player list ───────────────────────────────────────
  // Combine the static draft pool with any dynamically-added field players (from the commissioner's
  // Full Tournament Field / salary uploads) so THEY appear on the leaderboard with live scores too,
  // and so the tiebreak's winner auto-detection works even for a surprise champion. Static entries win
  // on a name collision (they carry richer data); dynamic-only names are appended.
  const staticNames = new Set(PLAYER_POOL_WITH_PGA_IDS.map((p) => normName(p.name)));
  const combinedPool = [
    ...PLAYER_POOL_WITH_PGA_IDS,
    ...dynamicPool.filter((d) => d?.name && !staticNames.has(normName(d.name))),
  ];
  const poolByName = new Map(combinedPool.map((p) => [normName(p.name), p]));
  const watchedPlayerNames = combinedPool.map((p) => p.name);

  // Accent-insensitive index of this tournament's WD/DQ/MDF overrides: normName strips accents/case
  // (and periods), so a commissioner entry of "Ludvig Aberg" matches the pool's "Ludvig Åberg" etc.
  const overridesByNormName = new Map<string, StatOverrideEntry>();
  for (const [key, ov] of Object.entries(statOverrides)) {
    const prefix = `${tournamentId}:`;
    if (key.startsWith(prefix)) overridesByNormName.set(normName(key.slice(prefix.length)), ov);
  }
  const getOverrideFor = (playerName: string) => overridesByNormName.get(normName(playerName));

  const players = rows
    .map((row) => {
      const fullName = `${row.firstName} ${row.lastName}`;
      const poolPlayer = poolByName.get(normName(fullName));
      if (!poolPlayer) return null;

      const score = normalizeScore(row);
      const position = normalizePosition(row);
      const thru = normalizeThru(row);
      const total = normalizeTotalStrokes(row);

      const latestRound = (row.rounds ?? []).reduce<SlashGolfLeaderboardRow['rounds'][0] | null>(
        (best, r) => best === null || parseMongo(r.roundId) > parseMongo(best.roundId) ? r : best,
        null,
      );

      // Compute per-round score from scorecard hole data (accurate for in-progress rounds).
      // ESPN's scoreToPar can reflect the cumulative tournament score rather than the round score.
      const storedRoundsForPlayer = scorecardCache?.players[row.playerId]?.rounds ?? [];
      const storedCurrentRound = storedRoundsForPlayer.find((r) => r.roundId === currentRound);
      let currentRoundScore: string | null;
      if (storedCurrentRound && storedCurrentRound.holes.length > 0) {
        const toPar = storedCurrentRound.holes.reduce((sum, h) => sum + h.score - h.par, 0);
        currentRoundScore = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : String(toPar);
      } else {
        currentRoundScore = latestRound?.scoreToPar ?? null;
      }

      // Detect back-nine start: first hole played in the current round is hole 10+
      const backNineStart = storedCurrentRound && storedCurrentRound.holes.length > 0
        ? storedCurrentRound.holes[0].holeNumber >= 10
        : false;

      const roundLeadersAwarded = getRoundLeadersAwarded(tournamentId, fullName, roundLeaderStore);

      const override = getOverrideFor(poolPlayer.name);

      let scoreBreakdown;
      let scoringRounds: import('@/app/lib/scoring').ScorecardRound[] = [];
      if (override) {
        const isCutOverride = ['CUT', 'WD', 'DQ', 'MDF'].includes(override.position.toUpperCase());
        if (isCutOverride) {
          // For WD/DQ/CUT/MDF overrides, use real scorecard data for stats so hole-level
          // accuracy is preserved; only the position/thru come from the override.
          const storedScorecard = scorecardCache?.players[row.playerId];
          scoringRounds = storedScorecard?.rounds ?? [];
          const cutScore = override.position.toUpperCase();
          scoreBreakdown = scoringRounds.length > 0
            ? computeFullScoreBreakdown({ position: override.position, score: cutScore, thru: override.thru, rounds: scoringRounds, roundLeadersAwarded, tournamentLowRoundScore: tournamentLowRound, currentRound })
            : buildPlaceholderScoreBreakdown({ position: override.position, score: cutScore, thru: override.thru, currentRound });
        } else {
          scoringRounds = buildSyntheticRounds(override.statLine);
          scoreBreakdown = computeFullScoreBreakdown({
            position: override.position,
            score,
            thru: override.thru,
            rounds: scoringRounds,
            roundLeadersAwarded,
            tournamentLowRoundScore: tournamentLowRound,
            currentRound,
          });
        }
      } else {
        const storedScorecard = scorecardCache?.players[row.playerId];
        scoringRounds = storedScorecard?.rounds ?? [];
        scoreBreakdown =
          scoringRounds.length > 0
            ? computeFullScoreBreakdown({ position, score, thru, rounds: scoringRounds, roundLeadersAwarded, tournamentLowRoundScore: tournamentLowRound, currentRound })
            : buildPlaceholderScoreBreakdown({ position, score, thru, currentRound });
      }

      const lowRoundIds = tournamentLowRound !== null
        ? scoringRounds
            .filter(r => r.holes.length === 18 && r.holes.reduce((s, h) => s + h.score, 0) === tournamentLowRound)
            .map(r => r.roundId)
        : [];

      const teeTime = (row.teeTime as string | null) ?? null;
      const originalScore = computeOriginalScore(row);
      const CUT_STATUSES_SET = new Set(['CUT', 'WD', 'DQ', 'MDF']);
      const effectiveScore = override?.position && CUT_STATUSES_SET.has(override.position.toUpperCase()) ? override.position.toUpperCase() : score;
      return { position: override?.position ?? position, score: effectiveScore, thru: override?.thru ?? thru, total, currentRoundScore, backNineStart, teeTime, canonicalName: poolPlayer.name, scoreBreakdown, lowRoundIds, originalScore };
    })
    .filter(Boolean);

  // ── 3b. Inject stat-override players absent from API rows ─────────────
  {
    const playersInApi = new Set<string>(players.map((p) => normName(p!.canonicalName)));
    const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF']);
    for (const [key, override] of Object.entries(statOverrides)) {
      const prefix = `${tournamentId}:`;
      if (!key.startsWith(prefix)) continue;
      const playerName = key.slice(prefix.length);
      // Accent/case-insensitive match so "Ludvig Aberg" resolves to the pool's "Ludvig Åberg".
      if (playersInApi.has(normName(playerName))) continue;
      const poolPlayer = combinedPool.find((p) => normName(p.name) === normName(playerName));
      if (!poolPlayer) continue;
      const inferredScore = CUT_STATUSES.has(override.position.toUpperCase())
        ? override.position.toUpperCase()
        : 'E';
      const roundLeadersAwarded = getRoundLeadersAwarded(tournamentId, playerName, roundLeaderStore);
      const overrideScoringRounds = buildSyntheticRounds(override.statLine);
      const scoreBreakdown = computeFullScoreBreakdown({
        position: override.position,
        score: inferredScore,
        thru: override.thru,
        rounds: overrideScoringRounds,
        roundLeadersAwarded,
        tournamentLowRoundScore: tournamentLowRound,
        currentRound,
      });
      const lowRoundIds = tournamentLowRound !== null
        ? overrideScoringRounds
            .filter(r => r.holes.length === 18 && r.holes.reduce((s, h) => s + h.score, 0) === tournamentLowRound)
            .map(r => r.roundId)
        : [];
      players.push({ position: override.position, score: inferredScore, thru: override.thru, total: '--', currentRoundScore: null, backNineStart: false, teeTime: null, canonicalName: poolPlayer.name, scoreBreakdown, lowRoundIds, originalScore: undefined });
    }
  }

  // ── 4. Odds ───────────────────────────────────────────────────────────
  const odds = await getOdds(tournamentId, watchedPlayerNames, meta);

  // ── 5. Full field (all players in the cached leaderboard, not just pool) ──
  const fullField = searchParams.get('fullField') === 'true';
  const CUT_STATUSES_FULL = new Set(['CUT', 'WD', 'DQ', 'MDF']);
  const fullLeaderboard = fullField
    ? rows.map((row) => {
        const fullName = `${row.firstName} ${row.lastName}`;
        const poolPlayer = poolByName.get(normName(fullName));
        const rndEntry = (row.rounds ?? []).find((r) => r.roundId === currentRound);
        const storedRound = (scorecardCache?.players[String(row.playerId ?? '')]?.rounds ?? []).find((r) => r.roundId === currentRound);
        const backNineStart = storedRound && storedRound.holes.length > 0
          ? storedRound.holes[0].holeNumber >= 10
          : false;
        const baseScore = normalizeScore(row);
        const override = poolPlayer ? getOverrideFor(poolPlayer.name) : undefined;
        const effectiveScore = override?.position && CUT_STATUSES_FULL.has(override.position.toUpperCase())
          ? override.position.toUpperCase()
          : baseScore;
        const effectivePosition = override?.position && CUT_STATUSES_FULL.has(override.position.toUpperCase())
          ? override.position.toUpperCase()
          : normalizePosition(row);
        return {
          playerId: String(row.playerId ?? ''),
          poolPlayerId: poolPlayer?.id ?? null,
          name: fullName,
          position: effectivePosition,
          score: effectiveScore,
          thru: normalizeThru(row),
          originalScore: computeOriginalScore(row),
          currentRoundScore: rndEntry?.scoreToPar ?? null,
          teeTime: (row.teeTime as string | null) ?? null,
          backNineStart,
        };
      })
    : undefined;

  return Response.json({
    source: 'cache',
    cachedAt: cached.cachedAt,
    oddsSource: odds.source,
    tournamentId,
    status: roundStatus || 'Status unavailable',
    currentRound,
    projectedCut,
    tournamentComplete: cached.tournamentComplete ?? false,
    tournamentLowRoundScore: tournamentLowRound,
    fieldBonusEvents,
    coursePar: meta.par,
    season: dataSeason,
    espnEventId: meta.espnEventId ?? (await espnEventIdFor(tournamentId, dataSeason)),
    fetchedAt: new Date().toISOString(),
    players,
    odds: odds.players,
    ...(fullLeaderboard ? { fullLeaderboard } : {}),
  }, { headers: EDGE_CACHE_HEADERS });
}
