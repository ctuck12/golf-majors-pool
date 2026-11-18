import { requireAdminRequest } from '../../../lib/admin-auth';
import { adminListLeagues } from '../../../lib/pool-store';
import { currentSeason } from '../../../lib/league-passes';

// App admin only: every league with its plan, season, size and commissioner.
export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;
  try {
    return Response.json({ season: currentSeason(), leagues: await adminListLeagues() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to load leagues.' }, { status: 500 });
  }
}
