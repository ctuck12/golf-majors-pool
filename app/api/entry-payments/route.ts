import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, reportEntryPayment, SESSION_COOKIE_NAME, TOURNAMENT_IDS, type TournamentId } from '../../lib/pool-store';

// A member says they paid their entry fee ({ paid: true }), or takes it back ({ paid: false }).
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);
  if (!session.user || !session.pool) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const body = (await request.json()) as { tournamentId?: string; paid?: boolean };
    if (!TOURNAMENT_IDS.includes(body.tournamentId as TournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }
    await reportEntryPayment(session.user.id, body.tournamentId as TournamentId, body.paid !== false);
    const fresh = await getSessionContext(token);
    return NextResponse.json({ pool: fresh.pool });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 400 });
  }
}
