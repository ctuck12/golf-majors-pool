'use client';

import { canonicalNameKey } from '@/app/lib/name-match';
import { SCORING_RULES } from '../lib/scoring';
import { getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, PGA_CLUB_PROFESSIONALS, HeaderNameFlag, fitPopupHeader, formatPointValue, ordinal, FOUNDER_POOL_ID, KNOCKOUT_TAB_LOGOS } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { GmpBadge } from '../gmp-badge';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function GolferBreakdownPopup({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    setActiveStandingEntryId,
    setActiveStandingGolferId,
    entryBreakdownRef,
    setShowPointsSystem,
    isMobile,
    tournament,
    clubProKeys,
    showFutureTournamentView,
    activeStandingGolfer,
    pool,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(activeStandingGolfer)) return null;
  return (
    <div
            onClick={(e) => {
              const rect = entryBreakdownRef.current?.getBoundingClientRect();
              setShowPointsSystem(false);
              if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                setActiveStandingGolferId(null);
              } else {
                setActiveStandingGolferId(null);
                setActiveStandingEntryId(null);
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(9,20,34,0.62)',
              backdropFilter: 'blur(7px)',
              WebkitBackdropFilter: 'blur(7px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="breakdown-modal scoring-breakdown-modal"
              style={{
                width: 'min(480px, 100%)',
                maxHeight: 'calc(100vh - 40px - var(--safe-y))',
                background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa',
                borderRadius: 20,
                boxShadow: '0 24px 60px rgba(9,34,51,0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Colored header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {/* When the country code hangs under the flag, the block makes room for it so the name,
                        flag and code sit centered as a group on the logo. */}
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).stacked ? 12 : 0 }}>
                      <div style={{ fontSize: fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={activeStandingGolfer.name} flagSrc={getPlayerFlag(activeStandingGolfer.name) ? getFlagSrc(activeStandingGolfer.name) : null} abbr={getCountryLabel(activeStandingGolfer.name) || null} base={fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).stacked} />{getPlayerFlag(activeStandingGolfer.name) && <>{(PGA_CLUB_PROFESSIONALS.has(activeStandingGolfer.name) || clubProKeys.has(canonicalNameKey(activeStandingGolfer.name))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: selectedTournament !== 'open' ? 'center' : undefined }}>
                        {pool?.id === FOUNDER_POOL_ID ? <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ ...(isMobile ? {} : { transform: 'scale(1.3)', transformOrigin: 'right center' }), height: selectedTournament === 'pga' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} /> : <GmpBadge height={34 * (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 0.75 : 1)} />}
                      </div>
                    )}
                    <button
                      onClick={() => { setShowPointsSystem(false); setActiveStandingGolferId(null); }}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, alignSelf: selectedTournament !== 'open' ? 'center' : undefined }}
                    >✕</button>
                  </div>
                );
              })()}

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Pars', activeStandingGolfer.scoreBreakdown.statLine.par, activeStandingGolfer.scoreBreakdown.statLine.par * SCORING_RULES.par],
                  ['Birdies', activeStandingGolfer.scoreBreakdown.statLine.birdie, activeStandingGolfer.scoreBreakdown.statLine.birdie * SCORING_RULES.birdie],
                  ['Eagles', activeStandingGolfer.scoreBreakdown.statLine.eagle, activeStandingGolfer.scoreBreakdown.statLine.eagle * SCORING_RULES.eagle],
                  ['Albatrosses', activeStandingGolfer.scoreBreakdown.statLine.albatross, activeStandingGolfer.scoreBreakdown.statLine.albatross * SCORING_RULES.albatross],
                  ['Aces', activeStandingGolfer.scoreBreakdown.statLine.holeInOne, activeStandingGolfer.scoreBreakdown.statLine.holeInOne * SCORING_RULES.holeInOne],
                  ['Bogeys', activeStandingGolfer.scoreBreakdown.statLine.bogey, activeStandingGolfer.scoreBreakdown.statLine.bogey * SCORING_RULES.bogey],
                  ['Double Bogeys', activeStandingGolfer.scoreBreakdown.statLine.doubleBogey, activeStandingGolfer.scoreBreakdown.statLine.doubleBogey * SCORING_RULES.doubleBogey],
                  ['Triple Bogey+', activeStandingGolfer.scoreBreakdown.statLine.tripleOrWorse, activeStandingGolfer.scoreBreakdown.statLine.tripleOrWorse * SCORING_RULES.tripleOrWorse],
                  ['3 Birdie Streaks', activeStandingGolfer.scoreBreakdown.statLine.threeBirdieStreaks, activeStandingGolfer.scoreBreakdown.statLine.threeBirdieStreaks * SCORING_RULES.threeBirdieStreak],
                  ['No Bogey Rnds', activeStandingGolfer.scoreBreakdown.statLine.bogeyFreeRounds, activeStandingGolfer.scoreBreakdown.statLine.bogeyFreeRounds * SCORING_RULES.bogeyFreeRound],
                  ['Tourn Low Rnd', activeStandingGolfer.scoreBreakdown.statLine.lowRounds, activeStandingGolfer.scoreBreakdown.statLine.lowRounds * SCORING_RULES.tourneyLowRound],
                  ['Rnd 1 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.first ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.first ? SCORING_RULES.firstRoundLeader : 0],
                  ['Rnd 2 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.second ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.second ? SCORING_RULES.secondRoundLeader : 0],
                  ['Rnd 3 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.third ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.third ? SCORING_RULES.thirdRoundLeader : 0],
                ]
                  .filter(([, count]) => Number(count) > 0)
                  .concat([
                    ['Leaderboard Place', activeStandingGolfer.position, activeStandingGolfer.scoreBreakdown.madeCut === false ? activeStandingGolfer.scoreBreakdown.cutPenaltyPoints : activeStandingGolfer.scoreBreakdown.placementPoints] as const,
                    ['Total', '', activeStandingGolfer.points] as const,
                  ])
                  .map(([label, count, points]) => (
                  <div
                    key={String(label)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1.3fr) minmax(100px, 0.7fr) minmax(80px, 0.7fr)',
                      gap: 8,
                      alignItems: 'center',
                      border: selectedTournament === 'open' ? '1px solid #000000' : selectedTournament === 'players' ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e6edf1',
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: String(label) === 'Total' ? (selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63') : selectedTournament === 'open' && !showFutureTournamentView ? '#F4BC41' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: String(label) === 'Total' ? '#ffffff' : '#0f1720' }}>{label}</div>
                    <div style={{ color: selectedTournament === 'open' ? '#000000' : (selectedTournament === 'players') ? '#4a5568' : '#6b7b88', fontSize: 12 }}>
                      {label === 'Leaderboard Place'
                        ? `Position: ${ordinal(String(count))}`
                        : ['Tourn Low Rnd', 'Rnd 1 Leader', 'Rnd 2 Leader', 'Rnd 3 Leader', 'Total'].includes(String(label))
                        ? ''
                        : `Count: ${String(count)}`}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: String(label) === 'Total' ? '#ffffff' : Number(points) < 0 ? '#cc2944' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'players' ? '#c8860a' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#173b63' }}>
                      {formatPointValue(Number(points))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
  );
}
