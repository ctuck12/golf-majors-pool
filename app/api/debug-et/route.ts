import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': PGA_API_KEY,
  'Referer': 'https://www.pgatour.com/',
  'Origin': 'https://www.pgatour.com',
};

async function probe(url: string, opts?: RequestInit): Promise<{ url: string; status: number; preview: string }> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(6000) });
    const text = await res.text().catch(() => '');
    return { url, status: res.status, preview: text.slice(0, 500) };
  } catch (e) {
    return { url, status: 0, preview: String(e) };
  }
}

async function gqlQuery(query: string): Promise<{ url: string; status: number; preview: string }> {
  return probe(PGA_GQL, {
    method: 'POST',
    headers: GQL_HEADERS,
    body: JSON.stringify({ query }),
  });
}

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  const results = await Promise.all([
    // Try Sky Sports / TNT Sports with realistic headers
    probe('https://www.skysports.com/golf/european-tour/race-to-dubai', {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Accept': 'application/json' },
    }),
    // Try PGA Tour DP World Tour eligibility GQL query
    gqlQuery(`{ tourCup(id: "R-2700-2026") { id name rankings { ... on CupRankingPlayer { position id name total } } } }`),
    // Try broader GQL - maybe a different tour cup ID covers full RTD
    gqlQuery(`{ tourCup(id: "R-1500-2026") { id name rankings { ... on CupRankingPlayer { position id name total } } } }`),
    // Try stat leaderboard for RTD stat IDs
    gqlQuery(`{ statLeaderboard(statId: "02366", year: 2026) { rows { rank player { id displayName } } } }`),
    gqlQuery(`{ statLeaderboard(statId: "11", year: 2026) { rows { rank player { id displayName } } } }`),
    // Try playerProfile for Rory to see if RTD rank is exposed
    gqlQuery(`{ playerProfile(playerId: "28237") { dpWorldTourRanking rtdRank raceToDubaiRank currentSeasonStats { statName statValue } } }`),
    // Try World Golf Rankings page
    probe('https://www.owgr.com/ranking?pageNo=1&pageSize=100&country=ALL&tour=EDPW&year=2026', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/html' },
    }),
    // BBC Sport
    probe('https://www.bbc.co.uk/sport/golf/european-tour/race-to-dubai', {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/html' },
    }),
  ]);

  return Response.json(results);
}
