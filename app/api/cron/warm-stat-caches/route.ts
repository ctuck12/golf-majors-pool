export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import redis from '@/app/lib/redis';
import { scheduledEspnEvents } from '@/app/lib/tournament-config';

// Cron job: keep the stat-leaderboard caches warm WITHOUT hammering the upstream PGA/ESPN APIs.
//
// Each stat-leaderboard build makes a PGA GraphQL call plus ~216 ESPN supplement calls, so
// force-rebuilding all 13 stats every run rate-limits the upstream APIs — builds then return empty
// and never cache, leaving stat-lb cold (the bug that made player-card ranks disappear).
//
// Instead, the stat-lb caches use a long TTL and this cron only rebuilds a stat when its cache is
// COLD or about to expire (TTL below the refresh threshold). In steady state almost every run is a
// no-op (all caches warm), so upstream load is minimal and builds reliably succeed.

const STAT_KEYS = [
  'drivingDistance',
  'drivingAccuracy',
  'gir',
  'scrambling',
  'sandSaves',
  'puttAverage',
  'scoringAverage',
  'sgTotal',
  'sgOffTee',
  'sgApproach',
  'sgAroundGreen',
  'sgPutting',
  'sgTeeToGreen',
];

const STAT_LB_PREFIX = 'stat-lb:v28:';
const MAX_ATTEMPTS = 2;            // retry a build that comes back empty (transient upstream failure)
const REFRESH_BELOW = 3600;        // rebuild a cache when it has <1h left (TTL is 4h) — refresh before it goes cold
const MAX_REBUILDS_PER_RUN = 5;    // cap rebuilds per invocation so a cold start warms gradually, never bursts
const REBUILD_GAP_MS = 400;        // small gap between builds to stay gentle on the upstream APIs

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  // Vercel only injects the `Authorization: Bearer <CRON_SECRET>` header on scheduled invocations
  // when CRON_SECRET is configured in the project env. If it is NOT set, the cron fires with no
  // auth header — and a strict `!== Bearer undefined` check returns 401 every time, which was the
  // bug that left every stat-lb cache cold (the cron never actually ran). So only enforce auth when
  // a secret is configured; otherwise allow the invocation. This endpoint only warms public stat
  // caches, so allowing it unauthenticated when no secret is set is low risk.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // IMPORTANT: use the production alias (VERCEL_PROJECT_PRODUCTION_URL), NOT VERCEL_URL. VERCEL_URL
  // is the deployment-specific URL, which is protected by Vercel deployment SSO — internal fetches
  // to it return the login HTML page (HTTP 200, not JSON), so every leaderboard build parsed as
  // "empty" and never cached. The production alias is public and serves the real API.
  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const baseUrl = prodUrl ? `https://${prodUrl}` : 'http://localhost:3000';

  const results: Record<string, string> = {};

  // Build sequentially, one stat at a time. Each build hits PGA GQL plus ~216 ESPN calls, so even
  // two concurrent builds overload the upstream APIs and return empty (the cron failure mode that
  // left caches cold). One-at-a-time builds reliably succeed. A per-run cap means a fully-cold start
  // warms gradually over a few cron cycles instead of bursting all 13 at once.
  let rebuilds = 0;
  for (const key of STAT_KEYS) {
    // Skip stats whose cache is still warm and not near expiry — no upstream call needed.
    // redis.ttl: -2 = key missing (cold), -1 = no expiry, >=0 = seconds remaining.
    let ttl = -2;
    try { ttl = await redis.ttl(`${STAT_LB_PREFIX}${key}`); } catch { /* treat as cold */ }
    if (ttl > REFRESH_BELOW) { results[key] = `warm(${ttl}s)`; continue; }
    if (rebuilds >= MAX_REBUILDS_PER_RUN) { results[key] = 'deferred'; continue; }
    rebuilds++;

    // Cold or near-expiry — rebuild (bust), retrying if the build returns empty.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/api/stat-leaderboard?statKey=${key}&bust=1`, {
          cache: 'no-store',
          headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '' },
        });
        if (res.ok) {
          const data = await res.json().catch(() => null) as { entries?: unknown[] } | null;
          if (Array.isArray(data?.entries) && data!.entries.length > 0) {
            results[key] = `rebuilt(${data!.entries.length})`;
            break;
          }
          results[key] = `empty:attempt${attempt}`;
        } else {
          results[key] = `${res.status}:attempt${attempt}`;
        }
      } catch (e) {
        results[key] = `err:attempt${attempt}:${String(e)}`;
      }
    }
    await sleep(REBUILD_GAP_MS);
  }

  // Warm tournament COURSE + STROKES GAINED leaderboards for every scheduled event with an ESPN id
  // (app/lib/tournament-config.ts). Completed-event data is static, so these cache for 7 days and
  // rarely rebuild. Shares the per-run rebuild cap with season stats, so a cold start warms
  // gradually across runs. The newest events go first.
  const scheduledEvents = scheduledEspnEvents().reverse();
  // ESPN-sourced course stats (every event). Scrambling and SG come from the PGA feed instead.
  const ESPN_COURSE_KEYS = ['drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage'];
  const PGA_KEYS = ['sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting', 'scrambling'];
  for (const { tournamentId, espnEventId: eventId, lockAtUtc } of scheduledEvents) {
    // Skip events that haven't started — they have no leaderboard data yet, so building would just
    // hammer the upstream APIs with empty results every run. They warm automatically once underway.
    const lockMs = Date.parse(lockAtUtc);
    if (!isNaN(lockMs) && Date.now() < lockMs) { results[`t:${eventId}`] = 'notStarted'; continue; }
    // The Masters PGA feed carries no tournament SG or scrambling (the Masters view hides SG
    // accordingly), so warming its PGA keys would retry empty builds every run forever.
    const keysForEvent = tournamentId === 'masters' ? ESPN_COURSE_KEYS : [...ESPN_COURSE_KEYS, ...PGA_KEYS];
    for (const key of keysForEvent) {
      const label = `t:${eventId}:${key}`;
      let ttl = -2;
      try { ttl = await redis.ttl(`tourn-stat-lb:v13:${eventId}:${key}`); } catch { /* cold */ }
      if (ttl > REFRESH_BELOW) { results[label] = `warm(${ttl}s)`; continue; }
      if (rebuilds >= MAX_REBUILDS_PER_RUN) { results[label] = 'deferred'; continue; }
      rebuilds++;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(`${baseUrl}/api/tournament-stat-leaderboard?statKey=${key}&eventId=${eventId}&bust=1`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json().catch(() => null) as { entries?: unknown[] } | null;
            if (Array.isArray(data?.entries) && data!.entries.length > 0) { results[label] = `rebuilt(${data!.entries.length})`; break; }
            results[label] = `empty:attempt${attempt}`;
          } else { results[label] = `${res.status}:attempt${attempt}`; }
        } catch (e) { results[label] = `err:attempt${attempt}:${String(e)}`; }
      }
      await sleep(REBUILD_GAP_MS);
    }
  }

  // Warm tour averages last (reads the now-warm stat-lb caches; no upstream load when warm).
  try {
    const res = await fetch(`${baseUrl}/api/tour-averages`, { cache: 'no-store' });
    results['tour-averages'] = res.ok ? 'ok' : `${res.status}`;
  } catch (e) {
    results['tour-averages'] = String(e);
  }

  console.log('[warm-stat-caches] results:', results);
  return Response.json({ results });
}
