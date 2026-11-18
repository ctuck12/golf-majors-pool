// Data, types and helpers for the main page (app/page.tsx): player and tournament tables,
// the schedule and display helpers, formatting, and saved-session storage. No visible change
// from when they lived in page.tsx.

import type { PayoutPlan } from './lib/payout-plan';
import type { PayoutInfo } from './lib/pool-store-shared';
import { isNativeApp } from './native-bridge';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { type LeagueSummary } from './league-panel';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { PLAYER_ESPN_IDS } from '@/app/lib/player-espn-ids';
import { effectiveLockTime, getTournamentMeta, picksSeason, POOL_SEASONS as SCHEDULED_SEASONS, type TournamentMeta } from '@/app/lib/tournament-config';
import { applyNameAlias } from '@/app/lib/name-aliases';
import { History, Lock } from 'lucide-react';
import { type GolferScoreBreakdown } from './lib/scoring';

export const SALARY_CAP = 50000;
export const REQUIRED_GOLFERS = 6;

// Total tournament par (course par × 4 rounds). Players and Masters never change.
// Update pga/us-open/open each season as courses rotate.
// Total par (course par × 4 rounds) of a tournament's event in a season — its picks season by default.
export function totalParFor(tournamentId: string, season = picksSeason(tournamentId)): number | undefined {
  const par = getTournamentMeta(tournamentId, season)?.par;
  return par ? par * 4 : undefined;
}

// ESPN event id of a tournament's event in a season (unknown for a new season until ESPN lists it).
export function espnEventIdFor(tournamentId: string, season: number): string | undefined {
  return getTournamentMeta(tournamentId, season)?.espnEventId;
}

export const STORAGE_PREFIX = 'golf-pool-live';
export const DEFAULT_JOIN_CODE = 'MAJORS2026';
// The founder pool's history counts the founder's own entry by name (The Players, below).
// Who may use the app-wide admin tools is the server's call (isAppAdmin), sent with the session.
export const COMMISSIONER_DISPLAY_NAME = 'Clayton Tucker';
// Set to true to re-enable the self-serve registration option on the login screen
export const REGISTRATION_OPEN = true;
// The original pool: free for life, and home to a few pool-specific touches (contact card, The
// Players history) that other leagues don't get.
export const FOUNDER_POOL_ID = 'golf-majors-pool';

// Tournament names in schedule order. Dates, first tee times and courses for each season are in
// app/lib/tournament-config.ts; firstTeeUtc here is only the fallback time of day for a year that
// isn't scheduled yet.
export const TOURNAMENTS = [
  {
    id: 'players',
    name: 'The Players',
    fullName: 'The Players Championship',
    venue: 'TPC Sawgrass',
    firstTeeUtc: '2026-03-12T11:40:00Z',
  },
  {
    id: 'masters',
    name: 'The Masters',
    fullName: 'The Masters Tournament',
    venue: 'Augusta National',
    firstTeeUtc: '2026-04-09T11:30:00Z',
  },
  {
    id: 'pga',
    name: 'The PGA',
    fullName: 'The PGA Championship',
    venue: 'PGA Frisco',
    firstTeeUtc: '2026-05-14T11:20:00Z',
  },
  {
    id: 'us-open',
    name: 'U.S. Open',
    fullName: 'U.S. Open Championship',
    venue: 'Pebble Beach',
    firstTeeUtc: '2026-06-18T11:15:00Z',
  },
  {
    id: 'open',
    name: 'The Open',
    fullName: 'The Open Championship',
    venue: 'St Andrews',
    firstTeeUtc: '2026-07-16T05:35:00Z',
  },
] as const;

export const TOURNAMENT_LEADERBOARD_HEADER: Record<string, string> = {
  players: 'The Players Leaderboard',
  masters: 'The Masters Leaderboard',
  pga: 'The PGA Leaderboard',
  'us-open': 'U.S. Open Leaderboard',
  open: 'The Open Leaderboard',
};

export const TOURNAMENT_CAREER_RESULTS_HEADER: Record<string, string> = {
  players: 'The Players Championship Career Results',
  masters: 'The Masters Career Results',
  pga: 'PGA Championship Career Results',
  'us-open': 'U.S. Open Career Results',
  open: 'The Open Championship Career Results',
};

