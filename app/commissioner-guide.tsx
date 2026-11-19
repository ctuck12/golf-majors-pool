'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { computePayouts, FOUNDER_PAYOUT_PLAN, type PayoutPlan } from './lib/payout-plan';
import { formatMoney } from './lib/venmo';
import { VenmoMark } from './venmo-mark';
import { ErrorText, Modal, primaryButton, secondaryButton } from './venmo-ui';
import type { TournamentId } from './lib/pool-store-shared';

// The Commissioner Guide: a setup checklist that ticks itself off, how the money works, a
// tournament-week playbook, the setup the original pool uses (one tap to copy it), and what the
// app takes care of versus what's on the commissioner.

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

function Step({ done, title, children, action }: { done: boolean; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: '1px solid #eef2f5' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: done ? '#1f8d4e' : '#fff', border: done ? 'none' : '2px solid #c9d5df', marginTop: 1 }}>
        {done ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: done ? '#5b6b79' : '#0f1720', textDecoration: done ? 'line-through' : 'none' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.45, marginTop: 2 }}>{children}</div>
        {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
      </div>
    </div>
  );
}

export type GuideStatus = {
  hasVenmo: boolean;
  hasPaymentNote: boolean;
  hasEntryFees: boolean;
  hasPayoutPlan: boolean;
  memberCount: number;
  nextTournamentLabel: string;
  nextPicksOpen: boolean;
};

