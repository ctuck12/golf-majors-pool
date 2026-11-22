'use client';

import { getPlayerFlag, getFlagSrc, getCountryLabel, HeaderNameFlag, REPORT_TOURNAMENT_SOLID } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { GmpBadge } from '../gmp-badge';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function PickedByPopup({ p }: { p: PoolPage }) {
  const {
    ppsPickPopup,
    setPpsPickPopup,
    reportYear,
    reportEntries,
    isMobile,
    tournament,
    picksRevealedForYear,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(ppsPickPopup)) return null;
  return (
    (() => {
          const T = ppsPickPopup.tournament;
          const headerColor = REPORT_TOURNAMENT_SOLID[T];
                    const entriesPicked = reportEntries
            .filter((e) => (e.rosters[T] ?? []).includes(ppsPickPopup.id))
            .map((e) => e.name)
            .sort((a, b) => a.localeCompare(b));
          const close = () => setPpsPickPopup(null);
          const flagSrc = getPlayerFlag(ppsPickPopup.name) ? getFlagSrc(ppsPickPopup.name) : null;
          return (
            <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: headerColor, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>
                    <HeaderNameFlag name={ppsPickPopup.name} flagSrc={flagSrc} abbr={getCountryLabel(ppsPickPopup.name) || null} base={isMobile ? 15 : 16} min={isMobile ? 11.5 : 14} allowStack={true} initialStacked={false} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <GmpBadge height={32} />
                    <button onClick={close} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ padding: '9px 0', overflowY: 'auto' }}>
                  {!picksRevealedForYear(T, reportYear) ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#5b6b79', fontSize: 14, lineHeight: 1.5 }}>Picks are hidden until the tournament begins.</div>
                  ) : (
                    <>
                      <div style={{ padding: '0 18px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                        {entriesPicked.length} {entriesPicked.length === 1 ? 'entry' : 'entries'}
                      </div>
                      {entriesPicked.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#5b6b79', fontSize: 14 }}>No entries picked this player.</div>
                      ) : entriesPicked.map((n, i) => (
                        <div key={i} style={{ padding: '11px 18px', borderTop: '1px solid #eef2f6', fontSize: 14, fontWeight: 600, color: '#0f1720' }}>{n}</div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()
  );
}
