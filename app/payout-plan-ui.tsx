'use client';

import { useState, type CSSProperties } from 'react';
import { Minus, Plus } from 'lucide-react';
import { computePayouts, ordinal, planProblem, type PayoutMode, type PayoutPlan, type PayoutRule } from './lib/payout-plan';
import { formatMoney } from './lib/venmo';
import { ErrorText, Modal, primaryButton, secondaryButton, sectionLabel } from './venmo-ui';
import type { PayoutInfo, TournamentId } from './lib/pool-store-shared';

// Commissioner tool: the league's payout plan (how the pot is split, for every tournament) and,
// for the current tournament, what it pays right now, with exact amounts as a one-off override.

type Amounts = { first: number; second: number; third: number };

const MODE_LABELS: Record<PayoutMode, string> = {
  percent: '% of pot',
  fixed: '$ amount',
  fee: '× entry fee',
  rest: 'The rest',
};

// Starting points when the commissioner picks how many places pay.
const DEFAULT_PLACES: Record<number, PayoutRule[]> = {
  1: [{ mode: 'rest', value: 0 }],
  2: [{ mode: 'percent', value: 65 }, { mode: 'rest', value: 0 }],
  3: [{ mode: 'percent', value: 50 }, { mode: 'percent', value: 30 }, { mode: 'rest', value: 0 }],
};

const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 10,
  border: '1px solid #d7e0e8',
  padding: '10px 12px',
  fontSize: 16,
  background: '#fff',
  color: '#0f1720',
};

