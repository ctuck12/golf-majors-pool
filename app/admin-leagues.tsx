'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { VenmoMark } from './venmo-mark';
import { GmpBadge } from './gmp-badge';
import { FitTitle } from './fit-title';

// App admin only: every league in the app, its plan and commissioner, with the two fixes only the
// admin can make (reassign a league's commissioner, give a paid league a free season).

const navy = '#173b63';

type League = {
  id: string;
  name: string;
  joinCode: string;
  plan: string;
  memberLimit: number | null;
  paidSeason: number | null;
  seasonExpired: boolean;
  memberCount: number;
  createdAt: string;
  commissioner: { id: string; name: string; email: string; venmo: string | null } | null;
};

type Member = { id: string; name: string; email: string; role: 'member' | 'commissioner' };

const small: CSSProperties = { fontSize: 12.5, color: '#5b6b79', lineHeight: 1.45 };
const button = (primary = false): CSSProperties => ({
  border: primary ? 'none' : '1px solid #d7e0e8',
  borderRadius: 10,
  padding: '8px 12px',
  background: primary ? navy : '#fff',
  color: primary ? '#fff' : '#0f1720',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
});

function planLabel(league: League, season: number) {
  if (league.plan === 'founder') return 'Free for life';
  const size = league.memberLimit ? `Up to ${league.memberLimit}` : 'No limit';
  if (league.seasonExpired) return `${size} · ${season} not paid`;
  return `${size} · ${league.paidSeason} season`;
}

