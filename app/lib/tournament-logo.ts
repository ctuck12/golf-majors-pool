import { currentTournamentMeta } from './tournament-config';

// Lightweight, client-safe helper to pick the current/upcoming tournament and its
// tab logo — used by the commissioner tool pages, which don't have the main app's
// tournament state. Mirrors the schedule + tab-logo mapping in app/page.tsx.

export type HeaderTournament = { id: string; name: string; logo: string; color: string };

// `color` matches entriesTournamentSolid (the tournament header color) in app/page.tsx.
const SCHEDULE: HeaderTournament[] = [
  { id: 'players', name: 'The Players', logo: '/players-tab-logo.webp', color: '#173b63' },
  { id: 'masters', name: 'The Masters', logo: '/masters-tab-logo.png', color: '#2c6449' },
  { id: 'pga', name: 'PGA Championship', logo: '/pga-tab-logo.png', color: '#B09963' },
  { id: 'us-open', name: 'U.S. Open', logo: '/us-open-tab-logo.png', color: '#BE3436' },
  { id: 'open', name: 'The Open', logo: '/open-tab-logo.png', color: '#173b63' },
];

// id + display name for every tournament, in schedule order — for the commissioner tool's
// per-tournament salary selector (lets past events be backfilled).
// White-knockout versions of the tab logos (white marks with each tournament's signature element
// kept in brand color) for use on dark/colored headers. Generated from the tab logos.
export const KNOCKOUT_TAB_LOGOS: Record<string, string> = {
  players: '/knockout-players.png',
  masters: '/knockout-masters.png',
  pga: '/knockout-pga.png',
  'us-open': '/knockout-us-open.png',
  open: '/knockout-open.png',
};

export const TOURNAMENT_OPTIONS = SCHEDULE.map((t) => ({ id: t.id, name: t.name, color: t.color }));

export const ALL_TOURNAMENT_IDS = ['players', 'masters', 'pga', 'us-open', 'open'] as const;


// Returns the tournament in progress or up next: the one whose current event (see
// currentTournamentMeta) starts soonest. A major stays current until the Monday after it ends.
export function getHeaderTournament(now: Date = new Date()): HeaderTournament {
  const startOf = (id: string) => Date.parse(currentTournamentMeta(id, now)?.lockAtUtc ?? '') || Infinity;
  return SCHEDULE.slice().sort((a, b) => startOf(a.id) - startOf(b.id))[0];
}
