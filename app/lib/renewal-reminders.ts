import { db } from './db';
import { currentSeason } from './league-passes';
import { getTournamentMeta, TOURNAMENT_KEYS } from './tournament-config';
import { isEmailConfigured, sendRenewalReminderEmail } from './email';
import { sendPushToUsers } from './push';

// Reminders to commissioners whose league hasn't been renewed for the new season (a new season
// starts September 1; until a league is renewed, its members can't make picks or join):
//   - when the new season starts (or the first day after that this runs)
//   - about 3 weeks before The Players
//   - the week of each major still to come, so a league that missed The Players is reminded
//     before the Masters, and so on
// Each one goes out once per league (push to the commissioner's phone, plus an email). Only
// leagues that were paid last season are reminded; free leagues never expire.

const NAMES: Record<string, string> = {
  players: 'The Players',
  masters: 'The Masters',
  pga: 'The PGA Championship',
  'us-open': 'The U.S. Open',
  open: 'The Open',
};
const DAY = 24 * 60 * 60 * 1000;

type Reminder = { kind: string; tournamentId: string; urgent: boolean; next: { id: string; lockAt: number } | null };

// Which reminder is due now for a league that needs renewing, if any.
export function dueRenewalReminder(season: number, now: number): Reminder | null {
  const events = TOURNAMENT_KEYS.map((id) => ({ id, lockAt: Date.parse(getTournamentMeta(id, season)?.lockAtUtc ?? '') }))
    .filter((e) => !Number.isNaN(e.lockAt));
  const next = events.find((e) => e.lockAt > now) ?? null;
  if (!next) return null; // the season's majors are all under way or over
  const untilLock = next.lockAt - now;
  if (untilLock <= 7 * DAY) return { kind: 'renew-week', tournamentId: next.id, urgent: true, next };
  if (next.id === 'players' && untilLock <= 21 * DAY) return { kind: 'renew-3wk', tournamentId: 'players', urgent: false, next };
  return { kind: 'renew-start', tournamentId: 'season', urgent: false, next };
}

function lockText(lockAt: number) {
  return new Date(lockAt).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago', timeZoneName: 'short',
  });
}

export async function sendRenewalReminders(now = new Date()) {
  const season = currentSeason(now);
  const due = dueRenewalReminder(season, now.getTime());
  if (!due) return { season, sent: 0 };

  const sql = db();
  const leagues = await sql<{ id: string; name: string; user_id: string; email: string; display_name: string }[]>`
    select l.id, l.name, u.id as user_id, u.email, u.display_name
    from leagues l
    join league_members m on m.league_id = l.id and m.role = 'commissioner'
    join users u on u.id = m.user_id
    where l.plan <> 'founder' and l.paid_season = ${season - 1}
  `;

  let sent = 0;
  for (const league of leagues) {
    // Once per league per reminder (the key includes the season).
    const claimed = await sql`
      insert into league_reminders_sent (league_id, tournament_id, season, kind)
      values (${league.id}, ${due.tournamentId}, ${season}, ${due.kind})
      on conflict do nothing
      returning 1
    `;
    if (claimed.length === 0) continue;

    const nextName = due.next ? NAMES[due.next.id] : null;
    const title = due.urgent && nextName ? `Renew ${league.name} before ${nextName}` : `Renew ${league.name} for ${season}`;
    const body = due.urgent && nextName
      ? `${nextName} picks lock ${lockText(due.next!.lockAt)}. Members can't make picks until you renew.`
      : `Your ${season} season pass is due. Members can't make picks or join until you renew.`;
    await sendPushToUsers([league.user_id], { title, body, data: { tab: 'Commissioner Hub' } }).catch(() => 0);
    if (isEmailConfigured()) {
      await sendRenewalReminderEmail({
        to: league.email,
        displayName: league.display_name,
        leagueName: league.name,
        season,
        nextEventName: nextName,
        nextLockText: due.next ? lockText(due.next.lockAt) : null,
        urgent: due.urgent,
      }).catch(() => {});
    }
    sent++;
  }
  return { season, kind: due.kind, sent };
}
