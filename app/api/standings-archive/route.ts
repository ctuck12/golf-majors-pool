export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import redis from '@/app/lib/redis';
import { legacyRowKey, legacyYears } from '@/app/lib/legacy-archive';
import { eventHasStarted } from '@/app/lib/tournament-config';
import { cookies } from 'next/headers';
import { DEFAULT_POOL_ID, getSessionContext, SESSION_COOKIE_NAME, archiveSeasonsFor, readStandingsArchive, saveStandingsArchive, userDataBackend } from '@/app/lib/pool-store';

// "Past Results": each league's final standings, one snapshot per (tournament, season), kept in
// Postgres. Standings are computed on the client, so a member's app posts the final table when a
// tournament is complete. The founder league's 2026 history was first saved in Redis (one shared
// set); it's read from there and copied into the database the first time it's opened.

const TOURNAMENT_IDS = new Set(['players', 'masters', 'pga', 'us-open', 'open']);

type ArchiveGolfer = { name: string; score: string; points: number; position: string; salary: number };
type ArchiveRow = { id?: string; place: number; name: string; points: number; holesRemaining: number; tieBreak: number; golfers?: ArchiveGolfer[] };
type ArchivePayouts = { first?: number; second?: number; third?: number };

async function currentLeague() {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  return session.user && session.pool ? session.pool : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tid = searchParams.get('tournamentId') ?? '';
  if (!TOURNAMENT_IDS.has(tid)) return Response.json({ error: 'unknown tournament' }, { status: 400 });
  if (userDataBackend() !== 'postgres') return Response.json({ tournamentId: tid, years: [] });
  const league = await currentLeague();
  if (!league) return Response.json({ error: 'Sign in to see past results.' }, { status: 401 });
  const isFounder = league.id === DEFAULT_POOL_ID;

  const yearParam = searchParams.get('year');
  if (!yearParam) {
    // List the saved seasons for this tournament.
    const years = new Set(await archiveSeasonsFor(league.id, tid));
    if (isFounder) for (const y of await legacyYears(tid)) years.add(y);
    return Response.json({ tournamentId: tid, years: [...years].filter((y) => eventHasStarted(tid, y)).sort((a, b) => b - a) });
  }
  const year = parseInt(yearParam, 10);
  if (isNaN(year)) return Response.json({ error: 'bad year' }, { status: 400 });
  try {
    const saved = await readStandingsArchive(league.id, tid, year);
    if (saved) return Response.json({ tournamentId: tid, year, available: true, ...saved });
    if (isFounder) {
      const raw = await redis.get(legacyRowKey(tid, year));
      if (raw) {
        const data = JSON.parse(raw as string) as { standings: ArchiveRow[]; savedAt: string; payouts?: ArchivePayouts };
        await saveStandingsArchive(league.id, tid, year, data.standings ?? [], data.payouts ?? null);
        return Response.json({ tournamentId: tid, year, available: true, standings: data.standings ?? [], payouts: data.payouts ?? null, savedAt: data.savedAt ?? null });
      }
    }
    return Response.json({ tournamentId: tid, year, available: false, standings: [] });
  } catch {
    return Response.json({ tournamentId: tid, year, available: false, standings: [] });
  }
}

export async function POST(req: NextRequest) {
  if (userDataBackend() !== 'postgres') return Response.json({ ok: true, skipped: 'no database' });
  const league = await currentLeague();
  if (!league) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  let body: { tournamentId?: string; year?: number; standings?: ArchiveRow[]; payouts?: ArchivePayouts };
  try { body = await req.json(); } catch { return Response.json({ error: 'bad body' }, { status: 400 }); }

  const tid = body.tournamentId ?? '';
  const year = Number(body.year);
  const standings = Array.isArray(body.standings) ? body.standings : [];
  if (!TOURNAMENT_IDS.has(tid)) return Response.json({ error: 'unknown tournament' }, { status: 400 });
  if (isNaN(year) || year < 2000 || year > 2100) return Response.json({ error: 'bad year' }, { status: 400 });
  // Results can only be final for an event that has been played.
  if (!eventHasStarted(tid, year)) return Response.json({ error: 'That tournament has not been played yet.' }, { status: 400 });
  // Require a real, non-trivial standings payload so a partial/empty client render can't clobber a
  // good archive.
  if (standings.length < 1) return Response.json({ error: 'empty standings' }, { status: 400 });

  const clean: ArchiveRow[] = standings.slice(0, 500).map((r) => ({
    ...(typeof r.id === 'string' && r.id ? { id: r.id.slice(0, 80) } : {}),
    place: Number(r.place) || 0,
    name: String(r.name ?? '').slice(0, 80),
    points: Number(r.points) || 0,
    holesRemaining: Number(r.holesRemaining) || 0,
    tieBreak: Number(r.tieBreak) || 0,
    golfers: Array.isArray(r.golfers) ? r.golfers.slice(0, 12).map((g) => ({
      name: String(g?.name ?? '').slice(0, 80),
      score: String(g?.score ?? ''),
      points: Number(g?.points) || 0,
      position: String(g?.position ?? ''),
      salary: Number(g?.salary) || 0,
    })) : [],
  }));

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const payouts: ArchivePayouts | undefined = body.payouts
    ? { first: num(body.payouts.first), second: num(body.payouts.second), third: num(body.payouts.third) }
    : undefined;

  try {
    // A smaller (partly loaded) snapshot never replaces a larger one.
    const saved = await saveStandingsArchive(league.id, tid, year, clean, payouts ?? null);
    if (!saved) return Response.json({ ok: true, skipped: 'existing archive is larger' });
  } catch {
    return Response.json({ error: 'store failed' }, { status: 500 });
  }
  return Response.json({ ok: true, count: clean.length });
}
