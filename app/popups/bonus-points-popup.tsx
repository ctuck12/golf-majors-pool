'use client';

import { canonicalNameKey } from '@/app/lib/name-match';
import { applyNameAlias } from '@/app/lib/name-aliases';
import { SCORING_RULES } from '../lib/scoring';
import { getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, FOUNDER_POOL_ID, KNOCKOUT_TAB_LOGOS } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { GmpBadge } from '../gmp-badge';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function BonusPointsPopup({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    setShowBonusPoints,
    expandedBonusCategories,
    setExpandedBonusCategories,
    bonusInfoPopup,
    setBonusInfoPopup,
    setShowPointsSystem,
    feed,
    isMobile,
    tournament,
    players,
    pickedPlayerIds,
    showBonusPoints,
    pool,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(showBonusPoints)) return null;
  return (
    (() => {
          type BonusCat = {
            label: string;
            pts: number;
            showCount: boolean;
            filter: (p: typeof players[number]) => boolean;
            count: (p: typeof players[number]) => number;
          };
          const closeBonusPoints = () => { setShowBonusPoints(false); setExpandedBonusCategories(new Set()); setBonusInfoPopup(null); };
          const pickedPlayers = players.filter((p) => pickedPlayerIds.has(p.id));

          const alwaysOpenCats: BonusCat[] = [
            {
              label: 'Tourn Low Rnd',
              pts: SCORING_RULES.tourneyLowRound,
              showCount: false,
              filter: (p) => (p.scoreBreakdown.statLine.lowRounds ?? 0) > 0,
              count: () => 0,
            },
            {
              label: 'Round 1 Leader',
              pts: SCORING_RULES.firstRoundLeader,
              showCount: false,
              filter: (p) => !!p.scoreBreakdown.roundLeadersAwarded?.first,
              count: () => 0,
            },
            ...((feed?.currentRound ?? 1) >= 2 ? [{
              label: 'Round 2 Leader',
              pts: SCORING_RULES.secondRoundLeader,
              showCount: false,
              filter: (p: typeof players[number]) => !!p.scoreBreakdown.roundLeadersAwarded?.second,
              count: () => 0,
            }] : []),
            ...((feed?.currentRound ?? 1) >= 3 ? [{
              label: 'Round 3 Leader',
              pts: SCORING_RULES.thirdRoundLeader,
              showCount: false,
              filter: (p: typeof players[number]) => !!p.scoreBreakdown.roundLeadersAwarded?.third,
              count: () => 0,
            }] : []),
          ];

          const collapsibleCats: BonusCat[] = [
            {
              label: '3 Birdie Streaks',
              pts: SCORING_RULES.threeBirdieStreak,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.threeBirdieStreaks ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.threeBirdieStreaks ?? 0,
            },
            {
              label: 'No Bogey Rounds',
              pts: SCORING_RULES.bogeyFreeRound,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.bogeyFreeRounds ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.bogeyFreeRounds ?? 0,
            },
            {
              label: 'Eagles',
              pts: SCORING_RULES.eagle,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.eagle ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.eagle ?? 0,
            },
            {
              label: 'Hole in One',
              pts: SCORING_RULES.holeInOne,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.holeInOne ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.holeInOne ?? 0,
            },
            {
              label: 'Albatross',
              pts: SCORING_RULES.albatross,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.albatross ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.albatross ?? 0,
            },
          ];

          // Small flag + country code left of a player name — same style as the stat
          // leaderboard popup rows (14x20 bordered flag, 9px code).
          const bonusFlag = (name: string) => (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6, width: 50, flexShrink: 0, verticalAlign: 'middle' }}>
              {getFlagSrc(name) ? <>
                <img src={getFlagSrc(name)} alt="" style={{ height: 14, width: 20, objectFit: 'cover', borderRadius: 2, border: selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #d1d9e0', flexShrink: 0, display: 'block' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: selectedTournament === 'open' ? '#173b63' : '#9ca3af', letterSpacing: '0.05em', width: 22, display: 'inline-block' }}>{getCountryLabel(name)}</span>
              </> : null}
            </span>
          );
          const renderPlayerList = (cat: BonusCat) => {
            const earners = pickedPlayers.filter(cat.filter).sort((a, b) => cat.count(b) - cat.count(a));
            if (earners.length === 0) return <div style={{ fontSize: 12, color: selectedTournament === 'open' ? '#000000' : '#607282', fontStyle: 'italic', padding: '2px 0 4px' }}>None selected in pool apply</div>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 4 }}>
                {earners.map((p) => (
                  <div key={p.id} style={{ fontSize: 13, color: selectedTournament === 'open' ? '#000000' : '#2a3d50', fontWeight: 600 }}>
                    {bonusFlag(p.name)}{p.name}{cat.showCount ? <span style={{ color: selectedTournament === 'open' ? '#173b63' : '#607282', fontWeight: 500 }}> ({cat.count(p)})</span> : null}
                  </div>
                ))}
              </div>
            );
          };

          const lowRawScore = feed?.tournamentLowRoundScore ?? null;
          // Discard implausible values (e.g. partial-round data stored during a suspension bug)
          const validLowRawScore = lowRawScore !== null && lowRawScore >= 58 ? lowRawScore : null;
          const coursePar = feed?.coursePar ?? 72;
          const lowToPar = validLowRawScore !== null ? validLowRawScore - coursePar : null;
          const lowToParLabel = lowToPar === null ? '' : lowToPar === 0 ? ' (E)' : lowToPar < 0 ? ` (${lowToPar})` : ` (+${lowToPar})`;
          // Full-field bonus achievements not covered by pool picks — shown via info icons
          // that open a popup listing full names with the round(s), e.g. "Jackson Suber (R1)".
          const pickedBonusKeys = new Set(pickedPlayers.map((p) => canonicalNameKey(applyNameAlias(p.name))));
          const fieldBonus = feed?.fieldBonusEvents ?? {};
          const unpickedBonusFor = (key: string) => (fieldBonus[key] ?? []).filter((e) => !pickedBonusKeys.has(canonicalNameKey(applyNameAlias(e.name)))).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
          const BONUS_FIELD_KEYS: Record<string, string> = { 'Tourn Low Rnd': 'lowRound', 'Round 1 Leader': 'round1Leader', 'Round 2 Leader': 'round2Leader', 'Round 3 Leader': 'round3Leader', '3 Birdie Streaks': 'threeBirdieStreaks', 'No Bogey Rounds': 'bogeyFreeRounds', 'Eagles': 'eagles', 'Hole in One': 'holeInOne', 'Albatross': 'albatross' };
          const bpColor = selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : selectedTournament === 'open' ? '#c0392b' : '#1e4d8c';
          const catHeaderColor = selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#1e4d8c' : '#173b63';
          const bpHeaderBg = selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : selectedTournament === 'pga' ? '#B09963' : '#173b63';

          return (
            <div
              onClick={closeBonusPoints}
              style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.65)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ width: 'min(520px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', overflowY: 'auto', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)' }}
              >
                {/* Solid color header */}
                <div style={{ background: bpHeaderBg, borderRadius: '20px 20px 0 0', padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', position: 'sticky', top: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: isMobile ? 18 : 21, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Bonus Points</div>
                    <button onClick={() => setShowPointsSystem(true)} style={{ marginTop: 6, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 7, cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 9px', lineHeight: 1, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      Points System <span style={{ fontSize: 10, opacity: 0.8 }}>›</span>
                    </button>
                  </div>
                  {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                    <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {pool?.id === FOUNDER_POOL_ID ? <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ ...(isMobile ? {} : { transform: 'scale(1.3)', transformOrigin: 'right center' }), height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} /> : <GmpBadge height={46} style={{ margin: "-6px 0" }} />}
                    </div>
                  )}
                  <button onClick={closeBonusPoints} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, marginLeft: 12 }}>✕</button>
                </div>

                <div style={{ padding: isMobile ? '14px 14px 6px' : '16px 18px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Leader category cards — 2-column grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                    {alwaysOpenCats.map((cat) => {
                      const isLowRnd = cat.label === 'Tourn Low Rnd';
                      const earners = pickedPlayers.filter(cat.filter);
                      const hasEarners = earners.length > 0;
                      return (
                        <div key={cat.label} style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 12, border: selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #e2e8ef', padding: '12px 14px', boxShadow: '0 2px 6px rgba(9,34,51,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingBottom: 8, marginBottom: 8, borderBottom: (isMobile && selectedTournament === 'open') ? '0.75px solid #000000' : (isMobile && selectedTournament === 'players') ? '1px solid #f0f4f7' : selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #edf1f6' }}>
                            <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: catHeaderColor, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3 }}>
                              {isLowRnd && isMobile ? 'Tournament Low Round' : cat.label}{isLowRnd && lowToParLabel ? <span style={{ color: (lowToPar !== null && lowToPar < 0) ? '#c0392b' : '#6b7b88', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>{lowToParLabel}</span> : null}{(() => { const fieldKey = BONUS_FIELD_KEYS[cat.label]; const unpicked = fieldKey ? unpickedBonusFor(fieldKey) : []; if (unpicked.length === 0) return null; return <button onClick={() => setBonusInfoPopup({ title: cat.label, entries: unpicked })} style={{ background: 'none', border: 'none', padding: '0 0 0 3px', cursor: 'pointer', fontSize: 14, color: '#000000', lineHeight: 1, verticalAlign: 'middle', touchAction: 'manipulation' }}>ⓘ</button>; })()}
                            </div>
                          </div>
                          {hasEarners ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {earners.map((p) => (
                                <div key={p.id} style={{ fontSize: 13, color: selectedTournament === 'open' ? '#000000' : '#0f1720', fontWeight: 700 }}>
                                  {bonusFlag(p.name)}{p.name}
                                  {isLowRnd && p.lowRoundIds?.length ? (
                                    <span style={{ color: selectedTournament === 'open' ? '#173b63' : '#607282', fontWeight: 500, fontSize: 11 }}>{' '}({p.lowRoundIds.map(r => `R${r}`).join(', ')})</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: selectedTournament === 'open' ? '#000000' : '#b0bec8', fontStyle: 'italic' }}>None selected in pool apply</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Section divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 2px' }}>
                    <div style={{ flex: 1, height: 1, background: selectedTournament === 'open' ? '#000000' : '#c8d3dc' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: selectedTournament === 'open' ? '#000000' : '#5f7180', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Individual Achievements</span>
                    <div style={{ flex: 1, height: 1, background: selectedTournament === 'open' ? '#000000' : '#c8d3dc' }} />
                  </div>

                  {/* Collapsible achievement rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {collapsibleCats.map((cat) => {
                      const isOpen = expandedBonusCategories.has(cat.label);
                      const earnerCount = pickedPlayers.filter(cat.filter).length;
                      const hasEarners = earnerCount > 0;
                      return (
                        <div key={cat.label} style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#f7f9fb', borderRadius: 12, border: selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #e2e8ef', overflow: 'hidden' }}>
                          <button
                            onClick={() => setExpandedBonusCategories((prev) => {
                              const next = new Set(prev);
                              if (next.has(cat.label)) next.delete(cat.label); else next.add(cat.label);
                              return next;
                            })}
                            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '10px 12px' : '11px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', border: 'none', borderBottom: isOpen ? ((isMobile && selectedTournament === 'open') ? '0.75px solid #000000' : (isMobile && selectedTournament === 'players') ? '1px solid #f0f4f7' : selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #edf1f6') : '1px solid transparent', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent', transition: 'border-color 0.2s ease' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: catHeaderColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.label}</div>
                              {(() => {
                                const fieldKey = BONUS_FIELD_KEYS[cat.label];
                                const unpicked = fieldKey ? unpickedBonusFor(fieldKey) : [];
                                if (unpicked.length === 0) return null;
                                return <span onClick={(e) => { e.stopPropagation(); setBonusInfoPopup({ title: cat.label, entries: unpicked, showCounts: true }); }} style={{ fontSize: 14, color: '#000000', lineHeight: 1, cursor: 'pointer', touchAction: 'manipulation' }}>ⓘ</span>;
                              })()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              {hasEarners ? (
                                <span style={{ fontSize: 11, fontWeight: 800, color: selectedTournament === 'masters' ? '#2c6449' : '#fff', background: (selectedTournament === 'us-open' || selectedTournament === 'pga') ? '#173b63' : selectedTournament === 'open' ? '#c0392b' : selectedTournament === 'masters' ? '#F3E44D' : '#E0AB43', borderRadius: 999, padding: '1px 8px', minWidth: 22, textAlign: 'center', border: (selectedTournament === 'us-open' || selectedTournament === 'pga') ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : selectedTournament === 'masters' ? '1.5px solid #c8b800' : '1.5px solid #a07010', boxShadow: (selectedTournament === 'us-open' || selectedTournament === 'pga') ? '0 2px 8px rgba(14,45,100,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : selectedTournament === 'masters' ? '0 2px 8px rgba(180,150,0,0.45)' : '0 2px 8px rgba(180,140,0,0.4)' }}>{earnerCount}</span>
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 600, color: selectedTournament === 'open' ? '#000000' : '#b0bec8' }}>0</span>
                              )}
                              <span style={{ fontSize: 10, color: selectedTournament === 'open' ? '#173b63' : '#607282', lineHeight: 1, transition: 'transform 0.2s ease', display: 'inline-block', transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>▲</span>
                            </div>
                          </button>
                          <div style={{ maxHeight: isOpen ? '600px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
                            <div style={{ padding: '0 14px 12px', borderTop: selectedTournament === 'open' ? 'none' : '1px solid #eaf0f5' }}>
                              {renderPlayerList(cat)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {bonusInfoPopup && (
                    <div onClick={() => setBonusInfoPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 120 }}>
                      <div onClick={(e) => e.stopPropagation()} style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 14, width: isMobile ? 'min(320px, 100%)' : 'min(340px, calc((100vw - 48px) / 1.3))', boxShadow: '0 18px 44px rgba(9,34,51,0.35)', overflow: 'hidden', ...(isMobile ? {} : { zoom: 1.3 }) }}>
                        <div style={{ background: bpHeaderBg, padding: '10px 12px 10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{bonusInfoPopup.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                              (pool?.id === FOUNDER_POOL_ID ? <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt="" style={{ height: selectedTournament === 'pga' ? 46 : selectedTournament === 'players' ? 42 : selectedTournament === 'open' ? 36 : selectedTournament === 'masters' ? undefined : 30, width: selectedTournament === 'masters' ? 92 : undefined, maxWidth: 104, margin: '-8px 0', objectFit: 'contain', display: 'block' }} /> : <GmpBadge height={30} style={{ margin: '-4px 0' }} />)
                            )}
                            <button onClick={() => setBonusInfoPopup(null)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, cursor: 'pointer', color: '#fff', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✕</button>
                          </div>
                        </div>
                        <div style={{ padding: '12px 16px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {bonusInfoPopup.entries.map((en) => (
                              <div key={en.name} style={{ fontSize: 13, fontWeight: 700, color: '#0f1720' }}>
                                {bonusFlag(en.name)}{en.name} <span style={{ color: selectedTournament === 'open' ? '#173b63' : '#607282', fontWeight: 600 }}>({bonusInfoPopup.showCounts ? (en.count ?? en.rounds.length) : en.rounds.map((r) => `R${r}`).join(', ')})</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 10, fontSize: 11, color: selectedTournament === 'open' ? '#000000' : '#8a99a5', fontStyle: 'italic' }}>None of these players selected in the pool</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
  );
}
