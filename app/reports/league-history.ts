'use client';

import { useEffect, useState } from 'react';
import type { TournamentId } from '../lib/pool-store-shared';

// The league's finished tournaments (from Past Results), loaded once per page and shared by the
// Season Standings and Hall of Champions reports.

export const TOURNAMENT_ORDER: TournamentId[] = ['players', 'masters', 'pga', 'us-open', 'open'];

export type HistoryRow = { id?: string | null; name: string; place: number; points: number };
export type HistoryEvent = { tournamentId: TournamentId; season: number; standings: HistoryRow[] };

let cache: { leagueId: string; events: HistoryEvent[] } | null = null;

export function useLeagueHistory(leagueId: string | null | undefined) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(cache && cache.leagueId === leagueId ? cache.events : null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    fetch('/api/league-history', { cache: 'no-store' })
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as { events?: HistoryEvent[]; error?: string };
        if (!res.ok) throw new Error(payload.error ?? 'Unable to load your league history.');
        const list = (payload.events ?? []).map((e) => ({ ...e, standings: (e.standings ?? []).filter((r) => r && r.name) }));
        cache = { leagueId, events: list };
        if (!cancelled) setEvents(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load your league history.');
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);
  return { events, error };
}

// One member's key across events: their id when the snapshot has it, else their name.
export const memberKey = (row: HistoryRow) => (row.id ? `id:${row.id}` : `name:${row.name.trim().toLowerCase()}`);

export type SeasonRow = {
  key: string;
  id: string | null;
  name: string;
  total: number;
  events: number;
  wins: number;
  podiums: number;
  best: number;
  byTournament: Partial<Record<TournamentId, { points: number; place: number }>>;
};

// Older snapshots have names only: fold a name into the member id seen with it elsewhere.
export function keyResolver(events: HistoryEvent[]) {
  const idByName = new Map<string, string>();
  for (const e of events) for (const r of e.standings) if (r.id) idByName.set(r.name.trim().toLowerCase(), `id:${r.id}`);
  return (r: HistoryRow) => (r.id ? `id:${r.id}` : idByName.get(r.name.trim().toLowerCase()) ?? memberKey(r));
}

// Season standings: points added up across the season's finished majors. Ties go to more wins,
// then the better best finish.
export function seasonStandings(events: HistoryEvent[], season: number, currentNames: Map<string, string>): SeasonRow[] {
  const rows = new Map<string, SeasonRow>();
  const keyOf = keyResolver(events);
  for (const e of events.filter((ev) => ev.season === season)) {
    for (const r of e.standings) {
      const key = keyOf(r);
      const id = key.startsWith('id:') ? key.slice(3) : null;
      const row = rows.get(key) ?? { key, id, name: (id && currentNames.get(id)) || r.name, total: 0, events: 0, wins: 0, podiums: 0, best: 999, byTournament: {} };
      row.total += Number(r.points) || 0;
      row.events += 1;
      if (r.place === 1) row.wins += 1;
      if (r.place >= 1 && r.place <= 3) row.podiums += 1;
      if (r.place > 0) row.best = Math.min(row.best, r.place);
      row.byTournament[e.tournamentId] = { points: Number(r.points) || 0, place: r.place };
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || b.wins - a.wins || a.best - b.best || a.name.localeCompare(b.name));
}

// A season is complete once its last major (The Open) is saved.
export function seasonComplete(events: HistoryEvent[], season: number) {
  return events.some((e) => e.season === season && e.tournamentId === 'open');
}

export function seasonsIn(events: HistoryEvent[]) {
  return [...new Set(events.map((e) => e.season))].sort((a, b) => b - a);
}
