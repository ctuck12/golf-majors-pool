'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import { isNativeApp } from './native-bridge';
import type { LeagueVenmo, PayoutSent, TournamentId } from './lib/pool-store-shared';
import {
  formatMoney,
  formatVenmo,
  normalizeVenmoUsername,
  payoutNote,
  placeLabel,
  venmoPaymentLinks,
  type VenmoPayment,
} from './lib/venmo';

// Venmo screens: adding your Venmo, the reminder to add it, the commissioner's entry fees, and
// paying winners. Payments themselves happen in Venmo: these open it with everything filled in.

const navy = '#173b63';
const venmoBlue = '#008CFF';

type ApiError = { error?: string };

async function sendJson<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) {
    throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  }
  return payload;
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 12,
  border: '1px solid #d7e0e8',
  padding: '12px 14px',
  fontSize: 16,
  background: '#fff',
  color: '#0f1720',
};

const primaryButton = (busy = false, color = navy): CSSProperties => ({
  border: 'none',
  borderRadius: 12,
  padding: '12px 16px',
  background: color,
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  cursor: busy ? 'wait' : 'pointer',
  opacity: busy ? 0.7 : 1,
});

const secondaryButton: CSSProperties = {
  border: '1px solid #d7e0e8',
  borderRadius: 12,
  padding: '11px 16px',
  background: '#fff',
  color: '#0f1720',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  fontWeight: 800,
  color: '#5b6b79',
  letterSpacing: '0.04em',
  marginBottom: 8,
};

// ── Opening Venmo ────────────────────────────────────────────────────────────

function onPhone() {
  if (isNativeApp) return true;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Opens Venmo with the payment filled in: the Venmo app on a phone, venmo.com on a computer.
// If the app doesn't open (Venmo isn't installed), onNotOpened gets the venmo.com link to offer.
export function openVenmoPayment(payment: VenmoPayment, onNotOpened?: (webUrl: string) => void) {
  const { app, web } = venmoPaymentLinks(payment);
  if (!onPhone()) {
    const tab = window.open(web, '_blank');
    if (tab) tab.opener = null;
    else onNotOpened?.(web); // pop-up blocked
    return;
  }

  let left = false;
  const markLeft = () => {
    if (document.visibilityState === 'hidden') left = true;
  };
  document.addEventListener('visibilitychange', markLeft);
  window.addEventListener('pagehide', markLeft);
  window.location.href = app;
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', markLeft);
    window.removeEventListener('pagehide', markLeft);
    if (!left && document.visibilityState === 'visible') onNotOpened?.(web);
  }, 2500);
}

// Shown when the Venmo app didn't open: a link to the same payment on venmo.com.
export function VenmoFallbackNotice({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        zIndex: 1300,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#0f1720',
          color: '#fff',
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 18px 40px rgba(9,34,51,0.35)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4 }}>
          Venmo didn&apos;t open.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#7cc4ff', fontWeight: 800 }}>
            Pay on venmo.com instead
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Shared modal frame ───────────────────────────────────────────────────────

function Modal({ title, onClose, children, zIndex = 1050 }: { title: string; onClose: () => void; children: ReactNode; zIndex?: number }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.5)', zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(460px, calc(100vw - 32px))',
          maxHeight: 'calc(100svh - 32px - var(--safe-y))',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(9,34,51,0.3)',
        }}
      >
        <div style={{ background: navy, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 900 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 18 }}>{children}</div>
      </div>
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div style={{ fontSize: 13, color: '#a61b1b', lineHeight: 1.4 }}>{children}</div>;
}

// ── Your Venmo ───────────────────────────────────────────────────────────────

