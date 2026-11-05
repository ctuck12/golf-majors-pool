'use client';

import { useState, type CSSProperties } from 'react';
import { Check, Copy, LogOut, Plus, Trash2, Users, X } from 'lucide-react';

// League screens: the gate shown to a signed-in user who isn't in a league yet, and the
// "Leagues" panel (switch, join, create, invite, delete account). Both talk to the API and hand
// the refreshed session back through onSession.

export type LeagueSummary = { id: string; name: string; role: 'member' | 'commissioner' };

type SessionLike = { error?: string };

const navy = '#173b63';

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 14,
  border: '1px solid #d7e0e8',
  padding: '12px 14px',
  fontSize: 15,
  background: '#fff',
  color: '#0f1720',
};

const primaryButton = (busy: boolean): CSSProperties => ({
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  background: navy,
  color: '#fff',
  fontSize: 15,
  fontWeight: 800,
  cursor: busy ? 'wait' : 'pointer',
  opacity: busy ? 0.7 : 1,
});

const secondaryButton: CSSProperties = {
  border: '1px solid #d7e0e8',
  borderRadius: 14,
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

async function postJson<T extends SessionLike>(url: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  }
  return payload;
}

export function inviteLinkFor(joinCode: string) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/?join=${encodeURIComponent(joinCode)}`;
}

function JoinForm<T extends SessionLike>({
  initialCode,
  onSession,
  submitLabel = 'Join League',
}: {
  initialCode?: string;
  onSession: (payload: T) => void;
  submitLabel?: string;
}) {
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          onSession(await postJson<T>('/api/pool/join', { joinCode: code }));
          setCode('');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to join.');
        } finally {
          setBusy(false);
        }
      }}
      style={{ display: 'grid', gap: 10 }}
    >
      <input
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="League code"
        autoCapitalize="characters"
        autoComplete="off"
        style={{ ...inputStyle, letterSpacing: '0.12em', fontWeight: 800 }}
      />
      {error ? <div style={{ fontSize: 13, color: '#a61b1b' }}>{error}</div> : null}
      <button type="submit" disabled={busy || !code.trim()} style={primaryButton(busy)}>
        {busy ? 'Joining…' : submitLabel}
      </button>
    </form>
  );
}

function CreateForm<T extends SessionLike>({ onSession }: { onSession: (payload: T) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          onSession(await postJson<T>('/api/leagues', { name }));
          setName('');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to create the league.');
        } finally {
          setBusy(false);
        }
      }}
      style={{ display: 'grid', gap: 10 }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="League name"
        maxLength={60}
        style={inputStyle}
      />
      {error ? <div style={{ fontSize: 13, color: '#a61b1b' }}>{error}</div> : null}
      <button type="submit" disabled={busy || name.trim().length < 3} style={primaryButton(busy)}>
        {busy ? 'Creating…' : 'Create League'}
      </button>
    </form>
  );
}

function InviteBox({ joinCode }: { joinCode: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? joinCode : inviteLinkFor(joinCode));
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard can be blocked; the code stays visible to copy by hand.
    }
  };

  return (
    <div style={{ border: '1.5px solid #d1dae3', borderRadius: 14, padding: 14, background: '#f4f7fa', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>League code</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.14em', color: '#0f1720' }}>{joinCode}</div>
        </div>
        <button type="button" onClick={() => void copy('code')} style={{ ...secondaryButton, display: 'flex', alignItems: 'center', gap: 6 }}>
          {copied === 'code' ? <Check size={16} /> : <Copy size={16} />} Code
        </button>
      </div>
      <button type="button" onClick={() => void copy('link')} style={{ ...primaryButton(false), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}
        {copied === 'link' ? 'Invite link copied' : 'Copy invite link'}
      </button>
      <div style={{ fontSize: 12, color: '#5b6b79', lineHeight: 1.5 }}>
        Friends open the link (or enter the code after signing up) to join your league.
      </div>
    </div>
  );
}

// Signed in, but not in any league yet.
export function LeagueGate<T extends SessionLike>({
  displayName,
  canCreateLeague,
  initialJoinCode,
  onSession,
  onSignOut,
}: {
  displayName: string;
  canCreateLeague: boolean;
  initialJoinCode?: string;
  onSession: (payload: T) => void;
  onSignOut: () => void;
}) {
  return (
    <section style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 'min(480px, calc(100vw - 48px))', background: '#fff', borderRadius: 24, padding: 22, boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)', display: 'grid', gap: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={18} color="#2f5f96" />
            <div style={{ fontSize: 20, fontWeight: 900 }}>Join a league</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>
            Welcome, {displayName}. Enter the league code your commissioner sent you, or open their invite link.
          </div>
        </div>

        <JoinForm<T> initialCode={initialJoinCode} onSession={onSession} />

        {canCreateLeague ? (
          <div style={{ borderTop: '1px solid #e2e8ef', paddingTop: 16 }}>
            <div style={sectionLabel}>Or start your own</div>
            <CreateForm<T> onSession={onSession} />
          </div>
        ) : null}

        <button type="button" onClick={onSignOut} style={{ ...secondaryButton, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </section>
  );
}

// The "Leagues" panel, shown in a modal from the account menu or the Commissioner Hub.
export function LeagueModal<T extends SessionLike>({
  open,
  onClose,
  leagues,
  activeLeagueId,
  activeJoinCode,
  isCommissioner,
  canCreateLeague,
  initialJoinCode,
  onSession,
  onAccountDeleted,
}: {
  open: boolean;
  onClose: () => void;
  leagues: LeagueSummary[];
  activeLeagueId: string | null;
  activeJoinCode: string | null;
  isCommissioner: boolean;
  canCreateLeague: boolean;
  initialJoinCode?: string;
  onSession: (payload: T) => void;
  onAccountDeleted: () => void;
}) {
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!open) return null;

  const handleSession = (payload: T) => {
    onSession(payload);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.45)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100svh - 32px)', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.3)' }}
      >
        <div style={{ background: navy, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 900 }}>Leagues</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 22 }}>
          {leagues.length > 0 ? (
            <div>
              <div style={sectionLabel}>Your leagues</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {leagues.map((league) => {
                  const active = league.id === activeLeagueId;
                  return (
                    <button
                      key={league.id}
                      type="button"
                      disabled={active || switching !== null}
                      onClick={async () => {
                        setSwitching(league.id);
                        setError('');
                        try {
                          handleSession(await postJson<T>('/api/leagues/switch', { leagueId: league.id }));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Unable to switch leagues.');
                        } finally {
                          setSwitching(null);
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        borderRadius: 14,
                        padding: '12px 14px',
                        border: active ? `2px solid ${navy}` : '1px solid #d7e0e8',
                        background: active ? '#eef4fb' : '#fff',
                        cursor: active ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <span>
                        <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#0f1720' }}>{league.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: '#5b6b79', marginTop: 2 }}>
                          {league.role === 'commissioner' ? 'Commissioner' : 'Member'}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: active ? navy : '#5b6b79' }}>
                        {active ? 'Viewing' : switching === league.id ? 'Switching…' : 'Switch'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {error ? <div style={{ marginTop: 8, fontSize: 13, color: '#a61b1b' }}>{error}</div> : null}
            </div>
          ) : null}

          {isCommissioner && activeJoinCode ? (
            <div>
              <div style={sectionLabel}>Invite people to this league</div>
              <InviteBox joinCode={activeJoinCode} />
            </div>
          ) : null}

          <div>
            <div style={sectionLabel}>Join another league</div>
            <JoinForm<T> initialCode={initialJoinCode} onSession={handleSession} />
          </div>

          {canCreateLeague ? (
            <div>
              <div style={sectionLabel}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={12} /> Create a league</span>
              </div>
              <CreateForm<T> onSession={handleSession} />
            </div>
          ) : null}

          <div style={{ borderTop: '1px solid #e2e8ef', paddingTop: 16 }}>
            {!deleteOpen ? (
              <button type="button" onClick={() => setDeleteOpen(true)} style={{ ...secondaryButton, width: '100%', color: '#a61b1b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Trash2 size={16} /> Delete my account
              </button>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, color: '#0f1720', lineHeight: 1.5 }}>
                  This permanently deletes your account and your picks in every league. Type <b>DELETE</b> to confirm.
                </div>
                <input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="DELETE" style={inputStyle} />
                {deleteError ? <div style={{ fontSize: 13, color: '#a61b1b' }}>{deleteError}</div> : null}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { setDeleteOpen(false); setDeleteText(''); setDeleteError(''); }} style={{ ...secondaryButton, flex: 1 }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteText !== 'DELETE' || deleteBusy}
                    onClick={async () => {
                      setDeleteBusy(true);
                      setDeleteError('');
                      try {
                        await postJson<SessionLike>('/api/account', { confirm: 'DELETE' }, 'DELETE');
                        onClose();
                        onAccountDeleted();
                      } catch (err) {
                        setDeleteError(err instanceof Error ? err.message : 'Unable to delete your account.');
                      } finally {
                        setDeleteBusy(false);
                      }
                    }}
                    style={{ ...primaryButton(deleteBusy), flex: 1, background: '#b42318', opacity: deleteText === 'DELETE' ? 1 : 0.5 }}
                  >
                    {deleteBusy ? 'Deleting…' : 'Delete forever'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
