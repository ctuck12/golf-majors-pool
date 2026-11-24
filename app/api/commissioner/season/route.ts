import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, SESSION_COOKIE_NAME, setSeasonSettings } from '../../../lib/pool-store';
import { parsePayoutPlan } from '../../../lib/payout-plan';

// This season's season-long pool: { enabled, fee, plan }. When enabled, the buy-in and payout plan
// are required; when not, Season Standings still show, just without money. Commissioner only.
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { enabled?: unknown; fee?: unknown; plan?: unknown };
    const enabled = body.enabled === true;
    const fee = body.fee === null || body.fee === undefined || body.fee === '' ? null : Number(body.fee);
    const plan = body.plan === null || body.plan === undefined ? null : parsePayoutPlan(body.plan);
    return NextResponse.json({ pool: await setSeasonSettings(session.user.id, enabled, fee, plan) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save.' }, { status: 400 });
  }
}
