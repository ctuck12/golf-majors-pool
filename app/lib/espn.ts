import type { SlashGolfLeaderboardRow } from './slashgolf';
import type { StoredPlayerScorecards } from './scorecard-store';

// ── ESPN response types ────────────────────────────────────────────────────

type EspnHoleLinescore = {
  value: number;           // strokes on hole
  period: number;          // hole number 1-18
  scoreType?: { displayValue: string }; // "E" | "+1" | "-1" | "+2" | "-2" etc.
};

type EspnRoundLinescore = {
  value: number;           // total strokes for round
  displayValue: string;    // round to-par: "-5", "E", "+2"
  period: number;          // round number 1-4
  linescores?: EspnHoleLinescore[];
  // ESPN buries tee time as the last stat entry (no "value" key, only "displayValue")
  // e.g. "Thu May 14 14:27:00 PDT 2026"
  statistics?: {
    categories?: Array<{
      stats?: Array<{ value?: number; displayValue?: string }>;
    }>;
  };
};

type EspnStatus = {
  period?: number;
  type?: { name: string; state: string; completed: boolean };
};

type EspnCompetitor = {
  id: string;
  order: number;           // leaderboard rank (1 = leader)
  athlete: { displayName?: string; fullName?: string };
  score?: string;          // "-12" | "E" | "+4" | "CUT" | "WD" | "DQ" | "MDF" | "MC"
  status?: { period?: number; type?: { name?: string; state?: string; completed?: boolean } };
  linescores?: EspnRoundLinescore[];
};

type EspnScoreboardResponse = {
  events?: Array<{
    id: string;
    name?: string;
    shortName?: string;
    competitions?: Array<{
      competitors?: EspnCompetitor[];
      status?: EspnStatus;
    }>;
    status?: EspnStatus;
  }>;
};

// ── Public result type ─────────────────────────────────────────────────────

export type ESPNTournamentResult = {
  leaderboardRows: SlashGolfLeaderboardRow[];
  currentRound: number;
  roundStatus: string;
  projectedCut: string | null;
  playerScorecards: Record<string, StoredPlayerScorecards>;
  // ESPN's authoritative "whole event is over" flag (status.type.completed). This is the
  // ONLY reliable signal that the tournament is truly final — `roundStatus` alone is
  // ambiguous because ESPN reports state='post' between rounds too.
  eventComplete: boolean;
  // ESPN's id for the event (useful when it was found by name).
  eventId: string;
};

// ── Private helpers ────────────────────────────────────────────────────────

const CUT_STATUSES = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);

// Map ESPN competitor status.type.name values → our canonical score strings
const ESPN_STATUS_NAME_TO_SCORE: Record<string, string> = {
  STATUS_CUT: 'CUT',
  STATUS_MC: 'CUT',
  STATUS_WD: 'WD',
  STATUS_DQ: 'DQ',
  STATUS_MDF: 'MDF',
};

function parseRelScore(displayValue: string | undefined): number {
  if (!displayValue || displayValue === 'E') return 0;
  return parseInt(displayValue, 10) || 0;
}

function mapRoundStatus(status: EspnStatus | undefined): string {
  const state = status?.type?.state ?? '';
  const name = status?.type?.name ?? '';
  // Check suspension by name first — ESPN sets state='post' during suspension too
  if (name === 'STATUS_PLAY_SUSPENSION' || name === 'STATUS_SUSPENDED') return 'Suspended';
  if (state === 'post') return 'Official';
  if (state === 'in' || name === 'STATUS_IN_PROGRESS') return 'In Progress';
  return '';
}

function deriveCurrentRound(
  competitors: EspnCompetitor[],
  statusPeriod: number | undefined,
): number {
  // Highest round that actually has hole-by-hole data (i.e. has really been played).
  let maxWithData = 0;
  for (const c of competitors) {
    for (const r of c.linescores ?? []) {
      if ((r.linescores?.length ?? 0) > 0) maxWithData = Math.max(maxWithData, r.period);
    }
  }
  // ESPN pre-increments status.period to the next round during the gap between rounds
  // (e.g. period=4 the moment round 3 is official, before anyone tees off in round 4).
  // Trusting that blindly makes the app think round 4 is underway/finished and can trip
  // the tournament-complete logic prematurely. Only advance to statusPeriod once that
  // round has real play; otherwise stay on the last round that was actually contested.
  if (statusPeriod && statusPeriod > 0) {
    return maxWithData > 0 ? Math.min(statusPeriod, maxWithData) : statusPeriod;
  }
  return maxWithData || 1;
}

