'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { normalizeVenmoUsername } from './lib/venmo';
import { VenmoMark } from './venmo-mark';

// New-account steps after signing up: confirm the email with the emailed code, then add Venmo.

const navy = '#173b63';
const venmoBlue = '#008CFF';

const card: CSSProperties = {
  marginTop: 16,
  background: '#fff',
  borderRadius: 22,
  boxShadow: '0 18px 40px rgba(9,34,51,0.1)',
  padding: '22px 20px',
  display: 'grid',
  gap: 14,
  maxWidth: 460,
  marginLeft: 'auto',
  marginRight: 'auto',
};

const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 14,
  border: '1px solid #d7e0e8',
  padding: '13px 14px',
  fontSize: 16,
  background: '#fff',
  color: '#0f1720',
};

const primary = (busy: boolean, color = navy): CSSProperties => ({
  border: 'none',
  borderRadius: 14,
  padding: '13px 16px',
  background: color,
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  cursor: busy ? 'wait' : 'pointer',
  opacity: busy ? 0.7 : 1,
});

const link: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#2f5f96',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  textAlign: 'left',
};

async function post<T>(url: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  return payload;
}

// ── Confirm your email ───────────────────────────────────────────────────────

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

// Six digit boxes over one real input: typing, paste and iPhone's "From Mail" autofill all fill
// it, the next empty box is highlighted, and the code submits on its own once it's complete.
export function VerifyEmailGate<T>({
  email,
  onSession,
  onSignOut,
}: {
  email: string;
  onSession: (payload: T) => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [focused, setFocused] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const confirm = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    setError('');
    setNote('');
    setBusy(true);
    try {
      onSession(await post<T>('/api/auth/verify-email', { code: value }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code didn’t work. Try again.');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setNote('');
    try {
      await post('/api/auth/verify-email', { resend: true });
      setNote('A new code is on its way.');
      setResendIn(RESEND_SECONDS);
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a new code.');
    }
  };

  const onChange = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(next);
    setError('');
    if (next.length === CODE_LENGTH) void confirm(next);
  };

  const active = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <section style={{ ...card, padding: '30px 24px 26px', gap: 0, textAlign: 'center', justifyItems: 'center' }}>
      <style>{'@keyframes gmpCaret{0%,49%{opacity:1}50%,100%{opacity:0}}'}</style>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #173b63 0%, #2f5f96 100%)', display: 'grid', placeItems: 'center', boxShadow: '0 10px 24px rgba(23,59,99,0.28)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="3" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>
      <div style={{ marginTop: 18, fontSize: 24, fontWeight: 900, color: '#0f1720', letterSpacing: '-0.01em' }}>Check your email</div>
      <div style={{ marginTop: 8, fontSize: 15, color: '#5b6b79', lineHeight: 1.5 }}>
        Enter the 6-digit code we sent to
        <div style={{ marginTop: 2, fontWeight: 800, color: '#0f1720', overflowWrap: 'anywhere' }}>{email}</div>
      </div>

      <label htmlFor="email-code" style={{ position: 'relative', display: 'block', marginTop: 24, width: '100%', maxWidth: 360, cursor: 'text' }}>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>6-digit code</span>
        <input
          id="email-code"
          ref={inputRef}
          value={code}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          autoFocus
          disabled={busy}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, fontSize: 16, border: 'none', padding: 0, zIndex: 1, caretColor: 'transparent' }}
        />
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${CODE_LENGTH}, minmax(0, 1fr))`, gap: 8 }}>
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const digit = code[i] ?? '';
            const isActive = focused && i === active && !busy;
            const borderColor = error ? '#d64545' : isActive ? '#2f5f96' : digit ? '#173b63' : '#d7e0e8';
            return (
              <div
                key={i}
                style={{
                  height: 58,
                  borderRadius: 14,
                  border: `2px solid ${borderColor}`,
                  background: digit ? '#f4f8fc' : '#ffffff',
                  boxShadow: isActive ? '0 0 0 4px rgba(47,95,150,0.15)' : 'none',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#0f1720',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              >
                {digit || (isActive && code.length < CODE_LENGTH ? <span style={{ width: 2, height: 26, background: '#2f5f96', animation: 'gmpCaret 1s step-end infinite' }} /> : null)}
              </div>
            );
          })}
        </div>
      </label>

      <div style={{ minHeight: 22, marginTop: 12, fontSize: 13.5, fontWeight: 600, color: error ? '#c0392b' : '#1f7a4a' }}>
        {busy ? 'Checking…' : error || note}
      </div>

      <button
        type="button"
        onClick={() => void confirm(code)}
        disabled={busy || code.length !== CODE_LENGTH}
        style={{ ...primary(busy), width: '100%', maxWidth: 360, marginTop: 6, padding: '14px 16px', opacity: busy || code.length !== CODE_LENGTH ? 0.5 : 1, cursor: busy || code.length !== CODE_LENGTH ? 'default' : 'pointer' }}
      >
        {busy ? 'Verifying…' : 'Verify email'}
      </button>

      <div style={{ marginTop: 18, fontSize: 14, color: '#5b6b79', display: 'grid', gap: 6, justifyItems: 'center' }}>
        <span>Didn’t get it? Check your spam folder.</span>
        {resendIn > 0 ? (
          <span style={{ color: '#8a99a6', fontWeight: 700 }}>Resend code in {resendIn}s</span>
        ) : (
          <button type="button" onClick={() => void resend()} style={{ ...link, fontSize: 14 }}>Resend code</button>
        )}
      </div>
      <button type="button" onClick={onSignOut} style={{ ...link, marginTop: 10, fontSize: 13, color: '#6b7b88', fontWeight: 600 }}>
        Use a different email
      </button>
    </section>
  );
}

// ── Add your Venmo ───────────────────────────────────────────────────────────

// Shown once, right after the email is confirmed. Skipping asks them to think again, since Venmo
// is how winnings get paid; "I don't have Venmo" stops the app asking.
export function VenmoSetupStep<T>({
  onSession,
  onDone,
}: {
  onSession: (payload: T) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(false);

  const save = async () => {
    setError('');
    try {
      normalizeVenmoUsername(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check your Venmo username.');
      return;
    }
    setBusy(true);
    try {
      onSession(await post<T>('/api/account/venmo', { venmo: value }, 'PATCH'));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your Venmo.');
    } finally {
      setBusy(false);
    }
  };

  const noVenmo = async () => {
    setBusy(true);
    try {
      onSession(await post<T>('/api/account/venmo', { declined: true }, 'PATCH'));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (warning) {
    return (
      <section style={{ ...card, textAlign: 'center', justifyItems: 'center', gap: 16 }}>
        <div style={{ borderRadius: 18, background: venmoBlue, padding: '16px 22px', display: 'grid', placeItems: 'center' }}>
          <VenmoMark height="26px" />
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#0f1720' }}>Skip getting paid in the app?</div>
        <div style={{ fontSize: 15, color: '#3d4b58', lineHeight: 1.55, maxWidth: 340 }}>
          Your commissioner sends winnings straight to your <VenmoMark tone="blue" />. Without it, getting paid takes longer.
        </div>
        <button type="button" onClick={() => setWarning(false)} style={{ ...primary(false, venmoBlue), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <span>Add my <VenmoMark /></span>
        </button>
        <button type="button" onClick={onDone} style={{ width: '100%', border: '1px solid #d7e0e8', borderRadius: 14, padding: '12px 16px', background: '#fff', color: '#0f1720', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          Skip for now
        </button>
        <button type="button" disabled={busy} onClick={() => void noVenmo()} style={{ ...link, fontSize: 13, color: '#6b7b88', textAlign: 'center', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          I don&apos;t use <VenmoMark tone="blue" height="0.8em" />
        </button>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f1720', display: 'flex', alignItems: 'center', gap: 7 }}><span>Add your <VenmoMark tone="blue" /></span></div>
      <div style={{ fontSize: 15, color: '#3d4b58', lineHeight: 1.55 }}>
        This is how you get paid if you win: your commissioner sends your winnings to your <VenmoMark tone="blue" /> right from the app.
        It also lets you pay your entry fee in one tap when you submit your picks.
      </div>
      <div style={{ background: '#f1f7ff', border: '1px solid #cfe3fb', borderRadius: 14, padding: '12px 14px', fontSize: 14, color: '#1d3a5c', lineHeight: 1.5 }}>
        <b>Finding it:</b> open <VenmoMark tone="blue" />, tap <b>Me</b>, and your username is the <b>@name</b> under your photo.
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        style={{ display: 'grid', gap: 12 }}
      >
        <input
          id="onboarding-venmo"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="@your-venmo"
          aria-label="Venmo username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={input}
        />
        {error ? <div style={{ fontSize: 13, color: '#a61b1b' }}>{error}</div> : null}
        <button type="submit" disabled={busy || !value.trim()} style={{ ...primary(busy, venmoBlue), opacity: busy || !value.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          {busy ? 'Saving…' : <span>Save <VenmoMark /></span>}
        </button>
      </form>
      <button type="button" onClick={() => setWarning(true)} style={{ ...link, textAlign: 'center' }}>
        Skip for now
      </button>
    </section>
  );
}
