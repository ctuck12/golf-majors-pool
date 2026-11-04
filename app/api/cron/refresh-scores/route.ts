export const dynamic = 'force-dynamic';

import { parseMongo, type SlashGolfLeaderboardRow } from '@/app/lib/slashgolf';
import { fetchESPNTournament } from '@/app/lib/espn';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import { getLockTimeOverrides } from '@/app/lib/lock-time-store';
import {
  getScorecardCache,
  saveScorecardCache,
  mergeScorecardCache,
  saveRoundLeader,
  getLowRoundStore,
  saveLowRound,
  readLeaderboardCache,
  writeLeaderboardCache,
  type StoredPlayerScorecards,
} from '@/app/lib/scorecard-store';
import {
  autoLockPoolLineup,
  TOURNAMENT_IDS,
  type TournamentId,
} from '@/app/lib/pool-store';
import redis from '@/app/lib/redis';


// ── Field parsing (same helpers as before) ────────────────────────────────

// Golf holes are always par 3, 4, or 5. ESPN occasionally returns the player's
// score in the par field (e.g. an 8 on a par-4 becomes par=8). This function
// uses cross-player consensus to detect and correct those bad values.
function fixParValues(players: Record<string, StoredPlayerScorecards>): void {
  // Count valid par occurrences per (roundId:holeNumber)
  const consensus = new Map<string, Map<number, number>>();
  for (const player of Object.values(players)) {
    for (const round of player.rounds) {
      for (const hole of round.holes) {
        if (hole.par >= 3 && hole.par <= 5) {
          const key = `${round.roundId}:${hole.holeNumber}`;
          const counts = consensus.get(key) ?? new Map<number, number>();
          counts.set(hole.par, (counts.get(hole.par) ?? 0) + 1);
          consensus.set(key, counts);
        }
      }
    }
  }
  // Replace any out-of-range par with the most-voted valid par
  for (const player of Object.values(players)) {
    for (const round of player.rounds) {
      for (const hole of round.holes) {
        if (hole.par < 3 || hole.par > 5) {
          const key = `${round.roundId}:${hole.holeNumber}`;
          const counts = consensus.get(key);
          let corrected = 4;
          if (counts) {
            let best = 0;
            for (const [par, cnt] of counts) {
              if (cnt > best) { best = cnt; corrected = par; }
            }
          }
          hole.par = corrected;
        }
      }
    }
  }
}

function normalizePosition(row: SlashGolfLeaderboardRow): string {
  return String(row.position ?? '--');
}

function getRoundStrokes(row: SlashGolfLeaderboardRow, roundNum: number): number | null {
  const rnd = row.rounds?.find((r) => parseMongo(r.roundId) === roundNum);
  if (!rnd) return null;
  const s = parseMongo(rnd.strokes);
  return s > 0 ? s : null;
}

function isRoundComplete(roundStatus: string): boolean {
  const s = roundStatus.toLowerCase();
  return s === 'complete' || s === 'official' || s === 'final';
}

// Cut positions: number of players who make the cut (top N + ties)
const ESPN_CUT_POSITIONS: Partial<Record<string, number>> = {
  players: 65,
  masters: 50,
  pga: 70,
  'us-open': 60,
  open: 70,
};

const EXPLICIT_CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);

function parseScoreToNum(s: string | undefined): number {
  if (!s || s === '--') return 999;
  if (s === 'E') return 0;
  const n = parseInt(String(s), 10);
  return isNaN(n) ? 999 : n;
}

function computeProjectedCutFromRows(tournamentId: string, rows: SlashGolfLeaderboardRow[], currentRound: number): string | null {
  if (currentRound !== 2) return null; // only meaningful during R2
  const cutPos = ESPN_CUT_POSITIONS[tournamentId];
  if (!cutPos) return null;
  const active = rows
    .filter(r => !EXPLICIT_CUT_STATUSES.has((r.total ?? '').toUpperCase()) && r.total && r.total !== '--')
    .sort((a, b) => parseScoreToNum(a.total) - parseScoreToNum(b.total));
  if (active.length < cutPos) return null;
  return active[cutPos - 1]?.total ?? null;
}