function Segmented<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: '#eef3f7', borderRadius: 12, padding: 3, gap: 3 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            style={{ border: 'none', borderRadius: 9, padding: '9px 6px', background: active ? '#fff' : 'transparent', boxShadow: active ? '0 1px 4px rgba(9,34,51,0.15)' : 'none', color: active ? '#0f1720' : '#5b6b79', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AmountsRow({ amounts, places }: { amounts: Amounts; places: number }) {
  const list = [amounts.first, amounts.second, amounts.third].slice(0, places);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${places}, 1fr)`, gap: 8 }}>
      {list.map((amount, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e2e9ef', borderRadius: 12, padding: '9px 6px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#5b6b79', textTransform: 'uppercase' }}>{ordinal(i + 1)}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720', marginTop: 2 }}>{formatMoney(amount)}</div>
        </div>
      ))}
    </div>
  );
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  return payload;
}


// The plan editor (places paid, how each is paid, rounding, a live preview), shared by the
// tournament payout plan and the season championship.
export function PlanEditor({
  initialPlan,
  fee,
  defaultEntries,
  saveLabel,
  onSave,
  feeWord = 'entry fee',
  unitWord = 'entries',
}: {
  initialPlan: PayoutPlan | null;
  fee: number;
  defaultEntries: number;
  saveLabel: string;
  onSave: (plan: PayoutPlan) => Promise<string>;
  feeWord?: string;
  unitWord?: string;
}) {
  const [places, setPlaces] = useState<PayoutRule[]>(initialPlan?.places ?? DEFAULT_PLACES[3]);
  const [roundTo, setRoundTo] = useState<1 | 5 | 10>(initialPlan?.roundTo ?? 5);
  // Value boxes as typed (so "67." can be typed on the way to "67.5").
  const [values, setValues] = useState<string[]>(() => (initialPlan?.places ?? DEFAULT_PLACES[3]).map((p) => (p.mode === 'rest' ? '' : String(p.value))));
  const [previewEntries, setPreviewEntries] = useState(Math.max(defaultEntries, 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const draft: PayoutPlan = { places: places.map((p, i) => ({ mode: p.mode, value: p.mode === 'rest' ? 0 : Number(values[i]) || 0 })), roundTo };
  const problem = planProblem(draft) ?? (draft.places.some((p) => p.mode !== 'rest' && !(p.value > 0)) ? 'Fill in an amount for each place.' : null);
  const hasFixed = draft.places.some((p) => p.mode === 'fixed' || p.mode === 'fee');
  const previewPot = previewEntries * fee;
  const paidPlaces = places.length;

  const setCount = (count: number) => {
    const next = DEFAULT_PLACES[count].map((fallback, i) => places[i] ?? fallback);
    // Keep exactly one "the rest" when there's room for it.
    if (!next.some((p) => p.mode === 'rest') && !next.some((p) => p.mode === 'percent')) next[0] = { mode: 'rest', value: 0 };
    setPlaces(next.slice(0, count));
    setValues((current) => next.slice(0, count).map((p, i) => (p.mode === 'rest' ? '' : current[i] ?? String(p.value))));
    setSaved('');
  };

  const setMode = (index: number, mode: PayoutMode) => {
    setPlaces((current) => current.map((p, i) => (i === index ? { ...p, mode } : p)));
    setSaved('');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      setSaved(await onSave(draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
        <Segmented
          options={[{ value: 1, label: 'Winner takes all' }, { value: 2, label: 'Top 2' }, { value: 3, label: 'Top 3' }]}
          value={paidPlaces}
          onChange={setCount}
        />

        <div style={{ display: 'grid', gap: 8 }}>
          {places.map((rule, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '38px 1fr 104px', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f1720' }}>{ordinal(i + 1)}</div>
              <select aria-label={`How ${ordinal(i + 1)} place is paid`} value={rule.mode} onChange={(e) => setMode(i, e.target.value as PayoutMode)} style={{ ...input, padding: '10px 8px' }}>
                {(Object.keys(MODE_LABELS) as PayoutMode[]).map((mode) => (
                  <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>
                ))}
              </select>
              {rule.mode === 'rest' ? (
                <div style={{ fontSize: 13, color: '#6b7b88', textAlign: 'center' }}>what&apos;s left</div>
              ) : (
                <span style={{ position: 'relative' }}>
                  {rule.mode === 'fixed' ? <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7b88', fontWeight: 700 }}>$</span> : null}
                  <input
                    inputMode="decimal"
                    aria-label={`${ordinal(i + 1)} place ${MODE_LABELS[rule.mode]}`}
                    value={values[i] ?? ''}
                    onChange={(e) => { setValues((v) => v.map((x, j) => (j === i ? e.target.value.replace(/[^0-9.]/g, '') : x))); setSaved(''); }}
                    style={{ ...input, paddingLeft: rule.mode === 'fixed' ? 22 : 12, paddingRight: rule.mode === 'fixed' ? 12 : 28, textAlign: 'right' }}
                  />
                  {rule.mode !== 'fixed' ? <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7b88', fontWeight: 700 }}>{rule.mode === 'percent' ? '%' : '×'}</span> : null}
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12.5, color: '#6b7b88', lineHeight: 1.45 }}>
          <b>× {feeWord}</b>: 2× means that place doubles their money. {hasFixed ? <><b>% of pot</b> splits what&apos;s left after the $ and × {feeWord} amounts. </> : null}
          <b>The rest</b> gets whatever is left over.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#3d4b58', flex: 1 }}>Round to the nearest</span>
          <div style={{ width: 170 }}>
            <Segmented options={[{ value: 1, label: '$1' }, { value: 5, label: '$5' }, { value: 10, label: '$10' }]} value={roundTo} onChange={(v) => { setRoundTo(v); setSaved(''); }} />
          </div>
        </div>

        {/* Preview */}
        <div style={{ background: '#f4f8fb', border: '1px solid #e2e9ef', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...sectionLabel, marginBottom: 0, flex: 1 }}>Try it</span>
            <button type="button" aria-label={`Fewer ${unitWord}`} onClick={() => setPreviewEntries((n) => Math.max(1, n - 1))} style={{ ...secondaryButton, padding: 6, display: 'grid', placeItems: 'center' }}><Minus size={16} /></button>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#0f1720', minWidth: 78, textAlign: 'center' }}>{previewEntries} {unitWord}</span>
            <button type="button" aria-label={`More ${unitWord}`} onClick={() => setPreviewEntries((n) => n + 1)} style={{ ...secondaryButton, padding: 6, display: 'grid', placeItems: 'center' }}><Plus size={16} /></button>
          </div>
          {fee > 0 ? (
            <>
              <div style={{ fontSize: 13.5, color: '#3d4b58' }}>{previewEntries} × {formatMoney(fee)} = <b>{formatMoney(previewPot)}</b> pot</div>
              {problem ? null : <AmountsRow amounts={computePayouts(draft, previewPot, fee)} places={paidPlaces} />}
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#6b7b88' }}>Set {feeWord === 'buy-in' ? 'a buy-in' : 'an entry fee'} to see amounts.</div>
          )}
        </div>

        <ErrorText>{problem ?? error}</ErrorText>
        {saved ? <div style={{ fontSize: 13, color: '#1f7a4a', fontWeight: 700 }}>{saved}</div> : null}
        <button type="button" disabled={busy || !!problem} onClick={() => void save()} style={{ ...primaryButton(busy), opacity: busy || problem ? 0.55 : 1 }}>
          {busy ? 'Saving…' : saveLabel}
        </button>
    </div>
  );
}

export function PayoutPlanModal<P>({
  plan,
  tournamentId,
  tournamentLabel,
  entryFee,
  info,
  payouts,
  memberCount,
  onPool,
  onOpenEntryFees,
  onClose,
}: {
  plan: PayoutPlan | null;
  tournamentId: TournamentId;
  tournamentLabel: string;
  entryFee: number;
  info: PayoutInfo | null;
  payouts: Amounts | null;
  memberCount: number;
  onPool: (pool: P) => void;
  onOpenEntryFees: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<string[]>(() => [payouts?.first, payouts?.second, payouts?.third].map((n) => (n ? String(n) : '')));

  const run = async (action: () => Promise<{ pool: P }>, done: string) => {
    setError('');
    setSaved('');
    setBusy(true);
    try {
      const payload = await action();
      onPool(payload.pool);
      setSaved(done);
      return done;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  };

  const saveManual = () => {
    const [first, second, third] = manual.map((v) => Number(v.replace(/[$,\s]/g, '')) || 0);
    return run(() => patch('/api/commissioner/payouts', { tournamentId, first, second, third }), `${tournamentLabel} amounts saved.`);
  };
  const switchToPlan = () => run(() => patch('/api/commissioner/payouts', { tournamentId, usePlan: true }), `${tournamentLabel} is back on the payout plan.`);

  const current = info;

  return (
    <Modal title="Payouts" onClose={onClose}>
      {/* ── Right now ─────────────────────────────────────────────── */}
      <div style={{ background: '#f4f8fb', border: '1px solid #e2e9ef', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
        <div style={{ ...sectionLabel, marginBottom: 0 }}>{tournamentLabel} right now</div>
        {entryFee > 0 ? (
          <div style={{ fontSize: 14, color: '#3d4b58' }}>
            <b>{current?.entries ?? 0}</b> {current?.entries === 1 ? 'entry' : 'entries'} × {formatMoney(entryFee)} = <b>{formatMoney(current?.pot ?? 0)}</b> pot
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: '#5c4310', lineHeight: 1.45 }}>
            No entry fee is set for {tournamentLabel}, so there&apos;s no pot to split.{' '}
            <button type="button" onClick={onOpenEntryFees} style={{ background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Set entry fees</button>
          </div>
        )}
        {payouts ? (
          <AmountsRow amounts={payouts} places={payouts.third ? 3 : payouts.second ? 2 : 1} />
        ) : (
          <div style={{ fontSize: 13, color: '#6b7b88' }}>Amounts show here once picks are in.</div>
        )}
        <div style={{ fontSize: 12.5, color: '#6b7b88', lineHeight: 1.4 }}>
          {current?.manual
            ? 'You typed these amounts in for this tournament.'
            : plan
              ? 'Worked out from your plan. They update as picks come in and show on the leaderboard.'
              : 'Set a plan below and these work themselves out from the pot.'}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {current?.manual && plan ? (
            <button type="button" disabled={busy} onClick={() => void switchToPlan().catch(() => {})} style={{ background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>
              Use the plan instead
            </button>
          ) : null}
          <button type="button" onClick={() => setManualOpen((open) => !open)} style={{ background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>
            {manualOpen ? 'Hide exact amounts' : 'Set exact amounts for this tournament'}
          </button>
        </div>
        {manualOpen ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <label key={i} style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#5b6b79', textTransform: 'uppercase' }}>{ordinal(i + 1)}</span>
                  <input inputMode="decimal" aria-label={`${ordinal(i + 1)} place amount`} value={manual[i]} placeholder="0" onChange={(e) => setManual((m) => m.map((v, j) => (j === i ? e.target.value : v)))} style={input} />
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: '#6b7b88', lineHeight: 1.4 }}>
              For this tournament only; they stay as typed even if more picks come in. Leave a place at 0 if it doesn&apos;t pay.
            </div>
            <button type="button" disabled={busy} onClick={() => void saveManual().catch(() => {})} style={secondaryButton}>Save exact amounts</button>
          </div>
        ) : null}
        <ErrorText>{error}</ErrorText>
        {saved ? <div style={{ fontSize: 13, color: '#1f7a4a', fontWeight: 700 }}>{saved}</div> : null}
      </div>

      {/* ── The plan ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <div style={sectionLabel}>Payout plan (every tournament)</div>
          <div style={{ fontSize: 13.5, color: '#3d4b58', lineHeight: 1.5 }}>
            Set it once: the pot is the entry fee times the number of entries, and each place&apos;s amount works itself out.
          </div>
        </div>

        <PlanEditor
          initialPlan={plan}
          fee={entryFee}
          defaultEntries={Math.max(info?.entries || memberCount || 10, 1)}
          saveLabel="Save payout plan"
          onSave={async (draft) => {
            const payload = await patch<{ pool: P }>('/api/commissioner/payout-plan', { plan: draft });
            onPool(payload.pool);
            return 'Payout plan saved. Every tournament now uses it.';
          }}
        />
      </div>
    </Modal>
  );
}
