import redis from './redis';
import { getTournamentMeta, getTournamentMetaByEspnId, type TournamentMeta } from './tournament-config';

// ESPN event ids for a new season aren't known until ESPN lists the events. Live scoring finds a
// tournament on ESPN's scoreboard by name and records the id here, so the stat features (course
// and strokes-gained leaderboards, a player's tournament stats) work without editing the schedule.
// Ids written in app/lib/tournament-config.ts always win.

const KEY = 'espn-event-ids:v1';

type Found = Record<string, { tournamentId: string; season: number }>; // espn event id -> event

async function readFound(): Promise<Found> {
  try {
    const raw = await redis.get(KEY);
    return raw ? (JSON.parse(raw) as Found) : {};
  } catch {
    return {};
  }
}

export async function recordFoundEspnEvent(tournamentId: string, season: number, espnEventId: string) {
  const found = await readFound();
  if (found[espnEventId]?.season === season && found[espnEventId]?.tournamentId === tournamentId) return;
  for (const [id, event] of Object.entries(found)) {
    if (event.tournamentId === tournamentId && event.season === season) delete found[id];
  }
  found[espnEventId] = { tournamentId, season };
  await redis.set(KEY, JSON.stringify(found));
}

// The event an ESPN id belongs to: from the schedule, or one live scoring found.
export async function metaForEspnEvent(espnEventId: string): Promise<TournamentMeta | undefined> {
  const scheduled = getTournamentMetaByEspnId(espnEventId);
  if (scheduled) return scheduled;
  const event = (await readFound())[espnEventId];
  return event ? getTournamentMeta(event.tournamentId, event.season) : undefined;
}

// A tournament's ESPN id for a season: from the schedule, or the one live scoring found.
export async function espnEventIdFor(tournamentId: string, season: number): Promise<string | undefined> {
  const scheduled = getTournamentMeta(tournamentId, season)?.espnEventId;
  if (scheduled) return scheduled;
  const found = await readFound();
  return Object.entries(found).find(([, event]) => event.tournamentId === tournamentId && event.season === season)?.[0];
}

// Every event with a known ESPN id (scheduled or found), oldest season first.
export async function knownEspnEvents(): Promise<{ tournamentId: string; season: number; espnEventId: string; lockAtUtc: string }[]> {
  const { scheduledEspnEvents } = await import('./tournament-config');
  const events: { tournamentId: string; season: number; espnEventId: string; lockAtUtc: string }[] = scheduledEspnEvents();
  for (const [espnEventId, event] of Object.entries(await readFound())) {
    if (events.some((e) => e.tournamentId === event.tournamentId && e.season === event.season)) continue;
    const meta = getTournamentMeta(event.tournamentId, event.season);
    if (meta) events.push({ tournamentId: event.tournamentId, season: event.season, espnEventId, lockAtUtc: meta.lockAtUtc });
  }
  return events.sort((a, b) => a.season - b.season);
}
