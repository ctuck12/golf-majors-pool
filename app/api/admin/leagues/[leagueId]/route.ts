import { requireAdminRequest } from '../../../../lib/admin-auth';
import { adminGrantFreeSeason, adminListLeagueMembers, adminSetCommissioner } from '../../../../lib/pool-store';

// App admin only. GET: the league's members. PATCH { commissionerId } makes that member the
// commissioner; PATCH { freeSeason: true } gives a paid league the current season free.
export async function GET(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;
  const { leagueId } = await context.params;
  return Response.json({ members: await adminListLeagueMembers(leagueId) });
}

export async function PATCH(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;
  const { leagueId } = await context.params;
  try {
    const body = (await request.json()) as { commissionerId?: unknown; freeSeason?: unknown };
    if (typeof body.commissionerId === 'string' && body.commissionerId) {
      await adminSetCommissioner(leagueId, body.commissionerId);
    }
    if (body.freeSeason === true) {
      await adminGrantFreeSeason(leagueId);
    }
    return Response.json({ ok: true, members: await adminListLeagueMembers(leagueId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to update the league.' }, { status: 400 });
  }
}