export function CommissionerGuide<P>({
  status,
  tournaments,
  onPool,
  onClose,
  openVenmo,
  openEntryFees,
  openPayouts,
  openInvite,
  openMessage,
}: {
  status: GuideStatus;
  tournaments: TournamentId[];
  onPool: (pool: P) => void;
  onClose: () => void;
  openVenmo: () => void;
  openEntryFees: () => void;
  openPayouts: () => void;
  openInvite: () => void;
  openMessage: () => void;
}) {
  const setupDone = [status.hasVenmo || status.hasPaymentNote, status.hasEntryFees, status.hasPayoutPlan, status.memberCount > 1].filter(Boolean).length;
  const [openSection, setOpenSection] = useState<string | null>(setupDone < 4 ? 'setup' : 'week');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpenSection((current) => (current === key ? null : key));
  const example = computePayouts(FOUNDER_PAYOUT_PLAN, 20 * SUGGESTED_FEE, SUGGESTED_FEE);

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

  return (
    <Modal title="Commissioner Guide" onClose={onClose}>
      <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.55 }}>
        Everything you need to run your pool, based on how the original Golf Majors Pool runs. Follow it as is, or change anything to suit your group.
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <Section title="1. Get set up" subtitle={setupDone === 4 ? 'All done ✓' : `${setupDone} of 4 done · about 5 minutes`} open={openSection === 'setup'} onToggle={() => toggle('setup')}>
          <Step
            done={status.hasVenmo || status.hasPaymentNote}
            title="Add your Venmo"
            action={<button type="button" onClick={openVenmo} style={linkButton}>{status.hasVenmo ? 'Change your Venmo' : 'Add your Venmo'} →</button>}
          >
            Entry fees go straight to you. With your Venmo on file, members tap <b>Submit &amp; Pay</b> and Venmo opens with your name, the fee and the note filled in.
            {!status.hasVenmo ? <> No Venmo? Write how members should pay you in <b>Entry Fees</b> instead (see How the money works).</> : null}
          </Step>
          <Step
            done={status.hasEntryFees}
            title="Set your entry fee"
            action={<button type="button" onClick={openEntryFees} style={linkButton}>Open Entry Fees →</button>}
          >
            Set it per tournament (you can leave one blank to skip it). We use {formatMoney(SUGGESTED_FEE)} for every major.
          </Step>
          <Step
            done={status.hasPayoutPlan}
            title="Set your payout plan"
            action={<button type="button" onClick={openPayouts} style={linkButton}>Open Payouts →</button>}
          >
            Choose which places get paid and how. The app works out the dollar amounts from the pot for every tournament. Not sure? Use ours from <b>The original pool&apos;s setup</b> below.
          </Step>
          <Step
            done={status.memberCount > 1}
            title="Invite your members"
            action={<button type="button" onClick={openInvite} style={linkButton}>Get your invite link →</button>}
          >
            Share your league&apos;s invite link or join code. People sign up in the app and land in your league.
            {status.memberCount > 1 ? <> You have {status.memberCount} members.</> : null}
          </Step>
          <Step done={false} title="Each tournament week: send the text" action={<button type="button" onClick={openMessage} style={linkButton}>Open Message Your Pool →</button>}>
            Picks open automatically once the field is set. See the Tournament week playbook below. {status.nextTournamentLabel} picks are {status.nextPicksOpen ? 'open' : 'not open yet'}.
          </Step>
        </Section>

        <Section title="2. How the money works" subtitle="You collect it and pay it out; the app does the math" open={openSection === 'money'} onToggle={() => toggle('money')}>
          <p style={p}><b>All the money goes through you.</b> The app never holds or moves money. It works out the pot and what each place gets, shows it on the leaderboard, and opens the payments for you.</p>
          <h3 style={h3}>Collecting entry fees</h3>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li style={li}>A member picks 6 golfers in the salary cap sheet and taps <b>Submit &amp; Pay</b>. Their picks are saved, then <VenmoMark tone="blue" /> opens with your Venmo, the fee and &ldquo;Golf Majors Pool ⛳&rdquo; filled in. They just hit Pay.</li>
            <li style={li}>That&apos;s why your Venmo matters: without it, members only see a plain Submit button.</li>
            <li style={li}><b>No Venmo?</b> In <b>Entry Fees</b>, write how to pay you, like &ldquo;Cash, or Zelle to Sam at 555-123-4567&rdquo; (Cash App and PayPal work too). Members see it when they submit, on the tournament details and in your weekly text.</li>
            <li style={li}>To check who&apos;s paid, compare your Venmo (or Zelle) with the entries in <b>Member Management</b>.</li>
          </ul>
          <h3 style={h3}>The pot and payouts</h3>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li style={li}>The pot is the entry fee times the number of people with picks in. It grows as picks come in, and each place&apos;s amount updates on its own.</li>
            <li style={li}>Amounts are rounded (to $5 by default), and whatever rounding leaves over goes to the place set to &ldquo;the rest&rdquo;.</li>
            <li style={li}>Need a one-off? In <b>Payouts</b>, &ldquo;Set exact amounts for this tournament&rdquo; overrides the plan for that event only.</li>
          </ul>
          <h3 style={h3}>Paying winners</h3>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li style={li}>When the tournament is final, a <b>Pay Winners</b> button shows under the tournament name on your standings (only you see it).</li>
            <li style={li}>Tap Pay next to each winner and Venmo opens with their name, the amount and a note like &ldquo;Masters GMP 1st Place&rdquo;. Paid them in cash or Zelle? Tap &ldquo;Paid another way&rdquo;.</li>
            <li style={li}>The button goes away once every place is paid, or after 48 hours. Pay Winners stays in your tools after that.</li>
          </ul>
        </Section>

        <Section title="3. Tournament week playbook" subtitle="What to do, day by day" open={openSection === 'week'} onToggle={() => toggle('week')}>
          {[
            ['Monday', <>The field and salaries go up and picks open in every league automatically. Send the <b>Message Your Pool</b> text to your group chat.</>],
            ['Mon – Wed', <>Members make picks and pay. Check <b>Member Management</b> to see who&apos;s in, and nudge anyone missing. A Wednesday-night reminder helps.</>],
            ['Thursday', <>Picks lock automatically at the first tee time. Nothing to do. If someone texts you picks late, you can enter them for that person in <b>Member Management</b> (your call; set your rule up front).</>],
            ['Thu – Sun', <>Live scoring, points, bonuses and round leaders update on their own. Enjoy it, and expect some trash talk.</>],
            ['Sunday night', <>Results go final and the tiebreaker is settled automatically. Tap <b>Pay Winners</b> under the tournament name.</>],
          ].map(([day, text]) => (
            <div key={String(day)} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 10, padding: '8px 0', borderBottom: '1px solid #eef2f5' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#173b63' }}>{day}</div>
              <div style={{ fontSize: 13.5, color: '#3d4b58', lineHeight: 1.5 }}>{text}</div>
            </div>
          ))}
          <div style={{ height: 6 }} />
        </Section>

        <Section title="4. The original pool's setup" subtitle="Copy it with a tap, or use it as a starting point" open={openSection === 'blueprint'} onToggle={() => toggle('blueprint')}>
          <h3 style={h3}>Entry fee: {formatMoney(SUGGESTED_FEE)} every major</h3>
          <p style={p}>Easy to remember, and easy to pay in one tap.</p>
          <button type="button" disabled={!!busy || applied.fees} onClick={() => void applyFees()} style={{ ...secondaryButton, width: '100%', marginBottom: 14 }}>
            {applied.fees ? `Set to ${formatMoney(SUGGESTED_FEE)} for every tournament ✓` : busy === 'fees' ? 'Saving…' : `Use ${formatMoney(SUGGESTED_FEE)} for every tournament`}
          </button>

          <h3 style={h3}>Payouts: top 3</h3>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
            <li style={li}><b>3rd</b> doubles their money (2× the entry fee).</li>
            <li style={li}><b>1st</b> gets 67.5% of what&apos;s left, which comes out at about double 2nd.</li>
            <li style={li}><b>2nd</b> gets the rest. Rounded to the nearest $5.</li>
          </ul>
          <p style={p}>
            With 20 entries ({formatMoney(20 * SUGGESTED_FEE)} pot): 1st {formatMoney(example.first)}, 2nd {formatMoney(example.second)}, 3rd {formatMoney(example.third)}.
          </p>
          <button type="button" disabled={!!busy || applied.plan} onClick={() => void applyPlan(FOUNDER_PAYOUT_PLAN)} style={{ ...primaryButton(busy === 'plan'), width: '100%', marginBottom: 12 }}>
            {applied.plan ? 'Payout plan set ✓' : busy === 'plan' ? 'Saving…' : 'Use this payout plan'}
          </button>
          <p style={p}>
            <b>Small group (under 10)?</b> Paying the top 2 (1st 65%, 2nd the rest) or winner takes all keeps prizes worth playing for. You can change it any time in <b>Payouts</b>.
          </p>

          <h3 style={h3}>House rules that save headaches</h3>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li style={li}>Pay before the first tee. Submit &amp; Pay makes this automatic for Venmo users.</li>
            <li style={li}>Decide your late-entry rule before the season starts, and tell everyone.</li>
            <li style={li}>Send the weekly text every tournament, even if your group is small: it&apos;s the reminder people need.</li>
            <li style={li}>Pay winners within a day or two of the final round.</li>
          </ul>
        </Section>

        <Section title="5. Who handles what" subtitle="What the app takes care of, and what's on you" open={openSection === 'roles'} onToggle={() => toggle('roles')}>
          <h3 style={h3}>Taken care of for you</h3>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li style={li}>The field and player salaries for every major, plus world rankings, stats and player research in the pick sheet.</li>
            <li style={li}>The schedule, opening picks once the field is set, first tee times and pick locks.</li>
            <li style={li}>Live scoring from ESPN and the PGA Tour, points, bonuses and round leaders.</li>
            <li style={li}>Withdrawals and disqualifications, and the tiebreaker.</li>
            <li style={li}>Past results and season history for your league.</li>
          </ul>
          <h3 style={h3}>On your plate</h3>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li style={li}>Inviting members and answering their questions.</li>
            <li style={li}>Sending the text each tournament week.</li>
            <li style={li}>Collecting entry fees and paying winners (the app sets both up for you).</li>
            <li style={li}>Your league&apos;s rules: entry fee, payouts and late entries.</li>
            <li style={li}>Handing the league to someone else if you step down: Member Management → the member → Make Commissioner.</li>
          </ul>
          <p style={p}>Something looks wrong with scores or the field? Email support@golfmajorspool.com.</p>
        </Section>

        <Section title="6. Scoring in a nutshell" subtitle="For when members ask" open={openSection === 'scoring'} onToggle={() => toggle('scoring')}>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li style={li}>Each member picks 6 golfers whose salaries add up to $50,000 or less.</li>
            <li style={li}>Golfers earn points for every hole (birdie +3, eagle +8, bogey −1 and so on), plus bonuses for birdie streaks, bogey-free rounds and leading after a round.</li>
            <li style={li}>Finishing position adds more: +40 for the win down to +1 for 31st–40th. A missed cut is −10.</li>
            <li style={li}>Ties go to whoever guessed closest to the winner&apos;s total strokes. The full points table is in the app under Points System.</li>
          </ul>
        </Section>
      </div>

      <ErrorText>{error}</ErrorText>
      <button type="button" onClick={onClose} style={secondaryButton}>Close</button>
    </Modal>
  );
}
