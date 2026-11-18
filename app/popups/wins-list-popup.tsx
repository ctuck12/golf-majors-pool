'use client';

import { majorTint } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function WinsListPopup({ p }: { p: PoolPage }) {
  const {
    winsListPopup,
    setWinsListPopup,
    tournament,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(winsListPopup !== null)) return null;
  return (
    <div
            onClick={() => setWinsListPopup(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 300 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
            >
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #0f1720, #1f2d3a)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{winsListPopup.title}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#8fa3b1', marginTop: 2 }}>{winsListPopup.playerName} · {winsListPopup.wins.length} {winsListPopup.wins.length === 1 ? 'win' : 'wins'}</div>
                </div>
                <button
                  onClick={() => setWinsListPopup(null)}
                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                  aria-label="Close"
                >×</button>
              </div>
              {/* Win list — grouped by year, with major wins tinted in their tournament color */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {(() => {
                  // Group consecutive wins by year (the list is already sorted newest-first).
                  const groups: { year: string; wins: typeof winsListPopup.wins }[] = [];
                  for (const w of winsListPopup.wins) {
                    const last = groups[groups.length - 1];
                    if (last && last.year === w.year) last.wins.push(w);
                    else groups.push({ year: w.year, wins: [w] });
                  }
                  return groups.map((g) => (
                    <div key={g.year}>
                      {/* Year header band */}
                      <div style={{ background: '#eef2f6', padding: '5px 18px', fontSize: 11.5, fontWeight: 800, color: '#56657a', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8ef' }}>{g.year || '—'}</div>
                      {g.wins.map((w, i) => {
                        const theme = majorTint(w.tournament);
                        return (
                          <div key={`${w.tournament}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '11px 18px', background: theme ? theme.bg : '#fff', borderBottom: '1px solid #eef2f6' }}>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: 'block', fontSize: 13.5, color: theme ? theme.text : '#0f1720', fontWeight: 700 }}>{w.tournament || '—'}</span>
                              {w.course && <span style={{ display: 'block', fontSize: 11, color: theme ? theme.text : '#6b7c8c', opacity: theme ? 0.75 : 1, fontWeight: 500, marginTop: 1 }}>{w.course}</span>}
                            </span>
                            {w.toPar && <span style={{ flexShrink: 0, fontSize: 13, color: theme ? theme.text : '#475569', fontWeight: 800 }}>{w.toPar}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
  );
}
