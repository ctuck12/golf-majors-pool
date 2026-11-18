import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createEmailVerificationCode, createSession, getSessionContext, markEmailVerified, registerUser, SESSION_COOKIE_NAME, userDataBackend } from '../../../lib/pool-store';
import { isEmailConfigured, sendVerificationCodeEmail } from '../../../lib/email';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      joinCode?: string;
    };

    const user = await registerUser({
      displayName: body.displayName,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? '',
      password: body.password ?? '',
      joinCode: body.joinCode ?? '',
    });

    // Email the code that confirms the address. Without email set up (local testing) the account
    // is confirmed straight away; if sending fails the user can ask for a new code in the app.
    if (userDataBackend() === 'postgres') {
      if (isEmailConfigured()) {
        const code = await createEmailVerificationCode(user.id);
        if (code) {
          await sendVerificationCodeEmail({ to: user.email, displayName: user.displayName, code }).catch((err) => {
            console.error('Could not send the confirmation code:', err);
          });
        }
      } else {
        await markEmailVerified(user.id);
      }
    }

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
      { error: error instanceof Error ? error.message : 'Unable to create account.' },
      { status: 400 },
    );
  }
}
