import { formatMoney, formatVenmo } from './venmo';
import { ordinal, type PayoutPlan, type PayoutRule } from './payout-plan';

// The text a commissioner copies and sends to their pool the week of a tournament. Lines for an
// entry fee, Venmo or payouts are left out when the league hasn't set them.

export const PUBLIC_SITE = 'https://golfmajorspool.com';

// The store pages, once the app is live there. App Store: https://apps.apple.com/app/id<Apple ID>
// (the number under App Store Connect → the app → App Information). Google Play:
// https://play.google.com/store/apps/details?id=<package> (no Android app yet). Until a link is
// filled in, that phone gets the website, which works the same in a browser.
export const APP_STORE_URL: string | null = null;
export const GOOGLE_PLAY_URL: string | null = null;

// The link in the text: the right store for the phone (see app/download/route.ts).
export const DOWNLOAD_LINK = `${PUBLIC_SITE}/download`;

export type PoolMessageInput = {
  tournamentName: string; // e.g. "The Masters Tournament"
  leagueName: string;
  // When picks lock (UTC ISO), shown in the commissioner's own time zone.
  lockAtIso?: string;
  timeZone?: string;
  entryFee?: number | null;
  venmoHandle?: string | null;
  // How the pot is split (preferred), else the amounts typed in for this tournament.
  payoutPlan?: PayoutPlan | null;
  payouts?: { first: number; second: number; third: number } | null;
  // How to pay when the commissioner has no Venmo, and who they are.
  paymentNote?: string | null;
  commissionerName?: string | null;
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

// How a place is paid, in words for members ("67.5% of the pot after 3rd place is paid").
function describeForMembers(rule: PayoutRule, fixedPlaces: number[], fee: number) {
  if (rule.mode === 'rest') return 'the rest of the pot';
  if (rule.mode === 'fixed') return formatMoney(rule.value);
  if (rule.mode === 'fee') {
    const multiple = Number.isInteger(rule.value) ? String(rule.value) : rule.value.toFixed(1);
    const why = rule.value === 1 ? 'their entry fee back' : rule.value === 2 ? 'doubles their money' : rule.value === 3 ? 'triples their money' : `${multiple}× the entry fee`;
    return fee > 0 ? `${formatMoney(rule.value * fee)} (${why})` : why;
  }
  const pct = `${Number.isInteger(rule.value) ? rule.value : rule.value.toFixed(1)}%`;
  if (fixedPlaces.length === 0) return `${pct} of the pot`;
  const names = fixedPlaces.map((p) => ordinal(p));
  return `${pct} of the pot after ${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} paid`;
}

// Which places get paid and how. Plan amounts depend on how many enter, so the plan is described
// rather than priced; typed-in amounts are listed as they are.
function payoutLines(input: PoolMessageInput): string[] {
  const plan = input.payoutPlan;
  if (plan && plan.places.length) {
    if (plan.places.length === 1) return ['🏆 Winner takes all: the whole pot'];
    const fixedPlaces = plan.places.map((rule, i) => (rule.mode === 'fixed' || rule.mode === 'fee' ? i + 1 : 0)).filter(Boolean);
    return [
      `🏆 Top ${plan.places.length} get paid:`,
      ...plan.places.map((rule, i) => `${['🥇', '🥈', '🥉'][i]} ${ordinal(i + 1)}: ${describeForMembers(rule, fixedPlaces, input.entryFee ?? 0)}`),
      'The pot grows with every entry, and the app shows the amounts live on the leaderboard.',
    ];
  }
  const p = input.payouts;
  if (!p) return [];
  const paid = [p.first, p.second, p.third].map((amount, i) => ({ place: ordinal(i + 1), amount })).filter((x) => x.amount > 0);
  if (paid.length === 0) return [];
  return [`🏆 Payouts: ${paid.map((x) => `${x.place} ${formatMoney(x.amount)}`).join(' · ')}`];
}

export function buildPoolMessage(input: PoolMessageInput) {
  const lines: string[] = [];
  lines.push(`⛳ It's ${input.tournamentName} week! ⛳`);
  lines.push('');
  lines.push(
    `Picks are open for ${input.leagueName}. Choose ${input.rosterSize} golfers under the ${formatMoney(input.salaryCap)} salary cap and guess the winner's total strokes for the tiebreaker.`,
  );
  lines.push('');
  if (input.lockAtIso) {
    lines.push(`🔒 Picks lock ${formatLockTime(input.lockAtIso, input.timeZone)}, the first tee time. No changes after that.`);
  }
  if (input.entryFee && input.entryFee > 0) {
    const fee = formatMoney(input.entryFee);
    if (input.venmoHandle) {
      lines.push(`💵 Entry fee: ${fee}. Once your ${input.rosterSize} golfers are set in the salary cap sheet, tap Submit & Pay: it submits your picks and opens Venmo with your ${fee} to ${formatVenmo(input.venmoHandle)} ready to send.`);
    } else if (input.paymentNote) {
      lines.push(`💵 Entry fee: ${fee}. Once your ${input.rosterSize} golfers are set in the salary cap sheet, tap Submit, then pay: ${input.paymentNote.trim().replace(/\.?$/, '.')}`);
    } else {
      lines.push(`💵 Entry fee: ${fee}. Once your ${input.rosterSize} golfers are set in the salary cap sheet, tap Submit, then pay ${input.commissionerName ?? 'your commissioner'}.`);
    }
  }
  lines.push(...payoutLines(input));
  lines.push('');
  lines.push(`📲 Make your picks in the Golf Majors Pool app. Download it here: ${DOWNLOAD_LINK}`);
  if (input.joinCode) {
    lines.push('');
    lines.push(`New to the pool? Download the app using the link above, create an account and enter league code ${input.joinCode}.`);
  }
  lines.push('');
  lines.push('Good luck! 🏌️');
  if (input.signOff) lines.push(input.signOff);
  return lines.join('\n');
}
