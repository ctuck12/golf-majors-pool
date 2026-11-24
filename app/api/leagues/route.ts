import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createLeague, getSessionContext, SESSION_COOKIE_NAME } from '../../lib/pool-store';

// POST { name, venmoEnabled? } → creates a league with the caller as commissioner and switches to it.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to create a league.' }, { status: 401 });
  }
  if (session.user.emailVerified === false) {
    return NextResponse.json({ error: 'Confirm your email first. Enter the code we emailed you.' }, { status: 403 });
  }

  if (!session.canCreateLeague) {
    return NextResponse.json({ error: 'Creating new leagues opens soon.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { name?: string; venmoEnabled?: boolean };
    // The app admin's leagues are founder leagues (free, no cap). Leagues anyone else creates start
    // on the smallest tier until the paid upgrade flow exists.
    await createLeague(session.user.id, {
      name: body.name ?? '',
      plan: session.isAppAdmin ? 'founder' : 'six',
      memberLimit: session.isAppAdmin ? null : 6,
      venmoEnabled: body.venmoEnabled !== false,
    });
    return NextResponse.json(await getSessionContext(token));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create the league.' },
      { status: 400 },
    );
  }
}
