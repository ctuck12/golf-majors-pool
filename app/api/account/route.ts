import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { deleteOwnAccount, getSessionContext, SESSION_COOKIE_NAME, updateUserAccount } from '../../lib/pool-store';

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage your account.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { password?: string; displayName?: string };
    const user = await updateUserAccount(session.user.id, {
      password: body.password,
      displayName: body.displayName,
    });
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update password.' },
      { status: 400 },
    );
  }
}

// Deletes the signed-in user's account and signs them out (Apple requires in-app deletion).
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage your account.' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
    }
    await deleteOwnAccount(session.user.id);
    cookieStore.delete(SESSION_COOKIE_NAME);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete your account.' },
      { status: 400 },
    );
  }
}
