'use client';

import { Fragment, type CSSProperties } from 'react';
import { CheckCircle2, Lock, Pencil, RefreshCw, Trophy } from 'lucide-react';
import { REQUIRED_GOLFERS, TOURNAMENT_LEADERBOARD_HEADER, TOURNAMENT_CARD_LOGOS, TOURNAMENT_HEADING_LOGOS, FitOneLineText, formatRefresh, readJson, formatLeaderboardPosition, formatTeeTime, teeTimeIsPast, type FeedResponse } from '../pool-data';
import type { PoolPage } from '../pool-page-state';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function StandingsScreen({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    selectedRoster,
    setActiveStandingEntryId,
    setActiveStandingGolferId,
    setShowBonusPoints,
    selectedLeaderboardPlayerId,
    setSelectedLeaderboardPlayerId,
    leaderboardSearch,
    setLeaderboardSearch,
    leaderboardViewMode,
    setLeaderboardViewMode,
    setFullLeaderboardRows,
    expandedCutIds,
    leaderboardSortMode,
    setLeaderboardSortMode,
    leaderboardPickedSort,
    setLeaderboardPickedSort,
    showCutInfo,
    setShowCutInfo,
    showHeaderCutInfo,
    setShowHeaderCutInfo,
    isLoading,
    feed,
    currentFullLeaderboardRows,
    saveMessage,
    sessionUser,
    setShowRosterConfirm,
    setPayWinnersOpen,
    setShowSubmittedPicksPopup,
    standingsColRef,
    leaderboardColRef,
    isMobile,
    isSmallMobile,
    isLandscapePhone,
    tournament,
    selectedTournamentStatus,
    standingsMeta,
    entriesTournamentId,
    selectedTournamentPayouts,
    players,
    playersById,
    hasSubmittedRoster,
    submittedEntries,
    salaryRemaining,
    locked,
    showFinalTournamentView,
    isTournamentFinal,
    currentRoundComplete,
    currentRoundSuspended,
    cutAssigned,
    showProjectedCut,
    courseLocalTimeLabel,
    nextRoundStartLabel,
    nextRoundNum,
    showFutureTournamentView,
    showLivePayoutStrip,
    currentRoundLabel,
    picksOpenForTournament,
    tournamentStartLabel,
    tournamentFieldMondayLabel,
    lineupDeadlineLabel,
    userLabel,
    openPlayerPopup,
    standings,
    eventLeaderboardRows,
    canSave,
    togglePlayer,
    openLiveScorecard,
    openCutScorecardFor,
    handleCutTotalTap,
    openMyEntriesEditor,
    renderRosterCards,
    renderBudgetCards,
    formatPayoutAmount,
    entriesTournamentBg,
    entriesTournamentSolid,
    showPayWinnersPrompt,
  } = p;
  return (
    <main
            style={{
              marginTop: isMobile ? 8 : 24,
              display: 'grid',
              gridTemplateColumns: (isMobile || showFutureTournamentView)
                ? 'minmax(0, 1fr)'
                : showFinalTournamentView
                ? isLandscapePhone ? 'minmax(0, 1.4fr) minmax(300px, 1fr)' : 'minmax(0, 1.7fr) minmax(360px, 0.9fr)'
                : isLandscapePhone ? 'minmax(0, 1.3fr) minmax(280px, 1fr)' : 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
              gap: 20,
            }}
          >
            <section
              ref={standingsColRef}
              style={{
                background: selectedTournament === 'open' ? '#F4BC41' : '#fff',
                borderRadius: 20,
                padding: isSmallMobile ? 12 : isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                alignSelf: 'start',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: isMobile ? 'flex-start' : 'center', position: 'relative' }}>
                <div>
                  {(selectedTournament === 'players' || selectedTournament === 'masters' || selectedTournament === 'pga' || selectedTournament === 'us-open' || selectedTournament === 'open') ? (() => {
                    const fullName = selectedTournament === 'players' ? 'The Players Championship' : selectedTournament === 'masters' ? 'The Masters Tournament' : selectedTournament === 'pga' ? 'The PGA Championship' : selectedTournament === 'us-open' ? 'U.S. Open Championship' : 'The Open Championship';
                    const fs = isSmallMobile ? 17 : isMobile ? 21 : (showLivePayoutStrip ? 25 : 30);
                    return (
                      <h2 style={{ margin: 0, fontSize: fs, fontWeight: 800, color: '#0f1720', lineHeight: 1.15 }}>{fullName}</h2>
                    );
                  })() : TOURNAMENT_HEADING_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_HEADING_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          display: 'block',
                          width: 'min(100%, 640px)',
                          height: 72,
                          objectFit: 'contain',
                          objectPosition: 'left center',
                        }}
                      />
                  ) : (
                    <h2 style={{ margin: 0, fontSize: 26, color: '#0f1720' }}>
                      {showFinalTournamentView ? tournament.name : `${tournament.name} Pool Standings`}
                    </h2>
                  )}
                  {showPayWinnersPrompt ? (
                    // Commissioner only, in place of the course name so the header doesn't grow.
                    <button
                      type="button"
                      onClick={() => setPayWinnersOpen(true)}
                      style={{ display: 'block', marginTop: 3, border: 'none', borderRadius: 999, padding: '0 12px', height: isMobile ? 15 : 17, background: '#008CFF', color: '#fff', fontSize: isMobile ? 10.5 : 11.5, lineHeight: isMobile ? '15px' : '17px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}
                    >
                      Pay Winners
                    </button>
                  ) : isTournamentFinal && !showFutureTournamentView && standingsMeta?.courseName ? (() => {
                    const cn = standingsMeta.courseName;
                    const fs = isMobile ? (cn.length > 23 ? 11.5 : cn.length > 18 ? 12.5 : 13.5) : (cn.length > 26 ? 13.5 : 14.5);
                    return <div style={{ marginTop: 3, fontSize: fs, lineHeight: isMobile ? '15px' : '17px', fontStyle: 'italic', fontWeight: 400, color: '#0f1720', whiteSpace: 'nowrap' }}>{cn}</div>;
                  })() : null}
                </div>
                {showLivePayoutStrip ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: isSmallMobile ? 5 : 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isSmallMobile ? '3px 7px' : isMobile ? '4px 9px' : isLandscapePhone ? '3px 7px' : '6px 10px', fontSize: isSmallMobile ? 10 : isMobile ? 11 : isLandscapePhone ? 10 : 13, fontWeight: 800, color: '#fff', border: selectedTournament === 'masters' ? '1.5px solid #1a4a33' : selectedTournament === 'pga' ? '1.5px solid #8a7040' : selectedTournament === 'us-open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(30,80,50,0.45)' : selectedTournament === 'pga' ? '0 2px 8px rgba(140,112,64,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>
                        1st: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.first)}</span>
                      </div>
                      {selectedTournamentPayouts && !selectedTournamentPayouts.second ? null : (
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isSmallMobile ? '3px 7px' : isMobile ? '4px 9px' : isLandscapePhone ? '3px 7px' : '6px 10px', fontSize: isSmallMobile ? 10 : isMobile ? 11 : isLandscapePhone ? 10 : 13, fontWeight: 800, color: '#fff', border: selectedTournament === 'masters' ? '1.5px solid #1a4a33' : selectedTournament === 'pga' ? '1.5px solid #8a7040' : selectedTournament === 'us-open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(30,80,50,0.45)' : selectedTournament === 'pga' ? '0 2px 8px rgba(140,112,64,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>
                        2nd: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.second)}</span>
                      </div>
                      )}
                      {selectedTournamentPayouts && !selectedTournamentPayouts.third ? null : (
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isSmallMobile ? '3px 7px' : isMobile ? '4px 9px' : isLandscapePhone ? '3px 7px' : '6px 10px', fontSize: isSmallMobile ? 10 : isMobile ? 11 : isLandscapePhone ? 10 : 13, fontWeight: 800, color: '#fff', border: selectedTournament === 'masters' ? '1.5px solid #1a4a33' : selectedTournament === 'pga' ? '1.5px solid #8a7040' : selectedTournament === 'us-open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(30,80,50,0.45)' : selectedTournament === 'pga' ? '0 2px 8px rgba(140,112,64,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>
                        3rd: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.third)}</span>
                      </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setShowBonusPoints(true)}
                          style={{ fontSize: isMobile ? 9 : 10, fontWeight: 800, color: selectedTournament === 'masters' ? '#2c6449' : '#fff', background: selectedTournament === 'pga' ? '#173b63' : selectedTournament === 'us-open' ? '#173b63' : selectedTournament === 'open' ? '#c0392b' : selectedTournament === 'masters' ? '#F3E44D' : '#E0AB43', border: selectedTournament === 'masters' ? '1.5px solid #c8b800' : (selectedTournament === 'pga' || selectedTournament === 'us-open') ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #a07010', cursor: 'pointer', padding: isMobile ? '4px 10px' : isLandscapePhone ? '3px 7px' : '5px 12px', borderRadius: 999, letterSpacing: '0.07em', textTransform: 'uppercase', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(180,150,0,0.45)' : (selectedTournament === 'pga' || selectedTournament === 'us-open') ? '0 2px 8px rgba(14,45,140,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(180,140,0,0.4)' }}
                        >
                          Bonus Points
                        </button>
                      </div>
                      {isTournamentFinal && !showFutureTournamentView ? (
                        <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: (selectedTournament === 'players' || selectedTournament === 'masters' || selectedTournament === 'pga' || selectedTournament === 'us-open') ? '#c0392b' : '#0f1720', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'right' }}>
                          Final Results
                        </div>
                      ) : null}
                  </div>
                ) : !showFutureTournamentView && !showFinalTournamentView ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5b6b79', fontSize: 14 }}>
                    <RefreshCw size={15} />
                    <span>
                      {isLoading
                        ? 'Refreshing live scores...'
                        : formatRefresh(feed?.fetchedAt ?? null)}
                    </span>
                  </div>
                ) : null}
                {(selectedTournament === 'open' || selectedTournament === 'us-open' || selectedTournament === 'pga' || selectedTournament === 'masters' || selectedTournament === 'players') && showLivePayoutStrip && (
                  <img src={selectedTournament === 'open' ? '/open-o-logo.png' : selectedTournament === 'us-open' ? '/us-open-trophy-logo.png' : selectedTournament === 'masters' ? '/masters-map-logo.png' : selectedTournament === 'players' ? '/players-golfer-logo.png' : '/pga-seal-gold.png'} alt="" style={{ position: 'absolute', left: selectedTournament === 'us-open' ? '54.5%' : '54%', top: (isTournamentFinal && !showFutureTournamentView) ? (selectedTournament === 'us-open' ? (isMobile ? '83%' : '72%') : selectedTournament === 'players' ? (isMobile ? '85%' : '75%') : (isMobile ? '80%' : '70%')) : (isMobile ? '108%' : '75%'), transform: 'translate(-50%, -50%)', height: selectedTournament === 'us-open' ? (isMobile ? 57 : 85) : selectedTournament === 'pga' ? (isMobile ? 46 : 60) : selectedTournament === 'masters' ? (isMobile ? 46 : 60) : selectedTournament === 'players' ? (isMobile ? 63 : 86) : (isMobile ? 40 : 54), width: 'auto', objectFit: 'contain', pointerEvents: 'none' }} />
                )}
              </div>
              {!feed?.tournamentComplete && (feed?.currentRound ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720' }}>Round {feed?.currentRound}:</span>
                    {currentRoundSuspended ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fee2e2', border: '1.5px solid #991b1b', borderRadius: 6, padding: '2px 10px 2px 8px', fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#991b1b' }}>⚠ Suspended</span>
                    ) : currentRoundComplete ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: selectedTournament === 'open' ? '#F4BC41' : '#fff', border: '1.5px solid #991b1b', borderRadius: 6, padding: '2px 10px 2px 8px', fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#991b1b' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#991b1b', flexShrink: 0 }} />Complete
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: selectedTournament === 'open' ? '#F4BC41' : '#fff', border: '1.5px solid #15803d', borderRadius: 6, padding: '2px 10px 2px 8px', fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#15803d' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803d', flexShrink: 0 }} />In Progress
                      </span>
                    )}
                  </div>
                  {showProjectedCut && feed?.projectedCut ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
                        <button onClick={() => setShowCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', fontSize: isMobile ? 14 : 16, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }}>ⓘ</button>
                        {showCutInfo && (
                          <>
                            <div onClick={() => setShowCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                            <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 1, background: selectedTournament === 'open' ? '#173b63' : '#fff', border: selectedTournament === 'open' ? '1px solid #0c1f3a' : '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: selectedTournament === 'open' ? '#ffffff' : '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>
                              {(selectedTournament as string) === 'players' ? 'Top 65 & ties' : (selectedTournament as string) === 'masters' ? 'Top 50 & ties' : (selectedTournament as string) === 'pga' ? 'Top 70 & ties' : (selectedTournament as string) === 'us-open' ? 'Top 60 & ties' : 'Top 70 & ties'}
                            </div>
                          </>
                        )}
                      </span>
                      <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#000000' }}>Projected Cut: {feed.projectedCut}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#000000', whiteSpace: 'nowrap' }}>
                      {(feed?.currentRound === 2 && currentRoundComplete && feed?.projectedCut)
                        ? `Cut Line: ${feed.projectedCut}`
                        : currentRoundComplete && nextRoundStartLabel
                        ? `Rd ${nextRoundNum} Start: ${nextRoundStartLabel}`
                        : `Local Time: ${courseLocalTimeLabel}`}
                    </span>
                  )}
                </div>
              )}


              {showFutureTournamentView ? (
                <div
                  style={{
                    marginTop: isMobile ? 14 : 28,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(240px, 320px) minmax(0, 1fr)',
                    gap: isMobile ? 14 : 28,
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: isMobile ? 220 : 260,
                    }}
                  >
                    {TOURNAMENT_CARD_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_CARD_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: (isMobile ? 220 : 260) * (selectedTournament === 'pga' ? 0.86 : selectedTournament === 'us-open' ? 0.9 : 1),
                          height: (isMobile ? 220 : 260) * (selectedTournament === 'pga' ? 0.86 : selectedTournament === 'us-open' ? 0.9 : 1),
                          objectFit: 'contain',
                          display: 'block',
                          transform: selectedTournament === 'players' ? 'translateY(10px) scale(1.12)' : selectedTournament === 'open' ? 'scale(1.18)' : undefined,
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ color: '#0f1720', fontSize: isMobile ? 14 : 17, lineHeight: 1.55 }}>
                    <FitOneLineText
                      base={isMobile ? 15 : 20}
                      min={isMobile ? 11 : 15}
                      text={`${
                        selectedTournament === 'pga'
                          ? 'The PGA Championship'
                          : selectedTournament === 'us-open'
                            ? 'The U.S. Open Championship'
                            : selectedTournament === 'open'
                              ? 'The Open Championship'
                            : selectedTournament === 'masters'
                              ? 'The Masters Tournament'
                            : selectedTournament === 'players'
                              ? 'The Players Championship'
                            : tournament.name
                      } begins on ${tournamentStartLabel}.`}
                    />
                    <div style={{ marginTop: 14 }}>
                      {picksOpenForTournament
                        ? `The field has been finalized and picks are now open in the pool. Build your lineup before ${lineupDeadlineLabel}.`
                        : `Picks can not be entered until the tournament field has been finalized and entered in our system on ${tournamentFieldMondayLabel}.`}
                    </div>

                    {picksOpenForTournament && selectedTournament === entriesTournamentId && sessionUser ? (
                      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <button
                          onClick={openMyEntriesEditor}
                          style={{
                            border: 'none',
                            borderRadius: 16,
                            padding: isMobile ? '10px 16px' : '11px 18px',
                            background: entriesTournamentSolid,
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 900,
                            cursor: 'pointer',
                            boxShadow: '0 14px 28px rgba(9, 34, 51, 0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 14} />
                          {hasSubmittedRoster ? 'Edit Picks' : 'Make Picks'}
                        </button>
                        <div style={{ color: selectedTournament === 'open' ? '#000000' : '#5b6b79', fontSize: isMobile ? 14 : 19, fontWeight: 600 }}>
                          Members with submitted picks:{' '}
                          <span
                            onClick={() => setShowSubmittedPicksPopup(true)}
                            style={{ color: '#0f1720', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                          >{submittedEntries.length}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : showFinalTournamentView ? (
                <div style={{ marginTop: (isTournamentFinal && !showFutureTournamentView) ? (isMobile ? 20 : 34) : (isMobile ? 14 : 28), overflowX: 'auto' }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Rank</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em' }}>Entry</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Points</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Holes Rem</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Tiebreak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          data-entry-id={entry.id}
                          data-picked-highlight={(selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? 'true' : undefined}
                          onClick={() => {
                            setActiveStandingGolferId(null);
                            setActiveStandingEntryId(entry.id);
                            // When a leaderboard player is selected, tapping an entry that did NOT
                            // pick that player clears the selection/highlights; tapping a highlighted
                            // entry (one that picked them) keeps it in place.
                            if (selectedLeaderboardPlayerId && !entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) {
                              setSelectedLeaderboardPlayerId(null);
                            }
                          }}
                          style={{
                            borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe'
                                : selectedTournament === 'open' ? '#F4BC41' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 12px 10px 8px', fontSize: isMobile ? 12 : 13, textAlign: 'center' }}>{entry.place}</td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px' }}>
                            <div
                              style={{
                                fontSize: isMobile ? 13 : 14,
                                color: '#0f1720',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {entry.name}
                              {isTournamentFinal && entry.place === 1 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥇</span>}
                              {isTournamentFinal && entry.place === 2 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥈</span>}
                              {isTournamentFinal && entry.place === 3 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥉</span>}
                            </div>
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', width: 52, fontWeight: 600 }}>{entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}</span> : entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.holesRemaining}</span> : entry.holesRemaining}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 8px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>{selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.tieBreakValue}</span> : entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: (isTournamentFinal && !showFutureTournamentView) ? (isMobile ? 20 : 34) : (isMobile ? 14 : 28), overflowX: 'auto' }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Rank</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em' }}>Entry</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Points</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Holes Rem</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Tiebreak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          data-entry-id={entry.id}
                          data-picked-highlight={(selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? 'true' : undefined}
                          onClick={() => {
                            setActiveStandingGolferId(null);
                            setActiveStandingEntryId(entry.id);
                            // When a leaderboard player is selected, tapping an entry that did NOT
                            // pick that player clears the selection/highlights; tapping a highlighted
                            // entry (one that picked them) keeps it in place.
                            if (selectedLeaderboardPlayerId && !entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) {
                              setSelectedLeaderboardPlayerId(null);
                            }
                          }}
                          style={{
                            borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe'
                                : selectedTournament === 'open' ? '#F4BC41' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 12px 10px 8px', fontSize: isMobile ? 12 : 13, textAlign: 'center' }}>{entry.place}</td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px' }}>
                            <div style={{ fontSize: isMobile ? 13 : 14, color: '#0f1720', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {entry.name}
                              {isTournamentFinal && entry.place === 1 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥇</span>}
                              {isTournamentFinal && entry.place === 2 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥈</span>}
                              {isTournamentFinal && entry.place === 3 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥉</span>}
                            </div>
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', width: 52, fontWeight: 600 }}>{entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}</span> : entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.holesRemaining}</span> : entry.holesRemaining}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 8px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>{selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.tieBreakValue}</span> : entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
            )}
            </section>

            <aside style={{ display: showFutureTournamentView ? 'none' : 'grid', gap: 20, alignSelf: isMobile ? undefined : 'start' }}>
              {showLivePayoutStrip ? (
                <section
                  ref={leaderboardColRef}
                  style={{
                    background: selectedTournament === 'open' && !showFutureTournamentView ? '#F4BC41' : '#fff',
                    borderRadius: 20,
                    padding: isMobile ? 14 : 22,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                    ...(isMobile ? {} : { display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' as const, maxHeight: 'calc(100vh - 120px - var(--safe-y))' }),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 16 }}>
                    {tournament.id === 'us-open' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 7 : 6, width: '100%' }}>
                        <img src="/us-open-tab-logo.png" alt="U.S. Open" style={{ height: isMobile ? 38 : 40, objectFit: 'contain', flexShrink: 0, marginTop: isMobile ? -4 : 0 }} />
                        <span style={{ fontSize: isMobile ? 24 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1, marginTop: isMobile ? -2 : 0, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 60 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'pga' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, width: '100%' }}>
                        <img src="/pga-tab-logo.png" alt="PGA" style={{ height: isMobile ? 50 : 58, objectFit: 'contain', flexShrink: 0, margin: isMobile ? '-11px 0' : '-14px 0' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 70 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'masters' ? (
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: isMobile ? 6 : 10, width: '100%' }}>
                        <img src="/masters-tab-logo.png" alt="Masters" style={{ height: isMobile ? 38 : 46, objectFit: 'contain', flexShrink: 0, marginTop: isMobile ? '-6px' : '-8px' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#2c6449', lineHeight: 1, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 50 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'open' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 7 : 10, width: '100%' }}>
                        <img src="/open-tab-logo.png" alt="The Open" style={{ height: isMobile ? 44 : 46, objectFit: 'contain', flexShrink: 0 }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#0c1f3a', lineHeight: 1, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#000000', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#173b63', border: '1px solid #0c1f3a', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 70 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'players' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 6 : 10, width: '100%', marginTop: isMobile ? -36 : 0, marginBottom: isMobile ? -36 : 0 }}>
                        <img src="/tpc.webp" alt="The Players" style={{ height: isMobile ? 106 : 116, objectFit: 'contain', flexShrink: 0, margin: isMobile ? '0' : '-34px 0' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1, marginTop: isMobile ? '6px' : '0', position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 65 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <h3 style={{ margin: 0, fontSize: isMobile ? 17 : 22, color: '#0f1720', textAlign: 'center', fontWeight: 900, width: '100%' }}>{TOURNAMENT_LEADERBOARD_HEADER[(tournament as { id: string }).id] ?? `${(tournament as { name: string }).name} Leaderboard`}</h3>
                    )}
                  </div>

                  <div style={{ marginTop: isMobile ? 8 : 16, position: 'relative', marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Search player..."
                      value={leaderboardSearch}
                      onChange={(e) => {
                        setLeaderboardSearch(e.target.value);
                        if (isMobile) {
                          requestAnimationFrame(() => {
                            leaderboardColRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
                          });
                        }
                      }}
                      onFocus={(e) => {
                        if (!isMobile) return;
                        setTimeout(() => {
                          leaderboardColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 350);
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: isMobile ? '4px 32px 4px 10px' : `6px ${leaderboardSearch ? 32 : 12}px 6px 12px`,
                        fontSize: isMobile ? 16 : 13,
                        border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3',
                        borderRadius: 8,
                        outline: 'none',
                        color: '#0f1720',
                        background: '#fff',
                      }}
                    />
                    {leaderboardSearch && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setLeaderboardSearch(''); }}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: '#9ca3af',
                          border: 'none',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          lineHeight: 1,
                          touchAction: 'manipulation',
                        }}
                        aria-label="Clear search"
                      >
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                      </button>
                    )}
                  </div>
                  {(() => {
                    const tColor = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                    return (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {(['full', 'picked'] as const).map((mode) => {
                          const isActive = leaderboardViewMode === mode;
                          const label = mode === 'picked' ? 'Picked Only' : 'Full Leaderboard';
                          return (
                            <button
                              key={mode}
                              onClick={async (e) => {
                                (e.currentTarget as HTMLButtonElement).blur();
                                if (mode === 'full' && !currentFullLeaderboardRows) {
                                  try {
                                    const data = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}&fullField=true`, { cache: 'no-store' });
                                    setFullLeaderboardRows(prev => ({ ...prev, [selectedTournament]: data.fullLeaderboard ?? [] }));
                                  } catch { /* keep existing view */ }
                                }
                                setLeaderboardSortMode('default');
                                setLeaderboardPickedSort('default');
                                setLeaderboardViewMode(mode);
                              }}
                              style={{
                                flex: 1,
                                padding: isMobile ? '4px 6px' : '7px 12px',
                                fontSize: isMobile ? 12 : 12,
                                fontWeight: 700,
                                borderRadius: 8,
                                border: `1.5px solid ${tColor}`,
                                background: isActive ? tColor : (selectedTournament === 'open' ? '#F4BC41' : '#fff'),
                                color: isActive ? '#fff' : tColor,
                                cursor: 'pointer',
                                transition: 'background 0.15s, color 0.15s',
                                touchAction: 'manipulation',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div style={{ overflowX: 'auto', overflowY: 'auto', ...(isMobile ? {} : { flex: 1, minHeight: 0, overscrollBehavior: 'contain' }) }}>
                    <div data-leaderboard-table="true" style={{ borderRadius: 10, overflow: isMobile ? 'auto' : 'clip', maxHeight: isMobile ? 726 : undefined, WebkitOverflowScrolling: isMobile ? 'touch' : undefined, border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' } as React.CSSProperties}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 12 : 12 }}>
                      <thead>
                        {(() => {
                          const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                          const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: hBg };
                          return (
                            <tr style={{ background: hBg, color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Pos.</th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Player</th>
                              <th
                                onClick={() => { setLeaderboardPickedSort('default'); setLeaderboardSortMode((m) => m === 'default' ? 'round-desc' : m === 'round-desc' ? 'round-asc' : 'default'); }}
                                style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', ...stickyTh }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                  {leaderboardSortMode === 'default' ? 'Total' : `Rnd ${feed?.currentRound ?? 1}`}
                                  {leaderboardSortMode === 'round-desc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▼</span>}
                                  {leaderboardSortMode === 'round-asc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▲</span>}
                                </span>
                              </th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Thru</th>
                              <th
                                onClick={() => leaderboardViewMode === 'picked' && (() => { setLeaderboardSortMode('default'); setLeaderboardPickedSort((m) => m === 'default' ? 'desc' : m === 'desc' ? 'asc' : 'default'); })()}
                                style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', cursor: leaderboardViewMode === 'picked' ? 'pointer' : 'default', userSelect: leaderboardViewMode === 'picked' ? 'none' : undefined, ...stickyTh }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  Picked
                                  {leaderboardViewMode === 'picked' && leaderboardPickedSort === 'desc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▼</span>}
                                  {leaderboardViewMode === 'picked' && leaderboardPickedSort === 'asc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▲</span>}
                                </span>
                              </th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Info</th>
                            </tr>
                          );
                        })()}
                      </thead>
                      <tbody>
                        {leaderboardViewMode === 'full'
                          ? (() => {
                              if (currentFullLeaderboardRows === null) {
                                return <tr><td colSpan={6} style={{ padding: '28px 16px', textAlign: 'center', color: '#6b7b88', fontSize: isMobile ? 12 : 13 }}>Loading leaderboard…</td></tr>;
                              }
                              const filteredFullRaw = currentFullLeaderboardRows.filter((player) => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()));
                              const CUT_SCORE_SET_FL = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                              const parseCutScore = (s?: string) => { if (!s) return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseRndScoreFL = (s: string | null | undefined) => { if (!s || s === '--') return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseTeeTimeMinFL = (t: string | null | undefined) => { if (!t) return Infinity; const m = t.match(/(\d{1,2}):(\d{2}):/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : Infinity; };
                              const filteredFull = leaderboardSortMode !== 'default'
                                // Round 2 sort keeps the WHOLE field — cut players played round 2, so their
                                // round-2 scores must appear. Rounds 3/4 exclude cut players (they didn't play).
                                ? [...filteredFullRaw].filter((p) => (feed?.currentRound ?? 1) === 2 || !CUT_SCORE_SET_FL.has(p.score.toUpperCase())).sort((a, b) => {
                                    const aS = parseRndScoreFL(a.currentRoundScore);
                                    const bS = parseRndScoreFL(b.currentRoundScore);
                                    if (aS !== bS) return leaderboardSortMode === 'round-desc' ? aS - bS : bS - aS;
                                    if (aS === Infinity) { const aT = parseTeeTimeMinFL(a.teeTime); const bT = parseTeeTimeMinFL(b.teeTime); if (aT !== bT) return aT - bT; }
                                    return a.name.localeCompare(b.name);
                                  })
                                : [
                                    ...filteredFullRaw.filter((p) => !CUT_SCORE_SET_FL.has(p.score.toUpperCase()) && !((feed?.currentRound ?? 1) === 1 && p.thru === '--')).sort((a, b) => {
                                      const parseScoreFL = (s: string) => s === 'E' ? 0 : (parseFloat(s) || 0);
                                      const aScore = parseScoreFL(a.score); const bScore = parseScoreFL(b.score);
                                      if (aScore !== bScore) return aScore - bScore;
                                      const toHolesFL = (thru: string) => thru === 'F' ? 18 : thru === '--' ? -1 : (parseInt(thru) || -1);
                                      const aH = toHolesFL(a.thru); const bH = toHolesFL(b.thru);
                                      if (aH === -1 && bH === -1) { const aT = parseTeeTimeMinFL(a.teeTime); const bT = parseTeeTimeMinFL(b.teeTime); return bT - aT; }
                                      return bH - aH;
                                    }),
                                    ...filteredFullRaw.filter((p) => !CUT_SCORE_SET_FL.has(p.score.toUpperCase()) && (feed?.currentRound ?? 1) === 1 && p.thru === '--').sort((a, b) => parseTeeTimeMinFL(a.teeTime) - parseTeeTimeMinFL(b.teeTime)),
                                    ...filteredFullRaw.filter((p) => CUT_SCORE_SET_FL.has(p.score.toUpperCase()) && p.score.toUpperCase() !== 'WD' && p.score.toUpperCase() !== 'DQ').sort((a, b) => parseCutScore(a.originalScore) - parseCutScore(b.originalScore)),
                                    ...filteredFullRaw.filter((p) => p.score.toUpperCase() === 'WD' || p.score.toUpperCase() === 'DQ'),
                                  ];
                              const espnRoundFL = feed?.currentRound ?? 1;
                              const projCutNum = showProjectedCut && feed?.projectedCut && leaderboardSortMode === 'default' && espnRoundFL <= 2
                                ? (feed.projectedCut === 'E' ? 0 : parseFloat(feed.projectedCut) || 0)
                                : null;
                              const cutLineIdx = projCutNum !== null
                                ? filteredFull.reduce((last, p, i) => {
                                    const s = p.score.toUpperCase();
                                    if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF' || s === 'MC') return last;
                                    const n = s === 'E' ? 0 : parseFloat(p.score);
                                    return !isNaN(n) && n <= projCutNum ? i : last;
                                  }, -1)
                                : -1;
                              const derivedCutScoreFL = (espnRoundFL >= 3 || (espnRoundFL === 2 && currentRoundComplete)) ? (() => {
                                const scores = (currentFullLeaderboardRows ?? []).filter(p => p.score === 'CUT' && p.originalScore).map(p => p.originalScore === 'E' ? 0 : parseFloat(p.originalScore!)).filter(n => !isNaN(n));
                                if (!scores.length) return null;
                                const cutLine = Math.min(...scores) - 1;
                                return cutLine === 0 ? 'E' : cutLine > 0 ? `+${cutLine}` : String(cutLine);
                              })() : null;
                              const effectiveCutScoreFL = feed?.projectedCut ?? derivedCutScoreFL;
                              const r34CutLineFL = leaderboardSortMode === 'default' && (espnRoundFL >= 3 || (espnRoundFL === 2 && currentRoundComplete && cutAssigned)) && effectiveCutScoreFL
                                ? filteredFull.reduce((last, p, i) => CUT_SCORE_SET_FL.has(p.score.toUpperCase()) ? last : i, -1)
                                : -1;
                              return filteredFull.map((player, rowIndex) => {
                                const timesPicked = player.poolPlayerId !== null
                                  ? standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === player.poolPlayerId).length, 0)
                                  : 0;
                                const activePlayer = player.poolPlayerId !== null && selectedLeaderboardPlayerId === player.poolPlayerId;
                                const notStartedR1 = (feed?.currentRound ?? 1) === 1 && player.thru === '--';
                                const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                const displayScore = showProjectedCut && isCutStatus && player.originalScore ? player.originalScore : player.score;
                                const displayScoreNum = parseFloat(displayScore);
                                const displayIsUnderPar = !isNaN(displayScoreNum) && displayScoreNum < 0;
                                const displayIsCut = displayScore === 'CUT' || displayScore === 'MDF' || displayScore === 'WD' || displayScore === 'DQ';
                                const colVal = leaderboardSortMode !== 'default' ? (player.currentRoundScore ?? '--') : displayScore;
                                const colNum = parseFloat(colVal);
                                const colUnderPar = !isNaN(colNum) && colNum < 0;
                                const colIsCut = displayIsCut && leaderboardSortMode === 'default';
                                const useRedBadge = selectedTournament === 'open' && colUnderPar;
                                const useNavyBadge = selectedTournament === 'open' && !colUnderPar && !colIsCut && colVal !== '--' && (colVal === 'E' || (!isNaN(colNum) && colNum > 0));
                                const rowBg = activePlayer ? (selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe') : selectedTournament === 'open' ? '#F4BC41' : '#ffffff';
                                return (
                                  <Fragment key={player.playerId}>
                                    <tr
                                      data-leaderboard-golfer="true"
                                      onClick={() => {
                                        if (player.poolPlayerId !== null && timesPicked > 0) {
                                          setSelectedLeaderboardPlayerId(activePlayer ? null : player.poolPlayerId);
                                        } else if (player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ') {
                                          openCutScorecardFor(player.name);
                                        } else {
                                          openLiveScorecard(player.name, player.teeTime ?? null, player.thru, player.backNineStart ?? false);
                                        }
                                      }}
                                      style={{ background: rowBg, borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef', cursor: 'pointer' }}
                                    >
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: 600, color: selectedTournament === 'open' ? '#0f1720' : '#374151' }}>{notStartedR1 ? '—' : (player.score === 'WD' || player.score === 'DQ') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{player.score}</span> : formatLeaderboardPosition(player.position)}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', fontWeight: activePlayer ? 800 : 500, color: '#0f1720' }}>{player.name}</td>
                                      {/* eslint-disable-next-line react-hooks/refs -- the tap handler reads its timer ref when tapped, not while rendering */}
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: colIsCut ? 600 : 700, color: colUnderPar && !useRedBadge ? '#dc2626' : (useNavyBadge ? '#0f1720' : (colVal === 'E' ? '#16a34a' : (colIsCut ? '#374151' : '#0f1720'))) }}>{notStartedR1 ? '—' : player.score === 'CUT' && player.originalScore && leaderboardSortMode === 'default' ? <span onClick={(e) => handleCutTotalTap(String(player.playerId), player.name, e)} style={{ cursor: 'pointer', display: 'inline-block', minWidth: 34, textAlign: 'center', WebkitTapHighlightColor: 'transparent', userSelect: 'none', touchAction: 'manipulation' }}>{expandedCutIds.has(String(player.playerId)) ? player.originalScore : 'CUT'}</span> : (() => { const valNode = useRedBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : useNavyBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a5f', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : (colIsCut && colVal !== 'CUT') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : colVal; return (player.poolPlayerId !== null && timesPicked > 0) ? <span onClick={(e) => { e.stopPropagation(); openLiveScorecard(player.name, player.teeTime ?? null, player.thru, player.backNineStart ?? false); }} style={{ cursor: 'pointer', display: 'inline-block', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>{valNode}</span> : valNode; })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', whiteSpace: 'nowrap', color: selectedTournament === 'open' ? '#000000' : '#374151' }}>{(() => {
                                        const isGoldTheme = selectedTournament === 'open';
                                        const thruDisplay = (() => {
                                          if (player.score === 'WD' || player.score === 'DQ') return '--';
                                          const isLive = selectedTournamentStatus?.label === 'IN PROGRESS';
                                          if (isLive && !isCutStatus && player.thru === '--' && player.teeTime) {
                                            return teeTimeIsPast(player.teeTime) ? '--' : formatTeeTime(player.teeTime);
                                          }
                                          const clientRound = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                                          const espnRound = feed?.currentRound ?? 1;
                                          if (isLive && !isCutStatus && player.thru === 'F' && clientRound > espnRound) {
                                            return player.teeTime ? formatTeeTime(player.teeTime) : '--';
                                          }
                                          const thruVal = player.thru;
                                          return player.backNineStart && thruVal !== '--' && thruVal !== 'F'
                                            ? <span style={{ position: 'relative', display: 'inline-block' }}>{thruVal}<span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65em', lineHeight: 1 }}>*</span></span>
                                            : thruVal;
                                        })();
                                        return thruDisplay;
                                      })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: selectedTournament === 'open' ? '#000000' : (timesPicked > 0 ? '#374151' : '#b0bec5') }}>{timesPicked > 0 ? timesPicked : '–'}</td>
                                      <td style={{ padding: isMobile ? '6px 2px' : '7px 6px', textAlign: 'center' }}><button onClick={(e) => { e.stopPropagation(); const poolPlayer = player.poolPlayerId !== null ? playersById[player.poolPlayerId] : undefined; openPlayerPopup({ id: player.poolPlayerId ?? 0, name: player.name, pgaTourId: poolPlayer?.pgaTourId ?? 0, photoUrl: poolPlayer?.photoUrl, worldRank: poolPlayer?.worldRank }); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: selectedTournament === 'open' ? '#000000' : '#607282', lineHeight: 1, touchAction: 'manipulation' }}>ⓘ</button></td>
                                    </tr>
                                    {rowIndex === cutLineIdx && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>PROJECTED CUT{feed?.projectedCut ? `: ${feed.projectedCut}` : ''}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {rowIndex === r34CutLineFL && !leaderboardSearch && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE: {effectiveCutScoreFL}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              });
                            })()
                          : (() => {
                              const filteredPickedRaw = eventLeaderboardRows.filter((player) => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()));
                              const CUT_SCORE_SET_PO = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                              const parseCutScorePO = (s?: string) => { if (!s) return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseRndScorePO = (s: string | null | undefined) => { if (!s || s === '--') return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseTeeTimeMinPO = (t: string | null | undefined) => { if (!t) return Infinity; const m = t.match(/(\d{1,2}):(\d{2}):/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : Infinity; };
                              const pickedCountMap = new Map<number, number>();
                              for (const entry of standings) {
                                for (const golfer of entry.golfers) {
                                  pickedCountMap.set(golfer.id, (pickedCountMap.get(golfer.id) ?? 0) + 1);
                                }
                              }
                              const filteredPicked = leaderboardPickedSort !== 'default'
                                ? [...filteredPickedRaw].sort((a, b) => {
                                    const aP = pickedCountMap.get(a.id) ?? 0;
                                    const bP = pickedCountMap.get(b.id) ?? 0;
                                    if (aP !== bP) return leaderboardPickedSort === 'desc' ? bP - aP : aP - bP;
                                    return a.name.localeCompare(b.name);
                                  })
                                : leaderboardSortMode !== 'default'
                                ? [...filteredPickedRaw].filter((p) => (feed?.currentRound ?? 1) === 2 || !CUT_SCORE_SET_PO.has(p.score.toUpperCase())).sort((a, b) => {
                                    const aS = parseRndScorePO(a.currentRoundScore);
                                    const bS = parseRndScorePO(b.currentRoundScore);
                                    if (aS !== bS) return leaderboardSortMode === 'round-desc' ? aS - bS : bS - aS;
                                    if (aS === Infinity) { const aT = parseTeeTimeMinPO(a.teeTime); const bT = parseTeeTimeMinPO(b.teeTime); if (aT !== bT) return aT - bT; }
                                    return a.name.localeCompare(b.name);
                                  })
                                : [
                                    ...filteredPickedRaw.filter((p) => !CUT_SCORE_SET_PO.has(p.score.toUpperCase()) && !((feed?.currentRound ?? 1) === 1 && p.thru === '--')).sort((a, b) => {
                                      const parseScorePO = (s: string) => s === 'E' ? 0 : (parseFloat(s) || 0);
                                      const aScore = parseScorePO(a.score); const bScore = parseScorePO(b.score);
                                      if (aScore !== bScore) return aScore - bScore;
                                      const toHolesPO = (thru: string) => thru === 'F' ? 18 : thru === '--' ? -1 : (parseInt(thru) || -1);
                                      const aH = toHolesPO(a.thru); const bH = toHolesPO(b.thru);
                                      if (aH === -1 && bH === -1) { const aT = parseTeeTimeMinPO(a.teeTime); const bT = parseTeeTimeMinPO(b.teeTime); return bT - aT; }
                                      return bH - aH;
                                    }),
                                    ...filteredPickedRaw.filter((p) => !CUT_SCORE_SET_PO.has(p.score.toUpperCase()) && (feed?.currentRound ?? 1) === 1 && p.thru === '--').sort((a, b) => parseTeeTimeMinPO(a.teeTime) - parseTeeTimeMinPO(b.teeTime)),
                                    ...filteredPickedRaw.filter((p) => CUT_SCORE_SET_PO.has(p.score.toUpperCase()) && p.score.toUpperCase() !== 'WD' && p.score.toUpperCase() !== 'DQ').sort((a, b) => parseCutScorePO(a.originalScore) - parseCutScorePO(b.originalScore)),
                                    ...filteredPickedRaw.filter((p) => p.score.toUpperCase() === 'WD' || p.score.toUpperCase() === 'DQ'),
                                  ];
                              const espnRoundPO = feed?.currentRound ?? 1;
                              const projCutNum = showProjectedCut && feed?.projectedCut && leaderboardSortMode === 'default' && leaderboardPickedSort === 'default' && espnRoundPO <= 2
                                ? (feed.projectedCut === 'E' ? 0 : parseFloat(feed.projectedCut) || 0)
                                : null;
                              const cutLineIdx = projCutNum !== null
                                ? filteredPicked.reduce((last, p, i) => {
                                    const s = p.score.toUpperCase();
                                    if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF' || s === 'MC') return last;
                                    const n = s === 'E' ? 0 : parseFloat(p.score);
                                    return !isNaN(n) && n <= projCutNum ? i : last;
                                  }, -1)
                                : -1;
                              const derivedCutScorePO = (espnRoundPO >= 3 || (espnRoundPO === 2 && currentRoundComplete)) ? (() => {
                                const cutSource: Array<{ score: string; originalScore?: string }> = currentFullLeaderboardRows?.length ? currentFullLeaderboardRows : (feed?.players ?? []);
                                const scores = cutSource.filter(p => p.score === 'CUT' && p.originalScore).map(p => p.originalScore === 'E' ? 0 : parseFloat(p.originalScore!)).filter(n => !isNaN(n));
                                if (!scores.length) return null;
                                const cutLine = Math.min(...scores) - 1;
                                return cutLine === 0 ? 'E' : cutLine > 0 ? `+${cutLine}` : String(cutLine);
                              })() : null;
                              const effectiveCutScorePO = feed?.projectedCut ?? derivedCutScorePO;
                              const r34CutLinePO = leaderboardSortMode === 'default' && leaderboardPickedSort === 'default' && (espnRoundPO >= 3 || (espnRoundPO === 2 && currentRoundComplete && cutAssigned)) && effectiveCutScorePO
                                ? filteredPicked.reduce((last, p, i) => CUT_SCORE_SET_PO.has(p.score.toUpperCase()) ? last : i, -1)
                                : -1;
                              return filteredPicked.map((player, rowIndex) => {
                                const timesPicked = pickedCountMap.get(player.id) ?? 0;
                                const activePlayer = selectedLeaderboardPlayerId === player.id;
                                const notStartedR1 = (feed?.currentRound ?? 1) === 1 && player.thru === '--';
                                const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                const displayScore = showProjectedCut && isCutStatus && player.originalScore ? player.originalScore : player.score;
                                const displayScoreNum = parseFloat(displayScore);
                                const displayIsUnderPar = !isNaN(displayScoreNum) && displayScoreNum < 0;
                                const displayIsCut = displayScore === 'CUT' || displayScore === 'MDF' || displayScore === 'WD' || displayScore === 'DQ';
                                const colVal = leaderboardSortMode !== 'default' ? (player.currentRoundScore ?? '--') : displayScore;
                                const colNum = parseFloat(colVal);
                                const colUnderPar = !isNaN(colNum) && colNum < 0;
                                const colIsCut = displayIsCut && leaderboardSortMode === 'default';
                                const useRedBadge = selectedTournament === 'open' && colUnderPar;
                                const useNavyBadge = selectedTournament === 'open' && !colUnderPar && !colIsCut && colVal !== '--' && (colVal === 'E' || (!isNaN(colNum) && colNum > 0));
                                const rowBg = activePlayer ? (selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe') : selectedTournament === 'open' ? '#F4BC41' : '#ffffff';
                                return (
                                  <Fragment key={player.id}>
                                    <tr
                                      data-leaderboard-golfer="true"
                                      onClick={() => setSelectedLeaderboardPlayerId(activePlayer ? null : player.id)}
                                      style={{
                                        background: rowBg,
                                        borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: 600, color: selectedTournament === 'open' ? '#0f1720' : '#374151' }}>{notStartedR1 ? '—' : (player.score === 'WD' || player.score === 'DQ') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{player.score}</span> : formatLeaderboardPosition(player.position)}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', fontWeight: activePlayer ? 800 : 500, color: '#0f1720' }}>{player.name}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: colIsCut ? 600 : 700, color: colUnderPar && !useRedBadge ? '#dc2626' : (useNavyBadge ? '#0f1720' : (colVal === 'E' ? '#16a34a' : (colIsCut ? '#374151' : '#0f1720'))) }}>{notStartedR1 ? '—' : player.score === 'CUT' && player.originalScore && leaderboardSortMode === 'default' ? <span onClick={(e) => handleCutTotalTap(String(player.id), player.name, e)} style={{ cursor: 'pointer', display: 'inline-block', minWidth: 34, textAlign: 'center', WebkitTapHighlightColor: 'transparent', userSelect: 'none', touchAction: 'manipulation' }}>{expandedCutIds.has(String(player.id)) ? player.originalScore : 'CUT'}</span> : (() => { const valNode = useRedBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : useNavyBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a5f', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : (colIsCut && colVal !== 'CUT') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : colVal; return (timesPicked > 0) ? <span onClick={(e) => { e.stopPropagation(); openLiveScorecard(player.name, player.teeTime ?? null, player.thru, player.backNineStart ?? false); }} style={{ cursor: 'pointer', display: 'inline-block', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>{valNode}</span> : valNode; })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', whiteSpace: 'nowrap', color: selectedTournament === 'open' ? '#000000' : '#374151' }}>{(() => {
                                        const isGoldTheme = selectedTournament === 'open';
                                        const thruDisplay = (() => {
                                          if (player.score === 'WD' || player.score === 'DQ') return '--';
                                          const isLive = selectedTournamentStatus?.label === 'IN PROGRESS';
                                          const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                          if (isLive && !isCutStatus && player.thru === '--' && player.teeTime) {
                                            return teeTimeIsPast(player.teeTime) ? '--' : formatTeeTime(player.teeTime);
                                          }
                                          const clientRound = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                                          const espnRound = feed?.currentRound ?? 1;
                                          if (isLive && !isCutStatus && player.thru === 'F' && clientRound > espnRound) {
                                            return player.teeTime ? formatTeeTime(player.teeTime) : '--';
                                          }
                                          const thruVal = player.thru;
                                          return player.backNineStart && thruVal !== '--' && thruVal !== 'F'
                                            ? <span style={{ position: 'relative', display: 'inline-block' }}>{thruVal}<span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65em', lineHeight: 1 }}>*</span></span>
                                            : thruVal;
                                        })();
                                        return thruDisplay;
                                      })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: selectedTournament === 'open' ? '#000000' : '#374151' }}>
                                        {timesPicked}
                                      </td>
                                      <td style={{ padding: isMobile ? '6px 2px' : '7px 6px', textAlign: 'center' }}><button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: selectedTournament === 'open' ? '#000000' : '#607282', lineHeight: 1, touchAction: 'manipulation' }}>ⓘ</button></td>
                                    </tr>
                                    {rowIndex === cutLineIdx && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>PROJECTED CUT{feed?.projectedCut ? `: ${feed.projectedCut}` : ''}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {rowIndex === r34CutLinePO && !leaderboardSearch && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE: {effectiveCutScorePO}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              });
                            })()}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </section>
              ) : null}

              {!showLivePayoutStrip ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                      My entry
                    </div>
                    <h3 style={{ margin: '6px 0 0', fontSize: 24 }}>{userLabel}</h3>
                    <div style={{ marginTop: 4, color: '#6b7b88', fontSize: 13 }}>
                      {sessionUser ? 'Saved to your account' : 'Guest mode until you sign in'}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 999,
                      background: locked ? '#fff1f2' : '#eaf2ff',
                      color: locked ? '#be123c' : '#2f5f96',
                      fontWeight: 800,
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    <Lock size={14} />
                    {locked ? 'Locked' : 'Editable'}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>{renderRosterCards('#fff')}</div>
                {renderBudgetCards('#f5f9fb', 'none')}

                {!sessionUser ? (
                  <div
                    style={{
                      marginTop: 14,
                      borderRadius: 14,
                      background: '#fff8e7',
                      color: '#9a6700',
                      padding: '12px 14px',
                    }}
                  >
                    Sign in or create an account above to save this lineup to the pool.
                  </div>
                ) : null}

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      background: '#eef4ff',
                      color: '#2f5f96',
                      padding: '12px 14px',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{saveMessage}</span>
                  </div>
                ) : null}

                <button
                  onClick={() => canSave && setShowRosterConfirm(true)}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: canSave ? entriesTournamentBg : '#cbd5df',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: canSave ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {sessionUser ? 'Submit Roster' : 'Sign in to save'}
                </button>
              </section>
              ) : null}

              {!showLivePayoutStrip ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Trophy size={18} color="#2f5f96" />
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Tracked golfers</div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {players.map((player) => {
                    const selected = selectedRoster.includes(player.id);
                    const disabled =
                      !selected &&
                      (locked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining);

                    return (
                      <button
                        key={player.id}
                        onClick={() => togglePlayer(player.id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 16,
                          border: selected ? '2px solid #3f73ad' : disabled ? '1px solid #d7dee6' : '1px solid #e6edf1',
                          background: selected ? '#eef4ff' : disabled ? '#f3f5f7' : '#fff',
                          padding: 14,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.58 : 1,
                        }}
                        disabled={disabled}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800, color: disabled ? '#748391' : '#0f1720' }}>{player.name}</div>
                            <div style={{ marginTop: 4, color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 13 }}>
                              OWGR {player.worldRank} | {player.odds}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: 20 }}>{player.score}</div>
                            <div style={{ color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 12 }}>
                              ${player.salary.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
              ) : null}
            </aside>
          </main>
  );
}
