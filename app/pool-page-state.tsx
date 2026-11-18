// The main page's state and logic: session and league, picks, live feeds, standings, reports,
// commissioner tools. usePoolPage() returns everything the screens draw from; app/page.tsx and the
// screen components in app/screens/ read it. Moved out of app/page.tsx unchanged.

import { isNativeApp, settleViewAfterKeyboard } from './native-bridge';
import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type PaywallMode } from './paywall';
import { openVenmoPayment } from './venmo-ui';
import { ENTRY_FEE_NOTE } from '@/app/lib/venmo';
import { currentTournamentMeta, effectiveLockTime, getTournamentMeta, latestStartedSeason, picksSeason } from '@/app/lib/tournament-config';
import { History, Lock, Save } from 'lucide-react';
import { buildPlaceholderScoreBreakdown } from './lib/scoring';
import { SALARY_CAP, REQUIRED_GOLFERS, espnEventIdFor, COMMISSIONER_DISPLAY_NAME, FOUNDER_POOL_ID, TOURNAMENTS, PLAYER_FLAGS, canonicalName, cutShowAt, cutHideAt, pgaPhoto, playerPhotoSrc, photoOnError, PLAYER_POOL, ORIGINAL_WORLD_RANK_BY_ID, DEFAULT_ROSTERS, REPORT_TOURNAMENTS, POOL_SEASONS, rosterInSeason, tieBreakInSeason, withSeasonPicks, STATIC_ENTRIES, NO_SESSION_FLAGS, buildPricedPlayers, normalizeName, formatRosterField, parseRosterField, clearStoredMainTab, readStoredSession, writeStoredSession, clearStoredSession, purgeStoredAccounts, readRoster, saveGuestRoster, readFeedCache, writeFeedCache, getCurrentRoundLabel, centralInputToUtc, getTournamentEventWindow, getDisplayTournamentWindow, getTournamentCardStatuses, getDefaultTournamentId, formatTournamentStartDate, readJson, resetViewAfterMainTabChange, formatTeeTime, teeTimeIsPast, type TournamentId, type MainTab, type ReportType, type FeedRow, type FullFieldPlayer, type ScorecardData, type ArchivedStandingRow, type ArchivedStandingsData, type FeedResponse, type AuthUser, type PoolInfo, type PoolEntry, type CommissionerMember, type AuthMode, type StandingEntry, type SessionPayload, type SessionFlags, setCommissionerPreTournamentView, setLockTimeOverrides } from './pool-data';

export type SalaryMaps = { salaries: Record<number, number>; worldRanks: Record<number, number> };

// A missing salary list maps to one shared empty object (stable between renders).
const NO_OVERRIDES: Record<number, number> = {};

