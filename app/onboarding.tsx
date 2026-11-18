'use client';

import { useState, type CSSProperties } from 'react';
import { normalizeVenmoUsername } from './lib/venmo';

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

  const confirm = async () => {
    setError('');
    setNote('');
    setBusy(true);
    try {
      onSession(await post<T>('/api/auth/verify-email', { code }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to confirm your email.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setNote('');
    try {
      await post('/api/auth/verify-email', { resend: true });
      setNote(`New code sent to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a new code.');
    }
  };

  return (
    <section style={card}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f1720' }}>Confirm your email</div>
      <div style={{ fontSize: 15, color: '#3d4b58', lineHeight: 1.5 }}>
        We emailed a 6-digit code to <b>{email}</b>. Enter it here to finish setting up your account.
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
        style={{ display: 'grid', gap: 12 }}
      >
        <input
          id="email-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          aria-label="6-digit code"
          style={{ ...input, fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: 800 }}
        />
        {error ? <div style={{ fontSize: 13, color: '#a61b1b' }}>{error}</div> : null}
        {note ? <div style={{ fontSize: 13, color: '#1f7a4a' }}>{note}</div> : null}
        <button type="submit" disabled={busy || code.length !== 6} style={{ ...primary(busy), opacity: busy || code.length !== 6 ? 0.6 : 1 }}>
          {busy ? 'Checking…' : 'Confirm email'}
        </button>
      </form>
      <div style={{ fontSize: 13, color: '#6b7b88', lineHeight: 1.5 }}>
        No email? Check your spam folder, or{' '}
        <button type="button" onClick={() => void resend()} style={{ ...link, fontSize: 13 }}>send a new code</button>.
      </div>
      <button type="button" onClick={onSignOut} style={{ ...link, fontSize: 13, color: '#6b7b88' }}>
        Wrong email? Sign out and sign up again
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
      <section style={card}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#0f1720' }}>Are you sure?</div>
        <div style={{ fontSize: 15, color: '#3d4b58', lineHeight: 1.55 }}>
          Without your Venmo, your commissioner can&apos;t send your winnings straight from the app, so getting paid takes longer.
          It only takes a few seconds to add.
        </div>
        <button type="button" onClick={() => setWarning(false)} style={primary(false, venmoBlue)}>
          Add my Venmo
        </button>
        <button type="button" onClick={onDone} style={{ ...link, textAlign: 'center' }}>
          Continue without it (you can add it later in your account)
        </button>
        <button type="button" disabled={busy} onClick={() => void noVenmo()} style={{ ...link, textAlign: 'center', color: '#6b7b88' }}>
          I don&apos;t have Venmo
        </button>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f1720' }}>Add your Venmo</div>
      <div style={{ fontSize: 15, color: '#3d4b58', lineHeight: 1.55 }}>
        This is how you get paid if you win: your commissioner sends your winnings to your Venmo right from the app.
        It also lets you pay your entry fee in one tap when you submit your picks.
      </div>
      <div style={{ background: '#f1f7ff', border: '1px solid #cfe3fb', borderRadius: 14, padding: '12px 14px', fontSize: 14, color: '#1d3a5c', lineHeight: 1.5 }}>
        <b>Finding it:</b> open Venmo, tap <b>Me</b>, and your username is the <b>@name</b> under your photo.
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
        <button type="submit" disabled={busy || !value.trim()} style={{ ...primary(busy, venmoBlue), opacity: busy || !value.trim() ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Save Venmo'}
        </button>
      </form>
      <button type="button" onClick={() => setWarning(true)} style={{ ...link, textAlign: 'center' }}>
        Skip for now
      </button>
    </section>
  );
}
