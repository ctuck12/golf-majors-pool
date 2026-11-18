import { formatMoney, formatVenmo } from './venmo';

// The text a commissioner copies and sends to their pool the week of a tournament. Lines for an
// entry fee, Venmo or payouts are left out when the league hasn't set them.

export const PUBLIC_SITE = 'https://www.golfmajorspool.com';

export type PoolMessageInput = {
  tournamentName: string; // e.g. "The Masters Tournament"
  leagueName: string;
  // When picks lock (UTC ISO), shown in the commissioner's own time zone.
  lockAtIso?: string;
  timeZone?: string;
  entryFee?: number | null;
  venmoHandle?: string | null;
  payouts?: { first: number; second: number; third: number } | null;
  joinCode?: string | null;
  signOff?: string | null;
  rosterSize: number;
  salaryCap: number;
};

export function formatLockTime(iso: string, timeZone?: string) {
  const d = new Date(iso);
  const opts = timeZone ? { timeZone } : {};
  const day = d.toLocaleDateString('en-US', { ...opts, weekday: 'long', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { ...opts, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return `${day} at ${time}`;
}

function payoutLine(payouts: PoolMessageInput['payouts']) {
  if (!payouts) return null;
  const places = [
    ['1st', payouts.first],
    ['2nd', payouts.second],
    ['3rd', payouts.third],
  ].filter(([, amount]) => Number(amount) > 0) as [string, number][];
  if (places.length === 0) return null;
  if (places.length === 1 && places[0][0] === '1st') return `🏆 Winner takes all: ${formatMoney(places[0][1])}`;
  return `🏆 Payouts: ${places.map(([place, amount]) => `${place} ${formatMoney(amount)}`).join(' · ')}`;
}

export function buildPoolMessage(input: PoolMessageInput) {
  const lines: string[] = [];
  lines.push(`⛳ It's ${input.tournamentName} week! ⛳`);
  lines.push('');
  lines.push(
    `Picks are open for ${input.leagueName}. Choose ${input.rosterSize} golfers under the ${formatMoney(input.salaryCap)} salary cap and enter your tiebreaker (the winning score).`,
  );
  lines.push('');
  if (input.lockAtIso) {
    lines.push(`🔒 Picks lock ${formatLockTime(input.lockAtIso, input.timeZone)}, the first tee time. No changes after that.`);
  }
  if (input.entryFee && input.entryFee > 0) {
    lines.push(
      input.venmoHandle
        ? `💵 Entry fee: ${formatMoney(input.entryFee)}. Tap Submit & Pay in the app and Venmo opens to pay ${formatVenmo(input.venmoHandle)}.`
        : `💵 Entry fee: ${formatMoney(input.entryFee)}.`,
    );
  }
  const payouts = payoutLine(input.payouts);
  if (payouts) lines.push(payouts);
  lines.push(`📲 Make your picks: ${PUBLIC_SITE}`);
  if (input.joinCode) {
    lines.push('');
    lines.push(`New to the pool? Sign up with league code ${input.joinCode} or this link: ${PUBLIC_SITE}/?join=${encodeURIComponent(input.joinCode)}`);
  }
  lines.push('');
  lines.push('Good luck! 🏌️');
  if (input.signOff) lines.push(input.signOff);
  return lines.join('\n');
}
