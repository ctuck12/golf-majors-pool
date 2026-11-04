import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const espnId = searchParams.get('espnId') ?? '';
  const name = searchParams.get('name') ?? '';

  if (!espnId && !name) {
    return Response.json({ error: 'Provide espnId or name query param' }, { status: 400 });
  }

  const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

  if (espnId) {
    const res = await fetch(`${ESPN_CORE}/athletes/${espnId}/statisticslog`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return Response.json({ error: `ESPN ${res.status}` }, { status: 502 });
    const data = await res.json();
    return Response.json(data);
  }

  return Response.json({ error: 'espnId required' }, { status: 400 });
}
