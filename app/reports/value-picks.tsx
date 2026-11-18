'use client';

import { useState } from 'react';
import { picksSeason } from '../lib/tournament-config';
import { REPORT_TOURNAMENTS, normalizeName, type TournamentId } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Value Picks: which golfers paid off for their salary, as points per $1,000. The best bargains
// float to the top, with how many in the league picked each one.

type Sort = 'value' | 'points' | 'salary';

export function ValuePicksReport({ p }: { p: PoolPage }) {
  const { feeds, salariesFor, playerDirectory, reportEntries, selectedTournament, isMobile, openPlayerPopup } = p;
  const withData = REPORT_TOURNAMENTS.filter((t) => (feeds[t.id]?.players ?? []).length > 0);
  const [tid, setTid] = useState<TournamentId>(withData.some((t) => t.id === selectedTournament) ? selectedTournament : withData[0]?.id ?? selectedTournament);
  const [sort, setSort] = useState<Sort>('value');
  const [showAll, setShowAll] = useState(false);

  const feed = feeds[tid];
  const season = feed?.season ?? picksSeason(tid);
  const salaries = salariesFor(tid, season)?.salaries ?? {};
  const idByName = new Map<string, number>();
  for (const [id, player] of playerDirectory) idByName.set(normalizeName(player.name), id);
  const pickCount = new Map<number, number>();
  for (const entry of reportEntries) for (const id of entry.rosters[tid] ?? []) pickCount.set(id, (pickCount.get(id) ?? 0) + 1);

  const rows = (feed?.players ?? [])
    .map((row) => {
      const id = idByName.get(normalizeName(row.canonicalName ?? '')) ?? null;
      const salary = id != null ? salaries[id] ?? 0 : 0;
      const points = row.scoreBreakdown?.totalPoints ?? 0;
      return { id, name: row.canonicalName ?? '', position: row.position ?? '', salary, points, value: salary > 0 ? points / (salary / 1000) : 0, picks: id != null ? pickCount.get(id) ?? 0 : 0 };
    })
    .filter((r) => r.salary > 0 && r.name)
    .sort((a, b) => (sort === 'value' ? b.value - a.value : sort === 'points' ? b.points - a.points : b.salary - a.salary) || b.points - a.points);
  const shown = showAll ? rows : rows.slice(0, 25);
  const select = { border: '1px solid #cdd9e5', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontWeight: 700, background: '#fff', color: '#0f1720' } as const;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#0f1720' }}>Value Picks</div>
        <div style={{ fontSize: 13, color: '#5b6b79', marginTop: 2 }}>Points per $1,000 of salary: who paid off for their price.</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select value={tid} onChange={(e) => { setTid(e.target.value as TournamentId); setShowAll(false); }} style={select} aria-label="Tournament">
          {REPORT_TOURNAMENTS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={select} aria-label="Sort by">
          <option value="value">Best value</option>
          <option value="points">Most points</option>
          <option value="salary">Highest salary</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>Value picks show once the tournament is under way and the salary list is in.</div>
      ) : (
        <div style={{ border: '1px solid #e2e9ef', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '28px 1fr 62px 54px' : '36px 1fr 80px 90px 80px 80px', gap: 6, padding: '9px 12px', background: '#f4f8fb', fontSize: 11, fontWeight: 800, color: '#5b6b79', textTransform: 'uppercase' }}>
            <span>#</span>
            <span>Golfer</span>
            {!isMobile ? <span style={{ textAlign: 'right' }}>Pos</span> : null}
            <span style={{ textAlign: 'right' }}>Salary</span>
            {!isMobile ? <span style={{ textAlign: 'right' }}>Points</span> : null}
            <span style={{ textAlign: 'right' }}>Pts/$1k</span>
          </div>
          {shown.map((r, i) => (
            <button
              key={r.name}
              type="button"
              onClick={() => { const pl = r.id != null ? playerDirectory.get(r.id) : null; if (pl) openPlayerPopup({ id: r.id!, name: pl.name, pgaTourId: pl.pgaTourId, photoUrl: pl.photoUrl }, 'stats', tid); }}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: isMobile ? '28px 1fr 62px 54px' : '36px 1fr 80px 90px 80px 80px', gap: 6, padding: '9px 12px', border: 'none', borderTop: '1px solid #eef2f5', background: i < 3 && sort === 'value' ? '#f3faf5' : '#fff', textAlign: 'left', alignItems: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: '#8a99a6' }}>{i + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ fontSize: 12, color: '#6b7b88' }}>
                  {isMobile ? `${r.position || '—'} · ${r.points} pts · ` : ''}{r.picks ? `Picked by ${r.picks}` : 'Nobody picked'}
                </span>
              </span>
              {!isMobile ? <span style={{ textAlign: 'right', fontSize: 13, color: '#3d4b58' }}>{r.position || '—'}</span> : null}
              <span style={{ textAlign: 'right', fontSize: 13, color: '#3d4b58' }}>${r.salary.toLocaleString()}</span>
              {!isMobile ? <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#0f1720' }}>{r.points}</span> : null}
              <span style={{ textAlign: 'right', fontSize: 15, fontWeight: 900, color: r.value > 0 ? '#1f7a46' : r.value < 0 ? '#c0271f' : '#5b6b79' }}>{r.value.toFixed(1)}</span>
            </button>
          ))}
          {rows.length > 25 ? (
            <button type="button" onClick={() => setShowAll((v) => !v)} style={{ width: '100%', border: 'none', borderTop: '1px solid #eef2f5', background: '#f8fbfd', padding: 11, fontSize: 13.5, fontWeight: 800, color: '#2f5f96', cursor: 'pointer' }}>
              {showAll ? 'Show top 25' : `Show all ${rows.length} golfers`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
