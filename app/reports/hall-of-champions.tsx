'use client';

import { TOURNAMENT_TAB_LOGOS, REPORT_TOURNAMENTS } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { keyResolver, seasonComplete, seasonsIn, seasonStandings, TOURNAMENT_ORDER, useLeagueHistory, type HistoryRow } from './league-history';
import { TournamentWordmark } from '../tournament-wordmark';

// Hall of Champions: the league's winners. Most titles across every season at the top, then each
// season's champion and the winner of every major.
export function HallOfChampionsReport({ p }: { p: PoolPage }) {
  const { pool, poolEntries, isMobile } = p;
  const { events, error } = useLeagueHistory(pool?.id);

  if (error) return <div style={{ fontSize: 14, color: '#a61b1b' }}>{error}</div>;
  if (!events) return <div style={{ fontSize: 14, color: '#5b6b79' }}>Loading…</div>;

  const names = new Map(poolEntries.map((e) => [e.id, e.name]));
  const display = (r: HistoryRow) => (r.id && names.get(r.id)) || r.name;
  const label = (tid: string) => REPORT_TOURNAMENTS.find((t) => t.id === tid)?.label ?? tid;
  const seasons = seasonsIn(events);

  // Titles per member: major wins plus season championships.
  const titles = new Map<string, { name: string; majors: number; seasons: number }>();
  const credit = (key: string, name: string, kind: 'majors' | 'seasons') => {
    const t = titles.get(key) ?? { name, majors: 0, seasons: 0 };
    t[kind] += 1;
    titles.set(key, t);
  };
  const keyOf = keyResolver(events);
  for (const e of events) for (const r of e.standings) if (r.place === 1) credit(keyOf(r), display(r), 'majors');
  const seasonChamps = new Map<number, { names: string[]; total: number }>();
  for (const season of seasons) {
    if (!seasonComplete(events, season)) continue;
    const rows = seasonStandings(events, season, names);
    const top = rows.filter((r) => r.total === rows[0]?.total && r.wins === rows[0]?.wins && r.best === rows[0]?.best);
    seasonChamps.set(season, { names: top.map((r) => r.name), total: rows[0]?.total ?? 0 });
    for (const r of top) credit(r.key, r.name, 'seasons');
  }
  const leaders = [...titles.values()].sort((a, b) => b.seasons - a.seasons || b.majors - a.majors || a.name.localeCompare(b.name)).slice(0, 10);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#0f1720' }}>Hall of Champions</div>
        <div style={{ fontSize: 13, color: '#5b6b79', marginTop: 2 }}>Every winner in your league&apos;s history.</div>
      </div>

      {events.length === 0 ? (
        <div style={{ fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>No majors are final yet. Your first champion shows up here when the first one ends.</div>
      ) : (
        <>
          <div style={{ border: '1px solid #ecd9a8', borderRadius: 16, background: 'linear-gradient(180deg, #fffaf0 0%, #fff 100%)', padding: isMobile ? 14 : 18 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8a6d1d', marginBottom: 10 }}>Most titles</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {leaders.map((l, i) => (
                <div key={l.name + i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 26, fontSize: 16, textAlign: 'center' }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : <span style={{ fontSize: 13, fontWeight: 800, color: '#8a99a6' }}>{i + 1}</span>}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                  <span style={{ fontSize: 13, color: '#5b6b79', whiteSpace: 'nowrap' }}>
                    {l.seasons ? `🏆 ${l.seasons} season${l.seasons > 1 ? 's' : ''} · ` : ''}{l.majors} major{l.majors === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {seasons.map((season) => {
            const champ = seasonChamps.get(season);
            return (
              <div key={season} style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#173b63' }}>{season}</div>
                {champ ? (
                  <div style={{ borderRadius: 14, padding: '12px 14px', background: 'linear-gradient(135deg, #173b63 0%, #2f5f96 100%)', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 30, lineHeight: 1 }}>🏆</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85 }}>Season Champion</div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{champ.names.join(' & ')}</div>
                      <div style={{ fontSize: 12.5, opacity: 0.85 }}>{champ.total.toLocaleString()} season points</div>
                    </div>
                  </div>
                ) : null}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {TOURNAMENT_ORDER.map((tid) => {
                    const e = events.find((ev) => ev.season === season && ev.tournamentId === tid);
                    if (!e) return null;
                    const winners = e.standings.filter((r) => r.place === 1);
                    const runnerUp = e.standings.find((r) => r.place === 2);
                    return (
                      <div key={tid} style={{ border: '1px solid #e2e9ef', borderRadius: 14, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
                        <div style={{ width: 70, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                          {TOURNAMENT_TAB_LOGOS[tid] ? <TournamentWordmark id={tid} alt={label(tid)} width={70} height={30} /> : <span style={{ fontSize: 12, fontWeight: 800 }}>{label(tid)}</span>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: '#0f1720' }}>🥇 {winners.map(display).join(' & ') || '—'}</div>
                          <div style={{ fontSize: 12.5, color: '#5b6b79' }}>
                            {winners[0] ? `${Number(winners[0].points).toLocaleString()} pts` : ''}{runnerUp ? ` · 2nd ${display(runnerUp)}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
