import redis from './redis';
import { flagCodeForCountry } from './country-codes';

// Player countries learned from the live feeds, so a golfer missing from the hand-kept flag list
// (app/pool-data.tsx) still gets a flag and country code. Two sources: the PGA Tour player
// directory (PGA TOUR, Korn Ferry and Champions) and ESPN's current golf scoreboard. What's learned
// is kept in Redis for good (a player's country doesn't change) and refreshed twice a day for new
// names.

const LEARNED_KEY = 'player-flags:v1';
const REFRESHED_KEY = 'player-flags:v1:refreshed';
const REFRESH_EVERY_S = 12 * 60 * 60;
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

// Same normalizer as normFlagName in app/pool-data.tsx, so the keys match the client lookup.
export const normPlayerName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().trim();

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<unknown>;
}

type DirectoryPlayer = { displayName?: string; firstName?: string; lastName?: string; country?: string; countryFlag?: string };

async function fromPgaDirectory(tourCode: string): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  // countryFlag is the 3-letter code; fall back to the country name if that field isn't offered.
  for (const fields of ['displayName firstName lastName country countryFlag', 'displayName firstName lastName country']) {
    try {
      const data = (await fetchJson(PGA_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY },
        body: JSON.stringify({ query: `query { playerDirectory(tourCode: ${tourCode}) { players { ${fields} } } }` }),
      })) as { data?: { playerDirectory?: { players?: DirectoryPlayer[] } } };
      const players = data?.data?.playerDirectory?.players;
      if (!Array.isArray(players)) continue;
      for (const p of players) {
        const name = p.displayName || [p.firstName, p.lastName].filter(Boolean).join(' ');
        const code = flagCodeForCountry(p.countryFlag) || flagCodeForCountry(p.country);
        if (name && code) found[normPlayerName(name)] = code;
      }
      return found;
    } catch {
      // try the smaller field set, then give up on this source
    }
  }
  return found;
}

type EspnCompetitor = { athlete?: { displayName?: string; fullName?: string; flag?: { alt?: string } } };

async function fromEspnScoreboard(): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  try {
    const data = (await fetchJson('https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard')) as {
      events?: { competitions?: { competitors?: EspnCompetitor[] }[] }[];
    };
    for (const ev of data.events ?? []) for (const comp of ev.competitions ?? []) for (const c of comp.competitors ?? []) {
      const name = c.athlete?.displayName ?? c.athlete?.fullName;
      const code = flagCodeForCountry(c.athlete?.flag?.alt);
      if (name && code) found[normPlayerName(name)] = code;
    }
  } catch {
    // ESPN unavailable: keep what we have
  }
  return found;
}

// Pulls the sources (at most every 12 hours) and saves any countries learned.
export async function refreshPlayerFlagsIfStale() {
  const claimed = await redis.set(REFRESHED_KEY, '1', 'EX', REFRESH_EVERY_S, 'NX').catch(() => null);
  if (!claimed) return;
  const results = await Promise.all([fromPgaDirectory('R'), fromPgaDirectory('H'), fromPgaDirectory('S'), fromEspnScoreboard()]);
  // Later sources only fill gaps; the PGA TOUR directory is the first word.
  const merged: Record<string, string> = {};
  for (const r of results) for (const [k, v] of Object.entries(r)) if (!(k in merged)) merged[k] = v;
  if (Object.keys(merged).length === 0) {
    // Nothing reached: let the next request try again instead of waiting 12 hours.
    await redis.del(REFRESHED_KEY).catch(() => {});
    return;
  }
  await redis.hset(LEARNED_KEY, merged).catch(() => {});
}

// Normalized player name -> flag code, for every player a feed has told us about.
export async function learnedPlayerFlags(): Promise<Record<string, string>> {
  return (await redis.hgetall(LEARNED_KEY).catch(() => null)) ?? {};
}
