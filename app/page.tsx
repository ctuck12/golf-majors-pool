'use client';

// Inside the iPhone app, sends this page's /api calls to the live site (no-op on the web).
import { settleViewAfterKeyboard } from './native-bridge';
import { type CSSProperties, type ReactNode } from 'react';
import { LeagueGate, LeagueModal } from './league-panel';
import { PaywallModal } from './paywall';
import { VenmoSetupStep, VerifyEmailGate } from './onboarding';
import { AdminLeaguesModal } from './admin-leagues';
import { VenmoMark } from './venmo-mark';
import { EntryFeesModal, PayWinnersModal, VenmoFallbackNotice, VenmoModal, VenmoPrompt } from './venmo-ui';
import { formatMoney, formatVenmo } from '@/app/lib/venmo';
import { canonicalNameKey } from '@/app/lib/name-match';
import { applyNameAlias } from '@/app/lib/name-aliases';
import { AlertCircle, CircleUserRound, CheckCircle2, ChevronDown, Eye, EyeOff, LogIn, Mail, UserPlus, } from 'lucide-react';
import { SCORING_RULES } from './lib/scoring';
import { totalParFor, REGISTRATION_OPEN, TOURNAMENTS, TOURNAMENT_CAREER_RESULTS_HEADER, canonicalName, getPlayerFlag, getFlagSrc, getCountryLabel, TOURNAMENT_TAB_LOGOS, PGA_CLUB_PROFESSIONALS, CAREER_TAB_LOGO_HEIGHTS, KNOCKOUT_TAB_LOGOS, TOURNAMENT_TAB_LOGO_HEIGHTS, TOURNAMENT_CARD_WIDTH, TOURNAMENT_CARD_HEIGHT, pgaPhoto, formatCollege, majorTint, PGA_PHOTO_ONLY, playerPhotoSrc, photoOnError, HeaderNameFlag, fitPopupHeader, MAIN_TABS, REPORT_OPTIONS, REPORT_TOURNAMENTS, REPORT_TOURNAMENT_SOLID, NO_SESSION_FLAGS, clearStoredMainTab, clearStoredSession, readJson, fieldStyle, formatPointValue, formatPosition, ordinal, formatTeeTime, formatCurrentRoundScore, type TournamentId, type ReportType, type PoolInfo, type SessionPayload } from './pool-data';
import { usePoolPage } from './pool-page-state';
import { DetailsScreen } from './screens/details-screen';
import { ReportsScreen } from './screens/reports-screen';
import { MyEntryScreen } from './screens/my-entry-screen';
import { CommissionerScreen } from './screens/commissioner-screen';
import { StandingsScreen } from './screens/standings-screen';

