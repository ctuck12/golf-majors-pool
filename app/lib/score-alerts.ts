import redis from './redis';
import { appAdminEmails } from './pool-store-shared';
import { isEmailConfigured, sendAdminAlertEmail } from './email';
import type { TournamentMeta } from './tournament-config';

// Emails the app admin when a tournament's live scores stop updating during its event (the score
// cron failing for 15+ minutes), and again when they're back. One email per outage.

const ALERT_AFTER_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Health = { failingSince: number; lastResult: string; alerted: boolean };

const healthKey = (tournamentId: string) => `score-health:${tournamentId}`;

// Results that mean the leaderboard was fetched and saved.
function isHealthy(result: string) {
  return /refreshed|complete/.test(result);
}

export async function trackScoreHealth(tournamentId: string, tournamentName: string, meta: TournamentMeta | undefined, result: string) {
  if (!meta) return;
  const now = Date.now();
  const lockAt = Date.parse(meta.lockAtUtc);
  const endsAt = Date.parse(`${meta.startDate}T00:00:00Z`) + 4 * DAY_MS + 6 * 60 * 60 * 1000;
  // Only while the event is being played (from 30 minutes after first tee to Sunday night).
  if (now < lockAt + 30 * 60 * 1000 || now > endsAt) return;

  const raw = await redis.get(healthKey(tournamentId));
  const health: Health | null = raw ? (JSON.parse(raw) as Health) : null;

  if (isHealthy(result)) {
    if (health) {
      await redis.del(healthKey(tournamentId));
      if (health.alerted) await notify(`${tournamentName}: live scores are updating again`, [
        `Live scores for ${tournamentName} are updating again.`,
        `They were down from ${new Date(health.failingSince).toUTCString()} until ${new Date(now).toUTCString()}.`,
      ]);
    }
    return;
  }

  const next: Health = health ? { ...health, lastResult: result } : { failingSince: now, lastResult: result, alerted: false };
  if (!next.alerted && now - next.failingSince >= ALERT_AFTER_MS) {
    next.alerted = true;
    await notify(`${tournamentName}: live scores have stopped updating`, [
      `Live scores for ${tournamentName} haven't updated since ${new Date(next.failingSince).toUTCString()}.`,
      `Last result from the score update: ${result}`,
      "This usually means ESPN changed or hasn't listed the event. If the ESPN event id for this season is missing in app/lib/tournament-config.ts, add it; otherwise check the Vercel logs for /api/cron/refresh-scores.",
    ]);
  }
  await redis.set(healthKey(tournamentId), JSON.stringify(next), 'EX', 7 * 24 * 60 * 60);
}

async function notify(subject: string, lines: string[]) {
  if (!isEmailConfigured()) {
    console.error(`[score alert] ${subject}\n${lines.join('\n')}`);
    return;
  }
  await sendAdminAlertEmail({ to: appAdminEmails(), subject, lines }).catch((err) => {
    console.error('Could not send the score alert email:', err);
  });
}