export function AdminLeaguesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');

  const load = () =>
    fetch('/api/admin/leagues', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { season?: number; leagues?: League[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setLeagues(data.leagues ?? []);
        if (data.season) setSeason(data.season);
      })
      .catch((err: Error) => setError(err.message));

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open]);

  if (!open) return null;

  const expand = async (id: string) => {
    setNote('');
    setError('');
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setMembers([]);
    setPick('');
    const data = (await fetch(`/api/admin/leagues/${encodeURIComponent(id)}`, { cache: 'no-store' }).then((r) => r.json())) as { members?: Member[] };
    setMembers(data.members ?? []);
  };

  const update = async (id: string, body: object, done: string) => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const res = await fetch(`/api/admin/leagues/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { members?: Member[]; error?: string; demo?: { teams: number; tournaments: string[]; skipped: string[]; standingsSaved: string[] } };
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setMembers(data.members ?? []);
      setNote(data.demo
        ? `${done} ${data.demo.teams} teams across ${data.demo.tournaments.length} majors.${data.demo.skipped.length ? ` Couldn't build (no salary list or final results saved): ${data.demo.skipped.join(', ')}.` : ''} Final standings saved for ${data.demo.standingsSaved.length} of ${data.demo.tournaments.length}${data.demo.standingsSaved.length < data.demo.tournaments.length ? ' (open the other tabs once to save theirs)' : ''}.`
        : done);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shown = (leagues ?? []).filter((league) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [league.name, league.joinCode, league.commissioner?.name, league.commissioner?.email].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px, calc(100vw - 32px))', maxHeight: 'calc(100svh - 32px - var(--safe-y))', overflowY: 'auto', background: '#fff', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.3)' }}>
        <div style={{ background: navy, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 1 }}>
          <FitTitle>All Leagues{leagues ? ` (${leagues.length})` : ''}</FitTitle>
          <GmpBadge height={34} style={{ margin: '-4px 0', marginLeft: 'auto' }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ background: '#f4f7fa', borderRadius: 12, padding: '10px 12px', ...small }}>
            <b style={{ color: '#0f1720' }}>Promo codes:</b> to give someone a free or discounted pass, create an <b>Offer Code</b> for that pass in App Store Connect (In-App Purchases, then the pass, then Offer Codes). They enter it under &ldquo;Have a promo code?&rdquo; on the pay screen. Only you can create them.
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by league, code or commissioner"
            aria-label="Search leagues"
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid #d7e0e8', padding: '10px 12px', fontSize: 15 }}
          />
          {error ? <div style={{ fontSize: 13, color: '#a61b1b' }}>{error}</div> : null}
          {!leagues ? <div style={small}>Loading…</div> : null}
          {shown.map((league) => {
            const expanded = openId === league.id;
            return (
              <div key={league.id} style={{ border: '1px solid #dce5ee', borderRadius: 14, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => void expand(league.id)}
                  style={{ width: '100%', textAlign: 'left', background: expanded ? '#f4f8fc' : '#fff', border: 'none', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#0f1720' }}>{league.name}</div>
                    <div style={small}>
                      {league.commissioner ? league.commissioner.name : 'No commissioner'} · {league.memberCount} member{league.memberCount === 1 ? '' : 's'} · {league.joinCode}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                    background: league.plan === 'founder' ? '#e6f4ea' : league.seasonExpired ? '#fdecec' : '#eef4fb',
                    color: league.plan === 'founder' ? '#1f7a4a' : league.seasonExpired ? '#a61b1b' : navy,
                  }}>
                    {planLabel(league, season)}
                  </span>
                  <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0, color: '#5b6b79' }} />
                </button>
                {expanded ? (
                  <div style={{ padding: '4px 14px 14px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, overflowWrap: 'anywhere' }}>
                    {league.commissioner ? (
                      <div style={small}>
                        Commissioner: <b style={{ color: '#0f1720' }}>{league.commissioner.name}</b> · {league.commissioner.email}
                        {' · '}<VenmoMark tone="blue" /> {league.commissioner.venmo ? `@${league.commissioner.venmo}` : 'not added'}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={pick}
                        onChange={(e) => setPick(e.target.value)}
                        aria-label="New commissioner"
                        style={{ flex: '1 1 200px', minWidth: 0, borderRadius: 10, border: '1px solid #d7e0e8', padding: '8px 10px', fontSize: 14, background: '#fff' }}
                      >
                        <option value="">Choose a member…</option>
                        {members.filter((m) => m.role !== 'commissioner').map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                        ))}
                      </select>
                      <button type="button" disabled={!pick || busy} style={{ ...button(true), opacity: !pick || busy ? 0.5 : 1 }}
                        onClick={() => void update(league.id, { commissionerId: pick }, 'Commissioner changed.')}>
                        Make commissioner
                      </button>
                    </div>
                    {league.plan !== 'founder' && league.seasonExpired ? (
                      <button type="button" disabled={busy} style={{ ...button(), justifySelf: 'start' }}
                        onClick={() => void update(league.id, { freeSeason: true }, `${league.name} has the ${season} season free.`)}>
                        Give the {season} season free
                      </button>
                    ) : null}
                    {/demo/i.test(league.name) && league.id !== 'golf-majors-pool' ? (
                      <div style={{ borderTop: '1px solid #e4ebf2', paddingTop: 10, display: 'grid', gap: 8 }}>
                        <div style={small}>
                          <b style={{ color: '#0f1720' }}>Demo data</b> (for App Review): adds 12 made-up members and {`gives everyone a team in each ${season - 1} major, with fees and payments, so the standings and reports have a full season to show.`} Running it again rebuilds the sample season; this season&apos;s picks are never touched.
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" disabled={busy} style={{ ...button(true), opacity: busy ? 0.5 : 1 }}
                            onClick={() => void update(league.id, { demo: 'fill' }, 'Demo season filled in:')}>
                            {busy ? 'Working…' : 'Fill with demo season'}
                          </button>
                          <button type="button" disabled={busy} style={{ ...button(), opacity: busy ? 0.5 : 1 }}
                            onClick={() => { if (window.confirm('Remove the 12 made-up members and their teams?')) void update(league.id, { demo: 'clear' }, 'Made-up members removed.'); }}>
                            Remove demo members
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {note ? <div style={{ fontSize: 13, color: '#1f7a4a' }}>{note}</div> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
