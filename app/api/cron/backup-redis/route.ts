export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { db, ensureSchema } from '@/app/lib/db';
import { userDataBackend } from '@/app/lib/pool-store';

// Nightly copy of the Redis data that can't be rebuilt from ESPN (salary lists, lock times, manual
// stat fixes, round leaders, player tags, uploaded field players, DP World rankings, old standings
// history) into Postgres, which Supabase backs up daily. Score caches are skipped: the cron
// rebuilds those.

const EXACT_KEYS = [
  'pool-lock-times:v1',
  'pool-pre-tournament-view:v1',
  'round-leaders',
  'low-rounds',
  'pool-stat-overrides',
  'player-tags:v1',
  'dynamic-pool:v1',
  'dynamic-pool-meta:v1',
  'locked-odds',
  'player-photo-registry',
];
const KEY_PATTERNS = ['salary-overrides:v3:*', 'standings-archive:v1:*', 'standings-archive-years:v1:*', 'live-season:*'];

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (userDataBackend() !== 'postgres') {
    return Response.json({ skipped: 'no database' });
  }

  await ensureSchema();
  const keys = new Set(EXACT_KEYS);
  for (const pattern of KEY_PATTERNS) for (const key of await scanKeys(pattern)) keys.add(key);

  const sql = db();
  let saved = 0;
  for (const key of keys) {
    const value = await redis.get(key).catch(() => null);
    if (value === null) continue;
    await sql`
      insert into redis_backups (key, value) values (${key}, ${value})
      on conflict (key) do update set value = excluded.value, backed_up_at = now()
    `;
    saved++;
  }
  return Response.json({ backedUpAt: new Date().toISOString(), keys: saved });
}
