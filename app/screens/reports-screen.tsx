'use client';

import { Fragment, type CSSProperties } from 'react';
import { Search } from 'lucide-react';
import { TOURNAMENTS, getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, PICK_HISTORY_NAMES, pgaPhoto, playerPhotoSrc, photoOnError, REPORT_OPTIONS, REPORT_TOURNAMENTS, POOL_SEASONS, REPORT_TOURNAMENT_SOLID, PPS_ALL_BAR_GRADIENT, REPORT_TOURNAMENT_CHIP, formatLeaderboardPosition, type TournamentId } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { SeasonStandingsReport } from '../reports/season-standings';
import { HallOfChampionsReport } from '../reports/hall-of-champions';
import { ValuePicksReport } from '../reports/value-picks';
import { HeadToHeadReport } from '../reports/head-to-head';
import { TournamentWordmark } from '../tournament-wordmark';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function ReportsScreen({ p }: { p: PoolPage }) {
  const {
    historyPopup,
    setHistoryPopup,
    pshTournament,
    setPshTournament,
    pshYear,
    setPshYear,
    setHistoryRoster,
    selectedReport,
    setSelectedReport,
    ppsTournament,
    setPpsTournament,
    ppsSortBy,
    setPpsSortBy,
    ppsSearch,
    setPpsSearch,
    setPpsPickPopup,
    setPpsAllPlayerPopup,
    reportYear,
    pmpsEntryId,
    setPmpsEntryId,
    pmphEntryId,
    setPmphEntryId,
    ppfTournament,
    setPpfTournament,
    ppfSearch,
    setPpfSearch,
    ppfSortKey,
    setPpfSortKey,
    ppfSortDir,
    setPpfSortDir,
    ppfSelectedRow,
    setPpfSelectedRow,
    ppfScrollRef,
    reportTopRef,
    ppfViewportW,
    feeds,
    pool,
    reportEntries,
    isMobile,
    tournament,
    picksRevealedForYear,
    players,
    playersById,
    playerDirectory,
    ppsResult,
    ppfRows,
    reportYearSelect,
    openPlayerPopup,
    standings,
    openTournamentHistory,
    headerSolid,
  } = p;
  return (
    <main style={{ marginTop: isMobile ? 12 : 24 }}>
            <section ref={reportTopRef} style={{ scrollMarginTop: 12, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}` }}>
              <div style={{ padding: isMobile ? 18 : 28 }}>
                {selectedReport === 'Season Standings' ? (
                  <SeasonStandingsReport p={p} />
                ) : selectedReport === 'Hall of Champions' ? (
                  <HallOfChampionsReport p={p} />
                ) : selectedReport === 'Value Picks' ? (
                  <ValuePicksReport p={p} />
                ) : selectedReport === 'Head-to-Head' ? (
                  <HeadToHeadReport p={p} />
                ) : selectedReport === 'Player Pick Summary' ? (() => {
                  const ppsControls = (
                    <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', alignItems: 'flex-end', gap: isMobile ? 7 : 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: isMobile ? '1.5 1 92px' : '0 0 220px' }}>
                        <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Tournament</label>
                        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
                          <select
                            value={ppsTournament}
                            onChange={(e) => { const v = e.target.value as TournamentId | 'all' | ''; setPpsTournament(v); if (v === 'all') setPpsSortBy('Picked'); }}
                            style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: isMobile ? '10px 24px 10px 8px' : '10px 34px 10px 12px', fontSize: isMobile ? 12 : 14, fontWeight: 700, color: ppsTournament === 'all' ? '#0f1720' : (ppsTournament ? 'transparent' : '#94a3b8'), WebkitTextFillColor: ppsTournament === 'all' ? '#0f1720' : (ppsTournament ? 'transparent' : '#94a3b8'), cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: isMobile ? 'right 8px center' : 'right 10px center' }}
                          >
                            <option value="" disabled style={{ color: '#94a3b8', WebkitTextFillColor: '#94a3b8' }}>Select tournament</option>
                            {REPORT_TOURNAMENTS.map((t) => (
                              <option key={t.id} value={t.id} style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>{t.label}</option>
                            ))}
                            <option value="all" style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>All</option>
                          </select>
                          {ppsTournament && ppsTournament !== 'all' && TOURNAMENT_TAB_LOGOS[ppsTournament] && (
                            <span style={{ position: 'absolute', left: 12, right: 34, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none' }}>
                              <TournamentWordmark id={ppsTournament} alt={REPORT_TOURNAMENTS.find((t) => t.id === ppsTournament)?.label ?? ''} width={120} height={34} style={{ maxWidth: '100%', objectFit: 'contain' }} />
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: isMobile ? '1.15 1 84px' : '0 0 200px' }}>
                        <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Sort By</label>
                        <select
                          value={ppsSortBy}
                          disabled={ppsTournament === 'all'}
                          onChange={(e) => setPpsSortBy(e.target.value as 'Picked' | 'Salary' | '')}
                          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: ppsTournament === 'all' ? '#f1f5f9' : '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: isMobile ? '10px 22px 10px 8px' : '10px 34px 10px 12px', fontSize: isMobile ? 12 : 14, fontWeight: 700, color: ppsSortBy ? '#0f1720' : '#94a3b8', opacity: ppsTournament === 'all' ? 0.6 : 1, cursor: ppsTournament === 'all' ? 'not-allowed' : 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: isMobile ? 'right 7px center' : 'right 8px center' }}
                        >
                          <option value="" disabled>Select sort</option>
                          <option value="Picked">Times Picked</option>
                          <option value="Salary">Salary</option>
                        </select>
                      </div>
                      {reportYearSelect}
                    </div>
                  );
                  return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Player Pick Summary</div>
                      {!isMobile && ppsControls}
                    </div>
                    {isMobile && <div style={{ marginTop: 14 }}>{ppsControls}</div>}

                    {/* Results — horizontal pick-count bars */}
                    {ppsResult && (() => {
                      const isAll = ppsResult.tournament === 'all';
                      const maxCount = ppsResult.rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
                      const tLabel = REPORT_TOURNAMENTS.find((t) => t.id === ppsResult.tournament)?.label ?? '';
                      // Privacy gate: a single tournament's picks stay hidden until it starts.
                      if (!isAll && !picksRevealedForYear(ppsResult.tournament, reportYear)) {
                        return <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>Picks for {tLabel} are hidden until the tournament begins.</div>;
                      }
                      const barColor = ppsResult.tournament === 'all' ? PPS_ALL_BAR_GRADIENT : REPORT_TOURNAMENT_SOLID[ppsResult.tournament];
                      const CUT_MARKS = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                      if (ppsResult.rows.length === 0) {
                        return <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79' }}>{isAll ? 'No picks have been recorded yet.' : `No picks were recorded for ${tLabel}.`}</div>;
                      }
                      const q = ppsSearch.trim().toLowerCase();
                      const filtered = q ? ppsResult.rows.filter((r) => r.name.toLowerCase().includes(q)) : ppsResult.rows;
                      const tallyColor = ppsResult.tournament === 'all' ? '#2f93bf' : REPORT_TOURNAMENT_SOLID[ppsResult.tournament];
                      return (
                        <div style={{ marginTop: isMobile ? 16 : 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 8 : 12, flexWrap: 'nowrap', marginBottom: isMobile ? 14 : 18 }}>
                            <div style={{ fontSize: isMobile ? 13.5 : 15.5, fontWeight: 800, color: '#0f1720', whiteSpace: 'nowrap', flexShrink: 0 }}>Total Players Picked: <span style={{ color: tallyColor }}>{ppsResult.rows.length}</span></div>
                            <div style={{ position: 'relative', flex: isMobile ? '1 1 auto' : '0 0 auto', minWidth: 0 }}>
                              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                              <input value={ppsSearch} onChange={(e) => setPpsSearch(e.target.value)} placeholder="Search player" style={{ width: isMobile ? '100%' : 230, boxSizing: 'border-box', padding: '9px 30px 9px 32px', borderRadius: 10, border: '1px solid #cdd9e5', fontSize: isMobile ? 16 : 13.5, fontWeight: 600, color: '#0f1720', outline: 'none' }} />
                              {ppsSearch && <button onClick={() => setPpsSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>}
                            </div>
                          </div>
                          {filtered.length === 0 ? (
                            <div style={{ fontSize: 14, color: '#5b6b79' }}>No players match your search.</div>
                          ) : (
                          <div style={{ display: 'grid', gap: isMobile ? 12 : 14 }}>
                            {filtered.map((r) => {
                              const pct = Math.max(20, Math.round((r.count / maxCount) * (isMobile ? 100 : 82)));
                              const isCut = CUT_MARKS.has(String(r.position).toUpperCase());
                              const flagSrc = getPlayerFlag(r.name) ? getFlagSrc(r.name) : null;
                              const abbr = getCountryLabel(r.name) || null;
                              return (
                                <div key={r.id} onClick={() => { if (ppsResult.tournament === 'all') setPpsAllPlayerPopup({ id: r.id, name: r.name, pgaTourId: r.pgaTourId, photoUrl: r.photoUrl }); else setPpsPickPopup({ id: r.id, name: r.name, tournament: ppsResult.tournament }); }} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 9 : 12, cursor: 'pointer' }}>
                                  <img
                                    src={playerPhotoSrc(r.name, r.pgaTourId, r.photoUrl)} data-fb={r.photoUrl ?? pgaPhoto(r.pgaTourId)} onError={photoOnError}
                                    alt={r.name}
                                    style={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #dce8f5', flexShrink: 0, background: '#eef2f6' }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, lineHeight: 1.15 }}>
                                      <span style={{ width: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>{flagSrc && <img src={flagSrc} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: '1px solid #d1d9e0' }} />}</span>
                                      {abbr && <span style={{ flexShrink: 0, marginLeft: 2, fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.02em' }}>{abbr}</span>}
                                      <span style={{ minWidth: 0, marginLeft: abbr ? 4 : 6, fontSize: isMobile ? 13 : 14.5, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                    </div>
                                    {!isAll && (
                                      <div style={{ fontSize: isMobile ? 10 : 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: isCut ? '#dc2626' : '#9aa7b4', margin: '2px 0 6px' }}>{isCut ? 'Missed Cut' : `Finished ${formatLeaderboardPosition(r.position)}`}</div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: isAll ? 6 : 0 }}>
                                      <div style={{ width: `${pct}%`, minWidth: isMobile ? 82 : 96, maxWidth: 'calc(100% - 34px)', height: isMobile ? 24 : 26, borderRadius: 6, background: barColor, display: 'flex', alignItems: 'center', paddingLeft: 9, flexShrink: 0 }}>
                                        {!isAll && <span style={{ fontSize: isMobile ? 11.5 : 12.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{r.salary ? `$${r.salary.toLocaleString()}` : '—'}</span>}
                                      </div>
                                      <span style={{ flexShrink: 0, fontSize: isMobile ? 13 : 14, fontWeight: 800, color: '#0f1720', whiteSpace: 'nowrap' }}>{r.count}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                  );
                })() : selectedReport === 'Pool Member Pick History' ? (() => {
                  const entriesSorted = reportEntries.slice().sort((a, b) => a.name.localeCompare(b.name));
                  const entry = reportEntries.find((e) => e.id === pmphEntryId) ?? null;
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Pool Member Pick History</div>
                        {!isMobile && (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 240 }}>
                              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Pool Member</label>
                              <select
                                value={pmphEntryId}
                                onChange={(e) => setPmphEntryId(e.target.value)}
                                style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmphEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                              >
                                <option value="" disabled>Select pool member</option>
                                {entriesSorted.map((e) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                            </div>
                            {reportYearSelect}
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Pool Member</label>
                            <select
                              value={pmphEntryId}
                              onChange={(e) => setPmphEntryId(e.target.value)}
                              style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmphEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                            >
                              <option value="" disabled>Select pool member</option>
                              {entriesSorted.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          {reportYearSelect}
                        </div>
                      )}
                      {entry && (
                        <div style={{ display: 'grid', gap: 12, marginTop: isMobile ? 18 : 24 }}>
                          {TOURNAMENTS.map((event) => {
                            const historyPlayers = (entry.rosters[event.id] ?? []).map((id) => playersById[id]).filter(Boolean);
                            return (
                              <div
                                key={`pmph-${event.id}`}
                                style={{ borderRadius: 16, border: '1px solid #dce6ee', background: '#fff', padding: 14, display: 'grid', gap: 10 }}
                              >
                                {(() => {
                                  return (
                                    <div style={{ height: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{PICK_HISTORY_NAMES[event.id] ?? event.name}</div>
                                      {TOURNAMENT_TAB_LOGOS[event.id] && (
                                        <TournamentWordmark id={event.id} alt={event.name} width={110} height={24} />
                                      )}
                                    </div>
                                  );
                                })()}
                                {!picksRevealedForYear(event.id, reportYear) ? (
                                  <div style={{ color: '#6b7b88', fontSize: 14, lineHeight: 1.5 }}>Picks are hidden until this tournament begins.</div>
                                ) : historyPlayers.length > 0 ? (
                                  <div style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 } : { display: 'flex', flexWrap: 'wrap', gap: '10px 12px' }}>
                                    {historyPlayers.map((player) => {
                                      const bubblePalette: Record<string, { bg: string; text: string }> = {
                                        players: { bg: '#dce6f5', text: '#173b63' },
                                        masters: { bg: '#d5eade', text: '#2c6449' },
                                        'us-open': { bg: '#fde8e8', text: '#BE3436' },
                                        pga: { bg: '#f5edd8', text: '#7a6a3e' },
                                        open: { bg: '#dce6f5', text: '#173b63' },
                                      };
                                      const { bg, text } = bubblePalette[event.id] ?? { bg: '#e8f3ff', text: '#2f5f96' };
                                      const displayName = isMobile ? (player.name.split(' ').pop() ?? player.name) : player.name;
                                      return (
                                        <span
                                          key={`pmph-player-${event.id}-${player.id}`}
                                          onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'stats', event.id)}
                                          style={{ borderRadius: 999, background: bg, color: text, padding: isMobile ? '4px 8px 4px 4px' : '6px 18px 6px 6px', fontSize: isMobile ? 12 : 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: isMobile ? 6 : 8, cursor: 'pointer', minWidth: 0 }}
                                        >
                                          <img
                                            src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                                            alt={player.name}
                                            style={{ width: isMobile ? 22 : 30, height: isMobile ? 22 : 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#fff' }}
                                          />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ color: '#6b7b88', fontSize: 14 }}>No submitted roster saved for this event yet.</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })() : selectedReport === 'Pool Member Pick Summary' ? (() => {
                  const entriesSorted = reportEntries.slice().sort((a, b) => a.name.localeCompare(b.name));
                  const entry = reportEntries.find((e) => e.id === pmpsEntryId) ?? null;
                  const agg = new Map<number, { count: number; tournaments: TournamentId[] }>();
                  if (entry) {
                    for (const { id: tid } of REPORT_TOURNAMENTS) {
                      if (!picksRevealedForYear(tid, reportYear)) continue; // upcoming tournaments' picks stay hidden until they start
                      for (const pid of entry.rosters[tid] ?? []) {
                        const cur = agg.get(pid) ?? { count: 0, tournaments: [] };
                        cur.count += 1;
                        cur.tournaments.push(tid);
                        agg.set(pid, cur);
                      }
                    }
                  }
                  const rows = Array.from(agg.entries())
                    .map(([pid, v]) => {
                      const p = playerDirectory.get(pid);
                      return p ? { id: pid, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, count: v.count, tournaments: v.tournaments } : null;
                    })
                    .filter((r): r is NonNullable<typeof r> => r !== null)
                    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
                  const totalPicks = rows.reduce((s, r) => s + r.count, 0);
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Pool Member Pick Summary</div>
                        {!isMobile && (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 240 }}>
                              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Entry</label>
                              <select
                                value={pmpsEntryId}
                                onChange={(e) => setPmpsEntryId(e.target.value)}
                                style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmpsEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                              >
                                <option value="" disabled>Select entry</option>
                                {entriesSorted.map((e) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                            </div>
                            {reportYearSelect}
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Entry</label>
                            <select
                              value={pmpsEntryId}
                              onChange={(e) => setPmpsEntryId(e.target.value)}
                              style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmpsEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                            >
                              <option value="" disabled>Select entry</option>
                              {entriesSorted.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          {reportYearSelect}
                        </div>
                      )}
                      {entry && (rows.length === 0 ? (
                        <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79' }}>{entry.name} hasn&rsquo;t made any picks yet this season.</div>
                      ) : (
                        <div style={{ marginTop: isMobile ? 18 : 24 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#5b6b79', marginBottom: 12 }}>
                            {rows.length} {rows.length === 1 ? 'golfer' : 'golfers'} · {totalPicks} total picks across the season
                          </div>
                          <div style={{ display: 'grid', gap: isMobile ? 12 : 14 }}>
                            {rows.map((r) => {
                              const flagSrc = getPlayerFlag(r.name) ? getFlagSrc(r.name) : null;
                              return (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 9 : 12 }}>
                                  <img
                                    src={playerPhotoSrc(r.name, r.pgaTourId, r.photoUrl)} data-fb={r.photoUrl ?? pgaPhoto(r.pgaTourId)} onError={photoOnError}
                                    alt={r.name}
                                    style={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #dce8f5', flexShrink: 0, background: '#eef2f6' }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                      {flagSrc && <img src={flagSrc} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: '1px solid #d1d9e0', flexShrink: 0 }} />}
                                      <span style={{ fontSize: isMobile ? 13 : 14.5, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11.5, fontWeight: 800, color: '#173b63', background: '#eaf1f9', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{r.count}× picked</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                      {REPORT_TOURNAMENTS.filter((t) => r.tournaments.includes(t.id)).map((t) => {
                                        const chip = REPORT_TOURNAMENT_CHIP[t.id];
                                        return (
                                          <span key={t.id} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', color: chip.fg, background: chip.bg, borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap' }}>{chip.short}</span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })() : selectedReport === 'Player Performance Summary' ? (() => {
                  const tColor = ppfTournament === 'pga' ? '#B09963' : ppfTournament === 'masters' ? '#2c6449' : ppfTournament === 'us-open' ? '#BE3436' : '#173b63';
                  // The Open dresses the leaderboard body (everything below the navy header row) in its gold.
                  const isOpen = ppfTournament === 'open';
                  const openGold = '#F4BC41';
                  const cutLine = ppfTournament ? (feeds[ppfTournament]?.projectedCut ?? null) : null;
                  const q = ppfSearch.trim().toLowerCase();
                  const filtered = q ? ppfRows.filter((r) => r.name.toLowerCase().includes(q)) : ppfRows;
                  const dirMul = ppfSortDir === 'asc' ? 1 : -1;
                  const sorted = [...filtered].sort((a, b) => {
                    if (ppfSortKey === 'finish') return (a.posRank - b.posRank) * dirMul || (a.scoreNum - b.scoreNum) || a.name.localeCompare(b.name);
                    const av = a[ppfSortKey] as number;
                    const bv = b[ppfSortKey] as number;
                    return (av - bv) * dirMul || (a.posRank - b.posRank) || a.name.localeCompare(b.name);
                  });
                  const setSort = (key: typeof ppfSortKey) => {
                    if (ppfSortKey === key) setPpfSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                    else { setPpfSortKey(key); setPpfSortDir(key === 'finish' ? 'asc' : 'desc'); }
                  };
                  const arrow = (key: typeof ppfSortKey) => (ppfSortKey === key ? (ppfSortDir === 'asc' ? ' ▲' : ' ▼') : '');
                  const CUT_MARK = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                  // The cut line for a completed tournament isn't in the feed's projectedCut (only populated
                  // live). Derive it the way you'd read it off a leaderboard: one stroke better than the best
                  // score among players who MISSED the cut (e.g. first miss at +5 → cut line +4). Fall back to
                  // the worst made-cut score if there are no missed-cut players in the field.
                  const isCutRow = (r: { madeCut: boolean; position: string }) => CUT_MARK.has(String(r.position).toUpperCase()) || !r.madeCut;
                  const missedCutScoreNums = ppfRows.filter((r) => isCutRow(r) && r.scoreNum !== 9999 && Number.isFinite(r.scoreNum)).map((r) => r.scoreNum);
                  const madeCutScoreNums = ppfRows.filter((r) => !isCutRow(r) && r.scoreNum !== 9999 && Number.isFinite(r.scoreNum)).map((r) => r.scoreNum);
                  const derivedCutNum = missedCutScoreNums.length
                    ? Math.min(...missedCutScoreNums) - 1
                    : (madeCutScoreNums.length ? Math.max(...madeCutScoreNums) : null);
                  const cutLineLabel = cutLine ?? (derivedCutNum === null ? null : derivedCutNum === 0 ? 'E' : derivedCutNum > 0 ? `+${derivedCutNum}` : String(derivedCutNum));
                  const sortableTh = (label: string, key: typeof ppfSortKey, title: string) => (
                    <th title={title} onClick={() => setSort(key)} style={{ padding: '9px 7px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor }}>{label}{arrow(key)}</th>
                  );
                  const plainTh = (label: string, title: string) => (
                    <th title={title} style={{ padding: '9px 7px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor }}>{label}</th>
                  );
                  const numCell = (v: number) => (v ? v : <span style={{ color: isOpen ? '#000' : '#c3cdd8' }}>–</span>);
                  const tournamentBlock = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: isMobile ? undefined : 320, flex: isMobile ? '1 1 130px' : '0 0 240px', minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Tournament</label>
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
                        <select
                          value={ppfTournament}
                          onChange={(e) => { setPpfTournament(e.target.value as TournamentId | ''); setPpfSearch(''); setPpfSortKey('finish'); setPpfSortDir('asc'); setPpfSelectedRow(null); }}
                          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: ppfTournament ? 'transparent' : '#94a3b8', WebkitTextFillColor: ppfTournament ? 'transparent' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                        >
                          <option value="" disabled style={{ color: '#94a3b8', WebkitTextFillColor: '#94a3b8' }}>Select tournament</option>
                          {REPORT_TOURNAMENTS.map((t) => (
                            <option key={t.id} value={t.id} style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>{t.label}</option>
                          ))}
                        </select>
                        {ppfTournament && TOURNAMENT_TAB_LOGOS[ppfTournament] && (
                          <span style={{ position: 'absolute', left: 12, right: 34, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none' }}>
                            <TournamentWordmark id={ppfTournament} alt={REPORT_TOURNAMENTS.find((t) => t.id === ppfTournament)?.label ?? ''} width={120} height={34} style={{ maxWidth: '100%', objectFit: 'contain' }} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                  return (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12 }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Player Performance Summary</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 8 : 12, flex: isMobile ? '1 1 100%' : '0 0 auto', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
                          {tournamentBlock}
                          {isMobile && reportYearSelect}
                          {ppfTournament && (
                            <div style={{ position: 'relative', flex: isMobile ? '1 1 92px' : '0 0 auto', minWidth: isMobile ? 88 : 130 }}>
                              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                              <input
                                value={ppfSearch}
                                onChange={(e) => setPpfSearch(e.target.value)}
                                placeholder="Search"
                                style={{ width: isMobile ? '100%' : 230, boxSizing: 'border-box', padding: '9px 30px 9px 32px', borderRadius: 10, border: '1px solid #cdd9e5', fontSize: isMobile ? 16 : 13.5, fontWeight: 600, color: '#0f1720', outline: 'none' }}
                              />
                              {ppfSearch && (
                                <button onClick={() => setPpfSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
                              )}
                            </div>
                          )}
                          {!isMobile && reportYearSelect}
                        </div>
                      </div>
                      {ppfTournament && (
                        sorted.length === 0 ? (
                          <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79' }}>{q ? 'No players match your search.' : 'No field data available for this tournament yet.'}</div>
                        ) : (
                          <div style={{ marginTop: isMobile ? 16 : 22 }}>
                            <div ref={ppfScrollRef} style={{ overflow: 'auto', maxHeight: isMobile ? '68vh' : '72vh', WebkitOverflowScrolling: 'touch', border: '1px solid #d1dae3', borderRadius: 10, background: isOpen ? openGold : undefined }}>
                              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: isMobile ? 11.5 : 12 }}>
                                <thead>
                                  <tr style={{ background: tColor, color: '#fff', textAlign: 'center', fontSize: isMobile ? 10 : 11 }}>
                                    <th title="Finishing position" style={{ padding: '9px 7px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor, width: 44, minWidth: 44 }}>POS</th>
                                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor, width: isMobile ? 172 : 200, minWidth: isMobile ? 172 : 200 }}>PLAYER</th>
                                    {sortableTh('SCORE', 'finish', 'Score to par (sorts by finish)')}
                                    {sortableTh('PARS', 'par', 'Pars')}
                                    {sortableTh('BIRD', 'birdie', 'Birdies')}
                                    {sortableTh('EAG', 'eagle', 'Eagles')}
                                    {sortableTh('BOG', 'bogey', 'Bogeys')}
                                    {sortableTh('DBL', 'double', 'Double bogeys')}
                                    {sortableTh('TRP', 'triple', 'Triple bogeys or worse')}
                                    {plainTh('ACE', 'Hole-in-ones')}
                                    {plainTh('3BST', '3-birdie streaks')}
                                    {plainTh('NBR', 'No-bogey rounds')}
                                    {plainTh('LOW', 'Tournament low round')}
                                    {plainTh('R1', 'Round 1 leader')}
                                    {plainTh('R2', 'Round 2 leader')}
                                    {plainTh('R3', 'Round 3 leader')}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sorted.map((r, i) => {
                                    const rowIsCut = (row: typeof r) => CUT_MARK.has(String(row.position).toUpperCase()) || !row.madeCut;
                                    const isCut = rowIsCut(r);
                                    const leaderMark = (on: boolean) => on ? <span style={{ color: '#0f7a3d', fontWeight: 900 }}>✓</span> : <span style={{ color: isOpen ? '#000' : '#c3cdd8' }}>–</span>;
                                    const rowFlag = getPlayerFlag(r.name) ? getFlagSrc(r.name) : null;
                                    // In the default finish sort the field is grouped made-cut → missed-cut, so drop a
                                    // cut-line divider at the boundary (first cut player, just below the last to make it).
                                    const showCutLine = ppfSortKey === 'finish' && !q && isCut && i > 0 && !rowIsCut(sorted[i - 1]);
                                    const isSelected = ppfSelectedRow === r.name;
                                    const rowHighlight = ppfTournament === 'masters' ? '#dcfce7' : ppfTournament === 'open' ? '#93c5fd' : '#dbeafe';
                                    const rowBg = isSelected ? rowHighlight : (isOpen ? openGold : (i % 2 === 0 ? '#fff' : '#f7fafc'));
                                    return (
                                      <Fragment key={`${r.name}-${i}`}>
                                      {showCutLine && (
                                        <tr>
                                          <td colSpan={16} style={{ padding: 0, background: isOpen ? openGold : '#fff' }}>
                                            <div style={{ position: 'sticky', left: 0, width: ppfViewportW || '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
                                              <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE{cutLineLabel ? `: ${cutLineLabel}` : ''}</span>
                                              <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                      <tr onClick={() => setPpfSelectedRow((prev) => prev === r.name ? null : r.name)} style={{ background: rowBg, borderTop: isOpen ? '1px solid rgba(0,0,0,0.12)' : '1px solid #eef2f6', textAlign: 'center', color: isOpen ? '#000' : '#0f1720', cursor: 'pointer' }}>
                                        <td style={{ padding: '8px 7px', fontWeight: 700, whiteSpace: 'nowrap', color: isCut ? '#dc2626' : (isOpen ? '#000' : '#0f1720'), width: 44, minWidth: 44 }}>{isCut ? 'CUT' : formatLeaderboardPosition(r.position)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, width: isMobile ? 172 : 200, minWidth: isMobile ? 172 : 200, maxWidth: isMobile ? 172 : 200 }}>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ width: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>{rowFlag && <img src={rowFlag} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: isOpen ? '0.5px solid #000' : '1px solid #d1d9e0' }} />}</span>
                                            <span style={{ whiteSpace: 'normal', lineHeight: 1.2, minWidth: 0 }}>{r.name}</span>
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 7px', fontWeight: 800, whiteSpace: 'nowrap', color: r.scoreNum < 0 ? '#dc2626' : '#0f1720' }}>{r.scoreDisplay}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.par)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.birdie)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.eagle)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.bogey)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.double)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.triple)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.ace)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.streak)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.bogeyFree)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.lowRound)}</td>
                                        <td style={{ padding: '8px 7px' }}>{leaderMark(r.r1)}</td>
                                        <td style={{ padding: '8px 7px' }}>{leaderMark(r.r2)}</td>
                                        <td style={{ padding: '8px 7px' }}>{leaderMark(r.r3)}</td>
                                      </tr>
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      )}
                    </>
                  );
                })() : selectedReport === 'Pool Standings History' ? (() => {
                  const tournamentBlock = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: isMobile ? '1 1 120px' : '0 0 240px', minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Tournament</label>
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
                        <select
                          value={pshTournament}
                          onChange={(e) => { const t = e.target.value as TournamentId | ''; setPshTournament(t); if (t) openTournamentHistory(t, pshYear); else setHistoryPopup(null); }}
                          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pshTournament ? 'transparent' : '#94a3b8', WebkitTextFillColor: pshTournament ? 'transparent' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                        >
                          <option value="" disabled style={{ color: '#94a3b8', WebkitTextFillColor: '#94a3b8' }}>Select tournament</option>
                          {REPORT_TOURNAMENTS.map((t) => (
                            <option key={t.id} value={t.id} style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>{t.label}</option>
                          ))}
                        </select>
                        {pshTournament && TOURNAMENT_TAB_LOGOS[pshTournament] && (
                          <span style={{ position: 'absolute', left: 12, right: 34, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none' }}>
                            <TournamentWordmark id={pshTournament} alt={REPORT_TOURNAMENTS.find((t) => t.id === pshTournament)?.label ?? ''} width={120} height={34} style={{ maxWidth: '100%', objectFit: 'contain' }} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                  const yearBlock = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: isMobile ? '0 0 116px' : '0 0 160px' }}>
                      <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Year</label>
                      <select
                        value={String(pshYear)}
                        onChange={(e) => { const y = Number(e.target.value); setPshYear(y); if (pshTournament) openTournamentHistory(pshTournament, y); }}
                        style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: '#0f1720', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                      >
                        {[...POOL_SEASONS].sort((a, b) => b - a).map((yr) => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>
                  );
                  const pshLoaded = !!pshTournament && historyPopup?.tournament === pshTournament;
                  const pshRows = pshLoaded ? (historyPopup?.data?.standings ?? []) : [];
                  const pshLoading = pshLoaded && !!historyPopup?.loading;
                  const pshLoadedYear = historyPopup?.year;
                  const pshHeaderSolid = pshTournament ? REPORT_TOURNAMENT_SOLID[pshTournament] : '#173b63';
                  const pshPayouts = (pshLoaded ? historyPopup?.data?.payouts : null) ?? (pshTournament ? pool?.payouts?.[pshTournament] : null) ?? null;
                  const pshMedal = (place: number) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : null);
                  const pshPayoutFor = (place: number) => (place === 1 ? pshPayouts?.first : place === 2 ? pshPayouts?.second : place === 3 ? pshPayouts?.third : undefined);
                  const pshIsOpen = pshTournament === 'open';
                  const pshDivider = (pshTournament === 'players' || pshTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef';
                  const pshTh: React.CSSProperties = { padding: isMobile ? '10px 6px' : '10px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#fff' };
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Pool Standings History</div>
                        {!isMobile && (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            {tournamentBlock}
                            {yearBlock}
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
                          {tournamentBlock}
                          {yearBlock}
                        </div>
                      )}
                      {pshLoaded ? (
                        pshLoading ? (
                          <div style={{ marginTop: isMobile ? 20 : 26, fontSize: 14, color: '#5b6b79' }}>Loading {pshLoadedYear} standings…</div>
                        ) : pshRows.length === 0 ? (
                          <div style={{ marginTop: isMobile ? 20 : 26, fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>No banked standings for the {pshLoadedYear} season yet.</div>
                        ) : (
                          <div style={{ marginTop: isMobile ? 18 : 24, border: '1px solid #d1dae3', borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: pshIsOpen ? '#F4BC41' : '#fff' }}>
                              <thead>
                                <tr style={{ background: pshHeaderSolid }}>
                                  <th style={{ ...pshTh, textAlign: 'center' }}>RANK</th>
                                  <th style={{ ...pshTh, textAlign: 'left' }}>ENTRY</th>
                                  <th style={{ ...pshTh, textAlign: 'center' }}>POINTS</th>
                                  <th style={{ ...pshTh, textAlign: 'center' }}>TIEBREAK</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pshRows.map((r, i) => {
                                  const clickable = (r.golfers?.length ?? 0) > 0;
                                  return (
                                    <tr key={i} onClick={clickable ? () => setHistoryRoster(r) : undefined} style={{ borderTop: pshDivider, cursor: clickable ? 'pointer' : 'default' }}>
                                      <td style={{ textAlign: 'center', padding: isMobile ? '9px 5px' : '9px 8px', fontSize: 13, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{r.place}</td>
                                      <td style={{ padding: isMobile ? '9px 6px' : '9px 12px', fontSize: 13, color: '#0f1720', fontWeight: r.place <= 3 ? 800 : 500 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                          <span style={{ whiteSpace: 'nowrap' }}>{r.name}</span>
                                          {pshMedal(r.place) && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                              <span style={{ fontSize: 15 }}>{pshMedal(r.place)}</span>
                                              {typeof pshPayoutFor(r.place) === 'number' && (
                                                <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#0f7a3d' }}>(${pshPayoutFor(r.place)!.toLocaleString()})</span>
                                              )}
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'center', padding: isMobile ? '9px 6px' : '9px 8px', fontSize: 13, fontWeight: 700, color: '#0f1720', whiteSpace: 'nowrap' }}>{r.points % 1 === 0 ? r.points : r.points.toFixed(1)}</td>
                                      <td style={{ textAlign: 'center', padding: isMobile ? '9px 6px' : '9px 8px', fontSize: 13, fontWeight: 600, color: pshIsOpen ? '#000' : '#5b6b79', whiteSpace: 'nowrap' }}>{r.tieBreak}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : null}
                    </>
                  );
                })() : selectedReport ? (
                  <>
                    <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>{selectedReport}</div>
                    <div style={{ marginTop: 10, fontSize: isMobile ? 13 : 15, color: '#5b6b79', lineHeight: 1.55 }}>
                      This report is coming soon.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color: '#0f1720' }}>Choose a report</div>
                    <div style={{ marginTop: 10, fontSize: isMobile ? 13 : 15, color: '#5b6b79', lineHeight: 1.55 }}>
                      Use the <strong>Reports</strong> menu above to pick a summary to view.
                    </div>
                    <div style={{ marginTop: 16, display: 'grid', gap: 8, maxWidth: 360 }}>
                      {REPORT_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setSelectedReport(opt)}
                          style={{ textAlign: 'left', background: '#f0f6ff', border: '1px solid #dce8f5', borderRadius: 12, padding: '12px 16px', fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#173b63', cursor: 'pointer' }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          </main>
  );
}
