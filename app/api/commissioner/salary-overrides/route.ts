import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, isAppAdmin, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import {
  parseSalaryPaste,
  getManualSalaries,
  saveManualSalaries,
  clearManualSalaries,
} from '../../../lib/salary-overrides-store';
import { getDynamicPlayers, ensureDynamicPlayers, backfillDynamicPgaIds } from '../../../lib/dynamic-pool-store';
import { getPgaDirectoryResolver } from '../../../lib/pga-directory';
import { getEspnId } from '../../../lib/espn-player-season';
import { canonicalNameKey } from '../../../lib/name-match';
import { mergePlayerTags } from '../../../lib/player-tags-store';
import { ALL_TOURNAMENT_IDS, getHeaderTournament } from '../../../lib/tournament-logo';

export const dynamic = 'force-dynamic';

// The tournament a salary upload applies to. Prefer an explicit id from the client (it knows which
// tournament card is active), else fall back to the current tournament. Guards against bad values.
function resolveTournamentId(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (v && (ALL_TOURNAMENT_IDS as readonly string[]).includes(v)) return v;
  return getHeaderTournament().id;
}

async function requireCommissioner() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);
  if (!session.user) return { error: NextResponse.json({ error: 'Sign in to manage pool settings.' }, { status: 401 }) };
  if (!isAppAdmin(session.user)) {
    return { error: NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const tournamentId = resolveTournamentId(new URL(request.url).searchParams.get('tournamentId'));
  const current = await getManualSalaries(tournamentId);
  return NextResponse.json({ active: !!current, count: current?.count ?? 0, updatedAt: current?.updatedAt ?? null, tournamentId });
}

export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { text?: string; tournamentId?: string };
  try { body = (await request.json()) as { text?: string; tournamentId?: string }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Paste the salary list first.' }, { status: 400 });
  const tournamentId = resolveTournamentId(body.tournamentId);

  // Match against the static pool AND any players auto-added on prior uploads, so re-uploads reuse
  // their existing dynamic ID instead of creating duplicates.
  const dynamicExisting = await getDynamicPlayers();
  const parsed = parseSalaryPaste(text, dynamicExisting.map((d) => ({ id: d.id, name: d.name })));
  if (parsed.matched.length < 5) {
    return NextResponse.json({
      error: `Only ${parsed.matched.length} player(s) matched the pool — that doesn't look right. Each line should be "Player Name  Salary", e.g. "Scottie Scheffler 11900".`,
      unmatched: parsed.unmatched.slice(0, 15),
      skipped: parsed.skipped.slice(0, 10),
    }, { status: 400 });
  }

  // Auto-add any still-unmatched names to the dynamic pool so they appear on the pick sheet with the
  // uploaded salary/rank. Resolve each one's ESPN id by name (best-effort) for their headshot.
  let autoAddedCount = 0;
  let newlyAddedNames: string[] = [];
  if (parsed.unmatched.length > 0) {
    const withEspn = await Promise.all(
      parsed.unmatched.map(async (u) => ({
        name: u.name,
        worldRank: u.worldRank,
        espnId: (await getEspnId(u.name).catch(() => null)) ?? undefined,
      })),
    );
    const resolvePgaId = await getPgaDirectoryResolver();
    const { idByCanon, added } = await ensureDynamicPlayers(withEspn, resolvePgaId);
    await backfillDynamicPgaIds(resolvePgaId);
    newlyAddedNames = added.map((p) => p.name).sort();
    for (const u of parsed.unmatched) {
      const id = idByCanon[canonicalNameKey(u.name)];
      if (id != null && !(id in parsed.map)) {
        parsed.map[id] = { salary: u.salary, worldRank: u.worldRank };
        autoAddedCount++;
      }
    }
  }

  // Persist any amateur / club-pro markers found in the salary list so the bio header updates automatically.
  const tags = await mergePlayerTags(parsed.amateurs, parsed.clubPros);

  const saved = await saveManualSalaries(tournamentId, parsed.map, new Date().toISOString());
  const withRank = parsed.matched.filter((m) => m.worldRank != null).length;
  return NextResponse.json({
    ok: true,
    count: saved.count,
    updatedAt: saved.updatedAt,
    tournamentId, // which tournament this list was saved under
    matchedCount: parsed.matched.length,
    worldRankCount: withRank, // how many rows also carried a world rank
    autoAddedCount, // names not previously in the pool that were priced into the pick sheet
    newlyAddedCount: newlyAddedNames.length, // brand-new names added to the pool database
    newlyAdded: newlyAddedNames, // the actual new names, for the commissioner to review
    unmatchedCount: 0, // all previously-unmatched names are now auto-added to the pool
    unmatched: [],
    skipped: parsed.skipped.slice(0, 10),
    amateurCount: tags.amateur.length, // total flagged amateurs after this upload
    clubProCount: tags.clubPro.length, // total flagged club pros after this upload
    preview: parsed.matched.slice().sort((a, b) => b.salary - a.salary),
  });
}

export async function DELETE(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const tournamentId = resolveTournamentId(new URL(request.url).searchParams.get('tournamentId'));
  await clearManualSalaries(tournamentId);
  return NextResponse.json({ ok: true, active: false });
}
