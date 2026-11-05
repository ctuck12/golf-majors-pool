import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { PassAction } from '../../../../lib/league-passes';
import { getSessionContext, redeemPass, SESSION_COOKIE_NAME } from '../../../../lib/pool-store';

// POST { productId, action } → spends one confirmed purchase of that pass (create / upgrade / renew
// a league) and returns the refreshed session, now showing that league.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to use a pass.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { productId?: string; action?: PassAction };
    await redeemPass(session.user.id, body.productId ?? '', body.action ?? ({} as PassAction));
    return NextResponse.json(await getSessionContext(token));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to use that pass.' },
      { status: 400 },
    );
  }
}