export const PLAYER_FLAGS: Record<string, string> = {
  // USA
  'Scottie Scheffler': 'us', 'Xander Schauffele': 'us', 'Collin Morikawa': 'us',
  'Justin Thomas': 'us', 'Jordan Spieth': 'us', 'Bryson DeChambeau': 'us',
  'Tony Finau': 'us', 'Patrick Cantlay': 'us', 'Wyndham Clark': 'us',
  'Max Homa': 'us', 'Sam Burns': 'us', 'Brian Harman': 'us',
  'Kevin Kisner': 'us', 'Rickie Fowler': 'us', 'Keegan Bradley': 'us',
  'Matt Kuchar': 'us', 'Harris English': 'us', 'Denny McCarthy': 'us',
  'Russell Henley': 'us', 'Talor Gooch': 'us', 'Eric Cole': 'us',
  'Cameron Young': 'us', 'Alex Smalley': 'us', 'Matt McCarty': 'us',
  'Davis Riley': 'us', 'Taylor Moore': 'us', 'J.T. Poston': 'us',
  'Sahith Theegala': 'us', 'Billy Horschel': 'us', 'Tom Hoge': 'us',
  'Keith Mitchell': 'us', 'Ben Griffin': 'us', 'Austin Eckroat': 'us',
  'Daniel Berger': 'us', 'Brendan Steele': 'us', 'Beau Hossler': 'us',
  'Chris Kirk': 'us', 'Luke List': 'us', 'Adam Schenk': 'us',
  'Kurt Kitayama': 'us', 'Mark Hubbard': 'us', 'Patton Kizzire': 'us',
  'Harold Varner III': 'us', 'Brendon Todd': 'us', 'Bill Haas': 'us',
  'Ryan Palmer': 'us', 'Webb Simpson': 'us', 'Zac Blair': 'us',
  'Chesson Hadley': 'us', 'Ryan Brehm': 'us', 'Justin Lower': 'us',
  'David Skinns': 'us', 'Patrick Rodgers': 'us', 'Shane Bertsch': 'us',
  'Andrew Novak': 'us', 'Ben Taylor': 'us', 'Trace Crowe': 'us',
  'Jackson Suber': 'us', 'Michael Kim': 'us', 'Scott Stallings': 'us',
  'Will Zalatoris': 'us', 'Maverick McNealy': 'us', 'Aaron Wise': 'us',
  'Doc Redman': 'us', 'Tyler Duncan': 'us', 'J.J. Spaun': 'us',
  'Patrick Reed': 'us', 'Brooks Koepka': 'us', 'Dustin Johnson': 'us',
  'Phil Mickelson': 'us', 'Tiger Woods': 'us',
  'Akshay Bhatia': 'us', 'Chris Gotterup': 'us', 'Gary Woodland': 'us',
  'Jacob Bridgeman': 'us', 'Max Greyserman': 'us', 'Sam Stevens': 'us',
  'Bubba Watson': 'us', 'Zach Johnson': 'us', 'Jake Knapp': 'us',
  'Brian Campbell': 'us', 'Michael Block': 'us', 'Ben Kern': 'us',
  'Ryan Gerard': 'us', 'Michael Thorbjornsen': 'us', 'Fred Couples': 'us',
  'David Lipsky': 'us', 'Pierceson Coody': 'us', 'Lucas Glover': 'us',
  'Brandt Snedeker': 'us', 'Shaun Micheel': 'us', 'Michael Brennan': 'us',
  'Bud Cauley': 'us', 'William Mouw': 'us', 'Jordan Gumberg': 'us', 'Steven Fisk': 'us', 'Johnny Keefer': 'us', 'Austin Smotherman': 'us', 'John Keefer': 'us', 'Max McGreevy': 'us', 'Chandler Blanchet': 'us', 'Jesse Droemer': 'us', 'Tyler Collet': 'us', 'Mark Geddes': 'gb-eng', 'Austin Hurt': 'us', 'Jared Jones': 'us', 'Michael Kartrude': 'us', 'Ryan Lenahan': 'us', 'Ben Polland': 'us', 'Braden Shattuck': 'us', 'Ryan Vermeer': 'us', 'Timothy Wiseman': 'us', 'Jimmy Walker': 'us', 'Jason Dufner': 'us', 'Stewart Cink': 'us', 'Andrew Putnam': 'us', 'Joe Highsmith': 'us',
  'Davis Thompson': 'us', 'Taylor Montgomery': 'us', 'Nick Hardy': 'us', 'Harry Higgs': 'us', 'J.B. Holmes': 'us', 'Brandon Wu': 'us', 'Peter Uihlein': 'us', 'Neal Shipley': 'us', 'Cole Hammer': 'us', 'James Nicholas': 'us', 'Ben Kohles': 'us', 'Dylan Wu': 'us', 'Chandler Phillips': 'us', 'Jake Peacock': 'us', 'Ben James': 'us', 'Robbie Higgins': 'us',
  'Caleb Surratt': 'us', 'Kevin Roy': 'us', 'Jimmy Stanger': 'us', 'Cooper Dossey': 'us', 'Greyson Leach': 'us', 'Jake Sollon': 'us', 'Jackson Van Paris': 'us', 'Spencer Tibbits': 'us',
  'Patrick Fishburn': 'us', 'Danny Walker': 'us', 'Mac Meissner': 'us', 'John VanDerLaan': 'us',
  'Doug Ghim': 'us', 'Chad Ramey': 'us', 'Zach Bauchou': 'us', 'Luke Clanton': 'us',
  'Vince Whaley': 'us', 'Sam Ryder': 'us', 'Lee Hodges': 'us', 'Jeffrey Kang': 'us',
  'Hank Lebioda': 'us', 'Peter Malnati': 'us', 'Joel Dahmen': 'us', 'Brice Garnett': 'us',
  'Davis Chatfield': 'us',
  'Sepp Straka': 'at', 'Bernd Wiesberger': 'at',
  // England
  'Tommy Fleetwood': 'gb-eng', 'Justin Rose': 'gb-eng', 'Matt Fitzpatrick': 'gb-eng',
  'Tyrrell Hatton': 'gb-eng', 'Lee Westwood': 'gb-eng', 'Ian Poulter': 'gb-eng',
  'Paul Casey': 'gb-eng', 'Danny Willett': 'gb-eng', 'Aaron Rai': 'gb-eng',
  'Matt Wallace': 'gb-eng', 'Eddie Pepperell': 'gb-eng', 'Nick Faldo': 'gb-eng',
  'Luke Donald': 'gb-eng', 'Laurie Canter': 'gb-eng', 'Marco Penge': 'gb-eng',
  'Callum Shinkwin': 'gb-eng', 'Tom Lewis': 'gb-eng', 'Sam Horsfield': 'gb-eng',
  'Jordan Smith': 'gb-eng', 'Andrew Johnston': 'gb-eng',
  'Alex Fitzpatrick': 'gb-eng', 'Harry Hall': 'gb-eng', 'Daniel Brown': 'gb-eng', 'Dan Brown': 'gb-eng', 'Andy Sullivan': 'gb-eng', 'John Parry': 'gb-eng', 'Matthew Jordan': 'gb-eng', 'Nathan Kimsey': 'gb-eng',
  // Scotland
  'Robert MacIntyre': 'gb-sct', 'Martin Laird': 'gb-sct', 'Russell Knox': 'gb-sct',
  'Ewen Ferguson': 'gb-sct', 'Grant Forrest': 'gb-sct', 'Richie Ramsay': 'gb-sct',
  'David Law': 'gb-sct', 'Connor Syme': 'gb-sct',
  // Northern Ireland
  'Rory McIlroy': 'gb-nir', 'Graeme McDowell': 'gb-nir', 'Darren Clarke': 'gb-nir', 'Tom McKibbin': 'gb-nir',
  // Wales
  'Rhys Enoch': 'gb-wls',
  // Ireland
  'Shane Lowry': 'ie', 'Seamus Power': 'ie', 'Padraig Harrington': 'ie',
  'Niall Kearney': 'ie', 'John Murphy': 'ie',
  // Sweden
  'Ludvig Aberg': 'se', 'Ludvig Åberg': 'se', 'Alex Noren': 'se', 'Henrik Stenson': 'se',
  'Joakim Lagergren': 'se', 'Jesper Svensson': 'se', 'Pontus Nyholm': 'se',
  // Norway
  'Viktor Hovland': 'no', 'Kristoffer Ventura': 'no', 'Kristoffer Reitan': 'no',
  // Denmark
  'Thorbjorn Olesen': 'dk', 'Rasmus Hojgaard': 'dk', 'Rasmus Højgaard': 'dk', 'Nicolai Hojgaard': 'dk', 'Nicolai Højgaard': 'dk',
  'Jeff Winther': 'dk', 'Niklas Norgaard': 'dk', 'Rasmus Neergaard-Petersen': 'dk', 'Niklas Norgaard Moller': 'dk',
  // Spain
  'Jon Rahm': 'es', 'Sergio Garcia': 'es', 'Adrian Otaegui': 'es',
  'Alejandro del Rey': 'es', 'Ivan Cantero': 'es', 'David Puig': 'es', 'Eugenio Chacarra': 'es',
  // 2026 Open field additions
  'Nick Dunlap': 'us', 'Lanto Griffin': 'us', 'Rafael Campos': 'pr',
  'Jack Buchanan': 'au', 'Stuart Grehan': 'ie', 'Lev Grinberg': 'ua', 'David Howard': 'ie', 'Nevill Ruiter': 'nl', 'Joe Dean': 'gb-eng',
  'Jose Luis Ballester Barrio': 'es', 'Martin Couvra': 'fr', 'Francesco Laporta': 'it', 'Dan Bradbury': 'gb-eng', 'Alistair Docherty': 'us', 'Michael Hollick': 'za', 'Kazuma Kobori': 'nz', 'Frederic Lacroix': 'fr', 'Shaun Norris': 'za', 'Sam Bairstow': 'gb-eng', 'Jeongwoo Ham': 'kr', 'Ryutaro Nagano': 'jp', 'Matthew Southgate': 'gb-eng', 'Austen Truslow': 'us', 'Jiho Yang': 'kr', 'Ren Yonezawa': 'jp', 'Matthew Baldwin': 'gb-eng', 'Tiger Christensen': 'de', 'David Duval': 'us', 'Cameron John': 'au', 'Jack McDonald': 'gb-sct', 'Marcus Plunkett': 'us', 'Baard Bjoernevik Skogen': 'no', 'Thomas Sloman': 'gb-eng', 'Jose Maria Olazabal': 'es', 'Angel Hidalgo Portillo': 'es', 'Rocco Paolo Repetto Taylor': 'es',
  // South Africa
  'Louis Oosthuizen': 'za', 'Charl Schwartzel': 'za', 'Branden Grace': 'za',
  'Erik van Rooyen': 'za', 'Garrick Higgo': 'za', 'Dean Burmester': 'za',
  'MJ Daffue': 'za', 'Thriston Lawrence': 'za', 'Justin Harding': 'za',
  'Dylan Frittelli': 'za', 'Christiaan Bezuidenhout': 'za', 'Aldrich Potgieter': 'za', 'Casey Jarvis': 'za', 'Hennie Du Plessis': 'za', 'Jayden Trey Schaper': 'za',
  'Christo Lamprecht': 'za',
  // Australia
  'Min Woo Lee': 'au', 'Jason Day': 'au', 'Adam Scott': 'au',
  'Cameron Smith': 'au', 'Marc Leishman': 'au', 'Lucas Herbert': 'au',
  'Cameron Davis': 'au', 'Matt Jones': 'au', 'Aaron Pike': 'au',
  'David Bransdon': 'au', 'Brett Drewitt': 'au', 'Elvis Smylie': 'au', 'Travis Smyth': 'au',
  'Karl Vilips': 'au',
  // New Zealand
  'Ryan Fox': 'nz', 'Danny Lee': 'nz', 'Daniel Hillier': 'nz',
  // Canada
  'Adam Hadwin': 'ca', 'Corey Conners': 'ca', 'Mackenzie Hughes': 'ca',
  'Taylor Pendrith': 'ca', 'Roger Sloan': 'ca', 'Ben Silverman': 'ca',
  'Mike Weir': 'ca', 'David Hearn': 'ca', 'Nick Taylor': 'ca', 'Adam Svensson': 'ca',
  // Japan
  'Hideki Matsuyama': 'jp', 'Keita Nakajima': 'jp', 'Ryo Hisatsune': 'jp',
  'Rikuya Hoshino': 'jp', 'Satoshi Kodaira': 'jp', 'Takumi Kanaya': 'jp',
  'Yuto Katsuragawa': 'jp', 'Kazuki Higa': 'jp', 'Kota Kaneko': 'jp', 'Taihei Sato': 'jp', 'Ryuichi Oiwa': 'jp', 'Kaito Onishi': 'jp', 'Kensei Hirata': 'jp',
  // South Korea
  'Tom Kim': 'kr', 'Sungjae Im': 'kr', 'Si Woo Kim': 'kr', 'Y.E. Yang': 'kr',
  'K.H. Lee': 'kr', 'Byeong Hun An': 'kr', 'S.H. Kim': 'kr',
  'Sung Kang': 'kr', 'Chan Kim': 'kr', 'Joohyung Kim': 'kr', 'T.K. Kim': 'kr',
  // Philippines
  'Rico Hoey': 'ph',
  // Taiwan
  'C.T. Pan': 'tw', 'Wei-Chih Lu': 'tw', 'Kevin Yu': 'tw',
  // China
  'Haotong Li': 'cn', 'Li Haotong': 'cn', 'Carl Yuan': 'cn', 'Zecheng Dou': 'cn',
  // Argentina
  'Emiliano Grillo': 'ar', 'Fabian Gomez': 'ar', 'Angel Cabrera': 'ar', 'Alejandro Tosti': 'ar',
  // Chile
  'Mito Pereira': 'cl', 'Joaquin Niemann': 'cl',
  // Colombia
  'Camilo Villegas': 'co', 'Sebastian Munoz': 'co', 'Nicolas Echavarria': 'co', 'Nico Echavarria': 'co', 'Marcelo Rozo': 'co',
  // Mexico
  'Carlos Ortiz': 'mx',
  // USA
  'Ricky Castillo': 'us',
  // Venezuela
  'Jhonattan Vegas': 've',
  // Germany
  'Stephan Jaeger': 'de', 'Alex Cejka': 'de', 'Marcel Siem': 'de', 'Matti Schmid': 'de', 'Martin Kaymer': 'de',
  // France
  'Victor Perez': 'fr', 'Matthieu Pavon': 'fr', 'Romain Langasque': 'fr',
  'Antoine Rozner': 'fr', 'Benjamin Hebert': 'fr', 'Adrien Saddier': 'fr', 'Ugo Coussaud': 'fr',
  // Finland
  'Sami Valimaki': 'fi',
  // Belgium
  'Thomas Pieters': 'be', 'Nicolas Colsaerts': 'be', 'Thomas Detry': 'be', 'Adrien Dumont De Chassart': 'be', 'Adrien Dumont de Chassart': 'be',
  // Italy
  'Francesco Molinari': 'it', 'Guido Migliozzi': 'it', 'Filippo Celli': 'it',
  // Fiji
  'Vijay Singh': 'fj',
  // Thailand
  'Kiradech Aphibarnrat': 'th', 'Jazz Janewattananond': 'th',
  // Zimbabwe
  'Nick Price': 'zw',
  // India
  'Sudarshan Yellamaraju': 'in', 'Manav Shah': 'in',
  // Jamaica
  'A.J. Ewart': 'jm',
  // Players the leaderboard showed without a flag — assigned by confirmed nationality. The Niemann
  // and Välimäki entries are accented-name variants the exact-match lookup missed (unaccented keys
  // already exist above).
  'Joaquín Niemann': 'cl',
  'Sami Välimäki': 'fi',
  'Mikael Lindberg': 'se',
  'Angel Ayora': 'es', 'Ángel Ayora': 'es',
  'Paul McClure': 'us',
  'Ian Holt': 'us',
  'Chris Gabriele': 'us',
  'Jayden Schaper': 'za',
  'Francisco Bidé': 'ar', 'Francisco Bide': 'ar',
  'Zach Haynes': 'us',
  'Garrett Sapp': 'us',
  'Derek Berg': 'us',
  'Bryce Fisher': 'us',
  'Matthew Robles': 'us',
  'Jackson Ormond': 'us',
  'Vaughn Harber': 'us',
  'Chase Kyes': 'us',
  'Arni Sveinsson': 'is',
  'Jack Schoenberger': 'us',
  'Logan Reilly': 'us',
  'Jackson Koivun': 'us',
  'Ryder Cowan': 'us',
  'Miles Russell': 'us',
  'Eric Lee': 'us',
  // Masters field: amateurs + accented-name variants of past champions (unaccented keys already exist).
  'Jackson Herrington': 'us',
  'Mason Howell': 'us',
  'Ethan Fang': 'us',
  'Brandon Holtz': 'us',
  'Fifa Laopakdee': 'th',
  'Mateo Pulcini': 'ar',
  'Naoyuki Kataoka': 'jp',
  'Sergio García': 'es',
  'Ángel Cabrera': 'ar',
  'José María Olazábal': 'es',
  // Leaderboard display-name variants the exact-match lookup missed (unaccented / full-name keys
  // already exist above), plus David Ford (English amateur) who had no entry.
  'Séamus Power': 'ie',
  'Thorbjørn Olesen': 'dk',
  'Cam Davis': 'au',
  'David Ford': 'us',
  // 2026 Open field players who had no flag — researched July 2026.
  'Alejandro De Castro Piera': 'es', // Spain (Barcelona)
  'Tim Wiedemeyer': 'de',            // Germany (Munich)
  'Scott Vincent': 'zw',             // Zimbabwe (Harare)
};
// Accent-insensitive index of PLAYER_FLAGS, so leaderboard display names with diacritics
// (e.g. "Séamus Power", "Thorbjørn Olesen") resolve to the same flag as their unaccented key
// without needing a duplicate entry. Mirrors the normalizer in the stat-leaderboard route.
// Some feeds label a player differently than our pool (e.g. the Masters field lists
// "Samuel Stevens" for our "Sam Stevens"). Canonicalize to the pool name so flags, photos,
// stats and ranks all resolve to the same player. Shared with the salary matcher (see name-aliases.ts).
export const canonicalName = (name: string): string => applyNameAlias(name);

