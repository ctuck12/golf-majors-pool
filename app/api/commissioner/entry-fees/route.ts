import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getSessionContext,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
  updateEntryFees,
  setPaymentNote,
} from '../../../lib/pool-store';

// League entry fees per tournament (members pay them to the commissioner's Venmo).
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage entry fees.' }, { status: 401 });
  }
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { fees?: Record<string, unknown>; paymentNote?: unknown };
    if (body.paymentNote !== undefined) {
      await setPaymentNote(session.user.id, typeof body.paymentNote === 'string' ? body.paymentNote : null);
    }
    if (body.fees && typeof body.fees === 'object') {
      const fees: Partial<Record<TournamentId, number | null>> = {};
      for (const tid of TOURNAMENT_IDS) {
        if (!(tid in body.fees)) continue;
        const raw = body.fees[tid];
        fees[tid] = raw === null || raw === '' || raw === undefined ? null : Number(raw);
      }
      await updateEntryFees(session.user.id, fees);
    }
    const fresh = await getSessionContext(token);
    return NextResponse.json({ pool: fresh.pool });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save entry fees.' },
      { status: 400 },
    );
  }
}
