import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

import { getDynamicPlayers } from '@/app/lib/dynamic-pool-store';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { canonicalNameKey } from '@/app/lib/name-match';
import { applyNameAlias } from '@/app/lib/name-aliases';

// Dumps the dynamic (auto-added) pool as ready-to-paste player-pool.ts entries, so the
// commissioner can promote them into the static pool. Entries whose name already resolves
// to a static pool player (directly or via alias) are skipped — they're duplicates.
// GET /api/admin/dynamic-dump

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const dyn = await getDynamicPlayers();
  const staticCanon = new Set(PLAYER_POOL_WITH_PGA_IDS.map((p) => canonicalNameKey(p.name)));
  const fresh = dyn.filter((p) => !staticCanon.has(canonicalNameKey(applyNameAlias(p.name))));
  const skipped = dyn.length - fresh.length;

  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
  const lines = fresh
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((p) =>
      `  { id: ${p.id}, name: ${pad(`'${p.name.replace(/'/g, "\\'")}',`, 34)} pgaTourId: ${pad(`${p.pgaTourId},`, 7)} defaultOdds: '${p.defaultOdds}', worldRank: ${p.worldRank} },`,
    );

  return new Response(
    [`// ${fresh.length} dynamic player(s) (${skipped} skipped as static duplicates)`, ...lines, ''].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
}
