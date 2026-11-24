import { requireAdminRequest } from '../../../../lib/admin-auth';
import { adminGrantFreeSeason, adminListLeagueMembers, adminSetCommissioner } from '../../../../lib/pool-store';
import { clearDemoLeague, fillDemoLeague } from '../../../../lib/demo-league';

// App admin only. GET: the league's members. PATCH { commissionerId } makes that member the
// commissioner; PATCH { freeSeason: true } gives a paid league the current season free;
// PATCH { demo: 'fill' | 'clear' } fills a demo league with a sample season, or takes it back out.
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
    const body = (await request.json()) as { commissionerId?: unknown; freeSeason?: unknown; demo?: unknown };
    if (body.demo === 'fill') {
      const result = await fillDemoLeague(leagueId);
      return Response.json({ ok: true, demo: result, members: await adminListLeagueMembers(leagueId) });
    }
    if (body.demo === 'clear') {
      const removed = await clearDemoLeague(leagueId);
      return Response.json({ ok: true, removed, members: await adminListLeagueMembers(leagueId) });
    }
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
