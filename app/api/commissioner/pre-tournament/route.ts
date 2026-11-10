import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, isAppAdmin, SESSION_COOKIE_NAME, TOURNAMENT_IDS, type TournamentId } from '../../../lib/pool-store';
import { getPreTournamentState, setPreTournamentOverride } from '../../../lib/pre-tournament-store';

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

// Public read — the client needs the overrides at boot to place the pre-tournament / results view.
export async function GET() {
  const state = await getPreTournamentState();
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const auth = await requireCommissioner();
  if (auth.error) return auth.error;
  let body: { tournamentId?: string; show?: boolean };
  try { body = (await request.json()) as { tournamentId?: string; show?: boolean }; } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const tournamentId = body.tournamentId as TournamentId | undefined;
  if (!tournamentId || !TOURNAMENT_IDS.includes(tournamentId)) {
    return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
  }
  if (typeof body.show !== 'boolean') {
    return NextResponse.json({ error: 'show (boolean) is required.' }, { status: 400 });
  }
  const state = await setPreTournamentOverride(tournamentId, body.show, new Date().toISOString());
  return NextResponse.json(state);
}
