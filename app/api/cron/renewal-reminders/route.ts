export const dynamic = 'force-dynamic';

import { ensureSchema } from '@/app/lib/db';
import { userDataBackend } from '@/app/lib/pool-store';
import { sendRenewalReminders } from '@/app/lib/renewal-reminders';

// Daily: remind commissioners whose league hasn't been renewed for the new season (see
// app/lib/renewal-reminders.ts for when each reminder goes out).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (userDataBackend() !== 'postgres') return Response.json({ skipped: 'no database' });
  await ensureSchema();
  return Response.json(await sendRenewalReminders());
}
