import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isEmailConfigured, sendPasswordResetEmail } from '../../../lib/email';
import {
  clearPasswordResetThrottle,
  createPasswordResetToken,
  createSession,
  getSessionContext,
  resetPasswordWithToken,
  SESSION_COOKIE_NAME,
} from '../../../lib/pool-store';

const SENT_MESSAGE = 'If an account exists for that email, we sent a password reset link. It expires in 1 hour.';
const NOT_CONFIGURED_MESSAGE = 'Password resets are handled by your commissioner for now. Ask them to set a new password for you.';

// POST { email }               → emails a one-time reset link (same reply whether or not the account exists)
// POST { token, newPassword }  → sets the new password from that link and signs the user in
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; token?: string; newPassword?: string };

    if (body.token) {
      const user = await resetPasswordWithToken(body.token, body.newPassword ?? '');
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
      return NextResponse.json({ success: true, ...session, sessionToken });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json({ error: NOT_CONFIGURED_MESSAGE }, { status: 403 });
    }

    const email = body.email?.trim() ?? '';
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    const reset = await createPasswordResetToken(email);
    if (reset) {
      try {
        await sendPasswordResetEmail({ to: reset.email, displayName: reset.displayName, token: reset.token });
      } catch (error) {
        console.error('Password reset email failed', error);
        await clearPasswordResetThrottle(reset.email);
        return NextResponse.json({ error: "We couldn't send the email right now. Please try again shortly." }, { status: 502 });
      }
    }

    return NextResponse.json({ sent: true, message: SENT_MESSAGE });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Something went wrong.' },
      { status: 400 },
    );
  }
}
