import { getActiveSeason } from './tournament-config';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const LEAGUES = ['pga', 'liv', 'eur'] as const;
type League = (typeof LEAGUES)[number];

export const ESPN_ID_OVERRIDES: Record<string, string> = {
  'Justin Thomas': '4848',
  'John Keefer': '5217048',
  'Tom Kim': '4602673',
  'Ben James': '5077389',
  'Mikael Lindberg': '4699290',
  'Daniel Brown': '10221',
  'Dan Brown': '10221',
  'Angel Ayora': '5105333',
  'Eugenio Chacarra': '4565467',
  'Eugenio Lopez-Chacarra': '4565467',
  'Jordan Smith': '9506',
  'Joe Dean': '6970',
  'Jack Buchanan': '5119687',
  'Lev Grinberg': '5062278',
  'David Howard': '5369476',
  'Jose Luis Ballester Barrio': '5152205',
  'Martin Couvra': '5102625',
  'Francesco Laporta': '5716',
  'Antoine Rozner': '4407372',
  'Dan Bradbury': '5081630',
  'MJ Daffue': '7110',
  'Alistair Docherty': '4425907',
  'Michael Hollick': '7067',
  'Kazuma Kobori': '5186648',
  'Frederic Lacroix': '4592246',
  'Joakim Lagergren': '5727',
  'Shaun Norris': '5057',
  'Henrik Stenson': '576',
  'Sam Bairstow': '4872728',
  'Jeongwoo Ham': '4592199',
  'Naoyuki Kataoka': '4837226',
  'Ryutaro Nagano': '4699375',
  'Matthew Southgate': '5852',
  'Austen Truslow': '9379',
  'Jiho Yang': '5143177',
  'Ren Yonezawa': '4699328',
  'Matthew Baldwin': '5832',
  'Tiger Christensen': '5146173',
  'Kota Kaneko': '5312609',
  'Darren Clarke': '82',
  'David Duval': '115',
  'Cameron John': '4368981',
  'Jack McDonald': '6849',
  'Marcus Plunkett': '5075661',
  'Tom Sloman': '11270',
  'Thomas Sloman': '11270',
  'Ian Holt': '4408324',
  'Derek Berg': '5350614',
  'Chris Gabriele': '5350613',
  'Zach Haynes': '5350616',
  'Paul McClure': '5350615',
  'Arni Sveinsson': '5362524',
  'Jackson Ormond': '5360549',
  'Ethan Fang': '5293232',
  'Mateo Pulcini': '5344763',
  'Jack Schoenberger': '5362526',
  'Jackson Koivun': '5215013',
  'Ryder Cowan': '5362517',
  'Miles Russell': '5209798',
  'Jackson Herrington': '5344766',
  'Thorbjørn Olesen': '5140',
  'Thorbjorn Olesen': '5140',
  'David Ford': '5150294',
  'S.H. Kim': '4698579',
  'Cam Davis': '10863',
  'Patton Kizzire': '3980',
  'Francisco Bidé': '3089127',
  'Francisco Bide': '3089127',
  'Bryce Fisher': '2233',
  'Garrett Sapp': '5921',
  // Discovered + verified via /api/admin/espn-id-discovery — players ESPN's name search
  // wouldn't resolve. Each ID was confirmed to return a golf athlete with bio data.
  'Ugo Coussaud': '4418567',
  'Chandler Phillips': '4587989',
  'Matthew Jordan': '4390719',
  'Nathan Kimsey': '10914',
  'Dylan Wu': '4423323',
  'Carl Yuan': '9951',
  'Taihei Sato': '4691550',
  'Ben Silverman': '8910',
  'Greyson Leach': '5327840',
  'Brandon Wu': '4355673',
  'Ryuichi Oiwa': '4699297',
  'Marcelo Rozo': '7120',
  'Kaito Onishi': '4894340',
  'Filippo Celli': '4884239',
  'Jake Peacock': '5326067',
  'Karl Vilips': '5147097',
  'Matthieu Pavon': '10596',
  'Taylor Moore': '10664',
  'Christo Lamprecht': '11395',
  'Manav Shah': '10994', // correct athlete, but ESPN currently has no bio fields for him
  'Robbie Higgins': '5277550',
  'Takumi Kanaya': '4410612',
  'John VanDerLaan': '4361934',
  'Kensei Hirata': '5075548',
  'Danny Walker': '4408319',
  'Zecheng Dou': '8889',
  'Jeffrey Kang': '4408318',
  'Brice Garnett': '2283',
};

// Maps pool names to the name ESPN uses for that player
const ESPN_NAME_ALIASES: Record<string, string> = {};

// Accent/diacritic-insensitive normalizer for matching ESPN displayNames to pool names.
const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();

type EspnSearchHit = { uid?: string; displayName?: string };

