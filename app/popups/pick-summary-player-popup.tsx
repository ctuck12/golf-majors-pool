'use client';

import { getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, HeaderNameFlag, REPORT_TOURNAMENTS, REPORT_TOURNAMENT_SOLID } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function PickSummaryPlayerPopup({ p }: { p: PoolPage }) {
  const {
    setPpsPickPopup,
    ppsAllPlayerPopup,
    setPpsAllPlayerPopup,
    reportYear,
    reportEntries,
    isMobile,
    tournament,
    picksRevealedForYear,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(ppsAllPlayerPopup)) return null;
  return (
    (() => {
          const player = ppsAllPlayerPopup;
          const close = () => setPpsAllPlayerPopup(null);
          // Only reveal per-major counts for tournaments that have started/concluded.
          const rows = REPORT_TOURNAMENTS.filter((t) => picksRevealedForYear(t.id, reportYear)).map((t) => ({
            t,
            count: reportEntries.filter((e) => (e.rosters[t.id] ?? []).includes(player.id)).length,
          }));
          const maxC = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
          const total = rows.reduce((s, r) => s + r.count, 0);
          const flagSrc = getPlayerFlag(player.name) ? getFlagSrc(player.name) : null;
          return (
            <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: '#0f1720', padding: '0 14px 0 18px', height: 72, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>
                      <HeaderNameFlag name={player.name} flagSrc={flagSrc} abbr={getCountryLabel(player.name) || null} base={isMobile ? 15 : 16.5} min={isMobile ? 11.5 : 15} allowStack={true} initialStacked={false} />
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 3 }}>{total} total {total === 1 ? 'pick' : 'picks'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <img src="/golf-majors-pool-logo-v11.png" alt="Golf Majors Pool" style={{ height: 72, width: isMobile ? 122 : 152, objectFit: 'cover', objectPosition: 'center', display: 'block', flexShrink: 0 }} />
                    <button onClick={close} style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ padding: '6px 0', overflowY: 'auto' }}>
                  {rows.map(({ t, count }, i) => {
                    const pct = count > 0 ? Math.max(16, Math.round((count / maxC) * 78)) : 0;
                    return (
                      <div key={t.id} onClick={count > 0 ? () => setPpsPickPopup({ id: player.id, name: player.name, tournament: t.id }) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: count > 0 ? 'pointer' : 'default', padding: isMobile ? '11px 14px' : '12px 18px', borderTop: i === 0 ? 'none' : '1px solid #eef2f6' }}>
                        <span style={{ width: isMobile ? 82 : 92, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {TOURNAMENT_TAB_LOGOS[t.id] && <img src={TOURNAMENT_TAB_LOGOS[t.id]} alt={t.label} style={{ height: (t.id === 'players' || t.id === 'pga') ? 38 : t.id === 'masters' ? 30 : 26, maxWidth: isMobile ? 82 : 92, objectFit: 'contain', display: 'block' }} />}
                        </span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{ width: `${pct}%`, minWidth: count > 0 ? (isMobile ? 40 : 46) : 8, height: isMobile ? 22 : 24, borderRadius: 6, background: count > 0 ? REPORT_TOURNAMENT_SOLID[t.id] : '#e2e8f0', flexShrink: 0 }} />
                          <span style={{ flexShrink: 0, fontSize: isMobile ? 13 : 14, fontWeight: 800, color: count > 0 ? '#0f1720' : '#94a3b8', whiteSpace: 'nowrap' }}>{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()
  );
}
