export const dynamic = 'force-dynamic';

import { getAllManualSalaries } from '@/app/lib/salary-overrides-store';
import { getDynamicPlayers } from '@/app/lib/dynamic-pool-store';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { canonicalNameKey } from '@/app/lib/name-match';
import { applyNameAlias } from '@/app/lib/name-aliases';
import { ALL_TOURNAMENT_IDS, getHeaderTournament } from '@/app/lib/tournament-logo';
import { POOL_SEASONS } from '@/app/lib/tournament-config';

// Public read of the commissioner's uploaded pick lists, consumed by the pick sheet + standings.
// Salary lists are stored PER TOURNAMENT, so this returns a byTournament map (id -> {salaries,
// worldRanks}) covering every event with an uploaded list — the client uses the current tournament's
// map to build the pick sheet and each viewed tournament's map to show historical standings salaries.
// For backward compatibility it also returns the CURRENT tournament's salaries/worldRanks flat.
// Also returns any auto-added dynamic players (from salary uploads whose names weren't in the static
// pool). Dynamic players since backfilled into the static pool are dropped here (matched by name).
export async function GET() {
  // Current picks season's lists, plus every scheduled season's (past standings and Reports show
  // the salaries golfers had at that year's event).
  const [byTid, dynamicRaw, ...seasonLists] = await Promise.all([
    getAllManualSalaries(ALL_TOURNAMENT_IDS),
    getDynamicPlayers(),
    ...POOL_SEASONS.map((season) => getAllManualSalaries(ALL_TOURNAMENT_IDS, () => season)),
  ]);

  // Repair map: a prior upload (before name aliases existed) may have saved salaries under a DYNAMIC
  // duplicate id (e.g. "Benjamin James") instead of the real pool player ("Ben James"). Remap those
  // salaries to the pool id on read, so existing lists show correctly without a re-upload.
  const poolIdByCanon = new Map(PLAYER_POOL_WITH_PGA_IDS.map((p) => [canonicalNameKey(p.name), p.id]));
  const idRemap = new Map<number, number>(); // dynamic id -> pool id
  for (const dp of dynamicRaw) {
    const poolId = poolIdByCanon.get(canonicalNameKey(applyNameAlias(dp.name)));
    if (poolId != null && poolId !== dp.id) idRemap.set(dp.id, poolId);
  }

  type SalaryMaps = { salaries: Record<number, number>; worldRanks: Record<number, number>; updatedAt: string | null };
  const toMaps = (lists: typeof byTid) => {
  const byTournament: Record<string, SalaryMaps> = {};
  for (const [tid, list] of Object.entries(lists)) {
    const salaries: Record<number, number> = {};
    const worldRanks: Record<number, number> = {};
    for (const [id, entry] of Object.entries(list.map)) {
      const numId = Number(id);
      let realId = numId;
      if (idRemap.has(numId)) {
        const poolId = idRemap.get(numId)!;
        if (String(poolId) in list.map) continue; // pool id already has its own entry — keep that, skip the dup
        realId = poolId;
      }
      salaries[realId] = entry.salary;
      if (typeof entry.worldRank === 'number' && entry.worldRank > 0) worldRanks[realId] = entry.worldRank;
    }
    byTournament[tid] = { salaries, worldRanks, updatedAt: list.updatedAt };
  }
  return byTournament;
  };
  const byTournament = toMaps(byTid);
  const bySeason = Object.fromEntries(POOL_SEASONS.map((season, i) => [season, toMaps(seasonLists[i])]));

  const currentId = getHeaderTournament().id;
  const current = byTournament[currentId];

  // Drop dynamic players that are really a static pool player under an alias (e.g. a prior upload added
  // "Benjamin James" before the alias existed — it maps to "Ben James", so hide the duplicate).
  const staticCanon = new Set(PLAYER_POOL_WITH_PGA_IDS.map((p) => canonicalNameKey(p.name)));
  const dynamicPlayers = dynamicRaw
    .filter((p) => !staticCanon.has(canonicalNameKey(applyNameAlias(p.name))))
    .map((p) => ({ id: p.id, name: p.name, pgaTourId: p.pgaTourId, worldRank: p.worldRank, defaultOdds: p.defaultOdds }));

  return Response.json({
    active: !!current,
    byTournament,
    bySeason,
    currentTournamentId: currentId,
    salaries: current?.salaries ?? {},   // back-compat: current tournament's flat maps
    worldRanks: current?.worldRanks ?? {},
    dynamicPlayers,
    updatedAt: current?.updatedAt ?? null,
  });
}
