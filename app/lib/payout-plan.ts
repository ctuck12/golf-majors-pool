// A league's payout plan: how the pot is split between 1st, 2nd and 3rd, set once by the
// commissioner and applied to every tournament. The pot is the entry fee times the number of
// entries, so the amounts update on their own as picks come in.
//
// Each paid place is one of:
//   fixed  a dollar amount ($60)
//   fee    a multiple of the entry fee (2 = "doubles their money")
//   percent a share of what's left after the fixed amounts (67.5)
//   rest   whatever is left after everything else
// Percentages and "rest" are rounded to the plan's roundTo ($1, $5 or $10).

export type PayoutMode = 'percent' | 'fixed' | 'fee' | 'rest';
export type PayoutRule = { mode: PayoutMode; value: number };
export type PayoutPlan = {
  // 1st place first; one to three places.
  places: PayoutRule[];
  roundTo: 1 | 5 | 10;
};

export type PlaceAmounts = { first: number; second: number; third: number };

export const PAYOUT_MODES: PayoutMode[] = ['percent', 'fixed', 'fee', 'rest'];
const ROUND_TO = [1, 5, 10] as const;

// Checks a plan someone sent in. Returns it cleaned up, or throws with a message to show.
export function parsePayoutPlan(input: unknown): PayoutPlan {
  const raw = input as { places?: unknown; roundTo?: unknown } | null;
  if (!raw || !Array.isArray(raw.places) || raw.places.length < 1 || raw.places.length > 3) {
    throw new Error('Choose how many places get paid (1 to 3).');
  }
  const places = raw.places.map((place, index) => {
    const rule = place as { mode?: unknown; value?: unknown };
    if (!PAYOUT_MODES.includes(rule?.mode as PayoutMode)) throw new Error(`Choose how ${ordinal(index + 1)} place is paid.`);
    const mode = rule.mode as PayoutMode;
    const value = mode === 'rest' ? 0 : Number(rule.value);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Enter an amount for ${ordinal(index + 1)} place.`);
    if (mode !== 'rest' && value === 0) throw new Error(`Enter an amount for ${ordinal(index + 1)} place.`);
    return { mode, value };
  });
  const roundTo = ROUND_TO.includes(Number(raw.roundTo) as 1 | 5 | 10) ? (Number(raw.roundTo) as 1 | 5 | 10) : 5;
  const plan = { places, roundTo };
  const problem = planProblem(plan);
  if (problem) throw new Error(problem);
  return plan;
}

// What's wrong with a plan, in words, or null when it's good to save.
export function planProblem(plan: PayoutPlan): string | null {
  const rest = plan.places.filter((p) => p.mode === 'rest').length;
  if (rest > 1) return 'Only one place can get "the rest".';
  const percent = plan.places.filter((p) => p.mode === 'percent').reduce((sum, p) => sum + p.value, 0);
  if (percent > 100) return `The percentages add up to ${trim(percent)}%. They can't be more than 100%.`;
  if (rest === 1 && percent >= 100) return 'The percentages already use up the pot, so nothing is left for "the rest".';
  if (rest === 0 && percent > 0 && Math.abs(percent - 100) > 0.001) {
    return `The percentages add up to ${trim(percent)}%. Make them 100%, or set one place to "the rest".`;
  }
  return null;
}

// The amounts for a pot. Fixed and entry-fee amounts come off the top (1st place first if the pot
// is too small for them all); percentages split what's left; "the rest" gets the remainder.
export function computePayouts(plan: PayoutPlan, pot: number, entryFee: number): PlaceAmounts {
  const amounts = [0, 0, 0];
  let left = Math.max(0, pot);
  plan.places.forEach((rule, i) => {
    if (rule.mode !== 'fixed' && rule.mode !== 'fee') return;
    const want = rule.mode === 'fixed' ? rule.value : rule.value * entryFee;
    amounts[i] = Math.min(want, left);
    left -= amounts[i];
  });
  const remaining = left;
  const round = (x: number) => Math.round(x / plan.roundTo) * plan.roundTo;
  plan.places.forEach((rule, i) => {
    if (rule.mode !== 'percent') return;
    amounts[i] = Math.min(round((remaining * rule.value) / 100), left);
    left -= amounts[i];
  });
  const restIndex = plan.places.findIndex((rule) => rule.mode === 'rest');
  if (restIndex >= 0) {
    amounts[restIndex] = left;
  } else {
    // Percentages that add up to 100% should pay out the whole pot: the top-paid percentage place
    // takes the few dollars rounding leaves over (or gives back).
    const percentPlaces = plan.places.map((rule, i) => ({ rule, i })).filter(({ rule }) => rule.mode === 'percent');
    const total = percentPlaces.reduce((sum, { rule }) => sum + rule.value, 0);
    if (percentPlaces.length && Math.abs(total - 100) < 0.001) {
      const top = percentPlaces.reduce((best, cur) => (cur.rule.value > best.rule.value ? cur : best));
      amounts[top.i] += left;
    }
  }
  const money = (x: number) => Math.max(0, Math.round(x * 100) / 100);
  return { first: money(amounts[0]), second: money(amounts[1]), third: money(amounts[2]) };
}

export function ordinal(place: number) {
  return place === 1 ? '1st' : place === 2 ? '2nd' : place === 3 ? '3rd' : `${place}th`;
}

function trim(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

// How a rule reads, e.g. "67.5% of what's left", "2× the entry fee", "$60", "the rest".
export function describeRule(rule: PayoutRule, hasFixed: boolean) {
  if (rule.mode === 'rest') return 'the rest';
  if (rule.mode === 'fixed') return `$${trim(rule.value)}`;
  if (rule.mode === 'fee') return rule.value === 1 ? 'their entry fee back' : `${trim(rule.value)}× the entry fee`;
  return hasFixed ? `${trim(rule.value)}% of what's left` : `${trim(rule.value)}% of the pot`;
}

// The founder pool's plan: 3rd doubles their money, 1st gets 67.5% of what's left (about double
// 2nd), 2nd gets the rest, to the nearest $5. A $600 pot pays $365 / $175 / $60.
export const FOUNDER_PAYOUT_PLAN: PayoutPlan = {
  places: [
    { mode: 'percent', value: 67.5 },
    { mode: 'rest', value: 0 },
    { mode: 'fee', value: 2 },
  ],
  roundTo: 5,
};
