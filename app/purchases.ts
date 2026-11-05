import { isNativeApp } from './native-bridge';

// Apple in-app purchases through RevenueCat, inside the iPhone app only (the website can't sell
// passes). The public RevenueCat iOS key ("appl_...") comes from NEXT_PUBLIC_REVENUECAT_IOS_KEY
// at app build time; it's safe to ship in the app. Purchases are tied to our user id, which is
// how the server finds them (see app/lib/revenuecat.ts).

const REVENUECAT_IOS_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? '';

export const purchasesAvailable = isNativeApp && REVENUECAT_IOS_KEY.length > 0;

export type StoreProduct = { identifier: string; priceString: string };

let configuredFor: string | null = null;

async function purchases(userId: string) {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  if (configuredFor === null) {
    await Purchases.configure({ apiKey: REVENUECAT_IOS_KEY, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn({ appUserID: userId });
    configuredFor = userId;
  }
  return Purchases;
}

// Localized App Store prices for these products (missing ones aren't set up in App Store Connect yet).
export async function loadProducts(userId: string, productIds: string[]): Promise<Map<string, StoreProduct>> {
  const Purchases = await purchases(userId);
  const { products } = await Purchases.getProducts({ productIdentifiers: productIds });
  return new Map(products.map((product) => [product.identifier, { identifier: product.identifier, priceString: product.priceString }]));
}

// Opens Apple's payment sheet. Resolves true when paid, false when the user cancelled.
export async function buyProduct(userId: string, productId: string): Promise<boolean> {
  const Purchases = await purchases(userId);
  const { products } = await Purchases.getProducts({ productIdentifiers: [productId] });
  const product = products[0];
  if (!product) {
    throw new Error('That pass is not available in the App Store yet.');
  }
  try {
    await Purchases.purchaseStoreProduct({ product });
    return true;
  } catch (error) {
    if ((error as { userCancelled?: boolean | null }).userCancelled) {
      return false;
    }
    throw new Error((error as { message?: string }).message || 'The purchase did not go through.');
  }
}
