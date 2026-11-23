'use client';

import { latestStartedSeason, picksSeason } from '@/app/lib/tournament-config';
import { ArrowLeft, CircleUserRound, CheckCircle2, History, MoreVertical, Pencil, Search } from 'lucide-react';
import { SALARY_CAP, REQUIRED_GOLFERS, totalParFor, TOURNAMENTS, TOURNAMENT_PICKS_HEADER, PICKS_HEADER_LOGO_H, TOURNAMENT_ENTRIES_INTRO, TOURNAMENT_TAB_LOGOS, TOURNAMENT_EVENT_LOGOS, eventLogoStyle, PICK_HISTORY_NAMES, pgaPhoto, playerPhotoSrc, photoOnError, MOBILE_TWO_LINE_NAMES, MOBILE_CUSTOM_SPLITS, rosterInSeason, fieldStyle, FOUNDER_POOL_ID } from '../pool-data';
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { EntryFeeStatus } from '../entry-fee-status';
import { ShareImageModal } from '../share-image';
import type { PoolPage } from '../pool-page-state';
import { TournamentWordmark, wordmarkSize } from '../tournament-wordmark';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function MyEntryScreen({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    selectedRoster,
    historyRoster,
    saveMessage,
    sessionUser,
    entriesPlayerSearch,
    setEntriesPlayerSearch,
    tieBreakInput,
    setTieBreakInput,
    setShowRosterConfirm,
    accountDisplayName,
    setAccountDisplayName,
    accountBusy,
    myEntriesEditorOpen,
    myEntriesMenuOpen,
    setMyEntriesMenuOpen,
    myEntriesDetailView,
    setMyEntriesDetailView,
    isMobile,
    isLandscapePhone,
    entriesTournamentId,
    entriesTournament,
    entriesPreFieldView,
    entriesLocked,
    entriesTournamentCourseName,
    entriesTournamentPar,
    handleUpdateOwnDisplayName,
    salaryListMissing,
    players,
    playersById,
    filteredEntriesPlayers,
    hasSubmittedRoster,
    orderedRosterPlayers,
    savedRosterPlayers,
    salaryRemaining,
    averageRemainingPerPlayer,
    userLabel,
    openPlayerPopup,
    canSave,
    togglePlayer,
    openMyEntriesEditor,
    closeMyEntriesEditor,
    headerSolid,
    entriesTournamentBg,
    entriesTournamentSolid,
    entriesTournamentDisplayName,
    entriesWarningPalette,
    salaryColor,
    showMyPaymentStatus,
    myPaymentStatus,
    entryFee,
    paysEntryFeeInApp,
    openEntryFeePayment,
    reportMyPayment,
    pool,
  } = p;
  const [sharing, setSharing] = useState(false);
  const myTieBreak = sessionUser?.tieBreaks?.[entriesTournamentId];
  const rosterSalary = savedRosterPlayers.reduce((sum, player) => sum + (player.salary ?? 0), 0);
  return (
    <main style={{ marginTop: isMobile ? 14 : 24, display: 'grid', gap: isMobile ? 12 : 20 }}>
            {!sessionUser ? (
              <div
                style={{
                  borderRadius: 18,
                  background: '#fff8e7',
                  color: '#9a6700',
                  border: '1px solid #f0d28a',
                  padding: isMobile ? '12px 14px' : '16px 18px',
                  fontSize: isMobile ? 13 : 15,
                }}
              >
                This tab is ready for saved entries, but you need to sign in first so the lineup belongs to your account.
              </div>
            ) : sessionUser && !myEntriesEditorOpen ? (
              <section
                style={{
                  background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                  borderRadius: 20,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 26, color: '#0f1720' }}>Manage Entry</h2>
                <div style={{ marginTop: isMobile ? 6 : 18, color: '#0f1720', fontSize: isMobile ? 11 : 15, lineHeight: 1.45 }}>
                  {TOURNAMENT_ENTRIES_INTRO[entriesTournamentId] ?? `Make or edit your picks for ${entriesTournament.name} below.`} You can submit or modify your picks up until the first tee time of Round 1.
                </div>

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: isMobile ? 10 : 18,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      background: '#eef4ff',
                      color: '#2f5f96',
                      padding: isMobile ? '8px 10px' : '12px 14px',
                      fontSize: isMobile ? 12 : 14,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>{saveMessage}</span>
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: isMobile ? 17 : 31,
                    display: 'grid',
                    gridTemplateColumns: (isMobile && hasSubmittedRoster)
                      ? '1fr auto'
                      : isMobile
                        ? 'auto 1fr auto'
                        : 'minmax(220px, 1fr) minmax(320px, 420px) minmax(220px, 1fr)',
                    gap: isMobile ? '6px 8px' : 20,
                    alignItems: 'center',
                  }}
                >
                  {!(isMobile && hasSubmittedRoster) && (
                    <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720' }}>Entry</div>
                  )}
                  <div
                    style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'center', justifySelf: 'center' }}
                  >
                    {TOURNAMENT_TAB_LOGOS[entriesTournamentId] ? (
                      (() => {
                        // Tournament logo in place of the "<Tournament> Picks" text; negative margins
                        // keep the row at the text line's height so the box never grows.
                        const lh = isMobile ? 12 : 17;
                        const hgt = (PICKS_HEADER_LOGO_H[entriesTournamentId] ?? [26, 32])[isMobile ? 0 : 1];
                        return <TournamentWordmark id={entriesTournamentId} alt={TOURNAMENT_PICKS_HEADER[entriesTournamentId] ?? `${entriesTournament.name} Picks`} width={isMobile ? 96 : 120} height={hgt} style={{ margin: `${-(Math.max(lh, wordmarkSize(entriesTournamentId, isMobile ? 96 : 120, hgt).height) - lh) / 2}px auto` }} />;
                      })()
                    ) : (
                      TOURNAMENT_PICKS_HEADER[entriesTournamentId] ?? `${entriesTournament.name} Picks`
                    )}
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'right' }}>Options</div>

                  {!(isMobile && hasSubmittedRoster) && (
                    <div style={{ fontSize: isMobile ? 12 : 18, color: '#0f1720', fontWeight: isMobile ? 600 : 400 }}>{userLabel}</div>
                  )}
                  <div style={{ display: 'grid', justifyItems: (isMobile && hasSubmittedRoster) ? 'stretch' : 'center' }}>
                    {hasSubmittedRoster ? (
                      // Small top margin keeps the (oversized, negative-margin) header logo from touching the box.
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', marginTop: isMobile ? 5 : 7 }}>
                        <div
                          style={{
                            borderRadius: 12,
                            // For The Open the box blends with the section's yellow (bubbles keep their colors).
                            border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #dce6ee',
                            background: entriesTournamentId === 'open' ? '#F4BC41' : '#f8fbfd',
                            padding: isMobile ? '8px 10px' : '12px 14px',
                            display: 'grid',
                            gap: isMobile ? 6 : 10,
                            width: '100%',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? 6 : 10 }}>
                            {savedRosterPlayers.map((player) => {
                              const entryBubblePalette: Record<string, { bg: string; text: string }> = {
                                players:  { bg: '#dce6f5', text: '#173b63' },
                                masters:  { bg: '#d5eade', text: '#2c6449' },
                                'us-open':{ bg: '#fde8e8', text: '#BE3436' },
                                pga:      { bg: '#f5edd8', text: '#7a6a3e' },
                                open:     { bg: '#dce6f5', text: '#173b63' },
                              };
                              const { bg: entryBg, text: entryText } = entryBubblePalette[entriesTournamentId] ?? { bg: '#e8f3ff', text: '#2f5f96' };
                              return (
                              <span
                                key={player.id}
                                onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank })}
                                style={{
                                  borderRadius: 999,
                                  background: entryBg,
                                  color: entryText,
                                  padding: isMobile ? '4px 14px 4px 4px' : '6px 18px 6px 6px',
                                  fontSize: isMobile ? 15 : 17,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: isMobile ? 8 : 10,
                                  cursor: 'pointer',
                                }}
                              >
                                <img
                                  src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                                  alt={player.name}
                                  style={{
                                    width: isMobile ? 40 : 44,
                                    height: isMobile ? 40 : 44,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    background: '#fff',
                                    flexShrink: 0,
                                  }}
                                />
                                {player.name.split(' ').slice(-1)[0]}
                              </span>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={entriesLocked ? undefined : openMyEntriesEditor}
                          disabled={entriesLocked}
                          style={{
                            border: 'none',
                            borderRadius: 16,
                            padding: isMobile ? '10px 16px' : '11px 18px',
                            background: entriesLocked ? '#b0bec5' : entriesTournamentSolid,
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 900,
                            cursor: entriesLocked ? 'not-allowed' : 'pointer',
                            boxShadow: entriesLocked ? 'none' : '0 14px 28px rgba(9, 34, 51, 0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            whiteSpace: 'nowrap',
                            opacity: entriesLocked ? 0.7 : 1,
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 14} />
                          Edit Picks
                        </button>
                        <button
                          type="button"
                          onClick={() => setSharing(true)}
                          style={{ border: '1px solid #cdd9e5', borderRadius: 12, padding: '8px 14px', background: '#fff', color: '#173b63', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Share2 size={14} /> Share my roster
                        </button>
                        {sharing ? (
                          <ShareImageModal
                            fileName="my-golf-majors-pool-roster.png"
                            onClose={() => setSharing(false)}
                            input={{
                              kicker: `${entriesTournament.fullName} picks`,
                              title: userLabel,
                              subtitle: pool?.name,
                              rows: savedRosterPlayers.map((player, i) => ({
                                left: String(i + 1),
                                label: player.name,
                                sub: player.worldRank ? `World #${player.worldRank}` : undefined,
                                right: `$${(player.salary ?? 0).toLocaleString()}`,
                              })),
                              footer: `Salary $${rosterSalary.toLocaleString()} of $${SALARY_CAP.toLocaleString()}${myTieBreak ? ` · Tiebreaker ${myTieBreak}` : ''}`,
                            }}
                          />
                        ) : null}
                        {showMyPaymentStatus ? (
                          <EntryFeeStatus
                            fee={entryFee}
                            status={myPaymentStatus}
                            canPayInApp={paysEntryFeeInApp}
                            paymentNote={pool?.paymentNote ?? null}
                            onPay={openEntryFeePayment}
                            onReport={reportMyPayment}
                            compact={isMobile}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <button
                        onClick={entriesLocked ? undefined : openMyEntriesEditor}
                        disabled={entriesLocked}
                        style={{
                          border: 'none',
                          borderRadius: 12,
                          padding: isMobile ? '6px 10px' : '11px 18px',
                          background: entriesLocked ? '#b0bec5' : entriesTournamentSolid,
                          color: '#fff',
                          fontSize: isMobile ? 12 : 14,
                          fontWeight: 900,
                          cursor: entriesLocked ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                          opacity: entriesLocked ? 0.7 : 1,
                        }}
                      >
                        <Pencil size={12} />
                        Make Picks
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', position: 'relative' }}>
                    {myEntriesMenuOpen ? (
                      <button
                        type="button"
                        aria-label="Close entry options"
                        onClick={() => setMyEntriesMenuOpen(false)}
                        style={{
                          position: 'fixed',
                          inset: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'default',
                          padding: 0,
                          margin: 0,
                          zIndex: 5,
                        }}
                      />
                    ) : null}
                    <button
                      onClick={() => setMyEntriesMenuOpen((current) => !current)}
                      style={{
                        border: entriesTournamentId === 'open' ? `1px solid ${entriesTournamentSolid}` : '1px solid #d7e0e8',
                        borderRadius: 10,
                        width: isMobile ? 34 : 48,
                        height: isMobile ? 34 : 48,
                        background: entriesTournamentId === 'open' ? entriesTournamentSolid : '#fff',
                        color: entriesTournamentId === 'open' ? '#fff' : '#0f1720',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreVertical size={isMobile ? 14 : 18} />
                    </button>
                    {myEntriesMenuOpen ? (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: isMobile ? 34 : 48,
                          right: 0,
                          width: 240,
                          borderRadius: 16,
                          border: '1px solid #d7e0e8',
                          background: '#fff',
                          boxShadow: '0 18px 40px rgba(9, 34, 51, 0.14)',
                          padding: 8,
                          display: 'grid',
                          gap: 4,
                          zIndex: 10,
                        }}
                      >
                        <button
                          onClick={entriesLocked ? undefined : () => {
                            setMyEntriesMenuOpen(false);
                            openMyEntriesEditor();
                          }}
                          disabled={entriesLocked}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: entriesLocked ? '#9ba8b4' : '#0f1720',
                            fontSize: 15,
                            cursor: entriesLocked ? 'not-allowed' : 'pointer',
                            opacity: entriesLocked ? 0.6 : 1,
                          }}
                        >
                          <Pencil size={15} />
                          <span>{hasSubmittedRoster ? 'Edit Picks' : 'Make Picks'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setMyEntriesMenuOpen(false);
                            setMyEntriesDetailView('history');
                          }}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: '#0f1720',
                            fontSize: 15,
                            cursor: 'pointer',
                          }}
                        >
                          <History size={15} />
                          <span>View Pick History</span>
                        </button>
                        <button
                          onClick={() => {
                            setMyEntriesMenuOpen(false);
                            setAccountDisplayName(sessionUser.displayName);
                            setMyEntriesDetailView('rename');
                          }}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: '#0f1720',
                            fontSize: 15,
                            cursor: 'pointer',
                          }}
                        >
                          <CircleUserRound size={15} />
                          <span>Rename Entry</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {myEntriesDetailView === 'history' ? (
                  <div
                    style={{
                      marginTop: 20,
                      borderRadius: 18,
                      // For The Open the box blends with the section's yellow; the ✕ goes navy like Save Entry Name.
                      border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                      background: entriesTournamentId === 'open' ? '#F4BC41' : '#f8fbfd',
                      padding: 18,
                      display: 'grid',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1720' }}>Pick History</div>
                      <button
                        onClick={() => setMyEntriesDetailView('none')}
                        style={{ background: entriesTournamentId === 'open' ? headerSolid : 'rgba(0,0,0,0.06)', border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 10, cursor: 'pointer', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                      >✕</button>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {TOURNAMENTS.map((event) => {
                        // This season's picks once made; until then, the picks from the last time it was played.
                        const historyRoster = sessionUser.rosters[event.id]?.length
                          ? sessionUser.rosters[event.id]
                          : rosterInSeason(sessionUser, event.id, latestStartedSeason(event.id) ?? picksSeason(event.id));
                        const historyPlayers = (historyRoster ?? []).map((id) => playersById[id]).filter(Boolean);
                        return (
                          <div
                            key={`history-${event.id}`}
                            style={{
                              borderRadius: 16,
                              border: '1px solid #dce6ee',
                              background: '#fff',
                              padding: 14,
                              display: 'grid',
                              gap: 10,
                            }}
                          >
                            {/* Header text with the tournament's wordmark just after it; the row is locked at 22px. */}
                            {(() => {
                              return (
                                <div style={{ height: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{PICK_HISTORY_NAMES[event.id] ?? event.name}</div>
                                </div>
                              );
                            })()}
                            {historyPlayers.length > 0 ? (
                              // Mobile: 3-per-row grid (a 6-man roster is exactly two rows). Desktop: pills flow
                              // side by side and wrap naturally, so there's no dead space between grid columns.
                              <div style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 } : { display: 'flex', flexWrap: 'wrap', gap: '10px 12px' }}>
                                {historyPlayers.map((player) => {
                                  const bubblePalette: Record<string, { bg: string; text: string }> = {
                                    players:  { bg: '#dce6f5', text: '#173b63' },
                                    masters:  { bg: '#d5eade', text: '#2c6449' },
                                    'us-open':{ bg: '#fde8e8', text: '#BE3436' },
                                    pga:      { bg: '#f5edd8', text: '#7a6a3e' },
                                    open:     { bg: '#dce6f5', text: '#173b63' },
                                  };
                                  const { bg, text } = bubblePalette[event.id] ?? { bg: '#e8f3ff', text: '#2f5f96' };
                                  const displayName = isMobile ? (player.name.split(' ').pop() ?? player.name) : player.name;
                                  return (
                                    <span
                                      key={`history-player-${event.id}-${player.id}`}
                                      onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'stats', event.id)}
                                      style={{
                                        borderRadius: 999,
                                        background: bg,
                                        color: text,
                                        padding: isMobile ? '4px 8px 4px 4px' : '6px 18px 6px 6px',
                                        fontSize: isMobile ? 12 : 14,
                                        fontWeight: 800,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: isMobile ? 6 : 8,
                                        cursor: 'pointer',
                                        minWidth: 0,
                                      }}
                                    >
                                      <img
                                        src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                                        alt={player.name}
                                        style={{ width: isMobile ? 22 : 30, height: isMobile ? 22 : 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#fff' }}
                                      />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ color: '#6b7b88', fontSize: 14 }}>No submitted roster saved for this event yet.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {myEntriesDetailView === 'rename' ? (
                  <div
                    style={{
                      marginTop: 20,
                      borderRadius: 18,
                      // For The Open the box blends with the section's yellow; the ✕ goes navy like Save Entry Name.
                      border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                      background: entriesTournamentId === 'open' ? '#F4BC41' : '#f8fbfd',
                      padding: 18,
                      display: 'grid',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1720' }}>Rename Entry</div>
                      <button
                        onClick={() => setMyEntriesDetailView('none')}
                        style={{ background: entriesTournamentId === 'open' ? headerSolid : 'rgba(0,0,0,0.06)', border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 10, cursor: 'pointer', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                      >✕</button>
                    </div>
                    <input
                      value={accountDisplayName}
                      onChange={(event) => setAccountDisplayName(event.target.value)}
                      placeholder="Display name"
                      style={{ ...fieldStyle(), maxWidth: 420 }}
                    />
                    <div>
                      <button
                        onClick={handleUpdateOwnDisplayName}
                        disabled={accountBusy}
                        style={{
                          border: 'none',
                          borderRadius: 14,
                          padding: '12px 18px',
                          background: headerSolid,
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Entry Name
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : sessionUser && entriesPreFieldView ? (
              <section
                style={{
                  background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                  borderRadius: 24,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                    <button
                      onClick={closeMyEntriesEditor}
                      aria-label="Back"
                      style={{ border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 999, background: entriesTournamentId === 'open' ? headerSolid : '#fff', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <ArrowLeft size={isMobile ? 14 : 20} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 26, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.55fr) minmax(320px, 0.85fr)',
                    gap: 28,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 20 }}>
                    <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: 20, overflow: 'hidden', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                      <div
                        style={{
                          padding: isMobile ? 12 : isLandscapePhone ? '12px 22px 22px' : 22,
                          position: 'relative',
                          background: entriesTournamentId === 'open' ? '#F4BC41' : '#f7f9fb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: isMobile || isLandscapePhone ? 'flex-start' : 'center',
                          flexWrap: 'wrap',
                          borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #d7e0e8',
                        }}
                      >
                        <div style={{ flexBasis: isLandscapePhone ? '100%' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18 }}>
                            <div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>{entriesTournamentDisplayName}</div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>Tournament Field</div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginTop: 8,
                              color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79',
                            }}
                          >
                            <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                            <span style={{ fontSize: isMobile ? 12 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                          </div>
                        </div>
                        {pool?.id === FOUNDER_POOL_ID && TOURNAMENT_EVENT_LOGOS[entriesTournamentId] && (
                          <img src={TOURNAMENT_EVENT_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={eventLogoStyle(entriesTournamentId, isMobile, isLandscapePhone)} />
                        )}
                        <label
                          style={{
                            minWidth: isMobile ? 140 : 280,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #d7e0e8',
                            borderRadius: 14,
                            background: '#fff',
                            padding: '0 14px',
                          }}
                        >
                          <Search size={18} color="#6b7b88" />
                          <input
                            value={entriesPlayerSearch}
                            onChange={(event) => setEntriesPlayerSearch(event.target.value)}
                            placeholder="Search"
                            style={{
                              border: 'none',
                              outline: 'none',
                              width: '100%',
                              padding: isMobile ? '10px 0' : '12px 0',
                              fontSize: isMobile ? 16 : 15,
                              background: 'transparent',
                              color: '#0f1720',
                            }}
                          />
                          {entriesPlayerSearch && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEntriesPlayerSearch(''); }}
                              style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                              aria-label="Clear search"
                            >
                              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                            </button>
                          )}
                        </label>
                      </div>

                      <div style={{ maxHeight: isMobile ? 540 : 722, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px', padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #e6edf1', position: 'sticky', top: 0, background: entriesTournamentId === 'open' ? headerSolid : '#f7f9fb', zIndex: 1 }}>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', textAlign: 'center' }}>OWGR</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>Player</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720' }}>Salary</div>
                          <div></div>
                        </div>
                        <div style={{ padding: isMobile ? '20px 16px' : '32px 24px' }}>
                          <div style={{ background: entriesWarningPalette.bg, borderRadius: 14, padding: isMobile ? '16px 16px' : '22px 24px', textAlign: 'left', color: entriesWarningPalette.text, fontSize: isMobile ? 13.5 : 15, fontWeight: 700, lineHeight: 1.6 }}>
                            *Picks cannot be entered until the tournament field has been finalized and world golf rankings/player odds have been updated for the week (usually by late Monday morning, the week of the tournament).
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside style={{ display: 'grid', gap: 18 }}>
                    <div
                      style={{
                        borderRadius: 16,
                        border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #dce6ee',
                        padding: '22px 26px',
                        background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 28 : 44, lineHeight: 1, fontWeight: 900, color: '#198754' }}>
                        ${SALARY_CAP.toLocaleString()}
                      </div>
                      <div style={{ marginTop: 12, color: '#0f1720', fontSize: isMobile ? 12 : 15 }}>
                        Avg Rem./Player: ${Math.round(SALARY_CAP / REQUIRED_GOLFERS).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    <div style={{ display: 'grid', gap: isMobile ? 16 : 14 }}>
                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => (
                        <div
                          key={`placeholder-slot-${index + 1}`}
                          style={{
                            borderRadius: 14,
                            border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                            background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                            padding: isMobile ? '16px 16px' : '16px 18px',
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 17 : 18, color: entriesTournamentId === 'open' ? '#000000' : '#556572' }}>Golfer #{index + 1}</div>
                        </div>
                      ))}
                    </div>

                    <input
                      value={tieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setTieBreakInput(val);
                      }}
                      placeholder={`Enter tiebreak value* (Par = ${totalParFor(selectedTournament) ?? '?'})`}
                      inputMode="numeric"
                      maxLength={3}
                      style={{
                        ...fieldStyle(),
                      }}
                    />
                    <button
                      disabled
                      style={{
                        width: 170,
                        border: 'none',
                        borderRadius: 14,
                        padding: '14px 18px',
                        background: '#dfe5eb',
                        color: '#566675',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: 'not-allowed',
                      }}
                    >
                      Submit Roster
                    </button>
                    <div style={{ color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79', fontSize: 13, lineHeight: 1.65 }}>
                      * - The tiebreak value is your predicted total score for the winning golfer of this tournament.
                      Use their total strokes, NOT score to par. Example: Enter {(totalParFor(entriesTournamentId) ?? 288) - 14} (NOT -14)
                    </div>
                  </aside>
                </div>
              </section>
            ) : sessionUser ? (
              <section
                style={{
                  background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                  borderRadius: 24,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                    <button
                      onClick={closeMyEntriesEditor}
                      aria-label="Back"
                      style={{ border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 999, background: entriesTournamentId === 'open' ? headerSolid : '#fff', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <ArrowLeft size={isMobile ? 14 : 20} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 26, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.45fr) minmax(320px, 0.8fr)',
                    gap: 22,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: 20, overflow: 'hidden', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                      <div
                        style={{
                          padding: isMobile ? 12 : isLandscapePhone ? '12px 22px 22px' : 22,
                          position: 'relative',
                          background: entriesTournamentId === 'open' ? '#F4BC41' : '#f7f9fb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: isMobile || isLandscapePhone ? 'flex-start' : 'center',
                          flexWrap: 'wrap',
                          borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #d7e0e8',
                        }}
                      >
                        <div style={{ flexBasis: isLandscapePhone ? '100%' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18 }}>
                            <div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>{entriesTournamentDisplayName}</div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>Tournament Field</div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginTop: 8,
                              color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79',
                            }}
                          >
                            <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                            <span style={{ fontSize: isMobile ? 12 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                          </div>
                        </div>
                        {pool?.id === FOUNDER_POOL_ID && TOURNAMENT_EVENT_LOGOS[entriesTournamentId] && (
                          <img src={TOURNAMENT_EVENT_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={eventLogoStyle(entriesTournamentId, isMobile, isLandscapePhone)} />
                        )}
                        <label
                          style={{
                            minWidth: isMobile ? 140 : 280,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #d7e0e8',
                            borderRadius: 14,
                            background: '#fff',
                            padding: '0 14px',
                          }}
                        >
                          <Search size={18} color="#6b7b88" />
                          <input
                            value={entriesPlayerSearch}
                            onChange={(event) => setEntriesPlayerSearch(event.target.value)}
                            placeholder="Search"
                            style={{
                              border: 'none',
                              outline: 'none',
                              width: '100%',
                              padding: isMobile ? '10px 0' : '12px 0',
                              fontSize: isMobile ? 16 : 15,
                              background: 'transparent',
                              color: '#0f1720',
                            }}
                          />
                          {entriesPlayerSearch && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEntriesPlayerSearch(''); }}
                              style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                              aria-label="Clear search"
                            >
                              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                            </button>
                          )}
                        </label>
                      </div>

                      <div style={{ maxHeight: isMobile ? 540 : 722, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px', padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #e6edf1', position: 'sticky', top: 0, background: entriesTournamentId === 'open' ? headerSolid : '#f7f9fb', zIndex: 1 }}>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', textAlign: 'center' }}>OWGR</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>Player</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720' }}>Salary</div>
                          <div></div>
                        </div>
                        {salaryListMissing && (
                          <div style={{ padding: isMobile ? '20px 16px' : '32px 24px' }}>
                            <div style={{ background: entriesWarningPalette.bg, borderRadius: 14, padding: isMobile ? '16px 16px' : '22px 24px', textAlign: 'left', color: entriesWarningPalette.text, fontSize: isMobile ? 13.5 : 15, fontWeight: 700, lineHeight: 1.6 }}>
                              *Picks cannot be entered until the tournament field has been finalized and world golf rankings/player odds have been updated for the week (usually by late Monday morning, the week of the tournament).
                            </div>
                          </div>
                        )}
                        {filteredEntriesPlayers.map((player) => {
                          const disabled = entriesLocked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining;

                          return (
                            <div
                              key={player.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px',
                                padding: isMobile ? '11px 12px' : '15px 20px',
                                borderBottom: entriesTournamentId === 'open' ? '1px solid rgba(0,0,0,0.12)' : '1px solid #e6edf1',
                                alignItems: 'center',
                                opacity: disabled ? 0.45 : 1,
                                background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                              }}
                            >
                              <div style={{ fontSize: isMobile ? 13 : 17, color: '#0f1720', textAlign: 'center' }}>{player.worldRank}</div>
                              <div onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season')} style={{ fontSize: isMobile ? 13 : 17, fontWeight: 600, color: '#0f1720', paddingLeft: isMobile ? 8 : 12, cursor: 'pointer' }}>
                                {(() => { const customSplit = isMobile ? MOBILE_CUSTOM_SPLITS[player.name] : undefined; const parts = player.name.split(' '); const first = customSplit ? customSplit[0] : parts.slice(0, -1).join(' '); const last = customSplit ? customSplit[1] : parts[parts.length - 1]; const forcedBreak = isMobile && MOBILE_TWO_LINE_NAMES.has(player.name); const infoBtn = <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season'); }} style={{ width: isMobile ? 11 : 15, height: isMobile ? 11 : 15, borderRadius: '50%', border: `${isMobile ? 1 : 1.5}px solid ${entriesTournamentId === 'open' ? '#000000' : '#9ca3af'}`, background: 'transparent', color: entriesTournamentId === 'open' ? '#000000' : '#9ca3af', fontSize: isMobile ? 7 : 9, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, touchAction: 'manipulation', verticalAlign: 'middle', marginLeft: isMobile ? 3 : 5, flexShrink: 0 }} aria-label={`View ${player.name} stats`}>i</button>; return (<>{first}{forcedBreak ? <br /> : (first ? ' ' : '')}<span style={{ whiteSpace: 'nowrap' }}>{last}{infoBtn}</span></>); })()}
                              </div>
                              <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, color: '#0f1720' }}>${player.salary.toLocaleString()}</div>
                              <button
                                onClick={() => togglePlayer(player.id)}
                                disabled={disabled}
                                style={{
                                  width: isMobile ? 34 : 42,
                                  height: isMobile ? 34 : 42,
                                  borderRadius: 10,
                                  border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7dee6',
                                  background: entriesTournamentId === 'open' ? headerSolid : '#fff',
                                  color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                                  fontSize: isMobile ? 20 : 24,
                                  fontWeight: 400,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: isMobile ? 18 : 14, padding: isMobile ? 16 : '12px 18px', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                      <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                      <div style={{ marginTop: 2, fontSize: isMobile ? 30 : 34, fontWeight: 900, color: '#1f8d4e' }}>${salaryRemaining.toLocaleString()}</div>
                      <div style={{ marginTop: isMobile ? 8 : 4, fontSize: isMobile ? 12 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#31424f' }}>
                        Avg Rem./Player: ${averageRemainingPerPlayer.toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
                      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => {
                        const golfer = orderedRosterPlayers[index];
                        return (
                          <div
                            key={`entries-roster-slot-${index}`}
                            style={{
                              border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                              borderRadius: isMobile ? 14 : 14,
                              background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                              minHeight: isMobile ? 100 : undefined,
                              height: isMobile ? undefined : 96,
                              display: 'flex',
                              overflow: 'hidden',
                            }}
                          >
                              {golfer ? (
                                <>
                                  <div style={{ width: isMobile ? 90 : 88, flexShrink: 0, alignSelf: 'stretch', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', overflow: 'hidden', position: 'relative' }}>
                                    <img
                                      src={playerPhotoSrc(golfer.name, golfer.pgaTourId, golfer.photoUrl)} data-fb={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)} onError={photoOnError}
                                      alt={golfer.name}
                                      className="roster-card-photo"
                                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(entriesTournamentId === 'open' ? { mixBlendMode: 'normal' as const } : {}) }}
                                    />
                                  </div>
                                  <div style={{ flex: 1, padding: isMobile ? '8px 14px' : '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                      <div onClick={() => openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }, 'season')} style={{ fontSize: isMobile ? 18 : 19, fontWeight: 800, color: '#0f1720', cursor: 'pointer' }}>
                                        {(() => { const customSplit = isMobile ? MOBILE_CUSTOM_SPLITS[golfer.name] : undefined; const parts = golfer.name.split(' '); const first = customSplit ? customSplit[0] : parts.slice(0, -1).join(' '); const last = customSplit ? customSplit[1] : parts[parts.length - 1]; const forcedBreak = isMobile && MOBILE_TWO_LINE_NAMES.has(golfer.name); const infoBtn = <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }, 'season'); }} style={{ width: isMobile ? 17 : 17, height: isMobile ? 17 : 17, borderRadius: '50%', border: `${isMobile ? 1.5 : 1.5}px solid ${entriesTournamentId === 'open' ? '#000000' : '#9ca3af'}`, background: 'transparent', color: entriesTournamentId === 'open' ? '#000000' : '#9ca3af', fontSize: isMobile ? 11 : 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, touchAction: 'manipulation', verticalAlign: 'middle', marginLeft: isMobile ? 5 : 6, flexShrink: 0 }} aria-label={`View ${golfer.name} stats`}>i</button>; return (<>{first}{forcedBreak ? <br /> : (first ? ' ' : '')}<span style={{ whiteSpace: 'nowrap' }}>{last}{infoBtn}</span></>); })()}
                                      </div>
                                      <div style={{ marginTop: isMobile ? 3 : 2, fontSize: isMobile ? 15 : 15, color: entriesTournamentId === 'open' ? '#000000' : '#607282' }}>
                                        Salary: <span style={{ fontWeight: 800, color: salaryColor }}>${golfer.salary.toLocaleString()}</span>
                                      </div>
                                      <div style={{ marginTop: isMobile ? 2 : 1, fontSize: isMobile ? 14 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#607282' }}>
                                        World Rank: <span style={{ fontWeight: 700, color: '#0f1720' }}>{golfer.worldRank}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => togglePlayer(golfer.id)}
                                      style={{
                                        width: isMobile ? 34 : 30,
                                        height: isMobile ? 34 : 30,
                                        borderRadius: 8,
                                        border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7dee6',
                                        background: entriesTournamentId === 'open' ? '#dc2626' : '#fff',
                                        color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                                        fontSize: isMobile ? 20 : 18,
                                        fontWeight: 400,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      −
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ flex: 1, padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14 }}>
                                  <div style={{ width: isMobile ? 62 : 72, height: isMobile ? 62 : 72, borderRadius: 6, background: entriesTournamentId === 'open' ? '#e8a830' : '#e8eef4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <CircleUserRound size={isMobile ? 32 : 40} color={entriesTournamentId === 'open' ? '#000000' : '#a0b0be'} />
                                  </div>
                                  <div style={{ fontSize: isMobile ? 16 : 18, color: entriesTournamentId === 'open' ? '#000000' : '#50616f', fontWeight: 600 }}>Golfer #{index + 1}</div>
                                </div>
                              )}
                          </div>
                        );
                      })}

                      <input
                        value={tieBreakInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setTieBreakInput(val);
                        }}
                        placeholder={`Enter tiebreak value* (Par = ${totalParFor(selectedTournament) ?? '?'})`}
                        inputMode="numeric"
                        maxLength={3}
                        style={{ ...fieldStyle(), marginTop: 4 }}
                      />

                      {saveMessage ? (
                        <div
                          style={{
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
                          width: 'fit-content',
                          border: 'none',
                          borderRadius: 14,
                          padding: '12px 18px',
                          background: canSave ? entriesTournamentBg : '#cbd5df',
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: canSave ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        Submit Roster
                      </button>
                      <div style={{ color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79', fontSize: 13, lineHeight: 1.65 }}>
                        * - The tiebreak value is your predicted total score for the winning golfer of this tournament.
                        Use their total strokes, NOT score to par. Example: Enter {(totalParFor(entriesTournamentId) ?? 288) - 14} (NOT -14)
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </main>
  );
}