export function usePoolPage() {
  const initialTournament = getDefaultTournamentId(getTournamentCardStatuses(), new Date());
  const [mainTab, setMainTab] = useState<MainTab>('Standings');
  // Tab the My Entries pick-sheet editor was opened from, so its back button truly goes back.
  const myEntriesReturnTabRef = useRef<MainTab>('My Entries');
  // When returning from a commissioner tool page (?tab=commissioner), reopen the
  // Commissioner Hub tab once the session confirms the user can manage the pool.
  const [pendingCommissionerTab, setPendingCommissionerTab] = useState<boolean>(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'commissioner',
  );
  const [selectedTournament, setSelectedTournament] = useState<TournamentId>(initialTournament);
  const [selectedRoster, setSelectedRoster] = useState<number[]>(DEFAULT_ROSTERS[initialTournament]);
  const [activeStandingEntryId, setActiveStandingEntryId] = useState<string | null>(null);
  const [activeStandingGolferId, setActiveStandingGolferId] = useState<number | null>(null);
  const [scorecardGolferName, setScorecardGolferName] = useState<string | null>(null);
  const [scorecardGolferPhoto, setScorecardGolferPhoto] = useState<{pgaTourId: number; photoUrl?: string} | null>(null);
  const [scorecardGolferTeeTime, setScorecardGolferTeeTime] = useState<string | null>(null);
  const [scorecardGolferThru, setScorecardGolferThru] = useState<string | null>(null);
  const [scorecardGolferBackNineStart, setScorecardGolferBackNineStart] = useState(false);
  const [scorecardData, setScorecardData] = useState<ScorecardData | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [showPreviousRounds, setShowPreviousRounds] = useState(false);
  const [showBonusPoints, setShowBonusPoints] = useState(false);
  const [showTiebreakerRules, setShowTiebreakerRules] = useState(false);
  const [historyPopup, setHistoryPopup] = useState<{ tournament: TournamentId; year: number; loading: boolean; data: ArchivedStandingsData | null } | null>(null);
  // Pool Standings History report — selected tournament, plus the year (defaults to the most recent
  // COMPLETED season: the latest banked season earlier than the current live one, which is shown in
  // Standings — e.g. 2026 now, still 2026 during 2027, 2027 during 2028, and so on).
  const [pshTournament, setPshTournament] = useState<TournamentId | ''>('');
  const [pshYear, setPshYear] = useState<number>(() => {
    const cy = new Date().getFullYear();
    const prior = POOL_SEASONS.filter((y) => y < cy);
    return prior.length ? Math.max(...prior) : Math.max(...POOL_SEASONS);
  });
  const [historyRoster, setHistoryRoster] = useState<ArchivedStandingRow | null>(null);
  const archivedThisSession = useRef<Set<string>>(new Set());
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [reportsMenuRect, setReportsMenuRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  // Player Pick Summary report controls.
  const [ppsTournament, setPpsTournament] = useState<TournamentId | 'all' | ''>('');
  const [ppsSortBy, setPpsSortBy] = useState<'Picked' | 'Salary' | ''>('');
  const [ppsSearch, setPpsSearch] = useState('');
  // Player Pick Summary — "which entries picked this player" popup.
  const [ppsPickPopup, setPpsPickPopup] = useState<{ id: number; name: string; tournament: TournamentId } | null>(null);
  // Player Pick Summary "All" view — per-player popup breaking a player's picks down by major.
  const [ppsAllPlayerPopup, setPpsAllPlayerPopup] = useState<{ id: number; name: string; pgaTourId: number; photoUrl?: string } | null>(null);
  // Season/year selector shared by all reports; defaults to the current (latest) season.
  const [reportYear, setReportYear] = useState<number>(Math.max(...POOL_SEASONS));
  // Pool Member Pick Summary report control.
  const [pmpsEntryId, setPmpsEntryId] = useState<string>('');
  // Pool Member Pick History report control.
  const [pmphEntryId, setPmphEntryId] = useState<string>('');
  // Player Performance Summary report controls.
  const [ppfTournament, setPpfTournament] = useState<TournamentId | ''>('');
  const [ppfSearch, setPpfSearch] = useState('');
  const [ppfSortKey, setPpfSortKey] = useState<'finish' | 'par' | 'birdie' | 'eagle' | 'bogey' | 'double' | 'triple'>('finish');
  const [ppfSortDir, setPpfSortDir] = useState<'asc' | 'desc'>('asc');
  const [ppfSelectedRow, setPpfSelectedRow] = useState<string | null>(null);
  const ppfScrollRef = useRef<HTMLDivElement | null>(null);
  // Anchor at the top of the report card, so changing a selection snaps back to the report's top.
  const reportTopRef = useRef<HTMLDivElement | null>(null);
  const [ppfViewportW, setPpfViewportW] = useState(0);
  const [expandedBonusCategories, setExpandedBonusCategories] = useState<Set<string>>(new Set());
  const [bonusInfoPopup, setBonusInfoPopup] = useState<{ title: string; entries: { name: string; rounds: number[]; count?: number }[]; showCounts?: boolean } | null>(null);
  const [cutScorecardGolfer, setCutScorecardGolfer] = useState<{ name: string; pgaTourId: number; photoUrl?: string } | null>(null);
  const [cutScorecardData, setCutScorecardData] = useState<ScorecardData | null>(null);
  const [cutScorecardLoading, setCutScorecardLoading] = useState(false);
  const entryBreakdownRef = useRef<HTMLDivElement>(null);
  const [showPointsSystem, setShowPointsSystem] = useState(false);
  const [selectedLeaderboardPlayerId, setSelectedLeaderboardPlayerId] = useState<number | null>(null);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<'picked' | 'full'>('full');
  const [fullLeaderboardRows, setFullLeaderboardRows] = useState<Partial<Record<TournamentId, FullFieldPlayer[]>>>({});
  const [pickHistoryPlayerPopup, setPickHistoryPlayerPopup] = useState<{
    player: { id: number; name: string; pgaTourId: number; photoUrl?: string; worldRank?: number };
    results: Partial<Record<TournamentId, { position: string; score: string } | null>>;
    loading: boolean;
    fedexRank: number | null;
    dpWorldRank: number | null;
    owgrRank: number | null;
    fullResults: { tournament: string; date: string; course: string; position: string; tour: 'pga' | 'liv' | 'eur' }[] | null;
    fullResultsLoading: boolean;
    careerResults: { year: number; course: string; position: string }[] | null;
    careerResultsLoading: boolean;
    playerStats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null;
    playerSeasonStats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null;
    playerStatsLoading: boolean;
    playerRounds: { round: number; score: string }[] | null;
    statsContext: 'season' | 'tournament';
    // Tournament this popup was opened in the context of (a Pick History section's event,
    // else the selected tournament) — drives the stats context and the career tab.
    ctxTournamentId: TournamentId;
    defaultTab: 'stats' | 'season';
    statAverages: Record<string, string>;
    fieldAverages: Record<string, string>;
    statRanks: Record<string, string>;
    seasonStatRanks: Record<string, string>;
    fieldDistributions: Record<string, number[]>;
    playerBio: { height: string | null; weight: string | null; dob: string | null; age: number | null; birthPlace: string | null; college: string | null; collegeConfirmedAbsent: boolean; swing: string | null; turnedPro: number | null; pgaTourDebut: number | null; careerStarts: number | null; cutsMade: number | null; careerWins: number | null; majorStarts: number | null; majorCutsMade: number | null; majorWins: number | null; careerEarnings: string | null; pgaTourWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; majorWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null } | null;
    playerBioLoading: boolean;
    espnPhotoUrl: string | null;
    pgaPhotoUrl: string | null;
    tournamentStatsFetchedAt: string | null;
    seasonStatsFetchedAt: string | null;
    bioFetchedAt: string | null;
    rankingsChangedAt: string | null;
  } | null>(null);
  // Click-through popup listing each win (tournament + year) behind a player's Wins count.
  const [winsListPopup, setWinsListPopup] = useState<{ title: string; playerName: string; wins: { tournament: string; year: string; course: string | null; toPar: string | null }[] } | null>(null);
  const [pickHistoryView, setPickHistoryView] = useState<'stats' | 'season' | 'career' | 'bio'>('stats');
  const [statsSubView, setStatsSubView] = useState<'tournament' | 'season'>('tournament');
  const [statLeaderboardModal, setStatLeaderboardModal] = useState<{ label: string; statKey: string; subtitle: string; tourAvg: string | null; avgLabel?: string; playerName: string | null; entries: { rank: number; name: string; value: string }[] | null } | null>(null);
  const [statLbSearch, setStatLbSearch] = useState('');
  const [visualVpHeight, setVisualVpHeight] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => setVisualVpHeight(vv.height);
    vv.addEventListener('resize', handler);
    handler();
    return () => vv.removeEventListener('resize', handler);
  }, []);
  useEffect(() => {
    if (!pickHistoryPlayerPopup) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [pickHistoryPlayerPopup]);
  const [expandedCutIds, setExpandedCutIds] = useState<Set<string>>(new Set());
  const expandedCutTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [leaderboardSortMode, setLeaderboardSortMode] = useState<'default' | 'round-desc' | 'round-asc'>('default');
  const [leaderboardPickedSort, setLeaderboardPickedSort] = useState<'default' | 'desc' | 'asc'>('default');
  const [showCutInfo, setShowCutInfo] = useState(false);
  const [showHeaderCutInfo, setShowHeaderCutInfo] = useState(false);
  const [feeds, setFeeds] = useState<Partial<Record<TournamentId, FeedResponse>>>(() => {
    const initial: Partial<Record<TournamentId, FeedResponse>> = {};
    for (const t of TOURNAMENTS) {
      const cached = readFeedCache(t.id);
      if (cached) initial[t.id] = cached;
    }
    return initial;
  });
  // ESPN event id for a tournament's stats: its most recent event, from the schedule or, for a new
  // season whose id isn't in the schedule yet, the one live scoring found (sent with the feed).
  const statsEventId = (tid: TournamentId) => {
    const season = latestStartedSeason(tid) ?? picksSeason(tid);
    const fromFeed = feeds[tid]?.season === season ? feeds[tid]?.espnEventId : undefined;
    return espnEventIdFor(tid, season) ?? fromFeed;
  };
  const [isLoading, setIsLoading] = useState(() => readFeedCache(initialTournament) === null);
  const [error, setError] = useState('');
  const [feedRefreshNonce, setFeedRefreshNonce] = useState(0);
  const feed = feeds[selectedTournament] ?? null;
  const currentFullLeaderboardRows = fullLeaderboardRows[selectedTournament] ?? null;
  const [commissionerMembersRefreshNonce, setCommissionerMembersRefreshNonce] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  useEffect(() => {
    if (saveMessage === 'Lineup saved to your account for this tournament.') {
      const t = setTimeout(() => setSaveMessage(''), 5000);
      return () => clearTimeout(t);
    }
  }, [saveMessage]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Commissioner-set pool lock times (mirrors the module-level map so changes re-render).
  const [lockTimeOverrides, setLockTimeOverridesState] = useState<Partial<Record<TournamentId, string>>>({});
  useEffect(() => {
    fetch('/api/commissioner/lock-time', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { overrides?: Partial<Record<TournamentId, string>> }) => {
        if (d.overrides) { setLockTimeOverrides(d.overrides); setLockTimeOverridesState(d.overrides); }
      })
      .catch(() => { /* keep the built-in schedule */ });
  }, []);
  // Commissioner "show pre-tournament card" overrides, synced from the store at boot. The state
  // mirror only exists to force a re-render; the module-level maps above are what the status logic reads.
  const [preTournamentTick, setPreTournamentTick] = useState(0);
  const [preTournamentBusy, setPreTournamentBusy] = useState<TournamentId | null>(null);
  useEffect(() => {
    fetch('/api/commissioner/pre-tournament', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { overrides?: Partial<Record<TournamentId, boolean>>; manualAt?: Partial<Record<TournamentId, string>> }) => {
        setCommissionerPreTournamentView(d.overrides, d.manualAt);
        setPreTournamentTick((v) => v + 1);
      })
      .catch(() => { /* keep the built-in schedule */ });
  }, []);
  const savePreTournamentOverride = async (tournamentId: TournamentId, show: boolean) => {
    setPreTournamentBusy(tournamentId);
    try {
      const res = await fetch('/api/commissioner/pre-tournament', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId, show }) });
      const d = await res.json();
      if (res.ok && d.overrides) {
        setCommissionerPreTournamentView(d.overrides, d.manualAt ?? {});
        setPreTournamentTick((v) => v + 1);
        setNowTick(window.performance.timeOrigin + window.performance.now());
      }
    } catch { /* ignore; leave prior state */ }
    finally { setPreTournamentBusy(null); }
  };
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [sessionFlags, setSessionFlags] = useState<SessionFlags>(NO_SESSION_FLAGS);
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [paywallMode, setPaywallMode] = useState<PaywallMode | null>(null);
  // A league code from an invite link (/?join=CODE), kept until the user joins or dismisses it.
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
  // Pool members with the Reports year's picks (each tournament's picks from that season).
  const reportEntries = useMemo(() => poolEntries.map((entry) => withSeasonPicks(entry, reportYear)), [poolEntries, reportYear]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailExists, setForgotEmailExists] = useState(false);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  // A password reset email links to /?reset=<token>: open the reset popup straight to the
  // new-password step, and drop the token from the address bar so it isn't left in history.
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('reset');
    if (!token) return;
    url.searchParams.delete('reset');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the reset link from the address bar once on load
    setResetToken(token);
    setForgotOpen(true);
    setForgotEmailExists(true);
    setForgotNewPassword('');
    setForgotMessage('');
  }, []);
  const [registerForm, setRegisterForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    joinCode: '',
  });

  // Invite links look like /?join=CODE: signed out, it opens sign-up with the code filled in;
  // signed in, it opens the Leagues panel ready to join. The code is dropped from the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('join');
    if (!code) return;
    url.searchParams.delete('join');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    const normalized = code.trim().toUpperCase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingJoinCode(normalized);
    setRegisterForm((form) => ({ ...form, joinCode: normalized }));
    setAuthMode('register');
  }, []);
  const [commissionerMembers, setCommissionerMembers] = useState<CommissionerMember[]>([]);
  // Member id whose submitted roster is shown in the commissioner-hub roster popup.
  const [submittedRosterMemberId, setSubmittedRosterMemberId] = useState<string | null>(null);
  // Pick Popularity breakdown (commissioner hub) — collapsed by default.
  const [pickPopularityOpen, setPickPopularityOpen] = useState(false);
  // Player whose "picked by" entry list is shown in a popup (from the Pick Popularity rows).
  const [pickPopularityPlayer, setPickPopularityPlayer] = useState<{ id: number; name: string } | null>(null);
  // Pool Lock Time tool (commissioner hub): modal + datetime-local input in Central time.
  const [poolLockModalOpen, setPoolLockModalOpen] = useState(false);
  const [poolLockInput, setPoolLockInput] = useState('');
  const [poolLockBusy, setPoolLockBusy] = useState(false);
  const [poolLockMsg, setPoolLockMsg] = useState('');
  const poolLockMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePoolLockTime = async (clear: boolean) => {
    const iso = clear ? null : centralInputToUtc(poolLockInput);
    if (!clear && !iso) { setPoolLockMsg('Enter a valid date & time.'); return; }
    setPoolLockBusy(true); setPoolLockMsg('');
    try {
      const res = await fetch('/api/commissioner/lock-time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId: entriesTournamentId, lockAtUtc: iso }) });
      const d = await res.json();
      if (!res.ok) { setPoolLockMsg(d.error ?? 'Save failed.'); }
      else {
        const next: Partial<Record<TournamentId, string>> = d.overrides ?? {};
        setLockTimeOverrides(next);
        setLockTimeOverridesState(next);
        setPoolLockMsg(clear
          ? 'Cleared — using the automatic schedule again.'
          : `Saved — pool locks & goes live ${new Date(iso!).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} CST.`);
        // Success confirmations fade out on their own; errors stay until addressed.
        if (poolLockMsgTimer.current) clearTimeout(poolLockMsgTimer.current);
        poolLockMsgTimer.current = setTimeout(() => setPoolLockMsg(''), 4000);
      }
    } catch { setPoolLockMsg('Network error — try again.'); }
    setPoolLockBusy(false);
  };
  // Commissioner-hub Submitted Picks column ordering (A-Z default, or newest first).
  const [commissionerPicksSort, setCommissionerPicksSort] = useState<'alpha' | 'newest'>('alpha');
  // Where to land after editing picks opened from the submitted-roster popup: restore the
  // console view and reopen the popup (showing the updated roster) on back or save.
  const commissionerEditReturnRef = useRef<{ view: 'dashboard' | 'members' | 'member-picks'; memberId: string } | null>(null);
  const [commissionerBusy, setCommissionerBusy] = useState(false);
  const [commissionerError, setCommissionerError] = useState('');
  const [commissionerSuccess, setCommissionerSuccess] = useState('');
  const [commissionerConsoleView, setCommissionerConsoleView] = useState<'dashboard' | 'members' | 'member-picks'>('dashboard');
  const [commissionerMemberSearch, setCommissionerMemberSearch] = useState('');
  const [commissionerMemberSort, setCommissionerMemberSort] = useState<{ column: 'displayName' | 'email' | 'tournamentCount'; direction: 'asc' | 'desc' }>({ column: 'displayName', direction: 'asc' });
  const [entriesPlayerSearch, setEntriesPlayerSearch] = useState('');
  const [tieBreakInput, setTieBreakInput] = useState('');
  const [showRosterConfirm, setShowRosterConfirm] = useState(false);
  // Brief "Roster successfully submitted!" flash shown between Submit & Pay and the Venmo handoff.
  const [showSubmitToast, setShowSubmitToast] = useState(false);
  // Venmo: editing your own, the commissioner's entry fees and pay-winners screens, and the
  // venmo.com fallback when the Venmo app doesn't open.
  const [venmoModalOpen, setVenmoModalOpen] = useState(false);
  // Right after a new account confirms its email: the one-time "Add your Venmo" step.
  const [showVenmoSetup, setShowVenmoSetup] = useState(false);
  const [entryFeesOpen, setEntryFeesOpen] = useState(false);
  const [adminLeaguesOpen, setAdminLeaguesOpen] = useState(false);
  const [payWinnersOpen, setPayWinnersOpen] = useState(false);
  const [poolMessageOpen, setPoolMessageOpen] = useState(false);
  const [payoutPlanOpen, setPayoutPlanOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [venmoFallbackUrl, setVenmoFallbackUrl] = useState<string | null>(null);
  const [showSubmittedPicksPopup, setShowSubmittedPicksPopup] = useState(false);
  // Submitted Picks popup ordering: alphabetical by default, or newest submission first.
  const [submittedPicksSort, setSubmittedPicksSort] = useState<'alpha' | 'newest'>('alpha');
  const [commissionerPlayerSearch, setCommissionerPlayerSearch] = useState('');
  const [commissionerMemberModalOpen, setCommissionerMemberModalOpen] = useState(false);
  const [commissionerMemberModalView, setCommissionerMemberModalView] = useState<'menu' | 'displayName' | 'email' | 'confirmDelete' | 'confirmClearPicks'>('menu');
  const [commissionerRosterMemberId, setCommissionerRosterMemberId] = useState<string | null>(null);
  const [commissionerRosterSelection, setCommissionerRosterSelection] = useState<number[]>([]);
  const [commissionerTieBreakInput, setCommissionerTieBreakInput] = useState('');
  const [payoutForm, setPayoutForm] = useState({
    first: '',
    second: '',
    third: '',
  });
  const [winnerScoreInput, setWinnerScoreInput] = useState('');
  const [clearLeaderBusy, setClearLeaderBusy] = useState(false);
  const [clearLeaderMsg, setClearLeaderMsg] = useState<string | null>(null);
  // Pool management tools: which tool modal is open, and a generic confirm/cancel modal on top of it.
  const [poolToolModal, setPoolToolModal] = useState<null | 'payouts' | 'tiebreak' | 'roundLeader' | 'markStatus'>(null);
  const [poolToolConfirm, setPoolToolConfirm] = useState<null | { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }>(null);
  const [playerStatusInput, setPlayerStatusInput] = useState('');
  const [playerStatusBusy, setPlayerStatusBusy] = useState(false);
  const [playerStatusMsg, setPlayerStatusMsg] = useState<string | null>(null);
  const [selectedCommissionerMemberId, setSelectedCommissionerMemberId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountPreferencesView, setAccountPreferencesView] = useState<'root' | 'preferences' | 'password' | 'displayName'>('root');
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [accountDisplayName, setAccountDisplayName] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [myEntriesEditorOpen, setMyEntriesEditorOpen] = useState(false);
  const pickSheetOpenRef = useRef(false);
  const standingsColRef = useRef<HTMLElement>(null);
  const leaderboardColRef = useRef<HTMLElement>(null);
  const [myEntriesMenuOpen, setMyEntriesMenuOpen] = useState(false);
  const [myEntriesDetailView, setMyEntriesDetailView] = useState<'none' | 'history' | 'rename'>('none');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [memberCreateForm, setMemberCreateForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [memberEditForm, setMemberEditForm] = useState({
    displayName: '',
    email: '',
    password: '',
    rosters: {
      players: '',
      masters: '',
      pga: '',
      'us-open': '',
      open: '',
    } as Record<TournamentId, string>,
  });

  const [isMobile, setIsMobile] = useState(false);
  const [isSmallMobile, setIsSmallMobile] = useState(false);
  const [landscapeZoom, setLandscapeZoom] = useState(1);
  const [isLandscapePhone, setIsLandscapePhone] = useState(false);

  useLayoutEffect(() => {
    const right = leaderboardColRef.current;
    if (!right) return;
    if (isMobile) {
      right.style.height = '';
      right.style.maxHeight = '';
      return;
    }
    const left = standingsColRef.current;
    if (!left) return;
    const cap = `${left.offsetHeight}px`;
    if (leaderboardSearch) {
      right.style.height = 'auto';
      right.style.maxHeight = cap;
    } else {
      right.style.height = cap;
      right.style.maxHeight = '';
    }
  });

  const tournament = TOURNAMENTS.find((item) => item.id === selectedTournament) ?? TOURNAMENTS[0];
  // The app admin runs the app-wide tools for every league; a league's commissioners run its league
  // tools (members, picks open/lock, payouts, tiebreak).
  const isAppAdmin = sessionFlags.isAppAdmin;
  // A new account that hasn't entered its emailed code yet (accounts from before codes count as confirmed).
  const needsEmailCode = sessionUser?.emailVerified === false;
  const canManagePool = isAppAdmin || pool?.role === 'commissioner';
  const isFounderPool = pool?.id === FOUNDER_POOL_ID;

  useEffect(() => {
    if (sessionUser && pool && pendingJoinCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeagueModalOpen(true);
    }
  }, [sessionUser, pool, pendingJoinCode]);
  const tournamentCardStatuses = getTournamentCardStatuses(new Date(nowTick));
  // Reports privacy gate: another member's picks for a tournament are only revealed once that
  // tournament has actually started (its status is IN PROGRESS) or concluded (LOCKED). While it's
  // sitting in its pre-tournament / upcoming window (UP NEXT / ACTIVE / future), picks stay hidden.
  const picksRevealed = (tid: TournamentId): boolean => {
    const label = tournamentCardStatuses[tid]?.label;
    return label === 'IN PROGRESS' || label === 'LOCKED';
  };
  // Year-aware reveal for the Reports tab: a tournament's picks are visible whenever that
  // tournament's event FOR THE SELECTED REPORT YEAR has already begun (or concluded). Past
  // seasons are always reviewable; only tournaments that haven't started yet stay hidden. This
  // is intentionally independent of the live standings card (which may be flipped to a future
  // season's pre-tournament preview) so concluded results never get hidden behind that preview.
  const picksRevealedForYear = (tid: TournamentId, year: number): boolean => {
    const tournament = TOURNAMENTS.find((t) => t.id === tid);
    if (!tournament) return false;
    return new Date(nowTick) >= getTournamentEventWindow(tournament, year).inProgressAt;
  };
  const selectedTournamentStatus = tournamentCardStatuses[selectedTournament];
  // The season whose picks and results the selected tournament's standings show: the upcoming or
  // live event's, or, on the results view after an event, the season that event was played in.
  const selectedPicksSeason = picksSeason(selectedTournament, new Date(nowTick));
  const standingsSeason = selectedTournamentStatus?.label === 'LOCKED'
    ? (latestStartedSeason(selectedTournament, new Date(nowTick)) ?? selectedPicksSeason)
    : selectedPicksSeason;
  const standingsMeta = getTournamentMeta(selectedTournament, standingsSeason);
  const entriesTournamentId = getDefaultTournamentId(tournamentCardStatuses, new Date());
  const careerTournamentId = pickHistoryPlayerPopup?.ctxTournamentId ?? selectedTournament;
  const entriesTournament = TOURNAMENTS.find((item) => item.id === entriesTournamentId) ?? TOURNAMENTS[0];
  const entriesTournamentStatus = tournamentCardStatuses[entriesTournamentId];
  // Picks are open when the commissioner's toggle is on AND the event is in the pre-tournament/live
  // window (UP NEXT once the field is finalized, ACTIVE, or an unknown/null status) — the toggle is the
  // control, not the auto-computed status, so opening picks during UP NEXT works as intended.
  const entriesPicksOpenForTournament =
    (entriesTournamentStatus?.label === 'ACTIVE' || entriesTournamentStatus?.label === 'UP NEXT' || entriesTournamentStatus == null) &&
    pool?.picksOpen?.[entriesTournamentId] === true;
  // Show the "field being finalized" pre-view whenever picks aren't open; once the commissioner opens
  // them, show the actual pick sheet.
  const entriesPreFieldView = !entriesPicksOpenForTournament;
  // Locked when: the commissioner's manual toggle is ON, the event is live, OR the pool lock
  // time (manual override or built-in) has passed. A stored `false` from a past toggle must
  // NOT suppress the time-based lock (`?? ` did exactly that and let edits through post-lock).
  const entriesLockAtIso = effectiveLockTime(lockTimeOverrides[entriesTournamentId], currentTournamentMeta(entriesTournamentId, new Date(nowTick))?.lockAtUtc);
  const entriesLocked =
    pool?.lineupLocks?.[entriesTournamentId] === true ||
    entriesTournamentStatus?.label === 'IN PROGRESS' ||
    (!!entriesLockAtIso && nowTick >= new Date(entriesLockAtIso).getTime());
  const selectedTournamentPayouts = pool?.payouts?.[selectedTournament] ?? null;
  const commissionerTournamentPayouts = pool?.payouts?.[entriesTournamentId] ?? null;
  const commissionerTournamentWinnerScore = pool?.winnerScores?.[entriesTournamentId] ?? null;
  const commissionerTournamentLabel =
    entriesTournamentId === 'players' ? 'The Players Championship' :
    entriesTournamentId === 'masters' ? 'The Masters Tournament' :
    entriesTournamentId === 'pga' ? 'The PGA Championship' :
    entriesTournamentId === 'us-open' ? 'U.S. Open Championship' :
    entriesTournamentId === 'open' ? 'The Open Championship' :
    entriesTournament.name;
  const commissionerAutoWinner = feed?.tournamentComplete === true ? (feed?.players ?? []).find((p) => p.position === '1' && p.thru === 'F') : null;
  const commissionerAutoWinnerTotal = commissionerAutoWinner?.total && commissionerAutoWinner.total !== '--' ? parseInt(commissionerAutoWinner.total, 10) : NaN;
  const commissionerAutoDetected = !isNaN(commissionerAutoWinnerTotal) ? commissionerAutoWinnerTotal : null;
  const tiebreakResolved = commissionerAutoDetected ?? commissionerTournamentWinnerScore;
  const entriesTournamentCourseName = currentTournamentMeta(entriesTournamentId)?.courseName ?? '';
  const entriesTournamentPar = currentTournamentMeta(entriesTournamentId)?.par;

  useEffect(() => {
    const checkMobile = () => {
      // Inside the iPhone app, WebKit can report a desktop-sized width (980) while the page first
      // loads and never sends a resize afterwards, which left phones on the desktop layout. The
      // app is portrait-only on iPhone, so the screen width is a safe cap there. The website is unchanged.
      const w = isNativeApp ? Math.min(window.innerWidth, window.screen.width || window.innerWidth) : window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < 640);
      setIsSmallMobile(w < 415);
      // Scale down the desktop layout on landscape phones so everything fits proportionally.
      // Target effective content width: 1050px. Clamp zoom to [0.72, 1].
      // The iPhone app is portrait-only (iPads aren't phones), so this website scaling never applies there.
      const isLandscapePhone = !isNativeApp && h < 500 && w < 1100 && navigator.maxTouchPoints > 0;
      setIsLandscapePhone(isLandscapePhone);
      setLandscapeZoom(isLandscapePhone ? Math.max(0.72, Math.min(1, w / 1100)) : 1);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    // Re-check once the page has settled, and whenever the visible area changes size.
    window.addEventListener('load', checkMobile);
    const settle = window.setTimeout(checkMobile, 300);
    window.visualViewport?.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
      window.removeEventListener('load', checkMobile);
      window.clearTimeout(settle);
      window.visualViewport?.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Reload PWA when a new deployment is detected after backgrounding for 2+ minutes.
  useEffect(() => {
    let currentVersion: string | null = null;
    let hiddenAt: number | null = null;
    const MIN_HIDDEN_MS = 2 * 60 * 1000;

    fetch('/api/version').then(r => r.json()).then((d: { v?: string }) => {
      currentVersion = d.v ?? null;
    }).catch(() => {});

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null && Date.now() - hiddenAt > MIN_HIDDEN_MS) {
        hiddenAt = null;
        fetch('/api/version').then(r => r.json()).then((d: { v?: string }) => {
          if (currentVersion && d.v && d.v !== currentVersion) {
            window.location.reload();
          }
        }).catch(() => {});
      } else {
        hiddenAt = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const svgCodes = new Set(['us','au','ie','gb-sct','no','kr','jp','za','se','nz','dk','de','cl','co','ar','ve','be','at','fr','fi','cn','it','in','ph','fj','pr']);
    const usedCodes = [...new Set(Object.values(PLAYER_FLAGS))];
    usedCodes.forEach(code => {
      const img = new window.Image();
      img.src = `/flags/${svgCodes.has(code) ? code + '.svg' : code + '.png'}`;
    });
  }, []);

  // The league list and app-admin / create-league flags come with every session read; take them
  // on load and on background refresh too, not only after a sign-in or league change.
  const applySessionFlags = (payload: { leagues?: SessionFlags['leagues']; isAppAdmin?: boolean; canCreateLeague?: boolean }) => {
    if (!payload.leagues) return; // older saved sessions predate these fields
    setSessionFlags({
      leagues: payload.leagues,
      isAppAdmin: payload.isAppAdmin ?? false,
      canCreateLeague: payload.canCreateLeague ?? false,
    });
  };

  useEffect(() => {
    const loadSession = async () => {
      setSessionLoading(true);
      purgeStoredAccounts();
      const storedSnapshot = readStoredSession();

      if (storedSnapshot?.user) {
        setSessionUser(storedSnapshot.user);
        setPool(storedSnapshot.pool);
        setPoolEntries(storedSnapshot.entries);
        applySessionFlags(storedSnapshot);
      }

      try {
        const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });
        if (payload.user) {
          setSessionUser(payload.user);
          setPool(payload.pool);
          setPoolEntries(payload.entries);
          applySessionFlags(payload);
          writeStoredSession(payload);
        } else {
          // The server says this device is signed out (the session ended, was signed out
          // elsewhere, or the account is gone): show the sign-in screen.
          setSessionUser(null);
          setPool(null);
          setPoolEntries([]);
          clearStoredSession();
        }
      } catch {
        // No answer (offline, a dead zone on the course): keep showing what this device last
        // knew, if anything. The next refresh will settle it.
        if (!storedSnapshot?.user) {
          setSessionUser(null);
          setPool(null);
          setPoolEntries([]);
        }
      } finally {
        setSessionLoading(false);
      }
    };

    const silentRefresh = async () => {
      if (pickSheetOpenRef.current) return;
      try {
        const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });
        if (payload.user) {
          setSessionUser(payload.user);
          setPool(payload.pool);
          setPoolEntries(payload.entries);
          applySessionFlags(payload);
          writeStoredSession(payload);
        }
      } catch {
        // silent — don't disrupt the UI on background refresh
      }
    };

    void loadSession();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void silentRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const refreshTimer = window.setInterval(() => void silentRefresh(), 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    pickSheetOpenRef.current = myEntriesEditorOpen || !!commissionerRosterMemberId;
  }, [myEntriesEditorOpen, commissionerRosterMemberId]);

  useEffect(() => {
    // Keep the search box reset when the pick sheet closes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!myEntriesEditorOpen) setEntriesPlayerSearch('');
  }, [myEntriesEditorOpen]);

  useEffect(() => {
    // Keep the commissioner roster search reset when its editor closes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!commissionerRosterMemberId) setCommissionerPlayerSearch('');
  }, [commissionerRosterMemberId]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (sessionUser) {
      writeStoredSession({
        user: sessionUser,
        pool,
        entries: poolEntries,
      });
      return;
    }

    clearStoredSession();
  }, [pool, poolEntries, sessionLoading, sessionUser]);

  useEffect(() => {
    if (sessionUser) {
      // Sync the editor with the active user/tournament.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRoster(sessionUser.rosters[entriesTournamentId] ?? DEFAULT_ROSTERS[entriesTournamentId]);
      return;
    }

    // Sync the guest editor with the active tournament.
    setSelectedRoster(readRoster(entriesTournamentId));
  }, [entriesTournamentId, sessionUser]);

  useEffect(() => {
    if (!sessionUser) {
      saveGuestRoster(entriesTournamentId, selectedRoster);
    }
  }, [entriesTournamentId, selectedRoster, sessionUser]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Don't bounce during the initial session load — the layout effect below may
    // legitimately open the hub before the session has finished confirming access.
    if (mainTab === 'Commissioner Hub' && !canManagePool && !sessionLoading) {
      // Push unauthorized users back to the public standings tab.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMainTab('Standings');
    }
  }, [canManagePool, mainTab, sessionLoading]);

  useLayoutEffect(() => {
    // Returning from a commissioner tool page (?tab=commissioner): if the stored
    // session already shows a commissioner, switch to the hub *before* the browser
    // paints so the Standings tab never flashes.
    if (!pendingCommissionerTab) return;
    let isCommish = false;
    try {
      const snap = readStoredSession();
      isCommish = !!snap?.user && (snap.isAppAdmin === true || snap.pool?.role === 'commissioner');
    } catch { isCommish = false; }
    if (!isCommish) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMainTab('Commissioner Hub');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingCommissionerTab(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingCommissionerTab || sessionLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingCommissionerTab(false);
    if (canManagePool) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMainTab('Commissioner Hub');
      setCommissionerConsoleView('dashboard');
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [pendingCommissionerTab, sessionLoading, canManagePool]);

  useEffect(() => {
    // Mirror the selected tournament payout into the editable form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayoutForm({
      first: commissionerTournamentPayouts?.first ? String(commissionerTournamentPayouts.first) : '',
      second: commissionerTournamentPayouts?.second ? String(commissionerTournamentPayouts.second) : '',
      third: commissionerTournamentPayouts?.third ? String(commissionerTournamentPayouts.third) : '',
    });
  }, [commissionerTournamentPayouts?.first, commissionerTournamentPayouts?.second, commissionerTournamentPayouts?.third]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWinnerScoreInput(commissionerTournamentWinnerScore != null ? String(commissionerTournamentWinnerScore) : '');
  }, [commissionerTournamentWinnerScore]);

  useEffect(() => {
    let active = true;

    // Show cached tournaments immediately and only display loading when no cache exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(readFeedCache(selectedTournament) === null);

    const loadFeed = async () => {
      if (!readFeedCache(selectedTournament)) {
        setIsLoading(true);
      }
      setError('');

      try {
        const payload = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}`, {
          cache: 'no-store',
        });

        if (active) {
          setFeeds(prev => ({ ...prev, [selectedTournament]: payload }));
          writeFeedCache(selectedTournament, payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadFeed();
    const timer = window.setInterval(() => {
      void loadFeed();
    }, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [feedRefreshNonce, selectedTournament]);

  // Silently prefetch all other tournament feeds on mount so tab switches are instant
  useEffect(() => {
    for (const t of TOURNAMENTS) {
      if (readFeedCache(t.id)) continue;
      readJson<FeedResponse>(`/api/leaderboard?tournamentId=${t.id}`, { cache: 'no-store' })
        .then((payload) => {
          setFeeds(prev => ({ ...prev, [t.id]: payload }));
          writeFeedCache(t.id, payload);
        })
        .catch(() => { /* non-critical */ });
    }
  }, []);

  useEffect(() => {
    // Collapse temporary projected-cut affordances when switching context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedCutIds(new Set());
    expandedCutTimersRef.current.forEach((t) => clearTimeout(t));
    expandedCutTimersRef.current.clear();
  }, [selectedTournament, mainTab]);

  useEffect(() => {
    const fetchFull = () => {
      readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}&fullField=true`, { cache: 'no-store' })
        .then((data) => setFullLeaderboardRows(prev => ({ ...prev, [selectedTournament]: data.fullLeaderboard ?? [] })))
        .catch(() => { /* non-critical */ });
    };
    fetchFull();
    const timer = window.setInterval(fetchFull, 60000);
    return () => window.clearInterval(timer);
  }, [selectedTournament]);

  useEffect(() => {
    if (!isMobile) return;
    const el = document.querySelector<HTMLElement>('[data-leaderboard-table="true"]');
    if (el) el.scrollTop = 0;
    // Force iOS Safari to recalculate layout after content height changes
    requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY));
  }, [isMobile, leaderboardViewMode, leaderboardSortMode, leaderboardPickedSort]);

  useEffect(() => {
    const loadCommissionerMembers = async () => {
      if (!sessionUser || !canManagePool || mainTab !== 'Commissioner Hub') {
        return;
      }

      setCommissionerBusy(true);
      setCommissionerError('');

      try {
        const payload = await readJson<{ members: CommissionerMember[] }>('/api/commissioner/members', {
          cache: 'no-store',
        });
        setCommissionerMembers(payload.members);
      } catch (err) {
        setCommissionerError(err instanceof Error ? err.message : 'Unable to load pool members.');
      } finally {
        setCommissionerBusy(false);
      }
    };

    void loadCommissionerMembers();
  }, [canManagePool, commissionerMembersRefreshNonce, mainTab, sessionUser]);

  useEffect(() => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    const member = commissionerMembers.find((item) => item.id === selectedCommissionerMemberId);

    if (!member) {
      // The selected member was removed or refreshed away.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCommissionerMemberId(null);
      return;
    }

    // Populate the edit form from the selected commissioner member.
    setMemberEditForm({
      displayName: member.displayName,
      email: member.email,
      password: '',
      rosters: {
        players: formatRosterField(member.rosters.players),
        masters: formatRosterField(member.rosters.masters),
        pga: formatRosterField(member.rosters.pga),
        'us-open': formatRosterField(member.rosters['us-open']),
        open: formatRosterField(member.rosters.open),
      },
    });
  }, [selectedCommissionerMemberId, commissionerMembers]);

  useEffect(() => {
    // Keep the account form aligned with the current session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountDisplayName(sessionUser?.displayName ?? '');
  }, [sessionUser]);

  useEffect(() => {
    if (!commissionerSuccess) return;
    const timer = window.setTimeout(() => setCommissionerSuccess(''), 6000);
    return () => window.clearTimeout(timer);
  }, [commissionerSuccess]);

  useEffect(() => {
    // Clear success banners when changing commissioner context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommissionerSuccess('');
  }, [mainTab, commissionerConsoleView]);

  useEffect(() => {
    const anyOpen = !!activeStandingEntryId || !!activeStandingGolferId || !!scorecardGolferName || showBonusPoints;
    if (!anyOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [activeStandingEntryId, activeStandingGolferId, scorecardGolferName, showBonusPoints]);

  const applySession = (payload: SessionPayload) => {
    setSessionUser(payload.user);
    setPool(payload.pool);
    setPoolEntries(payload.entries);
    // Older stored sessions predate these fields; the next server refresh fills them in.
    if (payload.leagues) {
      setSessionFlags({
        leagues: payload.leagues,
        isAppAdmin: payload.isAppAdmin ?? false,
        canCreateLeague: payload.canCreateLeague ?? false,
      });
    }
    if (payload.user) {
      writeStoredSession(payload);
    } else {
      clearStoredSession();
    }
    setAuthError('');
  };

  const refreshCurrentSession = async () => {
    try {
      const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });

      if (payload.user) {
        applySession(payload);
      }
    } catch {
      // Keep the current UI in place if a soft refresh misses the network.
    }
  };

  const handleRegister = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      applySession(payload);
      settleViewAfterKeyboard();
      setRegisterForm({ firstName: '', lastName: '', email: '', password: '', joinCode: '' });
      setPendingJoinCode('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      applySession(payload);
      settleViewAfterKeyboard();
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      await readJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
      setSessionUser(null);
      setPool(null);
      setPoolEntries([]);
      setSessionFlags(NO_SESSION_FLAGS);
      setLeagueModalOpen(false);
      setCommissionerMembers([]);
      setSelectedCommissionerMemberId(null);
      setAccountMenuOpen(false);
      setAccountPreferencesView('root');
      setAccountPassword('');
      setAccountDisplayName('');
      setAccountMessage('');
      clearStoredSession();
      clearStoredMainTab();
      setMainTab('Standings');
      setSaveMessage('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateOwnPassword = async () => {
    setAccountBusy(true);
    setAccountMessage('');

    try {
      const payload = await readJson<{ user: AuthUser }>('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: accountPassword }),
      });

      setSessionUser(payload.user);
      setAccountPassword('');
      setAccountMessage('Password updated.');
    } catch (err) {
      setAccountMessage(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleUpdateOwnDisplayName = async () => {
    setAccountBusy(true);
    setAccountMessage('');

    try {
      const payload = await readJson<{ user: AuthUser }>('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: accountDisplayName }),
      });

      setSessionUser(payload.user);
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.user.id ? { ...entry, name: payload.user.displayName, rosters: payload.user.rosters } : entry,
        ),
      );
      setAccountMessage('Display name updated.');
      setMyEntriesDetailView('none');
    } catch (err) {
      setAccountMessage(err instanceof Error ? err.message : 'Unable to update display name.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleCreateMember = async () => {
    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>('/api/commissioner/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberCreateForm),
      });

      setCommissionerMembers((current) => [...current, payload.member]);
      setPoolEntries((current) => [...current, { id: payload.member.id, name: payload.member.displayName, rosters: payload.member.rosters, tieBreaks: payload.member.tieBreaks ?? {} }]);
      setMemberCreateForm({ displayName: '', email: '', password: '' });
      setShowAddMemberForm(false);
      setCommissionerSuccess('Member added.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to add member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleToggleLineupLock = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/lineup-lock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament,
          locked: !locked,
        }),
      });

      setPool((current) => (current ? { ...current, ...payload.pool } : payload.pool));
      setCommissionerSuccess(`Lineup lock ${payload.pool.lineupLocks[selectedTournament] ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update lineup lock.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleTogglePicksOpen = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const currentlyOpen = pool.picksOpen?.[selectedTournament] === true;
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/lineup-lock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament,
          picksOpen: !currentlyOpen,
        }),
      });

      setPool((current) => (current ? { ...current, ...payload.pool } : payload.pool));
      setCommissionerSuccess(`Picks ${payload.pool.picksOpen?.[selectedTournament] ? 'opened' : 'closed'}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update picks open state.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleSavePayouts = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: entriesTournamentId,
          first: Number(payoutForm.first),
          second: Number(payoutForm.second),
          third: Number(payoutForm.third),
        }),
      });

      setPool((current) => (current ? { ...current, ...payload.pool } : payload.pool));
      setCommissionerSuccess(
        `${commissionerTournamentLabel} payouts saved.`,
      );
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update payouts.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleClearRoundLeader = async (round: number) => {
    setClearLeaderBusy(true);
    setClearLeaderMsg(null);
    try {
      const res = await fetch(`/api/commissioner/round-leader?tournamentId=${entriesTournamentId}&round=${round}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setClearLeaderMsg((body as { error?: string }).error ?? 'Failed to clear.');
      } else {
        setClearLeaderMsg(`Round ${round} leader cleared.`);
      }
    } catch {
      setClearLeaderMsg('Network error.');
    } finally {
      setClearLeaderBusy(false);
    }
  };

  const handleMarkPlayerStatus = async (status: 'WD' | 'DQ' | 'MDF') => {
    const playerName = playerStatusInput.trim();
    if (!playerName) return;
    setPlayerStatusBusy(true);
    setPlayerStatusMsg(null);
    try {
      const res = await fetch('/api/commissioner/player-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: entriesTournamentId, playerName, status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlayerStatusMsg((body as { error?: string }).error ?? 'Failed to save.');
      } else {
        setPlayerStatusMsg(`${playerName} marked as ${status}.`);
        setPlayerStatusInput('');
      }
    } catch {
      setPlayerStatusMsg('Network error.');
    } finally {
      setPlayerStatusBusy(false);
    }
  };

  const handleSaveWinnerScore = async () => {
    const score = Number(winnerScoreInput);
    if (!Number.isFinite(score) || score < 200 || score > 400) {
      setCommissionerError('Enter a valid total stroke count (200–400).');
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/winner-score', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: entriesTournamentId, score }),
      });
      setPool((current) => (current ? { ...current, ...payload.pool } : payload.pool));
      setCommissionerSuccess(`${commissionerTournamentLabel} winner's score saved.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to save winner score.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleSelectCommissionerMember = (memberId: string) => {
    setSelectedCommissionerMemberId(memberId);
    setCommissionerError('');
    setCommissionerSuccess('');
  };

  const openCommissionerMemberModal = (memberId: string) => {
    handleSelectCommissionerMember(memberId);
    setCommissionerMemberModalView('menu');
    setCommissionerMemberModalOpen(true);
  };

  const openCommissionerMemberPicks = (memberId: string) => {
    const member = commissionerMembers.find((item) => item.id === memberId);

    if (!member) {
      return;
    }

    setSelectedCommissionerMemberId(memberId);
    setCommissionerRosterMemberId(memberId);
    setCommissionerRosterSelection(member.rosters[entriesTournamentId] ?? []);
    const existingTieBreak = member.tieBreaks?.[entriesTournamentId];
    setCommissionerTieBreakInput(existingTieBreak != null ? String(existingTieBreak) : '');
    setCommissionerMemberModalOpen(false);
    setCommissionerConsoleView('member-picks');
    setCommissionerError('');
    setCommissionerSuccess('');
  };

  const handleSaveCommissionerMember = async () => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${selectedCommissionerMemberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: memberEditForm.displayName,
            email: memberEditForm.email,
            password: memberEditForm.password,
            rosters: {
              players: parseRosterField(memberEditForm.rosters.players),
              masters: parseRosterField(memberEditForm.rosters.masters),
              pga: parseRosterField(memberEditForm.rosters.pga),
              'us-open': parseRosterField(memberEditForm.rosters['us-open']),
              open: parseRosterField(memberEditForm.rosters.open),
            },
          }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id ? { ...entry, name: payload.member.displayName, rosters: payload.member.rosters } : entry,
        ),
      );
      setSessionUser((current) =>
        current && current.id === payload.member.id ? payload.member : current,
      );
      setCommissionerSuccess('Member updated.');
      setMemberEditForm((current) => ({ ...current, password: '' }));
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleDeleteCommissionerMember = async () => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      await readJson<{ ok: boolean }>(`/api/commissioner/members/${selectedCommissionerMemberId}`, {
        method: 'DELETE',
      });

      setCommissionerMembers((current) => current.filter((member) => member.id !== selectedCommissionerMemberId));
      setPoolEntries((current) => current.filter((entry) => entry.id !== selectedCommissionerMemberId));
      setSessionUser((current) => (current?.id === selectedCommissionerMemberId ? null : current));
      setPool((current) => (sessionUser?.id === selectedCommissionerMemberId ? null : current));
      setSelectedCommissionerMemberId(null);
      setCommissionerRosterMemberId((current) => (current === selectedCommissionerMemberId ? null : current));
      setCommissionerMemberModalOpen(false);
      setCommissionerConsoleView((current) => (current === 'member-picks' ? 'members' : current));
      setCommissionerSuccess('Member deleted.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to delete member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  // Hands the league's one commissioner role to another member (you become a member). Refreshes
  // the session so your access and the league's contact update straight away.
  const [confirmHandOverId, setConfirmHandOverId] = useState<string | null>(null);
  const handleHandOverCommissioner = async (memberId: string, memberName: string) => {
    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      await readJson<{ member: AuthUser }>(`/api/commissioner/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'commissioner' }),
      });
      await refreshCurrentSession();
      setCommissionerMemberModalOpen(false);
      setConfirmHandOverId(null);
      setCommissionerSuccess(`${memberName} is now the commissioner.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to change the role.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleClearCommissionerMemberPicks = async () => {
    if (!selectedCommissionerMemberId) return;

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${selectedCommissionerMemberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rosters: { [entriesTournamentId]: [] }, tieBreaks: { [entriesTournamentId]: null } }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id
            ? { ...entry, rosters: payload.member.rosters }
            : entry,
        ),
      );
      setSessionUser((current) =>
        current && current.id === payload.member.id ? payload.member : current,
      );
      setCommissionerMemberModalOpen(false);
      setCommissionerMemberModalView('menu');
      setCommissionerSuccess(`Picks cleared for ${payload.member.displayName}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to clear picks.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const toggleCommissionerRosterPlayer = (playerId: number) => {
    if (commissionerRosterSelection.includes(playerId)) {
      setCommissionerRosterSelection(commissionerRosterSelection.filter((id) => id !== playerId));
      return;
    }

    if (commissionerRosterSelection.length >= REQUIRED_GOLFERS) {
      return;
    }

    const next = [...commissionerRosterSelection, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);

    if (nextSalary > SALARY_CAP) {
      return;
    }

    setCommissionerRosterSelection(next);
  };

  const handleSaveCommissionerRoster = async () => {
    if (!commissionerRosterMember) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${commissionerRosterMember.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rosters: {
              [entriesTournamentId]: commissionerRosterSelection,
            },
            tieBreaks: {
              [entriesTournamentId]: parseInt(commissionerTieBreakInput, 10),
            },
          }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id
            ? { ...entry, name: payload.member.displayName, rosters: payload.member.rosters }
            : entry,
        ),
      );
      setSessionUser((current) => (current && current.id === payload.member.id ? payload.member : current));
      setCommissionerSuccess(`${payload.member.displayName}'s ${commissionerTournamentLabel} picks were saved.`);
      const ret = commissionerEditReturnRef.current;
      commissionerEditReturnRef.current = null;
      setCommissionerConsoleView(ret ? ret.view : 'members');
      if (ret) setSubmittedRosterMemberId(ret.memberId);
      setCommissionerRosterMemberId(null);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to save member picks.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const feedMap = useMemo(() => {
    const rows = feed?.players ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName ?? ''), row])) as Record<
      string,
      FeedRow
    >;
  }, [feed]);

  const liveOddsMap = useMemo(() => {
    const rows = feed?.odds ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName), row.odds])) as Record<
      string,
      string
    >;
  }, [feed]);
  const [salaryByTournament, setSalaryByTournament] = useState<Record<string, SalaryMaps>>({});
  // Every season's lists (season -> tournament -> maps), for past standings and Reports by year.
  const [salaryBySeason, setSalaryBySeason] = useState<Record<number, Record<string, SalaryMaps>>>({});
  const salariesFor = (tournamentId: string, season: number): SalaryMaps | undefined =>
    salaryBySeason[season]?.[tournamentId] ?? (season === picksSeason(tournamentId) ? salaryByTournament[tournamentId] : undefined);
  // Players the commissioner's salary upload auto-added because they weren't in the static pool.
  const [dynamicPlayers, setDynamicPlayers] = useState<Array<{ id: number; name: string; pgaTourId: number; worldRank: number; defaultOdds: string }>>([]);
  const [salaryListLoaded, setSalaryListLoaded] = useState(false); // false until the fetch resolves
  // Re-fetchable so a fresh commissioner upload shows up without a hard reload (mobile back/bfcache
  // otherwise restores the pre-upload page without re-running the mount fetch).
  // Only calls state setters (which never change), so the function is created once.
  const loadSalaryOverrides = useRef<() => void>(() => {
    fetch('/api/salary-overrides', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { byTournament?: Record<string, { salaries?: Record<string, number>; worldRanks?: Record<string, number> }>; bySeason?: Record<string, Record<string, { salaries?: Record<string, number>; worldRanks?: Record<string, number> }>>; dynamicPlayers?: Array<{ id: number; name: string; pgaTourId: number; worldRank: number; defaultOdds: string }> }) => {
        if (!d) return;
        const toMaps = (lists: Record<string, { salaries?: Record<string, number>; worldRanks?: Record<string, number> }>) => {
          const byT: Record<string, SalaryMaps> = {};
          for (const [tid, m] of Object.entries(lists)) {
            const salaries: Record<number, number> = {};
            const worldRanks: Record<number, number> = {};
            for (const [k, v] of Object.entries(m.salaries ?? {})) salaries[Number(k)] = Number(v);
            for (const [k, v] of Object.entries(m.worldRanks ?? {})) worldRanks[Number(k)] = Number(v);
            byT[tid] = { salaries, worldRanks };
          }
          return byT;
        };
        setSalaryByTournament(toMaps(d.byTournament ?? {}));
        setSalaryBySeason(Object.fromEntries(Object.entries(d.bySeason ?? {}).map(([season, lists]) => [Number(season), toMaps(lists)])));
        if (Array.isArray(d.dynamicPlayers) && d.dynamicPlayers.length > 0) setDynamicPlayers(d.dynamicPlayers);
      })
      .catch(() => { /* keep built-in values */ })
      .finally(() => { setSalaryListLoaded(true); });
  });
  useEffect(() => {
    loadSalaryOverrides.current();
    // Re-fetch when the tab/app regains focus (e.g. returning from the commissioner upload page).
    const onShow = () => loadSalaryOverrides.current();
    window.addEventListener('focus', onShow);
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadSalaryOverrides.current(); });
    return () => {
      window.removeEventListener('focus', onShow);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);
  // The pick sheet is built from the CURRENT tournament's salaries/world ranks.
  // Read straight from state: the maps keep their identity until a new list loads, and a missing
  // list uses one shared empty map, so the player list isn't rebuilt on every render.
  const salaryOverrides = salaryByTournament[entriesTournamentId]?.salaries ?? NO_OVERRIDES;
  const worldRankOverrides = salaryByTournament[entriesTournamentId]?.worldRanks ?? NO_OVERRIDES;
  // No salary list has been uploaded for this tournament yet (salaries come only from the upload).
  const salaryListMissing = salaryListLoaded && Object.keys(salaryOverrides).length === 0;

  // Amateur / club-pro flags detected from the commissioner's field & salary uploads (canonical name
  // keys). Amateurs show a red "AMATEUR" in the bio's Turned Pro field; club pros get the PGA seal.
  const [amateurKeys, setAmateurKeys] = useState<Set<string>>(new Set());
  const [clubProKeys, setClubProKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    fetch('/api/player-tags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { amateur?: string[]; clubPro?: string[] }) => {
        if (cancelled || !d) return;
        if (Array.isArray(d.amateur)) setAmateurKeys(new Set(d.amateur));
        if (Array.isArray(d.clubPro)) setClubProKeys(new Set(d.clubPro));
      })
      .catch(() => { /* no tags yet */ });
    return () => { cancelled = true; };
  }, []);

  const players = useMemo(
    () =>
      buildPricedPlayers([...PLAYER_POOL, ...dynamicPlayers], liveOddsMap, salaryOverrides, worldRankOverrides).map((player) => {
        const live = feedMap[normalizeName(player.name)];
        const score = live?.score ?? '--';
        const position = live?.position ?? '--';
        const thru = live?.thru ?? '--';
        const scoreBreakdown =
          live?.scoreBreakdown ??
          buildPlaceholderScoreBreakdown({ position, score, thru });

        return {
          ...player,
          position,
          thru,
          score,
          total: live?.total ?? '--',
          currentRoundScore: live?.currentRoundScore ?? null,
          backNineStart: live?.backNineStart ?? false,
          teeTime: live?.teeTime ?? null,
          points: scoreBreakdown.totalPoints,
          holesRemaining: (score === 'CUT' || score === 'MDF') ? 0 : scoreBreakdown.holesRemaining,
          scoreBreakdown,
          lowRoundIds: live?.lowRoundIds ?? [],
          originalScore: live?.originalScore,
        };
      }),
    [feedMap, liveOddsMap, salaryOverrides, worldRankOverrides, dynamicPlayers],
  );

  const playersById = Object.fromEntries(players.map((player) => [player.id, player]));

  // Directory of every pickable player by id (name/photo/pga id), independent of the tournament in
  // view — used by the Reports feature, which aggregates picks across any of the five tournaments.
  const playerDirectory = useMemo(() => {
    const map = new Map<number, { id: number; name: string; pgaTourId: number; photoUrl?: string }>();
    for (const p of [...PLAYER_POOL, ...dynamicPlayers]) {
      map.set(p.id, { id: p.id, name: p.name, pgaTourId: p.pgaTourId, photoUrl: (p as { photoUrl?: string }).photoUrl });
    }
    return map;
  }, [dynamicPlayers]);

  // Turn a leaderboard position string ("1", "T4", "CUT") into a sortable finish rank (lower = better).
  const positionSortRank = (pos?: string) => {
    if (!pos) return 9999;
    const s = pos.toUpperCase().trim();
    if (s === '' || s === '--' || s === 'CUT' || s === 'MC' || s === 'MDF' || s === 'WD' || s === 'DQ') return 9000;
    const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(n) ? 9500 : n;
  };

  // Player Pick Summary result — recomputed automatically whenever a tournament and a
  // sort option are both selected (no explicit "Go" step).
  const ppsResult = useMemo(() => {
    if (!ppsTournament || !ppsSortBy) return null;
    // "All tournaments" — combined pick counts for every player picked at least once across all
    // majors year to date. Only "Times Picked" applies (salary/finish vary by event), most-picked
    // first with alphabetical tiebreaks.
    if (ppsTournament === 'all') {
      // Only combine tournaments whose picks are revealed for the selected report year (started
      // or concluded); upcoming tournaments' picks stay private until they begin.
      const clockNow = new Date(nowTick);
      const revealed = (tid: TournamentId) => {
        const tournament = TOURNAMENTS.find((t) => t.id === tid);
        return !!tournament && clockNow >= getTournamentEventWindow(tournament, reportYear).inProgressAt;
      };
      const countById = new Map<number, number>();
      for (const entry of reportEntries) {
        for (const t of REPORT_TOURNAMENTS) {
          if (!revealed(t.id)) continue;
          for (const pid of entry.rosters[t.id] ?? []) countById.set(pid, (countById.get(pid) ?? 0) + 1);
        }
      }
      const rows = Array.from(countById.entries())
        .map(([pid, count]) => {
          const p = playerDirectory.get(pid);
          if (!p) return null;
          return { id: pid, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, count, salary: 0, position: '--' };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      rows.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
      return { tournament: 'all' as const, sortBy: 'Picked' as const, rows };
    }
    const T = ppsTournament;
    const sortBy = ppsSortBy;
    const posByName = new Map<string, string>();
    for (const row of feeds[T]?.players ?? []) posByName.set(normalizeName(row.canonicalName ?? ''), row.position);
    const salaries = salariesFor(T, reportYear)?.salaries ?? {};
    const countById = new Map<number, number>();
    for (const entry of reportEntries) {
      for (const pid of entry.rosters[T] ?? []) countById.set(pid, (countById.get(pid) ?? 0) + 1);
    }
    const rows = Array.from(countById.entries())
      .map(([pid, count]) => {
        const p = playerDirectory.get(pid);
        if (!p) return null;
        const position = posByName.get(normalizeName(p.name)) ?? '--';
        return { id: pid, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, count, salary: salaries[pid] ?? 0, position };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    rows.sort((a, b) =>
      sortBy === 'Salary'
        ? (b.salary - a.salary) || (positionSortRank(a.position) - positionSortRank(b.position)) || a.name.localeCompare(b.name)
        : (b.count - a.count) || (positionSortRank(a.position) - positionSortRank(b.position)) || a.name.localeCompare(b.name),
    );
    return { tournament: T, sortBy, rows };
  }, [ppsTournament, ppsSortBy, feeds, salaryByTournament, salaryBySeason, reportEntries, playerDirectory, nowTick, preTournamentTick, reportYear]);

  // Full-field performance rows for the Player Performance Summary — one per player in the chosen
  // tournament's field, with finish, score to par, and every scoring/bonus stat.
  const ppfRows = useMemo(() => {
    if (!ppfTournament) return [];
    const T = ppfTournament;
    const feedT = feeds[T];
    if (!feedT) return [];
    const worldRanks = salaryByTournament[T]?.worldRanks ?? {};
    const nameToId = new Map<string, number>();
    for (const [id, p] of playerDirectory) nameToId.set(normalizeName(p.name), id);
    const CUTS = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
    const toParNum = (s?: string) => { if (!s) return NaN; const u = s.toUpperCase().trim(); if (u === 'E') return 0; const n = parseFloat(u); return Number.isNaN(n) ? NaN : n; };
    const rank = (pos?: string) => {
      if (!pos) return 9999;
      const s = pos.toUpperCase().trim();
      if (s === '' || s === '--' || s === 'CUT' || s === 'MC' || s === 'MDF' || s === 'WD' || s === 'DQ') return 9000;
      const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
      return Number.isNaN(n) ? 9500 : n;
    };
    return (feedT.players ?? []).map((row) => {
      const nm = row.canonicalName ?? '';
      const id = nameToId.get(normalizeName(nm)) ?? null;
      const sl = row.scoreBreakdown?.statLine;
      const rl = row.scoreBreakdown?.roundLeadersAwarded;
      const isCut = CUTS.has(String(row.score).toUpperCase());
      const scoreRaw = isCut ? toParNum(row.originalScore) : toParNum(row.score);
      return {
        id,
        name: nm,
        worldRank: id != null && worldRanks[id] != null ? worldRanks[id] : null,
        position: row.position,
        posRank: rank(row.position),
        madeCut: row.scoreBreakdown?.madeCut ?? !isCut,
        scoreNum: Number.isNaN(scoreRaw) ? 9999 : scoreRaw,
        scoreDisplay: Number.isNaN(scoreRaw) ? '--' : scoreRaw === 0 ? 'E' : scoreRaw > 0 ? `+${scoreRaw}` : String(scoreRaw),
        par: sl?.par ?? 0,
        birdie: sl?.birdie ?? 0,
        eagle: sl?.eagle ?? 0,
        bogey: sl?.bogey ?? 0,
        double: sl?.doubleBogey ?? 0,
        triple: sl?.tripleOrWorse ?? 0,
        ace: sl?.holeInOne ?? 0,
        streak: sl?.threeBirdieStreaks ?? 0,
        bogeyFree: sl?.bogeyFreeRounds ?? 0,
        lowRound: sl?.lowRounds ?? 0,
        r1: rl?.first ?? false,
        r2: rl?.second ?? false,
        r3: rl?.third ?? false,
      };
    });
  }, [ppfTournament, feeds, salaryByTournament, playerDirectory]);

  // Track the visible width of the Player Performance table's scroll area so the in-table cut-line
  // label can be pinned to the center of what's on screen (not the center of the full wide table).
  useLayoutEffect(() => {
    const el = ppfScrollRef.current;
    if (!el) { setPpfViewportW(0); return; }
    const update = () => setPpfViewportW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedReport, ppfTournament, mainTab, ppfSortKey, ppfSearch]);

  // Whenever a report is regenerated by a new selection (tournament, sort-by, member, or year),
  // snap back to the top of the report so the fresh results are shown from the beginning — even if
  // the user had scrolled down in the previous view. Also reset the Player Performance table's own
  // internal scroll region to the top.
  useEffect(() => {
    if (mainTab !== 'Reports' || !selectedReport) return;
    reportTopRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    if (ppfScrollRef.current) ppfScrollRef.current.scrollTop = 0;
  }, [selectedReport, mainTab, ppsTournament, ppsSortBy, ppfTournament, pmphEntryId, pmpsEntryId, pshTournament, reportYear, pshYear]);

  // Year/season picker shown to the right of every report header; defaults to the current season.
  const reportYearSelect = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
      <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Year</label>
      <select
        value={reportYear}
        onChange={(e) => setReportYear(Number(e.target.value))}
        style={{ appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '8px 30px 8px 12px', fontSize: 14, fontWeight: 700, color: '#0f1720', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center' }}
      >
        {[...POOL_SEASONS].sort((a, b) => b - a).map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );

  const selectedCommissionerMember =
    commissionerMembers.find((member) => member.id === selectedCommissionerMemberId) ?? null;
  const filteredCommissionerMembers = commissionerMembers
    .filter((member) => {
      const query = commissionerMemberSearch.trim().toLowerCase();
      if (!query) return true;
      return member.displayName.toLowerCase().includes(query) || member.email.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (commissionerMemberSort.column === 'tournamentCount') {
        const countA = TOURNAMENTS.filter((event) => (a.rosters[event.id] ?? []).length > 0).length;
        const countB = TOURNAMENTS.filter((event) => (b.rosters[event.id] ?? []).length > 0).length;
        const cmp = countA - countB;
        return commissionerMemberSort.direction === 'asc' ? cmp : -cmp;
      }
      const valA = a[commissionerMemberSort.column].toLowerCase();
      const valB = b[commissionerMemberSort.column].toLowerCase();
      const cmp = valA.localeCompare(valB);
      return commissionerMemberSort.direction === 'asc' ? cmp : -cmp;
    });
  const commissionerRosterMember =
    commissionerMembers.find((member) => member.id === commissionerRosterMemberId) ?? null;
  const filteredEntriesPlayers = players
    .filter((player) => {
      if (player.salary <= 0) return false; // not on the uploaded list → not pickable
      if (selectedRoster.includes(player.id)) return false;
      const query = entriesPlayerSearch.trim().toLowerCase();
      if (!query) return true;
      return player.name.toLowerCase().includes(query);
    })
    .sort((a, b) => b.salary - a.salary);
  const filteredCommissionerPlayers = players
    .filter((player) => {
      if (player.salary <= 0) return false; // not on the uploaded list → not pickable
      if (commissionerRosterSelection.includes(player.id)) return false;
      const query = commissionerPlayerSearch.trim().toLowerCase();
      if (!query) return true;
      return player.name.toLowerCase().includes(query);
    })
    .sort((a, b) => b.salary - a.salary);

  const savedRoster = sessionUser?.rosters[entriesTournamentId] ?? [];
  const hasSubmittedRoster = savedRoster.length === REQUIRED_GOLFERS;
  // Entry fee for the tournament being picked, and the commissioner's Venmo it's paid to. Members
  // pay in the app only when both are set (and the collector doesn't pay themselves).
  const entryFee = pool?.entryFees?.[entriesTournamentId] ?? 0;
  const entryFeeVenmo = pool?.venmo ?? null;
  const paysEntryFeeInApp = entryFee > 0 && !!entryFeeVenmo && entryFeeVenmo.userId !== sessionUser?.id;
  const openEntryFeePayment = () => {
    if (!entryFeeVenmo || entryFee <= 0) return;
    openVenmoPayment({ recipient: entryFeeVenmo.handle, amount: entryFee, note: ENTRY_FEE_NOTE }, setVenmoFallbackUrl);
  };
  const submittedEntries = poolEntries.filter((entry) => (entry.rosters[entriesTournamentId] ?? []).length === REQUIRED_GOLFERS);
  const otherSubmittedEntriesCount = sessionUser
    ? submittedEntries.filter((entry) => entry.id !== sessionUser.id).length
    : submittedEntries.length;
  const submittedCommissionerMembers = commissionerMembers
    .filter((member) => (member.rosters[entriesTournamentId] ?? []).length === REQUIRED_GOLFERS)
    .sort((a, b) => {
      if (commissionerPicksSort === 'newest') {
        const ta = a.rosterSubmittedAt?.[entriesTournamentId] ?? '';
        const tb = b.rosterSubmittedAt?.[entriesTournamentId] ?? '';
        if (ta !== tb) return tb.localeCompare(ta); // newest first
      }
      return a.displayName.localeCompare(b.displayName);
    });
  const pendingCommissionerMembers = commissionerMembers
    .filter((member) => (member.rosters[entriesTournamentId] ?? []).length !== REQUIRED_GOLFERS)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const rosterPlayers = selectedRoster.map((id) => playersById[id]).filter(Boolean);
  const orderedRosterPlayers = [...rosterPlayers].sort((left, right) => right.salary - left.salary);
  const savedRosterPlayers = savedRoster.map((id) => playersById[id]).filter(Boolean);
  const salaryUsed = rosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const salaryRemaining = SALARY_CAP - salaryUsed;
  const playersNeeded = Math.max(0, REQUIRED_GOLFERS - selectedRoster.length);
  const averageRemainingPerPlayer =
    playersNeeded > 0 ? Math.max(0, Math.floor(salaryRemaining / playersNeeded)) : 0;
  const commissionerRosterPlayers = commissionerRosterSelection.map((id) => playersById[id]).filter(Boolean);
  const commissionerOrderedRosterPlayers = [...commissionerRosterPlayers].sort(
    (left, right) => right.salary - left.salary,
  );
  const commissionerSalaryUsed = commissionerRosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const commissionerSalaryRemaining = SALARY_CAP - commissionerSalaryUsed;
  const commissionerPlayersNeeded = Math.max(0, REQUIRED_GOLFERS - commissionerRosterSelection.length);
  const commissionerAverageRemainingPerPlayer =
    commissionerPlayersNeeded > 0
      ? Math.max(0, Math.floor(commissionerSalaryRemaining / commissionerPlayersNeeded))
      : 0;
  const canSaveCommissionerRoster =
    !!commissionerRosterMember &&
    commissionerRosterSelection.length === REQUIRED_GOLFERS &&
    commissionerSalaryUsed <= SALARY_CAP &&
    /^\d{3}$/.test(commissionerTieBreakInput);
  const locked = pool?.lineupLocks?.[selectedTournament] ?? selectedTournamentStatus?.label === 'IN PROGRESS';
  const showFinalTournamentView = selectedTournamentStatus?.label === 'LOCKED';
  const isTournamentFinal = feed?.tournamentComplete === true;
  const roundOneComplete =
    (feed?.currentRound ?? 1) > 1 ||
    ((feed?.currentRound ?? 1) === 1 && /official|complete|final/i.test(feed?.status ?? ''));
  const roundTwoComplete =
    (feed?.currentRound ?? 1) > 2 ||
    ((feed?.currentRound ?? 1) === 2 && /official|complete|final/i.test(feed?.status ?? ''));
  const roundThreeComplete =
    (feed?.currentRound ?? 1) > 3 ||
    ((feed?.currentRound ?? 1) === 3 && /official|complete|final/i.test(feed?.status ?? ''));
  const currentRoundComplete = /official|complete|final/i.test(feed?.status ?? '');
  const currentRoundSuspended = /suspended/i.test(feed?.status ?? '');
  // Once the real cut is applied (players carry Missed Cut markers) the projection is
  // obsolete — stop showing it regardless of the time window.
  const cutAssigned =
    (feed?.players?.some((p) => p.score === 'CUT') ?? false) ||
    (currentFullLeaderboardRows ?? []).some((p) => p.score === 'CUT');
  const showProjectedCut = (() => {
    if (selectedTournamentStatus?.label !== 'IN PROGRESS') return false;
    if (cutAssigned) return false;
    const liveMeta = currentTournamentMeta(selectedTournament, new Date(nowTick));
    if (!liveMeta) return false;
    const now = nowTick;
    if (now < cutShowAt(liveMeta, selectedTournament)) return false;
    return now < cutHideAt(liveMeta);
  })();
  // Fills the slot right of the round chip when no projected cut is displayed: the time
  // of day at the course while a round is in progress/suspended (ticks with nowTick).
  const courseLocalTimeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: standingsMeta?.timeZone ?? 'America/New_York',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(nowTick)).toLowerCase();
  // Once a round is complete, the same slot shows when the next round begins — the
  // earliest future tee time from the feed (ESPN posts next-round times on the rows).
  const nextRoundStartLabel = (() => {
    if (!currentRoundComplete) return null;
    const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    let bestMs: number | null = null;
    let bestStr: string | null = null;
    for (const p of [...(feed?.players ?? []), ...(currentFullLeaderboardRows ?? [])]) {
      const t = p.teeTime;
      if (!t) continue;
      const m = t.match(/\w+ (\w{3}) (\d+) (\d{1,2}):(\d{2}):\d{2} \w+ (\d{4})/);
      if (!m) continue;
      const [, monthName, day, hour, min, year] = m;
      const month = MONTHS[monthName];
      if (!month) continue;
      // Same convention as teeTimeIsPast: ESPN stores EDT but mislabels the zone.
      const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:00-04:00`);
      if (isNaN(d.getTime()) || d.getTime() <= nowTick) continue;
      if (bestMs === null || d.getTime() < bestMs) { bestMs = d.getTime(); bestStr = t; }
    }
    return bestStr ? `${formatTeeTime(bestStr)} CST` : null;
  })();
  const nextRoundNum = Math.min(4, (feed?.currentRound ?? 1) + 1);
  const showFutureTournamentView =
    selectedTournamentStatus?.label === 'UP NEXT' ||
    selectedTournamentStatus?.label === 'ACTIVE' ||
    selectedTournamentStatus === null;
  const showLivePayoutStrip =
    selectedTournamentStatus?.label === 'IN PROGRESS' || selectedTournamentStatus?.label === 'LOCKED';
  // Tournament stats (and the Season/Tournament toggle) appear, and default to Tournament, as soon as
  // the event is underway (Round 1) — i.e. whenever it's IN PROGRESS — and stay for completed (LOCKED)
  // events. Before play begins (UP NEXT / ACTIVE / future) the popup shows Season stats only.
  const tournamentStatsUnlocked =
    selectedTournamentStatus?.label === 'LOCKED' ||
    selectedTournamentStatus?.label === 'IN PROGRESS';
  const displayTournamentWindow = getDisplayTournamentWindow(tournament, new Date(nowTick));
  const currentRoundLabel = selectedTournamentStatus?.label === 'LOCKED'
    ? 'Round 4'
    : getCurrentRoundLabel(displayTournamentWindow.startDate, new Date(nowTick));
  // Same rule for the standings card's Make Picks / Edit Picks button: the commissioner's toggle opens
  // picks during the pre-tournament (UP NEXT) window, not only once the event is ACTIVE.
  // "Picks are open" for the upcoming card only when picks are open AND the lineup is unlocked — a
  // stale picksOpen flag left true from a concluded (auto-locked) cycle must not read as open again.
  const picksOpenForTournament =
    showFutureTournamentView &&
    pool?.picksOpen?.[selectedTournament] === true &&
    pool?.lineupLocks?.[selectedTournament] !== true;
  const tournamentStartLabel = formatTournamentStartDate(displayTournamentWindow.inProgressAt);
  // Monday of tournament week (Thursday start minus 3 days) — when the finalized field is
  // entered and picks open, shown in the pre-tournament standings card.
  const tournamentFieldMondayLabel = (() => {
    const d = new Date(displayTournamentWindow.inProgressAt);
    d.setDate(d.getDate() - 3);
    return `Monday, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}`;
  })();

  // Picks-lock deadline in Central time, derived from the tournament's configured lock
  // timestamp (e.g. The Open locks 05:35 UTC = 12:35 am CST on Thursday).
  const lineupDeadlineLabel = (() => {
    const lockAt = effectiveLockTime(lockTimeOverrides[selectedTournament], currentTournamentMeta(selectedTournament, new Date(nowTick))?.lockAtUtc);
    if (!lockAt) return '6:15 am CST on Thursday';
    const d = new Date(lockAt);
    const time = d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const day = d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long' });
    return `${time} CST on ${day}`;
  })();

  const userLabel = sessionUser?.displayName ?? 'Guest lineup';

  const openPlayerPopup = (rawPlayer: { id: number; name: string; pgaTourId: number; photoUrl?: string; worldRank?: number }, defaultTab: 'stats' | 'season' = 'stats', ctxTournamentId?: TournamentId) => {
    // Canonicalize feed-name variants (e.g. "Samuel Stevens" -> "Sam Stevens") so the bio,
    // ranks, photo and flag all resolve to the same pool player. worldRank is pinned to the ORIGINAL
    // static rank (never the commissioner's uploaded pick-list rank) so the info popup is unaffected.
    const player = {
      ...rawPlayer,
      name: canonicalName(rawPlayer.name),
      worldRank: ORIGINAL_WORLD_RANK_BY_ID.get(rawPlayer.id) ?? rawPlayer.worldRank,
    };
    const ctxTid = ctxTournamentId ?? selectedTournament;
    const ctxStatus = tournamentCardStatuses[ctxTid];
    const ctxStatsUnlocked = ctxStatus?.label === 'LOCKED' || ctxStatus?.label === 'IN PROGRESS';
    const espnEventId = statsEventId(ctxTid);
    const statsCtx: 'season' | 'tournament' = ctxStatsUnlocked ? 'tournament' : 'season';
    const params = new URLSearchParams({ name: player.name, context: statsCtx });
    if (espnEventId && ctxStatsUnlocked) params.set('eventId', espnEventId);
    params.set('pgaTourId', String(player.pgaTourId));
    const showSubToggle = statsCtx === 'tournament' && ctxTid !== 'us-open';
    setStatsSubView('tournament');
    // Bio is the landing tab for every path into this popup (pick-sheet ⓘ included).
    setPickHistoryView('bio');
    setPickHistoryPlayerPopup({
      player,
      results: {},
      loading: false,
      fedexRank: null,
      dpWorldRank: null,
      owgrRank: null,
      fullResults: null,
      fullResultsLoading: true,
      careerResults: null,
      careerResultsLoading: false,
      playerStats: null,
      playerSeasonStats: null,
      playerStatsLoading: true,
      playerRounds: null,
      statsContext: statsCtx,
      ctxTournamentId: ctxTid,
      defaultTab,
      statAverages: {},
      fieldAverages: {},
      statRanks: {},
      seasonStatRanks: {},
      fieldDistributions: {},
      playerBio: null,
      playerBioLoading: true,
      espnPhotoUrl: null,
      pgaPhotoUrl: null,
      tournamentStatsFetchedAt: null,
      seasonStatsFetchedAt: null,
      bioFetchedAt: null,
      rankingsChangedAt: null,
    });
    // Bio is the landing tab, so fetch it eagerly on open (it's otherwise lazy-loaded on tab click).
    {
      const bioParams = new URLSearchParams({ name: player.name });
      if (player.pgaTourId) bioParams.set('pgaTourId', String(player.pgaTourId));
      readJson<{ bio: { height: string | null; weight: string | null; dob: string | null; age: number | null; birthPlace: string | null; college: string | null; collegeConfirmedAbsent: boolean; swing: string | null; turnedPro: number | null; pgaTourDebut: number | null; careerStarts: number | null; cutsMade: number | null; careerWins: number | null; majorStarts: number | null; majorCutsMade: number | null; majorWins: number | null; careerEarnings: string | null; pgaTourWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; majorWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null }; espnPhotoUrl?: string | null; pgaPhotoUrl?: string | null; updatedAt?: string | null }>(`/api/player-bio?${bioParams.toString()}`, { cache: 'no-store' })
        .then((data) => setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBio: data.bio, playerBioLoading: false, espnPhotoUrl: data.espnPhotoUrl ?? null, pgaPhotoUrl: data.pgaPhotoUrl ?? null, bioFetchedAt: data.updatedAt ?? null } : null))
        .catch(() => setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBioLoading: false } : null));
    }
    const scorecardFetch = statsCtx === 'tournament'
      ? readJson<{ rounds: { round: number; score: string }[] | null }>(`/api/scorecard?tournamentId=${ctxTid}&playerName=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rounds: null }))
      : Promise.resolve({ rounds: null });
    const seasonStatsFetch = showSubToggle || ctxTid === 'us-open'
      ? readJson<{ stats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null; ranks: Record<string, string> | null; updatedAt?: string | null }>(`/api/player-stats?name=${encodeURIComponent(player.name)}&context=season&pgaTourId=${player.pgaTourId}`, { cache: 'no-store' }).catch(() => ({ stats: null, ranks: null, updatedAt: null }))
      : Promise.resolve({ stats: null, ranks: null, updatedAt: null });
    Promise.all([
      readJson<{ results: { tournament: string; date: string; course: string; position: string; tour: 'pga' | 'liv' | 'eur' }[] | null }>(`/api/player-season?name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ results: null })),
      readJson<{ rank: number | null; updatedAt?: string | null }>(`/api/player-fedex-rank?pgaTourId=${player.pgaTourId}&name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rank: null, updatedAt: null })),
      readJson<{ rank: number | null; updatedAt?: string | null }>(`/api/player-dpworld-rank?pgaTourId=${player.pgaTourId}&name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rank: null, updatedAt: null })),
      readJson<{ rank: number | null; updatedAt?: string | null }>(`/api/player-owgr-rank?name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rank: null, updatedAt: null })),
      readJson<{ stats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null; ranks: Record<string, string> | null; updatedAt?: string | null }>(`/api/player-stats?${params}`, { cache: 'no-store' }).catch(() => ({ stats: null, ranks: null, updatedAt: null })),
      scorecardFetch,
      seasonStatsFetch,
      readJson<{ averages: Record<string, string> }>('/api/tour-averages', { cache: 'no-store' }).catch(() => ({ averages: {} })),
      espnEventId && statsCtx === 'tournament'
        ? readJson<{ averages: Record<string, string>; distributions: Record<string, number[]> }>(`/api/field-averages?eventId=${espnEventId}`, { cache: 'no-store' }).catch(() => ({ averages: {}, distributions: {} }))
        : Promise.resolve({ averages: {}, distributions: {} }),
    ]).then(([fullData, fedexData, dpWorldData, owgrData, statsData, scData, seasonData, avgData, fieldAvgData]) => {
      const rounds = (scData.rounds ?? []).filter((r) => r.score && r.score !== '--');
      const tournamentStatsFetchedAt = statsCtx === 'tournament' ? (statsData.updatedAt ?? null) : null;
      const seasonStatsFetchedAt = statsCtx === 'season' ? (statsData.updatedAt ?? null) : (seasonData.updatedAt ?? null);
      const rankingUpdates = [fedexData.updatedAt, dpWorldData.updatedAt, owgrData.updatedAt].filter(Boolean) as string[];
      const rankingsChangedAt = rankingUpdates.length ? rankingUpdates.slice().sort()[rankingUpdates.length - 1] : null;
      setPickHistoryPlayerPopup((prev) => prev ? { ...prev, fullResults: fullData.results, fullResultsLoading: false, fedexRank: fedexData.rank, dpWorldRank: dpWorldData.rank, owgrRank: owgrData.rank, playerStats: statsData.stats, playerSeasonStats: seasonData.stats, playerStatsLoading: false, playerRounds: rounds.length > 0 ? rounds : null, statAverages: avgData.averages ?? {}, fieldAverages: fieldAvgData.averages ?? {}, statRanks: statsData.ranks ?? {}, seasonStatRanks: seasonData.ranks ?? {}, fieldDistributions: fieldAvgData.distributions ?? {}, tournamentStatsFetchedAt, seasonStatsFetchedAt, rankingsChangedAt } : null);
    });
  };

  // Tiebreak inputs, computed once (not per sort comparison):
  // - tournamentChampion: the actual winner, auto-detected once the event is officially final.
  //   Used for the stroke-prediction tiebreak (their total strokes) and the "picked the
  //   champion" backup (their player id).
  // - standingsWinnerScore: the winner's total STROKE count — auto from the champion when final,
  //   else a commissioner-saved score. null while unknown.
  const tournamentChampion = isTournamentFinal
    ? players.find((p) => p.position === '1' && p.thru === 'F')
    : undefined;
  const championTotalStrokes =
    tournamentChampion?.total && tournamentChampion.total !== '--'
      ? parseInt(String(tournamentChampion.total), 10)
      : NaN;
  const standingsWinnerScore =
    (!isNaN(championTotalStrokes) ? championTotalStrokes : null) ??
    pool?.winnerScores?.[selectedTournament] ??
    null;
  const championId = tournamentChampion?.id ?? null;
  const CUT_STATUS_SET = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);

  const liveStandingEntries = (
    poolEntries.length > 0
      ? poolEntries.map((entry) => ({
          ...entry,
          rosters: { ...entry.rosters, [selectedTournament]: rosterInSeason(entry, selectedTournament, standingsSeason) },
          tieBreaks: { ...entry.tieBreaks, [selectedTournament]: tieBreakInSeason(entry, selectedTournament, standingsSeason) },
        }))
      : [
          {
            id: sessionUser?.id ?? 'guest-entry',
            name: userLabel,
            rosters: {
              [selectedTournament]:
                sessionUser?.rosters[selectedTournament] ??
                (selectedTournament === entriesTournamentId ? selectedRoster : DEFAULT_ROSTERS[selectedTournament]),
            },
            tieBreaks: sessionUser?.tieBreaks ?? {},
          },
          ...STATIC_ENTRIES,
        ]
  );

  const standings: StandingEntry[] = liveStandingEntries
    .map((entry) => {
      // Founder-pool history: on The Players only the commissioner's entry counted that season.
      const isPlayersTab = isFounderPool && selectedTournament === 'players';
      const isCommissioner = isFounderPool && entry.name === COMMISSIONER_DISPLAY_NAME;

      // For The Players tab: zero out everyone except Clayton Tucker
      if (isPlayersTab && !isCommissioner) {
        return {
          ...entry,
          picks: Array(REQUIRED_GOLFERS).fill(0) as number[],
          golfers: [],
          rosterPoints: 0,
          holesRemaining: 0,
          tieBreakValue: 0,
        };
      }

      const savedRoster = entry.rosters[selectedTournament];
      const picks =
        savedRoster && savedRoster.length > 0
          ? savedRoster
          : isCommissioner
            ? DEFAULT_ROSTERS[selectedTournament]
            : [];
      // Salary is stored per tournament, so override each golfer's salary with the one they carried in
      // the tournament being viewed (selectedTournament) — otherwise a past event would show the
      // current tournament's salaries (or $0). Falls back to $0 when that event has no uploaded list.
      // World rank, by contrast, stays on the global/static source everywhere except the salary pick
      // list — so pin it to the original rank here (matching the info popup), never the uploaded rank.
      const viewedSalaries = salariesFor(selectedTournament, standingsSeason)?.salaries;
      const golfers = picks
        .map((id) => {
          const p = playersById[id];
          if (!p) return p;
          return { ...p, salary: viewedSalaries?.[id] ?? 0, worldRank: ORIGINAL_WORLD_RANK_BY_ID.get(id) ?? p.worldRank };
        })
        .filter(Boolean);
      const rosterPoints = golfers.reduce((sum, golfer) => sum + golfer.points, 0);
      const holesRemaining = golfers.reduce((sum, golfer) => sum + golfer.holesRemaining, 0);
      const tieBreakValue = entry.tieBreaks?.[selectedTournament] ?? (picks.reduce((sum, id) => sum + id, 0) + 270);

      return {
        ...entry,
        picks,
        golfers,
        rosterPoints,
        holesRemaining,
        tieBreakValue,
      };
    })
    .filter((entry) => selectedTournament === 'players' || entry.picks.length === REQUIRED_GOLFERS)
    .sort((left, right) => {
      // 1) Total points — most wins.
      if (right.rosterPoints !== left.rosterPoints) {
        return right.rosterPoints - left.rosterPoints;
      }

      // 2) Holes remaining — fewest wins (only differentiates mid-tournament; all 0 once final).
      if (left.holesRemaining !== right.holesRemaining) {
        return left.holesRemaining - right.holesRemaining;
      }

      // 3) Tiebreak prediction — closest to the champion's actual total stroke count wins.
      if (standingsWinnerScore != null) {
        const diff =
          Math.abs(left.tieBreakValue - standingsWinnerScore) -
          Math.abs(right.tieBreakValue - standingsWinnerScore);
        if (diff !== 0) return diff;
      } else if (left.tieBreakValue !== right.tieBreakValue) {
        return left.tieBreakValue - right.tieBreakValue;
      }

      // ── Backup tiebreakers: only reached when points, holes remaining, and the stroke
      //    prediction are all dead-even (e.g. two guesses equidistant from the winner). ──

      // 4) Picked the champion — an entry that rostered the actual winner beats one that didn't.
      const leftHasChampion = championId != null && left.picks.includes(championId);
      const rightHasChampion = championId != null && right.picks.includes(championId);
      if (leftHasChampion !== rightHasChampion) return leftHasChampion ? -1 : 1;

      // 5) Fewest golfers who missed the cut.
      const leftMissedCuts = left.golfers.filter((g) => CUT_STATUS_SET.has(String(g.score).toUpperCase())).length;
      const rightMissedCuts = right.golfers.filter((g) => CUT_STATUS_SET.has(String(g.score).toUpperCase())).length;
      if (leftMissedCuts !== rightMissedCuts) return leftMissedCuts - rightMissedCuts;

      // 6) Best-golfer points, cascading down each roster: compare the highest-scoring golfer,
      //    then the 2nd-highest, then the 3rd, and so on until one entry's golfer out-points the
      //    other's at the same rank.
      const leftPointsDesc = left.golfers.map((g) => g.points).sort((a, b) => b - a);
      const rightPointsDesc = right.golfers.map((g) => g.points).sort((a, b) => b - a);
      const maxGolfers = Math.max(leftPointsDesc.length, rightPointsDesc.length);
      for (let i = 0; i < maxGolfers; i++) {
        const l = leftPointsDesc[i] ?? -Infinity;
        const r = rightPointsDesc[i] ?? -Infinity;
        if (l !== r) return r - l; // more points wins
      }

      // Every measure identical — a genuine, unbreakable co-tie.
      return 0;
    })
    .map((entry, index) => ({ ...entry, place: index + 1 }));

  // The commissioner's "Pay Winners" button in the standings header of a finished tournament. It
  // shows until every place that pays has been paid from the Pay Winners screen, or for 48 hours
  // after the results went final (Pay Winners stays in the commissioner tools after that).
  const PAY_WINNERS_PROMPT_MS = 48 * 60 * 60 * 1000;
  const payingPlaces = [selectedTournamentPayouts?.first, selectedTournamentPayouts?.second, selectedTournamentPayouts?.third]
    .map((amount, index) => ({ place: index + 1, amount: amount ?? 0 }))
    .filter(({ place, amount }) => amount > 0 && standings.length >= place)
    .map(({ place }) => place);
  const paidPlaces = new Set((pool?.payoutsSent?.[selectedTournament] ?? []).map((sent) => sent.place));
  const allWinnersPaid = payingPlaces.length > 0 && payingPlaces.every((place) => paidPlaces.has(place));
  // When the results went final: when live scoring saved the final leaderboard, else Sunday night
  // of the event week.
  const resultsFinalAt = (() => {
    const saved = feed?.cachedAt ? Date.parse(feed.cachedAt) : NaN;
    if (!Number.isNaN(saved)) return saved;
    return standingsMeta ? Date.parse(`${standingsMeta.startDate}T23:00:00Z`) + 3 * 24 * 60 * 60 * 1000 : 0;
  })();
  const showPayWinnersPrompt =
    isTournamentFinal &&
    !showFutureTournamentView &&
    pool?.role === 'commissioner' &&
    payingPlaces.length > 0 &&
    !allWinnersPaid &&
    nowTick < resultsFinalAt + PAY_WINNERS_PROMPT_MS;

  // Bank the pool's final standings once a tournament is complete, so members can view them under
  // "Past Results" in future seasons. Fires once per tournament/year per session; the server keeps
  // the larger snapshot if a partial render ever posts.
  useEffect(() => {
    if (!isTournamentFinal || standings.length === 0) return;
    const yearStr = standingsMeta?.year;
    const year = yearStr ? parseInt(yearStr, 10) : NaN;
    if (isNaN(year)) return;
    const key = `${pool?.id ?? ''}:${selectedTournament}:${year}`;
    if (archivedThisSession.current.has(key)) return;
    archivedThisSession.current.add(key);
    fetch('/api/standings-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: selectedTournament,
        year,
        standings: standings.map((e) => ({ place: e.place, name: e.name, points: e.rosterPoints, holesRemaining: e.holesRemaining, tieBreak: e.tieBreakValue, golfers: e.golfers.map((g) => ({ name: g.name, score: g.score, points: g.points, position: g.position, salary: g.salary })) })),
        payouts: selectedTournamentPayouts ? { first: selectedTournamentPayouts.first, second: selectedTournamentPayouts.second, third: selectedTournamentPayouts.third } : undefined,
      }),
    }).catch(() => { archivedThisSession.current.delete(key); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTournamentFinal, selectedTournament, standings.length, pool?.id]);

  const pickedPlayerIds = (() => {
    const ids = new Set<number>();
    for (const entry of liveStandingEntries) {
      for (const id of entry.rosters[selectedTournament] ?? []) {
        ids.add(id);
      }
    }
    return ids;
  })();

  useEffect(() => {
    if (!selectedLeaderboardPlayerId) return;
    const topEntry = standings.find((entry) =>
      entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
    );
    if (!topEntry) return;
    const el = document.querySelector<HTMLElement>(`[data-entry-id="${topEntry.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // standings is a derived value; we only want to scroll on player selection changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaderboardPlayerId]);

  // With a leaderboard player selected (highlighting the entries that picked them), tapping
  // anywhere EXCEPT a highlighted entry clears the selection. Exempt: highlighted entry rows
  // (keep + open their popup), the leaderboard golfer rows (they manage their own toggle), and
  // anything inside an open modal/overlay (all render as fixed-position layers).
  useEffect(() => {
    if (!selectedLeaderboardPlayerId) return;
    let startX = 0, startY = 0;
    const onDown = (e: PointerEvent) => { startX = e.clientX; startY = e.clientY; };
    const onUp = (e: PointerEvent) => {
      // Only a near-stationary press counts as a tap — a scroll/drag moves the pointer,
      // so it should never clear the selection.
      if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) return;
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('[data-picked-highlight="true"]') || target.closest('[data-leaderboard-golfer="true"]')) return;
      for (let el: HTMLElement | null = target; el; el = el.parentElement) {
        if (window.getComputedStyle(el).position === 'fixed') return;
      }
      setSelectedLeaderboardPlayerId(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
    };
  }, [selectedLeaderboardPlayerId]);

  const activeStandingEntry = standings.find((entry) => entry.id === activeStandingEntryId) ?? null;
  const activeStandingGolfers = activeStandingEntry
    ? [...activeStandingEntry.golfers].sort((left, right) => {
        if (right.points !== left.points) {
          return right.points - left.points;
        }

        const leftPos = Number(left.position.replace('T', ''));
        const rightPos = Number(right.position.replace('T', ''));

        if (!Number.isNaN(leftPos) && !Number.isNaN(rightPos) && leftPos !== rightPos) {
          return leftPos - rightPos;
        }

        return left.salary - right.salary;
      })
    : [];
  const activeStandingGolfer = activeStandingGolfers.find((golfer) => golfer.id === activeStandingGolferId) ?? null;
  const pickedGolferIds = new Set(standings.flatMap((entry) => entry.golfers.map((golfer) => golfer.id)));
  const eventLeaderboardRows = [...players]
    .filter((player) => pickedGolferIds.has(player.id))
    .sort((left, right) => {
      const leftPos = Number(left.position.replace('T', ''));
      const rightPos = Number(right.position.replace('T', ''));

      if (!Number.isNaN(leftPos) && !Number.isNaN(rightPos) && leftPos !== rightPos) {
        return leftPos - rightPos;
      }

      return right.points - left.points;
    });

  const tieBreakValid = /^\d{3}$/.test(tieBreakInput);
  const canSave =
    Boolean(sessionUser) &&
    selectedRoster.length === REQUIRED_GOLFERS &&
    salaryUsed <= SALARY_CAP &&
    tieBreakValid &&
    !entriesLocked;

  const togglePlayer = (playerId: number) => {
    if (entriesLocked) {
      return;
    }

    if (selectedRoster.includes(playerId)) {
      setSelectedRoster(selectedRoster.filter((id) => id !== playerId));
      return;
    }

    if (selectedRoster.length >= REQUIRED_GOLFERS) {
      return;
    }

    const next = [...selectedRoster, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);

    if (nextSalary > SALARY_CAP) {
      return;
    }

    setSelectedRoster(next);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!sessionUser) {
      setSaveMessage('Create an account or sign in to save this lineup to the pool.');
      return false;
    }

    if (!canSave) {
      setSaveMessage('Lineup must have 6 golfers, stay under the salary cap, and be saved before lock.');
      return false;
    }

    try {
      const payload = await readJson<SessionPayload & { roster: number[] }>('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: entriesTournamentId,
          roster: selectedRoster,
          tieBreak: parseInt(tieBreakInput, 10),
        }),
      });

      applySession(payload);
      setSaveMessage('Lineup saved to your account for this tournament.');
      setMyEntriesEditorOpen(false);
      return true;
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save lineup.');
      return false;
    }
  };

  const handleCutClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCutIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        const t = expandedCutTimersRef.current.get(playerId);
        if (t !== undefined) clearTimeout(t);
        expandedCutTimersRef.current.delete(playerId);
        next.delete(playerId);
      } else {
        next.add(playerId);
        const t = setTimeout(() => {
          setExpandedCutIds((s) => { const n = new Set(s); n.delete(playerId); return n; });
          expandedCutTimersRef.current.delete(playerId);
        }, 10000);
        expandedCutTimersRef.current.set(playerId, t);
      }
      return next;
    });
  };

  // Open the live scorecard popup for a leaderboard player (used by row click and by the
  // Total-column score tap for picked players).
  const openLiveScorecard = (name: string, teeTime: string | null, thru: string | null, backNineStart: boolean) => {
    setScorecardGolferName(name);
    setScorecardGolferPhoto(null);
    setScorecardGolferTeeTime(teeTime);
    setScorecardGolferThru(thru);
    setScorecardGolferBackNineStart(backNineStart);
    setScorecardData(null);
    setScorecardLoading(true);
    fetch(`/api/scorecard?tournamentId=${selectedTournament}&playerName=${encodeURIComponent(name)}&round=${feed?.currentRound ?? 1}`)
      .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
  };
  const openTournamentHistory = (tournament: TournamentId, year: number) => {
    setHistoryRoster(null);
    setHistoryPopup({ tournament, year, loading: true, data: null });
    fetch(`/api/standings-archive?tournamentId=${tournament}&year=${year}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: ArchivedStandingsData) => setHistoryPopup({ tournament, year, loading: false, data }))
      .catch(() => setHistoryPopup({ tournament, year, loading: false, data: { available: false, error: 'fetch failed' } }));
  };
  const openCutScorecardFor = (name: string) => {
    setCutScorecardGolfer({ name, pgaTourId: 0, photoUrl: undefined });
    setCutScorecardData(null);
    setCutScorecardLoading(true);
    fetch(`/api/scorecard?tournamentId=${selectedTournament}&playerName=${encodeURIComponent(name)}&round=2`)
      .then(r => r.json()).then(setCutScorecardData).catch(() => setCutScorecardData(null)).finally(() => setCutScorecardLoading(false));
  };
  // CUT text in the Total column: single tap keeps the existing expand-to-score toggle,
  // double tap opens the player's scorecard popup.
  const cutTapRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const handleCutTotalTap = (playerId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = cutTapRef.current;
    if (existing && existing.id === playerId) {
      clearTimeout(existing.timer);
      cutTapRef.current = null;
      openCutScorecardFor(name); // double tap
    } else {
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        cutTapRef.current = null;
        handleCutClick(playerId, { stopPropagation: () => {} } as React.MouseEvent); // single tap = expand
      }, 260);
      cutTapRef.current = { id: playerId, timer };
    }
  };

  const handleMainTabChange = (tab: MainTab, options?: { refreshAfterChange?: boolean }) => {
    setAccountMenuOpen(false);
    setMyEntriesMenuOpen(false);
    setReportsMenuOpen(false);
    setPpsPickPopup(null);
    setPpsAllPlayerPopup(null);
    setHistoryPopup(null);
    setHistoryRoster(null);
    setActiveStandingEntryId(null);
    setActiveStandingGolferId(null);
    setCommissionerMemberModalOpen(false);
    setNowTick(window.performance.timeOrigin + window.performance.now());

    startTransition(() => {
      if (tab === 'Standings') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setFeedRefreshNonce((value) => value + 1);
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
      } else if (tab === 'My Entries') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Details') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Reports') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Commissioner Hub') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
        setCommissionerMembersRefreshNonce((value) => value + 1);
      }

      // Reports always return to their default, unselected state on any tab change — so
      // re-opening a report (which routes through handleMainTabChange('Reports')) never
      // auto-shows the last thing that was pulled.
      setPpsTournament('');
      setPpsSortBy('');
      setPpsSearch('');
      setPmpsEntryId('');
      setPmphEntryId('');
      setPpfTournament('');
      setPpfSearch('');
      setPpfSortKey('finish');
      setPpfSortDir('asc');
      setPpfSelectedRow(null);
      setPshTournament('');
      if (tab !== 'Reports') setSelectedReport(null);

      setLeaderboardSearch('');
      setLeaderboardViewMode('full');
      setLeaderboardSortMode('default');
      setLeaderboardPickedSort('default');
      setShowCutInfo(false);
      setMainTab(tab);
    });

    resetViewAfterMainTabChange();

    if (options?.refreshAfterChange) {
      void refreshCurrentSession();
    }
  };

  const openMyEntriesEditor = () => {
    loadSalaryOverrides.current(); // pull the latest uploaded salary list before showing the pick sheet
    setSaveMessage('');
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSelectedRoster(savedRoster.length > 0 ? savedRoster : []);
    const savedTieBreak = sessionUser?.tieBreaks?.[entriesTournamentId];
    setTieBreakInput(savedTieBreak != null ? String(savedTieBreak) : '');
    myEntriesReturnTabRef.current = mainTab; // so the pick sheet's back button returns here
    setMyEntriesEditorOpen(true);
    handleMainTabChange('My Entries');
    setMyEntriesEditorOpen(true);
  };

  const closeMyEntriesEditor = () => {
    setMyEntriesEditorOpen(false);
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSaveMessage('');
    // Return to whichever tab the pick sheet was opened from (e.g. Standings' Make Picks button).
    if (myEntriesReturnTabRef.current !== 'My Entries') handleMainTabChange(myEntriesReturnTabRef.current);
  };

  const renderRosterCards = (background: string, allowRemove = false) => (
    <div style={{ display: 'grid', gap: isMobile ? 10 : 10 }}>
      {orderedRosterPlayers.map((player, index) => (
        <div
          key={player.id}
          style={{
            border: '1px solid #e6edf1',
            borderRadius: 16,
            padding: isMobile ? '16px 16px' : '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            background,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 10 }}>
            <img
              src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
              alt={player.name}
              className="roster-card-photo" style={{ width: isMobile ? 58 : 58, height: isMobile ? 58 : 58, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#fff' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 17 : 20 }}>{player.name}</div>
              <div style={{ marginTop: 4, fontSize: isMobile ? 13 : 14, color: '#6b7b88' }}>
                OWGR {player.worldRank} | {player.odds} | <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, color: '#3f73ad' }}>${player.salary.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 8 }}>
            {allowRemove ? (
              <button
                type="button"
                onClick={() => togglePlayer(player.id)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: '1px solid #c9d7e6',
                  background: '#eef4ff',
                  color: '#2f5f96',
                  fontSize: 22,
                  fontWeight: 900,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                −
              </button>
            ) : null}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, fontSize: isMobile ? 20 : 20 }}>{player.points}</div>
              <div style={{ fontSize: isMobile ? 13 : 12, color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96' }}>{player.holesRemaining} holes left</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBudgetCards = (background: string, border: string) => (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 10,
      }}
    >
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Salary used</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${salaryUsed.toLocaleString()}</div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Remaining</div>
        <div
          style={{
            marginTop: 6,
            fontSize: 22,
            fontWeight: 900,
            color: salaryRemaining < 0 ? '#b91c1c' : '#0f1720',
          }}
        >
          ${salaryRemaining.toLocaleString()}
        </div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
          Avg/player left
        </div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${averageRemainingPerPlayer.toLocaleString()}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#6b7b88' }}>
          {playersNeeded === 0 ? 'Roster complete' : `${playersNeeded} spot${playersNeeded === 1 ? '' : 's'} left`}
        </div>
      </div>
    </div>
  );

  const formatPayoutAmount = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : '--';

  const headerBg =
    selectedTournament === 'us-open' ? 'linear-gradient(135deg, #BE3436 0%, #8c1c2e 100%)' :
    selectedTournament === 'masters' ? 'linear-gradient(135deg, #2c6449 0%, #1a3d2b 100%)' :
    selectedTournament === 'pga' ? 'linear-gradient(135deg, #B09963 0%, #7a6a3e 100%)' :
    'linear-gradient(135deg, #173b63 0%, #0e2440 100%)';

  const headerSolid =
    selectedTournament === 'us-open' ? '#BE3436' :
    selectedTournament === 'masters' ? '#2c6449' :
    selectedTournament === 'pga' ? '#B09963' :
    '#173b63';

  const entriesTournamentBg =
    entriesTournamentId === 'us-open' ? 'linear-gradient(135deg, #BE3436 0%, #8c1c2e 100%)' :
    entriesTournamentId === 'masters' ? 'linear-gradient(135deg, #2c6449 0%, #1a3d2b 100%)' :
    entriesTournamentId === 'pga' ? 'linear-gradient(135deg, #B09963 0%, #7a6a3e 100%)' :
    'linear-gradient(135deg, #173b63 0%, #0e2440 100%)';

  const entriesTournamentSolid =
    entriesTournamentId === 'us-open' ? '#BE3436' :
    entriesTournamentId === 'masters' ? '#2c6449' :
    entriesTournamentId === 'pga' ? '#B09963' :
    '#173b63';

  // Full display name for the pick-sheet header (The Open → The Open Championship).
  const entriesTournamentDisplayName =
    entriesTournamentId === 'players' ? 'The Players' :
    entriesTournamentId === 'masters' ? 'The Masters' :
    entriesTournamentId === 'pga' ? 'PGA Championship' :
    entriesTournamentId === 'us-open' ? 'U.S. Open' :
    entriesTournamentId === 'open' ? 'The Open' :
    entriesTournament.name;

  // Shaded fill + text tint that matches the Pick History entry bubbles, keyed to
  // the current tournament. Used for the "picks not open yet" warning message.
  const entriesWarningPalette: { bg: string; text: string } =
    entriesTournamentId === 'us-open' ? { bg: '#fde8e8', text: '#BE3436' } :
    entriesTournamentId === 'masters' ? { bg: '#d5eade', text: '#2c6449' } :
    entriesTournamentId === 'pga' ? { bg: '#f5edd8', text: '#7a6a3e' } :
    { bg: '#dce6f5', text: '#173b63' };

  const salaryColor = entriesTournamentId === 'open' ? headerSolid : entriesTournamentId === 'masters' ? '#2c6449' : '#3f73ad';

  const headerTabActiveColor = '#63d9ea';

  return {
    showPayWinnersPrompt,
    initialTournament,
    mainTab,
    setMainTab,
    myEntriesReturnTabRef,
    pendingCommissionerTab,
    setPendingCommissionerTab,
    selectedTournament,
    setSelectedTournament,
    selectedRoster,
    setSelectedRoster,
    activeStandingEntryId,
    setActiveStandingEntryId,
    activeStandingGolferId,
    setActiveStandingGolferId,
    scorecardGolferName,
    setScorecardGolferName,
    scorecardGolferPhoto,
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
    setHistoryPopup,
    pshTournament,
    setPshTournament,
    pshYear,
    setPshYear,
    historyRoster,
    setHistoryRoster,
    archivedThisSession,
    reportsMenuOpen,
    setReportsMenuOpen,
    reportsMenuRect,
    setReportsMenuRect,
    selectedReport,
    setSelectedReport,
    ppsTournament,
    setPpsTournament,
    ppsSortBy,
    setPpsSortBy,
    ppsSearch,
    setPpsSearch,
    ppsPickPopup,
    setPpsPickPopup,
    ppsAllPlayerPopup,
    setPpsAllPlayerPopup,
    reportYear,
    setReportYear,
    pmpsEntryId,
    setPmpsEntryId,
    pmphEntryId,
    setPmphEntryId,
    ppfTournament,
    setPpfTournament,
    ppfSearch,
    setPpfSearch,
    ppfSortKey,
    setPpfSortKey,
    ppfSortDir,
    setPpfSortDir,
    ppfSelectedRow,
    setPpfSelectedRow,
    ppfScrollRef,
    reportTopRef,
    ppfViewportW,
    setPpfViewportW,
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
    selectedLeaderboardPlayerId,
    setSelectedLeaderboardPlayerId,
    leaderboardSearch,
    setLeaderboardSearch,
    leaderboardViewMode,
    setLeaderboardViewMode,
    fullLeaderboardRows,
    setFullLeaderboardRows,
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
    setVisualVpHeight,
    expandedCutIds,
    setExpandedCutIds,
    expandedCutTimersRef,
    leaderboardSortMode,
    setLeaderboardSortMode,
    leaderboardPickedSort,
    setLeaderboardPickedSort,
    showCutInfo,
    setShowCutInfo,
    showHeaderCutInfo,
    setShowHeaderCutInfo,
    feeds,
    setFeeds,
    statsEventId,
    isLoading,
    setIsLoading,
    error,
    setError,
    feedRefreshNonce,
    setFeedRefreshNonce,
    feed,
    currentFullLeaderboardRows,
    commissionerMembersRefreshNonce,
    setCommissionerMembersRefreshNonce,
    saveMessage,
    setSaveMessage,
    nowTick,
    setNowTick,
    lockTimeOverrides,
    setLockTimeOverridesState,
    preTournamentTick,
    setPreTournamentTick,
    preTournamentBusy,
    setPreTournamentBusy,
    savePreTournamentOverride,
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
    setSessionLoading,
    authBusy,
    setAuthBusy,
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
    commissionerMembers,
    setCommissionerMembers,
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
    setPoolLockBusy,
    poolLockMsg,
    setPoolLockMsg,
    poolLockMsgTimer,
    savePoolLockTime,
    commissionerPicksSort,
    setCommissionerPicksSort,
    commissionerEditReturnRef,
    commissionerBusy,
    setCommissionerBusy,
    commissionerError,
    setCommissionerError,
    commissionerSuccess,
    setCommissionerSuccess,
    commissionerConsoleView,
    setCommissionerConsoleView,
    commissionerMemberSearch,
    setCommissionerMemberSearch,
    commissionerMemberSort,
    setCommissionerMemberSort,
    entriesPlayerSearch,
    setEntriesPlayerSearch,
    tieBreakInput,
    setTieBreakInput,
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
    poolMessageOpen,
    setPoolMessageOpen,
    payoutPlanOpen,
    setPayoutPlanOpen,
    guideOpen,
    setGuideOpen,
    venmoFallbackUrl,
    setVenmoFallbackUrl,
    showSubmittedPicksPopup,
    setShowSubmittedPicksPopup,
    submittedPicksSort,
    setSubmittedPicksSort,
    commissionerPlayerSearch,
    setCommissionerPlayerSearch,
    commissionerMemberModalOpen,
    setCommissionerMemberModalOpen,
    commissionerMemberModalView,
    setCommissionerMemberModalView,
    commissionerRosterMemberId,
    setCommissionerRosterMemberId,
    commissionerRosterSelection,
    setCommissionerRosterSelection,
    commissionerTieBreakInput,
    setCommissionerTieBreakInput,
    payoutForm,
    setPayoutForm,
    winnerScoreInput,
    setWinnerScoreInput,
    clearLeaderBusy,
    setClearLeaderBusy,
    clearLeaderMsg,
    setClearLeaderMsg,
    poolToolModal,
    setPoolToolModal,
    poolToolConfirm,
    setPoolToolConfirm,
    playerStatusInput,
    setPlayerStatusInput,
    playerStatusBusy,
    setPlayerStatusBusy,
    playerStatusMsg,
    setPlayerStatusMsg,
    selectedCommissionerMemberId,
    setSelectedCommissionerMemberId,
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
    showMemberPassword,
    setShowMemberPassword,
    accountDisplayName,
    setAccountDisplayName,
    accountBusy,
    setAccountBusy,
    accountMessage,
    setAccountMessage,
    myEntriesEditorOpen,
    setMyEntriesEditorOpen,
    pickSheetOpenRef,
    standingsColRef,
    leaderboardColRef,
    myEntriesMenuOpen,
    setMyEntriesMenuOpen,
    myEntriesDetailView,
    setMyEntriesDetailView,
    showAddMemberForm,
    setShowAddMemberForm,
    memberCreateForm,
    setMemberCreateForm,
    memberEditForm,
    setMemberEditForm,
    isMobile,
    setIsMobile,
    isSmallMobile,
    setIsSmallMobile,
    landscapeZoom,
    setLandscapeZoom,
    isLandscapePhone,
    setIsLandscapePhone,
    tournament,
    isAppAdmin,
    needsEmailCode,
    canManagePool,
    isFounderPool,
    tournamentCardStatuses,
    picksRevealed,
    picksRevealedForYear,
    selectedTournamentStatus,
    selectedPicksSeason,
    standingsSeason,
    standingsMeta,
    entriesTournamentId,
    careerTournamentId,
    entriesTournament,
    entriesTournamentStatus,
    entriesPicksOpenForTournament,
    entriesPreFieldView,
    entriesLockAtIso,
    entriesLocked,
    selectedTournamentPayouts,
    commissionerTournamentPayouts,
    commissionerTournamentWinnerScore,
    commissionerTournamentLabel,
    commissionerAutoWinner,
    commissionerAutoWinnerTotal,
    commissionerAutoDetected,
    tiebreakResolved,
    entriesTournamentCourseName,
    entriesTournamentPar,
    applySession,
    refreshCurrentSession,
    handleRegister,
    handleLogin,
    handleLogout,
    handleUpdateOwnPassword,
    handleUpdateOwnDisplayName,
    handleCreateMember,
    handleToggleLineupLock,
    handleTogglePicksOpen,
    handleSavePayouts,
    handleClearRoundLeader,
    handleMarkPlayerStatus,
    handleSaveWinnerScore,
    handleSelectCommissionerMember,
    openCommissionerMemberModal,
    openCommissionerMemberPicks,
    handleSaveCommissionerMember,
    handleDeleteCommissionerMember,
    confirmHandOverId,
    setConfirmHandOverId,
    handleHandOverCommissioner,
    handleClearCommissionerMemberPicks,
    toggleCommissionerRosterPlayer,
    handleSaveCommissionerRoster,
    feedMap,
    liveOddsMap,
    salaryByTournament,
    setSalaryByTournament,
    salaryBySeason,
    setSalaryBySeason,
    salariesFor,
    dynamicPlayers,
    setDynamicPlayers,
    salaryListLoaded,
    setSalaryListLoaded,
    loadSalaryOverrides,
    salaryOverrides,
    worldRankOverrides,
    salaryListMissing,
    amateurKeys,
    setAmateurKeys,
    clubProKeys,
    setClubProKeys,
    players,
    playersById,
    playerDirectory,
    positionSortRank,
    ppsResult,
    ppfRows,
    reportYearSelect,
    selectedCommissionerMember,
    filteredCommissionerMembers,
    commissionerRosterMember,
    filteredEntriesPlayers,
    filteredCommissionerPlayers,
    savedRoster,
    hasSubmittedRoster,
    entryFee,
    entryFeeVenmo,
    paysEntryFeeInApp,
    openEntryFeePayment,
    submittedEntries,
    otherSubmittedEntriesCount,
    submittedCommissionerMembers,
    pendingCommissionerMembers,
    rosterPlayers,
    orderedRosterPlayers,
    savedRosterPlayers,
    salaryUsed,
    salaryRemaining,
    playersNeeded,
    averageRemainingPerPlayer,
    commissionerRosterPlayers,
    commissionerOrderedRosterPlayers,
    commissionerSalaryUsed,
    commissionerSalaryRemaining,
    commissionerPlayersNeeded,
    commissionerAverageRemainingPerPlayer,
    canSaveCommissionerRoster,
    locked,
    showFinalTournamentView,
    isTournamentFinal,
    roundOneComplete,
    roundTwoComplete,
    roundThreeComplete,
    currentRoundComplete,
    currentRoundSuspended,
    cutAssigned,
    showProjectedCut,
    courseLocalTimeLabel,
    nextRoundStartLabel,
    nextRoundNum,
    showFutureTournamentView,
    showLivePayoutStrip,
    tournamentStatsUnlocked,
    displayTournamentWindow,
    currentRoundLabel,
    picksOpenForTournament,
    tournamentStartLabel,
    tournamentFieldMondayLabel,
    lineupDeadlineLabel,
    userLabel,
    openPlayerPopup,
    tournamentChampion,
    championTotalStrokes,
    standingsWinnerScore,
    championId,
    CUT_STATUS_SET,
    liveStandingEntries,
    standings,
    pickedPlayerIds,
    activeStandingEntry,
    activeStandingGolfers,
    activeStandingGolfer,
    pickedGolferIds,
    eventLeaderboardRows,
    tieBreakValid,
    canSave,
    togglePlayer,
    handleSave,
    handleCutClick,
    openLiveScorecard,
    openTournamentHistory,
    openCutScorecardFor,
    cutTapRef,
    handleCutTotalTap,
    handleMainTabChange,
    openMyEntriesEditor,
    closeMyEntriesEditor,
    renderRosterCards,
    renderBudgetCards,
    formatPayoutAmount,
    headerBg,
    headerSolid,
    entriesTournamentBg,
    entriesTournamentSolid,
    entriesTournamentDisplayName,
    entriesWarningPalette,
    salaryColor,
    headerTabActiveColor,
  };
}

export type PoolPage = ReturnType<typeof usePoolPage>;
