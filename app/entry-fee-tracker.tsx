'use client';

import { useState, type CSSProperties } from 'react';
import { Check, Clock, Mail } from 'lucide-react';
import { formatMoney } from './lib/venmo';
import { ErrorText, Modal, secondaryButton, sectionLabel } from './venmo-ui';
import type { TournamentId } from './lib/pool-store-shared';

// Commissioner tool: who has paid the entry fee for this tournament. Members who paid through
// Submit & Pay (or tapped "I already paid") show as "says paid" until the commissioner confirms
// it against their Venmo. Reminder emails go to members with picks in who haven't paid, or to
// members who haven't made picks.

type Status = 'reported' | 'confirmed' | null;
type Member = { id: string; name: string };

const chip = (bg: string, color: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '3px 9px', background: bg, color, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
});

async function send<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  return payload;
}

export function EntryFeeTracker<P>({
  tournamentId,
  tournamentLabel,
  fee,
  members,
  commissionerId,
  entrants,
  payments,
  onPool,
  onOpenEntryFees,
  onClose,
}: {
  tournamentId: TournamentId;
  tournamentLabel: string;
  fee: number;
  members: Member[];
  commissionerId: string;
  entrants: string[];
  payments: Record<string, 'reported' | 'confirmed'>;
  onPool: (pool: P) => void;
  onOpenEntryFees: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const entered = new Set(entrants);
  // The commissioner collects the money, so they're not on the list.
  const withPicks = members.filter((m) => entered.has(m.id) && m.id !== commissionerId);
  const noPicks = members.filter((m) => !entered.has(m.id) && m.id !== commissionerId);
  const statusOf = (id: string): Status => payments[id] ?? null;
  const order = { null: 0, reported: 1, confirmed: 2 } as const;
  const rows = [...withPicks].sort((a, b) => order[String(statusOf(a.id)) as keyof typeof order] - order[String(statusOf(b.id)) as keyof typeof order] || a.name.localeCompare(b.name));
  const confirmed = withPicks.filter((m) => statusOf(m.id) === 'confirmed').length;
  const reported = withPicks.filter((m) => statusOf(m.id) === 'reported').length;
  const unpaid = withPicks.length - confirmed - reported;

  const setStatus = async (userId: string, status: Status) => {
    setBusy(userId);
    setError('');
    try {
      const payload = await send<{ pool: P }>('/api/commissioner/entry-payments', 'PATCH', { tournamentId, userId, status });
      onPool(payload.pool);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setBusy('');
    }
  };

  const remind = async (kind: 'pay' | 'picks') => {
    setBusy(kind);
    setError('');
    setNote('');
    try {
      const result = await send<{ sent: number; failed: number }>('/api/commissioner/reminders', 'POST', { tournamentId, kind });
      setNote(`Reminder emailed to ${result.sent} ${result.sent === 1 ? 'member' : 'members'}${result.failed ? ` (${result.failed} couldn't be sent)` : ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reminders.');
    } finally {
      setBusy('');
    }
  };

  if (fee <= 0) {
    return (
      <Modal title="Entry Fee Tracker" onClose={onClose}>
        <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
          There&apos;s no entry fee set for {tournamentLabel}.{' '}
          <button type="button" onClick={onOpenEntryFees} style={{ background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Set entry fees</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Entry Fees · ${tournamentLabel}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          ['Paid', confirmed, '#1f7a46'],
          ['Says paid', reported, '#2f5f96'],
          ['Not paid', unpaid, '#a3540d'],
        ].map(([label, count, color]) => (
          <div key={String(label)} style={{ border: '1px solid #e2e9ef', borderRadius: 12, padding: '9px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: String(color) }}>{count}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#5b6b79', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13.5, color: '#3d4b58', lineHeight: 1.5 }}>
        {formatMoney(confirmed * fee)} confirmed of a {formatMoney(withPicks.length * fee)} pot ({withPicks.length} {withPicks.length === 1 ? 'entry' : 'entries'} × {formatMoney(fee)}).
        &ldquo;Says paid&rdquo; means they paid through Submit &amp; Pay or tapped &ldquo;I already paid&rdquo;: check your Venmo, then confirm.
      </div>

      <div>
        <div style={sectionLabel}>Picks in</div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 13.5, color: '#6b7b88' }}>No one has made picks yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {rows.map((m) => {
              const status = statusOf(m.id);
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e8eef3', borderRadius: 12, padding: '8px 10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ marginTop: 3 }}>
                      {status === 'confirmed' ? (
                        <span style={chip('#e9f7ef', '#1f7a46')}><Check size={12} /> Paid</span>
                      ) : status === 'reported' ? (
                        <span style={chip('#eef4ff', '#2f5f96')}><Clock size={12} /> Says paid</span>
                      ) : (
                        <span style={chip('#fff1e0', '#a3540d')}>Not paid</span>
                      )}
                    </div>
                  </div>
                  {status === 'confirmed' ? (
                    <button type="button" disabled={busy === m.id} onClick={() => void setStatus(m.id, null)} style={{ ...secondaryButton, padding: '6px 10px', fontSize: 12.5 }}>Undo</button>
                  ) : (
                    <>
                      {status === 'reported' ? (
                        <button type="button" disabled={busy === m.id} onClick={() => void setStatus(m.id, null)} style={{ ...secondaryButton, padding: '6px 10px', fontSize: 12.5 }}>Not paid</button>
                      ) : null}
                      <button type="button" disabled={busy === m.id} onClick={() => void setStatus(m.id, 'confirmed')} style={{ border: 'none', borderRadius: 10, padding: '7px 11px', background: '#1f8d4e', color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>
                        {status === 'reported' ? 'Confirm' : 'Mark paid'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {noPicks.length ? (
        <div>
          <div style={sectionLabel}>No picks yet ({noPicks.length})</div>
          <div style={{ fontSize: 13.5, color: '#3d4b58', lineHeight: 1.5 }}>{noPicks.map((m) => m.name).join(', ')}</div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={sectionLabel}>Reminders</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" disabled={!!busy || unpaid === 0} onClick={() => void remind('pay')} style={{ ...secondaryButton, opacity: unpaid === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
            <Mail size={15} /> {busy === 'pay' ? 'Sending…' : `Email unpaid (${unpaid})`}
          </button>
          <button type="button" disabled={!!busy || noPicks.length === 0} onClick={() => void remind('picks')} style={{ ...secondaryButton, opacity: noPicks.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
            <Mail size={15} /> {busy === 'picks' ? 'Sending…' : `Email no picks (${noPicks.length})`}
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: '#6b7b88', lineHeight: 1.4 }}>
          A short email from the app, signed with your name. Each reminder can be sent once every 6 hours.
        </div>
        {note ? <div style={{ fontSize: 13, color: '#1f7a46', fontWeight: 700 }}>{note}</div> : null}
      </div>
      <ErrorText>{error}</ErrorText>
    </Modal>
  );
}
