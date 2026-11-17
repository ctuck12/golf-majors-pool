import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  SESSION_COOKIE_NAME,
  setPayoutSent,
  TOURNAMENT_IDS,
  type TournamentId,
} from '../../../lib/pool-store';

// Marks a winner as paid through Venmo (sent: true) or undoes it (sent: false).
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to pay winners.' }, { status: 401 });
  }
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      tournamentId?: string;
      place?: unknown;
      userId?: unknown;
      amount?: unknown;
      sent?: unknown;
    };
    if (!body.tournamentId || !TOURNAMENT_IDS.includes(body.tournamentId as TournamentId)) {
      return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    }
    await setPayoutSent(session.user.id, {
      tournamentId: body.tournamentId as TournamentId,
      place: Number(body.place),
      userId: typeof body.userId === 'string' && body.userId ? body.userId : null,
      amount: Number(body.amount),
      sent: body.sent !== false,
    });
    const fresh = await getSessionContext(token);
    return NextResponse.json({ pool: fresh.pool });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update the payout.' },
      { status: 400 },
    );
  }
}
