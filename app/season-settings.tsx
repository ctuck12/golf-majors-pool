'use client';

import { useState } from 'react';
import type { PayoutPlan } from './lib/payout-plan';
import { PlanEditor } from './payout-plan-ui';
import { Modal, sectionLabel } from './venmo-ui';

// Commissioner tool: this season's season-long pool. Asked once a season. Season Standings always
// show in Reports either way; saying yes adds a buy-in and payouts for the places that get paid.
export function SeasonSettingsModal<P>({
  season,
  enabled,
  fee,
  plan,
  memberCount,
  onPool,
  onClose,
}: {
  season: number;
  // This season's answer so far (null: not decided yet).
  enabled: boolean | null;
  fee: number | null;
  plan: PayoutPlan | null;
  memberCount: number;
  onPool: (pool: P) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<boolean | null>(enabled);
  const [feeInput, setFeeInput] = useState(fee ? String(fee) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const parsedFee = Number(feeInput.replace(/[$,\s]/g, '')) || 0;

  const save = async (body: { enabled: boolean; fee: number | null; plan: PayoutPlan | null }) => {
    const res = await fetch('/api/commissioner/season', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = (await res.json().catch(() => ({}))) as { pool?: P; error?: string };
    if (!res.ok || !payload.pool) throw new Error(payload.error ?? 'Unable to save.');
    onPool(payload.pool);
  };

  const choiceButton = (on: boolean) => ({
    flex: 1, padding: '11px 8px', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
    border: choice === on ? '2px solid #173b63' : '1px solid #cfd8e3',
    background: choice === on ? '#eef4fb' : '#fff', color: '#0f1720',
  });

  return (
    <Modal title={`${season} Season Pool`} onClose={onClose}>
      <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.55 }}>
        Is your league running a <b>season-long pool</b> in {season}, with its own buy-in and prize for the best total across the majors? Most leagues just play each tournament.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { setChoice(true); setNote(''); }} style={choiceButton(true)}>Yes, season pool</button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setChoice(false);
            setBusy(true);
            setNote('');
            void save({ enabled: false, fee: null, plan: null })
              .then(() => setNote(`Saved: no season pool in ${season}.`))
              .catch((err) => setNote(err instanceof Error ? err.message : 'Unable to save.'))
              .finally(() => setBusy(false));
          }}
          style={choiceButton(false)}
        >
          No, tournaments only
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: '#6b7b88', lineHeight: 1.45, marginTop: -6 }}>
        Either way, everyone&apos;s points still add up in <b>Season Standings</b>{' '}under Reports. You&apos;ll be asked again next season.
      </div>

      {choice === true ? (
        <>
          <div>
            <label htmlFor="season-fee" style={{ ...sectionLabel, display: 'block' }}>Season buy-in</label>
            <span style={{ position: 'relative', display: 'block', maxWidth: 180 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7b88', fontWeight: 700 }}>$</span>
              <input
                id="season-fee"
                inputMode="decimal"
                value={feeInput}
                placeholder="e.g. 50"
                onChange={(e) => { setFeeInput(e.target.value); setNote(''); }}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: '1px solid #d7e0e8', padding: '10px 12px 10px 24px', fontSize: 16 }}
              />
            </span>
            <div style={{ fontSize: 12.5, color: '#6b7b88', marginTop: 6, lineHeight: 1.4 }}>
              Collected by you like entry fees. The pot is the buy-in times everyone who plays a major this season.
            </div>
          </div>
          {parsedFee > 0 ? (
            <PlanEditor
              initialPlan={plan}
              fee={parsedFee}
              defaultEntries={Math.max(memberCount, 2)}
              feeWord="buy-in"
              unitWord="players"
              saveLabel="Save season pool"
              onSave={async (draft) => {
                await save({ enabled: true, fee: parsedFee, plan: draft });
                return 'Saved. What each place pays shows on Season Standings.';
              }}
            />
          ) : (
            <div style={{ fontSize: 13.5, color: '#5b6b79' }}>Enter the buy-in, then set what each place pays.</div>
          )}
        </>
      ) : null}
      {note ? <div style={{ fontSize: 13, color: note.startsWith('Saved') ? '#1f7a4a' : '#a61b1b', fontWeight: 700 }}>{note}</div> : null}
    </Modal>
  );
}
