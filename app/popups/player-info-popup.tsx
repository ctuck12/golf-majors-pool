'use client';

import { canonicalNameKey } from '@/app/lib/name-match';
import { TOURNAMENTS, TOURNAMENT_CAREER_RESULTS_HEADER, canonicalName, getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, PGA_CLUB_PROFESSIONALS, pgaPhoto, formatCollege, majorTint, PGA_PHOTO_ONLY, playerPhotoSrc, photoOnError, readJson, ordinal } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { TournamentWordmark } from '../tournament-wordmark';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function PlayerInfoPopup({ p }: { p: PoolPage }) {
  const {
    pickHistoryPlayerPopup,
    setPickHistoryPlayerPopup,
    setWinsListPopup,
    pickHistoryView,
    setPickHistoryView,
    statsSubView,
    setStatsSubView,
    setStatLeaderboardModal,
    statsEventId,
    feed,
    isMobile,
    tournament,
    careerTournamentId,
    amateurKeys,
    clubProKeys,
    players,
    roundTwoComplete,
  } = p;
  // Shown only when this is true (checked in app/page.tsx too).
  if (!(pickHistoryPlayerPopup !== null)) return null;
  return (
    <div
            onClick={() => setPickHistoryPlayerPopup(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 200 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: '#fff', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {/* Header — vertically center the name/flag when the player has no rank bubbles */}
              {(() => {
                const hasBubbles = (pickHistoryPlayerPopup.owgrRank ?? pickHistoryPlayerPopup.player.worldRank) != null
                  || pickHistoryPlayerPopup.fedexRank != null
                  || pickHistoryPlayerPopup.dpWorldRank != null;
                return (
              <div style={{ background: '#0f1720', borderRadius: '20px 20px 0 0', padding: '14px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: hasBubbles ? 'flex-start' : 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Name + flag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{pickHistoryPlayerPopup.player.name}</div>
                    {getPlayerFlag(pickHistoryPlayerPopup.player.name) && <>
                      <img src={getFlagSrc(pickHistoryPlayerPopup.player.name)} alt="" style={{ height: 16, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 12 }}>{getCountryLabel(pickHistoryPlayerPopup.player.name)}</span>
                    </>}
                    {/* PGA club professionals (not touring pros): PGA seal directly right of the country code.
                        Flagged either by the static set or automatically from the commissioner's upload. */}
                    {(PGA_CLUB_PROFESSIONALS.has(pickHistoryPlayerPopup.player.name) || clubProKeys.has(canonicalNameKey(pickHistoryPlayerPopup.player.name))) && (
                      // Rendered larger than the name row, but negative vertical margins keep its layout
                      // footprint at ~22px so the header height doesn't grow (overflow sits in the padding).
                      <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', flexShrink: 0, marginTop: -8, marginBottom: -8 }} />
                    )}
                  </div>
                  {/* Ranking bubbles */}
                  {hasBubbles && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                    {(pickHistoryPlayerPopup.owgrRank ?? pickHistoryPlayerPopup.player.worldRank) != null && (
                      <div style={{ background: '#fff', borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ color: '#0f1720', fontWeight: 800, fontSize: 11 }}>World Rank: {pickHistoryPlayerPopup.owgrRank ?? pickHistoryPlayerPopup.player.worldRank}</span>
                      </div>
                    )}
                    {pickHistoryPlayerPopup.fedexRank != null && (
                      <div style={{ background: '#7c3aed', borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>Fed</span>
                        <span style={{ color: '#fb923c', fontWeight: 800, fontSize: 11 }}>Ex</span>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>: {pickHistoryPlayerPopup.fedexRank}</span>
                      </div>
                    )}
                    {pickHistoryPlayerPopup.dpWorldRank != null && (
                      <div style={{ background: '#6EB487', borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>DP World:</span>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>{pickHistoryPlayerPopup.dpWorldRank}</span>
                      </div>
                    )}
                  </div>
                  )}
                </div>
                <button
                  onClick={() => setPickHistoryPlayerPopup(null)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                >✕</button>
              </div>
                );
              })()}

              {/* Tab bar — segmented control so each tab reads as a clickable button */}
              <div style={{ display: 'flex', gap: 5, background: '#fff', borderBottom: '1.5px solid #e2e8ef', padding: '8px 8px', flexShrink: 0 }}>
                {(['bio', 'stats', 'season', 'career'] as const).map((tab) => {
                  const careerTabLabel: Record<string, string> = {
                    players: 'Players Career',
                    masters: 'Masters Career',
                    pga: 'PGA Champ Career',
                    'us-open': 'U.S. Open Career',
                    open: 'The Open Career',
                  };
                  const label = tab === 'stats'
                    // Until the tournament starts only season-long stats exist, so say "Season Stats";
                    // once underway/finished the tab is "Stats" with a Tournament/Season toggle inside.
                    ? (pickHistoryPlayerPopup.statsContext !== 'tournament' || careerTournamentId === 'us-open' || careerTournamentId === 'open' ? 'Season Stats' : 'Stats')
                    : tab === 'season' ? 'Season Results' : tab === 'bio' ? 'Bio' : (careerTabLabel[careerTournamentId] ?? 'Major Career');
                  const isActive = pickHistoryView === tab;
                  // The far-right "Career" tab shows the tournament's logo (same as the main standings
                  // tournament tabs) instead of text. Keep it on a white chip so the colored logo stays
                  // legible; selection is shown via the border + shadow rather than a dark fill.
                  const careerLogo = tab === 'career' ? TOURNAMENT_TAB_LOGOS[careerTournamentId] : undefined;
                  return (
                    <button
                      key={tab}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setPickHistoryView(tab as 'stats' | 'season' | 'career' | 'bio');
                        if (tab === 'career' && pickHistoryPlayerPopup.careerResults === null && !pickHistoryPlayerPopup.careerResultsLoading) {
                          setPickHistoryPlayerPopup((prev) => prev ? { ...prev, careerResultsLoading: true } : null);
                          try {
                            const data = await readJson<{ results: { year: number; course: string; position: string }[] | null }>(`/api/player-career?name=${encodeURIComponent(pickHistoryPlayerPopup.player.name)}&tournamentId=${careerTournamentId}`, { cache: 'no-store' });
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, careerResults: data.results, careerResultsLoading: false } : null);
                          } catch {
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, careerResultsLoading: false } : null);
                          }
                        }
                        if (tab === 'bio' && pickHistoryPlayerPopup.playerBio === null && !pickHistoryPlayerPopup.playerBioLoading) {
                          setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBioLoading: true } : null);
                          try {
                            const bioParams = new URLSearchParams({ name: pickHistoryPlayerPopup.player.name });
                            if (pickHistoryPlayerPopup.player.pgaTourId) bioParams.set('pgaTourId', String(pickHistoryPlayerPopup.player.pgaTourId));
                            const data = await readJson<{ bio: { height: string | null; weight: string | null; dob: string | null; age: number | null; birthPlace: string | null; college: string | null; collegeConfirmedAbsent: boolean; swing: string | null; turnedPro: number | null; pgaTourDebut: number | null; careerStarts: number | null; cutsMade: number | null; careerWins: number | null; majorStarts: number | null; majorCutsMade: number | null; majorWins: number | null; careerEarnings: string | null; pgaTourWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; majorWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null }; espnPhotoUrl?: string | null; pgaPhotoUrl?: string | null; updatedAt?: string | null }>(`/api/player-bio?${bioParams.toString()}`, { cache: 'no-store' });
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBio: data.bio, playerBioLoading: false, espnPhotoUrl: data.espnPhotoUrl ?? null, pgaPhotoUrl: data.pgaPhotoUrl ?? null, bioFetchedAt: data.updatedAt ?? null } : null);
                          } catch {
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBioLoading: false } : null);
                          }
                        }
                      }}
                      style={{ flex: 1, height: 33, boxSizing: 'border-box', border: isActive ? '1px solid #0f1720' : '1px solid #d8e0e8', borderRadius: 8, background: isActive ? '#fff' : '#f4f7fa', padding: careerLogo ? '0 4px' : '0 3px', fontSize: 'clamp(8.5px, 2.2vw, 11px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? 800 : 600, color: isActive ? '#0f1720' : '#5a6a7a', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.01em', boxShadow: isActive ? '0 1px 4px rgba(15,23,32,0.28)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {careerLogo
                        ? <TournamentWordmark id={careerTournamentId} alt={label} width={isMobile ? 64 : 84} height={24} style={{ maxWidth: '100%' }} />
                        : label}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 20px', background: '#f4f7fa', borderRadius: '0 0 20px 20px' }}>
                {pickHistoryView === 'bio' && (() => {
                  const bio = pickHistoryPlayerPopup.playerBio;
                  const loading = pickHistoryPlayerPopup.playerBioLoading;
                  // Photo: use the same synchronous source as the lists (PGA-only pins -> PGA;
                  // manual upload wins; else ESPN headshot; else PGA). Available on first paint, so
                  // the photo is correct immediately and never swaps after the bio loads.
                  const photoPlayer = pickHistoryPlayerPopup.player;
                  const pgaDefault = pgaPhoto(photoPlayer.pgaTourId);
                  const syncPhoto = playerPhotoSrc(photoPlayer.name, photoPlayer.pgaTourId, photoPlayer.photoUrl);
                  // When the synchronous source has no real photo for this player (it falls back to
                  // the blank PGA silhouette) and they aren't intentionally pinned to the PGA photo,
                  // use the live ESPN-by-name headshot the bio API resolved. This restores photos for
                  // non-pool players (e.g. Masters legends) without a flash for everyone else.
                  const noRealSyncPhoto = syncPhoto === pgaDefault && !PGA_PHOTO_ONLY.has(photoPlayer.name);
                  // For non-pool players (pgaTourId 0) the bio API resolves a real PGA Tour headshot
                  // (pgaPhotoUrl) from its own id map — use it when the synchronous source is the blank
                  // silhouette, and as the on-error fallback when the ESPN headshot 404s.
                  const bioPgaPhoto = pickHistoryPlayerPopup.pgaPhotoUrl;
                  const photoSrc = noRealSyncPhoto
                    ? (pickHistoryPlayerPopup.espnPhotoUrl ?? bioPgaPhoto ?? syncPhoto)
                    : syncPhoto;
                  const photoFallback = (noRealSyncPhoto ? bioPgaPhoto : null) ?? photoPlayer.photoUrl ?? pgaDefault;
                  const topRows: { label: string; value: string | number | null; italic?: boolean }[] = [
                    { label: 'DOB', value: bio?.dob ? `${bio.dob}${bio.age != null ? ` (${bio.age})` : ''}` : null },
                    { label: 'Birthplace', value: bio?.birthPlace ?? null },
                    { label: 'Height', value: bio?.height ?? null },
                    { label: 'Weight', value: bio?.weight ?? null },
                    { label: 'Swing', value: bio?.swing ?? null },
                    { label: 'College', value: bio?.college ? formatCollege(bio.college) : null, italic: !bio?.college && (bio?.collegeConfirmedAbsent ?? false) },
                  ];
                  // Career rows are split into logically grouped cards so the PGA Tour trio and the
                  // Major trio each read as their own unit (Turned Pro / Career Earnings are the
                  // standalone bookends). Each group renders as its own outlined card with a small gap.
                  type BioBottomRow = { label: string; value: string | number | null; wins?: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; amateur?: boolean };
                  // Amateurs (flagged from the commissioner's "(a)" upload markers) show a red "AMATEUR"
                  // in place of a Turned Pro year — BUT only while they have no turn-pro year. A turn-pro
                  // year is the authoritative signal that they've gone pro (ESPN publishes it, or a bio
                  // override sets it), so the moment one exists the field auto-flips from AMATEUR to the
                  // year with no re-upload or manual step.
                  const isAmateur = amateurKeys.has(canonicalNameKey(pickHistoryPlayerPopup.player.name)) && bio?.turnedPro == null;
                  // A player with no PGA Tour starts (ESPN returns no career-starts figure) has never
                  // played a PGA Tour event — show 0 across the PGA Tour trio instead of dashes. Only
                  // once the bio has actually loaded; while loading (bio null) they stay as dashes.
                  const noPgaCareer = bio != null && (bio.careerStarts == null || bio.careerStarts === 0);
                  const bottomGroups: BioBottomRow[][] = [
                    [
                      isAmateur
                        ? { label: 'Turned Pro', value: 'AMATEUR', amateur: true }
                        : { label: 'Turned Pro', value: bio?.turnedPro ?? null },
                    ],
                    [
                      { label: 'PGA Tour Starts', value: noPgaCareer ? 0 : bio?.careerStarts ?? null },
                      { label: 'Cuts Made', value: noPgaCareer ? 0 : bio?.cutsMade ?? null },
                      { label: 'PGA Tour Wins', value: noPgaCareer ? 0 : (bio?.careerWins ?? null), wins: bio?.pgaTourWinsList ?? null },
                    ],
                    [
                      { label: 'Major Starts', value: bio?.majorStarts ?? null },
                      { label: 'Cuts Made', value: bio?.majorCutsMade ?? null },
                      { label: 'Major Wins', value: bio?.majorWins ?? null, wins: bio?.majorWinsList ?? null },
                    ],
                    [
                      { label: 'Career Earnings', value: bio?.careerEarnings ?? null },
                    ],
                  ];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {/* Top section: photo left, personal info right */}
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e2e8ef', marginBottom: 10 }}>
                        {/* Photo column */}
                        <div style={{ flexShrink: 0, width: 125, background: '#e8edf2', display: 'flex', alignItems: 'stretch' }}>
                          <img
                            src={photoSrc}
                            data-fb={photoFallback}
                            alt={photoPlayer.name}
                            style={{ width: 125, objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                            onError={photoOnError}
                          />
                        </div>
                        {/* Personal info rows */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1.5px solid #e2e8ef' }}>
                          {topRows.map((row, i) => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: i < topRows.length - 1 ? '1px solid #e2e8ef' : 'none', flex: 1 }}>
                              <span style={{ fontSize: 12, color: '#5a6a7a', fontWeight: 600 }}>{row.label}</span>
                              {loading
                                ? <span style={{ width: 90, height: 11, borderRadius: 4, background: '#e2e8ef', marginLeft: 6, display: 'inline-block' }} />
                                : row.italic
                                  ? <span style={{ fontSize: 11, color: '#9aabb8', fontStyle: 'italic', textAlign: 'right', marginLeft: 6 }}>*Did not attend college</span>
                                  : <span style={{ fontSize: 12, color: row.value != null ? '#0f1720' : '#b0bec5', fontWeight: 700, textAlign: 'right', marginLeft: 6 }}>{row.value != null ? String(row.value) : '—'}</span>
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Bottom rows: full width, split into grouped cards (PGA Tour vs Majors vs bookends) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {bottomGroups.map((group, gi) => (
                          <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e2e8ef' }}>
                            {group.map((row, i) => {
                              // A Wins row is tappable when we have the per-win detail (count > 0).
                              const clickable = !loading && !!row.wins && row.wins.length > 0;
                              return (
                              <div
                                key={row.label}
                                onClick={clickable ? () => setWinsListPopup({ title: row.label, playerName: photoPlayer.name, wins: row.wins! }) : undefined}
                                role={clickable ? 'button' : undefined}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: i < group.length - 1 ? '1px solid #e2e8ef' : 'none', cursor: clickable ? 'pointer' : 'default' }}
                              >
                                <span style={{ fontSize: 13, color: '#5a6a7a', fontWeight: 600 }}>{row.label}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {/* Eye/info icon (same affordance as the leaderboard popup triggers), to the
                                      LEFT so the number stays right-aligned with the other rows. */}
                                  {clickable && (
                                    <span style={{ fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1 }} aria-label={`View ${row.label}`}>ⓘ</span>
                                  )}
                                  <span style={{ fontSize: 13, color: row.amateur ? '#d32f2f' : row.value != null ? '#0f1720' : '#b0bec5', fontWeight: row.amateur ? 800 : 700, letterSpacing: row.amateur ? 0.5 : undefined }}>{row.value != null ? String(row.value) : '—'}</span>
                                </span>
                              </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      {(() => {
                        const times = [pickHistoryPlayerPopup.bioFetchedAt, pickHistoryPlayerPopup.rankingsChangedAt].filter(Boolean) as string[];
                        const ts = times.length ? times.slice().sort()[times.length - 1] : null;
                        return ts && !loading ? (
                          <div style={{ fontSize: 10, color: '#a0adb8', textAlign: 'center', marginTop: 8 }}>
                            Last updated: {new Date(ts).toLocaleString()}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  );
                })()}
                {pickHistoryView === 'stats' && (() => {
                  const isTournCtx = pickHistoryPlayerPopup.statsContext === 'tournament';
                  // The Open publishes no per-event advanced stats (ESPN 404s, PGA feed empty), so
                  // like the US Open it shows Season stats only with no Tournament/Season toggle.
                  const seasonOnlyTab = careerTournamentId === 'us-open' || careerTournamentId === 'open';
                  const showSubToggle = isTournCtx && !seasonOnlyTab;
                  const s = careerTournamentId === 'open'
                    ? pickHistoryPlayerPopup.playerSeasonStats
                    : showSubToggle && statsSubView === 'season'
                    ? pickHistoryPlayerPopup.playerSeasonStats
                    : pickHistoryPlayerPopup.playerStats;
                  const espnRounds = isTournCtx
                    ? (pickHistoryPlayerPopup.playerStats?.rounds ?? []).map((score, i) => ({ round: i + 1, score }))
                    : [];
                  const rounds = isTournCtx
                    ? (pickHistoryPlayerPopup.playerRounds?.length ? pickHistoryPlayerPopup.playerRounds : espnRounds)
                    : [];
                  const isTournView = !seasonOnlyTab && ((showSubToggle && statsSubView === 'tournament') || (!showSubToggle && isTournCtx));
                  const avgs = isTournView
                    ? { ...pickHistoryPlayerPopup.statAverages, ...pickHistoryPlayerPopup.fieldAverages }
                    : pickHistoryPlayerPopup.statAverages ?? {};
                  const avgLabel = isTournView ? 'Field Avg' : 'Tour Avg';
                  const distributions = pickHistoryPlayerPopup.fieldDistributions ?? {};
                  const tournRanks = pickHistoryPlayerPopup.statRanks ?? {};
                  const rawSeasonStatRanks = pickHistoryPlayerPopup.seasonStatRanks ?? {};
                  // Season view ranks come ONLY from the season fetch (rawSeasonStatRanks). We fall
                  // back to tournRanks ONLY when the main fetch was itself season context
                  // (!isTournCtx) — there tournRanks legitimately holds season ranks. In a live
                  // tournament popup (isTournCtx), tournRanks holds TOURNAMENT ranks, so we must NOT
                  // borrow them, or a player with no season ranks (LIV / non-qualified) would show
                  // his tournament SG ranks in the season view.
                  const seasonRanks = isTournView
                    ? tournRanks
                    : (Object.keys(rawSeasonStatRanks).length > 0 ? rawSeasonStatRanks : (isTournCtx ? {} : tournRanks));
                  function ordinal(n: string | number): string {
                    const num = parseInt(String(n));
                    if (isNaN(num)) return String(n);
                    const v = num % 100;
                    const suffix = (v >= 11 && v <= 13) ? 'th' : ['th','st','nd','rd','th'][Math.min(num % 10, 4)];
                    return `${num}${suffix}`;
                  }
                  // Compute rank from sorted field distribution (best-first array)
                  function getFieldRank(key: string, rawValue: string | null): string | null {
                    if (!rawValue) return null;
                    const dist = distributions[key];
                    if (!dist || dist.length < 5) return null;
                    const playerVal = parseFloat(rawValue.replace('%', ''));
                    if (isNaN(playerVal)) return null;
                    const lowerIsBetter = key === 'scoringAverage' || key === 'puttAverage';
                    const betterCount = dist.filter((v) => lowerIsBetter ? v < playerVal : v > playerVal).length;
                    return String(betterCount + 1);
                  }
                  const SG_KEYS = new Set(['sgTotal','sgTeeToGreen','sgOffTee','sgApproach','sgAroundGreen','sgPutting']);
                  // Hide SG ranks for cut players when Round 3 has started
                  const feedPlayer = feed?.fullLeaderboard?.find((p) => p.name === pickHistoryPlayerPopup.player.name)
                    ?? (feed?.players ?? []).find((p) => p.canonicalName === pickHistoryPlayerPopup.player.name);
                  const playerMissedCut = feedPlayer?.score === 'CUT' || feedPlayer?.position === 'CUT'
                    || feedPlayer?.score === 'MDF' || feedPlayer?.position === 'MDF';
                  const hideSgRanks = isTournView && roundTwoComplete && playerMissedCut;
                  function getRank(key: string, rawValue: string | null): string | null {
                    if (hideSgRanks && SG_KEYS.has(key)) return null;
                    if (isTournView) {
                      // Tournament leaderboard list position (from the API) is the source of truth for
                      // BOTH course and SG, so the card matches the popup exactly. For course stats,
                      // fall back to the field-distribution rank only if the leaderboard rank is absent
                      // (e.g. its cache is cold). SG has no fallback. No season ranks here.
                      const r = tournRanks[key] ?? null;
                      if (r) return ordinal(r);
                      if (SG_KEYS.has(key)) return null;
                      const fieldRank = getFieldRank(key, rawValue);
                      return fieldRank ? ordinal(fieldRank) : null;
                    }
                    // Season view: pure season PGA Tour ranks
                    const r = seasonRanks[key] ?? null;
                    return r ? ordinal(r) : null;
                  }
                  const courseStatCells: { label: string; value: string; avgKey?: string; rankKey?: string }[] = [];
                  const sgStatCells: { label: string; value: string; rankKey?: string }[] = [];
                  if (s?.drivingDistance) courseStatCells.push({ label: 'Drive Distance', value: s.drivingDistance, avgKey: 'drivingDistance', rankKey: 'drivingDistance' });
                  if (s?.drivingAccuracy) courseStatCells.push({ label: 'Drive Accuracy', value: s.drivingAccuracy, avgKey: 'drivingAccuracy', rankKey: 'drivingAccuracy' });
                  if (s?.gir) courseStatCells.push({ label: 'Greens in Reg', value: s.gir, avgKey: 'gir', rankKey: 'gir' });
                  if (s?.scrambling) courseStatCells.push({ label: 'Scrambling', value: s.scrambling, avgKey: 'scrambling', rankKey: 'scrambling' });
                  if (s?.sandSaves) courseStatCells.push({ label: 'Sand Saves', value: s.sandSaves, avgKey: 'sandSaves', rankKey: 'sandSaves' });
                  if (s?.puttAverage) courseStatCells.push({ label: 'Putts/Green', value: s.puttAverage, avgKey: 'puttAverage', rankKey: 'puttAverage' });
                  if (showSubToggle && statsSubView === 'tournament') {
                    if (s?.proximity) courseStatCells.push({ label: 'Proximity', value: s.proximity });
                  }
                  if (s?.sgTotal) sgStatCells.push({ label: 'Total', value: s.sgTotal, rankKey: 'sgTotal' });
                  if (s?.sgTeeToGreen) sgStatCells.push({ label: 'Tee to Green', value: s.sgTeeToGreen, rankKey: 'sgTeeToGreen' });
                  if (s?.sgOffTee) sgStatCells.push({ label: 'Off the Tee', value: s.sgOffTee, rankKey: 'sgOffTee' });
                  if (s?.sgApproach) sgStatCells.push({ label: 'Approach', value: s.sgApproach, rankKey: 'sgApproach' });
                  if (s?.sgAroundGreen) sgStatCells.push({ label: 'Around Green', value: s.sgAroundGreen, rankKey: 'sgAroundGreen' });
                  if (s?.sgPutting) sgStatCells.push({ label: 'Putting', value: s.sgPutting, rankKey: 'sgPutting' });
                  const statCells = [...courseStatCells, ...sgStatCells];
                  const subToggle = showSubToggle ? (
                    <div key="stats-subtoggle" style={{ display: 'flex', background: '#e8edf2', borderRadius: 8, padding: 3, marginBottom: 10, justifySelf: 'start' }}>
                      {(['tournament', 'season'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setStatsSubView(v)}
                          style={{ padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', transition: 'all 0.15s', background: statsSubView === v ? '#fff' : 'transparent', color: statsSubView === v ? '#0f1720' : '#607282', boxShadow: statsSubView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                          {v === 'tournament' ? 'Tournament' : 'Season'}
                        </button>
                      ))}
                    </div>
                  ) : null;
                  if (pickHistoryPlayerPopup.playerStatsLoading) {
                    return (
                      <div key="stats-loading" style={{ display: 'grid', gap: 10 }}>
                        {subToggle}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          {[0,1,2,3].map((i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px', textAlign: 'center' }}>
                              <div className="ph-skeleton" style={{ height: 9, width: 22, marginBottom: 4, borderRadius: 3, margin: '0 auto 4px' }} />
                              <div className="ph-skeleton" style={{ height: 14, width: 28, borderRadius: 3, margin: '0 auto' }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {[0,1,2,3,4,5].map((i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px' }}>
                              <div className="ph-skeleton" style={{ height: 9, width: 48, marginBottom: 4, borderRadius: 3 }} />
                              <div className="ph-skeleton" style={{ height: 13, width: 60, borderRadius: 3 }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (statCells.length === 0) {
                    return <div key="stats-empty" style={{ display: 'grid', gap: 0 }}>{subToggle}<div style={{ textAlign: 'center', color: '#607282', padding: '20px 0', fontSize: 14 }}>No stats available for this {isTournCtx && statsSubView === 'tournament' ? 'tournament' : 'season'}.</div></div>;
                  }
                  return (
                    <div key="stats-loaded" style={{ display: 'grid', gap: 10 }}>
                      {subToggle}
                      {courseStatCells.length > 0 && (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {courseStatCells.map(({ label, value, avgKey, rankKey }) => {
                              const avg = avgKey ? avgs[avgKey] : undefined;
                              const rank = rankKey ? getRank(rankKey, value) : null;
                              return (
                                <div key={label} onClick={() => { if (rankKey) { const lbEventId = statsEventId(careerTournamentId); const url = isTournView && lbEventId ? `/api/tournament-stat-leaderboard?statKey=${rankKey}&eventId=${lbEventId}` : `/api/stat-leaderboard?statKey=${rankKey}`; const subtitle = isTournView ? 'Tournament Leaders' : 'Season Leaders'; setStatLeaderboardModal({ label, statKey: rankKey, subtitle, tourAvg: null, avgLabel: isTournView ? 'Field Avg' : 'Tour Avg', playerName: pickHistoryPlayerPopup?.player.name ?? null, entries: null }); fetch(url).then(r => r.json()).then(d => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, tourAvg: d.fieldAvg ?? d.tourAvg ?? null, entries: d.entries ?? [] } : prev)).catch(() => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, entries: [] } : prev)); } }} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px', cursor: rankKey ? 'pointer' : 'default' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1720' }}>
                                    {value}{rank && <span style={{ fontSize: 10, fontWeight: 600, color: '#607282', marginLeft: 4 }}>({rank})</span>}
                                  </div>
                                  {avg && <div style={{ fontSize: 9, color: '#a0adb8', marginTop: 3 }}>{avgLabel}: {avg}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {sgStatCells.length > 0 && !(careerTournamentId === 'masters' && isTournView) && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Strokes Gained</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {sgStatCells.map(({ label, value, rankKey }) => {
                              const rank = rankKey ? getRank(rankKey, value) : null;
                              return (
                                <div key={label} onClick={() => { if (rankKey) { const lbEventId = statsEventId(careerTournamentId); const url = isTournView && lbEventId ? `/api/tournament-stat-leaderboard?statKey=${rankKey}&eventId=${lbEventId}` : `/api/stat-leaderboard?statKey=${rankKey}`; const subtitle = isTournView ? 'Tournament Leaders' : 'Season Leaders'; setStatLeaderboardModal({ label: `Strokes Gained: ${label}`, statKey: rankKey, subtitle, tourAvg: null, avgLabel: isTournView ? 'Field Avg' : 'Tour Avg', playerName: pickHistoryPlayerPopup?.player.name ?? null, entries: null }); fetch(url).then(r => r.json()).then(d => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, tourAvg: isTournView ? null : (d.fieldAvg ?? d.tourAvg ?? null), entries: d.entries ?? [] } : prev)).catch(() => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, entries: [] } : prev)); } }} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px', cursor: rankKey ? 'pointer' : 'default' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1720' }}>
                                    {value}{rank && <span style={{ fontSize: 10, fontWeight: 600, color: '#607282', marginLeft: 4 }}>({rank})</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const ts = isTournView ? pickHistoryPlayerPopup.tournamentStatsFetchedAt : pickHistoryPlayerPopup.seasonStatsFetchedAt;
                        return ts ? (
                          <div style={{ fontSize: 10, color: '#a0adb8', textAlign: 'center', marginTop: 4 }}>
                            Last updated: {new Date(ts).toLocaleString()}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  );
                })()}
                {pickHistoryView === 'season' && (
                  pickHistoryPlayerPopup.fullResultsLoading ? (
                    <div key="full-loading" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      <div className="ph-skeleton" style={{ height: 13, width: 160, marginBottom: 4 }} />
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: '1px solid #e2e8ef', background: '#fff', gap: 10 }}>
                          <div style={{ flex: 1, display: 'grid', gap: 5 }}>
                            <div className="ph-skeleton" style={{ height: 12, width: `${90 + (i % 3) * 30}px` }} />
                            <div className="ph-skeleton" style={{ height: 10, width: `${60 + (i % 4) * 20}px` }} />
                          </div>
                          <div className="ph-skeleton" style={{ height: 18, width: 32, borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  ) : !pickHistoryPlayerPopup.fullResults || pickHistoryPlayerPopup.fullResults.length === 0 ? (
                    <div key="full-empty" className="ph-fade-in" style={{ textAlign: 'center', color: '#607282', padding: '30px 0', fontSize: 14 }}>No PGA, DP World or LIV starts this season.</div>
                  ) : (
                    <div key="full-loaded" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      {(() => {
                        const pgaResults = pickHistoryPlayerPopup.fullResults!.filter((r) => r.tour === 'pga' || !r.tour);
                        const livResults = pickHistoryPlayerPopup.fullResults!.filter((r) => r.tour === 'liv');
                        const eurResults = pickHistoryPlayerPopup.fullResults!.filter((r) => r.tour === 'eur');
                        type FullResult = { tournament: string; date: string; course: string; position: string; tour: 'pga' | 'liv' | 'eur' };
                        const renderCard = (r: FullResult, i: number) => {
                          const isCut = r.position === 'CUT' || r.position === 'WD' || r.position === 'MDF' || r.position === 'DQ';
                          const majorBadge = majorTint(r.tournament);
                          const displayTournament = r.tournament === 'The Open' ? 'The Open Championship' : r.tournament;
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: majorBadge ? `1px solid ${majorBadge.bg}` : '1px solid #e2e8ef', background: majorBadge ? majorBadge.bg : '#fff', gap: 10 }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: majorBadge ? majorBadge.text : '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTournament}</div>
                                <div style={{ fontSize: 11, color: majorBadge ? majorBadge.text : '#7a8c99', marginTop: 1, opacity: majorBadge ? 0.75 : 1 }}>{r.date}{r.course ? ` · ${r.course}` : ''}</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 16, fontWeight: 900, color: isCut ? '#cc2944' : (majorBadge ? majorBadge.text : '#0f1720'), lineHeight: 1 }}>{r.position}</div>
                              </div>
                            </div>
                          );
                        };
                        const hasAny = pgaResults.length > 0 || livResults.length > 0 || eurResults.length > 0;
                        if (!hasAny) {
                          return <div style={{ textAlign: 'center', color: '#607282', padding: '30px 0', fontSize: 14 }}>No PGA, DP World or LIV starts this season.</div>;
                        }
                        return (
                          <>
                            {pgaResults.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 2 }}>2026 PGA Tour Results</div>
                                {pgaResults.map(renderCard)}
                              </>
                            )}
                            {livResults.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 2, marginTop: pgaResults.length > 0 ? 10 : 0 }}>2026 LIV Golf Results</div>
                                {livResults.map(renderCard)}
                              </>
                            )}
                            {eurResults.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 2, marginTop: (pgaResults.length > 0 || livResults.length > 0) ? 10 : 0 }}>2025-26 DP World Tour Results</div>
                                {eurResults.map(renderCard)}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )
                )}
                {pickHistoryView === 'career' && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 10 }}>
                    {TOURNAMENT_CAREER_RESULTS_HEADER[careerTournamentId] ?? 'Career Results'}
                  </div>
                )}
                {pickHistoryView === 'career' && (
                  pickHistoryPlayerPopup.careerResultsLoading ? (
                    <div key="career-loading" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      <div className="ph-skeleton" style={{ height: 13, width: 140, marginBottom: 4 }} />
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: '1px solid #e2e8ef', background: '#fff', gap: 10 }}>
                          <div style={{ flex: 1, display: 'grid', gap: 5 }}>
                            <div className="ph-skeleton" style={{ height: 12, width: 36 }} />
                            <div className="ph-skeleton" style={{ height: 10, width: 120 }} />
                          </div>
                          <div className="ph-skeleton" style={{ height: 18, width: 32, borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  ) : pickHistoryPlayerPopup.careerResults === null ? (
                    <div key="career-empty" className="ph-fade-in" style={{ textAlign: 'center', color: '#607282', padding: '30px 0', fontSize: 14 }}>Has not competed in {TOURNAMENTS.find((t) => t.id === careerTournamentId)?.name ?? 'this tournament'}</div>
                  ) : (
                    <div key="career-loaded" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      {pickHistoryPlayerPopup.careerResults.map((r, i) => {
                        const isCut = r.position === 'CUT' || r.position === 'WD' || r.position === 'MDF' || r.position === 'DQ';
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: '1px solid #e2e8ef', background: '#fff', gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#0f1720' }}>{r.year}</div>
                              <div style={{ fontSize: 11, color: '#7a8c99', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.course}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: isCut ? '#cc2944' : '#0f1720', lineHeight: 1 }}>{r.position}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
  );
}
