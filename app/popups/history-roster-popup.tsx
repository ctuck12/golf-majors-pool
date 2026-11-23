'use client';

import { getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, KNOCKOUT_TAB_LOGOS, REPORT_TOURNAMENT_SOLID } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { GmpBadge } from '../gmp-badge';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function HistoryRosterPopup({ p }: { p: PoolPage }) {
  const {
    historyPopup,
    historyRoster,
    setHistoryRoster,
    isMobile,
    tournament,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(historyRoster && historyPopup)) return null;
  return (
    (() => {
          const histTournament = historyPopup.tournament;
          const histHeaderSolid = REPORT_TOURNAMENT_SOLID[histTournament];
          const closeRoster = () => setHistoryRoster(null);
          const CUT_SET = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
          const rosterGolfers = historyRoster.golfers ? [...historyRoster.golfers].sort((a, b) => b.points - a.points) : [];
          const isOpenHist = histTournament === 'open';
          const histGold = '#F4BC41';
          const histDivider = (histTournament === 'players' || histTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef';
          return (
            <div onClick={closeRoster} style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(560px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: histHeaderSolid, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: isMobile ? 15 : 16, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{historyRoster.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {(KNOCKOUT_TAB_LOGOS[histTournament] ?? TOURNAMENT_TAB_LOGOS[histTournament]) && (
                      <GmpBadge height={32} />
                    )}
                    <button onClick={closeRoster} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', background: isOpenHist ? histGold : undefined }}>
                  {rosterGolfers.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#5b6b79', fontSize: 13.5, lineHeight: 1.5 }}>No roster was saved for this entry.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f3f6f9' }}>
                          <th style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>GOLFER</th>
                          <th style={{ textAlign: 'center', padding: '9px 6px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>SALARY</th>
                          <th style={{ textAlign: 'center', padding: '9px 6px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>POS</th>
                          <th style={{ textAlign: 'center', padding: '9px 8px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>POINTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rosterGolfers.map((g, i) => {
                          const cut = CUT_SET.has(String(g.score).toUpperCase()) || String(g.position).toUpperCase() === 'CUT';
                          const flagSrc = getPlayerFlag(g.name) ? getFlagSrc(g.name) : null;
                          const abbr = getCountryLabel(g.name) || null;
                          return (
                            <tr key={i} style={{ borderTop: histDivider }}>
                              <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: '#0f1720' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
                                  <span style={{ width: 20, marginRight: 5, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                                    {flagSrc && <img src={flagSrc} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: isOpenHist ? '0.5px solid #000' : '1px solid #d1d9e0' }} />}
                                  </span>
                                  <span style={{ width: 24, flexShrink: 0, fontSize: 10, fontWeight: 700, color: isOpenHist ? '#1e3a5f' : '#94a3b8' }}>{abbr || ''}</span>
                                  <span style={{ marginLeft: 8 }}>{g.name}</span>
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', padding: '9px 6px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: '#374151' }}>{g.salary ? `$${g.salary.toLocaleString()}` : '—'}</td>
                              <td style={{ textAlign: 'center', padding: '9px 6px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: '#374151' }}>{cut ? <span style={{ display: 'inline-block', background: '#dc2626', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>CUT</span> : (g.position || '—')}</td>
                              <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: g.points < 0 ? '#dc2626' : '#0f1720' }}>{g.points % 1 === 0 ? g.points : g.points.toFixed(1)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          );
        })()
  );
}
