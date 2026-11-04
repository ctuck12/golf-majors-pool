import { requireAdminRequest } from '@/app/lib/admin-auth';
// Debug endpoint for diagnosing missing years in the player-popup career results.
// Usage (in browser or curl):
//   /api/admin/career-debug?name=Hideki%20Matsuyama&years=2013,2017,2018,2021
// For each requested season it fetches the same ESPN eventlog the career route uses and
// reports the raw counts plus every event's name/league/played flag, so we can see whether
// the major is absent from ESPN's data, named unexpectedly, flagged unplayed, or lost to
// a fetch failure.

export const dynamic = 'force-dynamic';

import { ESPN_ID_OVERRIDES } from '@/app/lib/espn-player-season';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';

async function getEspnId(name: string): Promise<string | null> {
  if (ESPN_ID_OVERRIDES[name]) return ESPN_ID_OVERRIDES[name];
  const res = await fetch(
    `https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=${encodeURIComponent(name)}&limit=20&type=player`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const contents: Array<{ uid?: string }> = data.results?.[0]?.contents ?? [];
  const player = contents.find((c) => c.uid?.includes('s:1100~'));
  const uid: string = player?.uid ?? '';
  return uid.split('~a:')?.[1] ?? null;
}

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const years = (searchParams.get('years') ?? '')
    .split(',')
    .map((y) => parseInt(y.trim(), 10))
    .filter((y) => y >= 1990 && y <= 2100);
  if (!name || years.length === 0) {
    return Response.json({ error: 'pass ?name=Player%20Name&years=2017,2018' });
  }

  const espnId = await getEspnId(name);
  if (!espnId) return Response.json({ name, espnId: null, error: 'no espn id found' });

  const perYear = await Promise.all(
    years.map(async (year) => {
      try {
        const logRes = await fetch(
          `${ESPN_CORE}/pga/seasons/${year}/athletes/${espnId}/eventlog?limit=300`,
          { cache: 'no-store' },
        );
        if (!logRes.ok) return { year, fetchStatus: logRes.status, events: null };
        const logData = await logRes.json();
        const items: Array<{ event: Record<string, string>; played: boolean }> =
          logData.events?.items ?? [];
        const events = await Promise.all(
          items.map(async (i) => {
            const ref = Object.values(i.event)[0] ?? '';
            const eventId = ref.match(/events\/(\d+)/)?.[1] ?? '';
            const league = ref.match(/leagues\/(\w+)\/events/)?.[1] ?? 'pga';
            let eventName = '(fetch failed)';
            try {
              const eRes = await fetch(`${ESPN_CORE}/${league}/events/${eventId}`, { cache: 'no-store' });
              if (eRes.ok) eventName = ((await eRes.json()).name as string) ?? '(no name)';
              else eventName = `(HTTP ${eRes.status})`;
            } catch {
              /* keep placeholder */
            }
            return { eventId, league, played: i.played, name: eventName };
          }),
        );
        return {
          year,
          fetchStatus: 200,
          totalCount: logData.events?.count ?? items.length,
          pageCount: logData.events?.pageCount ?? 1,
          returnedItems: items.length,
          events,
        };
      } catch (err) {
        return { year, fetchStatus: 'threw', error: String(err), events: null };
      }
    }),
  );

  return Response.json({ name, espnId, perYear });
}