// One raw ESPN search query — returns ALL player contents across every result group
// (the previous code only looked at results[0], which often isn't the player group).
async function rawEspnSearch(query: string): Promise<EspnSearchHit[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=${encodeURIComponent(query)}&limit=20&type=player`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const groups: Array<{ contents?: EspnSearchHit[] }> = Array.isArray(data.results) ? data.results : [];
    return groups.flatMap((g) => g.contents ?? []);
  } catch {
    return [];
  }
}

// Pick a golf athlete id from search hits, preferring an exact (accent-insensitive)
// name match, then falling back to the first golf hit for a name-specific query.
function pickGolfId(hits: EspnSearchHit[], wantName: string): string | null {
  // Accept any golf sport code (s:1100=PGA, s:1109=DP World, etc.)
  const golf = hits.filter((c) => c.uid?.includes('s:110') && c.uid?.includes('~a:'));
  if (golf.length === 0) return null;
  const want = normName(wantName);
  const exact = golf.find((c) => normName(c.displayName ?? '') === want);
  const chosen = exact ?? golf[0];
  return chosen.uid?.split('~a:')?.[1] ?? null;
}

async function searchEspnByName(searchName: string): Promise<string | null> {
  // 1) Full name as given.
  let id = pickGolfId(await rawEspnSearch(searchName), searchName);
  if (id) return id;
  // 2) First + last only — drops middle names ESPN omits (e.g. "Jayden Trey Schaper" → "Jayden Schaper").
  const parts = searchName.split(/\s+/);
  if (parts.length > 2) {
    const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
    id = pickGolfId(await rawEspnSearch(firstLast), firstLast);
    if (id) return id;
    // 3) First + second token — for compound surnames ESPN keeps under the middle word
    // (e.g. "Angel Hidalgo Portillo" → "Angel Hidalgo", "Niklas Norgaard Moller" → "Niklas Norgaard").
    const firstSecond = `${parts[0]} ${parts[1]}`;
    id = pickGolfId(await rawEspnSearch(firstSecond), firstSecond);
    if (id) return id;
  }
  return null;
}

export async function getEspnId(name: string): Promise<string | null> {
  if (ESPN_ID_OVERRIDES[name]) return ESPN_ID_OVERRIDES[name];
  // Try alias name first, then original name as fallback
  const alias = ESPN_NAME_ALIASES[name];
  if (alias) {
    const id = await searchEspnByName(alias);
    if (id) return id;
  }
  return searchEspnByName(name);
}

async function getEventIdsForLeague(
  espnId: string,
  league: League,
  season: number,
): Promise<Array<{ eventId: string; league: League }>> {
  const res = await fetch(
    `${ESPN_CORE}/${league}/seasons/${season}/athletes/${espnId}/eventlog`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items: Array<{ event: Record<string, string>; played: boolean }> =
    data.events?.items ?? [];
  return items
    .filter((item) => item.played)
    .map((item) => {
      const ref = Object.values(item.event)[0] ?? '';
      const eventId = ref.match(/events\/(\d+)/)?.[1] ?? '';
      const refLeague = (ref.match(/leagues\/(\w+)\/events/)?.[1] ?? league) as League;
      return { eventId, league: refLeague };
    })
    .filter((e) => e.eventId);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getPosition(status: {
  position?: { displayName?: string };
  type?: { name?: string } | string;
} | null): string {
  if (!status) return '--';
  const t =
    typeof status.type === 'string'
      ? status.type
      : (status.type as { name?: string })?.name ?? '';
  if (t === 'STATUS_CUT' || t === 'STATUS_MC') return 'CUT';
  if (t === 'STATUS_WD') return 'WD';
  if (t === 'STATUS_DQ') return 'DQ';
  if (t === 'STATUS_MDF') return 'MDF';
  return status.position?.displayName ?? '--';
}

export type SeasonResult = {
  tournament: string;
  date: string;
  course: string;
  position: string;
  tour: 'pga' | 'liv' | 'eur';
};

// `season` defaults to the active golf season (it rolls over Nov 1).
export async function fetchPlayerSeasonResults(name: string, season = getActiveSeason()): Promise<SeasonResult[]> {
  const espnId = await getEspnId(name);
  if (!espnId) return [];

  const allEvents = (
    await Promise.all(LEAGUES.map((league) => getEventIdsForLeague(espnId, league, season)))
  ).flat();

  const seen = new Set<string>();
  const uniqueEvents = allEvents.filter(({ eventId }) => {
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    return true;
  });

  if (uniqueEvents.length === 0) return [];

  const opts = { next: { revalidate: 3600 } };

  const eventResults = await Promise.all(
    uniqueEvents.map(async ({ eventId, league }) => {
      const base = `${ESPN_CORE}/${league}`;
      const competitorBase = `${base}/events/${eventId}/competitions/${eventId}/competitors/${espnId}`;

      const [eventRes, statusRes] = await Promise.all([
        fetch(`${base}/events/${eventId}`, opts),
        fetch(`${competitorBase}/status`, opts),
      ]);

      if (!eventRes.ok) return null;

      const [eventData, statusData] = await Promise.all([
        eventRes.json(),
        statusRes.ok ? statusRes.json() : Promise.resolve(null),
      ]);

      const position = getPosition(statusData);
      const courses = eventData.courses as Array<{ name?: string }> | undefined;
      return {
        tournament: (eventData.name as string) ?? '',
        date: (eventData.date as string) ?? '',
        course: courses?.[0]?.name ?? '',
        position,
        tour: league,
      };
    }),
  );

  return eventResults
    .filter((r) => r && r.position !== '--')
    .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime())
    .map((r) => ({
      tournament: r!.tournament,
      date: fmtDate(r!.date),
      course: r!.course,
      position: r!.position,
      tour: r!.tour,
    }));
}
