import { cookies } from 'next/headers';
import { getSessionContext, SESSION_COOKIE_NAME } from './pool-store';

const COMMISSIONER_EMAIL = 'ctuck12@gmail.com';
const COMMISSIONER_DISPLAY_NAME = 'Clayton Tucker';

// Gate for the admin / debug / probe endpoints. Allowed when the caller presents
// `Authorization: Bearer <CRON_SECRET>` (scripts, curl) or is signed in as the commissioner
// (hitting the URL in a browser). Returns a 401 response to send back, or null when allowed.
export async function requireAdminRequest(request: Request): Promise<Response | null> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) {
    return null;
  }

  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (
    session.user &&
    session.user.email.trim().toLowerCase() === COMMISSIONER_EMAIL &&
    session.user.displayName.trim() === COMMISSIONER_DISPLAY_NAME
  ) {
    return null;
  }

  return Response.json({ error: 'Not authorized.' }, { status: 401 });
}