// Tee time lives in the last stats entry of a round's linescore.
// That entry has no "value" key and contains a string like "Thu May 14 14:27:00 PDT 2026".
// When the current round is complete (≥18 holes played), look at the next round for the
// upcoming tee time so we show R3 times after R2 finishes rather than the stale R2 time.
function extractTeeTime(linescores: EspnRoundLinescore[] | undefined, currentRound: number): string | null {
  const currentRoundData = (linescores ?? []).find((r) => r.period === currentRound);
  const isComplete = (currentRoundData?.linescores?.length ?? 0) >= 18;
  const targetPeriod = isComplete ? currentRound + 1 : currentRound;
  const round = (linescores ?? []).find((r) => r.period === targetPeriod);
  const stats = round?.statistics?.categories?.[0]?.stats;
  if (!stats?.length) return null;
  const last = stats[stats.length - 1];
  if (!('value' in last) && last.displayValue?.includes(':')) return last.displayValue;
  return null;
}

function deriveThru(
  linescores: EspnRoundLinescore[] | undefined,
  currentRound: number,
): string {
  const round = (linescores ?? []).find((r) => r.period === currentRound);
  const count = round?.linescores?.length ?? 0;
  if (count === 0) return '--';
  if (count >= 18) return 'F';
  return String(count);
}

function buildPositionStrings(competitors: EspnCompetitor[]): Map<string, string> {
  const result = new Map<string, string>();

  // Sort active (non-cut) players by ESPN order then group ties by equal score
  const active = competitors
    .filter((c) => !CUT_STATUSES.has((c.score ?? '').toUpperCase()))
    .sort((a, b) => a.order - b.order);

  let rank = 1;
  let i = 0;
  while (i < active.length) {
    const score = active[i].score ?? '';
    let j = i;
    while (j < active.length && active[j].score === score) j++;
    const pos = j - i > 1 ? `T${rank}` : String(rank);
    for (let k = i; k < j; k++) result.set(active[k].id, pos);
    rank += j - i;
    i = j;
  }

  for (const c of competitors) {
    const s = (c.score ?? '').toUpperCase();
    if (CUT_STATUSES.has(s)) result.set(c.id, s);
  }

  return result;
}

function computeTotalStrokes(linescores: EspnRoundLinescore[] | undefined): string {
  const sum = (linescores ?? [])
    .filter((r) => (r.linescores?.length ?? 0) > 0)
    .reduce((acc, r) => acc + Math.round(r.value), 0);
  return sum > 0 ? String(sum) : '--';
}

// ESPN hole: value=strokes, scoreType.displayValue=relative-to-par for that hole
// par formula: strokes - relScore  e.g. (4 strokes, "-1" birdie) → par = 4-(-1) = 5
function parseStoredRounds(linescores: EspnRoundLinescore[] | undefined) {
  return (linescores ?? [])
    .filter((r) => (r.linescores?.length ?? 0) > 0)
    .map((r) => ({
      roundId: r.period,
      holes: (r.linescores ?? [])
        .map((h) => {
          const score = Math.round(h.value);
          const par = score - parseRelScore(h.scoreType?.displayValue);
          return { holeNumber: h.period, par, score };
        })
        .filter((h) => h.par > 0 && h.score > 0),
    }))
    .filter((r) => r.holes.length > 0);
}

// ── Main fetch ─────────────────────────────────────────────────────────────

// How each tournament is named on ESPN's scoreboard, for finding a new season's event before its
// ESPN id is in the schedule. "The Open" must not match the U.S. Open.
const ESPN_EVENT_NAMES: Record<string, (name: string) => boolean> = {
  players: (n) => /players championship/i.test(n),
  masters: (n) => /\bmasters\b/i.test(n),
  pga: (n) => /\bpga championship\b/i.test(n),
  'us-open': (n) => /\bu\.?\s?s\.? open\b/i.test(n),
  open: (n) => /(^|\s)the open\b|\bopen championship\b|british open/i.test(n) && !/\bu\.?\s?s\.? open\b/i.test(n),
};

