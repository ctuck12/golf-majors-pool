import { ALL_PASS_PRODUCT_IDS } from './league-passes';

// Server-side check of what a user has actually bought in the app, straight from RevenueCat (never
// from the app's say-so). The app identifies each user to RevenueCat by our user id.
// Env: REVENUECAT_SECRET_KEY (a secret "sk_..." key from the RevenueCat dashboard).

export type PassPurchase = {
  id: string; // RevenueCat's id for this purchase; each one can be spent once
  productId: string;
  store: string | null;
  isSandbox: boolean;
  purchasedAt: string | null;
};

type NonSubscriptionEntry = {
  id?: string;
  store?: string;
  is_sandbox?: boolean;
  purchase_date?: string;
};

export function purchasesConfigured() {
  return Boolean(process.env.REVENUECAT_SECRET_KEY);
}

export async function fetchPassPurchases(userId: string): Promise<PassPurchase[]> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) {
    throw new Error("In-app purchases aren't set up yet.");
  }

  const base = process.env.REVENUECAT_API_BASE ?? 'https://api.revenuecat.com';
  const response = await fetch(`${base}/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Couldn't check purchases with RevenueCat (${response.status}).`);
  }

  const body = (await response.json()) as {
    subscriber?: { non_subscriptions?: Record<string, NonSubscriptionEntry[]> };
  };
  const byProduct = body.subscriber?.non_subscriptions ?? {};

  return Object.entries(byProduct)
    .filter(([productId]) => ALL_PASS_PRODUCT_IDS.includes(productId))
    .flatMap(([productId, entries]) =>
      (entries ?? [])
        .filter((entry) => typeof entry.id === 'string' && entry.id.length > 0)
        .map((entry) => ({
          id: entry.id!,
          productId,
          store: entry.store ?? null,
          isSandbox: entry.is_sandbox === true,
          purchasedAt: entry.purchase_date ?? null,
        })),
    );
}