export const normFlagName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().trim();
export const PLAYER_FLAGS_NORM: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [name, code] of Object.entries(PLAYER_FLAGS)) {
    const k = normFlagName(name);
    if (!(k in m)) m[k] = code; // first (exact-key) wins
  }
  return m;
})();
export const lookupFlagCode = (rawName: string): string => { const name = canonicalName(rawName); return PLAYER_FLAGS[name] ?? PLAYER_FLAGS_NORM[normFlagName(name)] ?? ''; };
export const getPlayerFlag = (name: string): string => lookupFlagCode(name);
export const getFlagSrc = (name: string): string => {
  const code = lookupFlagCode(name);
  if (!code) return '';
  const svgCodes = new Set(['us', 'au', 'ie', 'gb-sct', 'no', 'kr', 'jp', 'za', 'se', 'nz', 'dk', 'de', 'cl', 'co', 'ar', 've', 'be', 'at', 'fr', 'fi', 'cn', 'it', 'in', 'ph', 'fj', 'pr']);
  return `/flags/${svgCodes.has(code) ? code + '.svg' : code + '.png'}`;
};
export const FLAG_LABELS: Record<string, string> = { 'us': 'USA', 'gb-eng': 'ENG', 'gb-nir': 'NIR', 'au': 'AUS', 'ie': 'IRL', 'gb-sct': 'SCT', 'no': 'NOR', 'es': 'ESP', 'kr': 'KOR', 'jp': 'JPN', 'za': 'RSA', 'se': 'SWE', 'ca': 'CAN', 'nz': 'NZL', 'dk': 'DEN', 'de': 'GER', 'cl': 'CHI', 'co': 'COL', 'mx': 'MEX', 'ar': 'ARG', 've': 'VEN', 'be': 'BEL', 'at': 'AUT', 'fr': 'FRA', 'gb-wls': 'WAL', 'fi': 'FIN', 'cn': 'CHN', 'it': 'ITA', 'in': 'IND', 'ph': 'PHI', 'fj': 'FIJ', 'pr': 'PRI', 'tw': 'TPE', 'jm': 'JAM', 'th': 'THA', 'is': 'ISL', 'ua': 'UKR', 'nl': 'NED', 'zw': 'ZIM' };
export const getCountryLabel = (name: string): string => FLAG_LABELS[lookupFlagCode(name)] ?? '';

export const TOURNAMENT_PICKS_HEADER: Record<string, string> = {
  players: 'The Players Picks',
  masters: 'The Masters Picks',
  pga: 'PGA Championship Picks',
  'us-open': 'U.S. Open Picks',
  open: 'The Open Picks',
};

// Heights for the tab logo shown in place of the "<Tournament> Picks" column header
// ([mobile, desktop]) — tuned per logo shape; negative margins keep the row at text height.
export const PICKS_HEADER_LOGO_H: Record<string, [number, number]> = {
  players: [30, 39],
  masters: [23, 30],
  pga: [34, 46],
  'us-open': [28, 34],
  open: [30, 37],
};

export const TOURNAMENT_ENTRIES_INTRO: Record<string, string> = {
  players: 'Make or edit your picks for The Players Championship below.',
  masters: 'Make or edit your picks for The Masters below.',
  pga: 'Make or edit picks for the PGA Championship below.',
  'us-open': 'Make or edit your picks for the U.S. Open Championship below.',
  open: 'Make or edit picks for The Open Championship below.',
};

export const TOURNAMENT_CARD_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/the-players-championship-logo.png',
  masters: '/the-masters-card-logo.png',
  pga: '/pga-frisco-2027-logo.png',
  'us-open': '/us-open-pebble-beach-2027-logo.png',
  open: '/the-open-card-logo.png',
};

export const TOURNAMENT_TAB_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/players-tab-logo.webp',
  masters: '/masters-tab-logo.png',
  pga: '/pga-tab-logo.png',
  'us-open': '/us-open-tab-logo.png',
  open: '/open-tab-logo.png',
};

// PGA club professionals (not touring pros) — their bio popup header shows the PGA Championship
// logo + "Club Professional" under the name instead of ranking bubbles.
export const PGA_CLUB_PROFESSIONALS = new Set<string>([
  'Austin Hurt',
  'Michael Block',
  'Jared Jones',
  'Timothy Wiseman',
  'Ryan Lenahan',
  'Braden Shattuck',
  'Derek Berg',
  'Michael Kartrude',
  'Jesse Droemer',
  'Mark Geddes',
  'Bryce Fisher',
  'Garrett Sapp',
  'Paul McClure',
  'Zach Haynes',
  'Ben Kern',
  'Francisco Bide',
  'Francisco Bidé',
  'Tyler Collet',
  'Chris Gabriele',
]);

// Event/venue logos shown in the pick-sheet header (transparent PNGs on file).
export const TOURNAMENT_EVENT_LOGOS: Partial<Record<string, string>> = {
  open: '/open-tab-logo.png',
  masters: '/masters-tab-logo.png',
  'us-open': '/us-open-tab-logo.png',
  pga: '/pga-seal-gold.png',
  players: '/players-trophy.png',
};

// Per-event size/position for the pick-sheet header logo — aspect ratios differ wildly (square
// crest, tall trophy, wide Masters script), so each logo is tuned per view. m* = portrait mobile,
// l* = landscape phone, dH = desktop height; dCentered floats the logo mid-header on desktop
// instead of pinning it against the search bar.
export type EventLogoLayout = { mTop: number; mRight: number; mH: number; lTop: number; lRight: number; lH: number; dH: number; dCentered?: boolean };
export const DEFAULT_EVENT_LOGO_LAYOUT: EventLogoLayout = { mTop: -10, mRight: 28, mH: 132, lTop: 2, lRight: 72, lH: 206, dH: 140 };
export const TOURNAMENT_EVENT_LOGO_LAYOUTS: Partial<Record<string, EventLogoLayout>> = {
  open: { mTop: 14, mRight: 28, mH: 68, lTop: 42, lRight: 72, lH: 106, dH: 72, dCentered: true },
  masters: { mTop: 18, mRight: 28, mH: 38, lTop: 50, lRight: 84, lH: 60, dH: 34, dCentered: true },
  'us-open': { mTop: 13, mRight: 28, mH: 52, lTop: 38, lRight: 84, lH: 84, dH: 52, dCentered: true },
  pga: { mTop: 12, mRight: 18, mH: 102, lTop: 20, lRight: 100, lH: 148, dH: 140, dCentered: true },
  players: { mTop: 12, mRight: 28, mH: 132, lTop: 2, lRight: 150, lH: 180, dH: 140, dCentered: true },
};

