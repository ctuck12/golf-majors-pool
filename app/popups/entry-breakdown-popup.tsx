'use client';

import { TOURNAMENT_TAB_LOGOS, pgaPhoto, playerPhotoSrc, photoOnError, formatPointValue, formatPosition, formatTeeTime, formatCurrentRoundScore, FOUNDER_POOL_ID, KNOCKOUT_TAB_LOGOS } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { GmpBadge } from '../gmp-badge';
import { PoweredBy } from '../powered-by';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function EntryBreakdownPopup({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    setActiveStandingEntryId,
    activeStandingGolferId,
    setActiveStandingGolferId,
    setScorecardGolferName,
    setScorecardGolferPhoto,
    setScorecardGolferTeeTime,
    setScorecardGolferThru,
    setScorecardGolferBackNineStart,
    setScorecardData,
    setScorecardLoading,
    setCutScorecardGolfer,
    setCutScorecardData,
    setCutScorecardLoading,
    entryBreakdownRef,
    setShowPointsSystem,
    isMobile,
    tournament,
    selectedTournamentStatus,
    currentRoundLabel,
    openPlayerPopup,
    standings,
    activeStandingEntry,
    activeStandingGolfers,
    pool,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(activeStandingEntry)) return null;
  return (
    <div
            onClick={() => {
              setShowPointsSystem(false);
              setActiveStandingGolferId(null);
              setActiveStandingEntryId(null);
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
              zIndex: 50,
            }}
          >
            <div
              ref={entryBreakdownRef}
              onClick={(event) => event.stopPropagation()}
              className="breakdown-modal entry-breakdown-modal"
              style={{
                width: 'min(520px, calc(100vw - 32px))',
                maxHeight: 'calc(100vh - 32px - var(--safe-y))',
                background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa',
                borderRadius: 20,
                boxShadow: '0 24px 60px rgba(9,34,51,0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: isMobile ? 18 : 21, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{activeStandingEntry.name}</div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pool?.id === FOUNDER_POOL_ID ? <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ ...(isMobile ? {} : { transform: 'scale(1.3)', transformOrigin: 'right center' }), height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} /> : <GmpBadge height={46} style={{ margin: "-6px 0" }} />}
                      </div>
                    )}
                    <button
                      onClick={() => { setShowPointsSystem(false); setActiveStandingGolferId(null); setActiveStandingEntryId(null); }}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })()}
              <div style={{ padding: isMobile ? '14px 14px 16px' : '16px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {activeStandingEntry.golfers.length > 0 ? (
                  activeStandingGolfers.map((golfer, index) => {
                    const isActiveGolfer = activeStandingGolferId === golfer.id;

                    return (
                    <button
                      key={golfer.id}
                      onClick={() => setActiveStandingGolferId(golfer.id)}
                      style={{
                        width: '100%',
                        border: selectedTournament === 'open' ? '1px solid #000000' : '1px solid #e2e8ef',
                        borderRadius: 12,
                        padding: 0,
                        background: selectedTournament === 'open' ? (isActiveGolfer ? '#e8a830' : '#F4BC41') : isActiveGolfer ? '#eef4ff' : '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        overflow: 'hidden',
                        minHeight: isMobile ? 85 : 100,
                        boxShadow: '0 2px 6px rgba(9,34,51,0.05)',
                      }}
                    >
                      {isMobile ? (
                        <>
                          <div onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }); }} style={{ width: 86, flexShrink: 0, alignSelf: 'stretch', position: 'relative', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', cursor: 'pointer' }}>
                            <img
                              src={playerPhotoSrc(golfer.name, golfer.pgaTourId, golfer.photoUrl)} data-fb={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)} onError={photoOnError}
                              alt={golfer.name}
                              className="breakdown-golfer-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(selectedTournament === 'open' ? { mixBlendMode: 'normal' as const } : {}) }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', background: selectedTournament === 'open' ? '#F4BC41' : 'transparent' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="breakdown-golfer-name" style={{ fontSize: 16, fontWeight: 800, color: selectedTournament === 'open' ? '#1a1a1a' : '#0f1720' }}>
                                <span>{golfer.name}</span>
                              </div>
                              <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span>Salary: ${golfer.salary.toLocaleString()}</span>
                                {!(golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ') && <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>}
                              </div>
                              {golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ' ? (
                                <>
                                  <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: isMobile ? 12 : 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <span>Total: {golfer.originalScore ?? '--'}</span>
                                    <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>
                                  </div>
                                  <button
                                    className="breakdown-golfer-subtext"
                                    onClick={(e) => { e.stopPropagation(); setCutScorecardGolfer({ name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl }); setCutScorecardData(null); setCutScorecardLoading(true); fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=2`).then(r => r.json()).then(setCutScorecardData).catch(() => setCutScorecardData(null)).finally(() => setCutScorecardLoading(false)); }}
                                    style={{ background: '#cc2944', border: '1.5px solid #7b1a13', borderRadius: 999, padding: isMobile ? '3.5px 8.5px' : '1px 6px', cursor: 'pointer', marginTop: 2, fontSize: isMobile ? 9 : 8, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', boxShadow: '0 2px 8px rgba(150,30,30,0.45)', textTransform: 'uppercase' }}
                                  >{golfer.score === 'WD' ? 'WITHDREW' : golfer.score === 'DQ' ? 'DISQUALIFIED' : golfer.score === 'MDF' ? 'MDF' : 'MISSED CUT'}</button>
                                </>
                              ) : (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>Total: {golfer.holesRemaining === 72 ? '—' : golfer.score}</span>
                                  <span>Position: {golfer.holesRemaining === 72 ? '—' : formatPosition(golfer.position)}</span>
                                </div>
                              )}
                              {golfer.score !== 'CUT' && golfer.score !== 'MDF' && golfer.score !== 'WD' && golfer.score !== 'DQ' && (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setScorecardGolferName(golfer.name);
                                      setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                      setScorecardGolferTeeTime(golfer.teeTime);
                                      setScorecardGolferThru(golfer.thru);
                                      setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                      setScorecardData(null);
                                      setScorecardLoading(true);
                                      fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=${currentRoundLabel.replace('Round ', '')}`)
                                        .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'open' ? '#1a1a1a' : '#173b63', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none', verticalAlign: 'middle' }}
                                  >
                                    <span style={{ fontWeight: 900, fontSize: isMobile ? 11 : 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#c8860a' }}>{currentRoundLabel}:</span>{' '}<span style={{ color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontWeight: 400 }}>{golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime ? formatTeeTime(golfer.teeTime) : formatCurrentRoundScore(golfer.currentRoundScore ?? undefined, golfer.score)}</span>
                                  </button>
                                  {!(golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime) && <span>Thru: {golfer.thru}{golfer.backNineStart && golfer.thru !== '--' && golfer.thru !== 'F' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: 40, flexShrink: 0 }}>
                              <div className="breakdown-golfer-points" style={{ fontSize: 22, fontWeight: 900, color: golfer.points < 0 ? '#dc2626' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'players' ? '#c8860a' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#173b63' }}>{formatPointValue(golfer.points)}</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }); }} style={{ width: 76, flexShrink: 0, alignSelf: 'stretch', position: 'relative', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', cursor: 'pointer' }}>
                            <img
                              src={playerPhotoSrc(golfer.name, golfer.pgaTourId, golfer.photoUrl)} data-fb={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)} onError={photoOnError}
                              alt={golfer.name}
                              className="breakdown-golfer-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(selectedTournament === 'open' ? { mixBlendMode: 'normal' as const } : {}) }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', background: selectedTournament === 'open' ? '#F4BC41' : 'transparent' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="breakdown-golfer-name" style={{ fontSize: 14, fontWeight: 800, color: selectedTournament === 'open' ? '#1a1a1a' : '#0f1720' }}>
                                <span>{golfer.name}</span>
                              </div>
                              <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span>Salary: ${golfer.salary.toLocaleString()}</span>
                                {!(golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ') && <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>}
                              </div>
                              {golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ' ? (
                                <>
                                  <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: isMobile ? 12 : 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <span>Total: {golfer.originalScore ?? '--'}</span>
                                    <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>
                                  </div>
                                  <button
                                    className="breakdown-golfer-subtext"
                                    onClick={(e) => { e.stopPropagation(); setCutScorecardGolfer({ name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl }); setCutScorecardData(null); setCutScorecardLoading(true); fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=2`).then(r => r.json()).then(setCutScorecardData).catch(() => setCutScorecardData(null)).finally(() => setCutScorecardLoading(false)); }}
                                    style={{ background: '#cc2944', border: '1.5px solid #7b1a13', borderRadius: 999, padding: isMobile ? '3.5px 8.5px' : '1px 6px', cursor: 'pointer', marginTop: 2, fontSize: isMobile ? 9 : 8, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', boxShadow: '0 2px 8px rgba(150,30,30,0.45)', textTransform: 'uppercase' }}
                                  >{golfer.score === 'WD' ? 'WITHDREW' : golfer.score === 'DQ' ? 'DISQUALIFIED' : golfer.score === 'MDF' ? 'MDF' : 'MISSED CUT'}</button>
                                </>
                              ) : (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>Total: {golfer.holesRemaining === 72 ? '—' : golfer.score}</span>
                                  <span>Position: {golfer.holesRemaining === 72 ? '—' : formatPosition(golfer.position)}</span>
                                </div>
                              )}
                              {golfer.score !== 'CUT' && golfer.score !== 'MDF' && golfer.score !== 'WD' && golfer.score !== 'DQ' && (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setScorecardGolferName(golfer.name);
                                      setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                      setScorecardGolferTeeTime(golfer.teeTime);
                                      setScorecardGolferThru(golfer.thru);
                                      setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                      setScorecardData(null);
                                      setScorecardLoading(true);
                                      fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=${currentRoundLabel.replace('Round ', '')}`)
                                        .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'open' ? '#1a1a1a' : '#173b63', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none', verticalAlign: 'middle' }}
                                  >
                                    <span style={{ fontWeight: 900, fontSize: isMobile ? 11 : 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#c8860a' }}>{currentRoundLabel}:</span>{' '}<span style={{ color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontWeight: 400 }}>{golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime ? formatTeeTime(golfer.teeTime) : formatCurrentRoundScore(golfer.currentRoundScore ?? undefined, golfer.score)}</span>
                                  </button>
                                  {!(golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime) && <span>Thru: {golfer.thru}{golfer.backNineStart && golfer.thru !== '--' && golfer.thru !== 'F' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: 40, flexShrink: 0 }}>
                              <div className="breakdown-golfer-points" style={{ fontSize: 18, fontWeight: 900, color: golfer.points < 0 ? '#dc2626' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'players' ? '#c8860a' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#173b63' }}>{formatPointValue(golfer.points)}</div>
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  )})
                ) : (
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid #e2e8ef',
                      background: '#fff',
                      padding: 18,
                      color: '#50616f',
                      boxShadow: '0 2px 6px rgba(9,34,51,0.05)',
                    }}
                  >
                    No lineup has been saved for this team yet.
                  </div>
                )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 12, border: selectedTournament === 'open' ? '1px solid #000000' : '1px solid #e2e8ef', padding: isMobile ? '12px 14px' : '12px 16px', boxShadow: '0 2px 6px rgba(9,34,51,0.05)' }}>
                <div style={{ color: selectedTournament === 'masters' ? '#2e7d32' : '#173b63', fontSize: 14, fontWeight: 600 }}>
                  Total Holes Rem: <strong style={{ color: '#000' }}>{activeStandingEntry.holesRemaining}</strong>
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#0f1720' }}>
                  <span style={{ color: selectedTournament === 'masters' ? '#2e7d32' : '#173b63' }}>Total:</span> <span style={{ color: '#000' }}>{formatPointValue(activeStandingEntry.rosterPoints)}</span>
                </div>
              </div>
              <div style={{ paddingTop: 4 }}>
                <PoweredBy size={0.8} />
              </div>
            </div>
          </div>
        </div>
  );
}
