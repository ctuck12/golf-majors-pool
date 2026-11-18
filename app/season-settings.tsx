'use client';

import { useState } from 'react';
import type { PayoutPlan } from './lib/payout-plan';
import { PlanEditor } from './payout-plan-ui';
import { Modal, sectionLabel } from './venmo-ui';

// Commissioner tool: the season championship. Season standings always show (points added up
// across the majors); a season buy-in is optional, and its pot is split by its own payout plan.
export function SeasonSettingsModal<P>({
  fee,
  plan,
  memberCount,
  onPool,
  onClose,
}: {
  fee: number | null;
  plan: PayoutPlan | null;
  memberCount: number;
  onPool: (pool: P) => void;
  onClose: () => void;
}) {
  const [feeInput, setFeeInput] = useState(fee ? String(fee) : '');
  const [cleared, setCleared] = useState('');
  const parsedFee = Number(feeInput.replace(/[$,\s]/g, '')) || 0;

  const save = async (body: { fee: number | null; plan: PayoutPlan | null }) => {
    const res = await fetch('/api/commissioner/season', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = (await res.json().catch(() => ({}))) as { pool?: P; error?: string };
    if (!res.ok || !payload.pool) throw new Error(payload.error ?? 'Unable to save.');
    onPool(payload.pool);
  };

  return (
    <Modal title="Season Championship" onClose={onClose}>
      <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.55 }}>
        Everyone&apos;s points from each major add up into the <b>Season Standings</b> (in Reports), and the leader after The Open is your season champion. That part is automatic.
      </div>
      <div>
        <label htmlFor="season-fee" style={{ ...sectionLabel, display: 'block' }}>Season buy-in (optional)</label>
        <span style={{ position: 'relative', display: 'block', maxWidth: 180 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7b88', fontWeight: 700 }}>$</span>
          <input
            id="season-fee"
            inputMode="decimal"
            value={feeInput}
            placeholder="None"
            onChange={(e) => { setFeeInput(e.target.value); setCleared(''); }}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d7e0e8', padding: '10px 12px 10px 24px', fontSize: 16 }}
          />
        </span>
        <div style={{ fontSize: 12.5, color: '#6b7b88', marginTop: 6, lineHeight: 1.4 }}>
          A separate prize for the season, collected by you like entry fees. The pot is the buy-in times everyone who plays a major this season.
        </div>
      </div>

      {parsedFee > 0 ? (
        <PlanEditor
          initialPlan={plan}
          fee={parsedFee}
          defaultEntries={Math.max(memberCount, 2)}
          feeWord="buy-in"
          unitWord="players"
          saveLabel="Save season championship"
          onSave={async (draft) => {
            await save({ fee: parsedFee, plan: draft });
            return 'Saved. The season pot and payouts show in Season Standings.';
          }}
        />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {fee ? (
            <button
              type="button"
              onClick={() => void save({ fee: null, plan: null }).then(() => setCleared('Season buy-in removed.')).catch((err) => setCleared(err instanceof Error ? err.message : 'Unable to save.'))}
              style={{ border: '1px solid #d7e0e8', borderRadius: 12, padding: '11px 16px', background: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
            >
              Remove the season buy-in
            </button>
          ) : (
            <div style={{ fontSize: 13.5, color: '#5b6b79' }}>Enter a buy-in to set up a season payout.</div>
          )}
          {cleared ? <div style={{ fontSize: 13, color: '#1f7a4a', fontWeight: 700 }}>{cleared}</div> : null}
        </div>
      )}
    </Modal>
  );
}