export function eventLogoStyle(tid: string, isMobile: boolean, isLandscapePhone: boolean): CSSProperties {
  const L = TOURNAMENT_EVENT_LOGO_LAYOUTS[tid] ?? DEFAULT_EVENT_LOGO_LAYOUT;
  return {
    position: isMobile || isLandscapePhone ? 'absolute' : 'static',
    top: isMobile ? L.mTop : isLandscapePhone ? L.lTop : undefined,
    right: isMobile ? L.mRight : isLandscapePhone ? L.lRight : undefined,
    height: isMobile ? L.mH : isLandscapePhone ? L.lH : L.dH,
    width: 'auto',
    objectFit: 'contain',
    pointerEvents: 'none',
    flexShrink: 0,
    marginLeft: isMobile || isLandscapePhone || L.dCentered ? undefined : 'auto',
  };
}

// Per-tournament logo height (px) for the player-popup Career tab — each logo has a different aspect
// ratio, so they're tuned individually so they read at a consistent visual size.
export const CAREER_TAB_LOGO_HEIGHTS: Partial<Record<TournamentId, number>> = {
  players: 39,
  masters: 29,
  pga: 39,
  'us-open': 29,
  open: 30,
};

// Two-tone knockout tab logos for colored popup headers: pre-processed copies of the tab logos
// where everything is white except each tournament's signature element (gold golfer, yellow map +
// red flag, PGA seal, navy OPEN), so they read cleanly on the colored headers without a chip.
export const KNOCKOUT_TAB_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/knockout-players.png',
  masters: '/knockout-masters.png',
  pga: '/knockout-pga.png',
  'us-open': '/knockout-us-open.png',
  open: '/knockout-open.png',
};
export const TOURNAMENT_HEADING_LOGOS: Partial<Record<TournamentId, string>> = {
  masters: '/masters-heading-logo.png',
};


export const PICK_HISTORY_NAMES: Record<string, string> = {
  players: 'The Players Championship',
  masters: 'The Masters Tournament',
  pga: 'PGA Championship',
  'us-open': 'U.S. Open Championship',
  open: 'The Open Championship',
};

// Projected-cut window for the event being played: from noon EDT on Friday (Round 2) — 10 AM EDT
// for The Open, whose R2 runs overnight US time — until Round 3's first tee on Saturday.
export function cutShowAt(meta: TournamentMeta, tournamentId: string) {
  return Date.parse(`${meta.startDate}T00:00:00Z`) + 24 * 60 * 60 * 1000 + (tournamentId === 'open' ? 14 : 16) * 60 * 60 * 1000;
}
export function cutHideAt(meta: TournamentMeta) {
  return Date.parse(meta.lockAtUtc) + 2 * 24 * 60 * 60 * 1000 - 10 * 60 * 1000;
}

export const TOURNAMENT_TAB_LOGO_HEIGHTS: Partial<Record<TournamentId, number>> = {
  players: 46,
  pga: 46,
};

export const TOURNAMENT_CARD_LOGO_SIZES: Partial<Record<TournamentId, { width: number; height: number }>> = {
  players: { width: 78, height: 78 },
  pga: { width: 76, height: 76 },
  'us-open': { width: 76, height: 76 },
  open: { width: 92, height: 92 },
};

export const TOURNAMENT_CARD_WIDTH = 124;
export const TOURNAMENT_CARD_HEIGHT = 45;

export const pgaPhoto = (pgaId: number) =>
  `https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_350,q_auto,w_280/headshots_${pgaId}.png`;

// Colleges OUTSIDE the United States — displayed verbatim (no abbreviation).
export const NON_US_COLLEGES = new Set<string>([
  'University of Waikato',
  'Laval University',
  'Tohoku Fukushi University',
  'Osaka Gakuin University',
  'Korea National Sport University',
  'Yonsei University',
  'University College Dublin',
  'Dublin Business College',
]);
// Display renames applied AFTER the University strip (keyed by the stripped value).
export const COLLEGE_RENAMES: Record<string, string> = {
  'North Carolina-Chapel Hill': 'North Carolina',
};
// For US colleges, drop a leading "University of " or trailing " University"
// (e.g. "University of Arkansas" -> "Arkansas", "McNeese State University" -> "McNeese State").
// Non-US colleges are left exactly as-is.
export const formatCollege = (college: string): string => {
  if (NON_US_COLLEGES.has(college)) return college;
  let c = college;
  if (c.endsWith(' University')) c = c.slice(0, -' University'.length);
  else if (c.startsWith('University of ')) c = c.slice('University of '.length);
  return COLLEGE_RENAMES[c] ?? c;
};

// --- Featured-tournament row tints --------------------------------------------------
// Exact background/text colors for the majors + The Players. SHARED by the Season Results
// cards and the win-list popup so both surfaces highlight these events identically.
export const MAJOR_TINTS: Record<string, { bg: string; text: string }> = {
  'THE PLAYERS Championship': { bg: '#dce6f5', text: '#173b63' },
  'Masters Tournament':       { bg: '#d5eade', text: '#2c6449' },
  'U.S. Open':                { bg: '#fde8e8', text: '#BE3436' },
  'PGA Championship':         { bg: '#f5edd8', text: '#7a6a3e' },
  'The Open Championship':    { bg: '#dce6f5', text: '#173b63' },
  'The Open':                 { bg: '#dce6f5', text: '#173b63' },
};
// Normalized (case/space-insensitive) index so slightly different name strings still match.
export const MAJOR_TINTS_NORM: Record<string, { bg: string; text: string }> = {};
for (const [k, v] of Object.entries(MAJOR_TINTS)) MAJOR_TINTS_NORM[k.toLowerCase().replace(/\s+/g, ' ').trim()] = v;
// Returns { bg, text } for a major / The Players, or null for any other tournament.
// Some win-list entries carry a trailing year (e.g. "Masters Tournament (2021)") to disambiguate
// repeat wins; strip it before matching so those rows still highlight (the year band already shows it).
export const majorTint = (tournament: string): { bg: string; text: string } | null => {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const cleaned = tournament.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  return MAJOR_TINTS[tournament] ?? MAJOR_TINTS[cleaned]
    ?? MAJOR_TINTS_NORM[norm(tournament)] ?? MAJOR_TINTS_NORM[norm(cleaned)] ?? null;
};

// Photo priority:
// 1) A manually-uploaded photoUrl ALWAYS wins. These were uploaded for players who had no photo
//    anywhere, so they must never be overridden by an ESPN headshot (which can be a blank
//    silhouette). Manual uploads live on our own storage, never on PGA Tour's cloudinary domain.
// 2) Otherwise prefer the ESPN headshot (matches the bio popup). Matt Fitzpatrick is intentionally
//    absent from the ESPN id map so he keeps the PGA photo.
// 3) Otherwise the PGA Tour headshot (incl. a PGA-cloudinary photoUrl).
export const isManualPhoto = (photoUrl?: string): photoUrl is string =>
  !!photoUrl && !photoUrl.includes('pga-tour-res.cloudinary.com');
// Players pinned to the PGA Tour photo everywhere (overrides ESPN and any manual photo).
export const PGA_PHOTO_ONLY = new Set<string>([
  'Matt Fitzpatrick',
  'Ludvig Aberg',
]);
// Hand-uploaded photos (public/player-photos/) for players PGA/ESPN have no usable headshot for
// (mostly Masters legends). Keyed by name; these ALWAYS win (highest priority) since they were
// chosen deliberately. Matched on a normalized name so accent/spelling variants still resolve.
export const MANUAL_PHOTO_FILES: Record<string, string> = {
  // Fred Couples, José María Olazábal and Vijay Singh were switched to their (higher-quality)
  // ESPN headshots (see PLAYER_ESPN_IDS), so they're intentionally not listed here anymore.
  // All transparent cutouts so they blend on colored cards (gold Open surfaces etc.).
  'Ernie Els': '/player-photos/ernie-els.png',
  'John Daly': '/player-photos/john-daly.png',
  'Phil Mickelson': '/player-photos/phil-mickelson.png',
  'Tiger Woods': '/player-photos/tiger-woods.png',
  // Neither ESPN nor PGA Tour has a headshot for these — supplied manually.
  'Andy Sullivan': '/player-photos/andy-sullivan.png',
  'Joe Dean': '/player-photos/joe-dean.png',
  'Cameron John': '/player-photos/cameron-john.png',
  'Jordan Gumberg': '/player-photos/jordan-gumberg.png',
  'Paul McClure': '/player-photos/paul-mcclure.png',
  'Derek Berg': '/player-photos/derek-berg.png',
};
export const normPhotoName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();
export const MANUAL_PHOTO_BY_NORM: Record<string, string> = {};
for (const [k, v] of Object.entries(MANUAL_PHOTO_FILES)) MANUAL_PHOTO_BY_NORM[normPhotoName(k)] = v;
export const playerPhotoSrc = (rawName: string, pgaTourId: number, photoUrl?: string) => {
  const name = canonicalName(rawName);
  const manualFile = MANUAL_PHOTO_BY_NORM[normPhotoName(name)];
  if (manualFile) return manualFile;
  if (PGA_PHOTO_ONLY.has(name)) return pgaPhoto(pgaTourId);
  if (isManualPhoto(photoUrl)) return photoUrl;
  const espnId = PLAYER_ESPN_IDS[name];
  return espnId
    ? `https://a.espncdn.com/i/headshots/golf/players/full/${espnId}.png`
    : (photoUrl ?? pgaPhoto(pgaTourId));
};
// onError fallback: if the ESPN headshot fails to load, swap to the PGA photo (data-fb), once.
export const photoOnError = (e: { currentTarget: HTMLImageElement }) => {
  const img = e.currentTarget;
  if (img.dataset.fellback) return;
  const fb = img.dataset.fb;
  if (fb) { img.dataset.fellback = '1'; img.src = fb; }
};

