import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, isAppAdmin, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import { PLAYER_POOL_WITH_PGA_IDS } from '../../../lib/player-pool';
import { getDynamicPlayers, ensureDynamicPlayers, backfillDynamicPgaIds, getFieldMeta, setFieldUpdatedAt, clearDynamicPlayers } from '../../../lib/dynamic-pool-store';
import { getPgaDirectoryResolver } from '../../../lib/pga-directory';
import { canonicalNameKey, detectPlayerTags } from '../../../lib/name-match';
import { applyNameAlias } from '../../../lib/name-aliases';
import { mergePlayerTags } from '../../../lib/player-tags-store';

export const dynamic = 'force-dynamic';

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

// Parse a pasted/uploaded full field. Each non-empty line is one player. An optional leading rank/number
// column is dropped; the remaining text is the player name. Header rows (no letters) are ignored.
// Amateur "(a)" and club-pro "(c)"/"(cp)"/"(club pro)" markers are detected and stripped so the clean
// name still matches the pool, and the flags are collected for the bio header.
function parseFieldNames(text: string): { name: string; amateur: boolean; clubPro: boolean }[] {
  const out: { name: string; amateur: boolean; clubPro: boolean }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.replace(/\t/g, ' ').trim();
    if (!line) continue;
    // Drop a leading rank number ("12  Scottie Scheffler" or "12. Scottie Scheffler" or "12,Scottie...").
    line = line.replace(/^\s*\d+[.)]?\s*[,]?\s*/, '').trim();
    // Drop any trailing comma-separated columns (e.g. "Scottie Scheffler, USA" -> "Scottie Scheffler").
    // Keep a parenthetical marker even if it trails a comma is not expected; markers are inline.
    if (line.includes(',')) line = line.split(',')[0].trim();
    const { name, amateur, clubPro } = detectPlayerTags(line);
    if (!/[a-zA-Z]/.test(name)) continue; // no letters -> not a name (header/rank-only row)
    if (name.length < 2) continue;
    out.push({ name, amateur, clubPro });
  }
  return out;
}

const STATIC_CANON = new Set(PLAYER_POOL_WITH_PGA_IDS.map((p) => canonicalNameKey(p.name)));

export async function GET() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const dyn = await getDynamicPlayers();
  const meta = await getFieldMeta();
  return NextResponse.json({ registered: dyn.length, updatedAt: meta.updatedAt });
}

export async function DELETE() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  await clearDynamicPlayers();
  return NextResponse.json({ ok: true, registered: 0 });
}

export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { text?: string };
  try { body = (await request.json()) as { text?: string }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Paste the tournament field first.' }, { status: 400 });

  const parsedNames = parseFieldNames(text);
  if (parsedNames.length < 5) {
    return NextResponse.json({ error: `Only ${parsedNames.length} name(s) read — that doesn't look like a field. Use one player name per line.` }, { status: 400 });
  }
  const names = parsedNames.map((n) => n.name);

  // Persist amateur / club-pro flags detected from the field so the bio header shows an "Amateur"
  // badge / the PGA seal automatically (matched by canonical name, so static + dynamic both benefit).
  const tags = await mergePlayerTags(
    parsedNames.filter((n) => n.amateur).map((n) => n.name),
    parsedNames.filter((n) => n.clubPro).map((n) => n.name),
  );

  // Only register names that aren't already in the static pool (those already resolve). The dynamic
  // store dedups by canonical name, so re-uploading the same field is safe (no duplicates, no salaries).
  const toRegister = names.filter((n) => !STATIC_CANON.has(canonicalNameKey(applyNameAlias(n))));
  // Auto-resolve each new player's PGA Tour id from the tour directory so their PGA/major stats load
  // with no manual step. Also retry any previously-unresolved dynamic players.
  const resolvePgaId = await getPgaDirectoryResolver();
  const { all, added } = await ensureDynamicPlayers(toRegister.map((name) => ({ name, worldRank: null })), resolvePgaId);
  await backfillDynamicPgaIds(resolvePgaId);
  const withPgaId = added.filter((p) => p.pgaTourId > 0).length;
  const updatedAt = new Date().toISOString();
  await setFieldUpdatedAt(updatedAt);

  return NextResponse.json({
    ok: true,
    updatedAt,
    fieldCount: names.length,
    alreadyInPool: names.length - toRegister.length,
    registered: toRegister.length,
    newlyAdded: added.length,
    newlyAddedWithStats: withPgaId, // of the new adds, how many got a PGA Tour id (full stats)
    addedNames: added.map((p) => p.name).sort(),
    totalDynamic: all.length,
    amateurCount: tags.amateur.length, // total flagged amateurs after this upload
    clubProCount: tags.clubPro.length, // total flagged club pros after this upload
  });
}