// ESPN does not always set competitor.score = 'CUT' after round 2 — they may leave numeric scores
// on cut players. When round 2 is official and no cut players are already flagged, derive the cut
// from score order using the configured cut positions (top N + ties).
function applyEspnCutStatuses(
  tournamentId: string,
  rows: SlashGolfLeaderboardRow[],
  currentRound: number,
  roundComplete: boolean,
): SlashGolfLeaderboardRow[] {
  // Apply whenever round 2 is definitively complete: either we're on round 2 Official,
  // or we've advanced past round 2 (missed-round recovery and live round 3+).
  const round2Complete = (currentRound === 2 && roundComplete) || currentRound > 2;
  if (!round2Complete) return rows;
  const cutPos = ESPN_CUT_POSITIONS[tournamentId];
  if (!cutPos) return rows;

  // If ESPN already explicitly flagged some players as CUT/MDF, trust their data
  const hasCutPlayers = rows.some(r =>
    r.status?.toLowerCase() === 'cut' || r.status?.toLowerCase() === 'mdf' ||
    EXPLICIT_CUT_STATUSES.has((r.total ?? '').toUpperCase()),
  );
  if (hasCutPlayers) return rows;

  // In round 3+, a player's running total includes round 3 strokes — using it would incorrectly
  // mark active players having a bad round as CUT. Use their 36-hole (rounds 1+2) score instead.
  function get36HoleScore(r: SlashGolfLeaderboardRow): number {
    if (currentRound > 2) {
      const rounds12 = (r.rounds ?? []).filter(rnd => {
        const id = parseMongo(rnd.roundId);
        return id === 1 || id === 2;
      });
      if (rounds12.length === 2) {
        return rounds12.reduce((sum, rnd) => {
          const s = rnd.scoreToPar;
          if (!s || s === 'E') return sum;
          const n = parseInt(s, 10);
          return sum + (isNaN(n) ? 0 : n);
        }, 0);
      }
    }
    return parseScoreToNum(r.total);
  }

  // Sort eligible players (exclude WD/DQ) by 36-hole score to find the cut line
  const WITHDRAW_STATUSES = new Set(['WD', 'DQ']);
  const eligible = rows
    .filter(r => !WITHDRAW_STATUSES.has((r.status ?? '').toUpperCase()) && !WITHDRAW_STATUSES.has((r.total ?? '').toUpperCase()))
    .sort((a, b) => get36HoleScore(a) - get36HoleScore(b));

  if (eligible.length <= cutPos) return rows; // Field smaller than cut position — no cut

  // The cut line is the score at position cutPos (0-indexed: cutPos - 1).
  // "Top N and ties" means all players AT that score make it; only strictly worse scores miss.
  const cutScore = get36HoleScore(eligible[cutPos - 1]);

  return rows.map(r => {
    // Don't override explicit WD/DQ statuses
    if (WITHDRAW_STATUSES.has((r.status ?? '').toUpperCase()) || WITHDRAW_STATUSES.has((r.total ?? '').toUpperCase())) return r;
    if (get36HoleScore(r) > cutScore) {
      return { ...r, status: 'cut', position: 'CUT' };
    }
    return r;
  });
}

// ── Scorecard refresh helpers ─────────────────────────────────────────────

async function captureLowRound(
  tournamentId: string,
  roundId: number,
  rows: SlashGolfLeaderboardRow[],
) {
  // Require >= 58 strokes — no valid 18-hole round can be lower; partial-round data often isn't.
  const scores = rows
    .map((r) => getRoundStrokes(r, roundId))
    .filter((s): s is number => s !== null && s >= 58);
  if (scores.length) await saveLowRound(tournamentId, roundId, Math.min(...scores));
}