// Ground-truth header name/flag/abbreviation fitting: shrinks the name to fit the row
// and, if even the minimum size cannot fit with the abbreviation inline, hangs the
// abbreviation below the flag (where allowed) and re-grows the name. Decisions come from
// real DOM measurements — no font/device estimate can cause truncation.
export function HeaderNameFlag({ name, flagSrc, abbr, base, min, allowStack, initialStacked }: { name: string; flagSrc: string | null; abbr: string | null; base: number; min: number; allowStack: boolean; initialStacked: boolean }) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(base);
  const [stacked, setStacked] = useState(initialStacked);
  const [, setMeasureTick] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restarts the fit-to-width measurement when the name changes
  useLayoutEffect(() => { setSize(base); setStacked(initialStacked); }, [name, base, initialStacked]);
  // The row's free space changes without a React render when the flag/logo images finish
  // loading (they start at width 0) — observe the span's box so any squeeze re-fits.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setMeasureTick((v) => v + 1));
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const meas = measureRef.current;
    if (!outer || !meas) return;
    // WebKit can report scrollWidth === clientWidth on ellipsized text, so measure a
    // hidden untruncated clone and compare it to the space the flex row actually gives.
    const full = meas.offsetWidth;
    const box = outer.clientWidth;
    if (full <= box) return;
    const floorSize = stacked || !allowStack ? Math.max(11, min - 2) : min;
    if (size > floorSize) {
      const next = Math.max(floorSize, Math.floor(size * (box / full) * 2) / 2);
      setSize(next < size ? next : size - 0.5);
    } else if (allowStack && !stacked && abbr) {
      // Even the floor size can't fit beside the inline abbreviation — hang the
      // abbreviation under the flag, which frees its width, and let the name grow back.
      setStacked(true);
      setSize(base);
    }
  });
  const flagH = size >= 17 ? 20 : size >= 15 ? 18 : 16;
  return (
    <>
      <span ref={outerRef} style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: size, position: 'relative' }}>
        {name}
        <span ref={measureRef} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{name}</span>
      </span>
      {flagSrc && (
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 8, verticalAlign: 'middle', flexShrink: 0 }}>
          <img src={flagSrc} alt="" style={{ height: flagH, display: 'block', borderRadius: 3 }} />
          {abbr && (stacked
            ? <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 2, color: '#fff', fontWeight: 400, fontSize: 10, lineHeight: 1 }}>{abbr}</span>
            : <span style={{ marginLeft: 5, color: '#fff', fontWeight: 400, fontSize: 13, lineHeight: 1 }}>{abbr}</span>)}
        </span>
      )}
    </>
  );
}

