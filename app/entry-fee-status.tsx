'use client';

import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { formatMoney } from './lib/venmo';
import { VenmoMark } from './venmo-mark';

// Under a member's submitted picks: whether their entry fee is paid. Paying through Submit & Pay
// (or tapping "I already paid") marks it "waiting for the commissioner"; the commissioner confirms it.
export function EntryFeeStatus({
  fee,
  status,
  canPayInApp,
  paymentNote,
  onPay,
  onReport,
  compact,
}: {
  fee: number;
  status: 'reported' | 'confirmed' | null;
  canPayInApp: boolean;
  paymentNote: string | null;
  onPay: () => void;
  onReport: (paid: boolean) => Promise<void>;
  compact: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const report = async (paid: boolean) => {
    setBusy(true);
    await onReport(paid);
    setBusy(false);
  };
  const box = {
    width: '100%',
    boxSizing: 'border-box' as const,
    borderRadius: 12,
    padding: compact ? '9px 11px' : '11px 14px',
    fontSize: compact ? 13 : 14,
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  };
  const small = { border: 'none', background: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: compact ? 12.5 : 13.5, cursor: busy ? 'wait' : 'pointer' };

  if (status === 'confirmed') {
    return (
      <div style={{ ...box, background: '#e9f7ef', color: '#1f7a46', fontWeight: 800 }}>
        <Check size={16} /> Entry fee paid ({formatMoney(fee)})
      </div>
    );
  }
  if (status === 'reported') {
    return (
      <div style={{ ...box, background: '#eef4ff', color: '#2f5f96' }}>
        <Clock size={16} />
        <span style={{ flex: 1, minWidth: 0 }}><b>{formatMoney(fee)} entry fee:</b> marked paid, waiting for your commissioner to confirm.</span>
        <button type="button" disabled={busy} onClick={() => void report(false)} style={{ ...small, color: '#6b7b88' }}>Undo</button>
      </div>
    );
  }
  return (
    <div style={{ ...box, background: '#fff7e6', color: '#5c4310', border: '1px solid #f3d38b' }}>
      <span style={{ flex: '1 1 100%' }}>
        <b>{formatMoney(fee)} entry fee not paid yet.</b>
        {!canPayInApp && paymentNote ? <> {paymentNote}</> : null}
      </span>
      {canPayInApp ? (
        <button type="button" onClick={onPay} style={{ border: 'none', borderRadius: 10, padding: '7px 12px', background: '#008CFF', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          Pay on <VenmoMark height="0.85em" />
        </button>
      ) : null}
      <button type="button" disabled={busy} onClick={() => void report(true)} style={small}>I already paid</button>
    </div>
  );
}
