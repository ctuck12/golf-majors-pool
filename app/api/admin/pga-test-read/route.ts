import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  try {
    const cached = await redis.get('golf-stats-test-results');
    if (!cached) {
      return Response.json({ data: null, message: 'No cached results found. Call /api/test-golf-stats first.' });
    }
    return Response.json({ data: JSON.parse(cached) });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
