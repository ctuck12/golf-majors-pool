export const dynamic = 'force-dynamic';
export const maxDuration = 60; // a cold tournament scrambling leaderboard build can supplement ~74 cut players

import redis from '@/app/lib/redis';
import { fetchPlayerSeasonStats, fetchPlayerTournamentStats } from '@/app/lib/espn-player-stats';
import { fetchPgaTourPlayerStats } from '@/app/lib/pga-player-stats';
import type { PlayerStatRanks } from '@/app/lib/pga-player-stats';
import { fetchPgaScorecardStats, pgaTourTournId } from '@/app/lib/pga-scorecard-stats';
import { metaForEspnEvent } from '@/app/lib/espn-event-ids';
import { resolvePgaTourIdByName } from '@/app/lib/pga-id-resolver';
import { getOrBuildPgaLeaderboard, tournLbCacheKey } from '@/app/lib/tournament-sg-leaderboard';
import { resolveChangedAt } from '@/app/lib/changed-at';

export type { PlayerStats } from '@/app/lib/espn-player-stats';

function mergeStats(...sources: (Record<string, unknown> | null)[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [k, v] of Object.entries(source)) {
      if (v !== null && v !== undefined) result[k] = v;
    }
  }
  return result;
}

const RANKS_CACHE_SUFFIX = ':ranks';

