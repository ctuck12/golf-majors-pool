import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, isAppAdmin, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import {
  parseDpWorldPaste,
  getManualDpWorldRankings,
  saveManualDpWorldRankings,
  clearManualDpWorldRankings,
} from '../../../lib/dpworld-rankings-store';

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

function preview(map: Record<string, number>) {
  return Object.entries(map)
    .sort((a, b) => a[1] - b[1])
    .map(([name, rank]) => ({ rank, name }));
}

// Read the currently-stored manual rankings (or null if the built-in list is in use).
export async function GET() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  const current = await getManualDpWorldRankings();
  return NextResponse.json({
    active: !!current,
    count: current?.count ?? 0,
    updatedAt: current?.updatedAt ?? null,
    preview: current ? preview(current.map) : [],
  });
}

// Parse a pasted standings block and save it. Returns what was parsed so the UI can confirm.
export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { text?: string };
  try { body = (await request.json()) as { text?: string }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const text = (body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Paste the Race to Dubai standings first.' }, { status: 400 });

  const parsed = parseDpWorldPaste(text);
  if (parsed.count < 5) {
    return NextResponse.json({
      error: `Only ${parsed.count} player(s) parsed — that doesn't look right. Each line should start with a rank number, e.g. "1 Rory McIlroy".`,
      skipped: parsed.skipped.slice(0, 10),
    }, { status: 400 });
  }
  const saved = await saveManualDpWorldRankings(parsed.map, new Date().toISOString());
  return NextResponse.json({
    ok: true,
    count: saved.count,
    updatedAt: saved.updatedAt,
    skippedCount: parsed.skipped.length,
    skipped: parsed.skipped.slice(0, 10),
    preview: preview(saved.map),
  });
}

// Clear the pasted list and revert the bubble to the built-in snapshot.
export async function DELETE() {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  await clearManualDpWorldRankings();
  return NextResponse.json({ ok: true, active: false });
}
