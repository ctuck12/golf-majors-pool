import redis from './redis';
import type { TournamentId } from './pool-store';

// Commissioner-set pool lock times (Round 1 first tee, stored as UTC ISO). When set for a
// tournament this OVERRIDES the built-in schedule everywhere: picks lock, the standings
// card flips to the live leaderboard, and the score cron starts fetching at this moment.

const KEY = 'pool-lock-times:v1';

export type LockTimeOverrides = Partial<Record<TournamentId, string>>;

export async function getLockTimeOverrides(): Promise<LockTimeOverrides> {
  try {
    const raw = await redis.get(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw as string) as LockTimeOverrides;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function setLockTimeOverride(tournamentId: TournamentId, lockAtUtc: string | null): Promise<LockTimeOverrides> {
  const current = await getLockTimeOverrides();
  if (lockAtUtc === null) {
    delete current[tournamentId];
  } else {
    current[tournamentId] = lockAtUtc;
  }
  await redis.set(KEY, JSON.stringify(current));
  return current;
}

