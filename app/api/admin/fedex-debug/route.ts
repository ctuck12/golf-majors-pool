import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

import { getEspnId } from '@/app/lib/espn-player-season';
import { getActiveSeason } from '@/app/lib/tournament-config';

// Diagnoses the FedEx-rank pipeline: resolves the player's ESPN id, fetches the same
// leaders endpoints /api/player-fedex-rank uses, and reports statuses, category names,
// and whether/where the player appears. GET /api/admin/fedex-debug?name=Jordan%20Spieth

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

async function probe(url: string, espnId: string | null) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { url, status: res.status };
    const data = await res.json() as { categories?: Array<{ name: string; displayName?: string; leaders?: Array<{ value?: number; athlete: Record<string, string> }> }> };
    const categories = (data.categories ?? []).map((c) => ({
      name: c.name,
      displayName: c.displayName,
      leaders: c.leaders?.length ?? 0,
    }));
    let playerHit: { category: string; index: number; value: number | null } | null = null;
    if (espnId) {
      for (const c of data.categories ?? []) {
        const idx = (c.leaders ?? []).findIndex((l) => {
          const ref = Object.values(l.athlete ?? {})[0] ?? '';
          return String(ref).match(/athletes\/(\d+)/)?.[1] === espnId;
        });
        if (idx !== -1) { playerHit = { category: c.name, index: idx, value: c.leaders?.[idx]?.value ?? null }; break; }
      }
    }
    return { url, status: res.status, categories, playerHit };
  } catch (e) {
    return { url, error: String(e).slice(0, 200) };
  }
}

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? 'Jordan Spieth';
  const season = getActiveSeason();
  const espnId = await getEspnId(name).catch((e) => `ERROR: ${String(e).slice(0, 200)}` as const);
  const id = typeof espnId === 'string' && !espnId.startsWith('ERROR') ? espnId : null;

  const results = await Promise.all([
    probe(`${ESPN_CORE}/pga/seasons/${season}/types/2/leaders?limit=336`, id),
    probe(`${ESPN_CORE}/pga/seasons/${season}/leaders?limit=336`, id),
  ]);

  return Response.json({ name, season, espnId, probes: results });
}