// Renders a single line of text that shrinks its font (down to `min`) just enough to stay on one
// line at any width — used for the pre-tournament card's "<Event> begins on <date>." headline so it
// never wraps on narrow phones. Measurement-based, so no device/font estimate can mis-fit it.
export function FitOneLineText({ text, base, min, style }: { text: string; base: number; min: number; style?: CSSProperties }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(base);
  const [, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- restarts the fit-to-width measurement when the text changes
  useLayoutEffect(() => { setSize(base); }, [text, base]);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick((v) => v + 1));
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const meas = measureRef.current;
    if (!outer || !meas) return;
    const avail = outer.clientWidth;
    const full = meas.offsetWidth;
    if (full <= avail || size <= min) return;
    const next = Math.max(min, Math.floor(size * (avail / full) * 2) / 2);
    setSize(next < size ? next : size - 0.5);
  });
  return (
    <div ref={outerRef} style={{ ...style, fontSize: size, whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative' }}>
      {text}
      <span ref={measureRef} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{text}</span>
    </div>
  );
}

// Popup-header layout fitting: measures the name, flag and country abbreviation with a
// canvas so the header only stacks the abbreviation below the flag — and only shrinks the
// name/flag/logo — when the row genuinely cannot fit them at full size on one line.
export const HEADER_LOGO_WIDTH_EST: Record<TournamentId, number> = { players: 50, masters: 96, pga: 80, 'us-open': 75, open: 64 };
export let headerMeasureCtx: CanvasRenderingContext2D | null | undefined;
export function fitPopupHeader(name: string, abbr: string | null | undefined | false, popupMaxW: number, padH: number, tournamentId: TournamentId, mobile: boolean, forceInline = false, overlayPad = 40): { fontSize: number; flagH: number; stacked: boolean; shrinkLogo: boolean } {
  const sizes: number[] = [];
  for (let s = mobile ? 18 : 21; s >= (mobile ? 11 : 14); s -= 0.5) sizes.push(s);
  const fallback = { fontSize: sizes[0], flagH: 20, stacked: false, shrinkLogo: false };
  if (typeof window === 'undefined' || !name) return fallback;
  if (headerMeasureCtx === undefined) headerMeasureCtx = document.createElement('canvas').getContext('2d');
  const ctx = headerMeasureCtx;
  const family = (document.body ? getComputedStyle(document.body).fontFamily : '') || 'sans-serif';
  // Conservative measurement: canvas may resolve the app's webfont differently than the
  // DOM, so take the widest of the app family and a plain sans-serif, plus 5% slack —
  // underestimating here is what lets the name get clipped by the ellipsis.
  const w = (text: string, weight: number, px: number) => {
    if (!ctx) return text.length * px * 0.62;
    let widest = 0;
    for (const fam of [family, 'sans-serif']) {
      ctx.font = `${weight} 100px ${fam}`;
      widest = Math.max(widest, ctx.measureText(text).width);
    }
    return (widest * px / 100) * 1.1;
  };
  const logoWFull = HEADER_LOGO_WIDTH_EST[tournamentId] ?? 90;
  const popupW = Math.min(popupMaxW, window.innerWidth - overlayPad);
  const abbrW = abbr ? w(abbr, 400, 13) + 5 : 0;
  const flagFor = (fs: number) => fs >= sizes[0] ? 20 : fs >= (mobile ? 16 : 19) ? 18 : 16;
  // Two passes: full-size logo first, shrunken logo only if nothing fits beside it.
  for (const shrinkLogo of [false, true]) {
    // popup width − header padding − logo − close button (34) − flex gaps
    const avail = popupW - padH - (shrinkLogo ? logoWFull * 0.75 : logoWFull) - 34 - 12;
    for (const fs of sizes) {
      const flagH = flagFor(fs);
      const nameRow = w(name, 900, fs) + 8 + flagH * 1.5; // + flag margin + 3:2 flag
      if (forceInline) {
        // Inline-only mode (headers with a second row under the name, e.g. the live
        // scorecard's Previous Rounds button): the abbreviation must never hang below the
        // flag, so step the whole trio down until it fits with breathing room to the logo.
        if (nameRow + abbrW <= avail - 8) return { fontSize: fs, flagH, stacked: false, shrinkLogo };
        continue;
      }
      if (nameRow + abbrW <= avail - 4) return { fontSize: fs, flagH, stacked: false, shrinkLogo };
      if (nameRow <= avail - 4) return { fontSize: fs, flagH, stacked: true, shrinkLogo };
    }
  }
  return { fontSize: sizes[sizes.length - 1], flagH: 16, stacked: !forceInline, shrinkLogo: true };
}

export const PLAYER_POOL = PLAYER_POOL_WITH_PGA_IDS;
// Original static world ranks by pool id. The info popup uses THIS as its world-rank fallback so the
// commissioner's uploaded pick-list ranks (which override worldRank on the pick sheet) never change
// what the player info popup shows.
export const ORIGINAL_WORLD_RANK_BY_ID = new Map<number, number>(PLAYER_POOL.map((p) => [p.id, p.worldRank]));

// Names too long to fit on one line in the mobile pick list — forced to wrap between first and last name
export const MOBILE_TWO_LINE_NAMES = new Set(['Bryson DeChambeau', 'Michael Thorbjornsen', 'Sudarshan Yellamaraju', 'Rasmus Neergaard-Petersen']);

// Custom split points for names where the default "split at last space" gives the wrong break
export const MOBILE_CUSTOM_SPLITS: Record<string, [string, string]> = {
  'Rasmus Neergaard-Petersen': ['Rasmus Neergaard-', 'Petersen'],
};

export const DEFAULT_ROSTERS: Record<string, number[]> = {
  players: [1, 2, 8, 10, 12, 14],
  masters: [1, 2, 3, 4, 5, 6],
  pga: [1, 3, 5, 8, 10, 11],
  'us-open': [1, 2, 5, 7, 10, 14],
  open: [2, 3, 5, 6, 8, 12],
};

export type TournamentId = (typeof TOURNAMENTS)[number]['id'];
export type MainTab = 'Standings' | 'My Entries' | 'Details' | 'Reports' | 'Commissioner Hub';
export const MAIN_TABS: MainTab[] = ['Standings', 'My Entries', 'Details', 'Reports', 'Commissioner Hub'];

export type ReportType = 'Season Standings' | 'Hall of Champions' | 'Player Pick Summary' | 'Pool Member Pick History' | 'Pool Member Pick Summary' | 'Player Performance Summary' | 'Pool Standings History';
export const REPORT_OPTIONS: ReportType[] = ['Season Standings', 'Hall of Champions', 'Player Pick Summary', 'Pool Member Pick History', 'Pool Member Pick Summary', 'Player Performance Summary', 'Pool Standings History'];
export const REPORT_TOURNAMENTS: { id: TournamentId; label: string }[] = [
  { id: 'players', label: 'The Players' },
  { id: 'masters', label: 'The Masters' },
  { id: 'pga', label: 'PGA Championship' },
  { id: 'us-open', label: 'U.S. Open' },
  { id: 'open', label: 'The Open' },
];
// Seasons the pool has run (season 1 = 2026). Append new years as future seasons are played.
// Seasons with at least one event started (season 1 = 2026). A new season joins the year pickers
// once its first tournament tees off.
export const POOL_SEASONS = SCHEDULED_SEASONS.filter((season) =>
  TOURNAMENTS.some((t) => Date.now() >= Date.parse(getTournamentMeta(t.id, season)?.lockAtUtc ?? '')),
);

export type SeasonPicks = {
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  pastSeasons?: Record<number, { rosters: Partial<Record<TournamentId, number[]>>; tieBreaks: Partial<Record<TournamentId, number>> }>;
};

// A member's picks for one tournament in a season. `rosters` holds each tournament's current
// picks season; earlier seasons come from pastSeasons.
export function rosterInSeason(entry: SeasonPicks, tournamentId: TournamentId, season: number) {
  return season === picksSeason(tournamentId) ? entry.rosters[tournamentId] : entry.pastSeasons?.[season]?.rosters[tournamentId];
}
export function tieBreakInSeason(entry: SeasonPicks, tournamentId: TournamentId, season: number) {
  return season === picksSeason(tournamentId) ? entry.tieBreaks?.[tournamentId] : entry.pastSeasons?.[season]?.tieBreaks[tournamentId];
}
// The entry with every tournament's picks taken from one season (Reports by year).
export function withSeasonPicks<T extends SeasonPicks>(entry: T, season: number): T {
  const rosters: Partial<Record<TournamentId, number[]>> = {};
  const tieBreaks: Partial<Record<TournamentId, number>> = {};
  for (const t of TOURNAMENTS) {
    const id = t.id as TournamentId;
    const roster = rosterInSeason(entry, id, season);
    const tieBreak = tieBreakInSeason(entry, id, season);
    if (roster) rosters[id] = roster;
    if (tieBreak !== undefined) tieBreaks[id] = tieBreak;
  }
  return { ...entry, rosters, tieBreaks };
}
// Explicit render heights (px) for the tournament logo shown inside the Reports dropdown box.
// Uses an explicit height (not max-height) so the small source PNGs upscale to fill the box.
export const REPORT_DROPDOWN_LOGO_H: Record<TournamentId, number> = { players: 48, masters: 28, pga: 44, 'us-open': 32, open: 34 };
export const REPORT_TOURNAMENT_SOLID: Record<TournamentId, string> = {
  players: '#173b63',
  masters: '#2c6449',
  pga: '#B09963',
  'us-open': '#BE3436',
  open: '#173b63',
};
// Sky-blue gradient used for the Player Pick Summary "All tournaments" bars — matches the flag/accent
// lines by the "Golf Majors Pool" logo in the main header (rgb 112,202,220 = #70cadc).
export const PPS_ALL_BAR_GRADIENT = 'linear-gradient(135deg, #7fd2e4 0%, #45a7cf 100%)';
export const REPORT_TOURNAMENT_CHIP: Record<TournamentId, { short: string; bg: string; fg: string }> = {
  players: { short: 'PLAYERS', bg: '#173b63', fg: '#fff' },
  masters: { short: 'MASTERS', bg: '#2c6449', fg: '#fff' },
  pga: { short: 'PGA', bg: '#B09963', fg: '#fff' },
  'us-open': { short: 'U.S. OPEN', bg: '#BE3436', fg: '#fff' },
  open: { short: 'THE OPEN', bg: '#F4BC41', fg: '#000' },
};
export const MAIN_TAB_STORAGE_KEY = `${STORAGE_PREFIX}:main-tab`;

export type FeedRow = {
  position: string;
  score: string;
  thru: string;
  total?: string;
  currentRoundScore?: string | null;
  backNineStart?: boolean;
  teeTime?: string | null;
  canonicalName?: string;
  scoreBreakdown?: GolferScoreBreakdown;
  lowRoundIds?: number[];
  originalScore?: string;
};

export type FullFieldPlayer = {
  playerId: string;
  poolPlayerId: number | null;
  name: string;
  position: string;
  score: string;
  thru: string;
  originalScore?: string;
  currentRoundScore?: string | null;
  teeTime?: string | null;
  backNineStart?: boolean;
};

export type ScorecardHole = { hole: number; par: number; score: number | null; label: string };
export type ScorecardRound = { round: number; score?: number | string; holes: ScorecardHole[] };
export type ScorecardData = { courseName: string; par: number; rounds: ScorecardRound[]; source: string; message?: string };

export type ArchivedGolfer = { name: string; score: string; points: number; position: string; salary: number };
export type ArchivedStandingRow = { place: number; name: string; points: number; holesRemaining: number; tieBreak: number; golfers?: ArchivedGolfer[] };
export type ArchivedPayouts = { first?: number; second?: number; third?: number };
export type ArchivedStandingsData = { available?: boolean; standings?: ArchivedStandingRow[]; payouts?: ArchivedPayouts | null; savedAt?: string | null; error?: string };

export type FeedResponse = {
  fetchedAt: string;
  // When the cached leaderboard was saved (for a finished event, about when it went final).
  cachedAt?: string;
  // The season the data is from, and its ESPN event id (found by name for a new season).
  season?: number;
  espnEventId?: string;
  players: FeedRow[];
  odds: Array<{
    canonicalName: string;
    odds: string;
  }>;
  oddsSource?: string;
  source: string;
  status: string;
  currentRound?: number;
  projectedCut?: string | null;
  tournamentComplete?: boolean;
  tournamentLowRoundScore?: number | null;
  fieldBonusEvents?: Record<string, { name: string; rounds: number[]; count?: number }[]> | null;
  coursePar?: number;
  fullLeaderboard?: FullFieldPlayer[];
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
  venmo?: string | null;
  venmoDeclined?: boolean;
  // false until a new account enters its emailed code.
  emailVerified?: boolean;
  pastSeasons?: SeasonPicks['pastSeasons'];
};

export type PoolInfo = {
  id: string;
  name: string;
  joinCode: string;
  lineupLocks: Partial<Record<TournamentId, boolean>>;
  picksOpen: Partial<Record<TournamentId, boolean>>;
  payouts: Partial<Record<TournamentId, { first: number; second: number; third: number }>>;
  winnerScores: Partial<Record<TournamentId, number>>;
  role?: 'member' | 'commissioner';
  plan?: string;
  memberLimit?: number | null;
  paidSeason?: number | null;
  seasonExpired?: boolean;
  memberCount?: number;
  commissioners?: { id: string; name: string; email: string; venmo?: string | null }[];
  // Entry fee per tournament and the Venmo that collects it (null until a commissioner adds one).
  entryFees?: Partial<Record<TournamentId, number>>;
  venmo?: { userId: string; name: string; handle: string } | null;
  // How the league splits the pot, and per tournament the entries, pot and whether amounts were typed in.
  payoutPlan?: PayoutPlan | null;
  payoutInfo?: Partial<Record<TournamentId, PayoutInfo>>;
  // How to pay the entry fee when it isn't through the commissioner's Venmo.
  paymentNote?: string | null;
  seasonFee?: number | null;
  seasonPayoutPlan?: PayoutPlan | null;
  // Entry fee status per tournament, by member id (members get only their own).
  entryPayments?: Partial<Record<TournamentId, Record<string, 'reported' | 'confirmed'>>>;
  // Commissioners only: winners already paid this season.
  payoutsSent?: Partial<Record<TournamentId, { place: number; userId: string | null; amount: number; sentAt: string }[]>>;
};

export type PoolEntry = {
  id: string;
  name: string;
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
  // Shown to commissioners only, for paying winners.
  venmo?: string | null;
  // Earlier seasons' picks, by year (rosters / tieBreaks above are each tournament's current season).
  pastSeasons?: SeasonPicks['pastSeasons'];
};

export type CommissionerMember = AuthUser;
export type AuthMode = 'login' | 'register';

export type StandingGolfer = ReturnType<typeof buildPricedPlayers>[number] & {
  position: string;
  thru: string;
  score: string;
  total: string;
  currentRoundScore: string | null;
  backNineStart: boolean;
  teeTime: string | null;
  points: number;
  holesRemaining: number;
  scoreBreakdown: GolferScoreBreakdown;
  originalScore?: string;
};

export type StandingEntry = PoolEntry & {
  picks: number[];
  golfers: StandingGolfer[];
  rosterPoints: number;
  holesRemaining: number;
  tieBreakValue: number;
  place: number;
};

export const STATIC_ENTRIES: PoolEntry[] = [
  { id: 'static-2', name: 'Brady S.', rosters: { pga: [1, 3, 5, 7, 9, 11] }, tieBreaks: {} },
  { id: 'static-3', name: 'Megan T.', rosters: { pga: [2, 4, 6, 8, 12, 13] }, tieBreaks: {} },
  { id: 'static-4', name: 'Ryan H.', rosters: { pga: [3, 4, 5, 9, 10, 14] }, tieBreaks: {} },
];

export type SessionPayload = {
  user: AuthUser | null;
  pool: PoolInfo | null;
  entries: PoolEntry[];
  leagues?: LeagueSummary[];
  isAppAdmin?: boolean;
  canCreateLeague?: boolean;
  error?: string;
};

export type SessionFlags = { leagues: LeagueSummary[]; isAppAdmin: boolean; canCreateLeague: boolean };
export const NO_SESSION_FLAGS: SessionFlags = { leagues: [], isAppAdmin: false, canCreateLeague: false };

export function buildPricedPlayers(
  playerPool: ReadonlyArray<{
    id: number;
    name: string;
    defaultOdds: string;
    worldRank: number;
    pgaTourId: number;
    photoUrl?: string;
  }>,
  liveOddsMap: Record<string, string>,
  salaryOverrides?: Record<number, number>,
  worldRankOverrides?: Record<number, number>,
) {
  // Salaries come ONLY from the commissioner's uploaded list (/commissioner-salary). There is no
  // automated pricing: a player not on the uploaded list gets salary 0 and is filtered out of the
  // pickable list, so the uploaded file is the single source of the pick list.
  // Uploaded ranks win, EXCEPT 999+ placeholders ("unranked" rows in the spreadsheet, or ranks
  // captured while a player was a dynamic add) — those defer to the pool's rank when it's real.
  const realRank = (override: number | undefined, poolRank: number) => {
    if (override != null && override < 999) return override;
    if (poolRank < 999) return poolRank;
    return Math.min(override ?? poolRank, 999); // unranked always displays as 999, never 9999
  };
  return playerPool.map((player) => ({
    id: player.id,
    name: player.name,
    worldRank: realRank(worldRankOverrides?.[player.id], player.worldRank),
    odds: liveOddsMap[normalizeName(player.name)] ?? player.defaultOdds,
    salary: salaryOverrides?.[player.id] ?? 0,
    pgaTourId: player.pgaTourId,
    photoUrl: player.photoUrl,
  }));
}

export function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00f8/gi, 'o').replace(/\u00e5/gi, 'a').replace(/\u00e6/gi, 'ae')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function formatRosterField(roster: number[] | undefined) {
  return (roster ?? []).join(', ');
}

