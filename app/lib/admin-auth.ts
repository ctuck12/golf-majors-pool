import { cookies } from 'next/headers';
import { getSessionContext, isAppAdmin, SESSION_COOKIE_NAME } from './pool-store';

// Gate for the admin / debug / probe endpoints. Allowed when the caller presents
// `Authorization: Bearer <CRON_SECRET>` (scripts, curl) or is signed in as the app admin
// (hitting the URL in a browser). Returns a 401 response to send back, or null when allowed.
export async function requireAdminRequest(request: Request): Promise<Response | null> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`) {
    return null;
  }

  const cookieStore = await cookies();
  // A session lookup that fails (e.g. user-data tables not created yet) just means "not signed in".
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value).catch(() => null);
  if (isAppAdmin(session?.user)) {
    return null;
  }

  return Response.json({ error: 'Not authorized.' }, { status: 401 });
}
