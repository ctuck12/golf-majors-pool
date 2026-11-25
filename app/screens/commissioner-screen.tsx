'use client';

import { type ReactNode } from 'react';
import { VenmoMark } from '../venmo-mark';
import { formatVenmo } from '@/app/lib/venmo';
import { currentTournamentMeta, effectiveLockTime } from '@/app/lib/tournament-config';
import { AlertCircle, ArrowLeft, Award, Layers, BookOpen, ChevronRight, Calendar, CircleUserRound, CheckCircle2, DollarSign, Eye, EyeOff, Lock, LogOut, MessageSquareText, Pencil, RefreshCw, Save, Search, Send, Trophy, Users } from 'lucide-react';
import { SALARY_CAP, REQUIRED_GOLFERS, totalParFor, TOURNAMENTS, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, TOURNAMENT_EVENT_LOGOS, eventLogoStyle, pgaPhoto, playerPhotoSrc, photoOnError, MOBILE_TWO_LINE_NAMES, MOBILE_CUSTOM_SPLITS, utcToCentralInput, shouldShowPreTournamentView, formatRefresh, fieldStyle, FOUNDER_POOL_ID } from '../pool-data';
import type { PoolPage } from '../pool-page-state';
import { TournamentWordmark } from '../tournament-wordmark';
import { GmpBadge } from '../gmp-badge';
import { AdminSetupCard } from '../admin-setup-card';