export function parseRosterField(value: string) {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function readStoredMainTab() {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.sessionStorage.getItem(MAIN_TAB_STORAGE_KEY);
  return MAIN_TABS.includes(stored as MainTab) ? (stored as MainTab) : null;
}

export function writeStoredMainTab(tab: MainTab) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(MAIN_TAB_STORAGE_KEY, tab);
}

export function clearStoredMainTab() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(MAIN_TAB_STORAGE_KEY);
}

// Snapshots older than this are discarded so server-side admin changes
// (roster edits, stat overrides) are visible within one TTL window.
export const SESSION_SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:session`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SessionPayload & { cachedAt?: number };
    // Treat missing or stale snapshots as absent — forces a fresh API fetch
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > SESSION_SNAPSHOT_TTL_MS) {
      return null;
    }
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

export function writeStoredSession(payload: SessionPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    `${STORAGE_PREFIX}:session`,
    JSON.stringify({ ...payload, cachedAt: Date.now() }),
  );
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(`${STORAGE_PREFIX}:session`);
}

// This device used to keep a list of every account signed in on it — with each password, in plain
// text — to sign itself back in when a session lapsed. The session itself now renews on use
// (/api/auth/session), so nothing needs a password after sign-in. Remove any list an older version
// left behind, passwords and all.
export function purgeStoredAccounts() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}:accounts`);
  } catch {
    // Storage unavailable (private mode): there is nothing stored to remove.
  }
}

export function readRoster(tournamentId: TournamentId) {
  if (typeof window === 'undefined') {
    return DEFAULT_ROSTERS[tournamentId];
  }

  const key = `${STORAGE_PREFIX}:roster:${tournamentId}`;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return DEFAULT_ROSTERS[tournamentId];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_ROSTERS[tournamentId];
  } catch {
    return DEFAULT_ROSTERS[tournamentId];
  }
}

export function saveGuestRoster(tournamentId: TournamentId, roster: number[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = `${STORAGE_PREFIX}:roster:${tournamentId}`;
  window.localStorage.setItem(key, JSON.stringify(roster));
}

export function readFeedCache(tournamentId: TournamentId): FeedResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:feed:${tournamentId}`);
    return raw ? (JSON.parse(raw) as FeedResponse) : null;
  } catch {
    return null;
  }
}

export function writeFeedCache(tournamentId: TournamentId, data: FeedResponse): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}:feed:${tournamentId}`, JSON.stringify(data));
  } catch {}
}

export function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number) {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (occurrence - 1) * 7);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Returns "Round 1" … "Round 4" based on how many days past tournament Thursday we are.
// Transitions happen at midnight CST (UTC-6) each day.
export function getCurrentRoundLabel(startDate: Date, now: Date): string {
  const CST_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC-6
  const thuMidnightUtc = startOfDay(startDate).getTime() + CST_OFFSET_MS;
  const dayMs = 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  if (nowMs >= thuMidnightUtc + 3 * dayMs) return 'Round 4';
  if (nowMs >= thuMidnightUtc + 2 * dayMs) return 'Round 3';
  if (nowMs >= thuMidnightUtc + 1 * dayMs) return 'Round 2';
  return 'Round 1';
}

export function buildOccurrenceDate(referenceIso: string, year: number, dateOnly: Date) {
  const reference = new Date(referenceIso);
  return new Date(
    year,
    dateOnly.getMonth(),
    dateOnly.getDate(),
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds(),
  );
}

export function getTournamentStartDate(tournamentId: TournamentId, year: number) {
  switch (tournamentId) {
    case 'players':
      return nthWeekdayOfMonth(year, 2, 4, 2);
    case 'masters':
      return nthWeekdayOfMonth(year, 3, 4, 2);
    case 'pga':
      return nthWeekdayOfMonth(year, 4, 4, 2);
    case 'us-open':
      return nthWeekdayOfMonth(year, 5, 4, 3);
    case 'open':
      return nthWeekdayOfMonth(year, 6, 4, 3);
  }
}

// Commissioner-set pool lock times (Round 1 first tee, UTC ISO), fetched at boot from
// /api/commissioner/lock-time. When set, a tournament's IN PROGRESS transition (live
// standings/leaderboard + pick lock) happens at exactly this moment instead of the
// built-in firstTeeUtc schedule. Module-level so the pure window helpers below see it.
export let LOCK_TIME_OVERRIDES: Partial<Record<TournamentId, string>> = {};

// Tournaments manually pinned to keep showing their most recent completed results
// (the LOCKED / Final Results leaderboard view) instead of rolling over to next
// season's UP NEXT preview once their year's window has concluded. Remove an entry
// here to let that tournament advance to its next-season pre-tournament view again.
export const FORCE_COMPLETED_VIEW: Partial<Record<TournamentId, boolean>> = {};

// Inverse of FORCE_COMPLETED_VIEW: tournaments manually flipped to show their NEXT season's
// pre-tournament (UP NEXT) card right now, instead of their most recent concluded results.
// Add an id (e.g. `masters: true`) to flip that tournament over; remove it to drop back to that
// tournament's results. This does NOT disable the automatic start-time behavior: because the check
// for this map sits BELOW the IN PROGRESS / ACTIVE checks in getTournamentCardStatuses, a forced
// tournament still switches to IN PROGRESS / live standings on its own the moment its next event's
// first-tee time arrives — no manual step needed. After that event concludes it rolls to the
// following season's preview while the flag is set, so clear the flag to reveal that year's results.
export const FORCE_PRE_TOURNAMENT_VIEW: Partial<Record<TournamentId, boolean>> = {};
// Commissioner-set (Admin hub) pre-tournament overrides, synced from the
// /api/commissioner/pre-tournament store at boot and whenever the toggle is flipped.
// COMMISSIONER_PRE_TOURNAMENT_VIEW holds the manual value (true = pre-tournament, false = results),
// COMMISSIONER_PRE_TOURNAMENT_AT holds when it was set. A manual value is honored until the next
// automatic reset point (that tournament's next start, or the next Jan 1), after which the view
// falls back to the date-driven default. See shouldShowPreTournamentView below.
export let COMMISSIONER_PRE_TOURNAMENT_VIEW: Partial<Record<TournamentId, boolean>> = {};
export let COMMISSIONER_PRE_TOURNAMENT_AT: Partial<Record<TournamentId, string>> = {};

// The page loads these settings at boot; the schedule helpers above read them.
export function setLockTimeOverrides(next: Partial<Record<TournamentId, string>>) {
  LOCK_TIME_OVERRIDES = next;
}
export function setCommissionerPreTournamentView(view?: Partial<Record<TournamentId, boolean>>, at?: Partial<Record<TournamentId, string>>) {
  if (view) COMMISSIONER_PRE_TOURNAMENT_VIEW = view;
  if (at) COMMISSIONER_PRE_TOURNAMENT_AT = at;
}

// Render a UTC instant as a datetime-local value in Central time, and convert back.
export function utcToCentralInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
export function centralInputToUtc(input: string): string | null {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const want = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = want;
  // Iterate: adjust until the Chicago rendering of `utc` matches the requested wall time.
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utc));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const rendered = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
    utc += want - rendered;
  }
  return new Date(utc).toISOString();
}

export type TournamentCardStatus = {
  label: 'LOCKED' | 'UP NEXT' | 'ACTIVE' | 'IN PROGRESS';
  color: string;
  icon: 'lock' | 'trophy' | 'check';
} | null;

export function getTournamentEventWindow(tournament: (typeof TOURNAMENTS)[number], year: number) {
  // Scheduled seasons use their real dates (app/lib/tournament-config.ts); later years fall back to
  // the usual week of the month.
  const meta = getTournamentMeta(tournament.id, year);
  const startDate = meta ? new Date(`${meta.startDate}T00:00:00`) : getTournamentStartDate(tournament.id, year);
  const activeAt = addDays(startOfDay(startDate), -3);
  const scheduledTee = meta ? new Date(meta.lockAtUtc) : buildOccurrenceDate(tournament.firstTeeUtc, year, startDate);
  // A commissioner-set Pool Lock Time replaces the built-in first-tee time for its week.
  const overrideIso = effectiveLockTime(LOCK_TIME_OVERRIDES[tournament.id], scheduledTee.toISOString());
  const inProgressAt = overrideIso ? new Date(overrideIso) : scheduledTee;
  const concludeAt = addDays(startOfDay(startDate), 4);

  return {
    id: tournament.id,
    year,
    activeAt,
    inProgressAt,
    concludeAt,
    startDate,
  };
}

export function getDisplayTournamentWindow(tournament: (typeof TOURNAMENTS)[number], now = new Date()) {
  const currentWindow = getTournamentEventWindow(tournament, now.getFullYear());
  if (now < currentWindow.concludeAt) {
    return currentWindow;
  }

  return getTournamentEventWindow(tournament, now.getFullYear() + 1);
}

