'use client';

import { useRef, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { buildPoolMessage } from './lib/pool-message';
import { Modal, primaryButton, secondaryButton, sectionLabel } from './venmo-ui';
import type { TournamentId } from './lib/pool-store-shared';

// Commissioner tool: a ready-to-send text for tournament week (lock time, entry fee, Venmo,
// payouts, the link and the league code), filled in from the league's settings. The commissioner
// can tweak it, then copy it or share it straight to Messages.

export type PoolMessageTournament = {
  id: TournamentId;
  label: string; // short, for the picker
  fullName: string; // in the message
  lockAtIso?: string;
  picksOpen: boolean;
};

export function PoolMessageModal({
  tournaments,
  initialTournamentId,
  leagueName,
  joinCode,
  entryFees,
  venmoHandle,
  payouts,
  signOff,
  rosterSize,
  salaryCap,
  onClose,
}: {
  tournaments: PoolMessageTournament[];
  initialTournamentId: TournamentId;
  leagueName: string;
  joinCode: string | null;
  entryFees: Partial<Record<TournamentId, number>>;
  venmoHandle: string | null;
  payouts: Partial<Record<TournamentId, { first: number; second: number; third: number }>>;
  signOff: string | null;
  rosterSize: number;
  salaryCap: number;
  onClose: () => void;
}) {
  const [tournamentId, setTournamentId] = useState<TournamentId>(initialTournamentId);
  const tournament = tournaments.find((t) => t.id === tournamentId) ?? tournaments[0];
  const timeZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  const standard = buildPoolMessage({
    tournamentName: tournament.fullName,
    leagueName,
    lockAtIso: tournament.lockAtIso,
    timeZone,
    entryFee: entryFees[tournament.id] ?? null,
    venmoHandle,
    payouts: payouts[tournament.id] ?? null,
    joinCode,
    signOff,
    rosterSize,
    salaryCap,
  });
  // Edits are kept per tournament until the pop-up closes; switching tournaments shows that one's.
  const [edits, setEdits] = useState<Partial<Record<TournamentId, string>>>({});
  const text = edits[tournament.id] ?? standard;
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers: select the text so a long-press copy works.
      textRef.current?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({ text });
    } catch {
      // Cancelled, or sharing isn't available: nothing to do.
    }
  };

  return (
    <Modal title="Message Your Pool" onClose={onClose}>
      <div style={{ fontSize: 14, color: '#3d4b58', lineHeight: 1.5 }}>
        A ready-made text for tournament week. Copy it into your group text, or edit it first.
      </div>

      <div>
        <div style={sectionLabel}>Tournament</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tournaments.map((t) => {
            const active = t.id === tournament.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTournamentId(t.id)}
                style={{ border: active ? '1.5px solid #173b63' : '1px solid #d7e0e8', background: active ? '#173b63' : '#fff', color: active ? '#fff' : '#0f1720', borderRadius: 999, padding: '7px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {!tournament.picksOpen ? (
        <div style={{ background: '#fff7e6', border: '1px solid #f3d38b', borderRadius: 12, padding: 12, fontSize: 13.5, color: '#5c4310', lineHeight: 1.45 }}>
          Picks aren&apos;t open yet for {tournament.label}. Open them before you send this.
        </div>
      ) : null}

      <div>
        <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span>Message</span>
          {edits[tournament.id] !== undefined ? (
            <button
              type="button"
              onClick={() => setEdits((current) => ({ ...current, [tournament.id]: undefined }))}
              style={{ background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontSize: 12, fontWeight: 800, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}
            >
              Reset to standard
            </button>
          ) : null}
        </div>
        <textarea
          ref={textRef}
          aria-label="Message"
          value={text}
          onChange={(event) => setEdits((current) => ({ ...current, [tournament.id]: event.target.value }))}
          rows={9}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid #d7e0e8', padding: '12px 14px', fontSize: 16, lineHeight: 1.45, color: '#0f1720', background: '#f7fafc', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ fontSize: 12.5, color: '#6b7b88', marginTop: 6, lineHeight: 1.4 }}>
          Lock time is shown in your time zone. Entry fee, Venmo and payouts come from your pool settings.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: canShare ? '1fr 1fr' : '1fr', gap: 10 }}>
        <button type="button" onClick={() => void copy()} style={{ ...primaryButton(), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? 'Copied' : 'Copy text'}
        </button>
        {canShare ? (
          <button type="button" onClick={() => void share()} style={{ ...secondaryButton, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Share2 size={17} />
            Share
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
