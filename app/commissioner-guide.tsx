'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { computePayouts, FOUNDER_PAYOUT_PLAN, type PayoutPlan } from './lib/payout-plan';
import { formatMoney } from './lib/venmo';
import { VenmoMark } from './venmo-mark';
import { ErrorText, Modal, primaryButton, secondaryButton } from './venmo-ui';
import type { TournamentId } from './lib/pool-store-shared';

// The Commissioner Guide: how a season runs, in short sections a brand-new commissioner can follow.
// Setup itself lives in the checklist at the top of Admin; this is the reference. The wording
// follows the league's own settings (Venmo on or off, season pool on or off).

const SUGGESTED_FEE = 30;

const h3: CSSProperties = { margin: '0 0 6px', fontSize: 15, fontWeight: 900, color: '#0f1720' };
const p: CSSProperties = { margin: '0 0 10px', fontSize: 14, color: '#3d4b58', lineHeight: 1.55 };
const li: CSSProperties = { fontSize: 14, color: '#3d4b58', lineHeight: 1.5, marginBottom: 6 };
const linkButton: CSSProperties = { background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', textAlign: 'left' };

function Section({ title, subtitle, open, onToggle, children }: { title: string; subtitle: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div style={{ border: '1px solid #e2e9ef', borderRadius: 14, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', background: open ? '#f4f8fb' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0f1720' }}>{title}</div>
          <div style={{ fontSize: 12.5, color: '#6b7b88', marginTop: 2 }}>{subtitle}</div>
        </div>
        <ChevronDown size={18} color="#5b6b79" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>
      {open ? <div style={{ padding: '12px 14px 6px', borderTop: '1px solid #e2e9ef' }}>{children}</div> : null}
    </div>
  );
}


export type GuideStatus = {
  venmoEnabled: boolean;
  seasonPool: boolean | null;
  season: number;
  nextTournamentLabel: string;
  nextPicksOpen: boolean;
};

export function CommissionerGuide<P>({
  status,
  tournaments,
  onPool,
  onClose,
  openEntryFees,
  openPayouts,
  openMessage,
  openSeasonPool,
}: {
  status: GuideStatus;
  tournaments: TournamentId[];
  onPool: (pool: P) => void;
  onClose: () => void;
  openEntryFees: () => void;
  openPayouts: () => void;
  openMessage: () => void;
  openSeasonPool: () => void;
}) {
  const [openSection, setOpenSection] = useState<string | null>('before');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpenSection((current) => (current === key ? null : key));
  const example = computePayouts(FOUNDER_PAYOUT_PLAN, 20 * SUGGESTED_FEE, SUGGESTED_FEE);
  const venmo = status.venmoEnabled;

  const apply = async (key: string, url: string, body: unknown) => {
    setBusy(key);
    setError('');
    try {
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = (await res.json().catch(() => ({}))) as { pool?: P; error?: string };
      if (!res.ok || !payload.pool) throw new Error(payload.error ?? 'Something went wrong.');
      onPool(payload.pool);
      setApplied((a) => ({ ...a, [key]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  const applyPlan = (plan: PayoutPlan) => apply('plan', '/api/commissioner/payout-plan', { plan });
  const applyFees = () => apply('fees', '/api/commissioner/entry-fees', { fees: Object.fromEntries(tournaments.map((t) => [t, SUGGESTED_FEE])) });

  const bullets = (items: ReactNode[]) => (
    <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
      {items.filter(Boolean).map((item, i) => <li key={i} style={li}>{item}</li>)}
    </ul>
  );

  return (
    <Modal title="Commissioner Guide" onClose={onClose}>
      <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
        How a season runs, start to finish. Setup is the checklist at the top of Admin; this is everything else.
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <Section title="1. Before the season" subtitle="Setup, and a proven starting point" open={openSection === 'before'} onToggle={() => toggle('before')}>
          {bullets([
            <>Work through the <b>Get ready</b> checklist at the top of Admin: season pool, entry fees{venmo ? <> and your <VenmoMark tone="blue" /></> : ' and how members pay'}, payouts, then invite your members.</>,
            <>Everything you set shows up for members on the <b>Details</b> tab, so the rules are always in one place.</>,
            <>Agree your house rules up front: pay before the first tee, and what happens with late picks.</>,
          ])}
          <h3 style={h3}>Not sure what to pick? Use ours</h3>
          <p style={p}>{formatMoney(SUGGESTED_FEE)} a tournament, top 3 paid: 3rd doubles their money, 1st gets 67.5% of the rest, 2nd the remainder. With 20 entries that&apos;s 1st {formatMoney(example.first)}, 2nd {formatMoney(example.second)}, 3rd {formatMoney(example.third)}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <button type="button" disabled={!!busy || applied.fees} onClick={() => void applyFees()} style={{ ...secondaryButton, padding: '10px 8px', fontSize: 13.5 }}>
              {applied.fees ? 'Fees set ✓' : busy === 'fees' ? 'Saving…' : `${formatMoney(SUGGESTED_FEE)} every event`}
            </button>
            <button type="button" disabled={!!busy || applied.plan} onClick={() => void applyPlan(FOUNDER_PAYOUT_PLAN)} style={{ ...primaryButton(busy === 'plan'), padding: '10px 8px', fontSize: 13.5 }}>
              {applied.plan ? 'Payouts set ✓' : busy === 'plan' ? 'Saving…' : 'Use these payouts'}
            </button>
          </div>
          <p style={p}>Under 10 people? Top 2 or winner-takes-all keeps prizes worth playing for.</p>
        </Section>

        <Section title="2. Tournament week" subtitle="Picks open Monday, lock Thursday" open={openSection === 'week'} onToggle={() => toggle('week')}>
          {[
            ['Monday', <>Picks open for every league automatically once the field and salaries are set. Send the <b>Message Your Pool</b> text to your group.</>],
            ['Mon – Wed', <>Members pick 6 golfers under the $50,000 cap{venmo ? <> and tap <b>Submit &amp; Pay</b>; <VenmoMark tone="blue" /> opens with the fee filled in</> : <> and pay you the way your payment note says</>}. See who&apos;s in and who&apos;s paid in the <b>Entry Fee Tracker</b>, and send reminders from there.</>],
            ['Thursday', <>Picks lock at the first tee time. Late or wrong picks? <b>Member Management</b> → the member → <b>Manage or Submit Picks</b> (works after the lock too).</>],
            ['Thu – Sun', <>Scoring, bonuses, withdrawals and round leaders update on their own.</>],
            ['Sunday night', <>Results go final and the tiebreaker settles itself. Pay your winners (next section).</>],
          ].map(([day, text]) => (
            <div key={String(day)} style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, padding: '8px 0', borderBottom: '1px solid #eef2f5' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#173b63' }}>{day}</div>
              <div style={{ fontSize: 13.5, color: '#3d4b58', lineHeight: 1.5 }}>{text}</div>
            </div>
          ))}
          <div style={{ padding: '10px 0 8px' }}>
            <button type="button" onClick={openMessage} style={linkButton}>Open Message Your Pool →</button>
            <span style={{ fontSize: 12.5, color: '#6b7b88' }}> · {status.nextTournamentLabel} picks are {status.nextPicksOpen ? 'open' : 'not open yet'}</span>
          </div>
        </Section>

        <Section title="3. After it's final" subtitle="Paying winners and the season race" open={openSection === 'after'} onToggle={() => toggle('after')}>
          {bullets([
            venmo
              ? <>A <b>Pay Winners</b> button shows on your standings (only you see it). Tap Pay next to each winner and <VenmoMark tone="blue" /> opens with the amount and note. Paid another way? Mark it paid.</>
              : <>Pay your winners however your league pays, then open <b>Pay Winners</b> and tap <b>Mark as paid</b> so everyone can see it&apos;s settled.</>,
            <>Final standings are saved to <b>Past Results</b> automatically.</>,
            status.seasonPool
              ? <>Your {status.season} season pool adds every major&apos;s points in <b>Reports → Season Standings</b>, with what each place wins. After The Open, pay the season winners from there.</>
              : <>Points from every major still add up in <b>Reports → Season Standings</b>, just for bragging rights.{status.seasonPool === null ? <> Want a season prize? <button type="button" onClick={openSeasonPool} style={linkButton}>Set up a season pool</button>.</> : null}</>,
          ])}
        </Section>

        <Section title="4. How the money works" subtitle="You collect and pay; the app does the math" open={openSection === 'money'} onToggle={() => toggle('money')}>
          {bullets([
            <>The app never holds or moves money. It works out the pot and each place&apos;s amount, and shows them on the standings.</>,
            <>The pot is the entry fee times the entries, so payouts grow as picks come in. Need a one-off? <b>Payouts</b> → set exact amounts for that tournament.</>,
            venmo
              ? <>Entry fees go to your <VenmoMark tone="blue" />. Rather not use it? Switch it off in <b>Entry Fees</b> and write how members pay you instead.</>
              : <>Venmo is off, so members see your payment note when they submit and on <b>Details</b>. You can switch Venmo on in <b>Entry Fees</b> any time.</>,
            <>Your league&apos;s season pass covers one season (The Players through The Open) and is due each September. We&apos;ll remind you; until it&apos;s renewed, members can&apos;t make picks.</>,
          ])}
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <button type="button" onClick={openEntryFees} style={linkButton}>Entry Fees →</button>
            <button type="button" onClick={openPayouts} style={linkButton}>Payouts →</button>
          </div>
        </Section>

        <Section title="5. Who does what" subtitle="What's automatic, and what's on you" open={openSection === 'roles'} onToggle={() => toggle('roles')}>
          <p style={p}><b>Automatic:</b> the field, salaries, schedule, opening and locking picks, live scoring, withdrawals, the tiebreaker and your league&apos;s history.</p>
          <p style={p}><b>On you:</b> inviting members, the weekly text, collecting fees, paying winners and your house rules. Stepping down? Member Management → the member → Make Commissioner.</p>
          <p style={p}>Scores or the field look wrong? Email support@golfmajorspool.com.</p>
        </Section>
      </div>

      <ErrorText>{error}</ErrorText>
      <button type="button" onClick={onClose} style={secondaryButton}>Close</button>
    </Modal>
  );
}
