import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, isAppAdmin, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import { detectPlayerTags } from '../../../lib/name-match';
import { mergePlayerTags, getPlayerTags } from '../../../lib/player-tags-store';

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

// Parse a plain list of PGA club-professional names — one per line. A leading rank/number column is
// dropped and trailing comma-separated columns are trimmed. Every parsed name is treated as a club pro
// (this whole list is the club pros), so no per-name marker is needed. Any stray "(c)"/"(a)" marker is
// still stripped so the clean name matches the pool.
function parseNames(text: string): string[] {
  const names: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.replace(/\t/g, ' ').trim();
    if (!line) continue;
    line = line.replace(/^\s*\d+[.)]?\s*[,]?\s*/, '').trim();
    if (line.includes(',')) line = line.split(',')[0].trim();
    const { name } = detectPlayerTags(line);
    if (!/[a-zA-Z]/.test(name)) continue;
    if (name.length < 2) continue;
    names.push(name);
  }
  return names;
}

export async function GET() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const tags = await getPlayerTags();
  return NextResponse.json({ clubProCount: tags.clubPro.length });
}

export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { text?: string };
  try { body = (await request.json()) as { text?: string }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Paste the club-professional names first.' }, { status: 400 });

  const names = parseNames(text);
  if (names.length < 1) {
    return NextResponse.json({ error: 'No player names read — put one name per line.' }, { status: 400 });
  }

  // Flag every name as a club pro (PGA seal). Additive: this never removes existing flags.
  const tags = await mergePlayerTags([], names);
  return NextResponse.json({
    ok: true,
    submitted: names.length,        // names read from this upload
    clubProCount: tags.clubPro.length, // total flagged club pros after this upload
    names: names.slice().sort(),    // the names now carrying the PGA seal, for review
  });
}