// Whether a tournament's Standings tab should show its next-season pre-tournament card (vs results),
// for the pre-event window only (IN PROGRESS / ACTIVE always win first in getTournamentCardStatuses).
//
//  - Date default: pre-tournament while the current calendar year's event hasn't started yet,
//    results once it has. This alone gives the two automatic behaviors: every tab flips to Results
//    on its own the moment its event starts, and every tab is pre-tournament again from Jan 1
//    (when that year's event is once more in the future).
//  - A commissioner manual toggle overrides the default, but only until the next reset point — the
//    tournament's next start, or the next Jan 1 — after which it reverts to the date default. So a
//    pre-event "pre-tournament" set is cleared when the event starts, and a manual set made before a
//    New Year is cleared on Jan 1; a fresh manual set (e.g. re-engaging after the event) sticks.
export function shouldShowPreTournamentView(tournament: (typeof TOURNAMENTS)[number], now: Date): boolean {
  if (FORCE_PRE_TOURNAMENT_VIEW[tournament.id]) return true;
  const year = now.getFullYear();
  const start = getTournamentEventWindow(tournament, year).inProgressAt;
  const dateDefaultPre = now < start;
  const manual = COMMISSIONER_PRE_TOURNAMENT_VIEW[tournament.id];
  if (manual === undefined) return dateDefaultPre;
  const atIso = COMMISSIONER_PRE_TOURNAMENT_AT[tournament.id];
  const at = atIso ? new Date(atIso) : null;
  if (!at || Number.isNaN(at.getTime())) return manual; // legacy value without a timestamp — treat as fresh
  const crossedNewYear = now.getFullYear() > at.getFullYear();
  const mostRecentStart = now >= start ? start : getTournamentEventWindow(tournament, year - 1).inProgressAt;
  const crossedStart = mostRecentStart > at;
  const stale = crossedNewYear || crossedStart;
  return stale ? dateDefaultPre : manual;
}

export function getTournamentCardStatuses(now = new Date()) {
  const currentYear = now.getFullYear();
  const windows = TOURNAMENTS.flatMap((tournament) => [
    getTournamentEventWindow(tournament, currentYear),
    getTournamentEventWindow(tournament, currentYear + 1),
  ]).sort((left, right) => left.activeAt.getTime() - right.activeAt.getTime());

  const nextUpcoming = windows.find((window) => now < window.activeAt) ?? null;
  const statuses: Partial<Record<TournamentId, TournamentCardStatus>> = {};

  for (const tournament of TOURNAMENTS) {
    const currentWindow = getTournamentEventWindow(tournament, currentYear);
    const nextWindow = getTournamentEventWindow(tournament, currentYear + 1);

    if (now < currentWindow.concludeAt && now >= currentWindow.inProgressAt) {
      statuses[tournament.id] = {
        label: 'IN PROGRESS',
        color: '#15803d',
        icon: 'check',
      };
      continue;
    }

    if (now < currentWindow.concludeAt && now >= currentWindow.activeAt) {
      statuses[tournament.id] = {
        label: 'ACTIVE',
        color: '#15803d',
        icon: 'check',
      };
      continue;
    }

    // Next-season pre-tournament (UP NEXT) card. Sits BELOW the IN PROGRESS / ACTIVE checks above, so
    // once this tournament's next event reaches its start time it still turns over to live standings
    // automatically. Date-driven by default, with a commissioner manual override — see
    // shouldShowPreTournamentView.
    if (shouldShowPreTournamentView(tournament, now)) {
      statuses[tournament.id] = {
        label: 'UP NEXT',
        color: '#234d80',
        icon: 'trophy',
      };
      continue;
    }

    // Pinned tournaments stay on their concluded-year results view instead of
    // advancing to next season's UP NEXT preview.
    if (FORCE_COMPLETED_VIEW[tournament.id] && now >= currentWindow.concludeAt) {
      statuses[tournament.id] = {
        label: 'LOCKED',
        color: '#be123c',
        icon: 'lock',
      };
      continue;
    }

    const upcomingWindow = now < currentWindow.concludeAt ? currentWindow : nextWindow;
    const isUpNext =
      nextUpcoming &&
      nextUpcoming.id === tournament.id &&
      nextUpcoming.year === upcomingWindow.year;

    if (isUpNext) {
      statuses[tournament.id] = {
        label: 'UP NEXT',
        color: '#234d80',
        icon: 'trophy',
      };
      continue;
    }

    statuses[tournament.id] = now >= currentWindow.concludeAt
      ? {
          label: 'LOCKED',
          color: '#be123c',
          icon: 'lock',
        }
      : null;
  }

  return statuses;
}

export function getDefaultTournamentId(
  statuses: Partial<Record<TournamentId, TournamentCardStatus>>,
  now?: Date
) {
  const priority: Array<NonNullable<TournamentCardStatus>['label']> = ['IN PROGRESS', 'ACTIVE', 'UP NEXT'];

  // On the Monday a tournament concludes, keep showing that tournament in standings.
  // Starting Tuesday the normal priority logic takes over (shows upcoming).
  if (now) {
    const todayStart = startOfDay(now);
    const recentlyFinished = TOURNAMENTS.slice().reverse().find((t) => {
      const window = getTournamentEventWindow(t, now.getFullYear());
      return startOfDay(window.concludeAt).getTime() === todayStart.getTime();
    });
    if (recentlyFinished) return recentlyFinished.id;
  }

  for (const label of priority) {
    const match = TOURNAMENTS.find((tournament) => statuses[tournament.id]?.label === label);
    if (match) {
      return match.id;
    }
  }

  return TOURNAMENTS[0].id;
}

export function formatRefresh(value: string | null) {
  if (!value) {
    return 'Waiting for first sync';
  }

  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) {
    return 'Updated just now';
  }
  if (minutes === 1) {
    return 'Updated 1 minute ago';
  }
  return `Updated ${minutes} minutes ago`;
}

export function formatTournamentStartDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(value);
}

export async function readJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}

export function resetViewAfterMainTabChange() {
  if (typeof window === 'undefined') {
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // The app's zoom is fixed, so there's nothing to reset; rewriting the viewport tag there would
  // also briefly drop the notch spacing and make the layout jump.
  if (isNativeApp) {
    return;
  }

  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const createdViewport = !viewport;
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }

  const previousViewport = viewport?.getAttribute('content');

  if (viewport) {
    const targetViewport = viewport;
    targetViewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');

    const settleView = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      if (createdViewport) {
        targetViewport.remove();
      } else if (previousViewport) {
        targetViewport.setAttribute('content', previousViewport);
      }
    };

    window.requestAnimationFrame(() => {
      window.setTimeout(settleView, 80);
    });
  }
}

export function fieldStyle() {
  return {
    width: '100%',
    borderRadius: 14,
    border: '1px solid #d7e0e8',
    padding: '12px 14px',
    fontSize: 16,
    background: '#fff',
  } satisfies CSSProperties;
}

export function formatPointValue(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

// Tied positions keep the T prefix with no ordinal (T7, T21).
// Solo positions get an ordinal suffix (1st, 2nd, 3rd).
export function formatPosition(position: string): string {
  if (!position || position === '--') return position;
  if (position.startsWith('T')) return position; // tied — no suffix
  const num = Number(position);
  if (Number.isNaN(num)) return position; // CUT, WD, DQ, etc.
  return ordinal(position);
}

export function formatLeaderboardPosition(position: string): string {
  if (!position || position === '--') return position;
  if (position.startsWith('T')) return position; // tied — keep as T7, T21, etc.
  const num = Number(position);
  if (Number.isNaN(num)) return position; // CUT, WD, DQ, etc.
  return String(num); // plain number, no ordinal suffix
}

export function ordinal(position: string): string {
  const tie = position.startsWith('T');
  const num = Number(position.replace('T', ''));
  if (Number.isNaN(num)) return position;
  if (tie) return `T${num}`; // tied — no ordinal suffix
  const suffix = num % 100 >= 11 && num % 100 <= 13 ? 'th'
    : num % 10 === 1 ? 'st'
    : num % 10 === 2 ? 'nd'
    : num % 10 === 3 ? 'rd'
    : 'th';
  return `${num}${suffix}`;
}

export function formatTeeTime(teeTimeStr: string): string {
  // ESPN format: "Thu May 14 14:05:00 PDT 2026"
  // ESPN stores times in EDT (UTC-4) but mislabels the timezone as "PDT" (UTC-7).
  // Extract HH:MM directly and subtract 1 hour to convert EDT → CDT.
  const espnMatch = teeTimeStr.match(/(\d{1,2}):(\d{2}):\d{2}/);
  if (espnMatch) {
    let h = parseInt(espnMatch[1], 10);
    const min = parseInt(espnMatch[2], 10);
    h -= 1; // EDT → CDT
    if (h < 0) h += 24;
    const suf = h >= 12 ? 'pm' : 'am';
    const disp = h % 12 || 12;
    const minStr = `:${String(min).padStart(2, '0')}`;
    return `${disp}${minStr} ${suf}`;
  }
  // Fallback for ISO UTC strings
  try {
    const d = new Date(teeTimeStr);
    if (!isNaN(d.getTime())) {
      const result = d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
      });
      return result.replace(' AM', ' am').replace(' PM', ' pm');
    }
  } catch { /* fall through */ }
  return '--';
}

// Returns true if the ESPN tee time string represents a time more than `thresholdMs` in the past.
// ESPN stores times in EDT (UTC-4) regardless of the timezone label in the string.
export function teeTimeIsPast(teeTimeStr: string, thresholdMs = 3 * 60 * 60 * 1000): boolean {
  const MONTHS: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const m = teeTimeStr.match(/\w+ (\w{3}) (\d+) (\d{1,2}):(\d{2}):\d{2} \w+ (\d{4})/);
  if (!m) return false;
  const [, monthName, day, hour, min, year] = m;
  const month = MONTHS[monthName];
  if (!month) return false;
  const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:00-04:00`);
  return !isNaN(d.getTime()) && Date.now() - d.getTime() > thresholdMs;
}

export function formatCurrentRoundScore(value: string | undefined, fallback: string) {
  const candidate = value && value !== '--' ? value : fallback;

  if (!candidate || candidate === '--') {
    return '--';
  }

  if (candidate === 'E' || candidate === 'F' || candidate === 'CUT' || candidate === 'MDF' || candidate === 'WD' || candidate === 'DQ') {
    return candidate;
  }

  const numeric = Number(candidate);
  if (Number.isNaN(numeric)) {
    return candidate;
  }

  if (numeric === 0) {
    return 'E';
  }

  return numeric > 0 ? `+${numeric}` : `${numeric}`;
}

