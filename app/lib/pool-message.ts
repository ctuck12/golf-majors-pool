import { formatMoney, formatVenmo } from './venmo';

// The text a commissioner copies and sends to their pool the week of a tournament. Lines for an
// entry fee, Venmo or payouts are left out when the league hasn't set them.

export const PUBLIC_SITE = 'https://www.golfmajorspool.com';

// The App Store page, once the app is live: https://apps.apple.com/app/id<Apple ID>, where the
// Apple ID is the number under App Store Connect → the app → App Information. Until then the
// download link opens the website.
export const APP_STORE_URL: string | null = null;

// The link in the text: the App Store on an iPhone (once the app is live), the website otherwise.
export const DOWNLOAD_LINK = `${PUBLIC_SITE}/download`;

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

// Which places get paid, not the amounts: those depend on how many enter.
function payoutLine(payouts: PoolMessageInput['payouts']) {
  if (!payouts) return null;
  const paid = (['1st', '2nd', '3rd'] as const).filter((_, i) => Number([payouts.first, payouts.second, payouts.third][i]) > 0);
  if (paid.length === 0) return null;
  if (paid.length === 1 && paid[0] === '1st') return '🏆 Winner takes all';
  if (paid.every((place, i) => place === ['1st', '2nd', '3rd'][i])) return `🏆 Top ${paid.length} get paid`;
  return `🏆 ${paid.slice(0, -1).join(', ')} and ${paid[paid.length - 1]} place get paid`;
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
  lines.push('');
  lines.push(`📲 Make your picks in the Golf Majors Pool app. Download it here: ${DOWNLOAD_LINK}`);
  if (input.joinCode) {
    lines.push('');
    lines.push(`New to the pool? Download the app, sign up and enter league code ${input.joinCode}.`);
  }
  lines.push('');
  lines.push('Good luck! 🏌️');
  if (input.signOff) lines.push(input.signOff);
  return lines.join('\n');
}
