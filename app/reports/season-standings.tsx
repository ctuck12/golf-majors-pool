'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { computePayouts, ordinal } from '../lib/payout-plan';
import { formatMoney } from '../lib/venmo';
import { openVenmoPayment } from '../venmo-ui';
import { VenmoMark } from '../venmo-mark';
import { TOURNAMENT_TAB_LOGOS, REPORT_TOURNAMENTS } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { seasonComplete, seasonsIn, seasonStandings, TOURNAMENT_ORDER, useLeagueHistory } from './league-history';
import { TournamentWordmark } from '../tournament-wordmark';

// Season Standings: every member's points added up across the season's majors, the season
// champion once The Open is final, and the season pot (if the commissioner set a buy-in).
export function SeasonStandingsReport({ p }: { p: PoolPage }) {
  const { pool, poolEntries, isMobile, setVenmoFallbackUrl } = p;
  const { events, error } = useLeagueHistory(pool?.id);
  const seasons = events ? seasonsIn(events) : [];
  const [chosen, setChosen] = useState<number | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const season = chosen ?? seasons[0] ?? new Date().getFullYear();

  if (error) return <div style={{ fontSize: 14, color: '#a61b1b' }}>{error}</div>;
  if (!events) return <div style={{ fontSize: 14, color: '#5b6b79' }}>Loading…</div>;

  const names = new Map(poolEntries.map((e) => [e.id, e.name]));
  const venmoById = new Map(poolEntries.map((e) => [e.id, e.venmo ?? null]));
  const rows = seasonStandings(events, season, names);
  const complete = seasonComplete(events, season);
  const played = TOURNAMENT_ORDER.filter((tid) => events.some((e) => e.season === season && e.tournamentId === tid));
  const fee = pool?.seasonFee ?? 0;
  const plan = pool?.seasonPayoutPlan ?? null;
  const pot = fee * rows.length;
  const payouts = fee > 0 && plan ? computePayouts(plan, pot, fee) : null;
  const amounts = payouts ? [payouts.first, payouts.second, payouts.third] : [];
  const isCommissioner = pool?.role === 'commissioner';
  const label = (tid: string) => REPORT_TOURNAMENTS.find((t) => t.id === tid)?.label ?? tid;

  // Equal totals (and wins, and best finish) share a rank.
  const ranks: number[] = [];
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    ranks.push(prev && prev.total === row.total && prev.wins === row.wins && prev.best === row.best ? ranks[i - 1] : i + 1);
  });
  const champions = rows.filter((_, i) => ranks[i] === 1);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#0f1720' }}>Season Standings</div>
          <div style={{ fontSize: 13, color: '#5b6b79', marginTop: 2 }}>Points from every major added up. Updated when each major goes final.</div>
        </div>
        {seasons.length > 1 ? (
          <select value={season} onChange={(e) => setChosen(Number(e.target.value))} style={{ border: '1px solid #cdd9e5', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontWeight: 700, background: '#fff', color: '#0f1720' }}>
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>No majors are final yet for {season}. The season standings start after the first one.</div>
      ) : (
        <>
          {complete && champions.length ? (
            <div style={{ borderRadius: 16, padding: isMobile ? '14px 16px' : '18px 22px', background: 'linear-gradient(135deg, #173b63 0%, #2f5f96 100%)', color: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: isMobile ? 34 : 42, lineHeight: 1 }}>🏆</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>{season} Season Champion{champions.length > 1 ? 's' : ''}</div>
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900 }}>{champions.map((c) => c.name).join(' & ')}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{champions[0].total.toLocaleString()} points across {champions[0].events} majors</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: '#3d4b58' }}>
              {played.length} of 5 majors final: {played.map(label).join(', ')}.
            </div>
          )}

          {payouts ? (
            <div style={{ border: '1px solid #e2e9ef', borderRadius: 14, padding: 14, background: '#f8fbfd', display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13.5, color: '#3d4b58' }}>
                <b>Season pot:</b> {rows.length} players × {formatMoney(fee)} = <b>{formatMoney(pot)}</b>{complete ? '' : ' (so far)'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${plan!.places.length}, 1fr)`, gap: 8 }}>
                {plan!.places.map((_, i) => {
                  const winner = complete ? rows.find((_, j) => ranks[j] === i + 1) : null;
                  const venmo = winner?.id ? venmoById.get(winner.id) ?? null : null;
                  return (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e2e9ef', borderRadius: 12, padding: '9px 8px', textAlign: 'center', display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#5b6b79', textTransform: 'uppercase' }}>{ordinal(i + 1)}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720' }}>{formatMoney(amounts[i] ?? 0)}</div>
                      {winner ? <div style={{ fontSize: 12.5, fontWeight: 700, color: '#173b63', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{winner.name}</div> : null}
                      {winner && isCommissioner && amounts[i] > 0 && pool?.venmoEnabled !== false ? (
                        <button
                          type="button"
                          onClick={() => openVenmoPayment({ recipient: venmo, amount: amounts[i], note: `${season} GMP Season ${ordinal(i + 1)} Place` }, setVenmoFallbackUrl)}
                          style={{ border: 'none', borderRadius: 9, padding: '6px 8px', background: '#008CFF', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        >
                          <span>Pay on <VenmoMark height="0.85em" /></span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div style={{ border: '1px solid #e2e9ef', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '34px 1fr 64px 26px' : '44px 1fr repeat(5, 70px) 80px 26px', gap: 6, padding: '9px 12px', background: '#f4f8fb', fontSize: 11, fontWeight: 800, color: '#5b6b79', textTransform: 'uppercase', alignItems: 'center' }}>
              <span>#</span>
              <span>Member</span>
              {!isMobile ? TOURNAMENT_ORDER.map((tid) => (
                <span key={tid} style={{ textAlign: 'center' }}>
                  {TOURNAMENT_TAB_LOGOS[tid] ? <TournamentWordmark id={tid} alt={label(tid)} width={60} height={20} /> : label(tid)}
                </span>
              )) : null}
              <span style={{ textAlign: 'right' }}>Points</span>
              <span />
            </div>
            {rows.map((row, i) => {
              const open = openKey === row.key;
              return (
                <div key={row.key} style={{ borderTop: '1px solid #eef2f5' }}>
                  <button
                    type="button"
                    onClick={() => setOpenKey(open ? null : row.key)}
                    style={{ width: '100%', display: 'grid', gridTemplateColumns: isMobile ? '34px 1fr 64px 26px' : '44px 1fr repeat(5, 70px) 80px 26px', gap: 6, padding: '10px 12px', background: ranks[i] === 1 ? '#fffaf0' : '#fff', border: 'none', textAlign: 'left', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#173b63' }}>{ranks[i] <= 3 ? ['🥇', '🥈', '🥉'][ranks[i] - 1] : ranks[i]}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                      <span style={{ fontSize: 12, color: '#6b7b88' }}>
                        {row.events} {row.events === 1 ? 'major' : 'majors'}{row.wins ? ` · ${row.wins} ${row.wins === 1 ? 'win' : 'wins'}` : ''}{row.podiums - row.wins > 0 ? ` · ${row.podiums - row.wins} top-3` : ''}
                      </span>
                    </span>
                    {!isMobile ? TOURNAMENT_ORDER.map((tid) => {
                      const r = row.byTournament[tid];
                      return <span key={tid} style={{ textAlign: 'center', fontSize: 13, color: r ? '#0f1720' : '#b6c2cc', fontWeight: r?.place === 1 ? 900 : 600 }}>{r ? r.points.toLocaleString() : '—'}</span>;
                    }) : null}
                    <span style={{ textAlign: 'right', fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{row.total.toLocaleString()}</span>
                    <ChevronDown size={16} color="#8a99a6" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
                  </button>
                  {open ? (
                    <div style={{ padding: '4px 12px 12px 52px', display: 'grid', gap: 4, background: '#fbfdfe' }}>
                      {TOURNAMENT_ORDER.map((tid) => {
                        const r = row.byTournament[tid];
                        return (
                          <div key={tid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: r ? '#3d4b58' : '#9aa7b2' }}>
                            <span>{label(tid)}</span>
                            <span>{r ? `${ordinal(r.place)} · ${r.points.toLocaleString()} pts` : 'Not played / not final'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