// During a live round, update the low round from players who have already finished.
// This lets "Tourn Low Round" points reflect the current best score in real time
// rather than waiting for the entire field to complete the round.
async function captureLiveLowRound(
  tournamentId: string,
  roundId: number,
  rows: SlashGolfLeaderboardRow[],
) {
  const finishedRows = rows.filter(r => String(r.thru ?? '').trim() === 'F');
  if (!finishedRows.length) return;
  const scores = finishedRows
    .map(r => getRoundStrokes(r, roundId))
    .filter((s): s is number => s !== null && s >= 58);
  if (scores.length) await saveLowRound(tournamentId, roundId, Math.min(...scores));
}

async function captureRoundLeader(
  tournamentId: string,
  roundId: number,
  rows: SlashGolfLeaderboardRow[],
) {
  const leaders = rows.filter((r) => {
    const pos = normalizePosition(r);
    return pos === '1' || pos === 'T1';
  });
  if (!leaders.length) return;
  const names = leaders.map((r) => `${r.firstName} ${r.lastName}`);
  const leadScore = Number(String(leaders[0].total ?? '0').replace('+', '')) || 0;
  await saveRoundLeader(tournamentId, roundId, names, leadScore);
}

// ── Per-tournament refresh ────────────────────────────────────────────────

async function markTournamentComplete(
  tournamentId: string,
  existing: Awaited<ReturnType<typeof readLeaderboardCache>>,
  rows: SlashGolfLeaderboardRow[],
  currentRound: number,
  roundStatus: string,
  projectedCut: string | null,
): Promise<void> {
  await writeLeaderboardCache(tournamentId, {
    cachedAt: existing?.cachedAt ?? new Date().toISOString(),
    leaderboard: rows,
    currentRound,
    roundStatus,
    projectedCut,
    tournamentComplete: true,
  });
}

// Lock picks as soon as any player has a score on the board (thru !== '--').
// autoLockPoolLineup is idempotent — safe to call on every cron tick.
async function autoLockOnFirstScore(
  tournamentId: string,
  rows: SlashGolfLeaderboardRow[],
): Promise<void> {
  if (!TOURNAMENT_IDS.includes(tournamentId as TournamentId)) return;
  const anyStarted = rows.some(r => {
    const thru = String(r.thru ?? '').trim();
    return thru !== '--' && thru !== '';
  });
  if (anyStarted) await autoLockPoolLineup(tournamentId as TournamentId);
}

