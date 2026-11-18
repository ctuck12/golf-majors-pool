'use client';

import { type CSSProperties } from 'react';
import { canonicalNameKey } from '@/app/lib/name-match';
import { getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, PGA_CLUB_PROFESSIONALS, KNOCKOUT_TAB_LOGOS, HeaderNameFlag, fitPopupHeader, formatTeeTime } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function ScorecardPopup({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    scorecardGolferName,
    setScorecardGolferName,
    scorecardGolferTeeTime,
    setScorecardGolferTeeTime,
    scorecardGolferThru,
    setScorecardGolferThru,
    scorecardGolferBackNineStart,
    setScorecardGolferBackNineStart,
    scorecardData,
    setScorecardData,
    scorecardLoading,
    setShowPreviousRounds,
    isMobile,
    tournament,
    selectedTournamentStatus,
    clubProKeys,
    currentRoundLabel,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(scorecardGolferName)) return null;
  return (
    <div
            onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); setShowPreviousRounds(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 80 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored tournament header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                const roundColor = selectedTournament === 'masters' ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#0f1720' : selectedTournament === 'open' ? '#F4BC41' : '#173b63';
                const teeTimeColor = (selectedTournament === 'us-open' || selectedTournament === 'open') ? '#fff' : '#0f1720';
                return (
                  <div style={{ background: hBg, display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
                    {/* Name + round/score + close */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: isMobile ? '10px 14px' : '12px 18px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: !scorecardGolferName ? 19 : fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1, display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={scorecardGolferName ?? ''} flagSrc={scorecardGolferName && getPlayerFlag(scorecardGolferName) ? getFlagSrc(scorecardGolferName) : null} abbr={scorecardGolferName ? (getCountryLabel(scorecardGolferName) || null) : null} base={!scorecardGolferName ? 19 : fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).fontSize} min={isMobile ? 13 : 15} allowStack={false} initialStacked={false} />{scorecardGolferName && getPlayerFlag(scorecardGolferName) && <></>}</div>
                        {(() => {
                          const playerNotStarted = scorecardGolferThru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS';
                          const prevRoundsBtn = (hasPrev: boolean) => hasPrev ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowPreviousRounds(true); }}
                              style={{ background: selectedTournament === 'masters' ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', border: selectedTournament === 'masters' ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', borderRadius: 999, padding: isMobile ? '2.5px 7.5px' : '3px 8px', cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : '#fff', fontWeight: 800, fontSize: isMobile ? 8 : 9, letterSpacing: '0.06em', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)', textTransform: 'uppercase' }}
                            >
                              Previous Rounds
                            </button>
                          ) : null;
                          if (playerNotStarted && scorecardGolferTeeTime) {
                            const roundNum = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                            const hasPrev = scorecardData?.rounds.some(r => r.round < roundNum && r.holes.length > 0) ?? false;
                            return (
                              <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                Round {roundNum}
                                <span style={{ fontWeight: 400, color: teeTimeColor, fontSize: isMobile ? 10 : 11 }}>{formatTeeTime(scorecardGolferTeeTime)}</span>
                                {prevRoundsBtn(hasPrev)}
                              </div>
                            );
                          }
                          if (scorecardData && scorecardData.rounds.length > 0) {
                            const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                            const hasPrev = scorecardData.rounds.some(r => r.round < rnd.round && r.holes.length > 0);
                            if (!rnd) return null;
                            if (rnd.score != null && rnd.score !== '') {
                              return (
                                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  Round {rnd.round}
                                  <span style={{ fontWeight: 600, color: '#fff', fontSize: isMobile ? 10 : 11 }}>Score: {rnd.score}{scorecardGolferBackNineStart && scorecardGolferThru !== '--' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>
                                  {prevRoundsBtn(hasPrev)}
                                  {scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', marginTop: -8, marginBottom: -8, flexShrink: 0 }} />}
                                </div>
                              );
                            }
                            if (hasPrev) {
                              return (
                                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  Round {rnd.round}
                                  {prevRoundsBtn(true)}
                                  {scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', marginTop: -8, marginBottom: -8, flexShrink: 0 }} />}
                                </div>
                              );
                            }
                            return null;
                          }
                          return null;
                        })()}
                      </div>
                      {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                        onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); setShowPreviousRounds(false); }}
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                      >✕</button>
                    </div>
                  </div>
                );
              })()}

              {/* Scorecard body */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '12px 12px 16px' : '16px 20px 20px', overflowX: 'auto' }}>
              {scorecardLoading ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Loading scorecard…</div>
              ) : !scorecardData || scorecardData.rounds.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>
                  Scorecard data is not yet available for this round.
                </div>
              ) : (() => {
                // Show only the current (latest) round that has hole data
                const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                const front = rnd.holes.filter(h => h.hole <= 9);
                const back  = rnd.holes.filter(h => h.hole >= 10);
                const frontPar    = front.reduce((s, h) => s + (h.par || 0), 0);
                const backPar     = back.reduce((s,  h) => s + (h.par || 0), 0);
                const allScoresNull = rnd.holes.every(h => h.score == null);
                const frontScore  = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                const backScore   = allScoresNull ? 0 : back.reduce((s,  h) => s + (h.score ?? 0), 0);
                const totalScore  = frontScore + backScore;

                const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';

                const isGoldTab = selectedTournament === 'open';
                const baseCell: React.CSSProperties = {
                  border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap',
                  ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }),
                };
                const labelCell: React.CSSProperties = {
                  ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase',
                  background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151',
                };
                const isMastersTournament = selectedTournament === 'masters';
                const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                const subtotalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder,
                };
                const holeHeaderCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12,
                };
                const subtotalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder,
                };

                const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;

                // Standard golf scorecard notation applied to each hole score
                const badge = (score: number, par: number): React.CSSProperties => {
                  const base: React.CSSProperties = {
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, boxSizing: 'border-box', fontSize: 13,
                  };
                  if (!score || !par) return base;
                  const diff = score - par;
                  const r = '#dc2626'; // red — under par
                  const k = '#0f1720'; // dark — over par
                  const g = isGoldTab ? '#F4BC41' : '#fff';    // gap between rings
                  // hole-in-one or eagle → 2 circles (checked before albatross so HIO on par-4 = 2 circles)
                  if (score === 1 || diff === -2)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                  // albatross → 3 circles
                  if (diff <= -3)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                  // birdie → 1 circle
                  if (diff === -1)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                  // bogey → 1 square
                  if (diff === 1)
                    return { ...base, border: `2px solid ${k}` };
                  // double bogey → 2 squares
                  if (diff === 2)
                    return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                  // triple bogey or worse → 3 squares (slightly tighter rings so they fit within the cell)
                  if (diff >= 3)
                    return { ...base, border: `1.5px solid ${k}`, boxShadow: `0 0 0 1.5px ${g},0 0 0 3px ${k},0 0 0 4.5px ${g},0 0 0 6px ${k}` };
                  return base; // par — no decoration
                };

                return (
                  <div>
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
                    {rnd.holes.length === 0 && (
                      <div style={{ color: '#607282', fontSize: 14, marginTop: 12 }}>
                        Round {rnd.round} score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score ?? '--'}
                      </div>
                    )}
                  </div>
                );
              })()}
              </div>
              </div>
            </div>
          </div>
  );
}
