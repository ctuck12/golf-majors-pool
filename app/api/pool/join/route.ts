import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionContext, joinPoolForUser, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in before joining a pool.' }, { status: 401 });
  }
  if (session.user.emailVerified === false) {
    return NextResponse.json({ error: 'Confirm your email first. Enter the code we emailed you.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { joinCode?: string };
    await joinPoolForUser(session.user.id, body.joinCode ?? '');
    const refreshedSession = await getSessionContext(token);
    return NextResponse.json(refreshedSession);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to join the pool.' },
      { status: 400 },
    );
  }
}