// PGA Tour IDs for players whose pool name differs from PGA Tour records
const PGA_TOUR_ID_BY_NAME: Record<string, string> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const context = searchParams.get('context') ?? 'season';
  const eventId = searchParams.get('eventId') ?? '';
  const rawPgaTourId = searchParams.get('pgaTourId') ?? '';
  let pgaTourId = (rawPgaTourId && rawPgaTourId !== '0') ? rawPgaTourId : (PGA_TOUR_ID_BY_NAME[name] ?? '');

  if (!name) return Response.json({ stats: null, ranks: null });

  const isTournament = context === 'tournament' && eventId;
  // Season context: when the pool record has no PGA Tour ID (0), resolve it by name from the PGA
  // Tour player directory so SG, scrambling, and their ranks still populate. ~37 pool players
  // (Finau, Power, Eckroat, Hoge, etc.) ship with pgaTourId 0 and would otherwise lose these stats.
  if (!isTournament && !pgaTourId) {
    pgaTourId = (await resolvePgaTourIdByName(name)) ?? '';
  }
  const seasonYear = new Date().getFullYear();
  const cacheKey = isTournament
    ? `player-stats:v39:tourn:${eventId}:${name}`
    : `player-stats:v85:season:${seasonYear}:${name}`;
  const ranksCacheKey = isTournament
    ? `player-stats:v39:tourn:${eventId}:${name}${RANKS_CACHE_SUFFIX}`
    : `player-stats:v85:season:${seasonYear}:${name}${RANKS_CACHE_SUFFIX}`;
  const sigCacheKey = `${cacheKey}:sig`; // change-detection: when the displayed stats last changed
  const ttl = isTournament ? 300 : 3600;

  try {
    const cached = await redis.get(cacheKey);
    if (cached && isTournament) {
      const ranksRaw = await redis.get(ranksCacheKey);
      const ranks = ranksRaw ? JSON.parse(ranksRaw) : null;
      const statsObj = JSON.parse(cached);
      const updatedAt = await resolveChangedAt(sigCacheKey, JSON.stringify({ s: statsObj, r: ranks }));
      return Response.json({ stats: statsObj, ranks, updatedAt });
    }
    // A PGA Tour player (has pgaTourId) whose cached stats lack SG is a poisoned entry from a
    // transient PGA GQL failure. Ignore it and fall through to a fresh fetch so it self-heals,
    // rather than serving the incomplete blob (the cached path can't restore SG when stat-lb is cold).
    const cachedSeasonUsable = (() => {
      if (!cached || isTournament) return false;
      if (!pgaTourId) return true; // non-PGA player: SG legitimately absent, cache is fine
      try { return !!JSON.parse(cached).sgTotal; } catch { return false; }
    })();
    if (cachedSeasonUsable) {
      // For season context: recompute ranks from stat-lb so player card ranks match
      // popup leaderboard positions. For any stat where stat-lb is cold, fall back to
      // previously-cached ranks so a partial cron failure never leaves ranks blank.
      const LB_STAT_KEYS_EARLY = [
        'drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'birdiesPerRound',
        'scrambling', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting',
      ];
      const normNameEarly = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
      const nameLowerEarly = normNameEarly(name);
      const [lbResultsEarly, ranksRaw] = await Promise.all([
        Promise.allSettled(LB_STAT_KEYS_EARLY.map(k => redis.get(`stat-lb:v28:${k}`))),
        redis.get(ranksCacheKey).catch(() => null),
      ]);
      // Cached ranks are the fallback — only used per-key when stat-lb is genuinely cold (null).
      // When stat-lb is warm it is always authoritative; never let a stale cached rank win.
      const cachedRanks: Record<string, string> = ranksRaw ? JSON.parse(ranksRaw as string) : {};
      const LB_WINS_KEYS_EARLY = new Set(['gir', 'puttAverage', 'scrambling', 'drivingAccuracy', 'drivingDistance', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting']);
      const PERCENT_KEYS_EARLY = new Set(['gir', 'scrambling', 'drivingAccuracy']);
      const freshRanks: Record<string, string> = {};
      const cachedStats = JSON.parse(cached as string);
      for (let i = 0; i < LB_STAT_KEYS_EARLY.length; i++) {
        const result = lbResultsEarly[i];
        const key = LB_STAT_KEYS_EARLY[i];
        if (result.status !== 'fulfilled' || !result.value) {
          // stat-lb cold — use last known rank as fallback so rank doesn't disappear
          if (cachedRanks[key]) freshRanks[key] = cachedRanks[key];
          continue;
        }
        // stat-lb warm — authoritative; never fall back to cached rank for this key
        try {
          const parsed = JSON.parse(result.value as string);
          const entries: { rank: number; name: string; value?: string | number }[] = parsed.entries ?? parsed;
          const entryIndex = entries.findIndex(e => normNameEarly(e.name) === nameLowerEarly);
          // Warm but player not on this leaderboard (LIV / non-PGA-Tour player who hasn't qualified)
          // — correctly left unranked. Their stat values still come from the cached stats blob.
          if (entryIndex === -1) continue;
          const entry = entries[entryIndex];
          // Use list position (not entry.rank) — popup renders by list order, so this always matches
          freshRanks[key] = String(entryIndex + 1);
          if (LB_WINS_KEYS_EARLY.has(key) && entry.value != null) {
            const raw = String(entry.value).replace('%', '');
            if (PERCENT_KEYS_EARLY.has(key)) {
              // Round to 1 decimal so player card matches leaderboard popup display
              const num = parseFloat(raw);
              cachedStats[key] = !isNaN(num) ? `${(Math.round(num * 10) / 10).toFixed(1)}%` : `${raw}%`;
            } else {
              cachedStats[key] = raw;
            }
          }
        } catch { /* ignore */ }
      }
      const ranks = Object.keys(freshRanks).length > 0 ? freshRanks : null;
      const updatedAt = await resolveChangedAt(sigCacheKey, JSON.stringify({ s: cachedStats, r: ranks }));
      return Response.json({ stats: cachedStats, ranks, updatedAt });
    }

    if (isTournament) {
      const meta = await metaForEspnEvent(eventId);
      const pgaTournId = meta ? pgaTourTournId(meta.pgaTournCode, meta.year) : null;

      const [espnStats, scorecardResult] = await Promise.all([
        fetchPlayerTournamentStats(name, eventId),
        pgaTourId && pgaTournId ? fetchPgaScorecardStats(pgaTournId, pgaTourId) : Promise.resolve(null),
      ]);

      const pgaScorecardStats = scorecardResult?.stats ?? null;

      // Tournament stats come ONLY from per-event sources (ESPN tournament stats, the PGA
      // scorecard feed, and the per-event leaderboard caches). Season stats are deliberately
      // NOT merged in: folding them made events with no per-event data (e.g. The Open, where
      // ESPN 404s and the PGA statDetails feed is empty) silently show season numbers relabeled
      // as tournament stats. `stats` starts as an object the leaderboard applyLb can populate;
      // if it stays empty with no source we fall back to scorecard-derived stats below.
      const stats: Record<string, unknown> = (espnStats || pgaScorecardStats)
        ? mergeStats(espnStats, pgaScorecardStats)
        : {};

      // Tournament view shows ONLY tournament-sourced ranks — no season ranks bleed in. BOTH course
      // and SG ranks+values come from the per-event leaderboard caches (the EXACT data the popup
      // renders): the card uses the player's list position + the leaderboard's value, so the card can
      // never disagree with the popup — mirroring how season works.
      //
      // SG is read from the same leaderboard as course (NOT the per-player scorecard) on purpose: the
      // scorecard's SG figure and the leaderboard's per-round "Avg" don't reconcile, which made the
      // card show a different SG rank+value than the popup. Single source = guaranteed match.
      // ESPN-sourced course stats (cache-only read). Scrambling is NOT here — ESPN has no scrambling
      // field, so it comes from the PGA feed on demand alongside SG (see TOURN_PGA_KEYS below).
      const TOURN_COURSE_KEYS = ['drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage'];
      const TOURN_PGA_KEYS = ['sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting', 'scrambling'];
      const normNameT = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
      const nameLowerT = normNameT(name);
      const mergedRanks: Record<string, string> = {};

      const applyLb = (key: string, entries: Array<{ name: string; value?: string; rank?: number }>) => {
        const idx = entries.findIndex(e => normNameT(e.name) === nameLowerT);
        if (idx === -1) return;
        // Use the entry's rank field (the number the popup displays) so tied ranks (e.g. 2,2,4) match
        // exactly; fall back to list position for course leaderboards built without ties.
        mergedRanks[key] = String(entries[idx].rank ?? (idx + 1));
        if (entries[idx].value != null) stats[key] = entries[idx].value; // leaderboard value (popup precision)
      };

      // COURSE: read the per-event leaderboard caches (warmed by the cron; same source as the card's
      // ESPN stats, so values agree even when momentarily cold).
      const tournCourseLb = await Promise.allSettled(
        TOURN_COURSE_KEYS.map(k => redis.get(tournLbCacheKey(eventId, k)))
      );
      for (let i = 0; i < TOURN_COURSE_KEYS.length; i++) {
        const r = tournCourseLb[i];
        if (r.status !== 'fulfilled' || !r.value) continue;
        try { applyLb(TOURN_COURSE_KEYS[i], JSON.parse(r.value as string).entries ?? []); } catch { /* ignore */ }
      }

      // PGA-sourced stats (SG + scrambling): build on demand when cold (one cheap GraphQL call each).
      // The card MUST come from this leaderboard — the per-player scorecard figures don't match the popup.
      const pgaLbs = await Promise.all(TOURN_PGA_KEYS.map(k => getOrBuildPgaLeaderboard(eventId, k).catch(() => null)));
      for (let i = 0; i < TOURN_PGA_KEYS.length; i++) {
        const lb = pgaLbs[i];
        if (lb?.entries?.length) applyLb(TOURN_PGA_KEYS[i], lb.entries);
      }

      // Serve null (not an empty object) when no per-event source produced anything, so the
      // client shows "no tournament stats" rather than a blank card of season leftovers.
      const finalStats = Object.keys(stats).length > 0 ? stats : null;
      if (finalStats) {
        await redis.setex(cacheKey, ttl, JSON.stringify(finalStats));
      }
      const tournRanksToCache = Object.keys(mergedRanks).length > 0 ? mergedRanks : null;
      if (tournRanksToCache) {
        await redis.setex(ranksCacheKey, ttl, JSON.stringify(tournRanksToCache));
      }
      const updatedAt = await resolveChangedAt(sigCacheKey, JSON.stringify({ s: finalStats, r: tournRanksToCache }));
      return Response.json({ stats: finalStats, ranks: tournRanksToCache, updatedAt });
    }

    // Season context
    const [pgaResult, espnStats] = await Promise.all([
      pgaTourId ? fetchPgaTourPlayerStats(pgaTourId, name) : Promise.resolve(null),
      fetchPlayerSeasonStats(name),
    ]);

    const pgaStats = pgaResult?.stats ?? null;

    // RANKS — single source of truth: the stat-leaderboard caches (stat-lb), which are the EXACT
    // data the leaderboard popups render. The card always uses list position (findIndex+1) from
    // that same data, so a card rank can never disagree with the popup. We deliberately do NOT use
    // PGA Tour "official" ranks (pgaResult.ranks) or ESPN ranks here: they use a different field
    // and denominator and were the recurring source of card-vs-popup mismatch (they only leaked in
    // when a stat's stat-lb cache went cold). When a stat's stat-lb cache is momentarily cold we
    // fall back to the last list-position rank we cached — the same ranking system — never to a
    // foreign rank source.
    const LB_STAT_KEYS = [
      'drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'birdiesPerRound',
      'scrambling', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting',
    ];
    const [lbRankResults, ranksRaw] = await Promise.all([
      Promise.allSettled(LB_STAT_KEYS.map(k => redis.get(`stat-lb:v28:${k}`))),
      redis.get(ranksCacheKey).catch(() => null),
    ]);
    const cachedRanks: Record<string, string> = ranksRaw ? JSON.parse(ranksRaw as string) : {};
    const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
    const nameLower = normName(name);
    let lbScrambling: { value: string; rank: string } | null = null;
    const lbStatValues: Record<string, string> = {};
    const mergedSeasonRanks: PlayerStatRanks = {};
    for (let i = 0; i < LB_STAT_KEYS.length; i++) {
      const key = LB_STAT_KEYS[i];
      const result = lbRankResults[i];
      if (result.status !== 'fulfilled' || !result.value) {
        // stat-lb cold for this stat — keep the last list-position rank (same system as the popup)
        if (cachedRanks[key]) mergedSeasonRanks[key] = cachedRanks[key];
        continue;
      }
      try {
        const parsed = JSON.parse(result.value as string);
        const entries: { rank: number; name: string; value?: string | number }[] = parsed.entries ?? parsed;
        const entryIdx = entries.findIndex(e => normName(e.name) === nameLower);
        if (entryIdx === -1) continue; // warm but player not on this leaderboard — popup wouldn't rank them either
        const entry = entries[entryIdx];
        const listRank = String(entryIdx + 1); // list position — exactly what the popup displays
        if (key === 'scrambling') {
          lbScrambling = { rank: listRank, value: entry.value ? String(entry.value) : '' };
          mergedSeasonRanks[key] = listRank;
        } else {
          mergedSeasonRanks[key] = listRank;
          if (entry.value !== undefined && entry.value !== null) lbStatValues[key] = String(entry.value);
        }
      } catch { /* ignore */ }
    }

    // Ranks come ONLY from stat-lb list position (the PGA Tour field). LIV / non-PGA-Tour players
    // have not played enough PGA Tour rounds to qualify for the leaderboards, so they are correctly
    // left UNRANKED here — their stat values still show (from their PGA Tour rounds), just without a
    // rank. We deliberately do not fall back to any PGA-profile rank, which would imply a ranking
    // they haven't earned.
    const ranks: PlayerStatRanks | null = Object.keys(mergedSeasonRanks).length > 0 ? mergedSeasonRanks : null;

    // ESPN wins the merge for most stats. For scrambling, prefer the ESPN leaderboard cache value
    // (same source as the in-app scrambling leaderboard popup) over PGA Tour statDetails which
    // omits some players. Fall back to pgaStats scrambling only as last resort.
    // Keys where stat-lb is always the canonical value source (same source as popup leaderboards).
    // gir and puttAverage added so player card value+rank always matches the popup exactly.
    const LB_WINS_KEYS = new Set(['sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting', 'gir', 'puttAverage', 'scrambling', 'drivingAccuracy', 'drivingDistance']);
    const merged = (espnStats || pgaStats) ? mergeStats(pgaStats, espnStats) : null;
    if (merged) {
      if (lbScrambling?.value) {
        const v = lbScrambling.value;
        merged.scrambling = v.endsWith('%') ? v : `${v}%`;
      } else if (pgaStats?.scrambling && !espnStats?.scrambling) {
        merged.scrambling = pgaStats.scrambling;
      }
      for (const [key, value] of Object.entries(lbStatValues)) {
        if (LB_WINS_KEYS.has(key) || !merged[key]) merged[key] = value;
      }
    }

    const stats = merged;

    // Only cache a COMPLETE result. SG and scrambling come from PGA Tour GQL (pgaStats) or from
    // warm SG stat-lb caches. If a transient PGA GQL failure leaves them absent, caching the
    // partial result would poison every subsequent read for a full hour (the cached path can't
    // restore SG/scrambling when the SG stat-lb caches are cold). So only write when the result
    // actually carries SG + scrambling. A player who genuinely has neither (e.g. LIV/DP World with
    // no PGA Tour data) simply re-fetches each time, which is correct.
    const pgaHadStats = !!pgaStats && Object.keys(pgaStats).length > 0;
    const resultComplete = !!(stats && stats.sgTotal && stats.scrambling);
    if (stats && (resultComplete || !pgaHadStats)) {
      await redis.setex(cacheKey, ttl, JSON.stringify(stats));
    }
    if (ranks && Object.keys(ranks).length > 0) {
      await redis.setex(ranksCacheKey, ttl, JSON.stringify(ranks));
    }
    const updatedAt = await resolveChangedAt(sigCacheKey, JSON.stringify({ s: stats, r: ranks }));
    return Response.json({ stats, ranks, updatedAt });
  } catch {
    return Response.json({ stats: null, ranks: null });
  }
}
