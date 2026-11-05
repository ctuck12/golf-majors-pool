'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Check, X } from 'lucide-react';
import {
  LEAGUE_TIERS,
  parsePassProduct,
  seasonPassProductId,
  upgradePriceUsd,
  upgradeProductId,
  type LeagueTier,
  type PassAction,
} from './lib/league-passes';
import { buyProduct, loadProducts, purchasesAvailable, type StoreProduct } from './purchases';

// The league pass paywall: create a league, upgrade its member limit, or renew it for a new
// season. Order of events: the server checks the pass can be used, Apple's payment sheet takes
// the money, then the server confirms the purchase with RevenueCat and applies it. A purchase
// that couldn't be applied (lost signal) is listed as an unused pass to apply later.

export type PaywallMode =
  | { kind: 'create' }
  | { kind: 'upgrade'; leagueId: string; leagueName: string; currentTier: LeagueTier; memberCount: number }
  | { kind: 'renew'; leagueId: string; leagueName: string; memberCount: number };

type SessionLike = { error?: string };
type UnusedPass = { id: string; productId: string };

const navy = '#173b63';

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 14,
  border: '1px solid #d7e0e8',
  padding: '12px 14px',
  fontSize: 16,
  background: '#fff',
  color: '#0f1720',
};

async function postJson<T extends SessionLike>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  return payload;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The choices this mode offers: product id, tier it results in, planned USD price.
function optionsFor(mode: PaywallMode) {
  if (mode.kind === 'upgrade') {
    return LEAGUE_TIERS.filter((item) => item.tier > mode.currentTier).map((item) => ({
      productId: upgradeProductId(mode.currentTier, item.tier),
      tier: item.tier,
      label: item.label,
      usd: upgradePriceUsd(mode.currentTier, item.tier),
    }));
  }
  const minimum = mode.kind === 'renew' ? mode.memberCount : 0;
  return LEAGUE_TIERS.filter((item) => item.tier >= minimum).map((item) => ({
    productId: seasonPassProductId(item.tier),
    tier: item.tier,
    label: item.label,
    usd: item.priceUsd,
  }));
}

