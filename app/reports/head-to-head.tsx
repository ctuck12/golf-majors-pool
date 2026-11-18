'use client';

import { useState } from 'react';
import { REPORT_TOURNAMENTS, normalizeName, type TournamentId } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { keyResolver, useLeagueHistory } from './league-history';

// Head-to-Head: two members side by side for a tournament (shared golfers, the ones that split
// them, and the points gap), plus their all-time record against each other in this league.
export function HeadToHeadReport({ p }: { p: PoolPage }) {
  const { feeds, playerDirectory, reportEntries, selectedTournament, sessionUser, isMobile, pool } = p;
  const { events } = useLeagueHistory(pool?.id);
  const members = [...reportEntries].sort((a, b) => a.name.localeCompare(b.name));
  const [aId, setAId] = useState(sessionUser?.id && members.some((m) => m.id === sessionUser.id) ? sessionUser.id : members[0]?.id ?? '');
  const [bId, setBId] = useState(members.find((m) => m.id !== aId)?.id ?? '');
  const [tid, setTid] = useState<TournamentId>(selectedTournament);

  const a = members.find((m) => m.id === aId);
  const b = members.find((m) => m.id === bId);
  const feed = feeds[tid];
  const pointsByName = new Map((feed?.players ?? []).map((row) => [normalizeName(row.canonicalName ?? ''), { points: row.scoreBreakdown?.totalPoints ?? 0, position: row.position ?? '' }]));
  const golfer = (id: number) => {
    const pl = playerDirectory.get(id);
    const live = pl ? pointsByName.get(normalizeName(pl.name)) : undefined;
    return { id, name: pl?.name ?? `#${id}`, points: live?.points ?? 0, position: live?.position ?? '' };
  };
  const rosterA = (a?.rosters[tid] ?? []).map(golfer);
  const rosterB = (b?.rosters[tid] ?? []).map(golfer);
  const idsB = new Set(rosterB.map((g) => g.id));
  const idsA = new Set(rosterA.map((g) => g.id));
  const shared = rosterA.filter((g) => idsB.has(g.id));
  const onlyA = rosterA.filter((g) => !idsB.has(g.id));
  const onlyB = rosterB.filter((g) => !idsA.has(g.id));
  const total = (list: { points: number }[]) => list.reduce((s, g) => s + g.points, 0);
  const totalA = total(rosterA);
  const totalB = total(rosterB);
  const hidden = (a && rosterA.length === 0) || (b && rosterB.length === 0);

  // All-time record: every finished major both played, whoever placed higher wins it.
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  if (events && a && b) {
    const keyOf = keyResolver(events);
    for (const e of events) {
      const ra = e.standings.find((r) => keyOf(r) === `id:${a.id}` || (!r.id && r.name === a.name));
      const rb = e.standings.find((r) => keyOf(r) === `id:${b.id}` || (!r.id && r.name === b.name));
      if (!ra || !rb) continue;
      if (ra.place < rb.place) winsA += 1;
      else if (rb.place < ra.place) winsB += 1;
      else ties += 1;
    }
  }

  const select = { border: '1px solid #cdd9e5', borderRadius: 10, padding: '9px 10px', fontSize: 14, fontWeight: 700, background: '#fff', color: '#0f1720', minWidth: 0, width: '100%' } as const;
  const column = (list: ReturnType<typeof golfer>[], color: string) => (
    <div style={{ display: 'grid', gap: 5 }}>
      {list.length === 0 ? <div style={{ fontSize: 13, color: '#9aa7b2' }}>None</div> : null}
      {list.map((g) => (
        <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 13.5, borderRadius: 9, padding: '6px 9px', background: color }}>
          <span style={{ fontWeight: 700, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
          <span style={{ fontWeight: 800, color: '#173b63', whiteSpace: 'nowrap' }}>{g.points}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#0f1720' }}>Head-to-Head</div>
        <div style={{ fontSize: 13, color: '#5b6b79', marginTop: 2 }}>Any two members, side by side.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
        <select value={aId} onChange={(e) => setAId(e.target.value)} style={select} aria-label="First member">
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <span style={{ fontSize: 13, fontWeight: 900, color: '#8a99a6' }}>vs</span>
        <select value={bId} onChange={(e) => setBId(e.target.value)} style={select} aria-label="Second member">
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <select value={tid} onChange={(e) => setTid(e.target.value as TournamentId)} style={{ ...select, width: 'auto' }} aria-label="Tournament">
        {REPORT_TOURNAMENTS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>

      {a && b && a.id !== b.id ? (
        <>
          {events && winsA + winsB + ties > 0 ? (
            <div style={{ borderRadius: 14, padding: '12px 14px', background: 'linear-gradient(135deg, #173b63 0%, #2f5f96 100%)', color: '#fff', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', textAlign: 'center' }}>
              <div><div style={{ fontSize: 28, fontWeight: 900 }}>{winsA}</div><div style={{ fontSize: 12, opacity: 0.85 }}>{a.name.split(' ')[0]}</div></div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>All-time<br />record{ties ? <><br />{ties} tied</> : null}</div>
              <div><div style={{ fontSize: 28, fontWeight: 900 }}>{winsB}</div><div style={{ fontSize: 12, opacity: 0.85 }}>{b.name.split(' ')[0]}</div></div>
            </div>
          ) : null}

          {hidden ? (
            <div style={{ fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>
              {REPORT_TOURNAMENTS.find((t) => t.id === tid)?.label}: picks show here once both have made picks and picks have locked.
            </div>
          ) : (
            <div style={{ border: '1px solid #e2e9ef', borderRadius: 14, padding: 14, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'center' }}>
                {[[a, totalA], [b, totalB]].map(([m, t]) => (
                  <div key={(m as typeof a).id}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#5b6b79', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(m as typeof a).name}</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: Number(t) >= Math.max(totalA, totalB) && totalA !== totalB ? '#1f7a46' : '#0f1720' }}>{Number(t)}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', fontSize: 13.5, color: '#3d4b58' }}>
                {totalA === totalB ? 'Dead even.' : `${totalA > totalB ? a.name.split(' ')[0] : b.name.split(' ')[0]} leads by ${Math.abs(totalA - totalB)}.`}
                {shared.length ? ` ${shared.length} golfer${shared.length > 1 ? 's' : ''} in common, so it comes down to the other ${6 - shared.length}.` : ' No golfers in common.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {column(onlyA, '#eef4ff')}
                {column(onlyB, '#fff3e8')}
              </div>
              {shared.length ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#5b6b79', textTransform: 'uppercase', marginBottom: 6 }}>Both picked</div>
                  {column(shared, '#f2f5f8')}
                </div>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 14, color: '#5b6b79' }}>Choose two different members.</div>
      )}
    </div>
  );
}
