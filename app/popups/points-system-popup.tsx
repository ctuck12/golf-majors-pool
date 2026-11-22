'use client';

import { TOURNAMENT_TAB_LOGOS } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { GmpBadge } from '../gmp-badge';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function PointsSystemPopup({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    setActiveStandingEntryId,
    setActiveStandingGolferId,
    entryBreakdownRef,
    setShowPointsSystem,
    isMobile,
    tournament,
    showPointsSystem,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(showPointsSystem)) return null;
  return (
    <div
            onClick={(e) => {
              const rect = entryBreakdownRef.current?.getBoundingClientRect();
              if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                setShowPointsSystem(false);
              } else {
                setShowPointsSystem(false);
                setActiveStandingGolferId(null);
                setActiveStandingEntryId(null);
              }
            }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 95 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(500px, 100%)', maxHeight: 'calc(100vh - 40px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                const posColor = selectedTournament === 'masters' ? '#2c6449' : '#173b63';
                const isGoldTheme = selectedTournament === 'open';
                const sectionHeaderBg = selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'pga' || selectedTournament === 'us-open' || selectedTournament === 'open') ? '#173b63' : '#f0f4f8';
                const sectionHeaderColor = sectionHeaderBg === '#f0f4f8' ? '#607282' : '#fff';
                const group = (title: string, items: Array<[string, string, boolean?]>) => (
                  <div style={{ background: isGoldTheme ? '#F4BC41' : '#fff', borderRadius: 10, border: '1.5px solid #000000', overflow: 'hidden', marginBottom: 7 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: sectionHeaderColor, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 10px 4px', background: sectionHeaderBg }}>{title}</div>
                    {items.map(([label, pts, neg], i) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', borderBottom: i < items.length - 1 ? (isGoldTheme ? '1px solid rgba(0,0,0,0.08)' : '1px solid #f0f3f6') : 'none' }}>
                        <span style={{ fontWeight: 600, fontSize: isMobile ? 11 : 12, color: '#000000' }}>{label}</span>
                        <span style={{ fontWeight: 800, fontSize: isMobile ? 12 : 13, color: neg ? '#cc2944' : posColor }}>{pts}</span>
                      </div>
                    ))}
                  </div>
                );
                return (
                  <>
                    <div style={{ background: hBg, padding: isMobile ? '14px 16px 12px' : '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Points System</div>
                      {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                        <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <GmpBadge height={36} />
                        </div>
                      )}
                      <button onClick={() => setShowPointsSystem(false)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '10px 12px 16px' : '12px 16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 6 : 10, alignItems: 'start' }}>
                        <div>
                          {group('Strokes', [['Triple+', '−5 pts', true], ['Double', '−3 pts', true], ['Bogey', '−1 pts', true], ['Par', '+.5 pts'], ['Birdie', '+3 pts'], ['Eagle', '+8 pts'], ['Hole in One', '+10 pts'], ['Albatross', '+13 pts']])}
                          {group('Bonuses', [['3 Birdie Streak', '+4 pts'], ['No Bogey Rnd', '+5 pts'], ['Tourn Low Rnd', '+6 pts']])}
                          {group('Round Leaders', [['Rnd 1 Leader', '+5 pts'], ['Rnd 2 Leader', '+5 pts'], ['Rnd 3 Leader', '+5 pts']])}
                        </div>
                        <div>
                          {group('Finishing Position', [['🥇 1st Place', '+40 pts'], ['🥈 2nd Place', '+25 pts'], ['🥉 3rd Place', '+20 pts'], ['4th Place', '+18 pts'], ['5th Place', '+16 pts'], ['6th Place', '+14 pts'], ['7th Place', '+12 pts'], ['8th Place', '+10 pts'], ['9th Place', '+9 pts'], ['10th Place', '+8 pts'], ['11–15th', '+7 pts'], ['16–20th', '+6 pts'], ['21–25th', '+5 pts'], ['26–30th', '+3 pts'], ['31–40th', '+1 pt'], ['Missed Cut', '−10 pts', true]])}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
  );
}
