'use client';

import { VenmoMark } from '../venmo-mark';
import { formatMoney, formatVenmo } from '@/app/lib/venmo';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function DetailsScreen({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    setShowTiebreakerRules,
    pool,
    isMobile,
    isFounderPool,
    headerSolid,
  } = p;
  return (
    <main style={{ marginTop: isMobile ? 12 : 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: isMobile ? 10 : 16, alignItems: isMobile ? 'start' : 'stretch' }}>

              <div style={{ display: 'contents' }}>

                {/* ── Card 1: How It Works ── */}
                <section style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}`, gridColumn: isMobile ? undefined : '1', gridRow: isMobile ? undefined : '2', order: 2 }}>
                  <div style={{ padding: isMobile ? 14 : 22 }}>
                    <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: headerSolid, marginBottom: isMobile ? 10 : 14 }}>How It Works</div>
                    <div style={{ display: 'grid', gap: 0 }}>
                      {([
                        <>For each major tournament and The Players Championship, members select <strong>6 golfers</strong>. Each golfer has a salary assigned based on their odds to win.</>,
                        <>Participants have a fixed salary cap of <strong>$50,000</strong> to build their 6-player roster.</>,
                        <>Golfers <strong>can be picked more than once per season.</strong> Points are awarded hole-by-hole plus tournament standings. Cut players receive <strong>−10 pts.</strong></>,
                        <>All <strong>6 golfers</strong> on your roster contribute to your total score.</>,
                        <><strong>1st, 2nd, and 3rd place pay out.</strong> Amounts vary based on the size of the pool field.</>,
                        <>Complete breakdown of tiebreak rules can be found <span onClick={() => setShowTiebreakerRules(true)} style={{ textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontWeight: 700 }}>here</span>.</>,
                      ] as const).map((text, i, arr) => (
                        <div key={i} style={{ borderLeft: `3px solid ${headerSolid}`, paddingLeft: isMobile ? 10 : 14, paddingTop: isMobile ? 7 : 9, paddingBottom: isMobile ? 7 : 9, marginLeft: 2, borderBottom: i < arr.length - 1 ? (selectedTournament === 'open' ? '1px solid rgba(0,0,0,0.08)' : '1px solid #f0f3f6') : 'none', fontSize: isMobile ? 12 : 14, color: selectedTournament === 'open' ? '#000000' : '#374151', lineHeight: 1.55 }}>
                          {text}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── Card 2: Entry & Contact ── */}
                <section style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}`, gridColumn: isMobile ? undefined : '1', gridRow: isMobile ? undefined : '1', order: 1 }}>
                  <div style={{ padding: isMobile ? '12px 14px 0' : '16px 22px 0' }}>
                    <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: headerSolid, marginBottom: isMobile ? 10 : 14 }}>Join the Pool</div>
                  </div>
                  {isFounderPool ? (
                  <div style={{ padding: isMobile ? '0 14px 14px' : '0 22px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isMobile ? 6 : 10 }}>
                    <div style={{ border: selectedTournament === 'open' ? '1.5px solid #000000' : '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 8px' : '10px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#f0f6ff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', letterSpacing: '0.07em' }}>Entry Fee</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 20 : 30, fontWeight: 900, color: selectedTournament === 'open' ? '#000000' : '#173b63' }}>{pool?.entryFees?.[selectedTournament] ? formatMoney(pool.entryFees[selectedTournament]!) : '—'}</div>
                    </div>
                    <div style={{ border: selectedTournament === 'open' ? '1.5px solid #000000' : '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 8px' : '10px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#f0f6ff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', letterSpacing: '0.07em' }}><VenmoMark tone="blue" height="11px" /></div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 13 : 16, fontWeight: 800, color: selectedTournament === 'open' ? '#000000' : '#173b63' }}>{pool?.venmo ? formatVenmo(pool.venmo.handle) : '—'}</div>
                    </div>
                    <div style={{ border: selectedTournament === 'open' ? '1.5px solid #000000' : '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 8px' : '10px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#f0f6ff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', letterSpacing: '0.07em' }}>Questions</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 12 : 15, fontWeight: 800, color: selectedTournament === 'open' ? '#000000' : '#173b63' }}>Clayton Tucker</div>
                      <div style={{ fontSize: isMobile ? 11 : 13, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', marginTop: 2 }}>
                        {isMobile ? (
                          <a href="tel:+13256658299" style={{ color: selectedTournament === 'open' ? headerSolid : '#3d95ce', textDecoration: 'none', fontWeight: 600 }}>(325) 665-8299</a>
                        ) : '(325) 665-8299'}
                      </div>
                    </div>
                  </div>
                  ) : (
                  <div style={{ padding: isMobile ? '0 14px 14px' : '0 22px 22px', display: 'grid', gap: isMobile ? 6 : 10 }}>
                    {pool?.entryFees?.[selectedTournament] || pool?.venmo || pool?.paymentNote ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 6 : 10 }}>
                        <div style={{ border: '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 10px' : '10px 14px', background: '#fff' }}>
                          <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.07em' }}>Entry Fee</div>
                          <div style={{ marginTop: 4, fontSize: isMobile ? 20 : 30, fontWeight: 900, color: '#173b63' }}>{pool?.entryFees?.[selectedTournament] ? formatMoney(pool.entryFees[selectedTournament]!) : '—'}</div>
                        </div>
                        <div style={{ border: '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 10px' : '10px 14px', background: '#fff', minWidth: 0 }}>
                          {pool?.venmoEnabled !== false && (pool?.venmo || !pool?.paymentNote) ? (
                            <>
                              <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.07em' }}><VenmoMark tone="blue" height="11px" /></div>
                              <div style={{ marginTop: 4, fontSize: isMobile ? 13 : 16, fontWeight: 800, color: '#173b63', overflowWrap: 'anywhere' }}>{pool?.venmo ? formatVenmo(pool.venmo.handle) : '—'}</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.07em' }}>How to pay</div>
                              <div style={{ marginTop: 4, fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#173b63', overflowWrap: 'anywhere', lineHeight: 1.35 }}>{pool?.paymentNote || 'Ask your commissioner'}</div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div style={{ border: '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 10px' : '10px 14px', background: '#fff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.07em' }}>Questions? Ask your commissioner</div>
                      {(pool?.commissioners ?? []).map((c) => (
                        <div key={c.id} style={{ marginTop: 6 }}>
                          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: '#173b63' }}>{c.name}</div>
                          <a href={`mailto:${c.email}`} style={{ fontSize: isMobile ? 12 : 13, color: '#3d95ce', textDecoration: 'none', fontWeight: 600 }}>{c.email}</a>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </section>

              </div>{/* end left column */}

              {/* ── Card 3: Scoring System (right column) ── */}
              {(() => {
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
                  <section style={{ background: isGoldTheme ? '#F4BC41' : '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}`, gridColumn: isMobile ? undefined : '2', gridRow: isMobile ? undefined : '1 / 3', order: 3 }}>
                    <div style={{ padding: isMobile ? '12px 14px 0' : '16px 22px 0' }}>
                      <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: headerSolid, marginBottom: isMobile ? 10 : 14 }}>Scoring System</div>
                    </div>
                    <div style={{ padding: isMobile ? '0 14px 14px' : '0 22px 22px' }}>
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
                  </section>
                );
              })()}

            </div>
          </main>
  );
}
