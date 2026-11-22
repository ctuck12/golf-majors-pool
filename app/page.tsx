'use client';

// Inside the iPhone app, sends this page's /api calls to the live site (no-op on the web).
import { settleViewAfterKeyboard } from './native-bridge';
import { LeagueGate, LeagueModal } from './league-panel';
import { PaywallModal } from './paywall';
import { VenmoSetupStep, VerifyEmailGate } from './onboarding';
import { AdminLeaguesModal } from './admin-leagues';
import { VenmoMark } from './venmo-mark';
import { PoolMessageModal } from './pool-message';
import { PayoutPlanModal } from './payout-plan-ui';
import { CommissionerGuide } from './commissioner-guide';
import { PushPrompt } from './push-client';
import { EntryFeeTracker } from './entry-fee-tracker';
import { SeasonSettingsModal } from './season-settings';
import { currentTournamentMeta, effectiveLockTime } from '@/app/lib/tournament-config';
import { EntryFeesModal, PayWinnersModal, VenmoFallbackNotice, VenmoModal, VenmoPrompt } from './venmo-ui';
import { formatVenmo } from '@/app/lib/venmo';
import { AlertCircle, CircleUserRound, CheckCircle2, ChevronDown, Eye, EyeOff, LogIn, UserPlus, } from 'lucide-react';
import { REGISTRATION_OPEN, SALARY_CAP, REQUIRED_GOLFERS, TOURNAMENTS, TOURNAMENT_TAB_LOGOS, TOURNAMENT_TAB_WORDMARKS, KNOCKOUT_TAB_LOGOS, TOURNAMENT_TAB_LOGO_HEIGHTS, TOURNAMENT_CARD_WIDTH, TOURNAMENT_CARD_HEIGHT, MAIN_TABS, REPORT_OPTIONS, REPORT_TOURNAMENT_SOLID, NO_SESSION_FLAGS, clearStoredMainTab, clearStoredSession, fieldStyle, type TournamentId, type ReportType, type PoolInfo, type SessionPayload } from './pool-data';
import { usePoolPage } from './pool-page-state';
import { DetailsScreen } from './screens/details-screen';
import { ReportsScreen } from './screens/reports-screen';
import { MyEntryScreen } from './screens/my-entry-screen';
import { CommissionerScreen } from './screens/commissioner-screen';
import { StandingsScreen } from './screens/standings-screen';
import { PlayerInfoPopup } from './popups/player-info-popup';
import { MemberEditModal } from './popups/member-edit-modal';
import { BonusPointsPopup } from './popups/bonus-points-popup';
import { EntryBreakdownPopup } from './popups/entry-breakdown-popup';
import { ScorecardPopup } from './popups/scorecard-popup';
import { RosterConfirmPopup } from './popups/roster-confirm-popup';
import { CutScorecardPopup } from './popups/cut-scorecard-popup';
import { PreviousRoundsPopup } from './popups/previous-rounds-popup';
import { GolferBreakdownPopup } from './popups/golfer-breakdown-popup';
import { StatLeaderboardPopup } from './popups/stat-leaderboard-popup';
import { HistoryRosterPopup } from './popups/history-roster-popup';
import { PointsSystemPopup } from './popups/points-system-popup';
import { WinsListPopup } from './popups/wins-list-popup';
import { PickSummaryPlayerPopup } from './popups/pick-summary-player-popup';
import { PickedByPopup } from './popups/picked-by-popup';
import { TournamentWordmark } from './tournament-wordmark';

// How each event reads in "It's ___ week!".
const WEEK_NAMES: Record<TournamentId, string> = {
  players: 'Players Championship',
  masters: 'Masters',
  pga: 'PGA Championship',
  'us-open': 'U.S. Open',
  open: 'Open Championship',
};

