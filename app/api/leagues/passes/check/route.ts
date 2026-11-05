import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { PassAction } from '../../../../lib/league-passes';
import { checkPassAction, getSessionContext, SESSION_COOKIE_NAME } from '../../../../lib/pool-store';

// POST { productId, action } → ok, or the reason this pass can't be used. The app asks before it
// opens Apple's payment sheet, so nobody pays for something that will be refused.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to buy a pass.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { productId?: string; action?: PassAction };
    await checkPassAction(session.user.id, body.productId ?? '', body.action ?? ({} as PassAction));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'That pass can not be used here.' },
      { status: 400 },
    );
  }
}