async function refreshTournamentFromESPN(
  tournamentId: string,
  espnEventId: string,
  existing: Awaited<ReturnType<typeof readLeaderboardCache>>,
): Promise<string> {
  let espnResult: Awaited<ReturnType<typeof fetchESPNTournament>>;
  try {
    espnResult = await fetchESPNTournament(espnEventId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('400')) {
      // Only write notStarted if we have no existing leaderboard data — a 400 between rounds
      // (ESPN doesn't include the event on that date) must not wipe already-fetched round data.
      const hasExistingData = (existing?.leaderboard?.length ?? 0) > 0;
      if (!hasExistingData) {
        await writeLeaderboardCache(tournamentId, {
          cachedAt: new Date().toISOString(),
          leaderboard: [],
          currentRound: 0,
          roundStatus: '',
          projectedCut: null,
          notStarted: true,
        });
        return 'not-started';
      }
      return 'espn-400-preserved-cache';
    }
    throw err;
  }

  const { currentRound, roundStatus, playerScorecards, eventComplete } = espnResult;
  const roundComplete = isRoundComplete(roundStatus);
  // Apply cut statuses when ESPN hasn't flagged them explicitly (ESPN keeps numeric scores on cut players)
  const rows = applyEspnCutStatuses(tournamentId, espnResult.leaderboardRows, currentRound, roundComplete);

  // Lock picks the moment any player has a score — fires once, idempotent thereafter
  await autoLockOnFirstScore(tournamentId, rows);
  // For rounds 3+, projectedCut is the actual cut score from round 2 — preserve it from the cache
  const projectedCut = computeProjectedCutFromRows(tournamentId, rows, currentRound) ?? existing?.projectedCut ?? null;

  await writeLeaderboardCache(tournamentId, {
    cachedAt: new Date().toISOString(),
    leaderboard: rows,
    currentRound,
    roundStatus,
    projectedCut,
  });

  const [scorecardCache, lowRoundStore] = await Promise.all([
    getScorecardCache(tournamentId),
    getLowRoundStore(),
  ]);

  const lastCompleted = scorecardCache?.lastCompletedRound ?? 0;
  const needsFullRefresh = roundComplete && lastCompleted < currentRound;

  if (needsFullRefresh) {
    await captureLowRound(tournamentId, currentRound, rows);
    if (currentRound <= 3) await captureRoundLeader(tournamentId, currentRound, rows);

    // Backfill low rounds from current data (ESPN has all round strokes in one response)
    for (let rndId = 1; rndId < currentRound; rndId++) {
      if (!lowRoundStore[tournamentId]?.[String(rndId)]) {
        await captureLowRound(tournamentId, rndId, rows);
      }
    }

    // All scorecard data comes embedded in the ESPN fetch — no per-player API calls needed.
    // Merge with existing cache so WD/historical player entries (e.g. who no longer appear
    // in ESPN's live feed) are preserved and also get par corrections applied.
    const mergedComplete = { ...(scorecardCache?.players ?? {}), ...playerScorecards };
    fixParValues(mergedComplete);
    await saveScorecardCache(tournamentId, mergedComplete, currentRound);

    // Only mark the tournament permanently complete when ESPN says the whole event is
    // final (status.type.completed). currentRound>=4 alone is NOT sufficient: between
    // rounds ESPN reports state='post' (→ roundComplete) and pre-increments the period,
    // which previously tripped this and froze the tournament as "Final Results".
    if (eventComplete) {
      await markTournamentComplete(tournamentId, existing, rows, currentRound, roundStatus, projectedCut);
      return 'tournament-complete-marked';
    }

    return `round-${currentRound}-complete-refreshed`;
  }

  if (eventComplete && lastCompleted >= currentRound) {
    await markTournamentComplete(tournamentId, existing, rows, currentRound, roundStatus, projectedCut);
    return 'tournament-complete-marked';
  }

  // Missed-round recovery: if ESPN moved currentRound forward without us ever seeing
  // roundStatus='Official' for the previous round (the cron missed the brief post-round
  // window before the next round's pre-tournament state began), process it now.
  // ESPN embeds all completed round data in every response, so playerScorecards is complete.
  if (!roundComplete && currentRound > lastCompleted + 1) {
    const prevRound = currentRound - 1;
    await captureLowRound(tournamentId, prevRound, rows);
    if (prevRound <= 3) await captureRoundLeader(tournamentId, prevRound, rows);
    for (let rndId = lastCompleted + 1; rndId < prevRound; rndId++) {
      if (!lowRoundStore[tournamentId]?.[String(rndId)]) {
        await captureLowRound(tournamentId, rndId, rows);
      }
    }
    const mergedRecovered = { ...(scorecardCache?.players ?? {}), ...playerScorecards };
    fixParValues(mergedRecovered);
    await saveScorecardCache(tournamentId, mergedRecovered, prevRound);
    return `round-${prevRound}-complete-recovered`;
  }

  // Live round — merge all player scorecards from embedded ESPN data (no per-player calls)
  if (!roundComplete && Object.keys(playerScorecards).length > 0) {
    const mergedLive = { ...(scorecardCache?.players ?? {}), ...playerScorecards };
    fixParValues(mergedLive);
    await mergeScorecardCache(tournamentId, mergedLive);
    await captureLiveLowRound(tournamentId, currentRound, rows);
    if (currentRound <= 3) await captureRoundLeader(tournamentId, currentRound, rows);
    return 'live-scorecards-refreshed';
  }

  // Between rounds (roundComplete, no new data to process): still re-apply par corrections
  // to the full cached dataset so historical entries like WD players get fixed immediately.
  const mergedBetweenRounds = { ...(scorecardCache?.players ?? {}), ...playerScorecards };
  if (Object.keys(mergedBetweenRounds).length > 0) {
    fixParValues(mergedBetweenRounds);
    // Between rounds this data is static — skip the (large) rewrite when nothing changed,
    // instead of pushing an identical multi-hundred-KB blob to Redis every 2 minutes all night.
    if (JSON.stringify(mergedBetweenRounds) !== JSON.stringify(scorecardCache?.players ?? {})) {
      await saveScorecardCache(tournamentId, mergedBetweenRounds, lastCompleted);
    }
  }
  return 'leaderboard-refreshed';
}

