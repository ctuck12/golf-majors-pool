import { isNativeApp } from './native-bridge';

// Apple in-app purchases through RevenueCat, inside the iPhone app only (the website can't sell
// passes). The public RevenueCat iOS key ("appl_...") comes from NEXT_PUBLIC_REVENUECAT_IOS_KEY
// at app build time; it's safe to ship in the app. Purchases are tied to our user id, which is
// how the server finds them (see app/lib/revenuecat.ts).

const REVENUECAT_IOS_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? '';

export const purchasesAvailable = isNativeApp && REVENUECAT_IOS_KEY.length > 0;

export type StoreProduct = { identifier: string; priceString: string };

let configuredFor: string | null = null;

// Gives up on a step that never answers, naming the step, so a stuck purchase says where it stuck.
export function withTimeout<T>(step: string, ms: number, work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${step} didn't respond after ${Math.round(ms / 1000)} seconds.`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Returns the plugin wrapped in an object. A Capacitor plugin answers every property, `then`
// included, so returning it bare from an async function makes the promise treat it as a thenable
// and wait on a native "then" call that never answers: every purchase hung on "Processing…".
async function purchases(userId: string): Promise<{ Purchases: typeof import('@revenuecat/purchases-capacitor').Purchases }> {
  const { Purchases, LOG_LEVEL } = await import('@revenuecat/purchases-capacitor');
  if (configuredFor === null) {
    // Detailed RevenueCat messages in Xcode's console, for diagnosing purchases.
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }).catch(() => {});
    await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn({ appUserID: userId });
    configuredFor = userId;
  }
  return { Purchases };
}

// Localized App Store prices for these products (missing ones aren't set up in App Store Connect yet).
export async function loadProducts(userId: string, productIds: string[]): Promise<Map<string, StoreProduct>> {
  const { Purchases } = await purchases(userId);
  const { products } = await Purchases.getProducts({ productIdentifiers: productIds });
  return new Map(products.map((product) => [product.identifier, { identifier: product.identifier, priceString: product.priceString }]));
}

// Opens Apple's payment sheet. Resolves true when paid, false when the user cancelled.
export async function buyProduct(userId: string, productId: string): Promise<boolean> {
  console.log('[GMP purchase] starting', productId);
  const { Purchases } = await withTimeout('Connecting to the App Store', 20_000, purchases(userId));
  console.log('[GMP purchase] connected, loading product');
  const { products } = await withTimeout('Loading the pass from the App Store', 20_000, Purchases.getProducts({ productIdentifiers: [productId] }));
  console.log('[GMP purchase] product loaded:', products.length, 'opening payment sheet');
  const product = products[0];
  if (!product) {
    throw new Error('That pass is not available in the App Store yet.');
  }
  // If Apple's payment sheet never comes back (it didn't open, or StoreKit stalled), stop waiting
  // after two minutes and say so, instead of leaving the button on "Processing…" forever.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Apple's payment screen didn't respond. Close this, reopen the app and try again. If you paid, the pass appears here as unused.")), 120_000);
  });
  try {
    await Promise.race([Purchases.purchaseStoreProduct({ product }), timeout]);
    console.log('[GMP purchase] paid');
    return true;
  } catch (error) {
    if ((error as { userCancelled?: boolean | null }).userCancelled) {
      return false;
    }
    console.log('[GMP purchase] failed', JSON.stringify(error));
    const e = error as { message?: string; code?: string | number; underlyingErrorMessage?: string };
    const detail = [e.message, e.underlyingErrorMessage, e.code !== undefined ? `code ${e.code}` : ''].filter(Boolean).join(' · ');
    throw new Error(detail || 'The purchase did not go through.');
  } finally {
    clearTimeout(timer);
  }
}

// Opens Apple's sheet for redeeming an App Store offer code (the promo codes made in App Store
// Connect). A redeemed code shows up as a purchase, which the paywall then offers as an unused pass.
export async function redeemPromoCode(userId: string): Promise<void> {
  const { Purchases } = await purchases(userId);
  await Purchases.presentCodeRedemptionSheet();
}
