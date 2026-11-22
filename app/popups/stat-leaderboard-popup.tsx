'use client';

import { type ReactNode } from 'react';
import { getFlagSrc, getCountryLabel } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function StatLeaderboardPopup({ p }: { p: PoolPage }) {
  const {
    statLeaderboardModal,
    setStatLeaderboardModal,
    statLbSearch,
    setStatLbSearch,
    visualVpHeight,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(statLeaderboardModal !== null)) return null;
  return (
    (() => {
          const fullH = typeof window !== 'undefined' ? window.innerHeight : 800;
          const vpH = Math.min(visualVpHeight ?? fullH, fullH);
          const kbH = fullH - vpH; // keyboard height (0 when no keyboard)
          const kbUp = kbH > 80;
          const searchQ = statLbSearch.trim().toLowerCase();
          const allEntries = statLeaderboardModal.entries ?? [];
          // Default: top 15. Searching: all matches.
          const visibleEntries = searchQ ? allEntries.filter(e => e.name.toLowerCase().includes(searchQ)) : allEntries.slice(0, 15);
          // Strokes Gained stats show "Strokes Gained" in the small line above, so the title fits beside the logo.
          const sgName = statLeaderboardModal.label.startsWith('Strokes Gained: ') ? statLeaderboardModal.label.slice('Strokes Gained: '.length) : null;
          const HEADER_H = 118;
          const ROW_H = 40;
          // Critical: add kbH as bottom padding on the backdrop so flex-end anchors
          // to the top of the keyboard, not the bottom of the window (which is behind keyboard).
          const kbPad = kbUp ? kbH + 8 : 0;
          // List maxHeight fills visible space above keyboard minus header and top margin.
          const listMaxH = kbUp
            ? Math.max(120, vpH - HEADER_H)
            : Math.floor(fullH * 0.65);
          // Only snap modal to bottom (near keyboard) when actively searching and results fit above keyboard.
          const estimatedListH = Math.min(visibleEntries.length * ROW_H + 18, listMaxH);
          const estimatedModalH = estimatedListH + HEADER_H;
          const snapToBottom = kbUp && !!searchQ && estimatedModalH <= (vpH - 16);
          const alignItems = !kbUp ? 'center' : snapToBottom ? 'flex-end' : 'flex-start';
          const padding = !kbUp ? '24px' : `4px 16px ${kbPad}px`;
          return (
          <div onClick={() => { setStatLeaderboardModal(null); setStatLbSearch(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.72)', display: 'flex', alignItems, justifyContent: 'center', padding, zIndex: 400 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
              <div style={{ background: '#0f1720', padding: '12px 18px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Strokes Gained: "Strokes Gained" above the stat's name, "Season/Tournament Leaders" below it.
                        Other stats: leaders line above the name. */}
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#607282', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sgName ? 'Strokes Gained' : statLeaderboardModal.subtitle}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sgName ?? statLeaderboardModal.label}</div>
                    {sgName ? <div style={{ fontSize: 9, fontWeight: 700, color: '#607282', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3, whiteSpace: 'nowrap' }}>{statLeaderboardModal.subtitle}</div> : null}
                    {statLeaderboardModal.tourAvg && <div style={{ fontSize: 11, fontWeight: 500, color: '#8fa3b1', marginTop: 2 }}>{statLeaderboardModal.avgLabel ?? 'Tour Avg'}: <span style={{ fontWeight: 700, color: '#b8cad6' }}>{statLeaderboardModal.tourAvg}</span></div>}
                  </div>
                  {/* Negative margins: the logo may overhang into the header padding but never makes the header taller. */}
                  <img src="/logo-popup.png" alt="Golf Majors Pool" width={140} height={42} style={{ width: 140, height: 42, margin: '-5px 0 -5px 10px', display: 'block', flexShrink: 0 }} />
                  <button onClick={() => { setStatLeaderboardModal(null); setStatLbSearch(''); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 999, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>×</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search player..."
                    value={statLbSearch}
                    onChange={(e) => setStatLbSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: `4px ${statLbSearch ? 26 : 8}px 4px 8px`, fontSize: 16, border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, outline: 'none', color: '#0f1720', background: '#fff' }}
                  />
                  {statLbSearch && (
                    <button onMouseDown={(e) => { e.preventDefault(); setStatLbSearch(''); }} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#607282', fontSize: 15, lineHeight: 1, padding: 2 }}>×</button>
                  )}
                </div>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: `${listMaxH}px`, padding: '6px 0 12px' }}>
                {statLeaderboardModal.entries === null ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
                ) : statLeaderboardModal.entries.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No data available</div>
                ) : (() => {
                  const allEntries = statLeaderboardModal.entries!;
                  const searchQ = statLbSearch.trim().toLowerCase();
                  const entries = searchQ ? allEntries.filter(e => e.name.toLowerCase().includes(searchQ)) : allEntries;
                  const tourAvgNum = statLeaderboardModal.tourAvg ? parseFloat(statLeaderboardModal.tourAvg.replace('%', '')) : NaN;
                  const lowerIsBetter = ['scoringAverage', 'puttAverage'].includes(statLeaderboardModal.statKey);
                  let dividerIdx = -1;
                  if (!isNaN(tourAvgNum)) {
                    for (let di = 0; di < entries.length; di++) {
                      const v = parseFloat(entries[di].value.replace('%', ''));
                      if (!isNaN(v) && (lowerIsBetter ? v > tourAvgNum : v < tourAvgNum)) { dividerIdx = di; break; }
                    }
                  }
                  const rows: React.ReactNode[] = [];
                  entries.forEach((entry, i) => {
                    const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
                    const isSelected = !!statLeaderboardModal.playerName && normName(entry.name) === normName(statLeaderboardModal.playerName);
                    const rankColor = '#9ca3af';
                    if (i === dividerIdx) {
                      rows.push(
                        <div key="tour-avg-divider" style={{ display: 'flex', alignItems: 'center', padding: '5px 18px 5px 5px', background: '#f0f4f8', borderTop: '2px solid #0f1720', borderBottom: '2px solid #0f1720' }}>
                          <div style={{ flex: 1, height: 1, background: '#0f1720', opacity: 0.15 }} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#0f1720', padding: '0 10px', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{statLeaderboardModal.avgLabel ?? 'Tour Avg'}: {statLeaderboardModal.tourAvg}</span>
                          <div style={{ flex: 1, height: 1, background: '#0f1720', opacity: 0.15 }} />
                        </div>
                      );
                    }
                    rows.push(
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', padding: '9px 18px 9px 5px', borderBottom: i < entries.length - 1 ? `1px solid ${isSelected ? '#c0392b' : '#f0f4f8'}` : 'none', background: isSelected ? '#c0392b' : 'transparent', borderLeft: isSelected ? '4px solid #8b0000' : '4px solid transparent' }}>
                        {/* Rank — right-aligned so units digit always lines up (9 aligns with 0 in 10) */}
                        <div style={{ width: 26, fontSize: 12, fontWeight: 800, color: isSelected ? 'rgba(255,255,255,0.7)' : rankColor, flexShrink: 0, textAlign: 'right', marginRight: 6, paddingTop: 1, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}>{entry.rank}</div>
                        {/* Flag + country — fixed width so player name always starts at same X */}
                        <div style={{ width: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, paddingTop: 1 }}>
                          {getFlagSrc(entry.name) ? (
                            <>
                              <img src={getFlagSrc(entry.name)} alt="" style={{ height: 14, width: 20, objectFit: 'cover', borderRadius: 2, border: `1px solid ${isSelected ? 'rgba(255,255,255,0.4)' : '#d1d9e0'}`, flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.75)' : '#9ca3af', letterSpacing: '0.05em', width: 22, display: 'inline-block' }}>{getCountryLabel(entry.name)}</span>
                            </>
                          ) : null}
                        </div>
                        {/* Player name — wraps to second line if long; white on red if selected */}
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : '#0f1720', minWidth: 0, wordBreak: 'break-word', lineHeight: 1.3 }}>{entry.name}</span>
                        {/* Value — tabular nums + fixed width so every digit lines up vertically */}
                        <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : '#0f1720', flexShrink: 0, width: 68, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"', paddingTop: 1 }}>{entry.value}</div>
                      </div>
                    );
                  });
                  return rows;
                })()}
              </div>
            </div>
          </div>
          );
        })()
  );
}