// Edit the signed-in user's own Venmo. onSession gets the refreshed { user, pool, entries }.
export function VenmoModal<T>({
  open,
  currentVenmo,
  isCommissioner,
  onClose,
  onSession,
}: {
  open: boolean;
  currentVenmo: string | null;
  isCommissioner: boolean;
  onClose: () => void;
  onSession: (payload: T) => void;
}) {
  const [value, setValue] = useState(currentVenmo ? formatVenmo(currentVenmo) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const save = async (next: string) => {
    setError('');
    try {
      normalizeVenmoUsername(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check your Venmo username.');
      return;
    }
    setBusy(true);
    try {
      onSession(await sendJson<T>('/api/account/venmo', { venmo: next }, 'PATCH'));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your Venmo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Your Venmo" onClose={onClose}>
      <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
        {isCommissioner
          ? 'Members pay their entry fee to this Venmo when they submit their roster, and your commissioner can pay you here if you win.'
          : 'Your commissioner pays your winnings to this Venmo, straight from the app.'}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(value);
        }}
        style={{ display: 'grid', gap: 10 }}
      >
        <label htmlFor="venmo-username" style={sectionLabel}>Venmo username</label>
        <input
          id="venmo-username"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="@your-venmo"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          style={inputStyle}
        />
        <div style={{ fontSize: 12.5, color: '#6b7b88', lineHeight: 1.45 }}>
          In Venmo, tap <b>Me</b>: it&apos;s the @name under your photo.
        </div>
        <ErrorText>{error}</ErrorText>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={busy || !value.trim()} style={{ ...primaryButton(busy), flex: 1, opacity: busy || !value.trim() ? 0.6 : 1 }}>
            {busy ? 'Saving…' : 'Save Venmo'}
          </button>
          {currentVenmo ? (
            <button type="button" disabled={busy} onClick={() => void save('')} style={secondaryButton}>
              Remove
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}

// ── Reminder to add your Venmo ───────────────────────────────────────────────

const PROMPT_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

function promptKey(userId: string) {
  return `gmp-venmo-prompt:${userId}`;
}

function promptSnoozed(userId: string) {
  try {
    const raw = window.localStorage.getItem(promptKey(userId));
    return raw ? Date.now() - Number(raw) < PROMPT_SNOOZE_MS : false;
  } catch {
    return false;
  }
}

// A slim card asking someone without a Venmo on their account to add it. "Not now" hides it for
// two weeks on this device.
export function VenmoPrompt({
  userId,
  hasVenmo,
  isCommissioner,
  onAdd,
  compact,
  marginTop = 0,
}: {
  userId: string;
  hasVenmo: boolean;
  isCommissioner: boolean;
  onAdd: () => void;
  compact?: boolean;
  marginTop?: number;
}) {
  const [snoozed, setSnoozed] = useState(true);
  useEffect(() => {
    // localStorage is only readable in the browser, after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnoozed(promptSnoozed(userId));
  }, [userId]);

  if (hasVenmo || snoozed) return null;

  const snooze = () => {
    try {
      window.localStorage.setItem(promptKey(userId), String(Date.now()));
    } catch {
      // Private browsing: it just shows again next time.
    }
    setSnoozed(true);
  };

  return (
    <div
      style={{
        marginTop,
        background: '#fff',
        border: `1px solid ${venmoBlue}40`,
        borderLeft: `4px solid ${venmoBlue}`,
        borderRadius: 14,
        padding: compact ? '10px 12px' : '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        boxShadow: '0 8px 24px rgba(9,34,51,0.06)',
      }}
    >
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#0f1720' }}>Add your Venmo</div>
        <div style={{ fontSize: 13, color: '#4a5a68', lineHeight: 1.4, marginTop: 2 }}>
          {isCommissioner
            ? 'So members can pay their entry fee the moment they submit their roster.'
            : 'So your commissioner can send your winnings straight from the app.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onAdd} style={{ ...primaryButton(false, venmoBlue), padding: '9px 14px', fontSize: 14 }}>
          Add Venmo
        </button>
        <button type="button" onClick={snooze} style={{ ...secondaryButton, padding: '8px 12px', fontSize: 13 }}>
          Not now
        </button>
      </div>
    </div>
  );
}

// ── Entry fees (commissioners) ───────────────────────────────────────────────

type Commissioner = { id: string; name: string; venmo?: string | null };

export function EntryFeesModal<P>({
  open,
  tournaments,
  entryFees,
  commissioners,
  collectorId,
  leagueVenmo,
  currentUserId,
  onClose,
  onPool,
  onAddVenmo,
}: {
  open: boolean;
  tournaments: { id: TournamentId; label: string }[];
  entryFees: Partial<Record<TournamentId, number>>;
  commissioners: Commissioner[];
  collectorId: string | null;
  leagueVenmo: LeagueVenmo | null;
  currentUserId: string;
  onClose: () => void;
  onPool: (pool: P) => void;
  onAddVenmo: () => void;
}) {
  const [fees, setFees] = useState<Record<string, string>>(() =>
    Object.fromEntries(tournaments.map((t) => [t.id, entryFees[t.id] ? String(entryFees[t.id]) : ''])),
  );
  const [collector, setCollector] = useState<string>(leagueVenmo?.userId ?? collectorId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const withVenmo = commissioners.filter((c) => c.venmo);
  const me = commissioners.find((c) => c.id === currentUserId);

  const save = async () => {
    setError('');
    setSaved(false);
    const body: { fees: Record<string, number | null>; collectorId?: string } = { fees: {} };
    for (const t of tournaments) {
      const raw = fees[t.id]?.replace(/[$,\s]/g, '') ?? '';
      if (raw === '') {
        body.fees[t.id] = null;
        continue;
      }
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        setError(`Enter a dollar amount for ${t.label}, or leave it blank.`);
        return;
      }
      body.fees[t.id] = amount;
    }
    if (collector) body.collectorId = collector;
    setBusy(true);
    try {
      const payload = await sendJson<{ pool: P }>('/api/commissioner/entry-fees', body, 'PATCH');
      onPool(payload.pool);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save entry fees.');
    } finally {
      setBusy(false);
    }
  };

  const collectorHandle = withVenmo.find((c) => c.id === collector)?.venmo ?? leagueVenmo?.handle ?? null;

  return (
    <Modal title="Entry Fees & Venmo" onClose={onClose}>
      <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
        When a member submits their roster, Venmo opens with the entry fee and &ldquo;Golf Majors Pool ⛳&rdquo; already filled in
        {collectorHandle ? <>, paying <b>{formatVenmo(collectorHandle)}</b></> : null}.
      </div>

      <div>
        <div style={sectionLabel}>Entry fee per tournament</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {tournaments.map((t) => (
            <label key={t.id} htmlFor={`entry-fee-${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#0f1720' }}>{t.label}</span>
              <span style={{ position: 'relative', width: 120, flexShrink: 0 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7b88', fontWeight: 700 }}>$</span>
                <input
                  id={`entry-fee-${t.id}`}
                  inputMode="decimal"
                  value={fees[t.id] ?? ''}
                  onChange={(event) => {
                    setSaved(false);
                    setFees((current) => ({ ...current, [t.id]: event.target.value }));
                  }}
                  placeholder="None"
                  style={{ ...inputStyle, padding: '10px 12px 10px 24px', textAlign: 'right' }}
                />
              </span>
            </label>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: '#6b7b88', marginTop: 8, lineHeight: 1.4 }}>
          Leave a tournament blank and members just submit, without paying in the app.
        </div>
      </div>

      <div>
        <div style={sectionLabel}>Members pay</div>
        {withVenmo.length === 0 ? (
          <div style={{ background: '#fff7e6', border: '1px solid #f3d38b', borderRadius: 12, padding: 12, fontSize: 13.5, color: '#5c4310', lineHeight: 1.45 }}>
            No commissioner has added a Venmo yet, so members can&apos;t pay in the app.
            {me && !me.venmo ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={onAddVenmo} style={{ ...primaryButton(false, venmoBlue), padding: '9px 14px', fontSize: 14 }}>
                  Add your Venmo
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {commissioners.map((c) => {
              const selected = c.id === collector;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!c.venmo}
                  onClick={() => {
                    setSaved(false);
                    setCollector(c.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    border: selected ? `2px solid ${venmoBlue}` : '1px solid #d7e0e8',
                    background: selected ? '#eef7ff' : '#fff',
                    borderRadius: 12,
                    padding: selected ? '9px 11px' : '10px 12px',
                    cursor: c.venmo ? 'pointer' : 'default',
                    opacity: c.venmo ? 1 : 0.6,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#0f1720' }}>{c.name}</span>
                    <span style={{ display: 'block', fontSize: 13, color: c.venmo ? venmoBlue : '#6b7b88', fontWeight: 700 }}>
                      {c.venmo ? formatVenmo(c.venmo) : 'No Venmo added yet'}
                    </span>
                  </span>
                  {selected ? <Check size={18} color={venmoBlue} /> : null}
                </button>
              );
            })}
            {me && !me.venmo ? (
              <button type="button" onClick={onAddVenmo} style={{ ...secondaryButton, justifySelf: 'start', padding: '8px 12px', fontSize: 13 }}>
                Add your Venmo
              </button>
            ) : null}
          </div>
        )}
      </div>

      <ErrorText>{error}</ErrorText>
      <button type="button" onClick={() => void save()} disabled={busy} style={primaryButton(busy)}>
        {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </Modal>
  );
}

// ── Pay winners (commissioners) ──────────────────────────────────────────────

export type PayWinner = { place: number; userId: string; name: string; venmo: string | null };

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function PayWinnersModal<P>({
  open,
  tournamentId,
  tournamentLabel,
  isFinal,
  winners,
  payouts,
  sent,
  currentUserId,
  onClose,
  onPool,
}: {
  open: boolean;
  currentUserId: string;
  tournamentId: TournamentId;
  tournamentLabel: string;
  isFinal: boolean;
  winners: PayWinner[];
  payouts: { first: number; second: number; third: number } | null;
  sent: PayoutSent[];
  onClose: () => void;
  onPool: (pool: P) => void;
}) {
  const [busyPlace, setBusyPlace] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  if (!open) return null;

  const amounts = [payouts?.first ?? 0, payouts?.second ?? 0, payouts?.third ?? 0];
  const rows = winners
    .filter((w) => w.place >= 1 && w.place <= 3 && amounts[w.place - 1] > 0)
    .map((w) => ({ ...w, amount: amounts[w.place - 1], sent: sent.find((s) => s.place === w.place) ?? null }));

  const record = async (place: number, userId: string | null, amount: number, wasSent: boolean) => {
    setBusyPlace(place);
    setError('');
    try {
      const payload = await sendJson<{ pool: P }>('/api/commissioner/payouts-sent', { tournamentId, place, userId, amount, sent: wasSent });
      onPool(payload.pool);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the payout.');
    } finally {
      setBusyPlace(null);
    }
  };

  const pay = (row: (typeof rows)[number]) => {
    // Open Venmo first, while the tap still counts as the user's action, then record it.
    openVenmoPayment({ recipient: row.venmo, amount: row.amount, note: payoutNote(tournamentId, row.place) }, setFallbackUrl);
    void record(row.place, row.userId, row.amount, true);
  };

  return (
    <Modal title={`Pay Winners · ${tournamentLabel}`} onClose={onClose}>
      {!isFinal ? (
        <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
          You can pay winners once {tournamentLabel} is final and the medals show on the standings.
        </div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
          No payouts are set for {tournamentLabel}. Set the 1st, 2nd and 3rd place amounts in <b>Tournament Payouts</b>, then come back here.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
            Tap <b>Pay</b>{' '}and Venmo opens with the amount and what it&apos;s for filled in. Check it and send.
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((row) => (
              <div key={row.place} style={{ border: '1px solid #dce5ee', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{MEDALS[row.place]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{row.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: row.venmo ? venmoBlue : '#8a6d1d' }}>
                      {row.venmo ? formatVenmo(row.venmo) : 'No Venmo on their account: pick them in Venmo'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f7a3d', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(row.amount)}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7b88', textTransform: 'uppercase' }}>{placeLabel(row.place)} place</div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: '#6b7b88' }}>
                  For: <span style={{ color: '#0f1720', fontWeight: 700 }}>{payoutNote(tournamentId, row.place)}</span>
                </div>
                {row.sent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 800, color: '#0f7a3d' }}>
                      <Check size={16} /> {row.userId === currentUserId ? 'Paid' : 'Opened in Venmo'} {new Date(row.sent.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ flex: 1 }} />
                    {row.userId !== currentUserId ? (
                      <button type="button" onClick={() => pay(row)} style={{ ...secondaryButton, padding: '7px 12px', fontSize: 13 }}>
                        Pay again
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyPlace === row.place}
                      onClick={() => void record(row.place, row.userId, row.amount, false)}
                      style={{ ...secondaryButton, padding: '7px 12px', fontSize: 13 }}
                    >
                      Mark unpaid
                    </button>
                  </div>
                ) : row.userId === currentUserId ? (
                  <button
                    type="button"
                    disabled={busyPlace === row.place}
                    onClick={() => void record(row.place, row.userId, row.amount, true)}
                    style={secondaryButton}
                  >
                    That&apos;s you: mark as paid
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyPlace === row.place}
                    onClick={() => pay(row)}
                    style={{ ...primaryButton(busyPlace === row.place, venmoBlue), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    Pay {formatMoney(row.amount)} on Venmo <ExternalLink size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <VenmoFallbackNotice url={fallbackUrl} onClose={() => setFallbackUrl(null)} />
    </Modal>
  );
}
