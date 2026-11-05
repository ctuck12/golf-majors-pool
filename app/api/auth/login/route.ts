import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSession, getSessionContext, loginUser, SESSION_COOKIE_NAME } from '../../../lib/pool-store';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const user = await loginUser({
      email: body.email ?? '',
      password: body.password ?? '',
    });

    const token = await createSession(user.id);
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    const session = await getSessionContext(token);
    // The iPhone app can't read the cookie, so it gets the token in the body (it asks with this header).
    const sessionToken = request.headers.get('x-client-platform') === 'native' ? token : undefined;
    return NextResponse.json({ ...session, sessionToken });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to sign in.' },
      { status: 400 },
    );
  }
}