// The app's one page. Its state and logic live in usePoolPage() (app/pool-page-state.tsx).
export default function Page() {
  const p = usePoolPage();
  const {
    mainTab,
    setMainTab,
    selectedTournament,
    setSelectedTournament,
    setActiveStandingEntryId,
    activeStandingGolferId,
    setActiveStandingGolferId,
    scorecardGolferName,
    setScorecardGolferName,
    setScorecardGolferPhoto,
    scorecardGolferTeeTime,
    setScorecardGolferTeeTime,
    scorecardGolferThru,
    setScorecardGolferThru,
    scorecardGolferBackNineStart,
    setScorecardGolferBackNineStart,
    scorecardData,
    setScorecardData,
    scorecardLoading,
    setScorecardLoading,
    showPreviousRounds,
    setShowPreviousRounds,
    showBonusPoints,
    setShowBonusPoints,
    showTiebreakerRules,
    setShowTiebreakerRules,
    historyPopup,
    historyRoster,
    setHistoryRoster,
    reportsMenuOpen,
    setReportsMenuOpen,
    reportsMenuRect,
    setReportsMenuRect,
    selectedReport,
    setSelectedReport,
    ppsPickPopup,
    setPpsPickPopup,
    ppsAllPlayerPopup,
    setPpsAllPlayerPopup,
    reportYear,
    expandedBonusCategories,
    setExpandedBonusCategories,
    bonusInfoPopup,
    setBonusInfoPopup,
    cutScorecardGolfer,
    setCutScorecardGolfer,
    cutScorecardData,
    setCutScorecardData,
    cutScorecardLoading,
    setCutScorecardLoading,
    entryBreakdownRef,
    showPointsSystem,
    setShowPointsSystem,
    setSelectedLeaderboardPlayerId,
    setLeaderboardSearch,
    setLeaderboardViewMode,
    pickHistoryPlayerPopup,
    setPickHistoryPlayerPopup,
    winsListPopup,
    setWinsListPopup,
    pickHistoryView,
    setPickHistoryView,
    statsSubView,
    setStatsSubView,
    statLeaderboardModal,
    setStatLeaderboardModal,
    statLbSearch,
    setStatLbSearch,
    visualVpHeight,
    setLeaderboardSortMode,
    setLeaderboardPickedSort,
    setShowCutInfo,
    showHeaderCutInfo,
    setShowHeaderCutInfo,
    statsEventId,
    error,
    setFeedRefreshNonce,
    feed,
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
    reportEntries,
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
    commissionerBusy,
    tieBreakInput,
    showRosterConfirm,
    setShowRosterConfirm,
    showSubmitToast,
    setShowSubmitToast,
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
    venmoFallbackUrl,
    setVenmoFallbackUrl,
    showSubmittedPicksPopup,
    setShowSubmittedPicksPopup,
    submittedPicksSort,
    setSubmittedPicksSort,
    commissionerMemberModalOpen,
    setCommissionerMemberModalOpen,
    commissionerMemberModalView,
    setCommissionerMemberModalView,
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
    memberEditForm,
    setMemberEditForm,
    isMobile,
    landscapeZoom,
    tournament,
    isAppAdmin,
    needsEmailCode,
    canManagePool,
    isFounderPool,
    picksRevealedForYear,
    selectedTournamentStatus,
    entriesTournamentId,
    careerTournamentId,
    entriesTournament,
    selectedTournamentPayouts,
    applySession,
    refreshCurrentSession,
    handleRegister,
    handleLogin,
    handleLogout,
    handleUpdateOwnPassword,
    handleUpdateOwnDisplayName,
    openCommissionerMemberPicks,
    handleSaveCommissionerMember,
    handleDeleteCommissionerMember,
    confirmHandOverId,
    setConfirmHandOverId,
    handleHandOverCommissioner,
    handleClearCommissionerMemberPicks,
    amateurKeys,
    clubProKeys,
    players,
    selectedCommissionerMember,
    hasSubmittedRoster,
    entryFee,
    entryFeeVenmo,
    paysEntryFeeInApp,
    openEntryFeePayment,
    submittedEntries,
    orderedRosterPlayers,
    salaryUsed,
    salaryRemaining,
    isTournamentFinal,
    roundTwoComplete,
    showFutureTournamentView,
    currentRoundLabel,
    openPlayerPopup,
    standings,
    pickedPlayerIds,
    activeStandingEntry,
    activeStandingGolfers,
    activeStandingGolfer,
    handleSave,
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
                          padding: '12px 14px',
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
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Preferences
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
                        padding: '12px 14px',
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
        {/* Which league you're looking at, once there's more than one to tell apart. */}
        {sessionFlags.leagues.length > 1 || !isFounderPool ? (
          <div style={{ marginTop: isMobile ? 10 : 16, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setLeagueModalOpen(true)}
              style={{ border: '1px solid #d7e0e8', borderRadius: 999, background: '#fff', padding: '6px 14px', fontSize: 13, fontWeight: 800, color: '#173b63', cursor: 'pointer', boxShadow: '0 4px 12px rgba(9,34,51,0.06)' }}
            >
              {pool.name}{sessionFlags.leagues.length > 1 ? ' · Switch' : ''}
            </button>
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
                    {TOURNAMENT_TAB_LOGOS[item.id] ? (
                      <img
                        src={TOURNAMENT_TAB_LOGOS[item.id]}
                        alt={item.name}
                        style={{
                          maxWidth: '100%',
                          width: '100%',
                          height: isMobile ? (item.id === 'masters' ? 40 : item.id === 'pga' || item.id === 'players' ? 36 : 28) : (TOURNAMENT_TAB_LOGO_HEIGHTS[item.id] ?? 40),
                          objectFit: 'contain',
                          display: 'block',
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

        {commissionerMemberModalOpen && selectedCommissionerMember ? (
          <div
            onClick={() => setCommissionerMemberModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(520px, 100%)',
                background: '#fff',
                borderRadius: 24,
                padding: 24,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
                display: 'grid',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>Member options</div>
                  <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900, color: '#0f1720' }}>
                    {selectedCommissionerMember.displayName}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 15, color: '#607282' }}>{selectedCommissionerMember.email}</div>
                </div>
                <button
                  onClick={() => setCommissionerMemberModalOpen(false)}
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: '#fff',
                    width: 40,
                    height: 40,
                    fontSize: 20,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              {commissionerMemberModalView === 'menu' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <button
                    onClick={() => setCommissionerMemberModalView('displayName')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Display Name
                  </button>
                  {/* A member's sign-in email is theirs; only the app admin can change it here. */}
                  {isAppAdmin ? (
                  <button
                    onClick={() => setCommissionerMemberModalView('email')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Email
                  </button>
                  ) : null}
                  {(() => {
                    // One commissioner per league: they can hand the role to another member.
                    const memberIsCommissioner = (pool?.commissioners ?? []).some((c) => c.id === selectedCommissionerMember.id);
                    if (memberIsCommissioner || pool?.role !== 'commissioner') return null;
                    const confirming = confirmHandOverId === selectedCommissionerMember.id;
                    return (
                      <button
                        onClick={() => {
                          if (!confirming) { setConfirmHandOverId(selectedCommissionerMember.id); return; }
                          void handleHandOverCommissioner(selectedCommissionerMember.id, selectedCommissionerMember.displayName);
                        }}
                        disabled={commissionerBusy}
                        style={{
                          border: confirming ? '1.5px solid #b45309' : '1px solid #d7e0e8',
                          borderRadius: 16,
                          background: confirming ? '#fff7ed' : '#fff',
                          padding: '16px 18px',
                          textAlign: 'left',
                          fontWeight: 800,
                          cursor: commissionerBusy ? 'wait' : 'pointer',
                        }}
                      >
                        {confirming
                          ? `Tap again to make ${selectedCommissionerMember.displayName} the commissioner. You'll become a member and lose the commissioner tools.`
                          : 'Make Commissioner (hand over the role)'}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => openCommissionerMemberPicks(selectedCommissionerMember.id)}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#eef8fb',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Manage or Submit Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmClearPicks')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fcd9a0',
                      borderRadius: 16,
                      background: '#fff8ee',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a06000',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Clear Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmDelete')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: 16,
                      background: '#fff5f5',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a61b1b',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Delete Member
                  </button>
                </div>
              ) : commissionerMemberModalView === 'displayName' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <input
                    value={memberEditForm.displayName}
                    onChange={(event) => setMemberEditForm({ ...memberEditForm, displayName: event.target.value })}
                    placeholder="Display name"
                    style={fieldStyle()}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentBg,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Display Name
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmClearPicks' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to clear picks for <strong>{selectedCommissionerMember?.displayName}</strong>? Their submitted roster will be removed for this tournament.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearCommissionerMemberPicks}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a06000',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Clear
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmDelete' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to delete <strong>{selectedCommissionerMember?.displayName}</strong>? This cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a61b1b',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '0 14px',
                    }}
                  >
                    <Mail size={18} color="#607282" />
                    <input
                      value={memberEditForm.email}
                      onChange={(event) => setMemberEditForm({ ...memberEditForm, email: event.target.value })}
                      placeholder="Email"
                      style={{ ...fieldStyle(), border: 'none', paddingLeft: 0, paddingRight: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentBg,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeStandingEntry ? (
          <div
            onClick={() => {
              setShowPointsSystem(false);
              setActiveStandingGolferId(null);
              setActiveStandingEntryId(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.55)',
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
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
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
            </div>
          </div>
        </div>
        ) : null}

        {activeStandingGolfer ? (
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
              background: 'rgba(15, 23, 32, 0.45)',
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={activeStandingGolfer.name} flagSrc={getPlayerFlag(activeStandingGolfer.name) ? getFlagSrc(activeStandingGolfer.name) : null} abbr={getCountryLabel(activeStandingGolfer.name) || null} base={fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).stacked} />{getPlayerFlag(activeStandingGolfer.name) && <>{(PGA_CLUB_PROFESSIONALS.has(activeStandingGolfer.name) || clubProKeys.has(canonicalNameKey(activeStandingGolfer.name))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: selectedTournament !== 'open' ? 'center' : undefined }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
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
        ) : null}

        {showPointsSystem ? (
          <div
            onClick={(e) => {
              const rect = entryBreakdownRef.current?.getBoundingClientRect();
              if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                setShowPointsSystem(false);
              } else {
                setShowPointsSystem(false);
                setActiveStandingGolferId(null);
                setActiveStandingEntryId(null);
              }
            }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 95 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(500px, 100%)', maxHeight: 'calc(100vh - 40px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
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
                  <>
                    <div style={{ background: hBg, padding: isMobile ? '14px 16px 12px' : '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Points System</div>
                      {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                        <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                        </div>
                      )}
                      <button onClick={() => setShowPointsSystem(false)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '10px 12px 16px' : '12px 16px 20px' }}>
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
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}

        {/* Scorecard popup */}
        {scorecardGolferName ? (
          <div
            onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); setShowPreviousRounds(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 80 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored tournament header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                const roundColor = selectedTournament === 'masters' ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#0f1720' : selectedTournament === 'open' ? '#F4BC41' : '#173b63';
                const teeTimeColor = (selectedTournament === 'us-open' || selectedTournament === 'open') ? '#fff' : '#0f1720';
                return (
                  <div style={{ background: hBg, display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
                    {/* Name + round/score + close */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: isMobile ? '10px 14px' : '12px 18px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: !scorecardGolferName ? 19 : fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1, display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={scorecardGolferName ?? ''} flagSrc={scorecardGolferName && getPlayerFlag(scorecardGolferName) ? getFlagSrc(scorecardGolferName) : null} abbr={scorecardGolferName ? (getCountryLabel(scorecardGolferName) || null) : null} base={!scorecardGolferName ? 19 : fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).fontSize} min={isMobile ? 13 : 15} allowStack={false} initialStacked={false} />{scorecardGolferName && getPlayerFlag(scorecardGolferName) && <></>}</div>
                        {(() => {
                          const playerNotStarted = scorecardGolferThru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS';
                          const prevRoundsBtn = (hasPrev: boolean) => hasPrev ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowPreviousRounds(true); }}
                              style={{ background: selectedTournament === 'masters' ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', border: selectedTournament === 'masters' ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', borderRadius: 999, padding: isMobile ? '2.5px 7.5px' : '3px 8px', cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : '#fff', fontWeight: 800, fontSize: isMobile ? 8 : 9, letterSpacing: '0.06em', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)', textTransform: 'uppercase' }}
                            >
                              Previous Rounds
                            </button>
                          ) : null;
                          if (playerNotStarted && scorecardGolferTeeTime) {
                            const roundNum = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                            const hasPrev = scorecardData?.rounds.some(r => r.round < roundNum && r.holes.length > 0) ?? false;
                            return (
                              <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                Round {roundNum}
                                <span style={{ fontWeight: 400, color: teeTimeColor, fontSize: isMobile ? 10 : 11 }}>{formatTeeTime(scorecardGolferTeeTime)}</span>
                                {prevRoundsBtn(hasPrev)}
                              </div>
                            );
                          }
                          if (scorecardData && scorecardData.rounds.length > 0) {
                            const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                            const hasPrev = scorecardData.rounds.some(r => r.round < rnd.round && r.holes.length > 0);
                            if (!rnd) return null;
                            if (rnd.score != null && rnd.score !== '') {
                              return (
                                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  Round {rnd.round}
                                  <span style={{ fontWeight: 600, color: '#fff', fontSize: isMobile ? 10 : 11 }}>Score: {rnd.score}{scorecardGolferBackNineStart && scorecardGolferThru !== '--' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>
                                  {prevRoundsBtn(hasPrev)}
                                  {scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', marginTop: -8, marginBottom: -8, flexShrink: 0 }} />}
                                </div>
                              );
                            }
                            if (hasPrev) {
                              return (
                                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  Round {rnd.round}
                                  {prevRoundsBtn(true)}
                                  {scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', marginTop: -8, marginBottom: -8, flexShrink: 0 }} />}
                                </div>
                              );
                            }
                            return null;
                          }
                          return null;
                        })()}
                      </div>
                      {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                        onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); setShowPreviousRounds(false); }}
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                      >✕</button>
                    </div>
                  </div>
                );
              })()}

              {/* Scorecard body */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '12px 12px 16px' : '16px 20px 20px', overflowX: 'auto' }}>
              {scorecardLoading ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Loading scorecard…</div>
              ) : !scorecardData || scorecardData.rounds.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>
                  Scorecard data is not yet available for this round.
                </div>
              ) : (() => {
                // Show only the current (latest) round that has hole data
                const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                const front = rnd.holes.filter(h => h.hole <= 9);
                const back  = rnd.holes.filter(h => h.hole >= 10);
                const frontPar    = front.reduce((s, h) => s + (h.par || 0), 0);
                const backPar     = back.reduce((s,  h) => s + (h.par || 0), 0);
                const allScoresNull = rnd.holes.every(h => h.score == null);
                const frontScore  = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                const backScore   = allScoresNull ? 0 : back.reduce((s,  h) => s + (h.score ?? 0), 0);
                const totalScore  = frontScore + backScore;

                const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';

                const isGoldTab = selectedTournament === 'open';
                const baseCell: React.CSSProperties = {
                  border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap',
                  ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }),
                };
                const labelCell: React.CSSProperties = {
                  ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase',
                  background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151',
                };
                const isMastersTournament = selectedTournament === 'masters';
                const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                const subtotalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder,
                };
                const holeHeaderCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12,
                };
                const subtotalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder,
                };

                const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;

                // Standard golf scorecard notation applied to each hole score
                const badge = (score: number, par: number): React.CSSProperties => {
                  const base: React.CSSProperties = {
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, boxSizing: 'border-box', fontSize: 13,
                  };
                  if (!score || !par) return base;
                  const diff = score - par;
                  const r = '#dc2626'; // red — under par
                  const k = '#0f1720'; // dark — over par
                  const g = isGoldTab ? '#F4BC41' : '#fff';    // gap between rings
                  // hole-in-one or eagle → 2 circles (checked before albatross so HIO on par-4 = 2 circles)
                  if (score === 1 || diff === -2)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                  // albatross → 3 circles
                  if (diff <= -3)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                  // birdie → 1 circle
                  if (diff === -1)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                  // bogey → 1 square
                  if (diff === 1)
                    return { ...base, border: `2px solid ${k}` };
                  // double bogey → 2 squares
                  if (diff === 2)
                    return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                  // triple bogey or worse → 3 squares (slightly tighter rings so they fit within the cell)
                  if (diff >= 3)
                    return { ...base, border: `1.5px solid ${k}`, boxShadow: `0 0 0 1.5px ${g},0 0 0 3px ${k},0 0 0 4.5px ${g},0 0 0 6px ${k}` };
                  return base; // par — no decoration
                };

                return (
                  <div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                        <thead>
                          <tr>
                            <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                            {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                            <th style={subtotalHeaderCell}>Front</th>
                            {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                            <th style={subtotalHeaderCell}>Back</th>
                            <th style={totalHeaderCell}>TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={labelCell}>Par</td>
                            {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                            <td style={subtotalCell}>{frontPar || '--'}</td>
                            {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                            <td style={subtotalCell}>{backPar || '--'}</td>
                            <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                          </tr>
                          <tr>
                            <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                            {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                            <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                            {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                            <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                            <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {rnd.holes.length === 0 && (
                      <div style={{ color: '#607282', fontSize: 14, marginTop: 12 }}>
                        Round {rnd.round} score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score ?? '--'}
                      </div>
                    )}
                  </div>
                );
              })()}
              </div>
              </div>
            </div>
          </div>
        ) : null}

        {showPreviousRounds && scorecardData && scorecardGolferName && (
          <div
            onClick={() => setShowPreviousRounds(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={scorecardGolferName ?? ''} flagSrc={scorecardGolferName && getPlayerFlag(scorecardGolferName) ? getFlagSrc(scorecardGolferName) : null} abbr={scorecardGolferName ? (getCountryLabel(scorecardGolferName) || null) : null} base={fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).stacked} />{scorecardGolferName && getPlayerFlag(scorecardGolferName) && <>{scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                      onClick={() => setShowPreviousRounds(false)}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })()}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '14px 14px 20px' : '16px 20px 24px', overflowX: 'auto' }}>
                {(() => {
                  const currentRnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                  const prevRnds = scorecardData.rounds.filter(r => r.round < currentRnd.round && r.holes.length > 0).sort((a, b) => b.round - a.round);
                  const allRnds = [currentRnd, ...prevRnds];

                  const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                  const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';
                  const isGoldTab = selectedTournament === 'open';
                  const isMastersTournament = selectedTournament === 'masters';
                  const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                  const baseCell: React.CSSProperties = { border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap', ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }) };
                  const labelCell: React.CSSProperties = { ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151' };
                  const subtotalCell: React.CSSProperties = { ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalCell: React.CSSProperties = { ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder };
                  const holeHeaderCell: React.CSSProperties = { ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12 };
                  const subtotalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder };
                  const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;
                  const badge = (score: number, par: number): React.CSSProperties => {
                    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, boxSizing: 'border-box', fontSize: 13 };
                    if (!score || !par) return base;
                    const diff = score - par;
                    const r = '#dc2626'; const k = '#0f1720'; const g = isGoldTab ? '#F4BC41' : '#fff';
                    if (score === 1 || diff === -2) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                    if (diff <= -3) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                    if (diff === -1) return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                    if (diff === 1) return { ...base, border: `2px solid ${k}` };
                    if (diff === 2) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                    if (diff >= 3) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k},0 0 0 6px ${g},0 0 0 8px ${k}` };
                    return base;
                  };

                  return allRnds.map(rnd => {
                    const front = rnd.holes.filter(h => h.hole <= 9);
                    const back = rnd.holes.filter(h => h.hole >= 10);
                    const frontPar = front.reduce((s, h) => s + (h.par || 0), 0);
                    const backPar = back.reduce((s, h) => s + (h.par || 0), 0);
                    const allScoresNull = rnd.holes.every(h => h.score == null);
                    const frontScore = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                    const backScore = allScoresNull ? 0 : back.reduce((s, h) => s + (h.score ?? 0), 0);
                    const totalScore = frontScore + backScore;
                    return (
                      <div key={rnd.round} style={{ marginBottom: 24 }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: isMastersTournament ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#1e4d8c' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', color: isMastersTournament ? '#2c6449' : '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', border: isMastersTournament ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'us-open' ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: isMastersTournament ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(14,45,100,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>Round {rnd.round}</span>
                          {rnd.score != null && rnd.score !== '' && <span style={{ fontWeight: 600, color: '#0f1720', fontSize: 12 }}>Score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score}{rnd.holes[0]?.hole >= 10 ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                            <thead>
                              <tr>
                                <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                                {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Front</th>
                                {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Back</th>
                                <th style={totalHeaderCell}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={labelCell}>Par</td>
                                {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{frontPar || '--'}</td>
                                {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{backPar || '--'}</td>
                                <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                              </tr>
                              <tr>
                                <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                                {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                                {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                                <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              </div>
            </div>
          </div>
        )}

        {cutScorecardGolfer && (
          <div
            onClick={() => { setCutScorecardGolfer(null); setCutScorecardData(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={cutScorecardGolfer.name} flagSrc={getPlayerFlag(cutScorecardGolfer.name) ? getFlagSrc(cutScorecardGolfer.name) : null} abbr={getCountryLabel(cutScorecardGolfer.name) || null} base={fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).stacked} />{getPlayerFlag(cutScorecardGolfer.name) && <>{(PGA_CLUB_PROFESSIONALS.has(cutScorecardGolfer.name) || clubProKeys.has(canonicalNameKey(cutScorecardGolfer.name))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                      onClick={() => { setCutScorecardGolfer(null); setCutScorecardData(null); }}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })()}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '14px 14px 20px' : '16px 20px 24px', overflowX: 'auto' }}>
                {cutScorecardLoading ? (
                  <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Loading scorecard…</div>
                ) : !cutScorecardData || cutScorecardData.rounds.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Scorecard data is not yet available.</div>
                ) : (() => {
                  const rounds = cutScorecardData.rounds.filter(r => r.holes.length > 0 && r.round <= 2 && r.holes.some(h => h.score != null && h.score !== 0 && String(h.label) !== '')).sort((a, b) => b.round - a.round);
                  if (rounds.length === 0) return <div style={{ color: '#607282', fontSize: 14, padding: '16px 0' }}>No scorecard data available.</div>;
                  const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                  const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';
                  const isGoldTab = selectedTournament === 'open';
                  const isMastersTournament = selectedTournament === 'masters';
                  const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                  const baseCell: React.CSSProperties = { border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap', ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }) };
                  const labelCell: React.CSSProperties = { ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151' };
                  const subtotalCell: React.CSSProperties = { ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalCell: React.CSSProperties = { ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder };
                  const holeHeaderCell: React.CSSProperties = { ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12 };
                  const subtotalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder };
                  const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;
                  const badge = (score: number, par: number): React.CSSProperties => {
                    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, boxSizing: 'border-box', fontSize: 13 };
                    if (!score || !par) return base;
                    const diff = score - par;
                    const r = '#dc2626'; const k = '#0f1720'; const g = isGoldTab ? '#F4BC41' : '#fff';
                    if (score === 1 || diff === -2) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                    if (diff <= -3) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                    if (diff === -1) return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                    if (diff === 1) return { ...base, border: `2px solid ${k}` };
                    if (diff === 2) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                    if (diff >= 3) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k},0 0 0 6px ${g},0 0 0 8px ${k}` };
                    return base;
                  };
                  return rounds.map(rnd => {
                    const front = rnd.holes.filter(h => h.hole <= 9);
                    const back = rnd.holes.filter(h => h.hole >= 10);
                    const frontPar = front.reduce((s, h) => s + (h.par || 0), 0);
                    const backPar = back.reduce((s, h) => s + (h.par || 0), 0);
                    const allScoresNull = rnd.holes.every(h => h.score == null);
                    const frontScore = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                    const backScore = allScoresNull ? 0 : back.reduce((s, h) => s + (h.score ?? 0), 0);
                    const totalScore = frontScore + backScore;
                    return (
                      <div key={rnd.round} style={{ marginBottom: 24 }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: isMastersTournament ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#1e4d8c' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', color: isMastersTournament ? '#2c6449' : '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', border: isMastersTournament ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'us-open' ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: isMastersTournament ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(14,45,100,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>Round {rnd.round}</span>
                          {rnd.score != null && rnd.score !== '' && <span style={{ fontWeight: 600, color: '#0f1720', fontSize: 12 }}>Score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score}{rnd.holes[0]?.hole >= 10 ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                            <thead>
                              <tr>
                                <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                                {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Front</th>
                                {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Back</th>
                                <th style={totalHeaderCell}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={labelCell}>Par</td>
                                {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{frontPar || '--'}</td>
                                {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{backPar || '--'}</td>
                                <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                              </tr>
                              <tr>
                                <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                                {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                                {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                                <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              </div>
            </div>
          </div>
        )}

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

        {ppsAllPlayerPopup && (() => {
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
        })()}

        {ppsPickPopup && (() => {
          const T = ppsPickPopup.tournament;
          const headerColor = REPORT_TOURNAMENT_SOLID[T];
          const logo = KNOCKOUT_TAB_LOGOS[T] ?? TOURNAMENT_TAB_LOGOS[T];
          const entriesPicked = reportEntries
            .filter((e) => (e.rosters[T] ?? []).includes(ppsPickPopup.id))
            .map((e) => e.name)
            .sort((a, b) => a.localeCompare(b));
          const close = () => setPpsPickPopup(null);
          const flagSrc = getPlayerFlag(ppsPickPopup.name) ? getFlagSrc(ppsPickPopup.name) : null;
          return (
            <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: headerColor, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>
                    <HeaderNameFlag name={ppsPickPopup.name} flagSrc={flagSrc} abbr={getCountryLabel(ppsPickPopup.name) || null} base={isMobile ? 15 : 16} min={isMobile ? 11.5 : 14} allowStack={true} initialStacked={false} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {logo && (
                      <img src={logo} alt="" style={{ height: T === 'pga' ? 52 : T === 'players' ? 46 : T === 'open' ? 36 : T === 'masters' ? undefined : 32, width: T === 'masters' ? 104 : undefined, margin: T === 'pga' ? '-10px 0' : T === 'players' ? '-7px 0' : undefined, maxWidth: 104, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                    )}
                    <button onClick={close} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ padding: '9px 0', overflowY: 'auto' }}>
                  {!picksRevealedForYear(T, reportYear) ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#5b6b79', fontSize: 14, lineHeight: 1.5 }}>Picks are hidden until the tournament begins.</div>
                  ) : (
                    <>
                      <div style={{ padding: '0 18px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                        {entriesPicked.length} {entriesPicked.length === 1 ? 'entry' : 'entries'}
                      </div>
                      {entriesPicked.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#5b6b79', fontSize: 14 }}>No entries picked this player.</div>
                      ) : entriesPicked.map((n, i) => (
                        <div key={i} style={{ padding: '11px 18px', borderTop: '1px solid #eef2f6', fontSize: 14, fontWeight: 600, color: '#0f1720' }}>{n}</div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {historyRoster && historyPopup && (() => {
          const histTournament = historyPopup.tournament;
          const histHeaderSolid = REPORT_TOURNAMENT_SOLID[histTournament];
          const closeRoster = () => setHistoryRoster(null);
          const CUT_SET = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
          const rosterGolfers = historyRoster.golfers ? [...historyRoster.golfers].sort((a, b) => b.points - a.points) : [];
          const isOpenHist = histTournament === 'open';
          const histGold = '#F4BC41';
          const histDivider = (histTournament === 'players' || histTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef';
          return (
            <div onClick={closeRoster} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(560px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: histHeaderSolid, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: isMobile ? 15 : 16, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{historyRoster.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {(KNOCKOUT_TAB_LOGOS[histTournament] ?? TOURNAMENT_TAB_LOGOS[histTournament]) && (
                      <img src={KNOCKOUT_TAB_LOGOS[histTournament] ?? TOURNAMENT_TAB_LOGOS[histTournament]} alt="" style={{ height: histTournament === 'pga' ? 52 : histTournament === 'players' ? 46 : histTournament === 'open' ? 36 : histTournament === 'masters' ? undefined : 32, width: histTournament === 'masters' ? 104 : undefined, margin: histTournament === 'pga' ? '-10px 0' : histTournament === 'players' ? '-7px 0' : undefined, maxWidth: 104, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                    )}
                    <button onClick={closeRoster} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', background: isOpenHist ? histGold : undefined }}>
                  {rosterGolfers.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#5b6b79', fontSize: 13.5, lineHeight: 1.5 }}>No roster was saved for this entry.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f3f6f9' }}>
                          <th style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>GOLFER</th>
                          <th style={{ textAlign: 'center', padding: '9px 6px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>SALARY</th>
                          <th style={{ textAlign: 'center', padding: '9px 6px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>POS</th>
                          <th style={{ textAlign: 'center', padding: '9px 8px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>POINTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rosterGolfers.map((g, i) => {
                          const cut = CUT_SET.has(String(g.score).toUpperCase()) || String(g.position).toUpperCase() === 'CUT';
                          const flagSrc = getPlayerFlag(g.name) ? getFlagSrc(g.name) : null;
                          const abbr = getCountryLabel(g.name) || null;
                          return (
                            <tr key={i} style={{ borderTop: histDivider }}>
                              <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: '#0f1720' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
                                  <span style={{ width: 20, marginRight: 5, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                                    {flagSrc && <img src={flagSrc} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: isOpenHist ? '0.5px solid #000' : '1px solid #d1d9e0' }} />}
                                  </span>
                                  <span style={{ width: 24, flexShrink: 0, fontSize: 10, fontWeight: 700, color: isOpenHist ? '#1e3a5f' : '#94a3b8' }}>{abbr || ''}</span>
                                  <span style={{ marginLeft: 8 }}>{g.name}</span>
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', padding: '9px 6px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: '#374151' }}>{g.salary ? `$${g.salary.toLocaleString()}` : '—'}</td>
                              <td style={{ textAlign: 'center', padding: '9px 6px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: '#374151' }}>{cut ? <span style={{ display: 'inline-block', background: '#dc2626', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>CUT</span> : (g.position || '—')}</td>
                              <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: g.points < 0 ? '#dc2626' : '#0f1720' }}>{g.points % 1 === 0 ? g.points : g.points.toFixed(1)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

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
                    <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt="" style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
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

        {showBonusPoints && (() => {
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
              style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
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
                      <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
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
                    <div onClick={() => setBonusInfoPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 120 }}>
                      <div onClick={(e) => e.stopPropagation()} style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 14, width: 'min(320px, 100%)', boxShadow: '0 18px 44px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                        <div style={{ background: bpHeaderBg, padding: '10px 12px 10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{bonusInfoPopup.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                              <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt="" style={{ height: selectedTournament === 'pga' ? 34 : selectedTournament === 'players' ? 30 : selectedTournament === 'open' ? 26 : selectedTournament === 'masters' ? undefined : 22, width: selectedTournament === 'masters' ? 64 : undefined, maxWidth: 72, objectFit: 'contain', display: 'block' }} />
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
        })()}

        {statLeaderboardModal !== null && (() => {
          const fullH = typeof window !== 'undefined' ? window.innerHeight : 800;
          const vpH = Math.min(visualVpHeight ?? fullH, fullH);
          const kbH = fullH - vpH; // keyboard height (0 when no keyboard)
          const kbUp = kbH > 80;
          const searchQ = statLbSearch.trim().toLowerCase();
          const allEntries = statLeaderboardModal.entries ?? [];
          // Default: top 15. Searching: all matches.
          const visibleEntries = searchQ ? allEntries.filter(e => e.name.toLowerCase().includes(searchQ)) : allEntries.slice(0, 15);
          const HEADER_H = 118;
          const ROW_H = 40;
          // Critical: add kbH as bottom padding on the backdrop so flex-end anchors
          // to the top of the keyboard, not the bottom of the window (which is behind keyboard).
          const kbPad = kbUp ? kbH + 8 : 0;
          // List maxHeight fills visible space above keyboard minus header and top margin.
          const listMaxH = kbUp
            ? Math.max(120, vpH - HEADER_H)
            : Math.floor(fullH * 0.65);
          // Only snap modal to bottom (near keyboard) when actively searching and results fit above keyboard.
          const estimatedListH = Math.min(visibleEntries.length * ROW_H + 18, listMaxH);
          const estimatedModalH = estimatedListH + HEADER_H;
          const snapToBottom = kbUp && !!searchQ && estimatedModalH <= (vpH - 16);
          const alignItems = !kbUp ? 'center' : snapToBottom ? 'flex-end' : 'flex-start';
          const padding = !kbUp ? '24px' : `4px 16px ${kbPad}px`;
          return (
          <div onClick={() => { setStatLeaderboardModal(null); setStatLbSearch(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.72)', display: 'flex', alignItems, justifyContent: 'center', padding, zIndex: 400 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
              <div style={{ background: '#0f1720', padding: '12px 18px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#607282', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>{statLeaderboardModal.subtitle}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{statLeaderboardModal.label}</div>
                    {statLeaderboardModal.tourAvg && <div style={{ fontSize: 11, fontWeight: 500, color: '#8fa3b1', marginTop: 2 }}>{statLeaderboardModal.avgLabel ?? 'Tour Avg'}: <span style={{ fontWeight: 700, color: '#b8cad6' }}>{statLeaderboardModal.tourAvg}</span></div>}
                  </div>
                  <button onClick={() => { setStatLeaderboardModal(null); setStatLbSearch(''); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 999, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>×</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search player..."
                    value={statLbSearch}
                    onChange={(e) => setStatLbSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: `4px ${statLbSearch ? 26 : 8}px 4px 8px`, fontSize: 16, border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, outline: 'none', color: '#0f1720', background: '#fff' }}
                  />
                  {statLbSearch && (
                    <button onMouseDown={(e) => { e.preventDefault(); setStatLbSearch(''); }} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#607282', fontSize: 15, lineHeight: 1, padding: 2 }}>×</button>
                  )}
                </div>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: `${listMaxH}px`, padding: '6px 0 12px' }}>
                {statLeaderboardModal.entries === null ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
                ) : statLeaderboardModal.entries.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No data available</div>
                ) : (() => {
                  const allEntries = statLeaderboardModal.entries!;
                  const searchQ = statLbSearch.trim().toLowerCase();
                  const entries = searchQ ? allEntries.filter(e => e.name.toLowerCase().includes(searchQ)) : allEntries;
                  const tourAvgNum = statLeaderboardModal.tourAvg ? parseFloat(statLeaderboardModal.tourAvg.replace('%', '')) : NaN;
                  const lowerIsBetter = ['scoringAverage', 'puttAverage'].includes(statLeaderboardModal.statKey);
                  let dividerIdx = -1;
                  if (!isNaN(tourAvgNum)) {
                    for (let di = 0; di < entries.length; di++) {
                      const v = parseFloat(entries[di].value.replace('%', ''));
                      if (!isNaN(v) && (lowerIsBetter ? v > tourAvgNum : v < tourAvgNum)) { dividerIdx = di; break; }
                    }
                  }
                  const rows: React.ReactNode[] = [];
                  entries.forEach((entry, i) => {
                    const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
                    const isSelected = !!statLeaderboardModal.playerName && normName(entry.name) === normName(statLeaderboardModal.playerName);
                    const rankColor = '#9ca3af';
                    if (i === dividerIdx) {
                      rows.push(
                        <div key="tour-avg-divider" style={{ display: 'flex', alignItems: 'center', padding: '5px 18px 5px 5px', background: '#f0f4f8', borderTop: '2px solid #0f1720', borderBottom: '2px solid #0f1720' }}>
                          <div style={{ flex: 1, height: 1, background: '#0f1720', opacity: 0.15 }} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#0f1720', padding: '0 10px', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{statLeaderboardModal.avgLabel ?? 'Tour Avg'}: {statLeaderboardModal.tourAvg}</span>
                          <div style={{ flex: 1, height: 1, background: '#0f1720', opacity: 0.15 }} />
                        </div>
                      );
                    }
                    rows.push(
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', padding: '9px 18px 9px 5px', borderBottom: i < entries.length - 1 ? `1px solid ${isSelected ? '#c0392b' : '#f0f4f8'}` : 'none', background: isSelected ? '#c0392b' : 'transparent', borderLeft: isSelected ? '4px solid #8b0000' : '4px solid transparent' }}>
                        {/* Rank — right-aligned so units digit always lines up (9 aligns with 0 in 10) */}
                        <div style={{ width: 26, fontSize: 12, fontWeight: 800, color: isSelected ? 'rgba(255,255,255,0.7)' : rankColor, flexShrink: 0, textAlign: 'right', marginRight: 6, paddingTop: 1, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}>{entry.rank}</div>
                        {/* Flag + country — fixed width so player name always starts at same X */}
                        <div style={{ width: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, paddingTop: 1 }}>
                          {getFlagSrc(entry.name) ? (
                            <>
                              <img src={getFlagSrc(entry.name)} alt="" style={{ height: 14, width: 20, objectFit: 'cover', borderRadius: 2, border: `1px solid ${isSelected ? 'rgba(255,255,255,0.4)' : '#d1d9e0'}`, flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.75)' : '#9ca3af', letterSpacing: '0.05em', width: 22, display: 'inline-block' }}>{getCountryLabel(entry.name)}</span>
                            </>
                          ) : null}
                        </div>
                        {/* Player name — wraps to second line if long; white on red if selected */}
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : '#0f1720', minWidth: 0, wordBreak: 'break-word', lineHeight: 1.3 }}>{entry.name}</span>
                        {/* Value — tabular nums + fixed width so every digit lines up vertically */}
                        <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : '#0f1720', flexShrink: 0, width: 68, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"', paddingTop: 1 }}>{entry.value}</div>
                      </div>
                    );
                  });
                  return rows;
                })()}
              </div>
            </div>
          </div>
          );
        })()}

        {winsListPopup !== null && (
          <div
            onClick={() => setWinsListPopup(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 300 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
            >
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #0f1720, #1f2d3a)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{winsListPopup.title}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#8fa3b1', marginTop: 2 }}>{winsListPopup.playerName} · {winsListPopup.wins.length} {winsListPopup.wins.length === 1 ? 'win' : 'wins'}</div>
                </div>
                <button
                  onClick={() => setWinsListPopup(null)}
                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                  aria-label="Close"
                >×</button>
              </div>
              {/* Win list — grouped by year, with major wins tinted in their tournament color */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {(() => {
                  // Group consecutive wins by year (the list is already sorted newest-first).
                  const groups: { year: string; wins: typeof winsListPopup.wins }[] = [];
                  for (const w of winsListPopup.wins) {
                    const last = groups[groups.length - 1];
                    if (last && last.year === w.year) last.wins.push(w);
                    else groups.push({ year: w.year, wins: [w] });
                  }
                  return groups.map((g) => (
                    <div key={g.year}>
                      {/* Year header band */}
                      <div style={{ background: '#eef2f6', padding: '5px 18px', fontSize: 11.5, fontWeight: 800, color: '#56657a', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8ef' }}>{g.year || '—'}</div>
                      {g.wins.map((w, i) => {
                        const theme = majorTint(w.tournament);
                        return (
                          <div key={`${w.tournament}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '11px 18px', background: theme ? theme.bg : '#fff', borderBottom: '1px solid #eef2f6' }}>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: 'block', fontSize: 13.5, color: theme ? theme.text : '#0f1720', fontWeight: 700 }}>{w.tournament || '—'}</span>
                              {w.course && <span style={{ display: 'block', fontSize: 11, color: theme ? theme.text : '#6b7c8c', opacity: theme ? 0.75 : 1, fontWeight: 500, marginTop: 1 }}>{w.course}</span>}
                            </span>
                            {w.toPar && <span style={{ flexShrink: 0, fontSize: 13, color: theme ? theme.text : '#475569', fontWeight: 800 }}>{w.toPar}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {pickHistoryPlayerPopup !== null && (
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
                  const careerLogoHeight = CAREER_TAB_LOGO_HEIGHTS[careerTournamentId] ?? 32;
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
                        ? <img src={careerLogo} alt={label} style={{ height: careerLogoHeight, maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
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
        )}

        {showRosterConfirm && (
          <div
            onClick={() => setShowRosterConfirm(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, width: '100%', maxWidth: 380, boxShadow: '0 18px 48px rgba(9,34,51,0.25)', overflow: 'hidden', maxHeight: 'calc(100vh - 40px - var(--safe-y))', display: 'flex', flexDirection: 'column' }}
            >
              {/* Coloured header */}
              <div style={{ background: entriesTournamentBg, padding: '16px 20px 14px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: hasSubmittedRoster ? 'center' : 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Confirm Your Roster</div>
                  {!hasSubmittedRoster && entryFee > 0 && (
                    <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.01em' }}>Pool Entry Fee: {formatMoney(entryFee)}</div>
                  )}
                </div>
                {TOURNAMENT_TAB_LOGOS[entriesTournamentId] && (
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={KNOCKOUT_TAB_LOGOS[entriesTournamentId] ?? TOURNAMENT_TAB_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={{ height: entriesTournamentId === 'pga' ? 60 : entriesTournamentId === 'players' ? 52 : entriesTournamentId === 'open' ? 40 : entriesTournamentId === 'masters' ? undefined : 36, width: entriesTournamentId === 'masters' ? 120 : undefined, margin: entriesTournamentId === 'pga' ? '-12px 0' : entriesTournamentId === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '14px 18px 18px', overflowY: 'auto' }}>
                {/* Roster list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
                  {orderedRosterPlayers.map((player) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                      <span style={{ fontWeight: 700, color: '#0f1720' }}>{player.name}</span>
                      <span style={{ fontWeight: 600, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', fontVariantNumeric: 'tabular-nums' }}>${player.salary.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: entriesTournamentId === 'open' ? '1px solid #8a8f96' : '1px solid #e8edf2', marginBottom: 10 }} />

                {/* Salary summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Salary used</span>
                  <span style={{ fontWeight: 700, color: '#0f1720', fontVariantNumeric: 'tabular-nums' }}>${salaryUsed.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Remaining</span>
                  <span style={{ fontWeight: 700, color: salaryRemaining < 0 ? '#dc2626' : '#0f1720', fontVariantNumeric: 'tabular-nums' }}>${salaryRemaining.toLocaleString()}</span>
                </div>

                <div style={{ borderTop: entriesTournamentId === 'open' ? '1px solid #8a8f96' : '1px solid #e8edf2', marginBottom: 10 }} />

                {/* Tiebreaker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 16 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Your tiebreaker</span>
                  <span style={{ fontWeight: 700, color: '#0f1720' }}>{tieBreakInput} <span style={{ fontWeight: 400, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#8a99a6' }}>(par {totalParFor(entriesTournamentId) ?? '—'})</span></span>
                </div>

                {/* Explanation for the Submit & Pay flow */}
                {!hasSubmittedRoster && paysEntryFeeInApp && (
                  <div style={{ fontSize: 11.5, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', lineHeight: 1.5, marginBottom: 10 }}>
                    *Hitting <b>Submit &amp; Pay</b>{' '}submits your roster and automatically opens <VenmoMark tone="blue" /> to {formatVenmo(entryFeeVenmo!.handle)} to pay the pool entry fee. The {formatMoney(entryFee)}{' '}amount and what it&apos;s for are auto-populated for you.
                  </div>
                )}
                {!hasSubmittedRoster && entryFee > 0 && !entryFeeVenmo && (
                  <div style={{ fontSize: 11.5, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', lineHeight: 1.5, marginBottom: 10 }}>
                    *Your commissioner hasn&apos;t added their <VenmoMark tone="blue" /> yet, so pay the {formatMoney(entryFee)} entry fee to them directly.
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {!hasSubmittedRoster ? (
                    <>
                      <button
                        onClick={async () => {
                          // Venmo opens ONLY after the roster save is confirmed — a failed save
                          // (expired session, network blip) must never send someone off to pay.
                          const saved = await handleSave();
                          setShowRosterConfirm(false);
                          if (!saved) return; // saveMessage shows the error on the pick sheet
                          setShowSubmitToast(true);
                          setTimeout(() => {
                            setShowSubmitToast(false);
                            if (paysEntryFeeInApp) openEntryFeePayment();
                          }, paysEntryFeeInApp ? 2000 : 1600);
                        }}
                        style={{ flex: 1, border: 'none', borderRadius: 12, padding: '13px 0', background: entriesTournamentBg, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
                      >
                        {paysEntryFeeInApp ? <>Submit &amp; Pay</> : 'Submit'}
                      </button>
                      <button
                        onClick={() => setShowRosterConfirm(false)}
                        style={{ flex: 1, border: entriesTournamentId === 'open' ? 'none' : '2px solid #dfe5eb', borderRadius: 12, padding: '13px 0', background: entriesTournamentId === 'open' ? '#dce6f5' : '#fff', color: entriesTournamentId === 'open' ? '#173b63' : '#374151', fontSize: 15, fontWeight: entriesTournamentId === 'open' ? 800 : 700, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setShowRosterConfirm(false); void handleSave(); }}
                        style={{ flex: 1, border: 'none', borderRadius: 12, padding: '13px 0', background: entriesTournamentBg, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => setShowRosterConfirm(false)}
                        style={{ flex: 1, border: entriesTournamentId === 'open' ? 'none' : '2px solid #dfe5eb', borderRadius: 12, padding: '13px 0', background: entriesTournamentId === 'open' ? '#dce6f5' : '#fff', color: entriesTournamentId === 'open' ? '#173b63' : '#374151', fontSize: 15, fontWeight: entriesTournamentId === 'open' ? 800 : 700, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
                {hasSubmittedRoster && paysEntryFeeInApp ? (
                  <button
                    type="button"
                    onClick={() => openEntryFeePayment()}
                    style={{ marginTop: 12, width: '100%', background: 'none', border: 'none', padding: 4, fontSize: 13, fontWeight: 800, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#008CFF', cursor: 'pointer' }}
                  >
                    Still need to pay? Pay your {formatMoney(entryFee)} entry fee on <VenmoMark tone="blue" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

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