// Mount with a fresh `key` per opening (the page keys it on the mode) so choices start blank.
export function PaywallModal<T extends SessionLike>({
  open,
  mode,
  userId,
  onClose,
  onSession,
}: {
  open: boolean;
  mode: PaywallMode | null;
  userId: string;
  onClose: () => void;
  onSession: (payload: T) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [prices, setPrices] = useState<Map<string, StoreProduct>>(new Map());
  const [season, setSeason] = useState<number | null>(null);
  const [unused, setUnused] = useState<UnusedPass[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const options = mode ? optionsFor(mode) : [];

  useEffect(() => {
    if (!open || !mode) return;
    let cancelled = false;
    fetch('/api/leagues/passes')
      .then((res) => res.json())
      .then((data: { season?: number; unused?: UnusedPass[] }) => {
        if (cancelled) return;
        setSeason(data.season ?? null);
        setUnused(data.unused ?? []);
      })
      .catch(() => {});
    if (purchasesAvailable) {
      loadProducts(userId, optionsFor(mode).map((option) => option.productId))
        .then((map) => { if (!cancelled) setPrices(map); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [open, mode, userId]);

  if (!open || !mode) return null;

  const action = (): PassAction =>
    mode.kind === 'create' ? { type: 'create', name } : { type: mode.kind, leagueId: mode.leagueId };

  // Apply a paid pass. RevenueCat can take a few seconds to see a brand-new purchase, so retry.
  const redeem = async (productId: string) => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const payload = await postJson<T>('/api/leagues/passes/redeem', { productId, action: action() });
        onSession(payload);
        onClose();
        return;
      } catch (err) {
        lastError = err as Error;
        if (!/couldn't confirm/i.test(lastError.message)) break;
        await wait(2000);
      }
    }
    throw lastError ?? new Error('Unable to use that pass.');
  };

  const buy = async (productId: string) => {
    setBusy(productId);
    setError('');
    try {
      await postJson('/api/leagues/passes/check', { productId, action: action() });
      const paid = await buyProduct(userId, productId);
      if (!paid) return;
      try {
        await redeem(productId);
      } catch (err) {
        setError(`Your purchase went through, but we couldn't finish setting it up (${(err as Error).message}). It's saved as an unused pass: reopen this screen in a minute and tap "Use".`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const applyUnusedPass = async (productId: string) => {
    setBusy(productId);
    setError('');
    try {
      await redeem(productId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const productIds = new Set(options.map((option) => option.productId));
  const usableUnused = unused.filter((pass) => productIds.has(pass.productId));
  const title = mode.kind === 'create' ? 'Create a league' : mode.kind === 'upgrade' ? 'Upgrade your league' : 'Renew your league';
  const intro =
    mode.kind === 'create'
      ? `A season pass covers your league for the ${season ?? ''} majors season. Pick the size you need; you can upgrade later and only pay the difference.`
      : mode.kind === 'upgrade'
        ? `${mode.leagueName} has ${mode.memberCount} members. Pick a bigger size; you only pay the difference.`
        : `${mode.leagueName}'s pass has expired. Renew it for the ${season ?? ''} season (it has ${mode.memberCount} members).`;
  const nameMissing = mode.kind === 'create' && name.trim().length < 3;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.45)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: 'min(460px, calc(100vw - 32px))', maxHeight: 'calc(100svh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.3)' }}>
        <div style={{ background: navy, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 900 }}>{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 16 }}>
          <div style={{ fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>{intro}</div>

          {/* Name and unused (already paid) passes work anywhere; buying a new pass is app-only. */}
          {purchasesAvailable || usableUnused.length > 0 ? (
            <>
              {mode.kind === 'create' ? (
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="League name" maxLength={60} style={inputStyle} />
              ) : null}

              {usableUnused.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#1f8d4e', letterSpacing: '0.04em' }}>You have an unused pass</div>
                  {usableUnused.map((pass) => {
                    const product = parsePassProduct(pass.productId);
                    const label = product?.kind === 'upgrade' ? `Upgrade ${product.from} → ${product.to} members` : `Season pass · up to ${product?.kind === 'season' ? product.tier : ''} members`;
                    return (
                      <button key={pass.id} type="button" disabled={busy !== null || nameMissing} onClick={() => void applyUnusedPass(pass.productId)}
                        style={{ textAlign: 'left', borderRadius: 14, padding: '12px 14px', border: '2px solid #1f8d4e', background: '#f1f8f4', cursor: busy || nameMissing ? 'not-allowed' : 'pointer', opacity: nameMissing ? 0.6 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 800, color: '#0f1720' }}>{label}</span>
                        <span style={{ fontWeight: 800, color: '#1f8d4e' }}>{busy === pass.productId ? 'Applying…' : 'Use'}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

            </>
          ) : null}

          {!purchasesAvailable && error ? <div style={{ fontSize: 13, color: '#a61b1b', lineHeight: 1.5 }}>{error}</div> : null}

          {!purchasesAvailable ? (
            <div style={{ border: '1px solid #d7e0e8', borderRadius: 14, padding: 14, background: '#f4f7fa', fontSize: 14, color: '#0f1720', lineHeight: 1.5 }}>
              New league passes are bought in the <b>Golf Majors Pool</b> iPhone app. Open the app and sign in with this account to buy one.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 8 }}>
                {options.map((option) => {
                  const active = selected === option.productId;
                  const price = prices.get(option.productId)?.priceString ?? `$${option.usd.toFixed(2)}`;
                  return (
                    <button key={option.productId} type="button" onClick={() => setSelected(option.productId)}
                      style={{ textAlign: 'left', borderRadius: 14, padding: '12px 14px', border: active ? `2px solid ${navy}` : '1px solid #d7e0e8', background: active ? '#eef4fb' : '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active ? navy : '#c3cfda'}`, background: active ? navy : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {active ? <Check size={12} color="#fff" /> : null}
                        </span>
                        <span style={{ fontWeight: 800, color: '#0f1720' }}>{option.label}</span>
                      </span>
                      <span style={{ fontWeight: 900, color: navy }}>{price}</span>
                    </button>
                  );
                })}
              </div>

              {error ? <div style={{ fontSize: 13, color: '#a61b1b', lineHeight: 1.5 }}>{error}</div> : null}

              <button type="button" disabled={!selected || busy !== null || nameMissing} onClick={() => selected && void buy(selected)}
                style={{ border: 'none', borderRadius: 14, padding: '13px 16px', background: navy, color: '#fff', fontSize: 15, fontWeight: 800, cursor: !selected || busy || nameMissing ? 'not-allowed' : 'pointer', opacity: !selected || nameMissing ? 0.5 : busy ? 0.7 : 1 }}>
                {busy && busy === selected ? 'Processing…' : mode.kind === 'create' ? 'Pay and create league' : mode.kind === 'upgrade' ? 'Pay and upgrade' : 'Pay and renew'}
              </button>
              <div style={{ fontSize: 12, color: '#5b6b79', lineHeight: 1.5 }}>
                One-time purchase through Apple, for this league and season only. Nothing renews automatically. The app never collects or pays out prize money.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
