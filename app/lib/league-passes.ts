// League season passes: the tiers, their App Store product IDs, and the season calendar.
// Pure data and helpers, used by both the app screens and the server.
//
// A pass is a one-time (consumable) purchase that covers one league for one season. Upgrading a
// league mid-season buys an "upgrade" product priced at the difference between the two tiers.
// The App Store Connect products must use exactly these IDs.

export type LeagueTier = 6 | 12 | 25 | 50 | 100;

export const LEAGUE_TIERS: { tier: LeagueTier; plan: string; label: string; priceUsd: number }[] = [
  { tier: 6, plan: 'six', label: 'Up to 6 members', priceUsd: 8.99 },
  { tier: 12, plan: 'small', label: 'Up to 12 members', priceUsd: 24.99 },
  { tier: 25, plan: 'standard', label: 'Up to 25 members', priceUsd: 49.99 },
  { tier: 50, plan: 'large', label: 'Up to 50 members', priceUsd: 79.99 },
  { tier: 100, plan: 'xl', label: 'Up to 100 members', priceUsd: 99.99 },
];

export function seasonPassProductId(tier: LeagueTier) {
  return `gmp.season.${tier}`;
}

export function upgradeProductId(from: LeagueTier, to: LeagueTier) {
  return `gmp.upgrade.${from}.${to}`;
}

export type ParsedPassProduct =
  | { kind: 'season'; tier: LeagueTier }
  | { kind: 'upgrade'; from: LeagueTier; to: LeagueTier };

function asTier(value: string | undefined): LeagueTier | null {
  const tier = Number(value);
  return LEAGUE_TIERS.some((item) => item.tier === tier) ? (tier as LeagueTier) : null;
}

export function parsePassProduct(productId: string): ParsedPassProduct | null {
  const season = productId.match(/^gmp\.season\.(\d+)$/);
  if (season) {
    const tier = asTier(season[1]);
    return tier ? { kind: 'season', tier } : null;
  }
  const upgrade = productId.match(/^gmp\.upgrade\.(\d+)\.(\d+)$/);
  if (upgrade) {
    const from = asTier(upgrade[1]);
    const to = asTier(upgrade[2]);
    return from && to && to > from ? { kind: 'upgrade', from, to } : null;
  }
  return null;
}

export function tierInfo(tier: LeagueTier) {
  return LEAGUE_TIERS.find((item) => item.tier === tier)!;
}

// The tier a league is on, from its member limit (null for founder leagues, which have no cap).
export function tierForLimit(memberLimit: number | null): LeagueTier | null {
  return LEAGUE_TIERS.find((item) => item.tier === memberLimit)?.tier ?? null;
}

// Difference between two tiers, which is what an upgrade costs. App Store prices come from App
// Store Connect; these are the planned amounts, used as a fallback label.
export function upgradePriceUsd(from: LeagueTier, to: LeagueTier) {
  return Math.round((tierInfo(to).priceUsd - tierInfo(from).priceUsd) * 100) / 100;
}

export const ALL_PASS_PRODUCT_IDS: string[] = [
  ...LEAGUE_TIERS.map((item) => seasonPassProductId(item.tier)),
  ...LEAGUE_TIERS.flatMap((from) =>
    LEAGUE_TIERS.filter((to) => to.tier > from.tier).map((to) => upgradeProductId(from.tier, to.tier)),
  ),
];

// A season covers The Players through The Open. From September on, passes are for next year's
// season (a pass bought in November 2026 covers the 2027 majors).
export function currentSeason(now = new Date()) {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 8 ? year + 1 : year;
}

// What a pass is being used for.
export type PassAction =
  | { type: 'create'; name: string }
  | { type: 'upgrade'; leagueId: string }
  | { type: 'renew'; leagueId: string };