async function refreshTournament(tournamentId: string): Promise<string> {
  const meta = TOURNAMENT_META[tournamentId];
  if (!meta) return 'unknown-tournament';

  const existing = await readLeaderboardCache(tournamentId);

  // Permanently done — skip forever, all data is in Redis. EXCEPT: self-heal a FALSE
  // completion. ESPN pre-increments the round between rounds, which previously tripped the
  // complete logic and froze a still-live tournament as "Final Results". If we're still
  // inside the event's active week, re-verify against ESPN; if the event isn't actually
  // final, fall through — the refresh below rewrites the cache without the complete flag
  // and live updates resume.
  if (existing?.tournamentComplete) {
    const lockMs = meta.lockAtUtc ? new Date(meta.lockAtUtc).getTime() : 0;
    const ACTIVE_WINDOW_MS = 8 * 24 * 60 * 60 * 1000; // ~8 days covers the full tournament week
    const withinActiveWindow = lockMs > 0 && Date.now() >= lockMs && Date.now() - lockMs < ACTIVE_WINDOW_MS;
    if (!withinActiveWindow || !meta.espnEventId) return 'tournament-complete-skipped';
    let actuallyComplete = true;
    try {
      const check = await fetchESPNTournament(meta.espnEventId);
      actuallyComplete = check.eventComplete;
    } catch {
      actuallyComplete = true; // event not on today's board / transient error → leave as complete
    }
    if (actuallyComplete) return 'tournament-complete-skipped';
    // else: stale/false completion — fall through to a normal refresh which clears the flag.
  }

  // not-started TTL handles its own backoff, UNLESS we're past the lock time —
  // then force a fresh fetch so the transition to live doesn't stall for 30 min.
  // Commissioner-set Pool Lock Time overrides the built-in lockAtUtc. Once past it, flip the
  // stored Lineup Lock immediately (idempotent) — don't wait for ESPN to show players started.
  const lockOverrides = await getLockTimeOverrides().catch((): Awaited<ReturnType<typeof getLockTimeOverrides>> => ({}));
  const lockIso = lockOverrides[tournamentId as keyof typeof lockOverrides] ?? meta.lockAtUtc;
  const pastLock = !!lockIso && Date.now() >= new Date(lockIso).getTime();
  if (pastLock) await autoLockPoolLineup(tournamentId as TournamentId).catch(() => {});

  const wasNotStarted = !!existing?.notStarted;
  if (wasNotStarted) {
    if (!pastLock) return 'not-started-cached';
    // Clear the stale notStarted entry so the fetch below proceeds cleanly.
    await redis.del(`leaderboard-cache:${tournamentId}`);
  }

  // ESPN is the only data source — one free fetch returns both the leaderboard and
  // every player's scorecards. (The paid Slash Golf/RapidAPI path was removed entirely.)
  if (!meta.espnEventId) return 'no-espn-event-id';
  return refreshTournamentFromESPN(tournamentId, meta.espnEventId, existing);
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Same rule as warm-stat-caches: Vercel cron sends `Authorization: Bearer <CRON_SECRET>` when
  // CRON_SECRET is set in the project env, so only enforce it when configured.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results: Record<string, string> = {};

  await Promise.allSettled(
    TOURNAMENT_IDS.map(async (id) => {
      try {
        results[id] = await refreshTournament(id);
      } catch (err) {
        results[id] = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }),
  );

  return Response.json({ refreshedAt: new Date().toISOString(), results });
}