// Moved out of app/page.tsx unchanged. `p` is the page's state (usePoolPage()).
export function CommissionerScreen({ p }: { p: PoolPage }) {
  const {
    selectedTournament,
    feed,
    nowTick,
    lockTimeOverrides,
    preTournamentTick,
    preTournamentBusy,
    savePreTournamentOverride,
    pool,
    setLeagueModalOpen,
    authBusy,
    commissionerMembers,
    submittedRosterMemberId,
    setSubmittedRosterMemberId,
    pickPopularityOpen,
    setPickPopularityOpen,
    pickPopularityPlayer,
    setPickPopularityPlayer,
    poolLockModalOpen,
    setPoolLockModalOpen,
    poolLockInput,
    setPoolLockInput,
    poolLockBusy,
    poolLockMsg,
    setPoolLockMsg,
    savePoolLockTime,
    commissionerPicksSort,
    setCommissionerPicksSort,
    commissionerEditReturnRef,
    commissionerBusy,
    commissionerError,
    setCommissionerError,
    commissionerSuccess,
    commissionerConsoleView,
    setCommissionerConsoleView,
    commissionerMemberSearch,
    setCommissionerMemberSearch,
    commissionerMemberSort,
    setCommissionerMemberSort,
    setEntryFeesOpen,
    setAdminLeaguesOpen,
    setPayWinnersOpen,
    setPoolMessageOpen,
    setPayoutPlanOpen,
    setGuideOpen,
    setFeeTrackerOpen,
    setSeasonSettingsOpen,
    commissionerPlayerSearch,
    setCommissionerPlayerSearch,
    setCommissionerRosterMemberId,
    commissionerRosterSelection,
    commissionerTieBreakInput,
    setCommissionerTieBreakInput,
    winnerScoreInput,
    setWinnerScoreInput,
    clearLeaderBusy,
    clearLeaderMsg,
    poolToolModal,
    setPoolToolModal,
    poolToolConfirm,
    setPoolToolConfirm,
    playerStatusInput,
    setPlayerStatusInput,
    playerStatusBusy,
    playerStatusMsg,
    showMemberPassword,
    setShowMemberPassword,
    showAddMemberForm,
    setShowAddMemberForm,
    memberCreateForm,
    setMemberCreateForm,
    isMobile,
    isLandscapePhone,
    tournament,
    isAppAdmin,
    canManagePool,
    entriesTournamentId,
    entriesTournament,
    commissionerTournamentWinnerScore,
    commissionerTournamentLabel,
    commissionerAutoDetected,
    tiebreakResolved,
    entriesTournamentCourseName,
    entriesTournamentPar,
    handleLogout,
    handleCreateMember,
    handleToggleLineupLock,
    handleTogglePicksOpen,
    handleClearRoundLeader,
    handleMarkPlayerStatus,
    handleSaveWinnerScore,
    openCommissionerMemberModal,
    openCommissionerMemberPicks,
    toggleCommissionerRosterPlayer,
    handleSaveCommissionerRoster,
    salaryListMissing,
    playersById,
    filteredCommissionerMembers,
    commissionerRosterMember,
    filteredCommissionerPlayers,
    submittedCommissionerMembers,
    pendingCommissionerMembers,
    commissionerOrderedRosterPlayers,
    commissionerSalaryRemaining,
    commissionerAverageRemainingPerPlayer,
    canSaveCommissionerRoster,
    locked,
    openPlayerPopup,
    headerSolid,
    entriesTournamentBg,
    entriesTournamentSolid,
    entriesTournamentDisplayName,
    entriesWarningPalette,
    salaryColor,
    setPool,
    setPaywallMode,
  } = p;
  const answerNoSeasonPool = async () => {
    const res = await fetch('/api/commissioner/season', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false, fee: null, plan: null }) });
    const payload = (await res.json().catch(() => ({}))) as { pool?: NonNullable<typeof pool> };
    if (res.ok && payload.pool) setPool((current) => (current ? { ...current, ...payload.pool } : payload.pool!));
  };
  const isCommissioner = pool?.role === 'commissioner';
  // One tool tile (same look for every group).
  const toolTile = (t: { key: string; title: ReactNode; sub: ReactNode; Icon: typeof Trophy; open: () => void; href?: string }) => {
    const Icon = t.Icon;
    const inner = (
      <>
        <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: entriesTournamentBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={isMobile ? 18 : 22} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#0f1720' }}>{t.title}</div>
          <div style={{ marginTop: 2, fontSize: isMobile ? 11.5 : 12, color: '#5b6b79' }}>{t.sub}</div>
        </div>
      </>
    );
    const style = { textAlign: 'left' as const, textDecoration: 'none', border: '1px solid #e6edf1', borderRadius: 14, padding: isMobile ? '11px 13px' : '14px 16px', background: 'linear-gradient(180deg, #ffffff 0%, #f7fafc 100%)', boxShadow: '0 4px 12px rgba(9, 34, 51, 0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: isMobile ? 11 : 13 };
    return t.href ? <a key={t.key} href={t.href} style={style}>{inner}</a> : <button key={t.key} type="button" onClick={t.open} style={style}>{inner}</button>;
  };
  const toolGroup = (title: string, tools: Parameters<typeof toolTile>[0][], note?: string) => (
    <section key={title} style={{ background: '#fff', borderRadius: 20, padding: isMobile ? 14 : 20, boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79', marginBottom: note ? 2 : 12 }}>{title}</div>
      {note ? <div style={{ fontSize: 12, color: '#8a99a6', marginBottom: 12 }}>{note}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? 8 : 12 }}>
        {tools.map(toolTile)}
      </div>
    </section>
  );
  const openMembers = () => { setCommissionerRosterMemberId(null); setCommissionerMemberSearch(''); setShowAddMemberForm(false); setCommissionerConsoleView('members'); };
  const openPoolTool = (key: 'tiebreak' | 'roundLeader' | 'markStatus') => { setPoolToolConfirm(null); setPoolToolModal(key); };
  const openPoolLock = () => {
    const current = effectiveLockTime(lockTimeOverrides[entriesTournamentId], currentTournamentMeta(entriesTournamentId)?.lockAtUtc);
    setPoolLockInput(current ? utcToCentralInput(current) : '');
    setPoolLockMsg('');
    setPoolLockModalOpen(true);
  };
  const seasonNow = pool?.poolSeason;
  const seasonPoolNow = seasonNow ? pool?.seasonPools?.[seasonNow] : undefined;
  return (
    <main style={{ marginTop: isMobile ? 12 : 24, display: 'grid', gap: isMobile ? 12 : 20 }}>
            {commissionerConsoleView === 'dashboard' ? (
              <>
              {pool ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', fontSize: isMobile ? 13 : 14, color: '#5b6b79' }}>
                  <span>Viewing league:</span>
                  <span style={{ fontWeight: 900, color: '#173b63' }}>{pool.name}</span>
                  <span aria-hidden="true">·</span>
                  <button type="button" onClick={() => setLeagueModalOpen(true)} style={{ background: 'none', border: 'none', padding: 0, color: '#2f5f96', fontWeight: 800, fontSize: 'inherit', cursor: 'pointer' }}>
                    Switch
                  </button>
                </div>
              ) : null}
              {isCommissioner && pool ? (
                <AdminSetupCard
                  pool={pool}
                  isMobile={isMobile}
                  onRenew={() => setPaywallMode({ kind: 'renew', leagueId: pool.id, leagueName: pool.name, memberCount: pool.memberCount ?? 0 })}
                  onSeasonPool={() => setSeasonSettingsOpen(true)}
                  onNoSeasonPool={answerNoSeasonPool}
                  onEntryFees={() => setEntryFeesOpen(true)}
                  onPayouts={() => setPayoutPlanOpen(true)}
                  onInvite={() => setLeagueModalOpen(true)}
                />
              ) : null}
              {pool?.role === 'commissioner' ? (
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', borderRadius: 16, padding: isMobile ? '13px 14px' : '16px 18px', background: 'linear-gradient(135deg, #173b63 0%, #2f5f96 100%)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 24px rgba(23,59,99,0.25)' }}
                >
                  <div style={{ width: isMobile ? 36 : 42, height: isMobile ? 36 : 42, borderRadius: 11, background: 'rgba(255,255,255,0.16)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <BookOpen size={isMobile ? 19 : 22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 900 }}>
                      Commissioner Guide</div>
                    <div style={{ marginTop: 2, fontSize: isMobile ? 12 : 13, color: 'rgba(255,255,255,0.82)' }}>
                      How a season runs, start to finish
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ flexShrink: 0, opacity: 0.8 }} />
                </button>
              ) : null}


            {/* ── Pool Lock Time modal ─────────────────────────────────────── */}
            {poolLockModalOpen && (
              <div
                onClick={() => setPoolLockModalOpen(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 900 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(430px, calc(100vw - 32px))', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                  <div style={{ background: entriesTournamentSolid, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>Pool Lock Time</div>
                    {TOURNAMENT_TAB_LOGOS[entriesTournamentId] && (
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                        <GmpBadge height={36} />
                      </div>
                    )}
                    <button onClick={() => setPoolLockModalOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                  <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                    <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>
                      Round 1 first tee time for <b>{entriesTournament.name}</b>, in <b>Central time</b>. At exactly this moment picks lock and the standings switch to the live leaderboard.
                    </div>
                    {(() => {
                      const scheduledIso = currentTournamentMeta(entriesTournamentId)?.lockAtUtc;
                      const overrideIso = effectiveLockTime(lockTimeOverrides[entriesTournamentId], scheduledIso) === scheduledIso ? undefined : lockTimeOverrides[entriesTournamentId];
                      const effective = overrideIso ?? scheduledIso;
                      if (!effective) return null;
                      const label = new Date(effective).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                      return (
                        <div style={{ border: '1.5px solid #d1dae3', borderRadius: 10, padding: '10px 12px', background: '#f4f7fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', boxSizing: 'border-box' }}>
                          <div>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.06em' }}>Current lock time</div>
                            <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: '#0f1720', marginTop: 2 }}>{label} CST</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '4px 10px', background: overrideIso ? '#15803d' : '#1e4d8c', color: '#ffffff', flexShrink: 0, whiteSpace: 'nowrap' }}>{overrideIso ? 'Set Manually' : 'Auto set'}</span>
                        </div>
                      );
                    })()}
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.06em' }}>Set a new lock time (Central)</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="datetime-local"
                          value={poolLockInput}
                          onChange={(e) => setPoolLockInput(e.target.value)}
                          style={{ border: '1.5px solid #d1dae3', borderRadius: 10, padding: '10px 40px 10px 12px', fontSize: 14, fontWeight: 600, color: '#0f1720', width: '100%', boxSizing: 'border-box', minWidth: 0, minHeight: 44, background: '#fff', WebkitAppearance: 'none', appearance: 'none', textAlign: 'left' }}
                        />
                        {/* iOS renders no picker affordance — overlay a calendar icon so the box reads as tappable */}
                        {isMobile && (
                          <Calendar size={18} color="#5b6b79" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        )}
                      </div>
                    </label>
                    <button
                      onClick={() => void savePoolLockTime(false)}
                      disabled={!canManagePool || poolLockBusy || !poolLockInput}
                      style={{ border: 'none', borderRadius: 12, padding: '12px 16px', background: entriesTournamentSolid, color: '#fff', fontWeight: 900, cursor: (!canManagePool || poolLockBusy || !poolLockInput) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || poolLockBusy || !poolLockInput) ? 0.5 : 1 }}
                    >
                      Save lock time
                    </button>
                    {lockTimeOverrides[entriesTournamentId] && (
                      <button
                        onClick={() => void savePoolLockTime(true)}
                        disabled={!canManagePool || poolLockBusy}
                        style={{ border: '1.5px solid #d1dae3', borderRadius: 12, padding: '11px 16px', background: '#fff', color: '#374151', fontWeight: 700, cursor: (!canManagePool || poolLockBusy) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || poolLockBusy) ? 0.5 : 1 }}
                      >
                        Clear — use automatic schedule
                      </button>
                    )}
                    {poolLockMsg && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: poolLockMsg.startsWith('Saved') || poolLockMsg.startsWith('Cleared') ? '#16a34a' : '#dc2626' }}>{poolLockMsg}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* League tools, grouped in the order a season runs. */}
            {isCommissioner ? (
              <>
                {toolGroup('Members', [
                  { key: 'members', title: 'Member Management', sub: 'Everyone in the league, their picks and payments', Icon: Users, open: openMembers },
                  { key: 'invite', title: 'Invite & Leagues', sub: 'Your league code and link, or switch leagues', Icon: Layers, open: () => setLeagueModalOpen(true) },
                  { key: 'message', title: 'Message Your Pool', sub: `Tournament-week text for ${entriesTournament.name}`, Icon: MessageSquareText, open: () => setPoolMessageOpen(true) },
                ])}
                {toolGroup('Money', [
                  { key: 'entryFees', title: pool?.venmoEnabled === false ? 'Entry Fees' : <span>Entry Fees &amp; <VenmoMark tone="blue" /></span>, sub: pool?.venmoEnabled === false ? 'Fees and how members pay you' : pool?.venmo ? `Members pay ${formatVenmo(pool.venmo.handle)}` : 'Fees and who collects them', Icon: DollarSign, open: () => setEntryFeesOpen(true) },
                  { key: 'feeTracker', title: 'Entry Fee Tracker', sub: 'Who has paid, and reminders', Icon: CheckCircle2, open: () => setFeeTrackerOpen(true) },
                  { key: 'payouts', title: 'Payouts', sub: pool?.payoutPlan ? 'How the pot is split' : 'Set how the pot is split', Icon: Trophy, open: () => setPayoutPlanOpen(true) },
                  { key: 'season', title: 'Season Pool', sub: seasonPoolNow === undefined ? `Running one in ${seasonNow ?? ''}? Not set yet` : seasonPoolNow.enabled && pool?.seasonFee ? `${seasonNow} buy-in ${'$'}${pool.seasonFee}` : `No season pool in ${seasonNow ?? ''}`, Icon: Award, open: () => setSeasonSettingsOpen(true) },
                  { key: 'payWinners', title: 'Pay Winners', sub: pool?.venmoEnabled === false ? 'Mark winners paid once final' : <>Send winnings on <VenmoMark tone="blue" /> once final</>, Icon: Send, open: () => setPayWinnersOpen(true) },
                ])}
              </>
            ) : (
              toolGroup('Leagues', [
                { key: 'invite', title: 'Leagues', sub: 'Switch, join, create or invite', Icon: Layers, open: () => setLeagueModalOpen(true) },
              ])
            )}

            {/* ── Tool modal (centered) ─────────────────────────────────── */}
            {poolToolModal !== null && (
              <div
                onClick={() => { setPoolToolModal(null); setPoolToolConfirm(null); }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 900 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 40px - var(--safe-y))', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)' }}>
                  <div style={{ background: entriesTournamentSolid, borderRadius: '18px 18px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, minWidth: 0 }}>
                      {poolToolModal === 'payouts' ? 'Tournament Payouts' : poolToolModal === 'tiebreak' ? 'Tiebreak Score' : poolToolModal === 'roundLeader' ? 'Round Leader Tools' : 'Mark WD / DQ / MDF'}
                    </div>
                    {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                        <GmpBadge height={36} />
                      </div>
                    )}
                    <button onClick={() => { setPoolToolModal(null); setPoolToolConfirm(null); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                  <div style={{ padding: 20, display: 'grid', gap: 14 }}>

                    {poolToolModal === 'tiebreak' && (
                      <>
                        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>Tiebreak resolves automatically once the tournament ends. Use this override only if the winner isn&apos;t in the player pool. It applies to every league.</div>
                        {commissionerAutoDetected != null ? (
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 8, padding: '8px 12px' }}>Auto-detected: {commissionerAutoDetected} strokes</div>
                        ) : commissionerTournamentWinnerScore != null ? (
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', background: '#dbeafe', borderRadius: 8, padding: '8px 12px' }}>Manual override active: {commissionerTournamentWinnerScore} strokes</div>
                        ) : null}
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>{tiebreakResolved != null ? 'Override score' : 'Total strokes (e.g. 274)'}</span>
                          <input type="number" min="200" max="400" step="1" value={winnerScoreInput} onChange={(e) => setWinnerScoreInput(e.target.value)} placeholder="e.g. 274" style={fieldStyle()} />
                        </label>
                        <button
                          onClick={() => {
                            const score = Number(winnerScoreInput);
                            if (!Number.isFinite(score) || score < 200 || score > 400) { setCommissionerError('Enter a valid total stroke count (200–400).'); return; }
                            setPoolToolConfirm({ title: 'Save winner’s score?', message: `Set the ${commissionerTournamentLabel} tiebreak winner’s score to ${score} strokes for every league?`, confirmLabel: 'Save score', onConfirm: () => { void handleSaveWinnerScore(); setPoolToolModal(null); setPoolToolConfirm(null); } });
                          }}
                          disabled={!canManagePool || commissionerBusy || !winnerScoreInput.trim()}
                          style={{ border: 'none', borderRadius: 12, padding: '12px 16px', background: entriesTournamentSolid, color: '#fff', fontWeight: 900, cursor: (!canManagePool || commissionerBusy || !winnerScoreInput.trim()) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || commissionerBusy || !winnerScoreInput.trim()) ? 0.5 : 1 }}
                        >
                          Save score
                        </button>
                        {(commissionerError || commissionerSuccess) && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: commissionerError ? '#dc2626' : '#16a34a' }}>{commissionerError || commissionerSuccess}</div>
                        )}
                      </>
                    )}

                    {poolToolModal === 'roundLeader' && (
                      <>
                        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>If a round leader was incorrectly captured (e.g. during a suspension), clear it here. It will be re-captured automatically when the round officially ends.</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[1, 2, 3].map((rnd) => (
                            <button
                              key={rnd}
                              onClick={() => setPoolToolConfirm({ title: `Clear Round ${rnd} Leader?`, message: `This removes the Round ${rnd} leader bonus for whoever currently holds it. It will be re-captured automatically when the round officially ends.`, confirmLabel: 'Yes, clear', danger: true, onConfirm: () => { void handleClearRoundLeader(rnd); setPoolToolModal(null); setPoolToolConfirm(null); } })}
                              disabled={!canManagePool || clearLeaderBusy}
                              style={{ border: '1.5px solid #dc2626', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#dc2626', fontWeight: 800, fontSize: 13, cursor: (!canManagePool || clearLeaderBusy) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || clearLeaderBusy) ? 0.5 : 1 }}
                            >
                              Clear Rnd {rnd} Leader
                            </button>
                          ))}
                        </div>
                        {clearLeaderMsg && (<div style={{ fontSize: 13, fontWeight: 600, color: clearLeaderMsg.includes('cleared') ? '#16a34a' : '#dc2626' }}>{clearLeaderMsg}</div>)}
                      </>
                    )}

                    {poolToolModal === 'markStatus' && (
                      <>
                        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>Override the API when ESPN hasn&apos;t updated a player&apos;s status. Enter the player name as it appears in the pool (e.g. &quot;Jason Day&quot;). Accents are ignored.</div>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>Player name</span>
                          <input type="text" value={playerStatusInput} onChange={(e) => setPlayerStatusInput(e.target.value)} placeholder="e.g. Jason Day" style={fieldStyle()} />
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(['WD', 'DQ', 'MDF'] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => { const nm = playerStatusInput.trim(); if (!nm) return; const label = status === 'MDF' ? 'MDF (Made Cut, Did Not Finish)' : status; setPoolToolConfirm({ title: `Mark ${status}?`, message: `Mark "${nm}" as ${label} for ${commissionerTournamentLabel}? This overrides the ESPN data immediately.`, confirmLabel: `Mark ${status}`, danger: true, onConfirm: () => { void handleMarkPlayerStatus(status); setPoolToolModal(null); setPoolToolConfirm(null); } }); }}
                              disabled={!canManagePool || playerStatusBusy || !playerStatusInput.trim()}
                              style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: entriesTournamentSolid, color: '#fff', fontWeight: 800, fontSize: 14, cursor: (!canManagePool || playerStatusBusy || !playerStatusInput.trim()) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || playerStatusBusy || !playerStatusInput.trim()) ? 0.5 : 1 }}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                        {playerStatusMsg && (<div style={{ fontSize: 13, fontWeight: 600, color: playerStatusMsg.includes('marked') ? '#16a34a' : '#dc2626' }}>{playerStatusMsg}</div>)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Confirmation modal (on top of the tool modal) ───────────── */}
            {poolToolConfirm !== null && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1100 }} onClick={() => setPoolToolConfirm(null)}>
                <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(360px, calc(100vw - 32px))', background: '#fff', borderRadius: 18, padding: '26px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.28)', textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1720', marginBottom: 10 }}>{poolToolConfirm.title}</div>
                  <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.55, marginBottom: 22 }}>{poolToolConfirm.message}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setPoolToolConfirm(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #d1dae3', background: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                    <button onClick={() => poolToolConfirm.onConfirm()} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: entriesTournamentSolid, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{poolToolConfirm.confirmLabel}</button>
                  </div>
                </div>
              </div>
            )}

            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap', marginBottom: isMobile ? 10 : 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                  Pick Submissions
                </div>
                {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                  <TournamentWordmark id={tournament.id} alt={tournament.name} width={isMobile ? 172 : 240} height={isMobile ? 40 : 52} />
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: isMobile ? 10 : 20,
                }}
              >
                <div
                  style={{
                    flex: '1 1 0',
                    border: '1px solid #d7e0e8',
                    borderRadius: isMobile ? 12 : 20,
                    padding: isMobile ? 10 : 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: isMobile ? 6 : 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 900, color: '#0f1720' }}>Submitted Picks</div>
                    <button
                      onClick={() => setCommissionerPicksSort((s) => (s === 'alpha' ? 'newest' : 'alpha'))}
                      style={{ background: entriesTournamentSolid, border: 'none', borderRadius: 999, padding: isMobile ? '4px 9px' : '5px 12px', cursor: 'pointer', fontSize: isMobile ? 10 : 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}
                    >
                      {commissionerPicksSort === 'alpha' ? 'A–Z' : 'Newest'}
                    </button>
                  </div>
                  {submittedCommissionerMembers.length > 0 ? (
                    submittedCommissionerMembers.map((member) => (
                      <button
                        key={`submitted-${member.id}`}
                        onClick={() => setSubmittedRosterMemberId(member.id)}
                        style={{ borderRadius: 10, background: '#fff', border: 'none', padding: isMobile ? '6px 8px' : '12px 14px', color: '#0f1720', fontWeight: 700, fontSize: isMobile ? 12 : 14, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                      >
                        {member.displayName}
                      </button>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88', fontSize: isMobile ? 11 : 14 }}>No registered members have submitted picks yet.</div>
                  )}
                </div>

                <div
                  style={{
                    flex: '1 1 0',
                    border: '1px solid #d7e0e8',
                    borderRadius: isMobile ? 12 : 20,
                    padding: isMobile ? 10 : 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: isMobile ? 6 : 12,
                  }}
                >
                  <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 900, color: '#0f1720' }}>Still Need Picks</div>
                  {pendingCommissionerMembers.length > 0 ? (
                    pendingCommissionerMembers.map((member) => (
                      <div
                        key={`pending-${member.id}`}
                        style={{ borderRadius: 10, background: '#fff', padding: isMobile ? '6px 8px' : '12px 14px', color: '#0f1720', fontWeight: 700, fontSize: isMobile ? 12 : 14 }}
                      >
                        {member.displayName}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88', fontSize: isMobile ? 11 : 14 }}>Everyone with a registered account has submitted picks.</div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Pick Popularity: how many teams picked each player ── */}
            {(() => {
              const counts = new Map<number, number>();
              for (const member of commissionerMembers) {
                for (const pid of member.rosters[entriesTournamentId] ?? []) {
                  counts.set(pid, (counts.get(pid) ?? 0) + 1);
                }
              }
              const rows = [...counts.entries()]
                .map(([pid, count]) => ({ player: playersById[pid], count }))
                .filter((r): r is { player: (typeof playersById)[number]; count: number } => !!r.player)
                .sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name));
              const maxCount = rows[0]?.count ?? 0;
              return (
                <section style={{ background: '#fff', borderRadius: 24, padding: isMobile ? 14 : 22, boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)' }}>
                  <button
                    onClick={() => setPickPopularityOpen((v) => !v)}
                    style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left' }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>Pick Popularity</div>
                      <div style={{ marginTop: 2, fontSize: isMobile ? 11 : 12, color: '#8a99a6' }}>
                        {rows.length > 0 ? `${rows.length} player${rows.length === 1 ? '' : 's'} picked across ${submittedCommissionerMembers.length} submitted team${submittedCommissionerMembers.length === 1 ? '' : 's'}` : 'No picks submitted yet'}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: '#5b6b79', flexShrink: 0 }}>{pickPopularityOpen ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {pickPopularityOpen && rows.length > 0 && (
                    <div style={{ marginTop: isMobile ? 12 : 16, display: 'grid', gap: isMobile ? 7 : 8 }}>
                      {rows.map(({ player, count }) => (
                        <div key={`pop-${player.id}`} style={{ display: 'grid', gridTemplateColumns: isMobile ? '24px 108px 1fr 22px' : '28px 170px 1fr 30px', alignItems: 'center', gap: isMobile ? 6 : 10 }}>
                          <img
                            src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                            alt={player.name}
                            onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank })}
                            style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, borderRadius: '50%', objectFit: 'cover', background: '#f0f4f8', flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span
                            onClick={() => setPickPopularityPlayer({ id: player.id, name: player.name })}
                            style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          >
                            {player.name}
                          </span>
                          <div style={{ background: '#eef2f6', borderRadius: 999, height: isMobile ? 10 : 12, overflow: 'hidden' }}>
                            <div style={{ width: `${maxCount > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 0}%`, height: '100%', background: entriesTournamentSolid, borderRadius: 999 }} />
                          </div>
                          <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: entriesTournamentSolid, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── Picked-by popup: which entries selected this player ── */}
            {(() => {
              if (!pickPopularityPlayer) return null;
              const pickedBy = commissionerMembers
                .filter((m) => (m.rosters[entriesTournamentId] ?? []).includes(pickPopularityPlayer.id))
                .map((m) => m.displayName)
                .sort((a, b) => a.localeCompare(b));
              return (
                <div
                  onClick={() => setPickPopularityPlayer(null)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 150 }}
                >
                  <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(380px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 40px - var(--safe-y))', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: entriesTournamentSolid, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: 15, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickPopularityPlayer.name}</div>
                        </div>
                        {getFlagSrc(pickPopularityPlayer.name) && (() => {
                          // Long names (e.g. Bryson DeChambeau) would push an inline abbreviation off
                          // the edge — stack it under the flag for those; keep it beside the flag
                          // for everyone else. The flag always centers on the name line.
                          const stackedLabel = pickPopularityPlayer.name.length > 14;
                          return (
                            <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <img src={getFlagSrc(pickPopularityPlayer.name)} alt={getCountryLabel(pickPopularityPlayer.name)} style={{ width: 26, height: 17, objectFit: 'cover', borderRadius: 3, display: 'block' }} />
                              <span style={stackedLabel
                                ? { position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 2, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }
                                : { fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                              >{getCountryLabel(pickPopularityPlayer.name)}</span>
                            </div>
                          );
                        })()}
                      </div>
                      {TOURNAMENT_TAB_LOGOS[entriesTournamentId] && (
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                          <GmpBadge height={36} />
                        </div>
                      )}
                      <button onClick={() => setPickPopularityPlayer(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                    </div>
                    <div style={{ padding: isMobile ? 14 : 16, display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0 }}>
                      {pickedBy.length > 0 ? pickedBy.map((name) => (
                        <div key={`picked-by-${name}`} style={{ padding: '10px 14px', borderRadius: 12, background: '#f4f7fa', fontSize: 14, fontWeight: 700, color: '#0f1720' }}>
                          {name}
                        </div>
                      )) : (
                        <div style={{ color: '#6b7b88', fontSize: 13 }}>No entries have this player.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Submitted roster popup (player info popup stacks above at z 200) ── */}
            {(() => {
              if (!submittedRosterMemberId) return null;
              const member = commissionerMembers.find((m) => m.id === submittedRosterMemberId);
              if (!member) return null;
              const roster = (member.rosters[entriesTournamentId] ?? [])
                .map((id) => playersById[id])
                .filter(Boolean)
                .sort((a, b) => b.salary - a.salary);
              const leftOver = SALARY_CAP - roster.reduce((sum, p) => sum + p.salary, 0);
              return (
                <div
                  onClick={() => setSubmittedRosterMemberId(null)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.62)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 150 }}
                >
                  <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 40px - var(--safe-y))', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: entriesTournamentSolid, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, minWidth: 0 }}>{member.displayName}</div>
                      {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                          <GmpBadge height={36} />
                        </div>
                      )}
                      <button onClick={() => setSubmittedRosterMemberId(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                    </div>
                    <div style={{ padding: isMobile ? 14 : 18, display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0 }}>
                      {roster.length > 0 ? roster.map((p) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #e2e8ef', borderRadius: 12, background: '#f8fbfd', overflow: 'hidden', minHeight: isMobile ? 56 : 62 }}>
                          <div style={{ width: isMobile ? 62 : 70, flexShrink: 0, alignSelf: 'stretch', background: '#fff', overflow: 'hidden', position: 'relative' }}>
                            <img
                              src={playerPhotoSrc(p.name, p.pgaTourId, p.photoUrl)} data-fb={p.photoUrl ?? pgaPhoto(p.pgaTourId)} onError={photoOnError}
                              alt={p.name}
                              className="roster-card-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: isMobile ? '8px 12px' : '8px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: '#0f1720' }}>{p.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: p.id, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, worldRank: p.worldRank }); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }}>&#9432;</button>
                            </div>
                            <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: entriesTournamentSolid, flexShrink: 0 }}>${p.salary.toLocaleString()}</span>
                          </div>
                        </div>
                      )) : (
                        <div style={{ color: '#6b7b88', fontSize: 13 }}>No roster found for this tournament.</div>
                      )}
                      {roster.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid #e2e8ef', paddingTop: 10, marginTop: 2 }}>
                          <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: '#5b6b79' }}>Left Over: <span style={{ color: leftOver < 0 ? '#dc2626' : '#16a34a' }}>${leftOver.toLocaleString()}</span></span>
                          <button
                            onClick={() => { commissionerEditReturnRef.current = { view: commissionerConsoleView, memberId: member.id }; setSubmittedRosterMemberId(null); openCommissionerMemberPicks(member.id); }}
                            style={{ border: 'none', borderRadius: 10, padding: '9px 22px', background: entriesTournamentSolid, color: '#fff', fontWeight: 800, fontSize: isMobile ? 13 : 14, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            {isAppAdmin ? (
              <>
                <div style={{ marginTop: isMobile ? 8 : 12, fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a99a6', textAlign: 'center' }}>App admin · only you see this</div>
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? '9px 14px' : '15px 22px',
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: isAppAdmin ? (isMobile ? 6 : 14) : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Pool Status
                  </div>
                  {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                    <TournamentWordmark id={tournament.id} alt={tournament.name} width={isMobile ? 172 : 240} height={isMobile ? 40 : 52} />
                  )}
                </div>
              </div>
              {/* Data source, last sync, lineup lock and picks open/closed are the app admin's to run, so
                  only the app admin sees them. Commissioners read how picks and locking work in the guide. */}
              {isAppAdmin ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: isMobile ? 8 : 14,
                  gridAutoRows: '1fr', // equal-height rows so all four status boxes match
                }}
              >
                {/* Where scores come from and when they last synced: the app admin's concern only. */}
                {isAppAdmin ? (
                <>
                <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 12 : 18, padding: isMobile ? 10 : 16, background: '#f8fbfd', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Data source
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: isMobile ? 12 : 16 }}>
                    {/* ESPN then PGA Tour just to its right, PGA sized bigger (near-square badge vs wide ESPN).
                        Heights kept modest so this box doesn't drive the equal-height grid taller. */}
                    <img src="/espn-logo.png" alt="ESPN" style={{ height: isMobile ? 26 : 34, maxHeight: '100%', width: 'auto', objectFit: 'contain', display: 'block' }} />
                    <img src="/pga-tour-logo.png" alt="PGA Tour" style={{ height: isMobile ? 38 : 46, maxHeight: '100%', width: 'auto', objectFit: 'contain', display: 'block' }} />
                  </div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 12 : 18, padding: isMobile ? 10 : 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Last sync
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800 }}>{formatRefresh(feed?.fetchedAt ?? null).replace(/^Updated /, '')}</div>
                </div>
                </>
                ) : null}
                <button
                  onClick={isAppAdmin ? handleToggleLineupLock : undefined}
                  disabled={!isAppAdmin || commissionerBusy}
                  style={{
                    border: `1.5px solid ${locked ? '#e7a3a3' : '#a8d3ba'}`,
                    borderRadius: isMobile ? 12 : 18,
                    padding: isMobile ? 10 : 16,
                    background: locked ? '#fbf1f1' : '#f1f8f4',
                    textAlign: 'left',
                    cursor: !isAppAdmin ? 'default' : commissionerBusy ? 'not-allowed' : 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Lineup lock
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: locked ? '#c0271f' : '#1f7a46', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: isMobile ? 8 : 9, height: isMobile ? 8 : 9, borderRadius: '50%', background: locked ? '#dc2626' : '#2d7a4f', flexShrink: 0 }} />
                    {locked ? 'Locked' : 'Unlocked'}
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 11 : 13, color: '#5b6b79' }}>
                    {!isAppAdmin
                      ? (locked ? 'Picks are locked for this tournament' : 'Locks automatically at the first tee time')
                      : locked ? 'Click to unlock roster editing' : 'Click to lock roster editing'}
                  </div>
                </button>
                <button
                  onClick={isAppAdmin ? handleTogglePicksOpen : undefined}
                  disabled={!isAppAdmin || commissionerBusy}
                  style={{
                    border: `1.5px solid ${pool?.picksOpen?.[selectedTournament] ? '#a8d3ba' : '#e7a3a3'}`,
                    borderRadius: isMobile ? 12 : 18,
                    padding: isMobile ? 10 : 16,
                    background: pool?.picksOpen?.[selectedTournament] ? '#f1f8f4' : '#fbf1f1',
                    textAlign: 'left',
                    cursor: !isAppAdmin ? 'default' : commissionerBusy ? 'not-allowed' : 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Player picks
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: pool?.picksOpen?.[selectedTournament] ? '#1f7a46' : '#c0271f', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: isMobile ? 8 : 9, height: isMobile ? 8 : 9, borderRadius: '50%', background: pool?.picksOpen?.[selectedTournament] ? '#2d7a4f' : '#dc2626', flexShrink: 0 }} />
                    {pool?.picksOpen?.[selectedTournament] ? 'Open' : 'Closed'}
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 11 : 13, color: '#5b6b79' }}>
                    {!isAppAdmin
                      ? (pool?.picksOpen?.[selectedTournament] ? 'Members can make picks now' : 'Opens once the field is set')
                      : pool?.picksOpen?.[selectedTournament] ? 'Click to hide pick sheet' : 'Click to show pick sheet'}
                  </div>
                </button>
              </div>
              ) : null}

              {isAppAdmin ? (
              <>
              {/* Standings view — an independent pre-tournament / results toggle for EACH tournament,
                  since these aren't tied to the tab you're viewing. */}
              <div style={{ marginTop: isMobile ? 14 : 20 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', marginBottom: isMobile ? 8 : 10 }}>
                  Standings view — per tournament
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))', gap: isMobile ? 8 : 12 }}>
                  {(() => {
                    void preTournamentTick; // re-read module maps when any override changes
                    return TOURNAMENTS.map((t) => {
                      const isPre = shouldShowPreTournamentView(t, new Date(nowTick));
                      const busy = preTournamentBusy === t.id;
                      const logo = TOURNAMENT_TAB_LOGOS[t.id];
                      return (
                        <button
                          key={t.id}
                          onClick={() => savePreTournamentOverride(t.id, !isPre)}
                          disabled={!canManagePool || busy}
                          style={{
                            border: `1.5px solid ${isPre ? '#a9c2e0' : '#d9e2ea'}`,
                            borderRadius: isMobile ? 11 : 14,
                            padding: isMobile ? '8px 10px' : '9px 12px',
                            background: isPre ? '#eef4fb' : '#f7f9fb',
                            textAlign: 'left',
                            cursor: !canManagePool || busy ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <span style={{ width: isMobile ? 82 : 74, height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {logo && <TournamentWordmark id={t.id} alt={t.name} width={isMobile ? 82 : 74} height={40} />}
                          </span>
                          <div style={{ minWidth: 0, flex: 1, fontSize: isMobile ? 13.5 : 13, fontWeight: 800, color: isPre ? '#234d80' : '#3a4a58', display: 'flex', alignItems: 'center', gap: isMobile ? 7 : 6, whiteSpace: 'nowrap' }}>
                            <span style={{ width: isMobile ? 10 : 8, height: isMobile ? 10 : 8, borderRadius: '50%', background: isPre ? '#234d80' : '#94a3b8', flexShrink: 0 }} />
                            {isPre ? 'Pre-tournament' : 'Results'}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
              </>
              ) : null}

            </section>
                {toolGroup('App admin tools', [
                  { key: 'allLeagues', title: 'All Leagues', sub: 'Every league, its commissioner and plan', Icon: Users, open: () => setAdminLeaguesOpen(true) },
                  { key: 'salary', title: 'Full Field & Salary Pick List', sub: 'Upload full field + salaries + OWGRs', Icon: DollarSign, open: () => {}, href: '/commissioner-salary' },
                  { key: 'lock', title: 'Pool Lock Time', sub: 'Set Round 1 first tee time', Icon: Lock, open: openPoolLock },
                  { key: 'markStatus', title: 'Mark WD / DQ / MDF', sub: "Override a player's status", Icon: AlertCircle, open: () => openPoolTool('markStatus') },
                  { key: 'tiebreak', title: 'Tiebreak Score', sub: 'All leagues · only if the winner’s score didn’t fill in', Icon: Save, open: () => openPoolTool('tiebreak') },
                  { key: 'roundLeader', title: 'Round Leader Tools', sub: 'Clear a mis-captured round leader', Icon: RefreshCw, open: () => openPoolTool('roundLeader') },
                  ...(isCommissioner ? [] : [{ key: 'members', title: 'Member Management', sub: 'Everyone in the league', Icon: Users, open: openMembers }]),
                ])}
              </>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={authBusy}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', maxWidth: 320, border: '1px solid #d7e0e8', borderRadius: 14, padding: '12px 16px', background: '#fff', color: '#0f1720', fontWeight: 800, fontSize: 15, cursor: authBusy ? 'wait' : 'pointer', opacity: authBusy ? 0.6 : 1, boxShadow: '0 6px 16px rgba(9, 34, 51, 0.06)' }}
              >
                <LogOut size={17} /> Sign out
              </button>
            </div>
              </>
            ) : commissionerConsoleView === 'members' ? (
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'grid',
                gap: isMobile ? 10 : 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 10 : 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                  <button
                    onClick={() => { setCommissionerConsoleView('dashboard'); setShowAddMemberForm(false); }}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 999,
                      background: '#fff',
                      width: isMobile ? 32 : 44,
                      height: isMobile ? 32 : 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <ArrowLeft size={isMobile ? 14 : 20} />
                  </button>
                  <div>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 34, color: '#0f1720' }}>Member Management</h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMemberForm((current) => !current)}
                  style={{
                    border: 'none',
                    borderRadius: 14,
                    padding: isMobile ? '8px 12px' : '12px 18px',
                    background: entriesTournamentSolid,
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: isMobile ? 12 : 14,
                    cursor: 'pointer',
                  }}
                >
                  {showAddMemberForm ? 'Close Add Members' : 'Add Members'}
                </button>
              </div>

              {showAddMemberForm ? (
                <div
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 20,
                    padding: 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720' }}>Add a new member</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <input
                      value={memberCreateForm.displayName}
                      onChange={(event) => setMemberCreateForm({ ...memberCreateForm, displayName: event.target.value })}
                      placeholder="Display name"
                      style={fieldStyle()}
                    />
                    <input
                      value={memberCreateForm.email}
                      onChange={(event) => setMemberCreateForm({ ...memberCreateForm, email: event.target.value })}
                      placeholder="Email"
                      style={fieldStyle()}
                    />
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showMemberPassword ? 'text' : 'password'}
                        value={memberCreateForm.password}
                        onChange={(event) => setMemberCreateForm({ ...memberCreateForm, password: event.target.value })}
                        placeholder="Password"
                        style={{ ...fieldStyle(), paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowMemberPassword((v) => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7b88', display: 'flex', alignItems: 'center' }}
                      >
                        {showMemberPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={handleCreateMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentSolid,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Create member
                    </button>
                  </div>
                </div>
              ) : null}

              {commissionerError ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 16,
                    background: '#fff5f5',
                    color: '#a61b1b',
                    border: '1px solid #fecaca',
                    padding: '14px 16px',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{commissionerError}</span>
                </div>
              ) : null}

              {commissionerSuccess ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 16,
                    background: '#eef4ff',
                    color: '#2f5f96',
                    border: '1px solid #c7d8ee',
                    padding: '14px 16px',
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{commissionerSuccess}</span>
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 8 : 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: '#31424f' }}>
                  {commissionerMembers.length} Active Members
                </div>
                <div
                  style={{
                    minWidth: isMobile ? 0 : 280,
                    maxWidth: 360,
                    flex: isMobile ? '1 1 auto' : '1 1 280px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #d7e0e8',
                    borderRadius: 12,
                    background: '#fff',
                    padding: isMobile ? '8px 10px' : '12px 14px',
                  }}
                >
                  <Search size={isMobile ? 14 : 18} color="#6b7b88" />
                  <input
                    value={commissionerMemberSearch}
                    onChange={(event) => setCommissionerMemberSearch(event.target.value)}
                    placeholder="Search"
                    style={{ ...fieldStyle(), border: 'none', outline: 'none', padding: 0, fontSize: isMobile ? 16 : 15 }}
                  />
                  {commissionerMemberSearch && (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setCommissionerMemberSearch(''); }}
                      style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                      aria-label="Clear search"
                    >
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 14 : 22, overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', background: '#fff' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '140px 190px 100px 46px' : 'minmax(220px, 1.1fr) minmax(260px, 1.25fr) minmax(180px, 0.8fr) 90px',
                    gap: isMobile ? 8 : 16,
                    padding: isMobile ? '8px 12px' : '18px 22px',
                    background: '#f8fbfd',
                    color: '#5b6b79',
                    fontSize: isMobile ? 10 : 13,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  {(['displayName', 'email'] as const).map((col) => (
                    <div
                      key={col}
                      style={{
                        display: 'flex',
                        justifyContent: (!isMobile && col === 'email') ? 'center' : 'flex-start',
                        ...(isMobile && col === 'displayName' ? { position: 'sticky', left: 0, background: '#f8fbfd', zIndex: 2 } : {}),
                      }}
                    >
                      <button
                        onClick={() => setCommissionerMemberSort((prev) => ({
                          column: col,
                          direction: prev.column === col && prev.direction === 'asc' ? 'desc' : 'asc',
                        }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#5b6b79', fontSize: isMobile ? 10 : 13, fontWeight: 800, textTransform: 'uppercase' }}
                      >
                        {col === 'displayName' ? 'Display Name' : 'Email'}
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 1 }}>
                          <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === col && commissionerMemberSort.direction === 'asc' ? 1 : 0.3 }}>▲</span>
                          <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === col && commissionerMemberSort.direction === 'desc' ? 1 : 0.3 }}>▼</span>
                        </span>
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => setCommissionerMemberSort((prev) => ({
                        column: 'tournamentCount',
                        direction: prev.column === 'tournamentCount' && prev.direction === 'asc' ? 'desc' : 'asc',
                      }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#5b6b79', fontSize: isMobile ? 9 : 13, fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}
                    >
                      # of Tourn. Submitted Picks
                      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 1 }}>
                        <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === 'tournamentCount' && commissionerMemberSort.direction === 'asc' ? 1 : 0.3 }}>▲</span>
                        <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === 'tournamentCount' && commissionerMemberSort.direction === 'desc' ? 1 : 0.3 }}>▼</span>
                      </span>
                    </button>
                  </div>
                  <div style={{ textAlign: 'center', ...(isMobile ? { position: 'sticky', right: 0, background: '#f8fbfd', zIndex: 2 } : {}) }}>Edit</div>
                </div>

                {commissionerBusy && commissionerMembers.length === 0 ? (
                  <div style={{ padding: isMobile ? 14 : 24, color: '#6b7b88', fontSize: isMobile ? 12 : 14 }}>Loading members...</div>
                ) : filteredCommissionerMembers.length === 0 ? (
                  <div style={{ padding: isMobile ? 14 : 24, color: '#6b7b88', fontSize: isMobile ? 12 : 14 }}>No members matched your search.</div>
                ) : (
                  filteredCommissionerMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '140px 190px 100px 46px' : 'minmax(220px, 1.1fr) minmax(260px, 1.25fr) minmax(180px, 0.8fr) 90px',
                        gap: isMobile ? 8 : 16,
                        padding: isMobile ? '10px 12px' : '20px 22px',
                        borderTop: '1px solid #e6edf1',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 800, color: '#0f1720', display: 'flex', alignItems: 'center', gap: 6, ...(isMobile ? { position: 'sticky', left: 0, background: '#fff', zIndex: 1, paddingRight: 4 } : {}) }}>
                        {member.displayName}
                        {(pool?.commissioners ?? []).some((c) => c.id === member.id) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#2d5e94', color: '#fff', borderRadius: 4, width: isMobile ? 16 : 20, height: isMobile ? 16 : 20, fontSize: isMobile ? 10 : 12, fontWeight: 900, flexShrink: 0 }}>C</span>
                        )}
                      </div>
                      <div style={{ fontSize: isMobile ? 11 : 15, color: '#31424f', textAlign: isMobile ? 'left' : 'center' }}>{member.email}</div>
                      <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: '#0f1720', textAlign: 'center' }}>
                        {TOURNAMENTS.filter((event) => (member.rosters[event.id] ?? []).length > 0).length}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', ...(isMobile ? { position: 'sticky', right: 0, background: '#fff', zIndex: 1 } : {}) }}>
                        <button
                          onClick={() => openCommissionerMemberModal(member.id)}
                          style={{
                            border: '1px solid #d7e0e8',
                            borderRadius: isMobile ? 10 : 14,
                            background: '#fff',
                            width: isMobile ? 34 : 48,
                            height: isMobile ? 34 : 48,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            ) : commissionerConsoleView === 'member-picks' ? (
            <section
              style={{
                background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'grid',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const ret = commissionerEditReturnRef.current;
                    commissionerEditReturnRef.current = null;
                    setCommissionerConsoleView(ret ? ret.view : 'members');
                    if (ret) setSubmittedRosterMemberId(ret.memberId);
                    setCommissionerRosterMemberId(null);
                  }}
                  style={{
                    border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: entriesTournamentId === 'open' ? headerSolid : '#fff',
                    color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 28, color: '#0f1720' }}>
                  Pick Sheet for {commissionerRosterMember?.displayName ?? 'Member'}
                </h2>
              </div>

              <div
                style={{
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
                          value={commissionerPlayerSearch}
                          onChange={(event) => setCommissionerPlayerSearch(event.target.value)}
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
                        {commissionerPlayerSearch && (
                          <button
                            onMouseDown={(e) => { e.preventDefault(); setCommissionerPlayerSearch(''); }}
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
                      {filteredCommissionerPlayers.map((player) => {
                        const isDisabled = commissionerRosterSelection.length >= REQUIRED_GOLFERS || player.salary > commissionerSalaryRemaining;

                        return (
                          <div
                            key={`commissioner-player-${player.id}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px',
                              padding: isMobile ? '11px 12px' : '15px 20px',
                              borderBottom: entriesTournamentId === 'open' ? '1px solid rgba(0,0,0,0.12)' : '1px solid #e6edf1',
                              alignItems: 'center',
                              opacity: isDisabled ? 0.45 : 1,
                              background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                            }}
                          >
                            <div style={{ fontSize: isMobile ? 13 : 17, color: '#0f1720', textAlign: 'center' }}>{player.worldRank}</div>
                            <div onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season')} style={{ fontSize: isMobile ? 13 : 17, fontWeight: 600, color: '#0f1720', paddingLeft: isMobile ? 8 : 12, cursor: 'pointer' }}>
                              {(() => { const customSplit = isMobile ? MOBILE_CUSTOM_SPLITS[player.name] : undefined; const parts = player.name.split(' '); const first = customSplit ? customSplit[0] : parts.slice(0, -1).join(' '); const last = customSplit ? customSplit[1] : parts[parts.length - 1]; const forcedBreak = isMobile && MOBILE_TWO_LINE_NAMES.has(player.name); const infoBtn = <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season'); }} style={{ width: isMobile ? 11 : 15, height: isMobile ? 11 : 15, borderRadius: '50%', border: `${isMobile ? 1 : 1.5}px solid ${entriesTournamentId === 'open' ? '#000000' : '#9ca3af'}`, background: 'transparent', color: entriesTournamentId === 'open' ? '#000000' : '#9ca3af', fontSize: isMobile ? 7 : 9, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, touchAction: 'manipulation', verticalAlign: 'middle', marginLeft: isMobile ? 3 : 5, flexShrink: 0 }} aria-label={`View ${player.name} stats`}>i</button>; return (<>{first}{forcedBreak ? <br /> : (first ? ' ' : '')}<span style={{ whiteSpace: 'nowrap' }}>{last}{infoBtn}</span></>); })()}
                            </div>
                            <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, color: '#0f1720' }}>${player.salary.toLocaleString()}</div>
                            <button
                              onClick={() => toggleCommissionerRosterPlayer(player.id)}
                              disabled={isDisabled}
                              style={{
                                width: isMobile ? 34 : 42,
                                height: isMobile ? 34 : 42,
                                borderRadius: 10,
                                border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7dee6',
                                background: entriesTournamentId === 'open' ? headerSolid : '#fff',
                                color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                                fontSize: isMobile ? 20 : 24,
                                fontWeight: 400,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
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
                    <div style={{ marginTop: 2, fontSize: isMobile ? 30 : 34, fontWeight: 900, color: '#1f8d4e' }}>${commissionerSalaryRemaining.toLocaleString()}</div>
                    <div style={{ marginTop: isMobile ? 8 : 4, fontSize: isMobile ? 12 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#31424f' }}>
                      Avg Rem./Player: ${commissionerAverageRemainingPerPlayer.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    <div style={{ fontSize: isMobile ? 12 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#607282', marginTop: -4 }}>
                      Click the plus sign to add a golfer or the minus sign to remove them.
                    </div>

                    {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => {
                      const golfer = commissionerOrderedRosterPlayers[index];
                      return (
                        <div
                          key={`commissioner-roster-slot-${index}`}
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
                                    onClick={() => toggleCommissionerRosterPlayer(golfer.id)}
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
                      value={commissionerTieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setCommissionerTieBreakInput(val);
                      }}
                      placeholder={`Enter tiebreak value* (Par = ${totalParFor(selectedTournament) ?? '?'})`}
                      inputMode="numeric"
                      maxLength={3}
                      style={{ ...fieldStyle(), marginTop: 4 }}
                    />

                    <button
                      onClick={handleSaveCommissionerRoster}
                      disabled={!canSaveCommissionerRoster || commissionerBusy}
                      style={{
                        marginTop: 4,
                        width: 'fit-content',
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 18px',
                        background: canSaveCommissionerRoster ? entriesTournamentBg : '#f2f4f6',
                        color: canSaveCommissionerRoster ? '#fff' : '#98a3ad',
                        boxShadow: 'none',
                        fontWeight: 900,
                        cursor: !canSaveCommissionerRoster || commissionerBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Submit Roster
                    </button>

                    <div style={{ fontSize: 13, color: entriesTournamentId === 'open' ? '#000000' : '#607282', marginTop: 4 }}>
                      * - The tiebreak value is your predicted total score for the winning golfer of this tournament. Use their total strokes, NOT score to par. Example: Enter {(totalParFor(entriesTournamentId) ?? 288) - 14} (NOT -14)
                    </div>
                  </div>
                </div>
              </div>
            </section>
            ) : null}
          </main>
  );
}
