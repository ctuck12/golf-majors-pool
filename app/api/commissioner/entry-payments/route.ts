import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME, setEntryPaymentStatus, TOURNAMENT_IDS, type TournamentId } from '../../../lib/pool-store';

// The commissioner sets a member's entry fee status: 'confirmed', 'reported' or null (not paid).
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { tournamentId?: string; userId?: string; status?: string | null };
    if (!TOURNAMENT_IDS.includes(body.tournamentId as TournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }
    if (!body.userId) return NextResponse.json({ error: 'Choose a member.' }, { status: 400 });
    const status = body.status === 'confirmed' || body.status === 'reported' ? body.status : null;
    const pool = await setEntryPaymentStatus(session.user.id, body.tournamentId as TournamentId, body.userId, status);
    return NextResponse.json({ pool });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 400 });
  }
}
