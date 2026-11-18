import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { declineVenmo, getSessionContext, SESSION_COOKIE_NAME, updateUserVenmo } from '../../../lib/pool-store';

// Saves the signed-in user's Venmo username (an empty value removes it), or { declined: true }
// when they don't use Venmo, so the app stops asking.
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to add your Venmo.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { venmo?: unknown; declined?: unknown };
    if (body.declined === true) {
      await declineVenmo(session.user.id);
    } else {
      await updateUserVenmo(session.user.id, body.venmo ?? null);
    }
    const fresh = await getSessionContext(token);
    return NextResponse.json(fresh);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save your Venmo.' },
      { status: 400 },
    );
  }
}
