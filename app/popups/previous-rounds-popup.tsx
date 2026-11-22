'use client';

import { type CSSProperties } from 'react';
import { canonicalNameKey } from '@/app/lib/name-match';
import { getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, PGA_CLUB_PROFESSIONALS, HeaderNameFlag, fitPopupHeader } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { GmpBadge } from '../gmp-badge';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function PreviousRoundsPopup({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    scorecardGolferName,
    scorecardData,
    setShowPreviousRounds,
    isMobile,
    tournament,
    clubProKeys,
    showPreviousRounds,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(showPreviousRounds && scorecardData && scorecardGolferName)) return null;
  return (
    <div
            onClick={() => setShowPreviousRounds(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={scorecardGolferName ?? ''} flagSrc={scorecardGolferName && getPlayerFlag(scorecardGolferName) ? getFlagSrc(scorecardGolferName) : null} abbr={scorecardGolferName ? (getCountryLabel(scorecardGolferName) || null) : null} base={fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).stacked} />{scorecardGolferName && getPlayerFlag(scorecardGolferName) && <>{scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GmpBadge height={34 * (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 0.75 : 1)} />
                      </div>
                    )}
                    <button
                      onClick={() => setShowPreviousRounds(false)}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })()}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '14px 14px 20px' : '16px 20px 24px', overflowX: 'auto' }}>
                {(() => {
                  const currentRnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                  const prevRnds = scorecardData.rounds.filter(r => r.round < currentRnd.round && r.holes.length > 0).sort((a, b) => b.round - a.round);
                  const allRnds = [currentRnd, ...prevRnds];

                  const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                  const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';
                  const isGoldTab = selectedTournament === 'open';
                  const isMastersTournament = selectedTournament === 'masters';
                  const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                  const baseCell: React.CSSProperties = { border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap', ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }) };
                  const labelCell: React.CSSProperties = { ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151' };
                  const subtotalCell: React.CSSProperties = { ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalCell: React.CSSProperties = { ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder };
                  const holeHeaderCell: React.CSSProperties = { ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12 };
                  const subtotalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder };
                  const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;
                  const badge = (score: number, par: number): React.CSSProperties => {
                    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, boxSizing: 'border-box', fontSize: 13 };
                    if (!score || !par) return base;
                    const diff = score - par;
                    const r = '#dc2626'; const k = '#0f1720'; const g = isGoldTab ? '#F4BC41' : '#fff';
                    if (score === 1 || diff === -2) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                    if (diff <= -3) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                    if (diff === -1) return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                    if (diff === 1) return { ...base, border: `2px solid ${k}` };
                    if (diff === 2) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                    if (diff >= 3) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k},0 0 0 6px ${g},0 0 0 8px ${k}` };
                    return base;
                  };

                  return allRnds.map(rnd => {
                    const front = rnd.holes.filter(h => h.hole <= 9);
                    const back = rnd.holes.filter(h => h.hole >= 10);
                    const frontPar = front.reduce((s, h) => s + (h.par || 0), 0);
                    const backPar = back.reduce((s, h) => s + (h.par || 0), 0);
                    const allScoresNull = rnd.holes.every(h => h.score == null);
                    const frontScore = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                    const backScore = allScoresNull ? 0 : back.reduce((s, h) => s + (h.score ?? 0), 0);
                    const totalScore = frontScore + backScore;
                    return (
                      <div key={rnd.round} style={{ marginBottom: 24 }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: isMastersTournament ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#1e4d8c' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', color: isMastersTournament ? '#2c6449' : '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', border: isMastersTournament ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'us-open' ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: isMastersTournament ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(14,45,100,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>Round {rnd.round}</span>
                          {rnd.score != null && rnd.score !== '' && <span style={{ fontWeight: 600, color: '#0f1720', fontSize: 12 }}>Score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score}{rnd.holes[0]?.hole >= 10 ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                            <thead>
                              <tr>
                                <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                                {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Front</th>
                                {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Back</th>
                                <th style={totalHeaderCell}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={labelCell}>Par</td>
                                {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{frontPar || '--'}</td>
                                {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{backPar || '--'}</td>
                                <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                              </tr>
                              <tr>
                                <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                                {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                                {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                                <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              </div>
            </div>
          </div>
  );
}
