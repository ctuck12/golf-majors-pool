import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME, setLeaguePayoutPlan } from '../../../lib/pool-store';
import { parsePayoutPlan } from '../../../lib/payout-plan';

// The league's payout plan: { plan } saves it, { plan: null } removes it. Commissioner only.
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage payouts.' }, { status: 401 });
  }
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { plan?: unknown };
    const plan = body.plan === null ? null : parsePayoutPlan(body.plan);
    return NextResponse.json({ pool: await setLeaguePayoutPlan(session.user.id, plan) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save the payout plan.' }, { status: 400 });
  }
}
