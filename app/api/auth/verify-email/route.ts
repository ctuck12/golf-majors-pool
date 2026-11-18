import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isEmailConfigured, sendVerificationCodeEmail } from '../../../lib/email';
import {
  confirmEmailWithCode,
  createEmailVerificationCode,
  getSessionContext,
  SESSION_COOKIE_NAME,
} from '../../../lib/pool-store';

// POST { code } confirms the signed-in account's email. POST { resend: true } emails a new code.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);
  if (!session.user) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { code?: unknown; resend?: unknown };
    if (body.resend === true) {
      if (!isEmailConfigured()) {
        return NextResponse.json({ error: "Email isn't set up yet." }, { status: 400 });
      }
      const code = await createEmailVerificationCode(session.user.id);
      if (!code) {
        return NextResponse.json({ error: 'A code was just sent. Wait a minute before asking for another.' }, { status: 429 });
      }
      await sendVerificationCodeEmail({ to: session.user.email, displayName: session.user.displayName, code });
      return NextResponse.json({ sent: true });
    }

    const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
    if (code.length !== 6) {
      return NextResponse.json({ error: 'Enter the 6-digit code from the email.' }, { status: 400 });
    }
    await confirmEmailWithCode(session.user.id, code);
    return NextResponse.json(await getSessionContext(token));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to confirm your email.' },
      { status: 400 },
    );
  }
}
