'use client';

import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { formatMoney } from './lib/venmo';
import type { PoolInfo } from './pool-data';

// The top of a commissioner's Admin tab: everything a league needs before the season, in order,
// one row and one button each. Replaces the separate banners (renewal, Venmo, season pool) so a
// brand-new commissioner has one obvious place to start. Once the required steps are done it
// shrinks to a single "all set" line.

type Step = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  optional?: boolean;
  urgent?: boolean;
  action: string;
  onClick: () => void;
  secondary?: { label: string; onClick: () => void; busy?: boolean };
};

export function AdminSetupCard({
  pool,
  isMobile,
  onRenew,
  onSeasonPool,
  onNoSeasonPool,
  onEntryFees,
  onPayouts,
  onInvite,
}: {
  pool: PoolInfo;
  isMobile: boolean;
  onRenew: () => void;
  onSeasonPool: () => void;
  onNoSeasonPool: () => Promise<void>;
  onEntryFees: () => void;
  onPayouts: () => void;
  onInvite: () => void;
}) {
  const [noBusy, setNoBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const season = pool.poolSeason ?? new Date().getFullYear();
  const seasonPool = pool.seasonPools?.[season];
  const fees = Object.values(pool.entryFees ?? {}).filter((n): n is number => !!n && n > 0);
  const venmoOn = pool.venmoEnabled !== false;
  const hasPayment = venmoOn ? !!pool.venmo || !!pool.paymentNote : !!pool.paymentNote;
  const members = pool.memberCount ?? 0;

  const steps: Step[] = [];
  if (pool.seasonExpired) {
    steps.push({
      key: 'renew',
      title: `Renew for ${season}`,
      detail: "Members can't make picks or join until you do.",
      done: false,
      urgent: true,
      action: 'Renew',
      onClick: onRenew,
    });
  }
  steps.push({
    key: 'season',
    title: 'Season-long pool?',
    detail: seasonPool === undefined
      ? 'A separate buy-in and prize for the best total across the majors. Most leagues skip it.'
      : seasonPool.enabled
        ? `Yes: ${formatMoney(seasonPool.fee ?? 0)} buy-in.`
        : 'No, tournaments only.',
    done: seasonPool !== undefined,
    action: seasonPool === undefined ? 'Yes' : 'Change',
    onClick: onSeasonPool,
    secondary: seasonPool === undefined
      ? { label: 'No', busy: noBusy, onClick: () => { setNoBusy(true); void onNoSeasonPool().finally(() => setNoBusy(false)); } }
      : undefined,
  });
  steps.push({
    key: 'fees',
    title: 'Entry fees & how members pay',
    detail: fees.length && hasPayment
      ? `${formatMoney(Math.min(...fees))}${Math.max(...fees) !== Math.min(...fees) ? `–${formatMoney(Math.max(...fees))}` : ''} per tournament · ${venmoOn && pool.venmo ? 'paid on Venmo' : 'your payment note'}`
      : fees.length
        ? venmoOn ? 'Add your Venmo, or say how members pay you.' : 'Say how members pay you.'
        : 'Set the fee for each tournament (leave one blank if it’s free).',
    done: fees.length > 0 && hasPayment,
    action: fees.length > 0 && hasPayment ? 'Change' : 'Set up',
    onClick: onEntryFees,
  });
  steps.push({
    key: 'payouts',
    title: 'Payouts',
    detail: pool.payoutPlan ? 'How the pot is split. Amounts work themselves out.' : 'Choose how many places get paid and how much.',
    done: !!pool.payoutPlan,
    action: pool.payoutPlan ? 'Change' : 'Set up',
    onClick: onPayouts,
  });
  steps.push({
    key: 'invite',
    title: 'Invite members',
    detail: members > 1 ? `${members} members so far. Add more any time.` : 'Share your league code or link.',
    done: members > 1,
    optional: true,
    action: 'Invite',
    onClick: onInvite,
  });

  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const allSet = doneCount === required.length;

  if (allSet && !expanded) {
    return (
      <div style={{ borderRadius: 16, padding: isMobile ? '11px 14px' : '13px 18px', background: '#eef8f1', border: '1px solid #bfe3cb', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1f7a4a', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Check size={16} /></span>
        <div style={{ flex: 1, minWidth: 0, fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#14532d' }}>You&apos;re all set for {season}</div>
        <button type="button" onClick={onInvite} style={{ background: 'none', border: 'none', padding: 0, color: '#1f6f45', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Invite</button>
        <span aria-hidden="true" style={{ color: '#9cc9ad' }}>·</span>
        <button type="button" onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', padding: 0, color: '#1f6f45', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Review</button>
      </div>
    );
  }

  return (
    <section style={{ background: '#fff', borderRadius: 20, boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)', overflow: 'hidden' }}>
      <div style={{ padding: isMobile ? '13px 14px 10px' : '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: '#0f1720' }}>{allSet ? `All set for ${season}` : `Get ready for ${season}`}</div>
          <div style={{ fontSize: 12.5, color: '#5b6b79', marginTop: 1 }}>{doneCount} of {required.length} done{allSet ? '' : ' · about 3 minutes'}</div>
        </div>
        {allSet ? (
          <button type="button" onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Hide</button>
        ) : (
          <div style={{ display: 'flex', gap: 4 }} aria-hidden="true">
            {required.map((s) => <span key={s.key} style={{ width: 18, height: 5, borderRadius: 3, background: s.done ? '#1f7a4a' : '#dfe6ec' }} />)}
          </div>
        )}
      </div>
      <div>
        {steps.map((step) => (
          <div key={step.key} style={{ borderTop: '1px solid #eef2f5', padding: isMobile ? '10px 14px' : '12px 20px', display: 'flex', alignItems: 'center', gap: 11, background: step.urgent ? '#fdf3f3' : '#fff' }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
              background: step.done ? '#1f7a4a' : '#fff', border: step.done ? 'none' : `2px solid ${step.urgent ? '#d9534f' : '#c9d4de'}`, color: '#fff',
            }}>
              {step.done ? <Check size={14} /> : null}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: step.urgent ? '#a61b1b' : step.done ? '#3d4b58' : '#0f1720', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{step.title}</span>
                {step.optional ? <span style={{ fontSize: 10.5, fontWeight: 800, color: '#5b6b79', background: '#eef3f7', borderRadius: 999, padding: '2px 7px' }}>OPTIONAL</span> : null}
              </div>
              <div style={{ fontSize: 12.5, color: step.urgent ? '#a61b1b' : '#5b6b79', lineHeight: 1.35, marginTop: 1 }}>{step.detail}</div>
            </div>
            {step.secondary ? (
              <button type="button" disabled={step.secondary.busy} onClick={step.secondary.onClick} style={{ border: '1px solid #cfd8e3', borderRadius: 10, padding: '7px 12px', background: '#fff', color: '#0f1720', fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0, opacity: step.secondary.busy ? 0.6 : 1 }}>
                {step.secondary.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={step.onClick}
              style={step.done
                ? { background: 'none', border: 'none', padding: '7px 2px', color: '#2f5f96', fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2 }
                : { border: 'none', borderRadius: 10, padding: '7px 12px', background: '#173b63', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
            >
              {step.action}{step.done ? <ChevronRight size={14} /> : null}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