// espnEventId may be undefined for a season whose ESPN id isn't known yet: the event is then
// found on today's scoreboard by the tournament's name.
export async function fetchESPNTournament(espnEventId: string | undefined, tournamentId?: string): Promise<ESPNTournamentResult> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${today}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as EspnScoreboardResponse;
  const matchesName = tournamentId ? ESPN_EVENT_NAMES[tournamentId] : undefined;
  const event = espnEventId
    ? data.events?.find((e) => e.id === espnEventId)
    : data.events?.find((e) => !!matchesName && matchesName(`${e.name ?? ''} ${e.shortName ?? ''}`));
  if (!event) throw new Error(`400: event ${espnEventId ?? tournamentId} not in ESPN scoreboard for ${today}`);

  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const eventStatus = competition?.status ?? event.status;

  // Tournament not yet started
  if ((eventStatus?.type?.state ?? '') === 'pre') {
    throw new Error('400: tournament not started (STATUS_SCHEDULED)');
  }

  // Normalize: if ESPN's competitor status.type.name indicates a cut/wd/dq but c.score
  // shows a numeric score, override c.score to the canonical cut string so all downstream
  // logic (CUT_STATUSES checks, buildPositionStrings, scoring) handles it uniformly.
  // Save the original numeric score before overriding so it can be surfaced during R1/R2.
  const originalScoreById = new Map<string, string>();
  for (const c of competitors) {
    const scoreSanitized = (c.score ?? '').toUpperCase();
    if (!CUT_STATUSES.has(scoreSanitized)) {
      // Numeric score — override to cut label if status says so, saving original first.
      const statusName = (c.status?.type?.name ?? '').toUpperCase();
      const mapped = ESPN_STATUS_NAME_TO_SCORE[statusName];
      if (mapped) {
        originalScoreById.set(c.id, c.score ?? '');
        c.score = mapped;
      }
    } else {
      // ESPN already sent a cut-status score (e.g. "MC") — derive to-par from round data.
      const completedRounds = (c.linescores ?? []).filter((r) => (r.linescores?.length ?? 0) > 0);
      if (completedRounds.length > 0) {
        const total = completedRounds.reduce((sum, r) => sum + parseRelScore(r.displayValue), 0);
        const toPar = total === 0 ? 'E' : total > 0 ? `+${total}` : String(total);
        originalScoreById.set(c.id, toPar);
      }
    }
  }

  const currentRound = deriveCurrentRound(competitors, eventStatus?.period);
  const roundStatus = mapRoundStatus(eventStatus);
  const eventComplete = eventStatus?.type?.completed === true;

  // Round 3+: if ESPN marks a competitor as CUT but they have hole-by-hole data for round 3,
  // they physically played round 3 and are not cut — restore their computed to-par score so
  // they show as active. ESPN sometimes sends stale MC/CUT status alongside live round data.
  if (currentRound >= 3) {
    for (const c of competitors) {
      if (!CUT_STATUSES.has((c.score ?? '').toUpperCase())) continue;
      const round3 = (c.linescores ?? []).find((r) => r.period === 3);
      if (!round3 || (round3.linescores?.length ?? 0) === 0) continue;
      const completedRounds = (c.linescores ?? []).filter((r) => (r.linescores?.length ?? 0) > 0);
      const total = completedRounds.reduce((sum, r) => sum + parseRelScore(r.displayValue), 0);
      c.score = total === 0 ? 'E' : total > 0 ? `+${total}` : String(total);
      originalScoreById.delete(c.id);
    }
  }

  const posStrings = buildPositionStrings(competitors);

  const leaderboardRows: SlashGolfLeaderboardRow[] = [];
  const playerScorecards: Record<string, StoredPlayerScorecards> = {};

  for (const c of competitors) {
    const displayName = c.athlete?.displayName ?? c.athlete?.fullName ?? '';
    if (!displayName) continue;

    const spaceIdx = displayName.indexOf(' ');
    const firstName = spaceIdx >= 0 ? displayName.slice(0, spaceIdx) : displayName;
    const lastName = spaceIdx >= 0 ? displayName.slice(spaceIdx + 1) : '';

    // Treat MC (missed cut) identically to CUT for all downstream logic
    const rawScore = c.score ?? '--';
    const score = rawScore.toUpperCase() === 'MC' ? 'CUT' : rawScore;
    const isCut = CUT_STATUSES.has(score.toUpperCase());
    const position = posStrings.get(c.id) ?? '--';
    const thru = deriveThru(c.linescores, currentRound);
    const status = isCut ? score.toLowerCase() : 'active';

    const rounds: SlashGolfLeaderboardRow['rounds'] = (c.linescores ?? []).map((r) => ({
      roundId: r.period,
      scoreToPar: r.displayValue,
      strokes: Math.round(r.value),
    }));

    leaderboardRows.push({
      playerId: c.id,
      firstName,
      lastName,
      position,
      total: score,
      thru,
      status,
      currentRound,
      totalStrokesFromCompletedRounds: computeTotalStrokes(c.linescores),
      rounds,
      roundComplete: false,
      teeTime: extractTeeTime(c.linescores, currentRound),
      originalTotal: originalScoreById.get(c.id),
    });

    const storedRounds = parseStoredRounds(c.linescores);
    if (storedRounds.length > 0) {
      playerScorecards[c.id] = {
        playerId: c.id,
        playerName: displayName,
        rounds: storedRounds,
        refreshedAt: new Date().toISOString(),
      };
    }
  }

  return { leaderboardRows, currentRound, roundStatus, projectedCut: null, playerScorecards, eventComplete, eventId: event.id };
}
