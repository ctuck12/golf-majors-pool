import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createEmailVerificationCode, createSession, getSessionContext, loginUser, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import { isEmailConfigured, sendVerificationCodeEmail } from '../../../lib/email';
import redis from '../../../lib/redis';

// Failed sign-ins are limited so passwords can't be guessed: 10 per email, or 30 from one
// network, in 15 minutes. A successful sign-in clears the email's count.
const WINDOW_SECONDS = 15 * 60;
const MAX_PER_EMAIL = 10;
const MAX_PER_IP = 30;

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

async function countFailure(key: string) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, WINDOW_SECONDS);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const emailKey = `login-fail:${(body.email ?? '').trim().toLowerCase()}`;
    const ipKey = `login-fail-ip:${clientIp(request)}`;
    const [emailFails, ipFails] = await redis.mget(emailKey, ipKey).catch(() => [null, null]);
    if (Number(emailFails ?? 0) >= MAX_PER_EMAIL || Number(ipFails ?? 0) >= MAX_PER_IP) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Wait 15 minutes, or use "Forgot password" to reset it.' },
        { status: 429 },
      );
    }

    let user: Awaited<ReturnType<typeof loginUser>>;
    try {
      user = await loginUser({
        email: body.email ?? '',
        password: body.password ?? '',
      });
    } catch (error) {
      await Promise.all([countFailure(emailKey), countFailure(ipKey)]).catch(() => {});
      throw error;
    }
    await redis.del(emailKey).catch(() => {});

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
    // An account that hasn't confirmed its email yet (e.g. one a commissioner added) gets a code now.
    if (session.user?.emailVerified === false && isEmailConfigured()) {
      const code = await createEmailVerificationCode(session.user.id);
      if (code) {
        await sendVerificationCodeEmail({ to: session.user.email, displayName: session.user.displayName, code }).catch((err) => {
          console.error('Could not send the confirmation code:', err);
        });
      }
    }
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