// The app's one page. Its state and logic live in usePoolPage() (app/pool-page-state.tsx).
export default function Page() {
  const p = usePoolPage();
  const {
    mainTab,
    setMainTab,
    selectedTournament,
    setSelectedTournament,
    scorecardGolferName,
    scorecardData,
    showPreviousRounds,
    showBonusPoints,
    showTiebreakerRules,
    setShowTiebreakerRules,
    historyPopup,
    historyRoster,
    reportsMenuOpen,
    setReportsMenuOpen,
    reportsMenuRect,
    setReportsMenuRect,
    selectedReport,
    setSelectedReport,
    ppsPickPopup,
    ppsAllPlayerPopup,
    cutScorecardGolfer,
    showPointsSystem,
    setSelectedLeaderboardPlayerId,
    setLeaderboardSearch,
    setLeaderboardViewMode,
    pickHistoryPlayerPopup,
    winsListPopup,
    statLeaderboardModal,
    setLeaderboardSortMode,
    setLeaderboardPickedSort,
    setShowCutInfo,
    showHeaderCutInfo,
    setShowHeaderCutInfo,
    error,
    setFeedRefreshNonce,
    sessionUser,
    setSessionUser,
    pool,
    setPool,
    sessionFlags,
    setSessionFlags,
    leagueModalOpen,
    setLeagueModalOpen,
    paywallMode,
    setPaywallMode,
    pendingJoinCode,
    setPendingJoinCode,
    poolEntries,
    setPoolEntries,
    sessionLoading,
    authBusy,
    authError,
    setAuthError,
    loginForm,
    setLoginForm,
    authMode,
    setAuthMode,
    forgotOpen,
    setForgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotEmailExists,
    setForgotEmailExists,
    forgotNewPassword,
    setForgotNewPassword,
    showForgotNewPassword,
    setShowForgotNewPassword,
    forgotBusy,
    setForgotBusy,
    forgotMessage,
    setForgotMessage,
    forgotSent,
    setForgotSent,
    resetToken,
    setResetToken,
    registerForm,
    setRegisterForm,
    showRosterConfirm,
    showSubmitToast,
    venmoModalOpen,
    setVenmoModalOpen,
    showVenmoSetup,
    setShowVenmoSetup,
    entryFeesOpen,
    setEntryFeesOpen,
    adminLeaguesOpen,
    setAdminLeaguesOpen,
    payWinnersOpen,
    setPayWinnersOpen,
    poolMessageOpen,
    setPoolMessageOpen,
    payoutPlanOpen,
    setPayoutPlanOpen,
    guideOpen,
    setGuideOpen,
    feeTrackerOpen,
    setFeeTrackerOpen,
    seasonSettingsOpen,
    setSeasonSettingsOpen,
    lockTimeOverrides,
    venmoFallbackUrl,
    setVenmoFallbackUrl,
    showSubmittedPicksPopup,
    setShowSubmittedPicksPopup,
    submittedPicksSort,
    setSubmittedPicksSort,
    commissionerMemberModalOpen,
    accountMenuOpen,
    setAccountMenuOpen,
    accountPreferencesView,
    setAccountPreferencesView,
    accountPassword,
    setAccountPassword,
    showAccountPassword,
    setShowAccountPassword,
    showAuthPassword,
    setShowAuthPassword,
    accountDisplayName,
    setAccountDisplayName,
    accountBusy,
    accountMessage,
    setAccountMessage,
    isMobile,
    landscapeZoom,
    isAppAdmin,
    needsEmailCode,
    canManagePool,
    isFounderPool,
    entriesTournamentId,
    selectedTournamentPayouts,
    applySession,
    refreshCurrentSession,
    handleRegister,
    handleLogin,
    handleLogout,
    handleUpdateOwnPassword,
    handleUpdateOwnDisplayName,
    selectedCommissionerMember,
    paysEntryFeeInApp,
    submittedEntries,
    isTournamentFinal,
    standings,
    activeStandingEntry,
    activeStandingGolfer,
    handleMainTabChange,
    headerBg,
    headerSolid,
    entriesTournamentBg,
    headerTabActiveColor,
  } = p;


  if (sessionLoading && !sessionUser) {
    return (
      <div
        style={{
          minHeight: '100svh',
          background:
            'radial-gradient(circle at top left, rgba(72, 126, 196, 0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3fb 100%)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '12px 10px 32px' : '32px 20px 40px' }}>
          <header
            style={{
              background: headerBg,
              color: '#fff',
              borderRadius: 28,
              padding: isMobile ? '10px 12px' : '10px 28px',
              boxShadow: '0 24px 64px rgba(9, 34, 51, 0.18)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src="/golf-majors-pool-logo-v11.png"
                alt="Golf Majors Pool"
                style={{
                  display: 'block',
                  width: isMobile ? 'min(100%, 260px)' : 'min(100%, 380px)',
                  height: 'auto',
                  objectFit: 'contain',
                  background: 'transparent',
                }}
              />
            </div>
          </header>
          <section
            style={{
              marginTop: 24,
              background: '#fff',
              borderRadius: 24,
              padding: isMobile ? 24 : 32,
              boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              textAlign: 'center',
              color: '#5b6b79',
              fontWeight: 800,
            }}
          >
            Loading your pool...
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        background:
          'radial-gradient(circle at top left, rgba(72, 126, 196, 0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3fb 100%)',
        zoom: landscapeZoom,
      }}
    >
      {showHeaderCutInfo && <div onClick={() => setShowHeaderCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '2px 10px 32px' : '32px 20px 40px' }}>
        <header
          style={{
            background: headerBg,
            color: '#fff',
            borderRadius: 28,
            padding: isMobile ? (sessionUser ? '0px 12px 2px' : '2px 12px') : (sessionUser ? '10px 28px 6px' : '10px 28px'),
            boxShadow: '0 24px 64px rgba(9, 34, 51, 0.18)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src="/golf-majors-pool-logo-v11.png"
              alt="Golf Majors Pool"
              style={{
                display: 'block',
                width: isMobile ? 'min(100%, 278px)' : 'min(100%, 380px)',
                height: 'auto',
                objectFit: 'contain',
                background: 'transparent',
                marginTop: isMobile ? -12 : 0,
                marginBottom: isMobile ? -18 : 0,
              }}
            />
          </div>

          {/* No tabs until the user is in a league (the join gate is all there is to do). */}
          {sessionUser && (pool || sessionLoading) ? (
            <div
              style={{
                marginTop: 0,
                paddingTop: 2,
                borderTop: '1px solid rgba(112, 202, 220, 0.18)',
                display: 'flex',
                justifyContent: (isMobile && canManagePool) ? 'flex-start' : 'center',
                gap: isMobile ? 0 : 4,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                paddingLeft: isMobile ? 4 : 32,
                paddingRight: isMobile ? 4 : 32,
                paddingBottom: 2,
              }}
            >
              {MAIN_TABS
                .filter((tab) => tab !== 'Commissioner Hub' || canManagePool)
                .map((tab) => {
                  const active = tab === mainTab;
                  if (tab === 'Reports') {
                    return (
                      <button
                        key={tab}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setReportsMenuRect({ left: r.left, top: r.bottom, width: r.width });
                          setReportsMenuOpen((open) => !open);
                        }}
                        style={{
                          border: 'none',
                          borderBottom: active ? `3px solid ${headerTabActiveColor}` : '3px solid transparent',
                          background: 'transparent',
                          color: active ? headerTabActiveColor : '#ffffff',
                          padding: isMobile ? '6px 10px 8px' : '7px 12px 9px',
                          fontSize: isMobile ? 13 : 15,
                          fontWeight: 800,
                          cursor: 'pointer',
                          lineHeight: 1.1,
                          whiteSpace: 'nowrap',
                          flex: '0 0 auto',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        Reports
                        <ChevronDown size={isMobile ? 13 : 15} style={{ transform: reportsMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={tab}
                      onClick={() => handleMainTabChange(tab, { refreshAfterChange: true })}
                      style={{
                        border: 'none',
                        borderBottom: active ? `3px solid ${headerTabActiveColor}` : '3px solid transparent',
                        background: 'transparent',
                        color: active ? headerTabActiveColor : '#ffffff',
                        padding: isMobile ? '6px 10px 8px' : '7px 12px 9px',
                        fontSize: isMobile ? 13 : 15,
                        fontWeight: 800,
                        cursor: 'pointer',
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        flex: '0 0 auto',
                      }}
                    >
                      {tab === 'My Entries' ? 'My Entry' : tab === 'Commissioner Hub' ? 'Admin' : tab}
                    </button>
                  );
                })}
            </div>
          ) : null}

          {sessionUser && !canManagePool ? (
            <div style={{ position: 'absolute', right: isMobile ? 10 : 22, bottom: isMobile ? 6 : 6, zIndex: 30 }}>
              {accountMenuOpen ? (
                <button
                  type="button"
                  aria-label="Close account menu"
                  onClick={() => setAccountMenuOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'default',
                    padding: 0,
                    margin: 0,
                    zIndex: 10,
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none',
                  }}
                />
              ) : null}

              <button
                onClick={() => {
                  setAccountMenuOpen((current) => !current);
                  setAccountMessage('');
                  setAccountPreferencesView('root');
                  setAccountPassword('');
                  setAccountDisplayName(sessionUser.displayName);
                }}
                style={{
                  position: 'relative',
                  zIndex: 20,
                  width: (isMobile && !canManagePool) ? 34 : 42,
                  height: (isMobile && !canManagePool) ? 34 : 42,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: '#173b63',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CircleUserRound size={(isMobile && !canManagePool) ? 17 : 20} />
              </button>

              {accountMenuOpen ? (
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: isMobile ? 'fixed' : 'absolute',
                    right: isMobile ? 10 : 0,
                    top: isMobile ? 100 : 'auto',
                    bottom: isMobile ? 'auto' : 54,
                    width: isMobile ? 270 : 336,
                    borderRadius: 18,
                    background: '#fff',
                    color: '#0f1720',
                    padding: isMobile ? 12 : 16,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.22)',
                    zIndex: 20,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Account
                  </div>
                  <div style={{ marginTop: 6, fontSize: isMobile ? 16 : 20, fontWeight: 900 }}>{sessionUser.displayName}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>{sessionUser.email}</div>
                  {pool ? (
                    <div style={{ marginTop: 6, fontSize: 13, color: '#3d4b58' }}>
                      League: <span style={{ fontWeight: 800, color: '#173b63' }}>{pool.name}</span>
                    </div>
                  ) : null}
                  {accountPreferencesView === 'root' ? (
                    <button
                      type="button"
                      onClick={() => { setAccountMenuOpen(false); setVenmoModalOpen(true); }}
                      style={{ marginTop: 8, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#008CFF', textAlign: 'left' }}
                    >
                      {sessionUser.venmo
                        ? <><VenmoMark tone="blue" /> {formatVenmo(sessionUser.venmo)} · Edit</>
                        : <>+ Add your <VenmoMark tone="blue" /></>}
                    </button>
                  ) : null}

                  {accountPreferencesView === 'password' ? (
                    <div style={{ position: 'relative', marginTop: 14 }}>
                      <input
                        type={showAccountPassword ? 'text' : 'password'}
                        value={accountPassword}
                        onChange={(event) => setAccountPassword(event.target.value)}
                        placeholder="New password"
                        style={{ ...fieldStyle(), marginTop: 0, paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccountPassword((v) => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7b88', display: 'flex', alignItems: 'center' }}
                      >
                        {showAccountPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  ) : null}

                  {accountPreferencesView === 'displayName' ? (
                    <input
                      value={accountDisplayName}
                      onChange={(event) => setAccountDisplayName(event.target.value)}
                      placeholder="Display name"
                      style={{ ...fieldStyle(), marginTop: 14 }}
                    />
                  ) : null}

                  {accountMessage ? (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color:
                          accountMessage === 'Password updated.' || accountMessage === 'Display name updated.'
                            ? '#2f5f96'
                            : '#a61b1b',
                      }}
                    >
                      {accountMessage}
                    </div>
                  ) : null}
                  <div style={{ marginTop: isMobile ? 10 : 14, display: 'flex', gap: 8 }}>
                    {accountPreferencesView === 'root' ? (
                      <button
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setLeagueModalOpen(true);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: '1px solid #d7e0e8',
                          borderRadius: 12,
                          padding: isMobile ? '11px 6px' : '12px 14px',
                          fontSize: isMobile ? 13.5 : 15,
                          background: '#fff',
                          color: '#0f1720',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Leagues
                      </button>
                    ) : null}
                    {accountPreferencesView === 'root' ? (
                      <button
                        onClick={() => {
                          setAccountPreferencesView('preferences');
                          setAccountMessage('');
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: isMobile ? '11px 6px' : '12px 14px',
                          fontSize: isMobile ? 13.5 : 15,
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {isMobile ? 'Settings' : 'Preferences'}
                      </button>
                    ) : null}

                    {accountPreferencesView === 'preferences' ? (
                      <>
                        <button
                          onClick={() => {
                            setAccountPreferencesView('password');
                            setAccountMessage('');
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: 'none',
                            borderRadius: 12,
                            padding: '12px 14px',
                            background: '#173b63',
                            color: '#fff',
                            fontWeight: 800,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span>Change</span>
                          <span>Password</span>
                        </button>
                        <button
                          onClick={() => {
                            setAccountPreferencesView('displayName');
                            setAccountMessage('');
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: '1px solid #d7e0e8',
                            borderRadius: 12,
                            padding: '12px 14px',
                            background: '#fff',
                            color: '#0f1720',
                            fontWeight: 800,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span>Edit</span>
                          <span>Display Name</span>
                        </button>
                      </>
                    ) : null}

                    {accountPreferencesView === 'password' ? (
                      <button
                        onClick={handleUpdateOwnPassword}
                        disabled={accountBusy}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Password
                      </button>
                    ) : null}

                    {accountPreferencesView === 'displayName' ? (
                      <button
                        onClick={handleUpdateOwnDisplayName}
                        disabled={accountBusy}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Name
                      </button>
                    ) : null}

                    <button
                      onClick={handleLogout}
                      disabled={authBusy}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: '1px solid #d7e0e8',
                        borderRadius: 12,
                        padding: isMobile ? '11px 6px' : '12px 14px',
                        fontSize: isMobile ? 13.5 : 15,
                        whiteSpace: 'nowrap',
                        background: '#fff',
                        color: '#0f1720',
                        fontWeight: 800,
                        cursor: authBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        {!sessionUser ? (
          <section
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 'min(480px, calc(100vw - 48px))',
                minHeight: 344,
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {authMode === 'login' ? <LogIn size={18} color="#2f5f96" /> : <UserPlus size={18} color="#2f5f96" />}
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </div>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); authMode === 'login' ? handleLogin() : handleRegister(); }}
                style={{ display: 'grid', gap: 12, flex: 1 }}
              >
                {authMode === 'register' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input
                      value={registerForm.firstName}
                      onChange={(event) => setRegisterForm({ ...registerForm, firstName: event.target.value })}
                      placeholder="First name"
                      autoComplete="given-name"
                      style={{ ...fieldStyle(), minWidth: 0 }}
                    />
                    <input
                      value={registerForm.lastName}
                      onChange={(event) => setRegisterForm({ ...registerForm, lastName: event.target.value })}
                      placeholder="Last name"
                      autoComplete="family-name"
                      style={{ ...fieldStyle(), minWidth: 0 }}
                    />
                  </div>
                ) : null}

                <input
                  value={authMode === 'login' ? loginForm.email : registerForm.email}
                  onChange={(event) =>
                    authMode === 'login'
                      ? setLoginForm({ ...loginForm, email: event.target.value })
                      : setRegisterForm({ ...registerForm, email: event.target.value })
                  }
                  placeholder="Email"
                  style={fieldStyle()}
                />
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: 14, border: '1px solid #d7e0e8', background: '#fff' }}>
                  <input
                    type={showAuthPassword ? 'text' : 'password'}
                    value={authMode === 'login' ? loginForm.password : registerForm.password}
                    onChange={(event) =>
                      authMode === 'login'
                        ? setLoginForm({ ...loginForm, password: event.target.value })
                        : setRegisterForm({ ...registerForm, password: event.target.value })
                    }
                    placeholder="Password"
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: 15, background: 'transparent', minWidth: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((v) => !v)}
                    style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7b88', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    {showAuthPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {authMode === 'register' ? (
                  <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#5b6b79' }}>League code (from your commissioner&apos;s invite)</span>
                  <input
                    value={registerForm.joinCode}
                    onChange={(event) => setRegisterForm({ ...registerForm, joinCode: event.target.value.toUpperCase() })}
                    placeholder="League code (optional)"
                    autoCapitalize="characters"
                    autoComplete="off"
                    style={fieldStyle()}
                  />
                  </label>
                ) : null}
                <button
                  type="submit"
                  style={{
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: headerSolid,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: authBusy ? 'wait' : 'pointer',
                  }}
                  disabled={authBusy}
                >
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
                {authMode === 'register' ? (
                  <div style={{ fontSize: 12, color: '#6b7b88', lineHeight: 1.45, textAlign: 'center' }}>
                    By creating an account you agree to the{' '}
                    <a href="https://golfmajorspool.com/terms.html" target="_blank" rel="noreferrer" style={{ color: '#2f5f96' }}>Terms of Use</a>
                    {' '}and{' '}
                    <a href="https://golfmajorspool.com/privacy.html" target="_blank" rel="noreferrer" style={{ color: '#2f5f96' }}>Privacy Policy</a>, and confirm you&apos;re 18 or older.
                  </div>
                ) : null}
              </form>

              {authMode === 'register' && (
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  style={{ marginTop: 14, border: 'none', background: 'transparent', color: '#2f5f96', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Already have an account? Click here to sign in
                </button>
              )}

              {authMode === 'login' && (
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: '#2f5f96', display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotEmail('');
                      setForgotEmailExists(false);
                      setForgotNewPassword('');
                      setForgotMessage('');
                      setForgotSent(false);
                      setResetToken(null);
                      setShowForgotNewPassword(false);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2f5f96', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}
                  >
                    Forgot Password?
                  </button>
                  {REGISTRATION_OPEN && (
                    <>
                      <span style={{ color: '#5b6b79' }}>or sign up</span>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('register'); setAuthError(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2f5f96', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}
                      >
                        here
                      </button>
                    </>
                  )}
                </div>
              )}

              {forgotOpen && (
                <div
                  onClick={() => setForgotOpen(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 18px 48px rgba(9,34,51,0.25)' }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720', marginBottom: 16 }}>Forgot Password</div>

                    {!forgotEmailExists ? (
                      <>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="Enter your email"
                          style={{ ...fieldStyle(), width: '100%', boxSizing: 'border-box' }}
                        />
                        {forgotMessage && (
                          <div style={{ marginTop: 10, fontSize: 13, color: forgotSent ? '#1f8d4e' : '#a61b1b' }}>{forgotMessage}</div>
                        )}
                        <button
                          type="button"
                          disabled={forgotBusy}
                          onClick={async () => {
                            setForgotBusy(true);
                            setForgotMessage('');
                            setForgotSent(false);
                            try {
                              const res = await fetch('/api/auth/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: forgotEmail }),
                              });
                              const data = await res.json();
                              if (data.sent) {
                                setForgotSent(true);
                                setForgotMessage(data.message);
                              } else {
                                setForgotMessage(data.error ?? 'Something went wrong. Please try again.');
                              }
                            } catch {
                              setForgotMessage('Something went wrong. Please try again.');
                            } finally {
                              setForgotBusy(false);
                            }
                          }}
                          style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 14, padding: '13px 16px', background: 'linear-gradient(135deg, #487dc2 0%, #3c6ea9 100%)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: forgotBusy ? 'wait' : 'pointer' }}
                        >
                          {forgotBusy ? 'Checking…' : 'Continue'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: '#5b6b79', marginBottom: 12 }}>
                          Enter your new password below.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 14, border: '1px solid #d7e0e8', background: '#fff' }}>
                          <input
                            type={showForgotNewPassword ? 'text' : 'password'}
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            placeholder="New password (min 8 chars)"
                            style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: 15, background: 'transparent', minWidth: 0 }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotNewPassword((v) => !v)}
                            style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7b88', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          >
                            {showForgotNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {forgotMessage && (
                          <div style={{ marginTop: 10, fontSize: 13, color: forgotMessage === 'Password updated successfully.' ? '#1f8d4e' : '#a61b1b' }}>{forgotMessage}</div>
                        )}
                        <button
                          type="button"
                          disabled={forgotBusy}
                          onClick={async () => {
                            setForgotBusy(true);
                            setForgotMessage('');
                            try {
                              const res = await fetch('/api/auth/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token: resetToken, newPassword: forgotNewPassword }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setForgotMessage('Password updated successfully.');
                                // The reset signed them in; reload so the app picks up the new session.
                                setTimeout(() => window.location.replace('/'), 1500);
                              } else {
                                setForgotMessage(data.error ?? 'Something went wrong.');
                              }
                            } catch {
                              setForgotMessage('Something went wrong. Please try again.');
                            } finally {
                              setForgotBusy(false);
                            }
                          }}
                          style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 14, padding: '13px 16px', background: 'linear-gradient(135deg, #315f95 0%, #284f7d 100%)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: forgotBusy ? 'wait' : 'pointer' }}
                        >
                          {forgotBusy ? 'Updating…' : 'Update Password'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setForgotOpen(false)}
                      style={{ marginTop: 12, width: '100%', border: '1px solid #d7e0e8', borderRadius: 14, padding: '11px 16px', background: '#fff', color: '#5b6b79', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
        <></>
        )}

        {authError ? (
          <div
            style={{
              marginTop: 16,
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
            <span>{authError}</span>
          </div>
        ) : null}

        {/* New accounts confirm their email first, then add their Venmo (once). */}
        {sessionUser && needsEmailCode ? (
          <VerifyEmailGate<SessionPayload>
            email={sessionUser.email}
            onSession={(payload) => {
              applySession(payload);
              settleViewAfterKeyboard();
              if (!payload.user?.venmo && !payload.user?.venmoDeclined) setShowVenmoSetup(true);
            }}
            onSignOut={() => void handleLogout()}
          />
        ) : null}
        {sessionUser && !needsEmailCode && showVenmoSetup ? (
          <VenmoSetupStep<SessionPayload>
            onSession={applySession}
            onDone={() => { setShowVenmoSetup(false); settleViewAfterKeyboard(); }}
          />
        ) : null}

        {sessionUser && !needsEmailCode && !showVenmoSetup && !pool && !sessionLoading ? (
          <LeagueGate<SessionPayload>
            displayName={sessionUser.displayName}
            canCreateLeague={sessionFlags.canCreateLeague}
            initialJoinCode={pendingJoinCode}
            onSession={(payload) => { applySession(payload); setPendingJoinCode(''); settleViewAfterKeyboard(); }}
            onSignOut={() => void handleLogout()}
            onOpenPaywall={setPaywallMode}
          />
        ) : null}

        <PaywallModal<SessionPayload>
          key={paywallMode ? JSON.stringify(paywallMode) : 'closed'}
          open={paywallMode !== null && !!sessionUser}
          mode={paywallMode}
          userId={sessionUser?.id ?? ''}
          onClose={() => setPaywallMode(null)}
          onSession={(payload) => { applySession(payload); setPendingJoinCode(''); setMainTab('Standings'); }}
        />

        {venmoModalOpen && sessionUser ? (
          <VenmoModal<SessionPayload>
            open
            currentVenmo={sessionUser.venmo ?? null}
            isCommissioner={pool?.role === 'commissioner'}
            onClose={() => setVenmoModalOpen(false)}
            onSession={applySession}
          />
        ) : null}

        {entryFeesOpen && sessionUser && pool ? (
          <EntryFeesModal<PoolInfo>
            open
            tournaments={TOURNAMENTS.map((t) => ({ id: t.id as TournamentId, label: t.name }))}
            entryFees={pool.entryFees ?? {}}
            commissionerVenmo={sessionUser.venmo ?? null}
            paymentNote={pool.paymentNote ?? null}
            onClose={() => setEntryFeesOpen(false)}
            onPool={(next) => setPool((current) => (current ? { ...current, ...next } : next))}
            onAddVenmo={() => { setEntryFeesOpen(false); setVenmoModalOpen(true); }}
          />
        ) : null}

        {payWinnersOpen && pool ? (
          <PayWinnersModal<PoolInfo>
            open
            tournamentId={selectedTournament}
            tournamentLabel={TOURNAMENTS.find((t) => t.id === selectedTournament)?.name ?? 'This tournament'}
            isFinal={isTournamentFinal}
            winners={standings.slice(0, 3).map((entry) => ({ place: entry.place, userId: entry.id, name: entry.name, venmo: entry.venmo ?? null }))}
            payouts={selectedTournamentPayouts}
            sent={pool.payoutsSent?.[selectedTournament] ?? []}
            currentUserId={sessionUser?.id ?? ''}
            onClose={() => setPayWinnersOpen(false)}
            onPool={(next) => setPool((current) => (current ? { ...current, ...next } : next))}
          />
        ) : null}

        {seasonSettingsOpen && pool && pool.role === 'commissioner' ? (
          <SeasonSettingsModal<PoolInfo>
            fee={pool.seasonFee ?? null}
            plan={pool.seasonPayoutPlan ?? null}
            memberCount={pool.memberCount ?? 0}
            onPool={(next) => setPool((current) => (current ? { ...current, ...next } : next))}
            onClose={() => setSeasonSettingsOpen(false)}
          />
        ) : null}

        {feeTrackerOpen && pool && pool.role === 'commissioner' && sessionUser ? (
          <EntryFeeTracker<PoolInfo>
            tournamentId={entriesTournamentId}
            tournamentLabel={TOURNAMENTS.find((t) => t.id === entriesTournamentId)?.name ?? 'This tournament'}
            fee={pool.entryFees?.[entriesTournamentId] ?? 0}
            members={poolEntries.map((entry) => ({ id: entry.id, name: entry.name }))}
            commissionerId={sessionUser.id}
            entrants={pool.payoutInfo?.[entriesTournamentId]?.entrants ?? []}
            payments={pool.entryPayments?.[entriesTournamentId] ?? {}}
            onPool={(next) => setPool((current) => (current ? { ...current, ...next } : next))}
            onOpenEntryFees={() => { setFeeTrackerOpen(false); setEntryFeesOpen(true); }}
            onClose={() => setFeeTrackerOpen(false)}
          />
        ) : null}

        {guideOpen && pool && pool.role === 'commissioner' ? (
          <CommissionerGuide<PoolInfo>
            status={{
              hasVenmo: !!sessionUser?.venmo,
              hasPaymentNote: !!pool.paymentNote,
              hasEntryFees: Object.keys(pool.entryFees ?? {}).length > 0,
              hasPayoutPlan: !!pool.payoutPlan,
              memberCount: pool.memberCount ?? 0,
              nextTournamentLabel: TOURNAMENTS.find((t) => t.id === entriesTournamentId)?.name ?? 'Next tournament',
              nextPicksOpen: pool.picksOpen?.[entriesTournamentId] === true,
            }}
            tournaments={TOURNAMENTS.map((t) => t.id as TournamentId)}
            onPool={(next) => setPool((current) => (current ? { ...current, ...next } : next))}
            onClose={() => setGuideOpen(false)}
            openVenmo={() => { setGuideOpen(false); setVenmoModalOpen(true); }}
            openEntryFees={() => { setGuideOpen(false); setEntryFeesOpen(true); }}
            openPayouts={() => { setGuideOpen(false); setPayoutPlanOpen(true); }}
            openInvite={() => { setGuideOpen(false); setLeagueModalOpen(true); }}
            openMessage={() => { setGuideOpen(false); setPoolMessageOpen(true); }}
          />
        ) : null}

        {payoutPlanOpen && pool && pool.role === 'commissioner' ? (
          <PayoutPlanModal<PoolInfo>
            plan={pool.payoutPlan ?? null}
            tournamentId={entriesTournamentId}
            tournamentLabel={TOURNAMENTS.find((t) => t.id === entriesTournamentId)?.name ?? 'This tournament'}
            entryFee={pool.entryFees?.[entriesTournamentId] ?? 0}
            info={pool.payoutInfo?.[entriesTournamentId] ?? null}
            payouts={pool.payouts?.[entriesTournamentId] ?? null}
            memberCount={pool.memberCount ?? 0}
            onPool={(next) => setPool((current) => (current ? { ...current, ...next } : next))}
            onOpenEntryFees={() => { setPayoutPlanOpen(false); setEntryFeesOpen(true); }}
            onClose={() => setPayoutPlanOpen(false)}
          />
        ) : null}

        {poolMessageOpen && pool && pool.role === 'commissioner' ? (
          <PoolMessageModal
            tournaments={TOURNAMENTS.map((t) => ({
              id: t.id as TournamentId,
              label: t.name,
              fullName: WEEK_NAMES[t.id as TournamentId],
              lockAtIso: effectiveLockTime(lockTimeOverrides[t.id as TournamentId], currentTournamentMeta(t.id)?.lockAtUtc),
              picksOpen: pool.picksOpen?.[t.id as TournamentId] === true && pool.lineupLocks?.[t.id as TournamentId] !== true,
            }))}
            initialTournamentId={entriesTournamentId}
            leagueName={pool.name}
            joinCode={pool.joinCode || null}
            entryFees={pool.entryFees ?? {}}
            venmoHandle={pool.venmo?.handle ?? null}
            payoutPlan={pool.payoutPlan ?? null}
            payouts={pool.payouts ?? {}}
            paymentNote={pool.paymentNote ?? null}
            commissionerName={sessionUser?.displayName ?? null}
            signOff={sessionUser?.displayName?.split(' ')[0] ?? null}
            rosterSize={REQUIRED_GOLFERS}
            salaryCap={SALARY_CAP}
            onClose={() => setPoolMessageOpen(false)}
          />
        ) : null}

        {isAppAdmin ? <AdminLeaguesModal open={adminLeaguesOpen} onClose={() => setAdminLeaguesOpen(false)} /> : null}

        <VenmoFallbackNotice url={venmoFallbackUrl} onClose={() => setVenmoFallbackUrl(null)} />

        <LeagueModal<SessionPayload>
          open={leagueModalOpen && !!sessionUser}
          onClose={() => { setLeagueModalOpen(false); setPendingJoinCode(''); }}
          leagues={sessionFlags.leagues}
          activeLeagueId={pool?.id ?? null}
          activeJoinCode={pool?.joinCode ?? null}
          isCommissioner={canManagePool}
          canCreateLeague={sessionFlags.canCreateLeague}
          initialJoinCode={pendingJoinCode}
          onSession={(payload) => { applySession(payload); setPendingJoinCode(''); setMainTab('Standings'); }}
          activePlan={pool ? {
            id: pool.id,
            name: pool.name,
            plan: pool.plan ?? 'founder',
            memberLimit: pool.memberLimit ?? null,
            memberCount: pool.memberCount ?? poolEntries.length,
            paidSeason: pool.paidSeason ?? null,
            seasonExpired: pool.seasonExpired ?? false,
          } : null}
          onOpenPaywall={setPaywallMode}
          onAccountDeleted={() => {
            setSessionUser(null);
            setPool(null);
            setPoolEntries([]);
            setSessionFlags(NO_SESSION_FLAGS);
            clearStoredSession();
            clearStoredMainTab();
            setMainTab('Standings');
          }}
        />

        {sessionUser && pool && !needsEmailCode && !showVenmoSetup ? (
        <>
        {/* A league whose season pass lapsed: members can't join or make picks until it's renewed. */}
        {pool.seasonExpired ? (
          <div style={{ marginTop: isMobile ? 10 : 16, borderRadius: 16, border: '1px solid #e7a3a3', background: '#fbf1f1', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: '#a61b1b', fontWeight: 700, lineHeight: 1.4 }}>
              {pool.name}&apos;s season pass has expired. {canManagePool ? 'Renew it to reopen picks and joining.' : 'Your commissioner can renew it in the app.'}
            </div>
            {canManagePool ? (
              <button
                onClick={() => setPaywallMode({ kind: 'renew', leagueId: pool.id, leagueName: pool.name, memberCount: pool.memberCount ?? poolEntries.length })}
                style={{ border: 'none', borderRadius: 12, padding: '9px 14px', background: '#173b63', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                Renew
              </button>
            ) : null}
          </div>
        ) : null}
        <VenmoPrompt
          userId={sessionUser.id}
          hasVenmo={!!sessionUser.venmo || sessionUser.venmoDeclined === true}
          isCommissioner={pool.role === 'commissioner'}
          onAdd={() => setVenmoModalOpen(true)}
          compact={isMobile}
          marginTop={isMobile ? 10 : 16}
        />
        <PushPrompt compact={isMobile} marginTop={isMobile ? 10 : 16} onOpenTab={p.openTabFromPush} />
        {mainTab === 'Standings' ? (
          <section
            style={{
              marginTop: isMobile ? 12 : 24,
              display: 'flex',
              overflowX: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 0,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                overflowY: 'hidden',
                width: '100%',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                overscrollBehaviorX: 'contain',
                overscrollBehaviorY: 'none',
                touchAction: 'pan-x',
                borderBottom: '1px solid #d7e0e8',
              }}
            >
              {TOURNAMENTS.map((item, idx) => {
                const active = item.id === selectedTournament;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedTournament(item.id); setLeaderboardSearch(''); setLeaderboardViewMode('full'); setSelectedLeaderboardPlayerId(null); setLeaderboardSortMode('default'); setLeaderboardPickedSort('default'); setShowCutInfo(false); setFeedRefreshNonce((v) => v + 1); void refreshCurrentSession(); }}
                    style={{
                      border: active ? '1px solid #d7e0e8' : '1px solid rgba(0,0,0,0.1)',
                      borderBottom: active ? '1px solid #fff' : '1px solid rgba(0,0,0,0.1)',
                      background: active ? '#fff' : 'transparent',
                      color: active ? '#1f2f42' : '#46bfd1',
                      borderRadius: '10px 10px 0 0',
                      padding: isMobile ? '6px 4px 5px' : '10px 12px 9px',
                      width: isMobile ? '20%' : TOURNAMENT_CARD_WIDTH,
                      height: isMobile ? 42 : TOURNAMENT_CARD_HEIGHT,
                      boxSizing: 'border-box',
                      flex: isMobile ? '0 0 20%' : '0 0 auto',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: active ? 500 : 400,
                      lineHeight: 1.1,
                      boxShadow: 'none',
                      marginBottom: -1,
                      marginLeft: idx === 0 ? 0 : -1,
                      position: 'relative',
                      zIndex: active ? 1 : 0,
                    }}
                  >
                    {TOURNAMENT_TAB_WORDMARKS[item.id] ?? TOURNAMENT_TAB_LOGOS[item.id] ? (
                      <img
                        src={TOURNAMENT_TAB_WORDMARKS[item.id] ?? TOURNAMENT_TAB_LOGOS[item.id]}
                        alt={item.name}
                        style={{
                          maxWidth: '100%',
                          // PGA's heavy block letters read larger than the others at the same size.
                          width: item.id === 'pga' ? '80%' : '100%',
                          height: (isMobile ? (item.id === 'masters' ? 40 : item.id === 'pga' || item.id === 'players' ? 36 : 28) : (TOURNAMENT_TAB_LOGO_HEIGHTS[item.id] ?? 40)) * (item.id === 'pga' ? 0.8 : 1),
                          objectFit: 'contain',
                          display: 'block',
                          margin: '0 auto',
                        }}
                      />
                    ) : (
                      <span>{item.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: 18,
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
            <span>{error}</span>
          </div>
        ) : null}

        {mainTab === 'Standings' && <StandingsScreen p={p} />}

        {mainTab === 'My Entries' && <MyEntryScreen p={p} />}

        {mainTab === 'Details' && <DetailsScreen p={p} />}

        {mainTab === 'Reports' && <ReportsScreen p={p} />}

        {mainTab === 'Commissioner Hub' && <CommissionerScreen p={p} />}

        {commissionerMemberModalOpen && selectedCommissionerMember ? <MemberEditModal p={p} /> : null}

        {activeStandingEntry ? <EntryBreakdownPopup p={p} /> : null}

        {activeStandingGolfer ? <GolferBreakdownPopup p={p} /> : null}

        {showPointsSystem ? <PointsSystemPopup p={p} /> : null}

        {/* Scorecard popup */}
        {scorecardGolferName ? <ScorecardPopup p={p} /> : null}

        {showPreviousRounds && scorecardData && scorecardGolferName && <PreviousRoundsPopup p={p} />}

        {cutScorecardGolfer && <CutScorecardPopup p={p} />}

        {reportsMenuOpen && reportsMenuRect && (() => {
          const menuW = 244;
          const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
          const left = Math.max(8, Math.min(reportsMenuRect.left, vw - menuW - 8));
          const accent = REPORT_TOURNAMENT_SOLID[selectedTournament];
          const hexToRgba = (hex: string, a: number) => {
            const h = hex.replace('#', '');
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${a})`;
          };
          const accentSoft = hexToRgba(accent, 0.09);
          const accentHover = hexToRgba(accent, 0.55);
          const reportIcon = (opt: ReportType) => {
            const p = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
            switch (opt) {
              case 'Season Standings':
                return <svg {...p}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3" /><path d="M7 5H4v2a3 3 0 0 0 3 3" /></svg>;
              case 'Hall of Champions':
                return <svg {...p}><circle cx="12" cy="8" r="6" /><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" /></svg>;
              case 'Player Pick Summary':
                return <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
              case 'Pool Member Pick History':
                return <svg {...p}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
              case 'Pool Member Pick Summary':
                return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
              case 'Player Performance Summary':
                return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
              case 'Pool Standings History':
                return <svg {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
              default:
                return null;
            }
          };
          return (
            <>
              <div onClick={() => setReportsMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200 }} />
              <div style={{ position: 'fixed', top: reportsMenuRect.top + 4, left, width: menuW, zIndex: 1201, background: '#fff', border: '1px solid #d1dae3', borderRadius: 12, boxShadow: '0 18px 40px -6px rgba(9,34,51,0.30), 0 4px 10px rgba(9,34,51,0.10)', overflow: 'hidden' }}>
                <div style={{ height: 4, background: accent }} />
                {REPORT_OPTIONS.map((opt, i) => {
                  const isSel = selectedReport === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setSelectedReport(opt); setReportsMenuOpen(false); handleMainTabChange('Reports'); }}
                      onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = accentSoft; e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentHover}`; } }}
                      onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: isSel ? accentSoft : 'transparent', border: 'none', borderTop: i === 0 ? 'none' : '1px solid #eef2f6', boxShadow: isSel ? `inset 3px 0 0 ${accent}` : 'none', padding: '12px 14px', fontSize: 12.5, fontWeight: 700, color: '#0f1720', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ width: 15, height: 15, flex: '0 0 15px', color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{reportIcon(opt)}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}

        {ppsAllPlayerPopup && <PickSummaryPlayerPopup p={p} />}

        {ppsPickPopup && <PickedByPopup p={p} />}

        {historyRoster && historyPopup && <HistoryRosterPopup p={p} />}

        {showTiebreakerRules && (
          <div
            onClick={() => setShowTiebreakerRules(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
              <div style={{ background: headerSolid, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '0.01em' }}>Tiebreaker Rules</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {(KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]) && (
                    <TournamentWordmark id={selectedTournament} white alt="" width={120} height={40} />
                  )}
                  <button onClick={() => setShowTiebreakerRules(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                </div>
              </div>
              <div style={{ padding: isMobile ? '16px 18px 20px' : '20px 24px 24px', overflowY: 'auto' }}>
                <div style={{ fontSize: isMobile ? 13 : 14, color: selectedTournament === 'open' ? '#000000' : '#374151', lineHeight: 1.6, marginBottom: 16 }}>
                  Final standings are ranked by <strong>total points</strong>. When two or more entries are tied on points, the tie is broken in the order below — each step is used only if the previous one leaves them still tied.
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {([
                    ['Closest Tiebreaker Prediction', <>Each entry submits a predicted score — the winning golfer&rsquo;s 4-round <strong>total strokes</strong> (not score to par). Whoever&rsquo;s prediction lands <strong>closest to the champion&rsquo;s actual total strokes</strong> wins. Example: if the champion finishes at 274, a guess of 272 (off by 2) beats a guess of 277 (off by 3).</>],
                    ['Picked the Champion', <>If still tied — because the predictions were equally close, or exactly the same — the entry that had the <strong>tournament&rsquo;s winning golfer</strong> on their roster wins. If both entries had the champion, or neither did, move on.</>],
                    ['Fewest Missed Cuts', <>The entry with the <strong>fewest golfers who missed the cut</strong> wins the tiebreak.</>],
                    ['Best Individual Golfers', <>Compare each entry&rsquo;s <strong>highest-scoring golfer</strong> by points. If those are equal, compare the second-highest, then the third-highest, and so on down the roster until one entry&rsquo;s golfer out-points the other&rsquo;s at the same spot.</>],
                  ] as const).map(([title, body], i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: headerSolid, color: '#fff', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: isMobile ? 13.5 : 14.5, fontWeight: 800, color: '#0f1720', marginBottom: 3 }}>{title}</div>
                        <div style={{ fontSize: isMobile ? 12.5 : 13.5, color: selectedTournament === 'open' ? '#1a1a1a' : '#4b5563', lineHeight: 1.55 }}>{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showBonusPoints && <BonusPointsPopup p={p} />}

        {statLeaderboardModal !== null && <StatLeaderboardPopup p={p} />}

        {winsListPopup !== null && <WinsListPopup p={p} />}

        {pickHistoryPlayerPopup !== null && <PlayerInfoPopup p={p} />}

        {showRosterConfirm && <RosterConfirmPopup p={p} />}

        {showSubmitToast && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', borderRadius: 18, padding: '24px 28px', boxShadow: '0 18px 48px rgba(9,34,51,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={30} color="#1f8d4e" />
              <span style={{ fontSize: 17, fontWeight: 900, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#0f1720' }}>
                Roster successfully submitted!
                {paysEntryFeeInApp ? (
                  <span style={{ display: 'block', marginTop: 4, fontSize: 14, fontWeight: 700, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Now opening <VenmoMark tone="blue" />…</span>
                ) : null}
              </span>
            </div>
          </div>
        )}

        {showSubmittedPicksPopup && (
          <div
            onClick={() => { setShowSubmittedPicksPopup(false); setSubmittedPicksSort('alpha'); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 18px 48px rgba(9,34,51,0.25)', maxHeight: 'calc(100vh - 80px - var(--safe-y))', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#0f1720' }}>Submitted Picks ({submittedEntries.length})</div>
                <button
                  onClick={() => setSubmittedPicksSort((s) => (s === 'alpha' ? 'newest' : 'alpha'))}
                  style={{ marginLeft: 'auto', marginRight: 8, background: selectedTournament === 'open' ? '#173b63' : '#f0f4f8', border: 'none', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: selectedTournament === 'open' ? '#fff' : '#5b6b79' }}
                >
                  {submittedPicksSort === 'alpha' ? 'A–Z' : 'Newest'}
                </button>
                <button
                  onClick={() => { setShowSubmittedPicksPopup(false); setSubmittedPicksSort('alpha'); }}
                  style={{ background: selectedTournament === 'open' ? '#173b63' : '#f0f4f8', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: selectedTournament === 'open' ? '#fff' : '#5b6b79' }}
                >✕</button>
              </div>
              <div style={{ overflowY: 'auto', display: 'grid', gap: 8 }}>
                {[...submittedEntries].sort((a, b) => {
                  if (submittedPicksSort === 'alpha') return a.name.localeCompare(b.name);
                  const ta = a.rosterSubmittedAt?.[entriesTournamentId] ?? '';
                  const tb = b.rosterSubmittedAt?.[entriesTournamentId] ?? '';
                  if (ta !== tb) return tb.localeCompare(ta); // newest first; missing stamps sink
                  return a.name.localeCompare(b.name);
                }).map((entry) => (
                  <div key={entry.id} style={{ padding: '10px 14px', borderRadius: 12, background: selectedTournament === 'open' ? '#173b63' : '#f4f7fa', fontSize: 15, fontWeight: 700, color: selectedTournament === 'open' ? '#fff' : '#0f1720' }}>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        </>
        ) : null}

      </div>
    </div>
  );
}

