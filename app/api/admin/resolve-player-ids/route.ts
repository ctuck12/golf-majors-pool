import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

// Resolves pgaTourId for pool players where pgaTourId === 0 by pulling the full PGA Tour
// player directory (tourCode R) once and matching by normalized name. Returns ready-to-paste
// pgaTourId values for player-pool.ts.
// GET /api/admin/resolve-player-ids

const GQL_URL = 'https://orchestrator.pgatour.com/graphql';
const GQL_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();
const firstLast = (s: string) => {
  const p = norm(s).split(/\s+/).filter(Boolean);
  return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : norm(s);
};

async function fetchDirectory(): Promise<{ players: Array<{ id: string; displayName: string }>; error?: string }> {
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': GQL_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({
        query: `query Dir { playerDirectory(tourCode: R) { players { id displayName } } }`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { players: [], error: `HTTP ${res.status}` };
    const json = await res.json();
    if (json.errors?.length) return { players: [], error: JSON.stringify(json.errors).slice(0, 300) };
    return { players: json?.data?.playerDirectory?.players ?? [] };
  } catch (e) { return { players: [], error: String(e).slice(0, 150) }; }
}

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const unresolved = PLAYER_POOL_WITH_PGA_IDS.filter((p) => (p.pgaTourId as number) === 0);
  if (unresolved.length === 0) return Response.json({ message: 'All players have pgaTourId resolved.' });

  const dir = await fetchDirectory();
  if (dir.error) return Response.json({ error: dir.error, directorySize: dir.players.length });

  const byNorm = new Map<string, string>();
  const byFL = new Map<string, string>();
  for (const p of dir.players) {
    const n = norm(p.displayName);
    if (!byNorm.has(n)) byNorm.set(n, p.id);
    const fl = firstLast(p.displayName);
    if (!byFL.has(fl)) byFL.set(fl, p.id);
  }

  const results = unresolved.map((p) => {
    const discovered = byNorm.get(norm(p.name)) ?? byFL.get(firstLast(p.name)) ?? null;
    return { name: p.name, id: p.id, discovered };
  });
  const found = results.filter((r) => r.discovered);
  const missing = results.filter((r) => !r.discovered);

  return Response.json({
    directorySize: dir.players.length,
    totalUnresolved: unresolved.length,
    found: found.length,
    missing: missing.length,
    // name -> discovered pgaTourId for the matches:
    discovered: Object.fromEntries(found.map((r) => [r.name, r.discovered])),
    stillMissing: missing.map((r) => r.name),
  });
}
