import type { TournamentId } from './pool-store-shared';

// Venmo helpers shared by the app screens and the server: cleaning up a username someone types,
// the "what it's for" notes, and the links that open a prefilled Venmo payment.

// Venmo usernames are letters, numbers, hyphens and underscores.
const VENMO_USERNAME = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;

// Accepts "@name", "name", "venmo.com/name" or "venmo.com/u/name". Returns the bare username,
// null for an empty value, or throws with a message to show when it can't be a Venmo username.
export function normalizeVenmoUsername(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'string') throw new Error('Enter your Venmo username.');
  let value = input.trim();
  if (!value) return null;
  value = value.replace(/^https?:\/\//i, '').replace(/^(www\.|account\.)?venmo\.com\/(u\/)?/i, '');
  value = value.split(/[/?#]/)[0].replace(/^@+/, '').trim();
  if (!VENMO_USERNAME.test(value)) {
    throw new Error('That doesn\'t look like a Venmo username. It\'s the @name on your Venmo profile, like @Jane-Smith-12.');
  }
  return value;
}

export function formatVenmo(username: string) {
  return `@${username}`;
}

// What an entry fee payment is for.
export const ENTRY_FEE_NOTE = 'Golf Majors Pool ⛳';

const PAYOUT_TOURNAMENT_LABEL: Record<TournamentId, string> = {
  players: 'Players Champ',
  masters: 'Masters',
  pga: 'PGA Champ',
  'us-open': 'US Open',
  open: 'The Open',
};

export function placeLabel(place: number) {
  if (place === 1) return '1st';
  if (place === 2) return '2nd';
  if (place === 3) return '3rd';
  return `${place}th`;
}

// What a winnings payment is for, e.g. "Masters GMP 2nd Place".
export function payoutNote(tournamentId: TournamentId, place: number) {
  return `${PAYOUT_TOURNAMENT_LABEL[tournamentId]} GMP ${placeLabel(place)} Place`;
}

export function formatMoney(amount: number) {
  return Number.isInteger(amount) ? `$${amount.toLocaleString()}` : `$${amount.toFixed(2)}`;
}

export type VenmoPayment = {
  // Who gets paid. Left out, Venmo opens with the amount and note filled in and asks who to pay.
  recipient?: string | null;
  amount: number;
  note: string;
};

function amountParam(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

// venmo:// opens the Venmo app straight to a prefilled payment (the same link the founder pool has
// always used); the venmo.com link does the same on a computer or when the app isn't installed.
export function venmoPaymentLinks(payment: VenmoPayment) {
  const params = new URLSearchParams({ txn: 'pay', amount: amountParam(payment.amount), note: payment.note });
  if (payment.recipient) params.set('recipients', payment.recipient);
  const app = `venmo://paycharge?${params.toString().replace(/\+/g, '%20')}`;

  const web = new URLSearchParams({ txn: 'pay', amount: amountParam(payment.amount), note: payment.note });
  const webPath = payment.recipient ? `https://venmo.com/${encodeURIComponent(payment.recipient)}` : 'https://venmo.com/';
  return { app, web: `${webPath}?${web.toString().replace(/\+/g, '%20')}` };
}
