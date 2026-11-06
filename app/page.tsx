'use client';

// Inside the iPhone app, sends this page's /api calls to the live site (no-op on the web).
import { isNativeApp, settleViewAfterKeyboard } from './native-bridge';

import { Fragment, startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { LeagueGate, LeagueModal, type LeagueSummary } from './league-panel';
import { PaywallModal, type PaywallMode } from './paywall';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { PLAYER_ESPN_IDS } from '@/app/lib/player-espn-ids';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import { canonicalNameKey } from '@/app/lib/name-match';
import { applyNameAlias } from '@/app/lib/name-aliases';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CircleUserRound,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Eye,
  EyeOff,
  Globe,
  History,
  Lock,
  LogIn,
  Mail,
  MoreVertical,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  buildPlaceholderScoreBreakdown,
  SCORING_RULES,
  type GolferScoreBreakdown,
} from './lib/scoring';

const SALARY_CAP = 50000;
const REQUIRED_GOLFERS = 6;

// Total tournament par (course par × 4 rounds). Players and Masters never change.
// Update pga/us-open/open each season as courses rotate.
const TOURNAMENT_TOTAL_PAR: Partial<Record<string, number>> = {
  players: 288,   // TPC Sawgrass, par 72
  masters: 288,   // Augusta National, par 72
  pga: 280,       // Aronimink Golf Club, par 70 (2026)
  'us-open': 280, // Oakmont Country Club, par 70 (2026)
  open: 280,      // Royal Birkdale, par 70 (2026)
};

const TOURNAMENT_ESPN_EVENT_IDS: Partial<Record<string, string>> = {
  players: '401811937',
  masters: '401811941',
  pga: '401811947',
  'us-open': '401811952',
  open: '401811957',
};

const STORAGE_PREFIX = 'golf-pool-live';
const DEFAULT_JOIN_CODE = 'MAJORS2026';
const COMMISSIONER_EMAIL = 'ctuck12@gmail.com';
const COMMISSIONER_DISPLAY_NAME = 'Clayton Tucker';
// Set to true to re-enable the self-serve registration option on the login screen
const REGISTRATION_OPEN = true;
// The original pool: free for life, and home to a few pool-specific touches (contact card, The
// Players history) that other leagues don't get.
const FOUNDER_POOL_ID = 'golf-majors-pool';

const TOURNAMENTS = [
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
    venue: 'Aronimink',
    firstTeeUtc: '2026-05-14T11:20:00Z',
  },
  {
    id: 'us-open',
    name: 'U.S. Open',
    fullName: 'U.S. Open Championship',
    venue: 'Shinnecock Hills',
    firstTeeUtc: '2026-06-18T11:15:00Z',
  },
  {
    id: 'open',
    name: 'The Open',
    fullName: 'The Open Championship',
    venue: 'Royal Birkdale',
    firstTeeUtc: '2026-07-16T05:35:00Z',
  },
] as const;

const TOURNAMENT_LEADERBOARD_HEADER: Record<string, string> = {
  players: 'The Players Leaderboard',
  masters: 'The Masters Leaderboard',
  pga: 'The PGA Leaderboard',
  'us-open': 'U.S. Open Leaderboard',
  open: 'The Open Leaderboard',
};

const TOURNAMENT_CAREER_RESULTS_HEADER: Record<string, string> = {
  players: 'The Players Championship Career Results',
  masters: 'The Masters Career Results',
  pga: 'PGA Championship Career Results',
  'us-open': 'U.S. Open Career Results',
  open: 'The Open Championship Career Results',
};

const PLAYER_FLAGS: Record<string, string> = {
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
const canonicalName = (name: string): string => applyNameAlias(name);

const normFlagName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().trim();
const PLAYER_FLAGS_NORM: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [name, code] of Object.entries(PLAYER_FLAGS)) {
    const k = normFlagName(name);
    if (!(k in m)) m[k] = code; // first (exact-key) wins
  }
  return m;
})();
const lookupFlagCode = (rawName: string): string => { const name = canonicalName(rawName); return PLAYER_FLAGS[name] ?? PLAYER_FLAGS_NORM[normFlagName(name)] ?? ''; };
const getPlayerFlag = (name: string): string => lookupFlagCode(name);
const getFlagSrc = (name: string): string => {
  const code = lookupFlagCode(name);
  if (!code) return '';
  const svgCodes = new Set(['us', 'au', 'ie', 'gb-sct', 'no', 'kr', 'jp', 'za', 'se', 'nz', 'dk', 'de', 'cl', 'co', 'ar', 've', 'be', 'at', 'fr', 'fi', 'cn', 'it', 'in', 'ph', 'fj', 'pr']);
  return `/flags/${svgCodes.has(code) ? code + '.svg' : code + '.png'}`;
};
const FLAG_LABELS: Record<string, string> = { 'us': 'USA', 'gb-eng': 'ENG', 'gb-nir': 'NIR', 'au': 'AUS', 'ie': 'IRL', 'gb-sct': 'SCT', 'no': 'NOR', 'es': 'ESP', 'kr': 'KOR', 'jp': 'JPN', 'za': 'RSA', 'se': 'SWE', 'ca': 'CAN', 'nz': 'NZL', 'dk': 'DEN', 'de': 'GER', 'cl': 'CHI', 'co': 'COL', 'mx': 'MEX', 'ar': 'ARG', 've': 'VEN', 'be': 'BEL', 'at': 'AUT', 'fr': 'FRA', 'gb-wls': 'WAL', 'fi': 'FIN', 'cn': 'CHN', 'it': 'ITA', 'in': 'IND', 'ph': 'PHI', 'fj': 'FIJ', 'pr': 'PRI', 'tw': 'TPE', 'jm': 'JAM', 'th': 'THA', 'is': 'ISL', 'ua': 'UKR', 'nl': 'NED', 'zw': 'ZIM' };
const getCountryLabel = (name: string): string => FLAG_LABELS[lookupFlagCode(name)] ?? '';

const TOURNAMENT_PICKS_HEADER: Record<string, string> = {
  players: 'The Players Picks',
  masters: 'The Masters Picks',
  pga: 'PGA Championship Picks',
  'us-open': 'U.S. Open Picks',
  open: 'The Open Picks',
};

// Heights for the tab logo shown in place of the "<Tournament> Picks" column header
// ([mobile, desktop]) — tuned per logo shape; negative margins keep the row at text height.
const PICKS_HEADER_LOGO_H: Record<string, [number, number]> = {
  players: [30, 39],
  masters: [23, 30],
  pga: [34, 46],
  'us-open': [28, 34],
  open: [30, 37],
};

const TOURNAMENT_ENTRIES_INTRO: Record<string, string> = {
  players: 'Make or edit your picks for The Players Championship below.',
  masters: 'Make or edit your picks for The Masters below.',
  pga: 'Make or edit picks for the PGA Championship below.',
  'us-open': 'Make or edit your picks for the U.S. Open Championship below.',
  open: 'Make or edit picks for The Open Championship below.',
};

const TOURNAMENT_CARD_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/the-players-championship-logo.png',
  masters: '/the-masters-card-logo.png',
  pga: '/pga-frisco-2027-logo.png',
  'us-open': '/us-open-pebble-beach-2027-logo.png',
  open: '/the-open-card-logo.png',
};

const TOURNAMENT_TAB_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/players-tab-logo.webp',
  masters: '/masters-tab-logo.png',
  pga: '/pga-tab-logo.png',
  'us-open': '/us-open-tab-logo.png',
  open: '/open-tab-logo.png',
};

// PGA club professionals (not touring pros) — their bio popup header shows the PGA Championship
// logo + "Club Professional" under the name instead of ranking bubbles.
const PGA_CLUB_PROFESSIONALS = new Set<string>([
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
const TOURNAMENT_EVENT_LOGOS: Partial<Record<string, string>> = {
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
type EventLogoLayout = { mTop: number; mRight: number; mH: number; lTop: number; lRight: number; lH: number; dH: number; dCentered?: boolean };
const DEFAULT_EVENT_LOGO_LAYOUT: EventLogoLayout = { mTop: -10, mRight: 28, mH: 132, lTop: 2, lRight: 72, lH: 206, dH: 140 };
const TOURNAMENT_EVENT_LOGO_LAYOUTS: Partial<Record<string, EventLogoLayout>> = {
  open: { mTop: 14, mRight: 28, mH: 68, lTop: 42, lRight: 72, lH: 106, dH: 72, dCentered: true },
  masters: { mTop: 18, mRight: 28, mH: 38, lTop: 50, lRight: 84, lH: 60, dH: 34, dCentered: true },
  'us-open': { mTop: 13, mRight: 28, mH: 52, lTop: 38, lRight: 84, lH: 84, dH: 52, dCentered: true },
  pga: { mTop: 12, mRight: 18, mH: 102, lTop: 20, lRight: 100, lH: 148, dH: 140, dCentered: true },
  players: { mTop: 12, mRight: 28, mH: 132, lTop: 2, lRight: 150, lH: 180, dH: 140, dCentered: true },
};

function eventLogoStyle(tid: string, isMobile: boolean, isLandscapePhone: boolean): CSSProperties {
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
const CAREER_TAB_LOGO_HEIGHTS: Partial<Record<TournamentId, number>> = {
  players: 39,
  masters: 29,
  pga: 39,
  'us-open': 29,
  open: 30,
};

// Two-tone knockout tab logos for colored popup headers: pre-processed copies of the tab logos
// where everything is white except each tournament's signature element (gold golfer, yellow map +
// red flag, PGA seal, navy OPEN), so they read cleanly on the colored headers without a chip.
const KNOCKOUT_TAB_LOGOS: Partial<Record<TournamentId, string>> = {
  players: '/knockout-players.png',
  masters: '/knockout-masters.png',
  pga: '/knockout-pga.png',
  'us-open': '/knockout-us-open.png',
  open: '/knockout-open.png',
};
const TOURNAMENT_HEADING_LOGOS: Partial<Record<TournamentId, string>> = {
  masters: '/masters-heading-logo.png',
};

const TOURNAMENT_PARS: Partial<Record<TournamentId, number>> = {
  players: 72,
  masters: 72,
  pga: 70,
  'us-open': 70,
  open: 70,
};

const PICK_HISTORY_NAMES: Record<string, string> = {
  players: 'The Players Championship',
  masters: 'The Masters Tournament',
  pga: 'PGA Championship',
  'us-open': 'U.S. Open Championship',
  open: 'The Open Championship',
};

// 12pm EDT on the Friday (Round 2) of each tournament
const TOURNAMENT_CUT_SHOW_AT: Partial<Record<TournamentId, string>> = {
  players: '2026-03-13T12:00:00-04:00',
  masters: '2026-04-10T12:00:00-04:00',
  pga: '2026-05-15T13:00:00-04:00',
  'us-open': '2026-06-19T12:00:00-04:00',
  open: '2026-07-17T10:00:00-04:00', // 9 AM Central — the Open's R2 runs overnight US time, so the cut picture forms much earlier
};

// Approximate first tee time (EDT) on the Saturday (Round 3) of each tournament
const TOURNAMENT_CUT_HIDE_AT: Partial<Record<TournamentId, string>> = {
  players: '2026-03-14T07:30:00-04:00',
  masters: '2026-04-11T08:00:00-04:00',
  pga: '2026-05-16T08:00:00-04:00',
  'us-open': '2026-06-20T07:45:00-04:00',
  open: '2026-07-18T01:35:00-04:00', // ~6:35 AM BST
};

// IANA timezone of each tournament's course (2026 venues) — powers the "Course Time"
// display in the standings card while a round is underway and no projected cut is shown.
const TOURNAMENT_COURSE_TIMEZONES: Record<TournamentId, string> = {
  players: 'America/New_York',   // TPC Sawgrass
  masters: 'America/New_York',   // Augusta National
  pga: 'America/New_York',       // Aronimink
  'us-open': 'America/New_York', // Shinnecock Hills
  open: 'Europe/London',         // Royal Birkdale
};

const TOURNAMENT_TAB_LOGO_HEIGHTS: Partial<Record<TournamentId, number>> = {
  players: 46,
  pga: 46,
};

const TOURNAMENT_CARD_LOGO_SIZES: Partial<Record<TournamentId, { width: number; height: number }>> = {
  players: { width: 78, height: 78 },
  pga: { width: 76, height: 76 },
  'us-open': { width: 76, height: 76 },
  open: { width: 92, height: 92 },
};

const TOURNAMENT_CARD_WIDTH = 124;
const TOURNAMENT_CARD_HEIGHT = 45;

const pgaPhoto = (pgaId: number) =>
  `https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_face:center,h_350,q_auto,w_280/headshots_${pgaId}.png`;

// Colleges OUTSIDE the United States — displayed verbatim (no abbreviation).
const NON_US_COLLEGES = new Set<string>([
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
const COLLEGE_RENAMES: Record<string, string> = {
  'North Carolina-Chapel Hill': 'North Carolina',
};
// For US colleges, drop a leading "University of " or trailing " University"
// (e.g. "University of Arkansas" -> "Arkansas", "McNeese State University" -> "McNeese State").
// Non-US colleges are left exactly as-is.
const formatCollege = (college: string): string => {
  if (NON_US_COLLEGES.has(college)) return college;
  let c = college;
  if (c.endsWith(' University')) c = c.slice(0, -' University'.length);
  else if (c.startsWith('University of ')) c = c.slice('University of '.length);
  return COLLEGE_RENAMES[c] ?? c;
};

// --- Featured-tournament row tints --------------------------------------------------
// Exact background/text colors for the majors + The Players. SHARED by the Season Results
// cards and the win-list popup so both surfaces highlight these events identically.
const MAJOR_TINTS: Record<string, { bg: string; text: string }> = {
  'THE PLAYERS Championship': { bg: '#dce6f5', text: '#173b63' },
  'Masters Tournament':       { bg: '#d5eade', text: '#2c6449' },
  'U.S. Open':                { bg: '#fde8e8', text: '#BE3436' },
  'PGA Championship':         { bg: '#f5edd8', text: '#7a6a3e' },
  'The Open Championship':    { bg: '#dce6f5', text: '#173b63' },
  'The Open':                 { bg: '#dce6f5', text: '#173b63' },
};
// Normalized (case/space-insensitive) index so slightly different name strings still match.
const MAJOR_TINTS_NORM: Record<string, { bg: string; text: string }> = {};
for (const [k, v] of Object.entries(MAJOR_TINTS)) MAJOR_TINTS_NORM[k.toLowerCase().replace(/\s+/g, ' ').trim()] = v;
// Returns { bg, text } for a major / The Players, or null for any other tournament.
// Some win-list entries carry a trailing year (e.g. "Masters Tournament (2021)") to disambiguate
// repeat wins; strip it before matching so those rows still highlight (the year band already shows it).
const majorTint = (tournament: string): { bg: string; text: string } | null => {
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
const isManualPhoto = (photoUrl?: string): photoUrl is string =>
  !!photoUrl && !photoUrl.includes('pga-tour-res.cloudinary.com');
// Players pinned to the PGA Tour photo everywhere (overrides ESPN and any manual photo).
const PGA_PHOTO_ONLY = new Set<string>([
  'Matt Fitzpatrick',
  'Ludvig Aberg',
]);
// Hand-uploaded photos (public/player-photos/) for players PGA/ESPN have no usable headshot for
// (mostly Masters legends). Keyed by name; these ALWAYS win (highest priority) since they were
// chosen deliberately. Matched on a normalized name so accent/spelling variants still resolve.
const MANUAL_PHOTO_FILES: Record<string, string> = {
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
const normPhotoName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();
const MANUAL_PHOTO_BY_NORM: Record<string, string> = {};
for (const [k, v] of Object.entries(MANUAL_PHOTO_FILES)) MANUAL_PHOTO_BY_NORM[normPhotoName(k)] = v;
const playerPhotoSrc = (rawName: string, pgaTourId: number, photoUrl?: string) => {
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
const photoOnError = (e: { currentTarget: HTMLImageElement }) => {
  const img = e.currentTarget;
  if (img.dataset.fellback) return;
  const fb = img.dataset.fb;
  if (fb) { img.dataset.fellback = '1'; img.src = fb; }
};

// Ground-truth header name/flag/abbreviation fitting: shrinks the name to fit the row
// and, if even the minimum size cannot fit with the abbreviation inline, hangs the
// abbreviation below the flag (where allowed) and re-grows the name. Decisions come from
// real DOM measurements — no font/device estimate can cause truncation.
function HeaderNameFlag({ name, flagSrc, abbr, base, min, allowStack, initialStacked }: { name: string; flagSrc: string | null; abbr: string | null; base: number; min: number; allowStack: boolean; initialStacked: boolean }) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(base);
  const [stacked, setStacked] = useState(initialStacked);
  const [, setMeasureTick] = useState(0);
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
function FitOneLineText({ text, base, min, style }: { text: string; base: number; min: number; style?: CSSProperties }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(base);
  const [, setTick] = useState(0);
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
const HEADER_LOGO_WIDTH_EST: Record<TournamentId, number> = { players: 50, masters: 96, pga: 80, 'us-open': 75, open: 64 };
let headerMeasureCtx: CanvasRenderingContext2D | null | undefined;
function fitPopupHeader(name: string, abbr: string | null | undefined | false, popupMaxW: number, padH: number, tournamentId: TournamentId, mobile: boolean, forceInline = false, overlayPad = 40): { fontSize: number; flagH: number; stacked: boolean; shrinkLogo: boolean } {
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

const PLAYER_POOL = PLAYER_POOL_WITH_PGA_IDS;
// Original static world ranks by pool id. The info popup uses THIS as its world-rank fallback so the
// commissioner's uploaded pick-list ranks (which override worldRank on the pick sheet) never change
// what the player info popup shows.
const ORIGINAL_WORLD_RANK_BY_ID = new Map<number, number>(PLAYER_POOL.map((p) => [p.id, p.worldRank]));

// Names too long to fit on one line in the mobile pick list — forced to wrap between first and last name
const MOBILE_TWO_LINE_NAMES = new Set(['Bryson DeChambeau', 'Michael Thorbjornsen', 'Sudarshan Yellamaraju', 'Rasmus Neergaard-Petersen']);

// Custom split points for names where the default "split at last space" gives the wrong break
const MOBILE_CUSTOM_SPLITS: Record<string, [string, string]> = {
  'Rasmus Neergaard-Petersen': ['Rasmus Neergaard-', 'Petersen'],
};

const DEFAULT_ROSTERS: Record<string, number[]> = {
  players: [1, 2, 8, 10, 12, 14],
  masters: [1, 2, 3, 4, 5, 6],
  pga: [1, 3, 5, 8, 10, 11],
  'us-open': [1, 2, 5, 7, 10, 14],
  open: [2, 3, 5, 6, 8, 12],
};

type TournamentId = (typeof TOURNAMENTS)[number]['id'];
type MainTab = 'Standings' | 'My Entries' | 'Details' | 'Reports' | 'Commissioner Hub';
const MAIN_TABS: MainTab[] = ['Standings', 'My Entries', 'Details', 'Reports', 'Commissioner Hub'];

type ReportType = 'Player Pick Summary' | 'Pool Member Pick History' | 'Pool Member Pick Summary' | 'Player Performance Summary' | 'Pool Standings History';
const REPORT_OPTIONS: ReportType[] = ['Player Pick Summary', 'Pool Member Pick History', 'Pool Member Pick Summary', 'Player Performance Summary', 'Pool Standings History'];
const REPORT_TOURNAMENTS: { id: TournamentId; label: string }[] = [
  { id: 'players', label: 'The Players' },
  { id: 'masters', label: 'The Masters' },
  { id: 'pga', label: 'PGA Championship' },
  { id: 'us-open', label: 'U.S. Open' },
  { id: 'open', label: 'The Open' },
];
// Seasons the pool has run (season 1 = 2026). Append new years as future seasons are played.
const POOL_SEASONS = [2026];
// Explicit render heights (px) for the tournament logo shown inside the Reports dropdown box.
// Uses an explicit height (not max-height) so the small source PNGs upscale to fill the box.
const REPORT_DROPDOWN_LOGO_H: Record<TournamentId, number> = { players: 48, masters: 28, pga: 44, 'us-open': 32, open: 34 };
const REPORT_TOURNAMENT_SOLID: Record<TournamentId, string> = {
  players: '#173b63',
  masters: '#2c6449',
  pga: '#B09963',
  'us-open': '#BE3436',
  open: '#173b63',
};
// Sky-blue gradient used for the Player Pick Summary "All tournaments" bars — matches the flag/accent
// lines by the "Golf Majors Pool" logo in the main header (rgb 112,202,220 = #70cadc).
const PPS_ALL_BAR_GRADIENT = 'linear-gradient(135deg, #7fd2e4 0%, #45a7cf 100%)';
const REPORT_TOURNAMENT_CHIP: Record<TournamentId, { short: string; bg: string; fg: string }> = {
  players: { short: 'PLAYERS', bg: '#173b63', fg: '#fff' },
  masters: { short: 'MASTERS', bg: '#2c6449', fg: '#fff' },
  pga: { short: 'PGA', bg: '#B09963', fg: '#fff' },
  'us-open': { short: 'U.S. OPEN', bg: '#BE3436', fg: '#fff' },
  open: { short: 'THE OPEN', bg: '#F4BC41', fg: '#000' },
};
const MAIN_TAB_STORAGE_KEY = `${STORAGE_PREFIX}:main-tab`;

type FeedRow = {
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

type FullFieldPlayer = {
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

type ScorecardHole = { hole: number; par: number; score: number | null; label: string };
type ScorecardRound = { round: number; score?: number | string; holes: ScorecardHole[] };
type ScorecardData = { courseName: string; par: number; rounds: ScorecardRound[]; source: string; message?: string };

type ArchivedGolfer = { name: string; score: string; points: number; position: string; salary: number };
type ArchivedStandingRow = { place: number; name: string; points: number; holesRemaining: number; tieBreak: number; golfers?: ArchivedGolfer[] };
type ArchivedPayouts = { first?: number; second?: number; third?: number };
type ArchivedStandingsData = { available?: boolean; standings?: ArchivedStandingRow[]; payouts?: ArchivedPayouts | null; savedAt?: string | null; error?: string };

type FeedResponse = {
  fetchedAt: string;
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

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  poolIds: string[];
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
};

type PoolInfo = {
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
  commissioners?: { id: string; name: string; email: string }[];
};

type PoolEntry = {
  id: string;
  name: string;
  rosters: Partial<Record<TournamentId, number[]>>;
  tieBreaks: Partial<Record<TournamentId, number>>;
  rosterSubmittedAt?: Partial<Record<TournamentId, string>>;
};

type CommissionerMember = AuthUser;
type AuthMode = 'login' | 'register';

type StandingGolfer = ReturnType<typeof buildPricedPlayers>[number] & {
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

type StandingEntry = PoolEntry & {
  picks: number[];
  golfers: StandingGolfer[];
  rosterPoints: number;
  holesRemaining: number;
  tieBreakValue: number;
  place: number;
};

const STATIC_ENTRIES: PoolEntry[] = [
  { id: 'static-2', name: 'Brady S.', rosters: { pga: [1, 3, 5, 7, 9, 11] }, tieBreaks: {} },
  { id: 'static-3', name: 'Megan T.', rosters: { pga: [2, 4, 6, 8, 12, 13] }, tieBreaks: {} },
  { id: 'static-4', name: 'Ryan H.', rosters: { pga: [3, 4, 5, 9, 10, 14] }, tieBreaks: {} },
];

type SessionPayload = {
  user: AuthUser | null;
  pool: PoolInfo | null;
  entries: PoolEntry[];
  leagues?: LeagueSummary[];
  isAppAdmin?: boolean;
  canCreateLeague?: boolean;
  error?: string;
};

type SessionFlags = { leagues: LeagueSummary[]; isAppAdmin: boolean; canCreateLeague: boolean };
const NO_SESSION_FLAGS: SessionFlags = { leagues: [], isAppAdmin: false, canCreateLeague: false };

type LocalStoredAccount = {
  email: string;
  password: string;
  session: SessionPayload;
};

function buildPricedPlayers(
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

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00f8/gi, 'o').replace(/\u00e5/gi, 'a').replace(/\u00e6/gi, 'ae')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatRosterField(roster: number[] | undefined) {
  return (roster ?? []).join(', ');
}

function parseRosterField(value: string) {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function canAccessCommissionerConsole(user: AuthUser | null) {
  if (!user) {
    return false;
  }

  return user.email.trim().toLowerCase() === COMMISSIONER_EMAIL && user.displayName.trim() === COMMISSIONER_DISPLAY_NAME;
}

function readStoredMainTab() {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.sessionStorage.getItem(MAIN_TAB_STORAGE_KEY);
  return MAIN_TABS.includes(stored as MainTab) ? (stored as MainTab) : null;
}

function writeStoredMainTab(tab: MainTab) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(MAIN_TAB_STORAGE_KEY, tab);
}

function clearStoredMainTab() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(MAIN_TAB_STORAGE_KEY);
}

// Snapshots older than this are discarded so server-side admin changes
// (roster edits, stat overrides) are visible within one TTL window.
const SESSION_SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readStoredSession() {
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

function writeStoredSession(payload: SessionPayload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    `${STORAGE_PREFIX}:session`,
    JSON.stringify({ ...payload, cachedAt: Date.now() }),
  );
}

function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(`${STORAGE_PREFIX}:session`);
}

function readStoredAccounts() {
  if (typeof window === 'undefined') {
    return [] as LocalStoredAccount[];
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:accounts`);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalStoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeStoredAccounts(accounts: LocalStoredAccount[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(`${STORAGE_PREFIX}:accounts`, JSON.stringify(accounts));
}

function upsertStoredAccount(session: SessionPayload, password?: string) {
  if (!session.user) {
    return;
  }

  const accounts = readStoredAccounts();
  const normalizedEmail = session.user.email.trim().toLowerCase();
  const existing = accounts.find((account) => account.email.trim().toLowerCase() === normalizedEmail);

  if (existing) {
    existing.session = session;
    if (password) {
      existing.password = password;
    }
  } else if (password) {
    accounts.push({
      email: session.user.email,
      password,
      session,
    });
  }

  writeStoredAccounts(accounts);
}

function findStoredAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return readStoredAccounts().find(
    (account) => account.email.trim().toLowerCase() === normalizedEmail && account.password === password,
  ) ?? null;
}

function findStoredAccountByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return readStoredAccounts().find((account) => account.email.trim().toLowerCase() === normalizedEmail) ?? null;
}

function readRoster(tournamentId: TournamentId) {
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

function saveGuestRoster(tournamentId: TournamentId, roster: number[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const key = `${STORAGE_PREFIX}:roster:${tournamentId}`;
  window.localStorage.setItem(key, JSON.stringify(roster));
}

function readFeedCache(tournamentId: TournamentId): FeedResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:feed:${tournamentId}`);
    return raw ? (JSON.parse(raw) as FeedResponse) : null;
  } catch {
    return null;
  }
}

function writeFeedCache(tournamentId: TournamentId, data: FeedResponse): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}:feed:${tournamentId}`, JSON.stringify(data));
  } catch {}
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, occurrence: number) {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const offset = (weekday - firstOfMonth.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (occurrence - 1) * 7);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Returns "Round 1" … "Round 4" based on how many days past tournament Thursday we are.
// Transitions happen at midnight CST (UTC-6) each day.
function getCurrentRoundLabel(startDate: Date, now: Date): string {
  const CST_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC-6
  const thuMidnightUtc = startOfDay(startDate).getTime() + CST_OFFSET_MS;
  const dayMs = 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  if (nowMs >= thuMidnightUtc + 3 * dayMs) return 'Round 4';
  if (nowMs >= thuMidnightUtc + 2 * dayMs) return 'Round 3';
  if (nowMs >= thuMidnightUtc + 1 * dayMs) return 'Round 2';
  return 'Round 1';
}

function buildOccurrenceDate(referenceIso: string, year: number, dateOnly: Date) {
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

function getTournamentStartDate(tournamentId: TournamentId, year: number) {
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
let LOCK_TIME_OVERRIDES: Partial<Record<TournamentId, string>> = {};

// Tournaments manually pinned to keep showing their most recent completed results
// (the LOCKED / Final Results leaderboard view) instead of rolling over to next
// season's UP NEXT preview once their year's window has concluded. Remove an entry
// here to let that tournament advance to its next-season pre-tournament view again.
const FORCE_COMPLETED_VIEW: Partial<Record<TournamentId, boolean>> = {};

// Inverse of FORCE_COMPLETED_VIEW: tournaments manually flipped to show their NEXT season's
// pre-tournament (UP NEXT) card right now, instead of their most recent concluded results.
// Add an id (e.g. `masters: true`) to flip that tournament over; remove it to drop back to that
// tournament's results. This does NOT disable the automatic start-time behavior: because the check
// for this map sits BELOW the IN PROGRESS / ACTIVE checks in getTournamentCardStatuses, a forced
// tournament still switches to IN PROGRESS / live standings on its own the moment its next event's
// first-tee time arrives — no manual step needed. After that event concludes it rolls to the
// following season's preview while the flag is set, so clear the flag to reveal that year's results.
const FORCE_PRE_TOURNAMENT_VIEW: Partial<Record<TournamentId, boolean>> = {};
// Commissioner-set (Admin hub) pre-tournament overrides, synced from the
// /api/commissioner/pre-tournament store at boot and whenever the toggle is flipped.
// COMMISSIONER_PRE_TOURNAMENT_VIEW holds the manual value (true = pre-tournament, false = results),
// COMMISSIONER_PRE_TOURNAMENT_AT holds when it was set. A manual value is honored until the next
// automatic reset point (that tournament's next start, or the next Jan 1), after which the view
// falls back to the date-driven default. See shouldShowPreTournamentView below.
let COMMISSIONER_PRE_TOURNAMENT_VIEW: Partial<Record<TournamentId, boolean>> = {};
let COMMISSIONER_PRE_TOURNAMENT_AT: Partial<Record<TournamentId, string>> = {};

// Render a UTC instant as a datetime-local value in Central time, and convert back.
function utcToCentralInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
function centralInputToUtc(input: string): string | null {
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

type TournamentCardStatus = {
  label: 'LOCKED' | 'UP NEXT' | 'ACTIVE' | 'IN PROGRESS';
  color: string;
  icon: 'lock' | 'trophy' | 'check';
} | null;

function getTournamentEventWindow(tournament: (typeof TOURNAMENTS)[number], year: number) {
  const startDate = getTournamentStartDate(tournament.id, year);
  const activeAt = addDays(startOfDay(startDate), -3);
  const overrideIso = LOCK_TIME_OVERRIDES[tournament.id];
  const overrideDate = overrideIso ? new Date(overrideIso) : null;
  // A commissioner-set Pool Lock Time replaces the built-in first-tee time for its year.
  const inProgressAt = overrideDate && overrideDate.getFullYear() === year
    ? overrideDate
    : buildOccurrenceDate(tournament.firstTeeUtc, year, startDate);
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

function getDisplayTournamentWindow(tournament: (typeof TOURNAMENTS)[number], now = new Date()) {
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
function shouldShowPreTournamentView(tournament: (typeof TOURNAMENTS)[number], now: Date): boolean {
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

function getTournamentCardStatuses(now = new Date()) {
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

function getDefaultTournamentId(
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

function formatRefresh(value: string | null) {
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

function formatTournamentStartDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(value);
}

async function readJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}

function resetViewAfterMainTabChange() {
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

function fieldStyle() {
  return {
    width: '100%',
    borderRadius: 14,
    border: '1px solid #d7e0e8',
    padding: '12px 14px',
    fontSize: 16,
    background: '#fff',
  } satisfies CSSProperties;
}

function formatPointValue(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

// Tied positions keep the T prefix with no ordinal (T7, T21).
// Solo positions get an ordinal suffix (1st, 2nd, 3rd).
function formatPosition(position: string): string {
  if (!position || position === '--') return position;
  if (position.startsWith('T')) return position; // tied — no suffix
  const num = Number(position);
  if (Number.isNaN(num)) return position; // CUT, WD, DQ, etc.
  return ordinal(position);
}

function formatLeaderboardPosition(position: string): string {
  if (!position || position === '--') return position;
  if (position.startsWith('T')) return position; // tied — keep as T7, T21, etc.
  const num = Number(position);
  if (Number.isNaN(num)) return position; // CUT, WD, DQ, etc.
  return String(num); // plain number, no ordinal suffix
}

function ordinal(position: string): string {
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

function formatTeeTime(teeTimeStr: string): string {
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
function teeTimeIsPast(teeTimeStr: string, thresholdMs = 3 * 60 * 60 * 1000): boolean {
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

function formatCurrentRoundScore(value: string | undefined, fallback: string) {
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

export default function Page() {
  const initialTournament = getDefaultTournamentId(getTournamentCardStatuses(), new Date());
  const [mainTab, setMainTab] = useState<MainTab>('Standings');
  // Tab the My Entries pick-sheet editor was opened from, so its back button truly goes back.
  const myEntriesReturnTabRef = useRef<MainTab>('My Entries');
  // When returning from a commissioner tool page (?tab=commissioner), reopen the
  // Commissioner Hub tab once the session confirms the user can manage the pool.
  const [pendingCommissionerTab, setPendingCommissionerTab] = useState<boolean>(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'commissioner',
  );
  const [selectedTournament, setSelectedTournament] = useState<TournamentId>(initialTournament);
  const [selectedRoster, setSelectedRoster] = useState<number[]>(DEFAULT_ROSTERS[initialTournament]);
  const [activeStandingEntryId, setActiveStandingEntryId] = useState<string | null>(null);
  const [activeStandingGolferId, setActiveStandingGolferId] = useState<number | null>(null);
  const [scorecardGolferName, setScorecardGolferName] = useState<string | null>(null);
  const [scorecardGolferPhoto, setScorecardGolferPhoto] = useState<{pgaTourId: number; photoUrl?: string} | null>(null);
  const [scorecardGolferTeeTime, setScorecardGolferTeeTime] = useState<string | null>(null);
  const [scorecardGolferThru, setScorecardGolferThru] = useState<string | null>(null);
  const [scorecardGolferBackNineStart, setScorecardGolferBackNineStart] = useState(false);
  const [scorecardData, setScorecardData] = useState<ScorecardData | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [showPreviousRounds, setShowPreviousRounds] = useState(false);
  const [showBonusPoints, setShowBonusPoints] = useState(false);
  const [showTiebreakerRules, setShowTiebreakerRules] = useState(false);
  const [historyPopup, setHistoryPopup] = useState<{ tournament: TournamentId; year: number; loading: boolean; data: ArchivedStandingsData | null } | null>(null);
  // Pool Standings History report — selected tournament, plus the year (defaults to the most recent
  // COMPLETED season: the latest banked season earlier than the current live one, which is shown in
  // Standings — e.g. 2026 now, still 2026 during 2027, 2027 during 2028, and so on).
  const [pshTournament, setPshTournament] = useState<TournamentId | ''>('');
  const [pshYear, setPshYear] = useState<number>(() => {
    const cy = new Date().getFullYear();
    const prior = POOL_SEASONS.filter((y) => y < cy);
    return prior.length ? Math.max(...prior) : Math.max(...POOL_SEASONS);
  });
  const [historyRoster, setHistoryRoster] = useState<ArchivedStandingRow | null>(null);
  const archivedThisSession = useRef<Set<string>>(new Set());
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [reportsMenuRect, setReportsMenuRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  // Player Pick Summary report controls.
  const [ppsTournament, setPpsTournament] = useState<TournamentId | 'all' | ''>('');
  const [ppsSortBy, setPpsSortBy] = useState<'Picked' | 'Salary' | ''>('');
  const [ppsSearch, setPpsSearch] = useState('');
  // Player Pick Summary — "which entries picked this player" popup.
  const [ppsPickPopup, setPpsPickPopup] = useState<{ id: number; name: string; tournament: TournamentId } | null>(null);
  // Player Pick Summary "All" view — per-player popup breaking a player's picks down by major.
  const [ppsAllPlayerPopup, setPpsAllPlayerPopup] = useState<{ id: number; name: string; pgaTourId: number; photoUrl?: string } | null>(null);
  // Season/year selector shared by all reports; defaults to the current (latest) season.
  const [reportYear, setReportYear] = useState<number>(Math.max(...POOL_SEASONS));
  // Pool Member Pick Summary report control.
  const [pmpsEntryId, setPmpsEntryId] = useState<string>('');
  // Pool Member Pick History report control.
  const [pmphEntryId, setPmphEntryId] = useState<string>('');
  // Player Performance Summary report controls.
  const [ppfTournament, setPpfTournament] = useState<TournamentId | ''>('');
  const [ppfSearch, setPpfSearch] = useState('');
  const [ppfSortKey, setPpfSortKey] = useState<'finish' | 'par' | 'birdie' | 'eagle' | 'bogey' | 'double' | 'triple'>('finish');
  const [ppfSortDir, setPpfSortDir] = useState<'asc' | 'desc'>('asc');
  const [ppfSelectedRow, setPpfSelectedRow] = useState<string | null>(null);
  const ppfScrollRef = useRef<HTMLDivElement | null>(null);
  // Anchor at the top of the report card, so changing a selection snaps back to the report's top.
  const reportTopRef = useRef<HTMLDivElement | null>(null);
  const [ppfViewportW, setPpfViewportW] = useState(0);
  const [expandedBonusCategories, setExpandedBonusCategories] = useState<Set<string>>(new Set());
  const [bonusInfoPopup, setBonusInfoPopup] = useState<{ title: string; entries: { name: string; rounds: number[]; count?: number }[]; showCounts?: boolean } | null>(null);
  const [cutScorecardGolfer, setCutScorecardGolfer] = useState<{ name: string; pgaTourId: number; photoUrl?: string } | null>(null);
  const [cutScorecardData, setCutScorecardData] = useState<ScorecardData | null>(null);
  const [cutScorecardLoading, setCutScorecardLoading] = useState(false);
  const entryBreakdownRef = useRef<HTMLDivElement>(null);
  const [showPointsSystem, setShowPointsSystem] = useState(false);
  const [selectedLeaderboardPlayerId, setSelectedLeaderboardPlayerId] = useState<number | null>(null);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<'picked' | 'full'>('full');
  const [fullLeaderboardRows, setFullLeaderboardRows] = useState<Partial<Record<TournamentId, FullFieldPlayer[]>>>({});
  const [pickHistoryPlayerPopup, setPickHistoryPlayerPopup] = useState<{
    player: { id: number; name: string; pgaTourId: number; photoUrl?: string; worldRank?: number };
    results: Partial<Record<TournamentId, { position: string; score: string } | null>>;
    loading: boolean;
    fedexRank: number | null;
    dpWorldRank: number | null;
    owgrRank: number | null;
    fullResults: { tournament: string; date: string; course: string; position: string; tour: 'pga' | 'liv' | 'eur' }[] | null;
    fullResultsLoading: boolean;
    careerResults: { year: number; course: string; position: string }[] | null;
    careerResultsLoading: boolean;
    playerStats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null;
    playerSeasonStats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null;
    playerStatsLoading: boolean;
    playerRounds: { round: number; score: string }[] | null;
    statsContext: 'season' | 'tournament';
    // Tournament this popup was opened in the context of (a Pick History section's event,
    // else the selected tournament) — drives the stats context and the career tab.
    ctxTournamentId: TournamentId;
    defaultTab: 'stats' | 'season';
    statAverages: Record<string, string>;
    fieldAverages: Record<string, string>;
    statRanks: Record<string, string>;
    seasonStatRanks: Record<string, string>;
    fieldDistributions: Record<string, number[]>;
    playerBio: { height: string | null; weight: string | null; dob: string | null; age: number | null; birthPlace: string | null; college: string | null; collegeConfirmedAbsent: boolean; swing: string | null; turnedPro: number | null; pgaTourDebut: number | null; careerStarts: number | null; cutsMade: number | null; careerWins: number | null; majorStarts: number | null; majorCutsMade: number | null; majorWins: number | null; careerEarnings: string | null; pgaTourWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; majorWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null } | null;
    playerBioLoading: boolean;
    espnPhotoUrl: string | null;
    pgaPhotoUrl: string | null;
    tournamentStatsFetchedAt: string | null;
    seasonStatsFetchedAt: string | null;
    bioFetchedAt: string | null;
    rankingsChangedAt: string | null;
  } | null>(null);
  // Click-through popup listing each win (tournament + year) behind a player's Wins count.
  const [winsListPopup, setWinsListPopup] = useState<{ title: string; playerName: string; wins: { tournament: string; year: string; course: string | null; toPar: string | null }[] } | null>(null);
  const [pickHistoryView, setPickHistoryView] = useState<'stats' | 'season' | 'career' | 'bio'>('stats');
  const [statsSubView, setStatsSubView] = useState<'tournament' | 'season'>('tournament');
  const [statLeaderboardModal, setStatLeaderboardModal] = useState<{ label: string; statKey: string; subtitle: string; tourAvg: string | null; avgLabel?: string; playerName: string | null; entries: { rank: number; name: string; value: string }[] | null } | null>(null);
  const [statLbSearch, setStatLbSearch] = useState('');
  const [visualVpHeight, setVisualVpHeight] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handler = () => setVisualVpHeight(vv.height);
    vv.addEventListener('resize', handler);
    handler();
    return () => vv.removeEventListener('resize', handler);
  }, []);
  useEffect(() => {
    if (!pickHistoryPlayerPopup) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [pickHistoryPlayerPopup]);
  const [expandedCutIds, setExpandedCutIds] = useState<Set<string>>(new Set());
  const expandedCutTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [leaderboardSortMode, setLeaderboardSortMode] = useState<'default' | 'round-desc' | 'round-asc'>('default');
  const [leaderboardPickedSort, setLeaderboardPickedSort] = useState<'default' | 'desc' | 'asc'>('default');
  const [showCutInfo, setShowCutInfo] = useState(false);
  const [showHeaderCutInfo, setShowHeaderCutInfo] = useState(false);
  const [feeds, setFeeds] = useState<Partial<Record<TournamentId, FeedResponse>>>(() => {
    const initial: Partial<Record<TournamentId, FeedResponse>> = {};
    for (const t of TOURNAMENTS) {
      const cached = readFeedCache(t.id);
      if (cached) initial[t.id] = cached;
    }
    return initial;
  });
  const [isLoading, setIsLoading] = useState(() => readFeedCache(initialTournament) === null);
  const [error, setError] = useState('');
  const [feedRefreshNonce, setFeedRefreshNonce] = useState(0);
  const feed = feeds[selectedTournament] ?? null;
  const currentFullLeaderboardRows = fullLeaderboardRows[selectedTournament] ?? null;
  const [commissionerMembersRefreshNonce, setCommissionerMembersRefreshNonce] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  useEffect(() => {
    if (saveMessage === 'Lineup saved to your account for this tournament.') {
      const t = setTimeout(() => setSaveMessage(''), 5000);
      return () => clearTimeout(t);
    }
  }, [saveMessage]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Commissioner-set pool lock times (mirrors the module-level map so changes re-render).
  const [lockTimeOverrides, setLockTimeOverridesState] = useState<Partial<Record<TournamentId, string>>>({});
  useEffect(() => {
    fetch('/api/commissioner/lock-time', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { overrides?: Partial<Record<TournamentId, string>> }) => {
        if (d.overrides) { LOCK_TIME_OVERRIDES = d.overrides; setLockTimeOverridesState(d.overrides); }
      })
      .catch(() => { /* keep the built-in schedule */ });
  }, []);
  // Commissioner "show pre-tournament card" overrides, synced from the store at boot. The state
  // mirror only exists to force a re-render; the module-level maps above are what the status logic reads.
  const [preTournamentTick, setPreTournamentTick] = useState(0);
  const [preTournamentBusy, setPreTournamentBusy] = useState<TournamentId | null>(null);
  useEffect(() => {
    fetch('/api/commissioner/pre-tournament', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { overrides?: Partial<Record<TournamentId, boolean>>; manualAt?: Partial<Record<TournamentId, string>> }) => {
        if (d.overrides) COMMISSIONER_PRE_TOURNAMENT_VIEW = d.overrides;
        if (d.manualAt) COMMISSIONER_PRE_TOURNAMENT_AT = d.manualAt;
        setPreTournamentTick((v) => v + 1);
      })
      .catch(() => { /* keep the built-in schedule */ });
  }, []);
  const savePreTournamentOverride = async (tournamentId: TournamentId, show: boolean) => {
    setPreTournamentBusy(tournamentId);
    try {
      const res = await fetch('/api/commissioner/pre-tournament', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId, show }) });
      const d = await res.json();
      if (res.ok && d.overrides) {
        COMMISSIONER_PRE_TOURNAMENT_VIEW = d.overrides;
        COMMISSIONER_PRE_TOURNAMENT_AT = d.manualAt ?? {};
        setPreTournamentTick((v) => v + 1);
        setNowTick(window.performance.timeOrigin + window.performance.now());
      }
    } catch { /* ignore; leave prior state */ }
    finally { setPreTournamentBusy(null); }
  };
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [sessionFlags, setSessionFlags] = useState<SessionFlags>(NO_SESSION_FLAGS);
  const [leagueModalOpen, setLeagueModalOpen] = useState(false);
  const [paywallMode, setPaywallMode] = useState<PaywallMode | null>(null);
  // A league code from an invite link (/?join=CODE), kept until the user joins or dismisses it.
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailExists, setForgotEmailExists] = useState(false);
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  // A password reset email links to /?reset=<token>: open the reset popup straight to the
  // new-password step, and drop the token from the address bar so it isn't left in history.
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('reset');
    if (!token) return;
    url.searchParams.delete('reset');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    setResetToken(token);
    setForgotOpen(true);
    setForgotEmailExists(true);
    setForgotNewPassword('');
    setForgotMessage('');
  }, []);
  const [registerForm, setRegisterForm] = useState({
    displayName: '',
    email: '',
    password: '',
    joinCode: '',
  });

  // Invite links look like /?join=CODE: signed out, it opens sign-up with the code filled in;
  // signed in, it opens the Leagues panel ready to join. The code is dropped from the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('join');
    if (!code) return;
    url.searchParams.delete('join');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    const normalized = code.trim().toUpperCase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingJoinCode(normalized);
    setRegisterForm((form) => ({ ...form, joinCode: normalized }));
    setAuthMode('register');
  }, []);
  const [commissionerMembers, setCommissionerMembers] = useState<CommissionerMember[]>([]);
  // Member id whose submitted roster is shown in the commissioner-hub roster popup.
  const [submittedRosterMemberId, setSubmittedRosterMemberId] = useState<string | null>(null);
  // Pick Popularity breakdown (commissioner hub) — collapsed by default.
  const [pickPopularityOpen, setPickPopularityOpen] = useState(false);
  // Player whose "picked by" entry list is shown in a popup (from the Pick Popularity rows).
  const [pickPopularityPlayer, setPickPopularityPlayer] = useState<{ id: number; name: string } | null>(null);
  // Pool Lock Time tool (commissioner hub): modal + datetime-local input in Central time.
  const [poolLockModalOpen, setPoolLockModalOpen] = useState(false);
  const [poolLockInput, setPoolLockInput] = useState('');
  const [poolLockBusy, setPoolLockBusy] = useState(false);
  const [poolLockMsg, setPoolLockMsg] = useState('');
  const poolLockMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePoolLockTime = async (clear: boolean) => {
    const iso = clear ? null : centralInputToUtc(poolLockInput);
    if (!clear && !iso) { setPoolLockMsg('Enter a valid date & time.'); return; }
    setPoolLockBusy(true); setPoolLockMsg('');
    try {
      const res = await fetch('/api/commissioner/lock-time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId: entriesTournamentId, lockAtUtc: iso }) });
      const d = await res.json();
      if (!res.ok) { setPoolLockMsg(d.error ?? 'Save failed.'); }
      else {
        const next: Partial<Record<TournamentId, string>> = d.overrides ?? {};
        LOCK_TIME_OVERRIDES = next;
        setLockTimeOverridesState(next);
        setPoolLockMsg(clear
          ? 'Cleared — using the automatic schedule again.'
          : `Saved — pool locks & goes live ${new Date(iso!).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} CST.`);
        // Success confirmations fade out on their own; errors stay until addressed.
        if (poolLockMsgTimer.current) clearTimeout(poolLockMsgTimer.current);
        poolLockMsgTimer.current = setTimeout(() => setPoolLockMsg(''), 4000);
      }
    } catch { setPoolLockMsg('Network error — try again.'); }
    setPoolLockBusy(false);
  };
  // Commissioner-hub Submitted Picks column ordering (A-Z default, or newest first).
  const [commissionerPicksSort, setCommissionerPicksSort] = useState<'alpha' | 'newest'>('alpha');
  // Where to land after editing picks opened from the submitted-roster popup: restore the
  // console view and reopen the popup (showing the updated roster) on back or save.
  const commissionerEditReturnRef = useRef<{ view: 'dashboard' | 'members' | 'member-picks'; memberId: string } | null>(null);
  const [commissionerBusy, setCommissionerBusy] = useState(false);
  const [commissionerError, setCommissionerError] = useState('');
  const [commissionerSuccess, setCommissionerSuccess] = useState('');
  const [commissionerConsoleView, setCommissionerConsoleView] = useState<'dashboard' | 'members' | 'member-picks'>('dashboard');
  const [commissionerMemberSearch, setCommissionerMemberSearch] = useState('');
  const [commissionerMemberSort, setCommissionerMemberSort] = useState<{ column: 'displayName' | 'email' | 'tournamentCount'; direction: 'asc' | 'desc' }>({ column: 'displayName', direction: 'asc' });
  const [entriesPlayerSearch, setEntriesPlayerSearch] = useState('');
  const [tieBreakInput, setTieBreakInput] = useState('');
  const [showRosterConfirm, setShowRosterConfirm] = useState(false);
  // Brief "Roster successfully submitted!" flash shown between Submit & Pay and the Venmo handoff.
  const [showSubmitToast, setShowSubmitToast] = useState(false);
  const [showSubmittedPicksPopup, setShowSubmittedPicksPopup] = useState(false);
  // Submitted Picks popup ordering: alphabetical by default, or newest submission first.
  const [submittedPicksSort, setSubmittedPicksSort] = useState<'alpha' | 'newest'>('alpha');
  const [commissionerPlayerSearch, setCommissionerPlayerSearch] = useState('');
  const [commissionerMemberModalOpen, setCommissionerMemberModalOpen] = useState(false);
  const [commissionerMemberModalView, setCommissionerMemberModalView] = useState<'menu' | 'displayName' | 'email' | 'confirmDelete' | 'confirmClearPicks'>('menu');
  const [commissionerRosterMemberId, setCommissionerRosterMemberId] = useState<string | null>(null);
  const [commissionerRosterSelection, setCommissionerRosterSelection] = useState<number[]>([]);
  const [commissionerTieBreakInput, setCommissionerTieBreakInput] = useState('');
  const [payoutForm, setPayoutForm] = useState({
    first: '',
    second: '',
    third: '',
  });
  const [winnerScoreInput, setWinnerScoreInput] = useState('');
  const [clearLeaderBusy, setClearLeaderBusy] = useState(false);
  const [clearLeaderMsg, setClearLeaderMsg] = useState<string | null>(null);
  // Pool management tools: which tool modal is open, and a generic confirm/cancel modal on top of it.
  const [poolToolModal, setPoolToolModal] = useState<null | 'payouts' | 'tiebreak' | 'roundLeader' | 'markStatus'>(null);
  const [poolToolConfirm, setPoolToolConfirm] = useState<null | { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }>(null);
  const [playerStatusInput, setPlayerStatusInput] = useState('');
  const [playerStatusBusy, setPlayerStatusBusy] = useState(false);
  const [playerStatusMsg, setPlayerStatusMsg] = useState<string | null>(null);
  const [selectedCommissionerMemberId, setSelectedCommissionerMemberId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountPreferencesView, setAccountPreferencesView] = useState<'root' | 'preferences' | 'password' | 'displayName'>('root');
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [accountDisplayName, setAccountDisplayName] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [myEntriesEditorOpen, setMyEntriesEditorOpen] = useState(false);
  const pickSheetOpenRef = useRef(false);
  const standingsColRef = useRef<HTMLElement>(null);
  const leaderboardColRef = useRef<HTMLElement>(null);
  const [myEntriesMenuOpen, setMyEntriesMenuOpen] = useState(false);
  const [myEntriesDetailView, setMyEntriesDetailView] = useState<'none' | 'history' | 'rename'>('none');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [memberCreateForm, setMemberCreateForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [memberEditForm, setMemberEditForm] = useState({
    displayName: '',
    email: '',
    password: '',
    rosters: {
      players: '',
      masters: '',
      pga: '',
      'us-open': '',
      open: '',
    } as Record<TournamentId, string>,
  });

  const [isMobile, setIsMobile] = useState(false);
  const [isSmallMobile, setIsSmallMobile] = useState(false);
  const [landscapeZoom, setLandscapeZoom] = useState(1);
  const [isLandscapePhone, setIsLandscapePhone] = useState(false);

  useLayoutEffect(() => {
    const right = leaderboardColRef.current;
    if (!right) return;
    if (isMobile) {
      right.style.height = '';
      right.style.maxHeight = '';
      return;
    }
    const left = standingsColRef.current;
    if (!left) return;
    const cap = `${left.offsetHeight}px`;
    if (leaderboardSearch) {
      right.style.height = 'auto';
      right.style.maxHeight = cap;
    } else {
      right.style.height = cap;
      right.style.maxHeight = '';
    }
  });

  const tournament = TOURNAMENTS.find((item) => item.id === selectedTournament) ?? TOURNAMENTS[0];
  // The app admin runs the app-wide tools for every league; a league's commissioners run its league
  // tools (members, picks open/lock, payouts, tiebreak).
  const isAppAdmin = sessionFlags.isAppAdmin || canAccessCommissionerConsole(sessionUser);
  const canManagePool = isAppAdmin || pool?.role === 'commissioner';
  const isFounderPool = pool?.id === FOUNDER_POOL_ID;

  useEffect(() => {
    if (sessionUser && pool && pendingJoinCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeagueModalOpen(true);
    }
  }, [sessionUser, pool, pendingJoinCode]);
  const tournamentCardStatuses = getTournamentCardStatuses(new Date(nowTick));
  // Reports privacy gate: another member's picks for a tournament are only revealed once that
  // tournament has actually started (its status is IN PROGRESS) or concluded (LOCKED). While it's
  // sitting in its pre-tournament / upcoming window (UP NEXT / ACTIVE / future), picks stay hidden.
  const picksRevealed = (tid: TournamentId): boolean => {
    const label = tournamentCardStatuses[tid]?.label;
    return label === 'IN PROGRESS' || label === 'LOCKED';
  };
  // Year-aware reveal for the Reports tab: a tournament's picks are visible whenever that
  // tournament's event FOR THE SELECTED REPORT YEAR has already begun (or concluded). Past
  // seasons are always reviewable; only tournaments that haven't started yet stay hidden. This
  // is intentionally independent of the live standings card (which may be flipped to a future
  // season's pre-tournament preview) so concluded results never get hidden behind that preview.
  const picksRevealedForYear = (tid: TournamentId, year: number): boolean => {
    const tournament = TOURNAMENTS.find((t) => t.id === tid);
    if (!tournament) return false;
    return new Date(nowTick) >= getTournamentEventWindow(tournament, year).inProgressAt;
  };
  const selectedTournamentStatus = tournamentCardStatuses[selectedTournament];
  const entriesTournamentId = getDefaultTournamentId(tournamentCardStatuses, new Date());
  const careerTournamentId = pickHistoryPlayerPopup?.ctxTournamentId ?? selectedTournament;
  const entriesTournament = TOURNAMENTS.find((item) => item.id === entriesTournamentId) ?? TOURNAMENTS[0];
  const entriesTournamentStatus = tournamentCardStatuses[entriesTournamentId];
  // Picks are open when the commissioner's toggle is on AND the event is in the pre-tournament/live
  // window (UP NEXT once the field is finalized, ACTIVE, or an unknown/null status) — the toggle is the
  // control, not the auto-computed status, so opening picks during UP NEXT works as intended.
  const entriesPicksOpenForTournament =
    (entriesTournamentStatus?.label === 'ACTIVE' || entriesTournamentStatus?.label === 'UP NEXT' || entriesTournamentStatus == null) &&
    pool?.picksOpen?.[entriesTournamentId] === true;
  // Show the "field being finalized" pre-view whenever picks aren't open; once the commissioner opens
  // them, show the actual pick sheet.
  const entriesPreFieldView = !entriesPicksOpenForTournament;
  // Locked when: the commissioner's manual toggle is ON, the event is live, OR the pool lock
  // time (manual override or built-in) has passed. A stored `false` from a past toggle must
  // NOT suppress the time-based lock (`?? ` did exactly that and let edits through post-lock).
  const entriesLockAtIso = lockTimeOverrides[entriesTournamentId] ?? TOURNAMENT_META[entriesTournamentId]?.lockAtUtc;
  const entriesLocked =
    pool?.lineupLocks?.[entriesTournamentId] === true ||
    entriesTournamentStatus?.label === 'IN PROGRESS' ||
    (!!entriesLockAtIso && nowTick >= new Date(entriesLockAtIso).getTime());
  const selectedTournamentPayouts = pool?.payouts?.[selectedTournament] ?? null;
  const commissionerTournamentPayouts = pool?.payouts?.[entriesTournamentId] ?? null;
  const commissionerTournamentWinnerScore = pool?.winnerScores?.[entriesTournamentId] ?? null;
  const commissionerTournamentLabel =
    entriesTournamentId === 'players' ? 'The Players Championship' :
    entriesTournamentId === 'masters' ? 'The Masters Tournament' :
    entriesTournamentId === 'pga' ? 'The PGA Championship' :
    entriesTournamentId === 'us-open' ? 'U.S. Open Championship' :
    entriesTournamentId === 'open' ? 'The Open Championship' :
    entriesTournament.name;
  const commissionerAutoWinner = feed?.tournamentComplete === true ? (feed?.players ?? []).find((p) => p.position === '1' && p.thru === 'F') : null;
  const commissionerAutoWinnerTotal = commissionerAutoWinner?.total && commissionerAutoWinner.total !== '--' ? parseInt(commissionerAutoWinner.total, 10) : NaN;
  const commissionerAutoDetected = !isNaN(commissionerAutoWinnerTotal) ? commissionerAutoWinnerTotal : null;
  const tiebreakResolved = commissionerAutoDetected ?? commissionerTournamentWinnerScore;
  const entriesTournamentCourseName =
    entriesTournamentId === 'players'
      ? 'TPC Sawgrass'
      : entriesTournamentId === 'masters'
        ? 'Augusta National Golf Club'
        : entriesTournamentId === 'pga'
          ? 'Aronimink Golf Club'
          : entriesTournamentId === 'us-open'
            ? 'Shinnecock Hills Golf Club'
            : 'Royal Birkdale Golf Club';
  const entriesTournamentPar = TOURNAMENT_PARS[entriesTournamentId];

  const restoreServerSessionFromStoredAccount = async (storedAccount: LocalStoredAccount) => {
    try {
      return await readJson<SessionPayload>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: storedAccount.email,
          password: storedAccount.password,
        }),
      });
    } catch (loginError) {
      const fallbackUser = storedAccount.session.user;

      if (!fallbackUser) {
        throw loginError;
      }

      const registered = await readJson<SessionPayload>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: fallbackUser.displayName,
          email: storedAccount.email,
          password: storedAccount.password,
        }),
      });

      let latestSession = registered;

      for (const tournamentId of TOURNAMENTS.map((item) => item.id)) {
        const roster = fallbackUser.rosters[tournamentId] ?? [];

        if (roster.length > 0) {
          latestSession = await readJson<SessionPayload & { roster: number[] }>('/api/roster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournamentId, roster }),
          });
        }
      }

      return latestSession;
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      // Inside the iPhone app, WebKit can report a desktop-sized width (980) while the page first
      // loads and never sends a resize afterwards, which left phones on the desktop layout. The
      // app is portrait-only on iPhone, so the screen width is a safe cap there. The website is unchanged.
      const w = isNativeApp ? Math.min(window.innerWidth, window.screen.width || window.innerWidth) : window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < 640);
      setIsSmallMobile(w < 415);
      // Scale down the desktop layout on landscape phones so everything fits proportionally.
      // Target effective content width: 1050px. Clamp zoom to [0.72, 1].
      // The iPhone app is portrait-only (iPads aren't phones), so this website scaling never applies there.
      const isLandscapePhone = !isNativeApp && h < 500 && w < 1100 && navigator.maxTouchPoints > 0;
      setIsLandscapePhone(isLandscapePhone);
      setLandscapeZoom(isLandscapePhone ? Math.max(0.72, Math.min(1, w / 1100)) : 1);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    // Re-check once the page has settled, and whenever the visible area changes size.
    window.addEventListener('load', checkMobile);
    const settle = window.setTimeout(checkMobile, 300);
    window.visualViewport?.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
      window.removeEventListener('load', checkMobile);
      window.clearTimeout(settle);
      window.visualViewport?.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Reload PWA when a new deployment is detected after backgrounding for 2+ minutes.
  useEffect(() => {
    let currentVersion: string | null = null;
    let hiddenAt: number | null = null;
    const MIN_HIDDEN_MS = 2 * 60 * 1000;

    fetch('/api/version').then(r => r.json()).then((d: { v?: string }) => {
      currentVersion = d.v ?? null;
    }).catch(() => {});

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null && Date.now() - hiddenAt > MIN_HIDDEN_MS) {
        hiddenAt = null;
        fetch('/api/version').then(r => r.json()).then((d: { v?: string }) => {
          if (currentVersion && d.v && d.v !== currentVersion) {
            window.location.reload();
          }
        }).catch(() => {});
      } else {
        hiddenAt = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const svgCodes = new Set(['us','au','ie','gb-sct','no','kr','jp','za','se','nz','dk','de','cl','co','ar','ve','be','at','fr','fi','cn','it','in','ph','fj','pr']);
    const usedCodes = [...new Set(Object.values(PLAYER_FLAGS))];
    usedCodes.forEach(code => {
      const img = new window.Image();
      img.src = `/flags/${svgCodes.has(code) ? code + '.svg' : code + '.png'}`;
    });
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      setSessionLoading(true);
      const storedSnapshot = readStoredSession();

      if (storedSnapshot?.user) {
        setSessionUser(storedSnapshot.user);
        setPool(storedSnapshot.pool);
        setPoolEntries(storedSnapshot.entries);
      }

      try {
        const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });
        if (payload.user) {
          setSessionUser(payload.user);
          setPool(payload.pool);
          setPoolEntries(payload.entries);
          writeStoredSession(payload);
          upsertStoredAccount(payload);
        } else {
          const stored = readStoredSession();
          const storedAccount = stored?.user ? findStoredAccountByEmail(stored.user.email) : null;

          if (storedAccount) {
            const restored = await restoreServerSessionFromStoredAccount(storedAccount);
            setSessionUser(restored.user);
            setPool(restored.pool);
            setPoolEntries(restored.entries);
            writeStoredSession(restored);
            upsertStoredAccount(restored, storedAccount.password);
          } else {
            setSessionUser(null);
            setPool(null);
            setPoolEntries([]);
            clearStoredSession();
          }
        }
      } catch {
        const stored = readStoredSession();
        const storedAccount = stored?.user ? findStoredAccountByEmail(stored.user.email) : null;

        if (storedAccount) {
          try {
            const restored = await restoreServerSessionFromStoredAccount(storedAccount);
            setSessionUser(restored.user);
            setPool(restored.pool);
            setPoolEntries(restored.entries);
            writeStoredSession(restored);
            upsertStoredAccount(restored, storedAccount.password);
          } catch {
            setSessionUser(null);
            setPool(null);
            setPoolEntries([]);
            clearStoredSession();
          }
        } else {
          setSessionUser(null);
          setPool(null);
          setPoolEntries([]);
        }
      } finally {
        setSessionLoading(false);
      }
    };

    const silentRefresh = async () => {
      if (pickSheetOpenRef.current) return;
      try {
        const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });
        if (payload.user) {
          setSessionUser(payload.user);
          setPool(payload.pool);
          setPoolEntries(payload.entries);
          writeStoredSession(payload);
        }
      } catch {
        // silent — don't disrupt the UI on background refresh
      }
    };

    void loadSession();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void silentRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const refreshTimer = window.setInterval(() => void silentRefresh(), 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    pickSheetOpenRef.current = myEntriesEditorOpen || !!commissionerRosterMemberId;
  }, [myEntriesEditorOpen, commissionerRosterMemberId]);

  useEffect(() => {
    // Keep the search box reset when the pick sheet closes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!myEntriesEditorOpen) setEntriesPlayerSearch('');
  }, [myEntriesEditorOpen]);

  useEffect(() => {
    // Keep the commissioner roster search reset when its editor closes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!commissionerRosterMemberId) setCommissionerPlayerSearch('');
  }, [commissionerRosterMemberId]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (sessionUser) {
      writeStoredSession({
        user: sessionUser,
        pool,
        entries: poolEntries,
      });
      return;
    }

    clearStoredSession();
  }, [pool, poolEntries, sessionLoading, sessionUser]);

  useEffect(() => {
    if (sessionUser) {
      // Sync the editor with the active user/tournament.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRoster(sessionUser.rosters[entriesTournamentId] ?? DEFAULT_ROSTERS[entriesTournamentId]);
      return;
    }

    // Sync the guest editor with the active tournament.
    setSelectedRoster(readRoster(entriesTournamentId));
  }, [entriesTournamentId, sessionUser]);

  useEffect(() => {
    if (!sessionUser) {
      saveGuestRoster(entriesTournamentId, selectedRoster);
    }
  }, [entriesTournamentId, selectedRoster, sessionUser]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Don't bounce during the initial session load — the layout effect below may
    // legitimately open the hub before the session has finished confirming access.
    if (mainTab === 'Commissioner Hub' && !canManagePool && !sessionLoading) {
      // Push unauthorized users back to the public standings tab.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMainTab('Standings');
    }
  }, [canManagePool, mainTab, sessionLoading]);

  useLayoutEffect(() => {
    // Returning from a commissioner tool page (?tab=commissioner): if the stored
    // session already shows a commissioner, switch to the hub *before* the browser
    // paints so the Standings tab never flashes.
    if (!pendingCommissionerTab) return;
    let isCommish = false;
    try {
      const snap = readStoredSession();
      isCommish = !!snap?.user && (canAccessCommissionerConsole(snap.user) || snap.pool?.role === 'commissioner');
    } catch { isCommish = false; }
    if (!isCommish) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMainTab('Commissioner Hub');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingCommissionerTab(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingCommissionerTab || sessionLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingCommissionerTab(false);
    if (canManagePool) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMainTab('Commissioner Hub');
      setCommissionerConsoleView('dashboard');
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [pendingCommissionerTab, sessionLoading, canManagePool]);

  useEffect(() => {
    // Mirror the selected tournament payout into the editable form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayoutForm({
      first: commissionerTournamentPayouts?.first ? String(commissionerTournamentPayouts.first) : '',
      second: commissionerTournamentPayouts?.second ? String(commissionerTournamentPayouts.second) : '',
      third: commissionerTournamentPayouts?.third ? String(commissionerTournamentPayouts.third) : '',
    });
  }, [commissionerTournamentPayouts?.first, commissionerTournamentPayouts?.second, commissionerTournamentPayouts?.third]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWinnerScoreInput(commissionerTournamentWinnerScore != null ? String(commissionerTournamentWinnerScore) : '');
  }, [commissionerTournamentWinnerScore]);

  useEffect(() => {
    let active = true;

    // Show cached tournaments immediately and only display loading when no cache exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(readFeedCache(selectedTournament) === null);

    const loadFeed = async () => {
      if (!readFeedCache(selectedTournament)) {
        setIsLoading(true);
      }
      setError('');

      try {
        const payload = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}`, {
          cache: 'no-store',
        });

        if (active) {
          setFeeds(prev => ({ ...prev, [selectedTournament]: payload }));
          writeFeedCache(selectedTournament, payload);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load leaderboard.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadFeed();
    const timer = window.setInterval(() => {
      void loadFeed();
    }, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [feedRefreshNonce, selectedTournament]);

  // Silently prefetch all other tournament feeds on mount so tab switches are instant
  useEffect(() => {
    for (const t of TOURNAMENTS) {
      if (readFeedCache(t.id)) continue;
      readJson<FeedResponse>(`/api/leaderboard?tournamentId=${t.id}`, { cache: 'no-store' })
        .then((payload) => {
          setFeeds(prev => ({ ...prev, [t.id]: payload }));
          writeFeedCache(t.id, payload);
        })
        .catch(() => { /* non-critical */ });
    }
  }, []);

  useEffect(() => {
    // Collapse temporary projected-cut affordances when switching context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedCutIds(new Set());
    expandedCutTimersRef.current.forEach((t) => clearTimeout(t));
    expandedCutTimersRef.current.clear();
  }, [selectedTournament, mainTab]);

  useEffect(() => {
    const fetchFull = () => {
      readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}&fullField=true`, { cache: 'no-store' })
        .then((data) => setFullLeaderboardRows(prev => ({ ...prev, [selectedTournament]: data.fullLeaderboard ?? [] })))
        .catch(() => { /* non-critical */ });
    };
    fetchFull();
    const timer = window.setInterval(fetchFull, 60000);
    return () => window.clearInterval(timer);
  }, [selectedTournament]);

  useEffect(() => {
    if (!isMobile) return;
    const el = document.querySelector<HTMLElement>('[data-leaderboard-table="true"]');
    if (el) el.scrollTop = 0;
    // Force iOS Safari to recalculate layout after content height changes
    requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY));
  }, [isMobile, leaderboardViewMode, leaderboardSortMode, leaderboardPickedSort]);

  useEffect(() => {
    const loadCommissionerMembers = async () => {
      if (!sessionUser || !canManagePool || mainTab !== 'Commissioner Hub') {
        return;
      }

      setCommissionerBusy(true);
      setCommissionerError('');

      try {
        const payload = await readJson<{ members: CommissionerMember[] }>('/api/commissioner/members', {
          cache: 'no-store',
        });
        setCommissionerMembers(payload.members);
      } catch (err) {
        setCommissionerError(err instanceof Error ? err.message : 'Unable to load pool members.');
      } finally {
        setCommissionerBusy(false);
      }
    };

    void loadCommissionerMembers();
  }, [canManagePool, commissionerMembersRefreshNonce, mainTab, sessionUser]);

  useEffect(() => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    const member = commissionerMembers.find((item) => item.id === selectedCommissionerMemberId);

    if (!member) {
      // The selected member was removed or refreshed away.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCommissionerMemberId(null);
      return;
    }

    // Populate the edit form from the selected commissioner member.
    setMemberEditForm({
      displayName: member.displayName,
      email: member.email,
      password: '',
      rosters: {
        players: formatRosterField(member.rosters.players),
        masters: formatRosterField(member.rosters.masters),
        pga: formatRosterField(member.rosters.pga),
        'us-open': formatRosterField(member.rosters['us-open']),
        open: formatRosterField(member.rosters.open),
      },
    });
  }, [selectedCommissionerMemberId, commissionerMembers]);

  useEffect(() => {
    // Keep the account form aligned with the current session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccountDisplayName(sessionUser?.displayName ?? '');
  }, [sessionUser]);

  useEffect(() => {
    if (!commissionerSuccess) return;
    const timer = window.setTimeout(() => setCommissionerSuccess(''), 6000);
    return () => window.clearTimeout(timer);
  }, [commissionerSuccess]);

  useEffect(() => {
    // Clear success banners when changing commissioner context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCommissionerSuccess('');
  }, [mainTab, commissionerConsoleView]);

  useEffect(() => {
    const anyOpen = !!activeStandingEntryId || !!activeStandingGolferId || !!scorecardGolferName || showBonusPoints;
    if (!anyOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [activeStandingEntryId, activeStandingGolferId, scorecardGolferName, showBonusPoints]);

  const applySession = (payload: SessionPayload) => {
    setSessionUser(payload.user);
    setPool(payload.pool);
    setPoolEntries(payload.entries);
    // Older stored sessions predate these fields; the next server refresh fills them in.
    if (payload.leagues) {
      setSessionFlags({
        leagues: payload.leagues,
        isAppAdmin: payload.isAppAdmin ?? false,
        canCreateLeague: payload.canCreateLeague ?? false,
      });
    }
    if (payload.user) {
      writeStoredSession(payload);
      upsertStoredAccount(payload);
    } else {
      clearStoredSession();
    }
    setAuthError('');
  };

  const refreshCurrentSession = async () => {
    try {
      const payload = await readJson<SessionPayload>('/api/auth/session', { cache: 'no-store' });

      if (payload.user) {
        applySession(payload);
        return;
      }

      const stored = readStoredSession();
      const storedAccount = stored?.user ? findStoredAccountByEmail(stored.user.email) : null;

      if (storedAccount) {
        const restored = await restoreServerSessionFromStoredAccount(storedAccount);
        upsertStoredAccount(restored, storedAccount.password);
        applySession(restored);
      }
    } catch {
      // Keep the current UI in place if a soft refresh misses the network.
    }
  };

  const handleRegister = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });

      upsertStoredAccount(payload, registerForm.password);
      applySession(payload);
      settleViewAfterKeyboard();
      setRegisterForm({ displayName: '', email: '', password: '', joinCode: '' });
      setPendingJoinCode('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      const payload = await readJson<SessionPayload>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      upsertStoredAccount(payload, loginForm.password);
      applySession(payload);
      settleViewAfterKeyboard();
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      const fallbackAccount = findStoredAccount(loginForm.email, loginForm.password);

      if (fallbackAccount) {
        try {
          const restored = await restoreServerSessionFromStoredAccount(fallbackAccount);
          upsertStoredAccount(restored, fallbackAccount.password);
          applySession(restored);
          settleViewAfterKeyboard();
          setLoginForm({ email: '', password: '' });
        } catch {
          setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
        }
      } else {
        setAuthError(err instanceof Error ? err.message : 'Unable to sign in.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthError('');

    try {
      await readJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
      setSessionUser(null);
      setPool(null);
      setPoolEntries([]);
      setSessionFlags(NO_SESSION_FLAGS);
      setLeagueModalOpen(false);
      setCommissionerMembers([]);
      setSelectedCommissionerMemberId(null);
      setAccountMenuOpen(false);
      setAccountPreferencesView('root');
      setAccountPassword('');
      setAccountDisplayName('');
      setAccountMessage('');
      clearStoredSession();
      clearStoredMainTab();
      setMainTab('Standings');
      setSaveMessage('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleUpdateOwnPassword = async () => {
    setAccountBusy(true);
    setAccountMessage('');

    try {
      const payload = await readJson<{ user: AuthUser }>('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: accountPassword }),
      });

      upsertStoredAccount(
        {
          user: payload.user,
          pool,
          entries: poolEntries,
        },
        accountPassword,
      );
      setSessionUser(payload.user);
      setAccountPassword('');
      setAccountMessage('Password updated.');
    } catch (err) {
      setAccountMessage(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleUpdateOwnDisplayName = async () => {
    setAccountBusy(true);
    setAccountMessage('');

    try {
      const payload = await readJson<{ user: AuthUser }>('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: accountDisplayName }),
      });

      setSessionUser(payload.user);
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.user.id ? { ...entry, name: payload.user.displayName, rosters: payload.user.rosters } : entry,
        ),
      );
      upsertStoredAccount({
        user: payload.user,
        pool,
        entries: poolEntries.map((entry) =>
          entry.id === payload.user.id ? { ...entry, name: payload.user.displayName, rosters: payload.user.rosters } : entry,
        ),
      });
      setAccountMessage('Display name updated.');
      setMyEntriesDetailView('none');
    } catch (err) {
      setAccountMessage(err instanceof Error ? err.message : 'Unable to update display name.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleCreateMember = async () => {
    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>('/api/commissioner/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberCreateForm),
      });

      setCommissionerMembers((current) => [...current, payload.member]);
      setPoolEntries((current) => [...current, { id: payload.member.id, name: payload.member.displayName, rosters: payload.member.rosters, tieBreaks: payload.member.tieBreaks ?? {} }]);
      setMemberCreateForm({ displayName: '', email: '', password: '' });
      setShowAddMemberForm(false);
      setCommissionerSuccess('Member added.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to add member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleToggleLineupLock = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/lineup-lock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament,
          locked: !locked,
        }),
      });

      setPool(payload.pool);
      setCommissionerSuccess(`Lineup lock ${payload.pool.lineupLocks[selectedTournament] ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update lineup lock.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleTogglePicksOpen = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const currentlyOpen = pool.picksOpen?.[selectedTournament] === true;
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/lineup-lock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: selectedTournament,
          picksOpen: !currentlyOpen,
        }),
      });

      setPool(payload.pool);
      setCommissionerSuccess(`Picks ${payload.pool.picksOpen?.[selectedTournament] ? 'opened' : 'closed'}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update picks open state.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleSavePayouts = async () => {
    if (!sessionUser || !canManagePool || !pool) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: entriesTournamentId,
          first: Number(payoutForm.first),
          second: Number(payoutForm.second),
          third: Number(payoutForm.third),
        }),
      });

      setPool(payload.pool);
      setCommissionerSuccess(
        `${commissionerTournamentLabel} payouts saved.`,
      );
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update payouts.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleClearRoundLeader = async (round: number) => {
    setClearLeaderBusy(true);
    setClearLeaderMsg(null);
    try {
      const res = await fetch(`/api/commissioner/round-leader?tournamentId=${entriesTournamentId}&round=${round}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setClearLeaderMsg((body as { error?: string }).error ?? 'Failed to clear.');
      } else {
        setClearLeaderMsg(`Round ${round} leader cleared.`);
      }
    } catch {
      setClearLeaderMsg('Network error.');
    } finally {
      setClearLeaderBusy(false);
    }
  };

  const handleMarkPlayerStatus = async (status: 'WD' | 'DQ' | 'MDF') => {
    const playerName = playerStatusInput.trim();
    if (!playerName) return;
    setPlayerStatusBusy(true);
    setPlayerStatusMsg(null);
    try {
      const res = await fetch('/api/commissioner/player-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: entriesTournamentId, playerName, status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlayerStatusMsg((body as { error?: string }).error ?? 'Failed to save.');
      } else {
        setPlayerStatusMsg(`${playerName} marked as ${status}.`);
        setPlayerStatusInput('');
      }
    } catch {
      setPlayerStatusMsg('Network error.');
    } finally {
      setPlayerStatusBusy(false);
    }
  };

  const handleSaveWinnerScore = async () => {
    const score = Number(winnerScoreInput);
    if (!Number.isFinite(score) || score < 200 || score > 400) {
      setCommissionerError('Enter a valid total stroke count (200–400).');
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ pool: PoolInfo }>('/api/commissioner/winner-score', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: entriesTournamentId, score }),
      });
      setPool(payload.pool);
      setCommissionerSuccess(`${commissionerTournamentLabel} winner's score saved.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to save winner score.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleSelectCommissionerMember = (memberId: string) => {
    setSelectedCommissionerMemberId(memberId);
    setCommissionerError('');
    setCommissionerSuccess('');
  };

  const openCommissionerMemberModal = (memberId: string) => {
    handleSelectCommissionerMember(memberId);
    setCommissionerMemberModalView('menu');
    setCommissionerMemberModalOpen(true);
  };

  const openCommissionerMemberPicks = (memberId: string) => {
    const member = commissionerMembers.find((item) => item.id === memberId);

    if (!member) {
      return;
    }

    setSelectedCommissionerMemberId(memberId);
    setCommissionerRosterMemberId(memberId);
    setCommissionerRosterSelection(member.rosters[entriesTournamentId] ?? []);
    const existingTieBreak = member.tieBreaks?.[entriesTournamentId];
    setCommissionerTieBreakInput(existingTieBreak != null ? String(existingTieBreak) : '');
    setCommissionerMemberModalOpen(false);
    setCommissionerConsoleView('member-picks');
    setCommissionerError('');
    setCommissionerSuccess('');
  };

  const handleSaveCommissionerMember = async () => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${selectedCommissionerMemberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: memberEditForm.displayName,
            email: memberEditForm.email,
            password: memberEditForm.password,
            rosters: {
              players: parseRosterField(memberEditForm.rosters.players),
              masters: parseRosterField(memberEditForm.rosters.masters),
              pga: parseRosterField(memberEditForm.rosters.pga),
              'us-open': parseRosterField(memberEditForm.rosters['us-open']),
              open: parseRosterField(memberEditForm.rosters.open),
            },
          }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id ? { ...entry, name: payload.member.displayName, rosters: payload.member.rosters } : entry,
        ),
      );
      setSessionUser((current) =>
        current && current.id === payload.member.id ? payload.member : current,
      );
      setCommissionerSuccess('Member updated.');
      setMemberEditForm((current) => ({ ...current, password: '' }));
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to update member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleDeleteCommissionerMember = async () => {
    if (!selectedCommissionerMemberId) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      await readJson<{ ok: boolean }>(`/api/commissioner/members/${selectedCommissionerMemberId}`, {
        method: 'DELETE',
      });

      setCommissionerMembers((current) => current.filter((member) => member.id !== selectedCommissionerMemberId));
      setPoolEntries((current) => current.filter((entry) => entry.id !== selectedCommissionerMemberId));
      setSessionUser((current) => (current?.id === selectedCommissionerMemberId ? null : current));
      setPool((current) => (sessionUser?.id === selectedCommissionerMemberId ? null : current));
      setSelectedCommissionerMemberId(null);
      setCommissionerRosterMemberId((current) => (current === selectedCommissionerMemberId ? null : current));
      setCommissionerMemberModalOpen(false);
      setCommissionerConsoleView((current) => (current === 'member-picks' ? 'members' : current));
      setCommissionerSuccess('Member deleted.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to delete member.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  // Promote a member to commissioner, or hand the role back. Refreshes the session so the
  // league's commissioner list (and your own access, if you demoted yourself) stays current.
  const handleToggleCommissionerRole = async (memberId: string, makeCommissioner: boolean) => {
    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      await readJson<{ member: AuthUser }>(`/api/commissioner/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: makeCommissioner ? 'commissioner' : 'member' }),
      });
      await refreshCurrentSession();
      setCommissionerMemberModalOpen(false);
      setCommissionerSuccess(makeCommissioner ? 'Member is now a commissioner.' : 'Commissioner role removed.');
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to change the role.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const handleClearCommissionerMemberPicks = async () => {
    if (!selectedCommissionerMemberId) return;

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${selectedCommissionerMemberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rosters: { [entriesTournamentId]: [] }, tieBreaks: { [entriesTournamentId]: null } }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id
            ? { ...entry, rosters: payload.member.rosters }
            : entry,
        ),
      );
      setSessionUser((current) =>
        current && current.id === payload.member.id ? payload.member : current,
      );
      setCommissionerMemberModalOpen(false);
      setCommissionerMemberModalView('menu');
      setCommissionerSuccess(`Picks cleared for ${payload.member.displayName}.`);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to clear picks.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const toggleCommissionerRosterPlayer = (playerId: number) => {
    if (commissionerRosterSelection.includes(playerId)) {
      setCommissionerRosterSelection(commissionerRosterSelection.filter((id) => id !== playerId));
      return;
    }

    if (commissionerRosterSelection.length >= REQUIRED_GOLFERS) {
      return;
    }

    const next = [...commissionerRosterSelection, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);

    if (nextSalary > SALARY_CAP) {
      return;
    }

    setCommissionerRosterSelection(next);
  };

  const handleSaveCommissionerRoster = async () => {
    if (!commissionerRosterMember) {
      return;
    }

    setCommissionerBusy(true);
    setCommissionerError('');
    setCommissionerSuccess('');

    try {
      const payload = await readJson<{ member: CommissionerMember }>(
        `/api/commissioner/members/${commissionerRosterMember.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rosters: {
              [entriesTournamentId]: commissionerRosterSelection,
            },
            tieBreaks: {
              [entriesTournamentId]: parseInt(commissionerTieBreakInput, 10),
            },
          }),
        },
      );

      setCommissionerMembers((current) =>
        current.map((member) => (member.id === payload.member.id ? payload.member : member)),
      );
      setPoolEntries((current) =>
        current.map((entry) =>
          entry.id === payload.member.id
            ? { ...entry, name: payload.member.displayName, rosters: payload.member.rosters }
            : entry,
        ),
      );
      setSessionUser((current) => (current && current.id === payload.member.id ? payload.member : current));
      setCommissionerSuccess(`${payload.member.displayName}'s ${commissionerTournamentLabel} picks were saved.`);
      const ret = commissionerEditReturnRef.current;
      commissionerEditReturnRef.current = null;
      setCommissionerConsoleView(ret ? ret.view : 'members');
      if (ret) setSubmittedRosterMemberId(ret.memberId);
      setCommissionerRosterMemberId(null);
    } catch (err) {
      setCommissionerError(err instanceof Error ? err.message : 'Unable to save member picks.');
    } finally {
      setCommissionerBusy(false);
    }
  };

  const feedMap = useMemo(() => {
    const rows = feed?.players ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName ?? ''), row])) as Record<
      string,
      FeedRow
    >;
  }, [feed]);

  const liveOddsMap = useMemo(() => {
    const rows = feed?.odds ?? [];
    return Object.fromEntries(rows.map((row) => [normalizeName(row.canonicalName), row.odds])) as Record<
      string,
      string
    >;
  }, [feed]);

  // Salaries come ONLY from the commissioner's uploaded list (/commissioner-salary). No baked-in
  // salaries and no odds-based auto-pricing — until a list is uploaded there is no pick list. World
  // ranks on the pick sheet likewise come from the upload (falling back to the static pool rank).
  // Salary lists are stored PER TOURNAMENT, so we keep every tournament's map. The pick sheet uses the
  // current tournament's (entriesTournamentId); the standings use whichever tournament is being viewed
  // (selectedTournament), so a past event's entry shows the salaries each golfer had at THAT event.
  type SalaryMaps = { salaries: Record<number, number>; worldRanks: Record<number, number> };
  const [salaryByTournament, setSalaryByTournament] = useState<Record<string, SalaryMaps>>({});
  // Players the commissioner's salary upload auto-added because they weren't in the static pool.
  const [dynamicPlayers, setDynamicPlayers] = useState<Array<{ id: number; name: string; pgaTourId: number; worldRank: number; defaultOdds: string }>>([]);
  const [salaryListLoaded, setSalaryListLoaded] = useState(false); // false until the fetch resolves
  // Re-fetchable so a fresh commissioner upload shows up without a hard reload (mobile back/bfcache
  // otherwise restores the pre-upload page without re-running the mount fetch).
  const loadSalaryOverrides = useRef<() => void>(() => {});
  loadSalaryOverrides.current = () => {
    fetch('/api/salary-overrides', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { byTournament?: Record<string, { salaries?: Record<string, number>; worldRanks?: Record<string, number> }>; dynamicPlayers?: Array<{ id: number; name: string; pgaTourId: number; worldRank: number; defaultOdds: string }> }) => {
        if (!d) return;
        const byT: Record<string, SalaryMaps> = {};
        for (const [tid, m] of Object.entries(d.byTournament ?? {})) {
          const salaries: Record<number, number> = {};
          const worldRanks: Record<number, number> = {};
          for (const [k, v] of Object.entries(m.salaries ?? {})) salaries[Number(k)] = Number(v);
          for (const [k, v] of Object.entries(m.worldRanks ?? {})) worldRanks[Number(k)] = Number(v);
          byT[tid] = { salaries, worldRanks };
        }
        setSalaryByTournament(byT);
        if (Array.isArray(d.dynamicPlayers) && d.dynamicPlayers.length > 0) setDynamicPlayers(d.dynamicPlayers);
      })
      .catch(() => { /* keep built-in values */ })
      .finally(() => { setSalaryListLoaded(true); });
  };
  useEffect(() => {
    loadSalaryOverrides.current();
    // Re-fetch when the tab/app regains focus (e.g. returning from the commissioner upload page).
    const onShow = () => loadSalaryOverrides.current();
    window.addEventListener('focus', onShow);
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadSalaryOverrides.current(); });
    return () => {
      window.removeEventListener('focus', onShow);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);
  // The pick sheet is built from the CURRENT tournament's salaries/world ranks.
  const salaryOverrides = useMemo(() => salaryByTournament[entriesTournamentId]?.salaries ?? {}, [salaryByTournament, entriesTournamentId]);
  const worldRankOverrides = useMemo(() => salaryByTournament[entriesTournamentId]?.worldRanks ?? {}, [salaryByTournament, entriesTournamentId]);
  // No salary list has been uploaded for this tournament yet (salaries come only from the upload).
  const salaryListMissing = salaryListLoaded && Object.keys(salaryOverrides).length === 0;

  // Amateur / club-pro flags detected from the commissioner's field & salary uploads (canonical name
  // keys). Amateurs show a red "AMATEUR" in the bio's Turned Pro field; club pros get the PGA seal.
  const [amateurKeys, setAmateurKeys] = useState<Set<string>>(new Set());
  const [clubProKeys, setClubProKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    fetch('/api/player-tags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { amateur?: string[]; clubPro?: string[] }) => {
        if (cancelled || !d) return;
        if (Array.isArray(d.amateur)) setAmateurKeys(new Set(d.amateur));
        if (Array.isArray(d.clubPro)) setClubProKeys(new Set(d.clubPro));
      })
      .catch(() => { /* no tags yet */ });
    return () => { cancelled = true; };
  }, []);

  const players = useMemo(
    () =>
      buildPricedPlayers([...PLAYER_POOL, ...dynamicPlayers], liveOddsMap, salaryOverrides, worldRankOverrides).map((player) => {
        const live = feedMap[normalizeName(player.name)];
        const score = live?.score ?? '--';
        const position = live?.position ?? '--';
        const thru = live?.thru ?? '--';
        const scoreBreakdown =
          live?.scoreBreakdown ??
          buildPlaceholderScoreBreakdown({ position, score, thru });

        return {
          ...player,
          position,
          thru,
          score,
          total: live?.total ?? '--',
          currentRoundScore: live?.currentRoundScore ?? null,
          backNineStart: live?.backNineStart ?? false,
          teeTime: live?.teeTime ?? null,
          points: scoreBreakdown.totalPoints,
          holesRemaining: (score === 'CUT' || score === 'MDF') ? 0 : scoreBreakdown.holesRemaining,
          scoreBreakdown,
          lowRoundIds: live?.lowRoundIds ?? [],
          originalScore: live?.originalScore,
        };
      }),
    [feedMap, liveOddsMap, salaryOverrides, worldRankOverrides, dynamicPlayers],
  );

  const playersById = Object.fromEntries(players.map((player) => [player.id, player]));

  // Directory of every pickable player by id (name/photo/pga id), independent of the tournament in
  // view — used by the Reports feature, which aggregates picks across any of the five tournaments.
  const playerDirectory = useMemo(() => {
    const map = new Map<number, { id: number; name: string; pgaTourId: number; photoUrl?: string }>();
    for (const p of [...PLAYER_POOL, ...dynamicPlayers]) {
      map.set(p.id, { id: p.id, name: p.name, pgaTourId: p.pgaTourId, photoUrl: (p as { photoUrl?: string }).photoUrl });
    }
    return map;
  }, [dynamicPlayers]);

  // Turn a leaderboard position string ("1", "T4", "CUT") into a sortable finish rank (lower = better).
  const positionSortRank = (pos?: string) => {
    if (!pos) return 9999;
    const s = pos.toUpperCase().trim();
    if (s === '' || s === '--' || s === 'CUT' || s === 'MC' || s === 'MDF' || s === 'WD' || s === 'DQ') return 9000;
    const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(n) ? 9500 : n;
  };

  // Player Pick Summary result — recomputed automatically whenever a tournament and a
  // sort option are both selected (no explicit "Go" step).
  const ppsResult = useMemo(() => {
    if (!ppsTournament || !ppsSortBy) return null;
    // "All tournaments" — combined pick counts for every player picked at least once across all
    // majors year to date. Only "Times Picked" applies (salary/finish vary by event), most-picked
    // first with alphabetical tiebreaks.
    if (ppsTournament === 'all') {
      // Only combine tournaments whose picks are revealed for the selected report year (started
      // or concluded); upcoming tournaments' picks stay private until they begin.
      const clockNow = new Date(nowTick);
      const revealed = (tid: TournamentId) => {
        const tournament = TOURNAMENTS.find((t) => t.id === tid);
        return !!tournament && clockNow >= getTournamentEventWindow(tournament, reportYear).inProgressAt;
      };
      const countById = new Map<number, number>();
      for (const entry of poolEntries) {
        for (const t of REPORT_TOURNAMENTS) {
          if (!revealed(t.id)) continue;
          for (const pid of entry.rosters[t.id] ?? []) countById.set(pid, (countById.get(pid) ?? 0) + 1);
        }
      }
      const rows = Array.from(countById.entries())
        .map(([pid, count]) => {
          const p = playerDirectory.get(pid);
          if (!p) return null;
          return { id: pid, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, count, salary: 0, position: '--' };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      rows.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
      return { tournament: 'all' as const, sortBy: 'Picked' as const, rows };
    }
    const T = ppsTournament;
    const sortBy = ppsSortBy;
    const posByName = new Map<string, string>();
    for (const row of feeds[T]?.players ?? []) posByName.set(normalizeName(row.canonicalName ?? ''), row.position);
    const salaries = salaryByTournament[T]?.salaries ?? {};
    const countById = new Map<number, number>();
    for (const entry of poolEntries) {
      for (const pid of entry.rosters[T] ?? []) countById.set(pid, (countById.get(pid) ?? 0) + 1);
    }
    const rows = Array.from(countById.entries())
      .map(([pid, count]) => {
        const p = playerDirectory.get(pid);
        if (!p) return null;
        const position = posByName.get(normalizeName(p.name)) ?? '--';
        return { id: pid, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, count, salary: salaries[pid] ?? 0, position };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    rows.sort((a, b) =>
      sortBy === 'Salary'
        ? (b.salary - a.salary) || (positionSortRank(a.position) - positionSortRank(b.position)) || a.name.localeCompare(b.name)
        : (b.count - a.count) || (positionSortRank(a.position) - positionSortRank(b.position)) || a.name.localeCompare(b.name),
    );
    return { tournament: T, sortBy, rows };
  }, [ppsTournament, ppsSortBy, feeds, salaryByTournament, poolEntries, playerDirectory, nowTick, preTournamentTick, reportYear]);

  // Full-field performance rows for the Player Performance Summary — one per player in the chosen
  // tournament's field, with finish, score to par, and every scoring/bonus stat.
  const ppfRows = useMemo(() => {
    if (!ppfTournament) return [];
    const T = ppfTournament;
    const feedT = feeds[T];
    if (!feedT) return [];
    const worldRanks = salaryByTournament[T]?.worldRanks ?? {};
    const nameToId = new Map<string, number>();
    for (const [id, p] of playerDirectory) nameToId.set(normalizeName(p.name), id);
    const CUTS = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
    const toParNum = (s?: string) => { if (!s) return NaN; const u = s.toUpperCase().trim(); if (u === 'E') return 0; const n = parseFloat(u); return Number.isNaN(n) ? NaN : n; };
    const rank = (pos?: string) => {
      if (!pos) return 9999;
      const s = pos.toUpperCase().trim();
      if (s === '' || s === '--' || s === 'CUT' || s === 'MC' || s === 'MDF' || s === 'WD' || s === 'DQ') return 9000;
      const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
      return Number.isNaN(n) ? 9500 : n;
    };
    return (feedT.players ?? []).map((row) => {
      const nm = row.canonicalName ?? '';
      const id = nameToId.get(normalizeName(nm)) ?? null;
      const sl = row.scoreBreakdown?.statLine;
      const rl = row.scoreBreakdown?.roundLeadersAwarded;
      const isCut = CUTS.has(String(row.score).toUpperCase());
      const scoreRaw = isCut ? toParNum(row.originalScore) : toParNum(row.score);
      return {
        id,
        name: nm,
        worldRank: id != null && worldRanks[id] != null ? worldRanks[id] : null,
        position: row.position,
        posRank: rank(row.position),
        madeCut: row.scoreBreakdown?.madeCut ?? !isCut,
        scoreNum: Number.isNaN(scoreRaw) ? 9999 : scoreRaw,
        scoreDisplay: Number.isNaN(scoreRaw) ? '--' : scoreRaw === 0 ? 'E' : scoreRaw > 0 ? `+${scoreRaw}` : String(scoreRaw),
        par: sl?.par ?? 0,
        birdie: sl?.birdie ?? 0,
        eagle: sl?.eagle ?? 0,
        bogey: sl?.bogey ?? 0,
        double: sl?.doubleBogey ?? 0,
        triple: sl?.tripleOrWorse ?? 0,
        ace: sl?.holeInOne ?? 0,
        streak: sl?.threeBirdieStreaks ?? 0,
        bogeyFree: sl?.bogeyFreeRounds ?? 0,
        lowRound: sl?.lowRounds ?? 0,
        r1: rl?.first ?? false,
        r2: rl?.second ?? false,
        r3: rl?.third ?? false,
      };
    });
  }, [ppfTournament, feeds, salaryByTournament, playerDirectory]);

  // Track the visible width of the Player Performance table's scroll area so the in-table cut-line
  // label can be pinned to the center of what's on screen (not the center of the full wide table).
  useLayoutEffect(() => {
    const el = ppfScrollRef.current;
    if (!el) { setPpfViewportW(0); return; }
    const update = () => setPpfViewportW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedReport, ppfTournament, mainTab, ppfSortKey, ppfSearch]);

  // Whenever a report is regenerated by a new selection (tournament, sort-by, member, or year),
  // snap back to the top of the report so the fresh results are shown from the beginning — even if
  // the user had scrolled down in the previous view. Also reset the Player Performance table's own
  // internal scroll region to the top.
  useEffect(() => {
    if (mainTab !== 'Reports' || !selectedReport) return;
    reportTopRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    if (ppfScrollRef.current) ppfScrollRef.current.scrollTop = 0;
  }, [selectedReport, mainTab, ppsTournament, ppsSortBy, ppfTournament, pmphEntryId, pmpsEntryId, pshTournament, reportYear, pshYear]);

  // Year/season picker shown to the right of every report header; defaults to the current season.
  const reportYearSelect = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
      <label style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Year</label>
      <select
        value={reportYear}
        onChange={(e) => setReportYear(Number(e.target.value))}
        style={{ appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '8px 30px 8px 12px', fontSize: 14, fontWeight: 700, color: '#0f1720', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center' }}
      >
        {[...POOL_SEASONS].sort((a, b) => b - a).map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );

  const selectedCommissionerMember =
    commissionerMembers.find((member) => member.id === selectedCommissionerMemberId) ?? null;
  const filteredCommissionerMembers = commissionerMembers
    .filter((member) => {
      const query = commissionerMemberSearch.trim().toLowerCase();
      if (!query) return true;
      return member.displayName.toLowerCase().includes(query) || member.email.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (commissionerMemberSort.column === 'tournamentCount') {
        const countA = TOURNAMENTS.filter((event) => (a.rosters[event.id] ?? []).length > 0).length;
        const countB = TOURNAMENTS.filter((event) => (b.rosters[event.id] ?? []).length > 0).length;
        const cmp = countA - countB;
        return commissionerMemberSort.direction === 'asc' ? cmp : -cmp;
      }
      const valA = a[commissionerMemberSort.column].toLowerCase();
      const valB = b[commissionerMemberSort.column].toLowerCase();
      const cmp = valA.localeCompare(valB);
      return commissionerMemberSort.direction === 'asc' ? cmp : -cmp;
    });
  const commissionerRosterMember =
    commissionerMembers.find((member) => member.id === commissionerRosterMemberId) ?? null;
  const filteredEntriesPlayers = players
    .filter((player) => {
      if (player.salary <= 0) return false; // not on the uploaded list → not pickable
      if (selectedRoster.includes(player.id)) return false;
      const query = entriesPlayerSearch.trim().toLowerCase();
      if (!query) return true;
      return player.name.toLowerCase().includes(query);
    })
    .sort((a, b) => b.salary - a.salary);
  const filteredCommissionerPlayers = players
    .filter((player) => {
      if (player.salary <= 0) return false; // not on the uploaded list → not pickable
      if (commissionerRosterSelection.includes(player.id)) return false;
      const query = commissionerPlayerSearch.trim().toLowerCase();
      if (!query) return true;
      return player.name.toLowerCase().includes(query);
    })
    .sort((a, b) => b.salary - a.salary);

  const savedRoster = sessionUser?.rosters[entriesTournamentId] ?? [];
  const hasSubmittedRoster = savedRoster.length === REQUIRED_GOLFERS;
  const submittedEntries = poolEntries.filter((entry) => (entry.rosters[entriesTournamentId] ?? []).length === REQUIRED_GOLFERS);
  const otherSubmittedEntriesCount = sessionUser
    ? submittedEntries.filter((entry) => entry.id !== sessionUser.id).length
    : submittedEntries.length;
  const submittedCommissionerMembers = commissionerMembers
    .filter((member) => (member.rosters[entriesTournamentId] ?? []).length === REQUIRED_GOLFERS)
    .sort((a, b) => {
      if (commissionerPicksSort === 'newest') {
        const ta = a.rosterSubmittedAt?.[entriesTournamentId] ?? '';
        const tb = b.rosterSubmittedAt?.[entriesTournamentId] ?? '';
        if (ta !== tb) return tb.localeCompare(ta); // newest first
      }
      return a.displayName.localeCompare(b.displayName);
    });
  const pendingCommissionerMembers = commissionerMembers
    .filter((member) => (member.rosters[entriesTournamentId] ?? []).length !== REQUIRED_GOLFERS)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const rosterPlayers = selectedRoster.map((id) => playersById[id]).filter(Boolean);
  const orderedRosterPlayers = [...rosterPlayers].sort((left, right) => right.salary - left.salary);
  const savedRosterPlayers = savedRoster.map((id) => playersById[id]).filter(Boolean);
  const salaryUsed = rosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const salaryRemaining = SALARY_CAP - salaryUsed;
  const playersNeeded = Math.max(0, REQUIRED_GOLFERS - selectedRoster.length);
  const averageRemainingPerPlayer =
    playersNeeded > 0 ? Math.max(0, Math.floor(salaryRemaining / playersNeeded)) : 0;
  const commissionerRosterPlayers = commissionerRosterSelection.map((id) => playersById[id]).filter(Boolean);
  const commissionerOrderedRosterPlayers = [...commissionerRosterPlayers].sort(
    (left, right) => right.salary - left.salary,
  );
  const commissionerSalaryUsed = commissionerRosterPlayers.reduce((sum, player) => sum + player.salary, 0);
  const commissionerSalaryRemaining = SALARY_CAP - commissionerSalaryUsed;
  const commissionerPlayersNeeded = Math.max(0, REQUIRED_GOLFERS - commissionerRosterSelection.length);
  const commissionerAverageRemainingPerPlayer =
    commissionerPlayersNeeded > 0
      ? Math.max(0, Math.floor(commissionerSalaryRemaining / commissionerPlayersNeeded))
      : 0;
  const canSaveCommissionerRoster =
    !!commissionerRosterMember &&
    commissionerRosterSelection.length === REQUIRED_GOLFERS &&
    commissionerSalaryUsed <= SALARY_CAP &&
    /^\d{3}$/.test(commissionerTieBreakInput);
  const locked = pool?.lineupLocks?.[selectedTournament] ?? selectedTournamentStatus?.label === 'IN PROGRESS';
  const showFinalTournamentView = selectedTournamentStatus?.label === 'LOCKED';
  const isTournamentFinal = feed?.tournamentComplete === true;
  const roundOneComplete =
    (feed?.currentRound ?? 1) > 1 ||
    ((feed?.currentRound ?? 1) === 1 && /official|complete|final/i.test(feed?.status ?? ''));
  const roundTwoComplete =
    (feed?.currentRound ?? 1) > 2 ||
    ((feed?.currentRound ?? 1) === 2 && /official|complete|final/i.test(feed?.status ?? ''));
  const roundThreeComplete =
    (feed?.currentRound ?? 1) > 3 ||
    ((feed?.currentRound ?? 1) === 3 && /official|complete|final/i.test(feed?.status ?? ''));
  const currentRoundComplete = /official|complete|final/i.test(feed?.status ?? '');
  const currentRoundSuspended = /suspended/i.test(feed?.status ?? '');
  // Once the real cut is applied (players carry Missed Cut markers) the projection is
  // obsolete — stop showing it regardless of the time window.
  const cutAssigned =
    (feed?.players?.some((p) => p.score === 'CUT') ?? false) ||
    (currentFullLeaderboardRows ?? []).some((p) => p.score === 'CUT');
  const showProjectedCut = (() => {
    if (selectedTournamentStatus?.label !== 'IN PROGRESS') return false;
    if (cutAssigned) return false;
    const showAt = TOURNAMENT_CUT_SHOW_AT[selectedTournament];
    if (!showAt) return false;
    const now = nowTick;
    if (now < new Date(showAt).getTime()) return false;
    const hideAt = TOURNAMENT_CUT_HIDE_AT[selectedTournament];
    return hideAt ? now < new Date(hideAt).getTime() : true;
  })();
  // Fills the slot right of the round chip when no projected cut is displayed: the time
  // of day at the course while a round is in progress/suspended (ticks with nowTick).
  const courseLocalTimeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: TOURNAMENT_COURSE_TIMEZONES[selectedTournament],
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(nowTick)).toLowerCase();
  // Once a round is complete, the same slot shows when the next round begins — the
  // earliest future tee time from the feed (ESPN posts next-round times on the rows).
  const nextRoundStartLabel = (() => {
    if (!currentRoundComplete) return null;
    const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    let bestMs: number | null = null;
    let bestStr: string | null = null;
    for (const p of [...(feed?.players ?? []), ...(currentFullLeaderboardRows ?? [])]) {
      const t = p.teeTime;
      if (!t) continue;
      const m = t.match(/\w+ (\w{3}) (\d+) (\d{1,2}):(\d{2}):\d{2} \w+ (\d{4})/);
      if (!m) continue;
      const [, monthName, day, hour, min, year] = m;
      const month = MONTHS[monthName];
      if (!month) continue;
      // Same convention as teeTimeIsPast: ESPN stores EDT but mislabels the zone.
      const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:00-04:00`);
      if (isNaN(d.getTime()) || d.getTime() <= nowTick) continue;
      if (bestMs === null || d.getTime() < bestMs) { bestMs = d.getTime(); bestStr = t; }
    }
    return bestStr ? `${formatTeeTime(bestStr)} CST` : null;
  })();
  const nextRoundNum = Math.min(4, (feed?.currentRound ?? 1) + 1);
  const showFutureTournamentView =
    selectedTournamentStatus?.label === 'UP NEXT' ||
    selectedTournamentStatus?.label === 'ACTIVE' ||
    selectedTournamentStatus === null;
  const showLivePayoutStrip =
    selectedTournamentStatus?.label === 'IN PROGRESS' || selectedTournamentStatus?.label === 'LOCKED';
  // Tournament stats (and the Season/Tournament toggle) appear, and default to Tournament, as soon as
  // the event is underway (Round 1) — i.e. whenever it's IN PROGRESS — and stay for completed (LOCKED)
  // events. Before play begins (UP NEXT / ACTIVE / future) the popup shows Season stats only.
  const tournamentStatsUnlocked =
    selectedTournamentStatus?.label === 'LOCKED' ||
    selectedTournamentStatus?.label === 'IN PROGRESS';
  const displayTournamentWindow = getDisplayTournamentWindow(tournament, new Date(nowTick));
  const currentRoundLabel = selectedTournamentStatus?.label === 'LOCKED'
    ? 'Round 4'
    : getCurrentRoundLabel(displayTournamentWindow.startDate, new Date(nowTick));
  // Same rule for the standings card's Make Picks / Edit Picks button: the commissioner's toggle opens
  // picks during the pre-tournament (UP NEXT) window, not only once the event is ACTIVE.
  // "Picks are open" for the upcoming card only when picks are open AND the lineup is unlocked — a
  // stale picksOpen flag left true from a concluded (auto-locked) cycle must not read as open again.
  const picksOpenForTournament =
    showFutureTournamentView &&
    pool?.picksOpen?.[selectedTournament] === true &&
    pool?.lineupLocks?.[selectedTournament] !== true;
  const tournamentStartLabel = formatTournamentStartDate(displayTournamentWindow.inProgressAt);
  // Monday of tournament week (Thursday start minus 3 days) — when the finalized field is
  // entered and picks open, shown in the pre-tournament standings card.
  const tournamentFieldMondayLabel = (() => {
    const d = new Date(displayTournamentWindow.inProgressAt);
    d.setDate(d.getDate() - 3);
    return `Monday, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}`;
  })();

  // Picks-lock deadline in Central time, derived from the tournament's configured lock
  // timestamp (e.g. The Open locks 05:35 UTC = 12:35 am CST on Thursday).
  const lineupDeadlineLabel = (() => {
    const lockAt = lockTimeOverrides[selectedTournament] ?? TOURNAMENT_META[selectedTournament]?.lockAtUtc;
    if (!lockAt) return '6:15 am CST on Thursday';
    const d = new Date(lockAt);
    const time = d.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const day = d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long' });
    return `${time} CST on ${day}`;
  })();

  const userLabel = sessionUser?.displayName ?? 'Guest lineup';

  const openPlayerPopup = (rawPlayer: { id: number; name: string; pgaTourId: number; photoUrl?: string; worldRank?: number }, defaultTab: 'stats' | 'season' = 'stats', ctxTournamentId?: TournamentId) => {
    // Canonicalize feed-name variants (e.g. "Samuel Stevens" -> "Sam Stevens") so the bio,
    // ranks, photo and flag all resolve to the same pool player. worldRank is pinned to the ORIGINAL
    // static rank (never the commissioner's uploaded pick-list rank) so the info popup is unaffected.
    const player = {
      ...rawPlayer,
      name: canonicalName(rawPlayer.name),
      worldRank: ORIGINAL_WORLD_RANK_BY_ID.get(rawPlayer.id) ?? rawPlayer.worldRank,
    };
    const ctxTid = ctxTournamentId ?? selectedTournament;
    const ctxStatus = tournamentCardStatuses[ctxTid];
    const ctxStatsUnlocked = ctxStatus?.label === 'LOCKED' || ctxStatus?.label === 'IN PROGRESS';
    const espnEventId = TOURNAMENT_ESPN_EVENT_IDS[ctxTid];
    const statsCtx: 'season' | 'tournament' = ctxStatsUnlocked ? 'tournament' : 'season';
    const params = new URLSearchParams({ name: player.name, context: statsCtx });
    if (espnEventId && ctxStatsUnlocked) params.set('eventId', espnEventId);
    params.set('pgaTourId', String(player.pgaTourId));
    const showSubToggle = statsCtx === 'tournament' && ctxTid !== 'us-open';
    setStatsSubView('tournament');
    // Bio is the landing tab for every path into this popup (pick-sheet ⓘ included).
    setPickHistoryView('bio');
    setPickHistoryPlayerPopup({
      player,
      results: {},
      loading: false,
      fedexRank: null,
      dpWorldRank: null,
      owgrRank: null,
      fullResults: null,
      fullResultsLoading: true,
      careerResults: null,
      careerResultsLoading: false,
      playerStats: null,
      playerSeasonStats: null,
      playerStatsLoading: true,
      playerRounds: null,
      statsContext: statsCtx,
      ctxTournamentId: ctxTid,
      defaultTab,
      statAverages: {},
      fieldAverages: {},
      statRanks: {},
      seasonStatRanks: {},
      fieldDistributions: {},
      playerBio: null,
      playerBioLoading: true,
      espnPhotoUrl: null,
      pgaPhotoUrl: null,
      tournamentStatsFetchedAt: null,
      seasonStatsFetchedAt: null,
      bioFetchedAt: null,
      rankingsChangedAt: null,
    });
    // Bio is the landing tab, so fetch it eagerly on open (it's otherwise lazy-loaded on tab click).
    {
      const bioParams = new URLSearchParams({ name: player.name });
      if (player.pgaTourId) bioParams.set('pgaTourId', String(player.pgaTourId));
      readJson<{ bio: { height: string | null; weight: string | null; dob: string | null; age: number | null; birthPlace: string | null; college: string | null; collegeConfirmedAbsent: boolean; swing: string | null; turnedPro: number | null; pgaTourDebut: number | null; careerStarts: number | null; cutsMade: number | null; careerWins: number | null; majorStarts: number | null; majorCutsMade: number | null; majorWins: number | null; careerEarnings: string | null; pgaTourWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; majorWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null }; espnPhotoUrl?: string | null; pgaPhotoUrl?: string | null; updatedAt?: string | null }>(`/api/player-bio?${bioParams.toString()}`, { cache: 'no-store' })
        .then((data) => setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBio: data.bio, playerBioLoading: false, espnPhotoUrl: data.espnPhotoUrl ?? null, pgaPhotoUrl: data.pgaPhotoUrl ?? null, bioFetchedAt: data.updatedAt ?? null } : null))
        .catch(() => setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBioLoading: false } : null));
    }
    const scorecardFetch = statsCtx === 'tournament'
      ? readJson<{ rounds: { round: number; score: string }[] | null }>(`/api/scorecard?tournamentId=${ctxTid}&playerName=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rounds: null }))
      : Promise.resolve({ rounds: null });
    const seasonStatsFetch = showSubToggle || ctxTid === 'us-open'
      ? readJson<{ stats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null; ranks: Record<string, string> | null; updatedAt?: string | null }>(`/api/player-stats?name=${encodeURIComponent(player.name)}&context=season&pgaTourId=${player.pgaTourId}`, { cache: 'no-store' }).catch(() => ({ stats: null, ranks: null, updatedAt: null }))
      : Promise.resolve({ stats: null, ranks: null, updatedAt: null });
    Promise.all([
      readJson<{ results: { tournament: string; date: string; course: string; position: string; tour: 'pga' | 'liv' | 'eur' }[] | null }>(`/api/player-season?name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ results: null })),
      readJson<{ rank: number | null; updatedAt?: string | null }>(`/api/player-fedex-rank?pgaTourId=${player.pgaTourId}&name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rank: null, updatedAt: null })),
      readJson<{ rank: number | null; updatedAt?: string | null }>(`/api/player-dpworld-rank?pgaTourId=${player.pgaTourId}&name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rank: null, updatedAt: null })),
      readJson<{ rank: number | null; updatedAt?: string | null }>(`/api/player-owgr-rank?name=${encodeURIComponent(player.name)}`, { cache: 'no-store' }).catch(() => ({ rank: null, updatedAt: null })),
      readJson<{ stats: { drivingDistance: string | null; drivingAccuracy: string | null; gir: string | null; scrambling: string | null; sandSaves: string | null; puttAverage: string | null; avgPuttsPerRound: string | null; proximity: string | null; scoringAverage: string | null; birdiesPerRound: string | null; birdies: string | null; pars: string | null; bogeys: string | null; eagles: string | null; scoreToPar: string | null; sgTotal: string | null; sgOffTee: string | null; sgApproach: string | null; sgAroundGreen: string | null; sgPutting: string | null; sgTeeToGreen: string | null; rounds: string[] | null } | null; ranks: Record<string, string> | null; updatedAt?: string | null }>(`/api/player-stats?${params}`, { cache: 'no-store' }).catch(() => ({ stats: null, ranks: null, updatedAt: null })),
      scorecardFetch,
      seasonStatsFetch,
      readJson<{ averages: Record<string, string> }>('/api/tour-averages', { cache: 'no-store' }).catch(() => ({ averages: {} })),
      espnEventId && statsCtx === 'tournament'
        ? readJson<{ averages: Record<string, string>; distributions: Record<string, number[]> }>(`/api/field-averages?eventId=${espnEventId}`, { cache: 'no-store' }).catch(() => ({ averages: {}, distributions: {} }))
        : Promise.resolve({ averages: {}, distributions: {} }),
    ]).then(([fullData, fedexData, dpWorldData, owgrData, statsData, scData, seasonData, avgData, fieldAvgData]) => {
      const rounds = (scData.rounds ?? []).filter((r) => r.score && r.score !== '--');
      const tournamentStatsFetchedAt = statsCtx === 'tournament' ? (statsData.updatedAt ?? null) : null;
      const seasonStatsFetchedAt = statsCtx === 'season' ? (statsData.updatedAt ?? null) : (seasonData.updatedAt ?? null);
      const rankingUpdates = [fedexData.updatedAt, dpWorldData.updatedAt, owgrData.updatedAt].filter(Boolean) as string[];
      const rankingsChangedAt = rankingUpdates.length ? rankingUpdates.slice().sort()[rankingUpdates.length - 1] : null;
      setPickHistoryPlayerPopup((prev) => prev ? { ...prev, fullResults: fullData.results, fullResultsLoading: false, fedexRank: fedexData.rank, dpWorldRank: dpWorldData.rank, owgrRank: owgrData.rank, playerStats: statsData.stats, playerSeasonStats: seasonData.stats, playerStatsLoading: false, playerRounds: rounds.length > 0 ? rounds : null, statAverages: avgData.averages ?? {}, fieldAverages: fieldAvgData.averages ?? {}, statRanks: statsData.ranks ?? {}, seasonStatRanks: seasonData.ranks ?? {}, fieldDistributions: fieldAvgData.distributions ?? {}, tournamentStatsFetchedAt, seasonStatsFetchedAt, rankingsChangedAt } : null);
    });
  };

  // Tiebreak inputs, computed once (not per sort comparison):
  // - tournamentChampion: the actual winner, auto-detected once the event is officially final.
  //   Used for the stroke-prediction tiebreak (their total strokes) and the "picked the
  //   champion" backup (their player id).
  // - standingsWinnerScore: the winner's total STROKE count — auto from the champion when final,
  //   else a commissioner-saved score. null while unknown.
  const tournamentChampion = isTournamentFinal
    ? players.find((p) => p.position === '1' && p.thru === 'F')
    : undefined;
  const championTotalStrokes =
    tournamentChampion?.total && tournamentChampion.total !== '--'
      ? parseInt(String(tournamentChampion.total), 10)
      : NaN;
  const standingsWinnerScore =
    (!isNaN(championTotalStrokes) ? championTotalStrokes : null) ??
    pool?.winnerScores?.[selectedTournament] ??
    null;
  const championId = tournamentChampion?.id ?? null;
  const CUT_STATUS_SET = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);

  const liveStandingEntries = (
    poolEntries.length > 0
      ? poolEntries
      : [
          {
            id: sessionUser?.id ?? 'guest-entry',
            name: userLabel,
            rosters: {
              [selectedTournament]:
                sessionUser?.rosters[selectedTournament] ??
                (selectedTournament === entriesTournamentId ? selectedRoster : DEFAULT_ROSTERS[selectedTournament]),
            },
            tieBreaks: sessionUser?.tieBreaks ?? {},
          },
          ...STATIC_ENTRIES,
        ]
  );

  const standings: StandingEntry[] = liveStandingEntries
    .map((entry) => {
      // Founder-pool history: on The Players only the commissioner's entry counted that season.
      const isPlayersTab = isFounderPool && selectedTournament === 'players';
      const isCommissioner = isFounderPool && entry.name === COMMISSIONER_DISPLAY_NAME;

      // For The Players tab: zero out everyone except Clayton Tucker
      if (isPlayersTab && !isCommissioner) {
        return {
          ...entry,
          picks: Array(REQUIRED_GOLFERS).fill(0) as number[],
          golfers: [],
          rosterPoints: 0,
          holesRemaining: 0,
          tieBreakValue: 0,
        };
      }

      const savedRoster = entry.rosters[selectedTournament];
      const picks =
        savedRoster && savedRoster.length > 0
          ? savedRoster
          : isCommissioner
            ? DEFAULT_ROSTERS[selectedTournament]
            : [];
      // Salary is stored per tournament, so override each golfer's salary with the one they carried in
      // the tournament being viewed (selectedTournament) — otherwise a past event would show the
      // current tournament's salaries (or $0). Falls back to $0 when that event has no uploaded list.
      // World rank, by contrast, stays on the global/static source everywhere except the salary pick
      // list — so pin it to the original rank here (matching the info popup), never the uploaded rank.
      const viewedSalaries = salaryByTournament[selectedTournament]?.salaries;
      const golfers = picks
        .map((id) => {
          const p = playersById[id];
          if (!p) return p;
          return { ...p, salary: viewedSalaries?.[id] ?? 0, worldRank: ORIGINAL_WORLD_RANK_BY_ID.get(id) ?? p.worldRank };
        })
        .filter(Boolean);
      const rosterPoints = golfers.reduce((sum, golfer) => sum + golfer.points, 0);
      const holesRemaining = golfers.reduce((sum, golfer) => sum + golfer.holesRemaining, 0);
      const tieBreakValue = entry.tieBreaks?.[selectedTournament] ?? (picks.reduce((sum, id) => sum + id, 0) + 270);

      return {
        ...entry,
        picks,
        golfers,
        rosterPoints,
        holesRemaining,
        tieBreakValue,
      };
    })
    .filter((entry) => selectedTournament === 'players' || entry.picks.length === REQUIRED_GOLFERS)
    .sort((left, right) => {
      // 1) Total points — most wins.
      if (right.rosterPoints !== left.rosterPoints) {
        return right.rosterPoints - left.rosterPoints;
      }

      // 2) Holes remaining — fewest wins (only differentiates mid-tournament; all 0 once final).
      if (left.holesRemaining !== right.holesRemaining) {
        return left.holesRemaining - right.holesRemaining;
      }

      // 3) Tiebreak prediction — closest to the champion's actual total stroke count wins.
      if (standingsWinnerScore != null) {
        const diff =
          Math.abs(left.tieBreakValue - standingsWinnerScore) -
          Math.abs(right.tieBreakValue - standingsWinnerScore);
        if (diff !== 0) return diff;
      } else if (left.tieBreakValue !== right.tieBreakValue) {
        return left.tieBreakValue - right.tieBreakValue;
      }

      // ── Backup tiebreakers: only reached when points, holes remaining, and the stroke
      //    prediction are all dead-even (e.g. two guesses equidistant from the winner). ──

      // 4) Picked the champion — an entry that rostered the actual winner beats one that didn't.
      const leftHasChampion = championId != null && left.picks.includes(championId);
      const rightHasChampion = championId != null && right.picks.includes(championId);
      if (leftHasChampion !== rightHasChampion) return leftHasChampion ? -1 : 1;

      // 5) Fewest golfers who missed the cut.
      const leftMissedCuts = left.golfers.filter((g) => CUT_STATUS_SET.has(String(g.score).toUpperCase())).length;
      const rightMissedCuts = right.golfers.filter((g) => CUT_STATUS_SET.has(String(g.score).toUpperCase())).length;
      if (leftMissedCuts !== rightMissedCuts) return leftMissedCuts - rightMissedCuts;

      // 6) Best-golfer points, cascading down each roster: compare the highest-scoring golfer,
      //    then the 2nd-highest, then the 3rd, and so on until one entry's golfer out-points the
      //    other's at the same rank.
      const leftPointsDesc = left.golfers.map((g) => g.points).sort((a, b) => b - a);
      const rightPointsDesc = right.golfers.map((g) => g.points).sort((a, b) => b - a);
      const maxGolfers = Math.max(leftPointsDesc.length, rightPointsDesc.length);
      for (let i = 0; i < maxGolfers; i++) {
        const l = leftPointsDesc[i] ?? -Infinity;
        const r = rightPointsDesc[i] ?? -Infinity;
        if (l !== r) return r - l; // more points wins
      }

      // Every measure identical — a genuine, unbreakable co-tie.
      return 0;
    })
    .map((entry, index) => ({ ...entry, place: index + 1 }));

  // Bank the pool's final standings once a tournament is complete, so members can view them under
  // "Past Results" in future seasons. Fires once per tournament/year per session; the server keeps
  // the larger snapshot if a partial render ever posts.
  useEffect(() => {
    if (!isTournamentFinal || standings.length === 0) return;
    const yearStr = TOURNAMENT_META[selectedTournament]?.year;
    const year = yearStr ? parseInt(yearStr, 10) : NaN;
    if (isNaN(year)) return;
    const key = `${selectedTournament}:${year}`;
    if (archivedThisSession.current.has(key)) return;
    archivedThisSession.current.add(key);
    fetch('/api/standings-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId: selectedTournament,
        year,
        standings: standings.map((e) => ({ place: e.place, name: e.name, points: e.rosterPoints, holesRemaining: e.holesRemaining, tieBreak: e.tieBreakValue, golfers: e.golfers.map((g) => ({ name: g.name, score: g.score, points: g.points, position: g.position, salary: g.salary })) })),
        payouts: selectedTournamentPayouts ? { first: selectedTournamentPayouts.first, second: selectedTournamentPayouts.second, third: selectedTournamentPayouts.third } : undefined,
      }),
    }).catch(() => { archivedThisSession.current.delete(key); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTournamentFinal, selectedTournament, standings.length]);

  const pickedPlayerIds = (() => {
    const ids = new Set<number>();
    for (const entry of liveStandingEntries) {
      for (const id of entry.rosters[selectedTournament] ?? []) {
        ids.add(id);
      }
    }
    return ids;
  })();

  useEffect(() => {
    if (!selectedLeaderboardPlayerId) return;
    const topEntry = standings.find((entry) =>
      entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
    );
    if (!topEntry) return;
    const el = document.querySelector<HTMLElement>(`[data-entry-id="${topEntry.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  // standings is a derived value; we only want to scroll on player selection changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaderboardPlayerId]);

  // With a leaderboard player selected (highlighting the entries that picked them), tapping
  // anywhere EXCEPT a highlighted entry clears the selection. Exempt: highlighted entry rows
  // (keep + open their popup), the leaderboard golfer rows (they manage their own toggle), and
  // anything inside an open modal/overlay (all render as fixed-position layers).
  useEffect(() => {
    if (!selectedLeaderboardPlayerId) return;
    let startX = 0, startY = 0;
    const onDown = (e: PointerEvent) => { startX = e.clientX; startY = e.clientY; };
    const onUp = (e: PointerEvent) => {
      // Only a near-stationary press counts as a tap — a scroll/drag moves the pointer,
      // so it should never clear the selection.
      if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) return;
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('[data-picked-highlight="true"]') || target.closest('[data-leaderboard-golfer="true"]')) return;
      for (let el: HTMLElement | null = target; el; el = el.parentElement) {
        if (window.getComputedStyle(el).position === 'fixed') return;
      }
      setSelectedLeaderboardPlayerId(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointerup', onUp, true);
    };
  }, [selectedLeaderboardPlayerId]);

  const activeStandingEntry = standings.find((entry) => entry.id === activeStandingEntryId) ?? null;
  const activeStandingGolfers = activeStandingEntry
    ? [...activeStandingEntry.golfers].sort((left, right) => {
        if (right.points !== left.points) {
          return right.points - left.points;
        }

        const leftPos = Number(left.position.replace('T', ''));
        const rightPos = Number(right.position.replace('T', ''));

        if (!Number.isNaN(leftPos) && !Number.isNaN(rightPos) && leftPos !== rightPos) {
          return leftPos - rightPos;
        }

        return left.salary - right.salary;
      })
    : [];
  const activeStandingGolfer = activeStandingGolfers.find((golfer) => golfer.id === activeStandingGolferId) ?? null;
  const pickedGolferIds = new Set(standings.flatMap((entry) => entry.golfers.map((golfer) => golfer.id)));
  const eventLeaderboardRows = [...players]
    .filter((player) => pickedGolferIds.has(player.id))
    .sort((left, right) => {
      const leftPos = Number(left.position.replace('T', ''));
      const rightPos = Number(right.position.replace('T', ''));

      if (!Number.isNaN(leftPos) && !Number.isNaN(rightPos) && leftPos !== rightPos) {
        return leftPos - rightPos;
      }

      return right.points - left.points;
    });

  const tieBreakValid = /^\d{3}$/.test(tieBreakInput);
  const canSave =
    Boolean(sessionUser) &&
    selectedRoster.length === REQUIRED_GOLFERS &&
    salaryUsed <= SALARY_CAP &&
    tieBreakValid &&
    !entriesLocked;

  const togglePlayer = (playerId: number) => {
    if (entriesLocked) {
      return;
    }

    if (selectedRoster.includes(playerId)) {
      setSelectedRoster(selectedRoster.filter((id) => id !== playerId));
      return;
    }

    if (selectedRoster.length >= REQUIRED_GOLFERS) {
      return;
    }

    const next = [...selectedRoster, playerId];
    const nextSalary = next.reduce((sum, id) => sum + playersById[id].salary, 0);

    if (nextSalary > SALARY_CAP) {
      return;
    }

    setSelectedRoster(next);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!sessionUser) {
      setSaveMessage('Create an account or sign in to save this lineup to the pool.');
      return false;
    }

    if (!canSave) {
      setSaveMessage('Lineup must have 6 golfers, stay under the salary cap, and be saved before lock.');
      return false;
    }

    try {
      const payload = await readJson<SessionPayload & { roster: number[] }>('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: entriesTournamentId,
          roster: selectedRoster,
          tieBreak: parseInt(tieBreakInput, 10),
        }),
      });

      applySession(payload);
      setSaveMessage('Lineup saved to your account for this tournament.');
      setMyEntriesEditorOpen(false);
      return true;
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save lineup.');
      return false;
    }
  };

  const handleCutClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCutIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        const t = expandedCutTimersRef.current.get(playerId);
        if (t !== undefined) clearTimeout(t);
        expandedCutTimersRef.current.delete(playerId);
        next.delete(playerId);
      } else {
        next.add(playerId);
        const t = setTimeout(() => {
          setExpandedCutIds((s) => { const n = new Set(s); n.delete(playerId); return n; });
          expandedCutTimersRef.current.delete(playerId);
        }, 10000);
        expandedCutTimersRef.current.set(playerId, t);
      }
      return next;
    });
  };

  // Open the live scorecard popup for a leaderboard player (used by row click and by the
  // Total-column score tap for picked players).
  const openLiveScorecard = (name: string, teeTime: string | null, thru: string | null, backNineStart: boolean) => {
    setScorecardGolferName(name);
    setScorecardGolferPhoto(null);
    setScorecardGolferTeeTime(teeTime);
    setScorecardGolferThru(thru);
    setScorecardGolferBackNineStart(backNineStart);
    setScorecardData(null);
    setScorecardLoading(true);
    fetch(`/api/scorecard?tournamentId=${selectedTournament}&playerName=${encodeURIComponent(name)}&round=${feed?.currentRound ?? 1}`)
      .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
  };
  const openTournamentHistory = (tournament: TournamentId, year: number) => {
    setHistoryRoster(null);
    setHistoryPopup({ tournament, year, loading: true, data: null });
    fetch(`/api/standings-archive?tournamentId=${tournament}&year=${year}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: ArchivedStandingsData) => setHistoryPopup({ tournament, year, loading: false, data }))
      .catch(() => setHistoryPopup({ tournament, year, loading: false, data: { available: false, error: 'fetch failed' } }));
  };
  const openCutScorecardFor = (name: string) => {
    setCutScorecardGolfer({ name, pgaTourId: 0, photoUrl: undefined });
    setCutScorecardData(null);
    setCutScorecardLoading(true);
    fetch(`/api/scorecard?tournamentId=${selectedTournament}&playerName=${encodeURIComponent(name)}&round=2`)
      .then(r => r.json()).then(setCutScorecardData).catch(() => setCutScorecardData(null)).finally(() => setCutScorecardLoading(false));
  };
  // CUT text in the Total column: single tap keeps the existing expand-to-score toggle,
  // double tap opens the player's scorecard popup.
  const cutTapRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const handleCutTotalTap = (playerId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = cutTapRef.current;
    if (existing && existing.id === playerId) {
      clearTimeout(existing.timer);
      cutTapRef.current = null;
      openCutScorecardFor(name); // double tap
    } else {
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        cutTapRef.current = null;
        handleCutClick(playerId, { stopPropagation: () => {} } as React.MouseEvent); // single tap = expand
      }, 260);
      cutTapRef.current = { id: playerId, timer };
    }
  };

  const handleMainTabChange = (tab: MainTab, options?: { refreshAfterChange?: boolean }) => {
    setAccountMenuOpen(false);
    setMyEntriesMenuOpen(false);
    setReportsMenuOpen(false);
    setPpsPickPopup(null);
    setPpsAllPlayerPopup(null);
    setHistoryPopup(null);
    setHistoryRoster(null);
    setActiveStandingEntryId(null);
    setActiveStandingGolferId(null);
    setCommissionerMemberModalOpen(false);
    setNowTick(window.performance.timeOrigin + window.performance.now());

    startTransition(() => {
      if (tab === 'Standings') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setFeedRefreshNonce((value) => value + 1);
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
      } else if (tab === 'My Entries') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Details') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Reports') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
      } else if (tab === 'Commissioner Hub') {
        setSelectedTournament(getDefaultTournamentId(getTournamentCardStatuses(new Date()), new Date()));
        setMyEntriesEditorOpen(false);
        setMyEntriesDetailView('none');
        setSaveMessage('');
        setSelectedLeaderboardPlayerId(null);
        setCommissionerConsoleView('dashboard');
        setCommissionerPicksSort('alpha');
        setPickPopularityOpen(false);
        setCommissionerRosterMemberId(null);
        setCommissionerMemberSearch('');
        setShowAddMemberForm(false);
        setCommissionerMembersRefreshNonce((value) => value + 1);
      }

      // Reports always return to their default, unselected state on any tab change — so
      // re-opening a report (which routes through handleMainTabChange('Reports')) never
      // auto-shows the last thing that was pulled.
      setPpsTournament('');
      setPpsSortBy('');
      setPpsSearch('');
      setPmpsEntryId('');
      setPmphEntryId('');
      setPpfTournament('');
      setPpfSearch('');
      setPpfSortKey('finish');
      setPpfSortDir('asc');
      setPpfSelectedRow(null);
      setPshTournament('');
      if (tab !== 'Reports') setSelectedReport(null);

      setLeaderboardSearch('');
      setLeaderboardViewMode('full');
      setLeaderboardSortMode('default');
      setLeaderboardPickedSort('default');
      setShowCutInfo(false);
      setMainTab(tab);
    });

    resetViewAfterMainTabChange();

    if (options?.refreshAfterChange) {
      void refreshCurrentSession();
    }
  };

  const openMyEntriesEditor = () => {
    loadSalaryOverrides.current(); // pull the latest uploaded salary list before showing the pick sheet
    setSaveMessage('');
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSelectedRoster(savedRoster.length > 0 ? savedRoster : []);
    const savedTieBreak = sessionUser?.tieBreaks?.[entriesTournamentId];
    setTieBreakInput(savedTieBreak != null ? String(savedTieBreak) : '');
    myEntriesReturnTabRef.current = mainTab; // so the pick sheet's back button returns here
    setMyEntriesEditorOpen(true);
    handleMainTabChange('My Entries');
    setMyEntriesEditorOpen(true);
  };

  const closeMyEntriesEditor = () => {
    setMyEntriesEditorOpen(false);
    setMyEntriesMenuOpen(false);
    setMyEntriesDetailView('none');
    setSaveMessage('');
    // Return to whichever tab the pick sheet was opened from (e.g. Standings' Make Picks button).
    if (myEntriesReturnTabRef.current !== 'My Entries') handleMainTabChange(myEntriesReturnTabRef.current);
  };

  const renderRosterCards = (background: string, allowRemove = false) => (
    <div style={{ display: 'grid', gap: isMobile ? 10 : 10 }}>
      {orderedRosterPlayers.map((player, index) => (
        <div
          key={player.id}
          style={{
            border: '1px solid #e6edf1',
            borderRadius: 16,
            padding: isMobile ? '16px 16px' : '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            background,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 10 }}>
            <img
              src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
              alt={player.name}
              className="roster-card-photo" style={{ width: isMobile ? 58 : 58, height: isMobile ? 58 : 58, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#fff' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 17 : 20 }}>{player.name}</div>
              <div style={{ marginTop: 4, fontSize: isMobile ? 13 : 14, color: '#6b7b88' }}>
                OWGR {player.worldRank} | {player.odds} | <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 16, color: '#3f73ad' }}>${player.salary.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 8 }}>
            {allowRemove ? (
              <button
                type="button"
                onClick={() => togglePlayer(player.id)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: '1px solid #c9d7e6',
                  background: '#eef4ff',
                  color: '#2f5f96',
                  fontSize: 22,
                  fontWeight: 900,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                −
              </button>
            ) : null}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, fontSize: isMobile ? 20 : 20 }}>{player.points}</div>
              <div style={{ fontSize: isMobile ? 13 : 12, color: selectedTournament === 'masters' ? '#2c6449' : '#2f5f96' }}>{player.holesRemaining} holes left</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderBudgetCards = (background: string, border: string) => (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 10,
      }}
    >
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Salary used</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${salaryUsed.toLocaleString()}</div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>Remaining</div>
        <div
          style={{
            marginTop: 6,
            fontSize: 22,
            fontWeight: 900,
            color: salaryRemaining < 0 ? '#b91c1c' : '#0f1720',
          }}
        >
          ${salaryRemaining.toLocaleString()}
        </div>
      </div>
      <div style={{ borderRadius: 16, background, padding: 18, border }}>
        <div style={{ fontSize: 12, color: '#5b6b79', textTransform: 'uppercase', fontWeight: 800 }}>
          Avg/player left
        </div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>${averageRemainingPerPlayer.toLocaleString()}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#6b7b88' }}>
          {playersNeeded === 0 ? 'Roster complete' : `${playersNeeded} spot${playersNeeded === 1 ? '' : 's'} left`}
        </div>
      </div>
    </div>
  );

  const formatPayoutAmount = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : '--';

  const headerBg =
    selectedTournament === 'us-open' ? 'linear-gradient(135deg, #BE3436 0%, #8c1c2e 100%)' :
    selectedTournament === 'masters' ? 'linear-gradient(135deg, #2c6449 0%, #1a3d2b 100%)' :
    selectedTournament === 'pga' ? 'linear-gradient(135deg, #B09963 0%, #7a6a3e 100%)' :
    'linear-gradient(135deg, #173b63 0%, #0e2440 100%)';

  const headerSolid =
    selectedTournament === 'us-open' ? '#BE3436' :
    selectedTournament === 'masters' ? '#2c6449' :
    selectedTournament === 'pga' ? '#B09963' :
    '#173b63';

  const entriesTournamentBg =
    entriesTournamentId === 'us-open' ? 'linear-gradient(135deg, #BE3436 0%, #8c1c2e 100%)' :
    entriesTournamentId === 'masters' ? 'linear-gradient(135deg, #2c6449 0%, #1a3d2b 100%)' :
    entriesTournamentId === 'pga' ? 'linear-gradient(135deg, #B09963 0%, #7a6a3e 100%)' :
    'linear-gradient(135deg, #173b63 0%, #0e2440 100%)';

  const entriesTournamentSolid =
    entriesTournamentId === 'us-open' ? '#BE3436' :
    entriesTournamentId === 'masters' ? '#2c6449' :
    entriesTournamentId === 'pga' ? '#B09963' :
    '#173b63';

  // Full display name for the pick-sheet header (The Open → The Open Championship).
  const entriesTournamentDisplayName =
    entriesTournamentId === 'players' ? 'The Players' :
    entriesTournamentId === 'masters' ? 'The Masters' :
    entriesTournamentId === 'pga' ? 'PGA Championship' :
    entriesTournamentId === 'us-open' ? 'U.S. Open' :
    entriesTournamentId === 'open' ? 'The Open' :
    entriesTournament.name;

  // Shaded fill + text tint that matches the Pick History entry bubbles, keyed to
  // the current tournament. Used for the "picks not open yet" warning message.
  const entriesWarningPalette: { bg: string; text: string } =
    entriesTournamentId === 'us-open' ? { bg: '#fde8e8', text: '#BE3436' } :
    entriesTournamentId === 'masters' ? { bg: '#d5eade', text: '#2c6449' } :
    entriesTournamentId === 'pga' ? { bg: '#f5edd8', text: '#7a6a3e' } :
    { bg: '#dce6f5', text: '#173b63' };

  const salaryColor = entriesTournamentId === 'open' ? headerSolid : entriesTournamentId === 'masters' ? '#2c6449' : '#3f73ad';

  const headerTabActiveColor = '#63d9ea';

  if (sessionLoading && !sessionUser) {
    return (
      <div
        style={{
          minHeight: '100svh',
          background:
            'radial-gradient(circle at top left, rgba(72, 126, 196, 0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3fb 100%)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '12px 10px 32px' : '32px 20px 40px' }}>
          <header
            style={{
              background: headerBg,
              color: '#fff',
              borderRadius: 28,
              padding: isMobile ? '10px 12px' : '10px 28px',
              boxShadow: '0 24px 64px rgba(9, 34, 51, 0.18)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src="/golf-majors-pool-logo-v11.png"
                alt="Golf Majors Pool"
                style={{
                  display: 'block',
                  width: isMobile ? 'min(100%, 260px)' : 'min(100%, 380px)',
                  height: 'auto',
                  objectFit: 'contain',
                  background: 'transparent',
                }}
              />
            </div>
          </header>
          <section
            style={{
              marginTop: 24,
              background: '#fff',
              borderRadius: 24,
              padding: isMobile ? 24 : 32,
              boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              textAlign: 'center',
              color: '#5b6b79',
              fontWeight: 800,
            }}
          >
            Loading your pool...
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        background:
          'radial-gradient(circle at top left, rgba(72, 126, 196, 0.18), transparent 28%), linear-gradient(180deg, #f7fbff 0%, #edf3fb 100%)',
        zoom: landscapeZoom,
      }}
    >
      {showHeaderCutInfo && <div onClick={() => setShowHeaderCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '2px 10px 32px' : '32px 20px 40px' }}>
        <header
          style={{
            background: headerBg,
            color: '#fff',
            borderRadius: 28,
            padding: isMobile ? (sessionUser ? '0px 12px 2px' : '2px 12px') : (sessionUser ? '10px 28px 6px' : '10px 28px'),
            boxShadow: '0 24px 64px rgba(9, 34, 51, 0.18)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src="/golf-majors-pool-logo-v11.png"
              alt="Golf Majors Pool"
              style={{
                display: 'block',
                width: isMobile ? 'min(100%, 278px)' : 'min(100%, 380px)',
                height: 'auto',
                objectFit: 'contain',
                background: 'transparent',
                marginTop: isMobile ? -12 : 0,
                marginBottom: isMobile ? -18 : 0,
              }}
            />
          </div>

          {/* No tabs until the user is in a league (the join gate is all there is to do). */}
          {sessionUser && (pool || sessionLoading) ? (
            <div
              style={{
                marginTop: 0,
                paddingTop: 2,
                borderTop: '1px solid rgba(112, 202, 220, 0.18)',
                display: 'flex',
                justifyContent: (isMobile && canManagePool) ? 'flex-start' : 'center',
                gap: isMobile ? 0 : 4,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                paddingLeft: isMobile ? 4 : 32,
                paddingRight: isMobile ? 4 : 32,
                paddingBottom: 2,
              }}
            >
              {MAIN_TABS
                .filter((tab) => tab !== 'Commissioner Hub' || canManagePool)
                .map((tab) => {
                  const active = tab === mainTab;
                  if (tab === 'Reports') {
                    return (
                      <button
                        key={tab}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setReportsMenuRect({ left: r.left, top: r.bottom, width: r.width });
                          setReportsMenuOpen((open) => !open);
                        }}
                        style={{
                          border: 'none',
                          borderBottom: active ? `3px solid ${headerTabActiveColor}` : '3px solid transparent',
                          background: 'transparent',
                          color: active ? headerTabActiveColor : '#ffffff',
                          padding: isMobile ? '6px 10px 8px' : '7px 12px 9px',
                          fontSize: isMobile ? 13 : 15,
                          fontWeight: 800,
                          cursor: 'pointer',
                          lineHeight: 1.1,
                          whiteSpace: 'nowrap',
                          flex: '0 0 auto',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        Reports
                        <ChevronDown size={isMobile ? 13 : 15} style={{ transform: reportsMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={tab}
                      onClick={() => handleMainTabChange(tab, { refreshAfterChange: true })}
                      style={{
                        border: 'none',
                        borderBottom: active ? `3px solid ${headerTabActiveColor}` : '3px solid transparent',
                        background: 'transparent',
                        color: active ? headerTabActiveColor : '#ffffff',
                        padding: isMobile ? '6px 10px 8px' : '7px 12px 9px',
                        fontSize: isMobile ? 13 : 15,
                        fontWeight: 800,
                        cursor: 'pointer',
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        flex: '0 0 auto',
                      }}
                    >
                      {tab === 'My Entries' ? 'My Entry' : tab === 'Commissioner Hub' ? 'Admin' : tab}
                    </button>
                  );
                })}
            </div>
          ) : null}

          {sessionUser && !canManagePool ? (
            <div style={{ position: 'absolute', right: isMobile ? 10 : 22, bottom: isMobile ? 6 : 6, zIndex: 30 }}>
              {accountMenuOpen ? (
                <button
                  type="button"
                  aria-label="Close account menu"
                  onClick={() => setAccountMenuOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'default',
                    padding: 0,
                    margin: 0,
                    zIndex: 10,
                    WebkitTapHighlightColor: 'transparent',
                    outline: 'none',
                  }}
                />
              ) : null}

              <button
                onClick={() => {
                  setAccountMenuOpen((current) => !current);
                  setAccountMessage('');
                  setAccountPreferencesView('root');
                  setAccountPassword('');
                  setAccountDisplayName(sessionUser.displayName);
                }}
                style={{
                  position: 'relative',
                  zIndex: 20,
                  width: (isMobile && !canManagePool) ? 34 : 42,
                  height: (isMobile && !canManagePool) ? 34 : 42,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: '#173b63',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <CircleUserRound size={(isMobile && !canManagePool) ? 17 : 20} />
              </button>

              {accountMenuOpen ? (
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: isMobile ? 'fixed' : 'absolute',
                    right: isMobile ? 10 : 0,
                    top: isMobile ? 100 : 'auto',
                    bottom: isMobile ? 'auto' : 54,
                    width: isMobile ? 270 : 336,
                    borderRadius: 18,
                    background: '#fff',
                    color: '#0f1720',
                    padding: isMobile ? 12 : 16,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.22)',
                    zIndex: 20,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Account
                  </div>
                  <div style={{ marginTop: 6, fontSize: isMobile ? 16 : 20, fontWeight: 900 }}>{sessionUser.displayName}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: '#6b7b88' }}>{sessionUser.email}</div>

                  {accountPreferencesView === 'password' ? (
                    <div style={{ position: 'relative', marginTop: 14 }}>
                      <input
                        type={showAccountPassword ? 'text' : 'password'}
                        value={accountPassword}
                        onChange={(event) => setAccountPassword(event.target.value)}
                        placeholder="New password"
                        style={{ ...fieldStyle(), marginTop: 0, paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccountPassword((v) => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7b88', display: 'flex', alignItems: 'center' }}
                      >
                        {showAccountPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  ) : null}

                  {accountPreferencesView === 'displayName' ? (
                    <input
                      value={accountDisplayName}
                      onChange={(event) => setAccountDisplayName(event.target.value)}
                      placeholder="Display name"
                      style={{ ...fieldStyle(), marginTop: 14 }}
                    />
                  ) : null}

                  {accountMessage ? (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color:
                          accountMessage === 'Password updated.' || accountMessage === 'Display name updated.'
                            ? '#2f5f96'
                            : '#a61b1b',
                      }}
                    >
                      {accountMessage}
                    </div>
                  ) : null}
                  <div style={{ marginTop: isMobile ? 10 : 14, display: 'flex', gap: 8 }}>
                    {accountPreferencesView === 'root' ? (
                      <button
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setLeagueModalOpen(true);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: '1px solid #d7e0e8',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#fff',
                          color: '#0f1720',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Leagues
                      </button>
                    ) : null}
                    {accountPreferencesView === 'root' ? (
                      <button
                        onClick={() => {
                          setAccountPreferencesView('preferences');
                          setAccountMessage('');
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Preferences
                      </button>
                    ) : null}

                    {accountPreferencesView === 'preferences' ? (
                      <>
                        <button
                          onClick={() => {
                            setAccountPreferencesView('password');
                            setAccountMessage('');
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: 'none',
                            borderRadius: 12,
                            padding: '12px 14px',
                            background: '#173b63',
                            color: '#fff',
                            fontWeight: 800,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span>Change</span>
                          <span>Password</span>
                        </button>
                        <button
                          onClick={() => {
                            setAccountPreferencesView('displayName');
                            setAccountMessage('');
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: '1px solid #d7e0e8',
                            borderRadius: 12,
                            padding: '12px 14px',
                            background: '#fff',
                            color: '#0f1720',
                            fontWeight: 800,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <span>Edit</span>
                          <span>Display Name</span>
                        </button>
                      </>
                    ) : null}

                    {accountPreferencesView === 'password' ? (
                      <button
                        onClick={handleUpdateOwnPassword}
                        disabled={accountBusy}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Password
                      </button>
                    ) : null}

                    {accountPreferencesView === 'displayName' ? (
                      <button
                        onClick={handleUpdateOwnDisplayName}
                        disabled={accountBusy}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 'none',
                          borderRadius: 12,
                          padding: '12px 14px',
                          background: '#173b63',
                          color: '#fff',
                          fontWeight: 800,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Name
                      </button>
                    ) : null}

                    <button
                      onClick={handleLogout}
                      disabled={authBusy}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: '1px solid #d7e0e8',
                        borderRadius: 12,
                        padding: '12px 14px',
                        background: '#fff',
                        color: '#0f1720',
                        fontWeight: 800,
                        cursor: authBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </header>

        {!sessionUser ? (
          <section
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 'min(480px, calc(100vw - 48px))',
                minHeight: 344,
                background: '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {authMode === 'login' ? <LogIn size={18} color="#2f5f96" /> : <UserPlus size={18} color="#2f5f96" />}
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </div>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); authMode === 'login' ? handleLogin() : handleRegister(); }}
                style={{ display: 'grid', gap: 12, flex: 1 }}
              >
                {authMode === 'register' ? (
                  <input
                    value={registerForm.displayName}
                    onChange={(event) => setRegisterForm({ ...registerForm, displayName: event.target.value })}
                    placeholder="Display name"
                    style={fieldStyle()}
                  />
                ) : null}

                <input
                  value={authMode === 'login' ? loginForm.email : registerForm.email}
                  onChange={(event) =>
                    authMode === 'login'
                      ? setLoginForm({ ...loginForm, email: event.target.value })
                      : setRegisterForm({ ...registerForm, email: event.target.value })
                  }
                  placeholder="Email"
                  style={fieldStyle()}
                />
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: 14, border: '1px solid #d7e0e8', background: '#fff' }}>
                  <input
                    type={showAuthPassword ? 'text' : 'password'}
                    value={authMode === 'login' ? loginForm.password : registerForm.password}
                    onChange={(event) =>
                      authMode === 'login'
                        ? setLoginForm({ ...loginForm, password: event.target.value })
                        : setRegisterForm({ ...registerForm, password: event.target.value })
                    }
                    placeholder="Password"
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: 15, background: 'transparent', minWidth: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((v) => !v)}
                    style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7b88', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    {showAuthPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {authMode === 'register' ? (
                  <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#5b6b79' }}>League code (from your commissioner&apos;s invite)</span>
                  <input
                    value={registerForm.joinCode}
                    onChange={(event) => setRegisterForm({ ...registerForm, joinCode: event.target.value.toUpperCase() })}
                    placeholder="League code (optional)"
                    autoCapitalize="characters"
                    autoComplete="off"
                    style={fieldStyle()}
                  />
                  </label>
                ) : null}
                <button
                  type="submit"
                  style={{
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: headerSolid,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: authBusy ? 'wait' : 'pointer',
                  }}
                  disabled={authBusy}
                >
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              {authMode === 'register' && (
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  style={{ marginTop: 14, border: 'none', background: 'transparent', color: '#2f5f96', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  Already have an account? Click here to sign in
                </button>
              )}

              {authMode === 'login' && (
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: '#2f5f96', display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotEmail('');
                      setForgotEmailExists(false);
                      setForgotNewPassword('');
                      setForgotMessage('');
                      setForgotSent(false);
                      setResetToken(null);
                      setShowForgotNewPassword(false);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2f5f96', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}
                  >
                    Forgot Password?
                  </button>
                  {REGISTRATION_OPEN && (
                    <>
                      <span style={{ color: '#5b6b79' }}>or sign up</span>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('register'); setAuthError(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2f5f96', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}
                      >
                        here
                      </button>
                    </>
                  )}
                </div>
              )}

              {forgotOpen && (
                <div
                  onClick={() => setForgotOpen(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 18px 48px rgba(9,34,51,0.25)' }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720', marginBottom: 16 }}>Forgot Password</div>

                    {!forgotEmailExists ? (
                      <>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="Enter your email"
                          style={{ ...fieldStyle(), width: '100%', boxSizing: 'border-box' }}
                        />
                        {forgotMessage && (
                          <div style={{ marginTop: 10, fontSize: 13, color: forgotSent ? '#1f8d4e' : '#a61b1b' }}>{forgotMessage}</div>
                        )}
                        <button
                          type="button"
                          disabled={forgotBusy}
                          onClick={async () => {
                            setForgotBusy(true);
                            setForgotMessage('');
                            setForgotSent(false);
                            try {
                              const res = await fetch('/api/auth/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: forgotEmail }),
                              });
                              const data = await res.json();
                              if (data.sent) {
                                setForgotSent(true);
                                setForgotMessage(data.message);
                              } else {
                                setForgotMessage(data.error ?? 'Something went wrong. Please try again.');
                              }
                            } catch {
                              setForgotMessage('Something went wrong. Please try again.');
                            } finally {
                              setForgotBusy(false);
                            }
                          }}
                          style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 14, padding: '13px 16px', background: 'linear-gradient(135deg, #487dc2 0%, #3c6ea9 100%)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: forgotBusy ? 'wait' : 'pointer' }}
                        >
                          {forgotBusy ? 'Checking…' : 'Continue'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: '#5b6b79', marginBottom: 12 }}>
                          Enter your new password below.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 14, border: '1px solid #d7e0e8', background: '#fff' }}>
                          <input
                            type={showForgotNewPassword ? 'text' : 'password'}
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            placeholder="New password (min 8 chars)"
                            style={{ flex: 1, border: 'none', outline: 'none', padding: '12px 14px', fontSize: 15, background: 'transparent', minWidth: 0 }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotNewPassword((v) => !v)}
                            style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7b88', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          >
                            {showForgotNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {forgotMessage && (
                          <div style={{ marginTop: 10, fontSize: 13, color: forgotMessage === 'Password updated successfully.' ? '#1f8d4e' : '#a61b1b' }}>{forgotMessage}</div>
                        )}
                        <button
                          type="button"
                          disabled={forgotBusy}
                          onClick={async () => {
                            setForgotBusy(true);
                            setForgotMessage('');
                            try {
                              const res = await fetch('/api/auth/reset-password', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token: resetToken, newPassword: forgotNewPassword }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setForgotMessage('Password updated successfully.');
                                // The reset signed them in; reload so the app picks up the new session.
                                setTimeout(() => window.location.replace('/'), 1500);
                              } else {
                                setForgotMessage(data.error ?? 'Something went wrong.');
                              }
                            } catch {
                              setForgotMessage('Something went wrong. Please try again.');
                            } finally {
                              setForgotBusy(false);
                            }
                          }}
                          style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 14, padding: '13px 16px', background: 'linear-gradient(135deg, #315f95 0%, #284f7d 100%)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: forgotBusy ? 'wait' : 'pointer' }}
                        >
                          {forgotBusy ? 'Updating…' : 'Update Password'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setForgotOpen(false)}
                      style={{ marginTop: 12, width: '100%', border: '1px solid #d7e0e8', borderRadius: 14, padding: '11px 16px', background: '#fff', color: '#5b6b79', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
        <></>
        )}

        {authError ? (
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              background: '#fff5f5',
              color: '#a61b1b',
              border: '1px solid #fecaca',
              padding: '14px 16px',
            }}
          >
            <AlertCircle size={18} />
            <span>{authError}</span>
          </div>
        ) : null}

        {sessionUser && !pool && !sessionLoading ? (
          <LeagueGate<SessionPayload>
            displayName={sessionUser.displayName}
            canCreateLeague={sessionFlags.canCreateLeague}
            initialJoinCode={pendingJoinCode}
            onSession={(payload) => { applySession(payload); setPendingJoinCode(''); settleViewAfterKeyboard(); }}
            onSignOut={() => void handleLogout()}
            onOpenPaywall={setPaywallMode}
          />
        ) : null}

        <PaywallModal<SessionPayload>
          key={paywallMode ? JSON.stringify(paywallMode) : 'closed'}
          open={paywallMode !== null && !!sessionUser}
          mode={paywallMode}
          userId={sessionUser?.id ?? ''}
          onClose={() => setPaywallMode(null)}
          onSession={(payload) => { applySession(payload); setPendingJoinCode(''); setMainTab('Standings'); }}
        />

        <LeagueModal<SessionPayload>
          open={leagueModalOpen && !!sessionUser}
          onClose={() => { setLeagueModalOpen(false); setPendingJoinCode(''); }}
          leagues={sessionFlags.leagues}
          activeLeagueId={pool?.id ?? null}
          activeJoinCode={pool?.joinCode ?? null}
          isCommissioner={canManagePool}
          canCreateLeague={sessionFlags.canCreateLeague}
          initialJoinCode={pendingJoinCode}
          onSession={(payload) => { applySession(payload); setPendingJoinCode(''); setMainTab('Standings'); }}
          activePlan={pool ? {
            id: pool.id,
            name: pool.name,
            plan: pool.plan ?? 'founder',
            memberLimit: pool.memberLimit ?? null,
            memberCount: pool.memberCount ?? poolEntries.length,
            paidSeason: pool.paidSeason ?? null,
            seasonExpired: pool.seasonExpired ?? false,
          } : null}
          onOpenPaywall={setPaywallMode}
          onAccountDeleted={() => {
            setSessionUser(null);
            setPool(null);
            setPoolEntries([]);
            setSessionFlags(NO_SESSION_FLAGS);
            clearStoredSession();
            clearStoredMainTab();
            setMainTab('Standings');
          }}
        />

        {sessionUser && pool ? (
        <>
        {/* A league whose season pass lapsed: members can't join or make picks until it's renewed. */}
        {pool.seasonExpired ? (
          <div style={{ marginTop: isMobile ? 10 : 16, borderRadius: 16, border: '1px solid #e7a3a3', background: '#fbf1f1', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, color: '#a61b1b', fontWeight: 700, lineHeight: 1.4 }}>
              {pool.name}&apos;s season pass has expired. {canManagePool ? 'Renew it to reopen picks and joining.' : 'Your commissioner can renew it in the app.'}
            </div>
            {canManagePool ? (
              <button
                onClick={() => setPaywallMode({ kind: 'renew', leagueId: pool.id, leagueName: pool.name, memberCount: pool.memberCount ?? poolEntries.length })}
                style={{ border: 'none', borderRadius: 12, padding: '9px 14px', background: '#173b63', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                Renew
              </button>
            ) : null}
          </div>
        ) : null}
        {/* Which league you're looking at, once there's more than one to tell apart. */}
        {sessionFlags.leagues.length > 1 || !isFounderPool ? (
          <div style={{ marginTop: isMobile ? 10 : 16, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setLeagueModalOpen(true)}
              style={{ border: '1px solid #d7e0e8', borderRadius: 999, background: '#fff', padding: '6px 14px', fontSize: 13, fontWeight: 800, color: '#173b63', cursor: 'pointer', boxShadow: '0 4px 12px rgba(9,34,51,0.06)' }}
            >
              {pool.name}{sessionFlags.leagues.length > 1 ? ' · Switch' : ''}
            </button>
          </div>
        ) : null}
        {mainTab === 'Standings' ? (
          <section
            style={{
              marginTop: isMobile ? 12 : 24,
              display: 'flex',
              overflowX: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 0,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                overflowY: 'hidden',
                width: '100%',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
                overscrollBehaviorX: 'contain',
                overscrollBehaviorY: 'none',
                touchAction: 'pan-x',
                borderBottom: '1px solid #d7e0e8',
              }}
            >
              {TOURNAMENTS.map((item, idx) => {
                const active = item.id === selectedTournament;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedTournament(item.id); setLeaderboardSearch(''); setLeaderboardViewMode('full'); setSelectedLeaderboardPlayerId(null); setLeaderboardSortMode('default'); setLeaderboardPickedSort('default'); setShowCutInfo(false); setFeedRefreshNonce((v) => v + 1); void refreshCurrentSession(); }}
                    style={{
                      border: active ? '1px solid #d7e0e8' : '1px solid rgba(0,0,0,0.1)',
                      borderBottom: active ? '1px solid #fff' : '1px solid rgba(0,0,0,0.1)',
                      background: active ? '#fff' : 'transparent',
                      color: active ? '#1f2f42' : '#46bfd1',
                      borderRadius: '10px 10px 0 0',
                      padding: isMobile ? '6px 4px 5px' : '10px 12px 9px',
                      width: isMobile ? '20%' : TOURNAMENT_CARD_WIDTH,
                      height: isMobile ? 42 : TOURNAMENT_CARD_HEIGHT,
                      boxSizing: 'border-box',
                      flex: isMobile ? '0 0 20%' : '0 0 auto',
                      textAlign: 'center',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: active ? 500 : 400,
                      lineHeight: 1.1,
                      boxShadow: 'none',
                      marginBottom: -1,
                      marginLeft: idx === 0 ? 0 : -1,
                      position: 'relative',
                      zIndex: active ? 1 : 0,
                    }}
                  >
                    {TOURNAMENT_TAB_LOGOS[item.id] ? (
                      <img
                        src={TOURNAMENT_TAB_LOGOS[item.id]}
                        alt={item.name}
                        style={{
                          maxWidth: '100%',
                          width: '100%',
                          height: isMobile ? (item.id === 'masters' ? 40 : item.id === 'pga' || item.id === 'players' ? 36 : 28) : (TOURNAMENT_TAB_LOGO_HEIGHTS[item.id] ?? 40),
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <span>{item.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: 16,
              background: '#fff5f5',
              color: '#a61b1b',
              border: '1px solid #fecaca',
              padding: '14px 16px',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {mainTab === 'Standings' && (
          <main
            style={{
              marginTop: isMobile ? 8 : 24,
              display: 'grid',
              gridTemplateColumns: (isMobile || showFutureTournamentView)
                ? 'minmax(0, 1fr)'
                : showFinalTournamentView
                ? isLandscapePhone ? 'minmax(0, 1.4fr) minmax(300px, 1fr)' : 'minmax(0, 1.7fr) minmax(360px, 0.9fr)'
                : isLandscapePhone ? 'minmax(0, 1.3fr) minmax(280px, 1fr)' : 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
              gap: 20,
            }}
          >
            <section
              ref={standingsColRef}
              style={{
                background: selectedTournament === 'open' ? '#F4BC41' : '#fff',
                borderRadius: 20,
                padding: isSmallMobile ? 12 : isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                alignSelf: 'start',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: isMobile ? 'flex-start' : 'center', position: 'relative' }}>
                <div>
                  {(selectedTournament === 'players' || selectedTournament === 'masters' || selectedTournament === 'pga' || selectedTournament === 'us-open' || selectedTournament === 'open') ? (() => {
                    const fullName = selectedTournament === 'players' ? 'The Players Championship' : selectedTournament === 'masters' ? 'The Masters Tournament' : selectedTournament === 'pga' ? 'The PGA Championship' : selectedTournament === 'us-open' ? 'U.S. Open Championship' : 'The Open Championship';
                    const fs = isSmallMobile ? 17 : isMobile ? 21 : (showLivePayoutStrip ? 25 : 30);
                    return (
                      <h2 style={{ margin: 0, fontSize: fs, fontWeight: 800, color: '#0f1720', lineHeight: 1.15 }}>{fullName}</h2>
                    );
                  })() : TOURNAMENT_HEADING_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_HEADING_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          display: 'block',
                          width: 'min(100%, 640px)',
                          height: 72,
                          objectFit: 'contain',
                          objectPosition: 'left center',
                        }}
                      />
                  ) : (
                    <h2 style={{ margin: 0, fontSize: 26, color: '#0f1720' }}>
                      {showFinalTournamentView ? tournament.name : `${tournament.name} Pool Standings`}
                    </h2>
                  )}
                  {isTournamentFinal && !showFutureTournamentView && TOURNAMENT_META[selectedTournament]?.courseName ? (() => {
                    const cn = TOURNAMENT_META[selectedTournament]!.courseName;
                    const fs = isMobile ? (cn.length > 23 ? 11.5 : cn.length > 18 ? 12.5 : 13.5) : (cn.length > 26 ? 13.5 : 14.5);
                    return <div style={{ marginTop: 3, fontSize: fs, lineHeight: isMobile ? '15px' : '17px', fontStyle: 'italic', fontWeight: 400, color: '#0f1720', whiteSpace: 'nowrap' }}>{cn}</div>;
                  })() : null}
                </div>
                {showLivePayoutStrip ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: isMobile ? 4 : 6, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: isSmallMobile ? 5 : 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isSmallMobile ? '3px 7px' : isMobile ? '4px 9px' : isLandscapePhone ? '3px 7px' : '6px 10px', fontSize: isSmallMobile ? 10 : isMobile ? 11 : isLandscapePhone ? 10 : 13, fontWeight: 800, color: '#fff', border: selectedTournament === 'masters' ? '1.5px solid #1a4a33' : selectedTournament === 'pga' ? '1.5px solid #8a7040' : selectedTournament === 'us-open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(30,80,50,0.45)' : selectedTournament === 'pga' ? '0 2px 8px rgba(140,112,64,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>
                        1st: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.first)}</span>
                      </div>
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isSmallMobile ? '3px 7px' : isMobile ? '4px 9px' : isLandscapePhone ? '3px 7px' : '6px 10px', fontSize: isSmallMobile ? 10 : isMobile ? 11 : isLandscapePhone ? 10 : 13, fontWeight: 800, color: '#fff', border: selectedTournament === 'masters' ? '1.5px solid #1a4a33' : selectedTournament === 'pga' ? '1.5px solid #8a7040' : selectedTournament === 'us-open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(30,80,50,0.45)' : selectedTournament === 'pga' ? '0 2px 8px rgba(140,112,64,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>
                        2nd: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.second)}</span>
                      </div>
                      <div style={{ borderRadius: 999, background: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', padding: isSmallMobile ? '3px 7px' : isMobile ? '4px 9px' : isLandscapePhone ? '3px 7px' : '6px 10px', fontSize: isSmallMobile ? 10 : isMobile ? 11 : isLandscapePhone ? 10 : 13, fontWeight: 800, color: '#fff', border: selectedTournament === 'masters' ? '1.5px solid #1a4a33' : selectedTournament === 'pga' ? '1.5px solid #8a7040' : selectedTournament === 'us-open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(30,80,50,0.45)' : selectedTournament === 'pga' ? '0 2px 8px rgba(140,112,64,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>
                        3rd: <span style={{ color: '#fff' }}>{formatPayoutAmount(selectedTournamentPayouts?.third)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setShowBonusPoints(true)}
                          style={{ fontSize: isMobile ? 9 : 10, fontWeight: 800, color: selectedTournament === 'masters' ? '#2c6449' : '#fff', background: selectedTournament === 'pga' ? '#173b63' : selectedTournament === 'us-open' ? '#173b63' : selectedTournament === 'open' ? '#c0392b' : selectedTournament === 'masters' ? '#F3E44D' : '#E0AB43', border: selectedTournament === 'masters' ? '1.5px solid #c8b800' : (selectedTournament === 'pga' || selectedTournament === 'us-open') ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #a07010', cursor: 'pointer', padding: isMobile ? '4px 10px' : isLandscapePhone ? '3px 7px' : '5px 12px', borderRadius: 999, letterSpacing: '0.07em', textTransform: 'uppercase', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(180,150,0,0.45)' : (selectedTournament === 'pga' || selectedTournament === 'us-open') ? '0 2px 8px rgba(14,45,140,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(180,140,0,0.4)' }}
                        >
                          Bonus Points
                        </button>
                      </div>
                      {isTournamentFinal && !showFutureTournamentView ? (
                        <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: (selectedTournament === 'players' || selectedTournament === 'masters' || selectedTournament === 'pga' || selectedTournament === 'us-open') ? '#c0392b' : '#0f1720', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'right' }}>
                          Final Results
                        </div>
                      ) : null}
                  </div>
                ) : !showFutureTournamentView && !showFinalTournamentView ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5b6b79', fontSize: 14 }}>
                    <RefreshCw size={15} />
                    <span>
                      {isLoading
                        ? 'Refreshing live scores...'
                        : formatRefresh(feed?.fetchedAt ?? null)}
                    </span>
                  </div>
                ) : null}
                {(selectedTournament === 'open' || selectedTournament === 'us-open' || selectedTournament === 'pga' || selectedTournament === 'masters' || selectedTournament === 'players') && showLivePayoutStrip && (
                  <img src={selectedTournament === 'open' ? '/open-o-logo.png' : selectedTournament === 'us-open' ? '/us-open-trophy-logo.png' : selectedTournament === 'masters' ? '/masters-map-logo.png' : selectedTournament === 'players' ? '/players-golfer-logo.png' : '/pga-seal-gold.png'} alt="" style={{ position: 'absolute', left: selectedTournament === 'us-open' ? '54.5%' : '54%', top: (isTournamentFinal && !showFutureTournamentView) ? (selectedTournament === 'us-open' ? (isMobile ? '83%' : '72%') : selectedTournament === 'players' ? (isMobile ? '85%' : '75%') : (isMobile ? '80%' : '70%')) : (isMobile ? '108%' : '75%'), transform: 'translate(-50%, -50%)', height: selectedTournament === 'us-open' ? (isMobile ? 57 : 85) : selectedTournament === 'pga' ? (isMobile ? 46 : 60) : selectedTournament === 'masters' ? (isMobile ? 46 : 60) : selectedTournament === 'players' ? (isMobile ? 63 : 86) : (isMobile ? 40 : 54), width: 'auto', objectFit: 'contain', pointerEvents: 'none' }} />
                )}
              </div>
              {!feed?.tournamentComplete && (feed?.currentRound ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#0f1720' }}>Round {feed?.currentRound}:</span>
                    {currentRoundSuspended ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fee2e2', border: '1.5px solid #991b1b', borderRadius: 6, padding: '2px 10px 2px 8px', fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#991b1b' }}>⚠ Suspended</span>
                    ) : currentRoundComplete ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: selectedTournament === 'open' ? '#F4BC41' : '#fff', border: '1.5px solid #991b1b', borderRadius: 6, padding: '2px 10px 2px 8px', fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#991b1b' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#991b1b', flexShrink: 0 }} />Complete
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: selectedTournament === 'open' ? '#F4BC41' : '#fff', border: '1.5px solid #15803d', borderRadius: 6, padding: '2px 10px 2px 8px', fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#15803d' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803d', flexShrink: 0 }} />In Progress
                      </span>
                    )}
                  </div>
                  {showProjectedCut && feed?.projectedCut ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
                        <button onClick={() => setShowCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', fontSize: isMobile ? 14 : 16, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }}>ⓘ</button>
                        {showCutInfo && (
                          <>
                            <div onClick={() => setShowCutInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                            <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 1, background: selectedTournament === 'open' ? '#173b63' : '#fff', border: selectedTournament === 'open' ? '1px solid #0c1f3a' : '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: selectedTournament === 'open' ? '#ffffff' : '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>
                              {(selectedTournament as string) === 'players' ? 'Top 65 & ties' : (selectedTournament as string) === 'masters' ? 'Top 50 & ties' : (selectedTournament as string) === 'pga' ? 'Top 70 & ties' : (selectedTournament as string) === 'us-open' ? 'Top 60 & ties' : 'Top 70 & ties'}
                            </div>
                          </>
                        )}
                      </span>
                      <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#000000' }}>Projected Cut: {feed.projectedCut}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#000000', whiteSpace: 'nowrap' }}>
                      {(feed?.currentRound === 2 && currentRoundComplete && feed?.projectedCut)
                        ? `Cut Line: ${feed.projectedCut}`
                        : currentRoundComplete && nextRoundStartLabel
                        ? `Rd ${nextRoundNum} Start: ${nextRoundStartLabel}`
                        : `Local Time: ${courseLocalTimeLabel}`}
                    </span>
                  )}
                </div>
              )}


              {showFutureTournamentView ? (
                <div
                  style={{
                    marginTop: isMobile ? 14 : 28,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(240px, 320px) minmax(0, 1fr)',
                    gap: isMobile ? 14 : 28,
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: isMobile ? 220 : 260,
                    }}
                  >
                    {TOURNAMENT_CARD_LOGOS[selectedTournament] ? (
                      <img
                        src={TOURNAMENT_CARD_LOGOS[selectedTournament]}
                        alt={tournament.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: (isMobile ? 220 : 260) * (selectedTournament === 'pga' ? 0.86 : selectedTournament === 'us-open' ? 0.9 : 1),
                          height: (isMobile ? 220 : 260) * (selectedTournament === 'pga' ? 0.86 : selectedTournament === 'us-open' ? 0.9 : 1),
                          objectFit: 'contain',
                          display: 'block',
                          transform: selectedTournament === 'players' ? 'translateY(10px) scale(1.12)' : selectedTournament === 'open' ? 'scale(1.18)' : undefined,
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ color: '#0f1720', fontSize: isMobile ? 14 : 17, lineHeight: 1.55 }}>
                    <FitOneLineText
                      base={isMobile ? 15 : 20}
                      min={isMobile ? 11 : 15}
                      text={`${
                        selectedTournament === 'pga'
                          ? 'The PGA Championship'
                          : selectedTournament === 'us-open'
                            ? 'The U.S. Open Championship'
                            : selectedTournament === 'open'
                              ? 'The Open Championship'
                            : selectedTournament === 'masters'
                              ? 'The Masters Tournament'
                            : selectedTournament === 'players'
                              ? 'The Players Championship'
                            : tournament.name
                      } begins on ${tournamentStartLabel}.`}
                    />
                    <div style={{ marginTop: 14 }}>
                      {picksOpenForTournament
                        ? `The field has been finalized and picks are now open in the pool. Build your lineup before ${lineupDeadlineLabel}.`
                        : `Picks can not be entered until the tournament field has been finalized and entered in our system on ${tournamentFieldMondayLabel}.`}
                    </div>

                    {picksOpenForTournament && selectedTournament === entriesTournamentId && sessionUser ? (
                      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <button
                          onClick={openMyEntriesEditor}
                          style={{
                            border: 'none',
                            borderRadius: 16,
                            padding: isMobile ? '10px 16px' : '11px 18px',
                            background: entriesTournamentSolid,
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 900,
                            cursor: 'pointer',
                            boxShadow: '0 14px 28px rgba(9, 34, 51, 0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 14} />
                          {hasSubmittedRoster ? 'Edit Picks' : 'Make Picks'}
                        </button>
                        <div style={{ color: selectedTournament === 'open' ? '#000000' : '#5b6b79', fontSize: isMobile ? 14 : 19, fontWeight: 600 }}>
                          Members with submitted picks:{' '}
                          <span
                            onClick={() => setShowSubmittedPicksPopup(true)}
                            style={{ color: '#0f1720', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                          >{submittedEntries.length}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : showFinalTournamentView ? (
                <div style={{ marginTop: (isTournamentFinal && !showFutureTournamentView) ? (isMobile ? 20 : 34) : (isMobile ? 14 : 28), overflowX: 'auto' }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Rank</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em' }}>Entry</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Points</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Holes Rem</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Tiebreak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          data-entry-id={entry.id}
                          data-picked-highlight={(selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? 'true' : undefined}
                          onClick={() => {
                            setActiveStandingGolferId(null);
                            setActiveStandingEntryId(entry.id);
                            // When a leaderboard player is selected, tapping an entry that did NOT
                            // pick that player clears the selection/highlights; tapping a highlighted
                            // entry (one that picked them) keeps it in place.
                            if (selectedLeaderboardPlayerId && !entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) {
                              setSelectedLeaderboardPlayerId(null);
                            }
                          }}
                          style={{
                            borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe'
                                : selectedTournament === 'open' ? '#F4BC41' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 12px 10px 8px', fontSize: isMobile ? 12 : 13, textAlign: 'center' }}>{entry.place}</td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px' }}>
                            <div
                              style={{
                                fontSize: isMobile ? 13 : 14,
                                color: '#0f1720',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {entry.name}
                              {isTournamentFinal && entry.place === 1 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥇</span>}
                              {isTournamentFinal && entry.place === 2 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥈</span>}
                              {isTournamentFinal && entry.place === 3 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥉</span>}
                            </div>
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', width: 52, fontWeight: 600 }}>{entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}</span> : entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.holesRemaining}</span> : entry.holesRemaining}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 8px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>{selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.tieBreakValue}</span> : entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: (isTournamentFinal && !showFutureTournamentView) ? (isMobile ? 20 : 34) : (isMobile ? 14 : 28), overflowX: 'auto' }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63', color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Rank</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em' }}>Entry</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Points</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Holes Rem</th>
                        <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em' }}>Tiebreak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((entry) => (
                        <tr
                          key={entry.id}
                          data-entry-id={entry.id}
                          data-picked-highlight={(selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? 'true' : undefined}
                          onClick={() => {
                            setActiveStandingGolferId(null);
                            setActiveStandingEntryId(entry.id);
                            // When a leaderboard player is selected, tapping an entry that did NOT
                            // pick that player clears the selection/highlights; tapping a highlighted
                            // entry (one that picked them) keeps it in place.
                            if (selectedLeaderboardPlayerId && !entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) {
                              setSelectedLeaderboardPlayerId(null);
                            }
                          }}
                          style={{
                            borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                            background:
                              selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)
                                ? selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe'
                                : selectedTournament === 'open' ? '#F4BC41' : '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 12px 10px 8px', fontSize: isMobile ? 12 : 13, textAlign: 'center' }}>{entry.place}</td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px' }}>
                            <div style={{ fontSize: isMobile ? 13 : 14, color: '#0f1720', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {entry.name}
                              {isTournamentFinal && entry.place === 1 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥇</span>}
                              {isTournamentFinal && entry.place === 2 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥈</span>}
                              {isTournamentFinal && entry.place === 3 && <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🥉</span>}
                            </div>
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', width: 52, fontWeight: 600 }}>{entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}</span> : entry.rosterPoints % 1 === 0 ? entry.rosterPoints : entry.rosterPoints.toFixed(1)}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px' : '10px 12px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>
                            {selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.holesRemaining}</span> : entry.holesRemaining}
                          </td>
                          <td style={{ padding: isMobile ? '10px 8px 10px 4px' : '10px 8px', textAlign: 'center', fontSize: isMobile ? 12 : 14 }}>{selectedTournament === 'open' ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (selectedLeaderboardPlayerId && entry.golfers.some((golfer) => golfer.id === selectedLeaderboardPlayerId)) ? '#BFDBFE' : '#FBD96F', color: '#0f1720', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 600 }}>{entry.tieBreakValue}</span> : entry.tieBreakValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
            )}
            </section>

            <aside style={{ display: showFutureTournamentView ? 'none' : 'grid', gap: 20, alignSelf: isMobile ? undefined : 'start' }}>
              {showLivePayoutStrip ? (
                <section
                  ref={leaderboardColRef}
                  style={{
                    background: selectedTournament === 'open' && !showFutureTournamentView ? '#F4BC41' : '#fff',
                    borderRadius: 20,
                    padding: isMobile ? 14 : 22,
                    boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                    ...(isMobile ? {} : { display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' as const, maxHeight: 'calc(100vh - 120px - var(--safe-y))' }),
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 16 }}>
                    {tournament.id === 'us-open' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 7 : 6, width: '100%' }}>
                        <img src="/us-open-tab-logo.png" alt="U.S. Open" style={{ height: isMobile ? 38 : 40, objectFit: 'contain', flexShrink: 0, marginTop: isMobile ? -4 : 0 }} />
                        <span style={{ fontSize: isMobile ? 24 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1, marginTop: isMobile ? -2 : 0, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 60 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'pga' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, width: '100%' }}>
                        <img src="/pga-tab-logo.png" alt="PGA" style={{ height: isMobile ? 50 : 58, objectFit: 'contain', flexShrink: 0, margin: isMobile ? '-11px 0' : '-14px 0' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 70 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'masters' ? (
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: isMobile ? 6 : 10, width: '100%' }}>
                        <img src="/masters-tab-logo.png" alt="Masters" style={{ height: isMobile ? 38 : 46, objectFit: 'contain', flexShrink: 0, marginTop: isMobile ? '-6px' : '-8px' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#2c6449', lineHeight: 1, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 50 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'open' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 7 : 10, width: '100%' }}>
                        <img src="/open-tab-logo.png" alt="The Open" style={{ height: isMobile ? 44 : 46, objectFit: 'contain', flexShrink: 0 }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#0c1f3a', lineHeight: 1, position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#000000', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#173b63', border: '1px solid #0c1f3a', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 70 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : tournament.id === 'players' ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 6 : 10, width: '100%', marginTop: isMobile ? -36 : 0, marginBottom: isMobile ? -36 : 0 }}>
                        <img src="/tpc.webp" alt="The Players" style={{ height: isMobile ? 106 : 116, objectFit: 'contain', flexShrink: 0, margin: isMobile ? '0' : '-34px 0' }} />
                        <span style={{ fontSize: isMobile ? 21 : 25, fontWeight: 900, color: '#173b63', lineHeight: 1, marginTop: isMobile ? '6px' : '0', position: 'relative' }}>
                          Leaderboard
                          <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', paddingLeft: 3 }}>
                            <button onClick={() => setShowHeaderCutInfo((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }} aria-label="Cut line info">ⓘ</button>
                            {showHeaderCutInfo && (<><div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, background: '#fff', border: '1px solid #d1dae3', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.13)', zIndex: 10 }}>Cut Line: Top 65 & ties</div></>)}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <h3 style={{ margin: 0, fontSize: isMobile ? 17 : 22, color: '#0f1720', textAlign: 'center', fontWeight: 900, width: '100%' }}>{TOURNAMENT_LEADERBOARD_HEADER[(tournament as { id: string }).id] ?? `${(tournament as { name: string }).name} Leaderboard`}</h3>
                    )}
                  </div>

                  <div style={{ marginTop: isMobile ? 8 : 16, position: 'relative', marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Search player..."
                      value={leaderboardSearch}
                      onChange={(e) => {
                        setLeaderboardSearch(e.target.value);
                        if (isMobile) {
                          requestAnimationFrame(() => {
                            leaderboardColRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
                          });
                        }
                      }}
                      onFocus={(e) => {
                        if (!isMobile) return;
                        setTimeout(() => {
                          leaderboardColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 350);
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: isMobile ? '4px 32px 4px 10px' : `6px ${leaderboardSearch ? 32 : 12}px 6px 12px`,
                        fontSize: isMobile ? 16 : 13,
                        border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3',
                        borderRadius: 8,
                        outline: 'none',
                        color: '#0f1720',
                        background: '#fff',
                      }}
                    />
                    {leaderboardSearch && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setLeaderboardSearch(''); }}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: '#9ca3af',
                          border: 'none',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          lineHeight: 1,
                          touchAction: 'manipulation',
                        }}
                        aria-label="Clear search"
                      >
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                      </button>
                    )}
                  </div>
                  {(() => {
                    const tColor = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                    return (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {(['full', 'picked'] as const).map((mode) => {
                          const isActive = leaderboardViewMode === mode;
                          const label = mode === 'picked' ? 'Picked Only' : 'Full Leaderboard';
                          return (
                            <button
                              key={mode}
                              onClick={async (e) => {
                                (e.currentTarget as HTMLButtonElement).blur();
                                if (mode === 'full' && !currentFullLeaderboardRows) {
                                  try {
                                    const data = await readJson<FeedResponse>(`/api/leaderboard?tournamentId=${selectedTournament}&fullField=true`, { cache: 'no-store' });
                                    setFullLeaderboardRows(prev => ({ ...prev, [selectedTournament]: data.fullLeaderboard ?? [] }));
                                  } catch { /* keep existing view */ }
                                }
                                setLeaderboardSortMode('default');
                                setLeaderboardPickedSort('default');
                                setLeaderboardViewMode(mode);
                              }}
                              style={{
                                flex: 1,
                                padding: isMobile ? '4px 6px' : '7px 12px',
                                fontSize: isMobile ? 12 : 12,
                                fontWeight: 700,
                                borderRadius: 8,
                                border: `1.5px solid ${tColor}`,
                                background: isActive ? tColor : (selectedTournament === 'open' ? '#F4BC41' : '#fff'),
                                color: isActive ? '#fff' : tColor,
                                cursor: 'pointer',
                                transition: 'background 0.15s, color 0.15s',
                                touchAction: 'manipulation',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div style={{ overflowX: 'auto', overflowY: 'auto', ...(isMobile ? {} : { flex: 1, minHeight: 0, overscrollBehavior: 'contain' }) }}>
                    <div data-leaderboard-table="true" style={{ borderRadius: 10, overflow: isMobile ? 'auto' : 'clip', maxHeight: isMobile ? 726 : undefined, WebkitOverflowScrolling: isMobile ? 'touch' : undefined, border: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #d1dae3' } as React.CSSProperties}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 12 : 12 }}>
                      <thead>
                        {(() => {
                          const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                          const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: hBg };
                          return (
                            <tr style={{ background: hBg, color: '#ffffff', fontSize: isMobile ? 10 : 11, textAlign: 'left' }}>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Pos.</th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Player</th>
                              <th
                                onClick={() => { setLeaderboardPickedSort('default'); setLeaderboardSortMode((m) => m === 'default' ? 'round-desc' : m === 'round-desc' ? 'round-asc' : 'default'); }}
                                style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', userSelect: 'none', ...stickyTh }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                  {leaderboardSortMode === 'default' ? 'Total' : `Rnd ${feed?.currentRound ?? 1}`}
                                  {leaderboardSortMode === 'round-desc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▼</span>}
                                  {leaderboardSortMode === 'round-asc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▲</span>}
                                </span>
                              </th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Thru</th>
                              <th
                                onClick={() => leaderboardViewMode === 'picked' && (() => { setLeaderboardSortMode('default'); setLeaderboardPickedSort((m) => m === 'default' ? 'desc' : m === 'desc' ? 'asc' : 'default'); })()}
                                style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', cursor: leaderboardViewMode === 'picked' ? 'pointer' : 'default', userSelect: leaderboardViewMode === 'picked' ? 'none' : undefined, ...stickyTh }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  Picked
                                  {leaderboardViewMode === 'picked' && leaderboardPickedSort === 'desc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▼</span>}
                                  {leaderboardViewMode === 'picked' && leaderboardPickedSort === 'asc' && <span style={{ fontSize: isMobile ? 8 : 9 }}>▲</span>}
                                </span>
                              </th>
                              <th style={{ padding: isMobile ? '8px 4px' : '9px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.04em', ...stickyTh }}>Info</th>
                            </tr>
                          );
                        })()}
                      </thead>
                      <tbody>
                        {leaderboardViewMode === 'full'
                          ? (() => {
                              if (currentFullLeaderboardRows === null) {
                                return <tr><td colSpan={6} style={{ padding: '28px 16px', textAlign: 'center', color: '#6b7b88', fontSize: isMobile ? 12 : 13 }}>Loading leaderboard…</td></tr>;
                              }
                              const filteredFullRaw = currentFullLeaderboardRows.filter((player) => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()));
                              const CUT_SCORE_SET_FL = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                              const parseCutScore = (s?: string) => { if (!s) return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseRndScoreFL = (s: string | null | undefined) => { if (!s || s === '--') return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseTeeTimeMinFL = (t: string | null | undefined) => { if (!t) return Infinity; const m = t.match(/(\d{1,2}):(\d{2}):/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : Infinity; };
                              const filteredFull = leaderboardSortMode !== 'default'
                                // Round 2 sort keeps the WHOLE field — cut players played round 2, so their
                                // round-2 scores must appear. Rounds 3/4 exclude cut players (they didn't play).
                                ? [...filteredFullRaw].filter((p) => (feed?.currentRound ?? 1) === 2 || !CUT_SCORE_SET_FL.has(p.score.toUpperCase())).sort((a, b) => {
                                    const aS = parseRndScoreFL(a.currentRoundScore);
                                    const bS = parseRndScoreFL(b.currentRoundScore);
                                    if (aS !== bS) return leaderboardSortMode === 'round-desc' ? aS - bS : bS - aS;
                                    if (aS === Infinity) { const aT = parseTeeTimeMinFL(a.teeTime); const bT = parseTeeTimeMinFL(b.teeTime); if (aT !== bT) return aT - bT; }
                                    return a.name.localeCompare(b.name);
                                  })
                                : [
                                    ...filteredFullRaw.filter((p) => !CUT_SCORE_SET_FL.has(p.score.toUpperCase()) && !((feed?.currentRound ?? 1) === 1 && p.thru === '--')).sort((a, b) => {
                                      const parseScoreFL = (s: string) => s === 'E' ? 0 : (parseFloat(s) || 0);
                                      const aScore = parseScoreFL(a.score); const bScore = parseScoreFL(b.score);
                                      if (aScore !== bScore) return aScore - bScore;
                                      const toHolesFL = (thru: string) => thru === 'F' ? 18 : thru === '--' ? -1 : (parseInt(thru) || -1);
                                      const aH = toHolesFL(a.thru); const bH = toHolesFL(b.thru);
                                      if (aH === -1 && bH === -1) { const aT = parseTeeTimeMinFL(a.teeTime); const bT = parseTeeTimeMinFL(b.teeTime); return bT - aT; }
                                      return bH - aH;
                                    }),
                                    ...filteredFullRaw.filter((p) => !CUT_SCORE_SET_FL.has(p.score.toUpperCase()) && (feed?.currentRound ?? 1) === 1 && p.thru === '--').sort((a, b) => parseTeeTimeMinFL(a.teeTime) - parseTeeTimeMinFL(b.teeTime)),
                                    ...filteredFullRaw.filter((p) => CUT_SCORE_SET_FL.has(p.score.toUpperCase()) && p.score.toUpperCase() !== 'WD' && p.score.toUpperCase() !== 'DQ').sort((a, b) => parseCutScore(a.originalScore) - parseCutScore(b.originalScore)),
                                    ...filteredFullRaw.filter((p) => p.score.toUpperCase() === 'WD' || p.score.toUpperCase() === 'DQ'),
                                  ];
                              const espnRoundFL = feed?.currentRound ?? 1;
                              const projCutNum = showProjectedCut && feed?.projectedCut && leaderboardSortMode === 'default' && espnRoundFL <= 2
                                ? (feed.projectedCut === 'E' ? 0 : parseFloat(feed.projectedCut) || 0)
                                : null;
                              const cutLineIdx = projCutNum !== null
                                ? filteredFull.reduce((last, p, i) => {
                                    const s = p.score.toUpperCase();
                                    if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF' || s === 'MC') return last;
                                    const n = s === 'E' ? 0 : parseFloat(p.score);
                                    return !isNaN(n) && n <= projCutNum ? i : last;
                                  }, -1)
                                : -1;
                              const derivedCutScoreFL = (espnRoundFL >= 3 || (espnRoundFL === 2 && currentRoundComplete)) ? (() => {
                                const scores = (currentFullLeaderboardRows ?? []).filter(p => p.score === 'CUT' && p.originalScore).map(p => p.originalScore === 'E' ? 0 : parseFloat(p.originalScore!)).filter(n => !isNaN(n));
                                if (!scores.length) return null;
                                const cutLine = Math.min(...scores) - 1;
                                return cutLine === 0 ? 'E' : cutLine > 0 ? `+${cutLine}` : String(cutLine);
                              })() : null;
                              const effectiveCutScoreFL = feed?.projectedCut ?? derivedCutScoreFL;
                              const r34CutLineFL = leaderboardSortMode === 'default' && (espnRoundFL >= 3 || (espnRoundFL === 2 && currentRoundComplete && cutAssigned)) && effectiveCutScoreFL
                                ? filteredFull.reduce((last, p, i) => CUT_SCORE_SET_FL.has(p.score.toUpperCase()) ? last : i, -1)
                                : -1;
                              return filteredFull.map((player, rowIndex) => {
                                const timesPicked = player.poolPlayerId !== null
                                  ? standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === player.poolPlayerId).length, 0)
                                  : 0;
                                const activePlayer = player.poolPlayerId !== null && selectedLeaderboardPlayerId === player.poolPlayerId;
                                const notStartedR1 = (feed?.currentRound ?? 1) === 1 && player.thru === '--';
                                const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                const displayScore = showProjectedCut && isCutStatus && player.originalScore ? player.originalScore : player.score;
                                const displayScoreNum = parseFloat(displayScore);
                                const displayIsUnderPar = !isNaN(displayScoreNum) && displayScoreNum < 0;
                                const displayIsCut = displayScore === 'CUT' || displayScore === 'MDF' || displayScore === 'WD' || displayScore === 'DQ';
                                const colVal = leaderboardSortMode !== 'default' ? (player.currentRoundScore ?? '--') : displayScore;
                                const colNum = parseFloat(colVal);
                                const colUnderPar = !isNaN(colNum) && colNum < 0;
                                const colIsCut = displayIsCut && leaderboardSortMode === 'default';
                                const useRedBadge = selectedTournament === 'open' && colUnderPar;
                                const useNavyBadge = selectedTournament === 'open' && !colUnderPar && !colIsCut && colVal !== '--' && (colVal === 'E' || (!isNaN(colNum) && colNum > 0));
                                const rowBg = activePlayer ? (selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe') : selectedTournament === 'open' ? '#F4BC41' : '#ffffff';
                                return (
                                  <Fragment key={player.playerId}>
                                    <tr
                                      data-leaderboard-golfer="true"
                                      onClick={() => {
                                        if (player.poolPlayerId !== null && timesPicked > 0) {
                                          setSelectedLeaderboardPlayerId(activePlayer ? null : player.poolPlayerId);
                                        } else if (player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ') {
                                          openCutScorecardFor(player.name);
                                        } else {
                                          openLiveScorecard(player.name, player.teeTime ?? null, player.thru, player.backNineStart ?? false);
                                        }
                                      }}
                                      style={{ background: rowBg, borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef', cursor: 'pointer' }}
                                    >
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: 600, color: selectedTournament === 'open' ? '#0f1720' : '#374151' }}>{notStartedR1 ? '—' : (player.score === 'WD' || player.score === 'DQ') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{player.score}</span> : formatLeaderboardPosition(player.position)}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', fontWeight: activePlayer ? 800 : 500, color: '#0f1720' }}>{player.name}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: colIsCut ? 600 : 700, color: colUnderPar && !useRedBadge ? '#dc2626' : (useNavyBadge ? '#0f1720' : (colVal === 'E' ? '#16a34a' : (colIsCut ? '#374151' : '#0f1720'))) }}>{notStartedR1 ? '—' : player.score === 'CUT' && player.originalScore && leaderboardSortMode === 'default' ? <span onClick={(e) => handleCutTotalTap(String(player.playerId), player.name, e)} style={{ cursor: 'pointer', display: 'inline-block', minWidth: 34, textAlign: 'center', WebkitTapHighlightColor: 'transparent', userSelect: 'none', touchAction: 'manipulation' }}>{expandedCutIds.has(String(player.playerId)) ? player.originalScore : 'CUT'}</span> : (() => { const valNode = useRedBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : useNavyBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a5f', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : (colIsCut && colVal !== 'CUT') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : colVal; return (player.poolPlayerId !== null && timesPicked > 0) ? <span onClick={(e) => { e.stopPropagation(); openLiveScorecard(player.name, player.teeTime ?? null, player.thru, player.backNineStart ?? false); }} style={{ cursor: 'pointer', display: 'inline-block', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>{valNode}</span> : valNode; })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', whiteSpace: 'nowrap', color: selectedTournament === 'open' ? '#000000' : '#374151' }}>{(() => {
                                        const isGoldTheme = selectedTournament === 'open';
                                        const thruDisplay = (() => {
                                          if (player.score === 'WD' || player.score === 'DQ') return '--';
                                          const isLive = selectedTournamentStatus?.label === 'IN PROGRESS';
                                          if (isLive && !isCutStatus && player.thru === '--' && player.teeTime) {
                                            return teeTimeIsPast(player.teeTime) ? '--' : formatTeeTime(player.teeTime);
                                          }
                                          const clientRound = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                                          const espnRound = feed?.currentRound ?? 1;
                                          if (isLive && !isCutStatus && player.thru === 'F' && clientRound > espnRound) {
                                            return player.teeTime ? formatTeeTime(player.teeTime) : '--';
                                          }
                                          const thruVal = player.thru;
                                          return player.backNineStart && thruVal !== '--' && thruVal !== 'F'
                                            ? <span style={{ position: 'relative', display: 'inline-block' }}>{thruVal}<span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65em', lineHeight: 1 }}>*</span></span>
                                            : thruVal;
                                        })();
                                        return thruDisplay;
                                      })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: selectedTournament === 'open' ? '#000000' : (timesPicked > 0 ? '#374151' : '#b0bec5') }}>{timesPicked > 0 ? timesPicked : '–'}</td>
                                      <td style={{ padding: isMobile ? '6px 2px' : '7px 6px', textAlign: 'center' }}><button onClick={(e) => { e.stopPropagation(); const poolPlayer = player.poolPlayerId !== null ? playersById[player.poolPlayerId] : undefined; openPlayerPopup({ id: player.poolPlayerId ?? 0, name: player.name, pgaTourId: poolPlayer?.pgaTourId ?? 0, photoUrl: poolPlayer?.photoUrl, worldRank: poolPlayer?.worldRank }); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: selectedTournament === 'open' ? '#000000' : '#607282', lineHeight: 1, touchAction: 'manipulation' }}>ⓘ</button></td>
                                    </tr>
                                    {rowIndex === cutLineIdx && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>PROJECTED CUT{feed?.projectedCut ? `: ${feed.projectedCut}` : ''}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {rowIndex === r34CutLineFL && !leaderboardSearch && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE: {effectiveCutScoreFL}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              });
                            })()
                          : (() => {
                              const filteredPickedRaw = eventLeaderboardRows.filter((player) => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase()));
                              const CUT_SCORE_SET_PO = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                              const parseCutScorePO = (s?: string) => { if (!s) return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseRndScorePO = (s: string | null | undefined) => { if (!s || s === '--') return Infinity; if (s === 'E') return 0; const n = parseFloat(s); return isNaN(n) ? Infinity : n; };
                              const parseTeeTimeMinPO = (t: string | null | undefined) => { if (!t) return Infinity; const m = t.match(/(\d{1,2}):(\d{2}):/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : Infinity; };
                              const pickedCountMap = new Map<number, number>();
                              for (const entry of standings) {
                                for (const golfer of entry.golfers) {
                                  pickedCountMap.set(golfer.id, (pickedCountMap.get(golfer.id) ?? 0) + 1);
                                }
                              }
                              const filteredPicked = leaderboardPickedSort !== 'default'
                                ? [...filteredPickedRaw].sort((a, b) => {
                                    const aP = pickedCountMap.get(a.id) ?? 0;
                                    const bP = pickedCountMap.get(b.id) ?? 0;
                                    if (aP !== bP) return leaderboardPickedSort === 'desc' ? bP - aP : aP - bP;
                                    return a.name.localeCompare(b.name);
                                  })
                                : leaderboardSortMode !== 'default'
                                ? [...filteredPickedRaw].filter((p) => (feed?.currentRound ?? 1) === 2 || !CUT_SCORE_SET_PO.has(p.score.toUpperCase())).sort((a, b) => {
                                    const aS = parseRndScorePO(a.currentRoundScore);
                                    const bS = parseRndScorePO(b.currentRoundScore);
                                    if (aS !== bS) return leaderboardSortMode === 'round-desc' ? aS - bS : bS - aS;
                                    if (aS === Infinity) { const aT = parseTeeTimeMinPO(a.teeTime); const bT = parseTeeTimeMinPO(b.teeTime); if (aT !== bT) return aT - bT; }
                                    return a.name.localeCompare(b.name);
                                  })
                                : [
                                    ...filteredPickedRaw.filter((p) => !CUT_SCORE_SET_PO.has(p.score.toUpperCase()) && !((feed?.currentRound ?? 1) === 1 && p.thru === '--')).sort((a, b) => {
                                      const parseScorePO = (s: string) => s === 'E' ? 0 : (parseFloat(s) || 0);
                                      const aScore = parseScorePO(a.score); const bScore = parseScorePO(b.score);
                                      if (aScore !== bScore) return aScore - bScore;
                                      const toHolesPO = (thru: string) => thru === 'F' ? 18 : thru === '--' ? -1 : (parseInt(thru) || -1);
                                      const aH = toHolesPO(a.thru); const bH = toHolesPO(b.thru);
                                      if (aH === -1 && bH === -1) { const aT = parseTeeTimeMinPO(a.teeTime); const bT = parseTeeTimeMinPO(b.teeTime); return bT - aT; }
                                      return bH - aH;
                                    }),
                                    ...filteredPickedRaw.filter((p) => !CUT_SCORE_SET_PO.has(p.score.toUpperCase()) && (feed?.currentRound ?? 1) === 1 && p.thru === '--').sort((a, b) => parseTeeTimeMinPO(a.teeTime) - parseTeeTimeMinPO(b.teeTime)),
                                    ...filteredPickedRaw.filter((p) => CUT_SCORE_SET_PO.has(p.score.toUpperCase()) && p.score.toUpperCase() !== 'WD' && p.score.toUpperCase() !== 'DQ').sort((a, b) => parseCutScorePO(a.originalScore) - parseCutScorePO(b.originalScore)),
                                    ...filteredPickedRaw.filter((p) => p.score.toUpperCase() === 'WD' || p.score.toUpperCase() === 'DQ'),
                                  ];
                              const espnRoundPO = feed?.currentRound ?? 1;
                              const projCutNum = showProjectedCut && feed?.projectedCut && leaderboardSortMode === 'default' && leaderboardPickedSort === 'default' && espnRoundPO <= 2
                                ? (feed.projectedCut === 'E' ? 0 : parseFloat(feed.projectedCut) || 0)
                                : null;
                              const cutLineIdx = projCutNum !== null
                                ? filteredPicked.reduce((last, p, i) => {
                                    const s = p.score.toUpperCase();
                                    if (s === 'CUT' || s === 'WD' || s === 'DQ' || s === 'MDF' || s === 'MC') return last;
                                    const n = s === 'E' ? 0 : parseFloat(p.score);
                                    return !isNaN(n) && n <= projCutNum ? i : last;
                                  }, -1)
                                : -1;
                              const derivedCutScorePO = (espnRoundPO >= 3 || (espnRoundPO === 2 && currentRoundComplete)) ? (() => {
                                const cutSource: Array<{ score: string; originalScore?: string }> = currentFullLeaderboardRows?.length ? currentFullLeaderboardRows : (feed?.players ?? []);
                                const scores = cutSource.filter(p => p.score === 'CUT' && p.originalScore).map(p => p.originalScore === 'E' ? 0 : parseFloat(p.originalScore!)).filter(n => !isNaN(n));
                                if (!scores.length) return null;
                                const cutLine = Math.min(...scores) - 1;
                                return cutLine === 0 ? 'E' : cutLine > 0 ? `+${cutLine}` : String(cutLine);
                              })() : null;
                              const effectiveCutScorePO = feed?.projectedCut ?? derivedCutScorePO;
                              const r34CutLinePO = leaderboardSortMode === 'default' && leaderboardPickedSort === 'default' && (espnRoundPO >= 3 || (espnRoundPO === 2 && currentRoundComplete && cutAssigned)) && effectiveCutScorePO
                                ? filteredPicked.reduce((last, p, i) => CUT_SCORE_SET_PO.has(p.score.toUpperCase()) ? last : i, -1)
                                : -1;
                              return filteredPicked.map((player, rowIndex) => {
                                const timesPicked = pickedCountMap.get(player.id) ?? 0;
                                const activePlayer = selectedLeaderboardPlayerId === player.id;
                                const notStartedR1 = (feed?.currentRound ?? 1) === 1 && player.thru === '--';
                                const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                const displayScore = showProjectedCut && isCutStatus && player.originalScore ? player.originalScore : player.score;
                                const displayScoreNum = parseFloat(displayScore);
                                const displayIsUnderPar = !isNaN(displayScoreNum) && displayScoreNum < 0;
                                const displayIsCut = displayScore === 'CUT' || displayScore === 'MDF' || displayScore === 'WD' || displayScore === 'DQ';
                                const colVal = leaderboardSortMode !== 'default' ? (player.currentRoundScore ?? '--') : displayScore;
                                const colNum = parseFloat(colVal);
                                const colUnderPar = !isNaN(colNum) && colNum < 0;
                                const colIsCut = displayIsCut && leaderboardSortMode === 'default';
                                const useRedBadge = selectedTournament === 'open' && colUnderPar;
                                const useNavyBadge = selectedTournament === 'open' && !colUnderPar && !colIsCut && colVal !== '--' && (colVal === 'E' || (!isNaN(colNum) && colNum > 0));
                                const rowBg = activePlayer ? (selectedTournament === 'masters' ? '#dcfce7' : selectedTournament === 'open' ? '#93c5fd' : '#dbeafe') : selectedTournament === 'open' ? '#F4BC41' : '#ffffff';
                                return (
                                  <Fragment key={player.id}>
                                    <tr
                                      data-leaderboard-golfer="true"
                                      onClick={() => setSelectedLeaderboardPlayerId(activePlayer ? null : player.id)}
                                      style={{
                                        background: rowBg,
                                        borderBottom: (selectedTournament === 'players' || selectedTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: 600, color: selectedTournament === 'open' ? '#0f1720' : '#374151' }}>{notStartedR1 ? '—' : (player.score === 'WD' || player.score === 'DQ') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{player.score}</span> : formatLeaderboardPosition(player.position)}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', fontWeight: activePlayer ? 800 : 500, color: '#0f1720' }}>{player.name}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', fontWeight: colIsCut ? 600 : 700, color: colUnderPar && !useRedBadge ? '#dc2626' : (useNavyBadge ? '#0f1720' : (colVal === 'E' ? '#16a34a' : (colIsCut ? '#374151' : '#0f1720'))) }}>{notStartedR1 ? '—' : player.score === 'CUT' && player.originalScore && leaderboardSortMode === 'default' ? <span onClick={(e) => handleCutTotalTap(String(player.id), player.name, e)} style={{ cursor: 'pointer', display: 'inline-block', minWidth: 34, textAlign: 'center', WebkitTapHighlightColor: 'transparent', userSelect: 'none', touchAction: 'manipulation' }}>{expandedCutIds.has(String(player.id)) ? player.originalScore : 'CUT'}</span> : (() => { const valNode = useRedBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : useNavyBadge ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1e3a5f', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : (colIsCut && colVal !== 'CUT') ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#cc2944', color: '#fff', borderRadius: 4, padding: '2px 5px', minWidth: 28, fontWeight: 700 }}>{colVal}</span> : colVal; return (timesPicked > 0) ? <span onClick={(e) => { e.stopPropagation(); openLiveScorecard(player.name, player.teeTime ?? null, player.thru, player.backNineStart ?? false); }} style={{ cursor: 'pointer', display: 'inline-block', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>{valNode}</span> : valNode; })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', whiteSpace: 'nowrap', color: selectedTournament === 'open' ? '#000000' : '#374151' }}>{(() => {
                                        const isGoldTheme = selectedTournament === 'open';
                                        const thruDisplay = (() => {
                                          if (player.score === 'WD' || player.score === 'DQ') return '--';
                                          const isLive = selectedTournamentStatus?.label === 'IN PROGRESS';
                                          const isCutStatus = player.score === 'CUT' || player.score === 'MDF' || player.score === 'WD' || player.score === 'DQ';
                                          if (isLive && !isCutStatus && player.thru === '--' && player.teeTime) {
                                            return teeTimeIsPast(player.teeTime) ? '--' : formatTeeTime(player.teeTime);
                                          }
                                          const clientRound = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                                          const espnRound = feed?.currentRound ?? 1;
                                          if (isLive && !isCutStatus && player.thru === 'F' && clientRound > espnRound) {
                                            return player.teeTime ? formatTeeTime(player.teeTime) : '--';
                                          }
                                          const thruVal = player.thru;
                                          return player.backNineStart && thruVal !== '--' && thruVal !== 'F'
                                            ? <span style={{ position: 'relative', display: 'inline-block' }}>{thruVal}<span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', fontSize: '0.65em', lineHeight: 1 }}>*</span></span>
                                            : thruVal;
                                        })();
                                        return thruDisplay;
                                      })()}</td>
                                      <td style={{ padding: isMobile ? '6px 4px' : '7px 8px', textAlign: 'center', color: selectedTournament === 'open' ? '#000000' : '#374151' }}>
                                        {timesPicked}
                                      </td>
                                      <td style={{ padding: isMobile ? '6px 2px' : '7px 6px', textAlign: 'center' }}><button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: selectedTournament === 'open' ? '#000000' : '#607282', lineHeight: 1, touchAction: 'manipulation' }}>ⓘ</button></td>
                                    </tr>
                                    {rowIndex === cutLineIdx && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>PROJECTED CUT{feed?.projectedCut ? `: ${feed.projectedCut}` : ''}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {rowIndex === r34CutLinePO && !leaderboardSearch && (
                                      <tr style={{ background: 'transparent', borderBottom: 'none' }}>
                                        <td colSpan={6} style={{ padding: '2px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            <span style={{ fontSize: 10, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE: {effectiveCutScorePO}</span>
                                            <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              });
                            })()}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </section>
              ) : null}

              {!showLivePayoutStrip ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                      My entry
                    </div>
                    <h3 style={{ margin: '6px 0 0', fontSize: 24 }}>{userLabel}</h3>
                    <div style={{ marginTop: 4, color: '#6b7b88', fontSize: 13 }}>
                      {sessionUser ? 'Saved to your account' : 'Guest mode until you sign in'}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 999,
                      background: locked ? '#fff1f2' : '#eaf2ff',
                      color: locked ? '#be123c' : '#2f5f96',
                      fontWeight: 800,
                      fontSize: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    <Lock size={14} />
                    {locked ? 'Locked' : 'Editable'}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>{renderRosterCards('#fff')}</div>
                {renderBudgetCards('#f5f9fb', 'none')}

                {!sessionUser ? (
                  <div
                    style={{
                      marginTop: 14,
                      borderRadius: 14,
                      background: '#fff8e7',
                      color: '#9a6700',
                      padding: '12px 14px',
                    }}
                  >
                    Sign in or create an account above to save this lineup to the pool.
                  </div>
                ) : null}

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      background: '#eef4ff',
                      color: '#2f5f96',
                      padding: '12px 14px',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{saveMessage}</span>
                  </div>
                ) : null}

                <button
                  onClick={() => canSave && setShowRosterConfirm(true)}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: canSave ? entriesTournamentBg : '#cbd5df',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 900,
                    cursor: canSave ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {sessionUser ? 'Submit Roster' : 'Sign in to save'}
                </button>
              </section>
              ) : null}

              {!showLivePayoutStrip ? (
              <section
                style={{
                  background: '#fff',
                  borderRadius: 24,
                  padding: 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Trophy size={18} color="#2f5f96" />
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Tracked golfers</div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {players.map((player) => {
                    const selected = selectedRoster.includes(player.id);
                    const disabled =
                      !selected &&
                      (locked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining);

                    return (
                      <button
                        key={player.id}
                        onClick={() => togglePlayer(player.id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 16,
                          border: selected ? '2px solid #3f73ad' : disabled ? '1px solid #d7dee6' : '1px solid #e6edf1',
                          background: selected ? '#eef4ff' : disabled ? '#f3f5f7' : '#fff',
                          padding: 14,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.58 : 1,
                        }}
                        disabled={disabled}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 800, color: disabled ? '#748391' : '#0f1720' }}>{player.name}</div>
                            <div style={{ marginTop: 4, color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 13 }}>
                              OWGR {player.worldRank} | {player.odds}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: 20 }}>{player.score}</div>
                            <div style={{ color: disabled ? '#8a97a3' : '#6b7b88', fontSize: 12 }}>
                              ${player.salary.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
              ) : null}
            </aside>
          </main>
        )}

        {mainTab === 'My Entries' && (
          <main style={{ marginTop: isMobile ? 14 : 24, display: 'grid', gap: isMobile ? 12 : 20 }}>
            {!sessionUser ? (
              <div
                style={{
                  borderRadius: 18,
                  background: '#fff8e7',
                  color: '#9a6700',
                  border: '1px solid #f0d28a',
                  padding: isMobile ? '12px 14px' : '16px 18px',
                  fontSize: isMobile ? 13 : 15,
                }}
              >
                This tab is ready for saved entries, but you need to sign in first so the lineup belongs to your account.
              </div>
            ) : sessionUser && !myEntriesEditorOpen ? (
              <section
                style={{
                  background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                  borderRadius: 20,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 26, color: '#0f1720' }}>Manage Entry</h2>
                <div style={{ marginTop: isMobile ? 6 : 18, color: '#0f1720', fontSize: isMobile ? 11 : 15, lineHeight: 1.45 }}>
                  {TOURNAMENT_ENTRIES_INTRO[entriesTournamentId] ?? `Make or edit your picks for ${entriesTournament.name} below.`} You can submit or modify your picks up until the first tee time of Round 1.
                </div>

                {saveMessage ? (
                  <div
                    style={{
                      marginTop: isMobile ? 10 : 18,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 14,
                      background: '#eef4ff',
                      color: '#2f5f96',
                      padding: isMobile ? '8px 10px' : '12px 14px',
                      fontSize: isMobile ? 12 : 14,
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>{saveMessage}</span>
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: isMobile ? 17 : 31,
                    display: 'grid',
                    gridTemplateColumns: (isMobile && hasSubmittedRoster)
                      ? '1fr auto'
                      : isMobile
                        ? 'auto 1fr auto'
                        : 'minmax(220px, 1fr) minmax(320px, 420px) minmax(220px, 1fr)',
                    gap: isMobile ? '6px 8px' : 20,
                    alignItems: 'center',
                  }}
                >
                  {!(isMobile && hasSubmittedRoster) && (
                    <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720' }}>Entry</div>
                  )}
                  <div
                    style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'center', justifySelf: 'center' }}
                  >
                    {TOURNAMENT_TAB_LOGOS[entriesTournamentId] ? (
                      (() => {
                        // Tournament logo in place of the "<Tournament> Picks" text; negative margins
                        // keep the row at the text line's height so the box never grows.
                        const lh = isMobile ? 12 : 17;
                        const hgt = (PICKS_HEADER_LOGO_H[entriesTournamentId] ?? [26, 32])[isMobile ? 0 : 1];
                        return <img src={TOURNAMENT_TAB_LOGOS[entriesTournamentId]} alt={TOURNAMENT_PICKS_HEADER[entriesTournamentId] ?? `${entriesTournament.name} Picks`} style={{ height: hgt, margin: `${-(hgt - lh) / 2}px 0`, width: 'auto', maxWidth: 120, objectFit: 'contain', display: 'block' }} />;
                      })()
                    ) : (
                      TOURNAMENT_PICKS_HEADER[entriesTournamentId] ?? `${entriesTournament.name} Picks`
                    )}
                  </div>
                  <div style={{ fontSize: isMobile ? 10 : 14, fontWeight: 900, color: '#0f1720', textAlign: 'right' }}>Options</div>

                  {!(isMobile && hasSubmittedRoster) && (
                    <div style={{ fontSize: isMobile ? 12 : 18, color: '#0f1720', fontWeight: isMobile ? 600 : 400 }}>{userLabel}</div>
                  )}
                  <div style={{ display: 'grid', justifyItems: (isMobile && hasSubmittedRoster) ? 'stretch' : 'center' }}>
                    {hasSubmittedRoster ? (
                      // Small top margin keeps the (oversized, negative-margin) header logo from touching the box.
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', marginTop: isMobile ? 5 : 7 }}>
                        <div
                          style={{
                            borderRadius: 12,
                            // For The Open the box blends with the section's yellow (bubbles keep their colors).
                            border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #dce6ee',
                            background: entriesTournamentId === 'open' ? '#F4BC41' : '#f8fbfd',
                            padding: isMobile ? '8px 10px' : '12px 14px',
                            display: 'grid',
                            gap: isMobile ? 6 : 10,
                            width: '100%',
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? 6 : 10 }}>
                            {savedRosterPlayers.map((player) => {
                              const entryBubblePalette: Record<string, { bg: string; text: string }> = {
                                players:  { bg: '#dce6f5', text: '#173b63' },
                                masters:  { bg: '#d5eade', text: '#2c6449' },
                                'us-open':{ bg: '#fde8e8', text: '#BE3436' },
                                pga:      { bg: '#f5edd8', text: '#7a6a3e' },
                                open:     { bg: '#dce6f5', text: '#173b63' },
                              };
                              const { bg: entryBg, text: entryText } = entryBubblePalette[entriesTournamentId] ?? { bg: '#e8f3ff', text: '#2f5f96' };
                              return (
                              <span
                                key={player.id}
                                onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank })}
                                style={{
                                  borderRadius: 999,
                                  background: entryBg,
                                  color: entryText,
                                  padding: isMobile ? '4px 14px 4px 4px' : '6px 18px 6px 6px',
                                  fontSize: isMobile ? 15 : 17,
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: isMobile ? 8 : 10,
                                  cursor: 'pointer',
                                }}
                              >
                                <img
                                  src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                                  alt={player.name}
                                  style={{
                                    width: isMobile ? 40 : 44,
                                    height: isMobile ? 40 : 44,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    background: '#fff',
                                    flexShrink: 0,
                                  }}
                                />
                                {player.name.split(' ').slice(-1)[0]}
                              </span>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={entriesLocked ? undefined : openMyEntriesEditor}
                          disabled={entriesLocked}
                          style={{
                            border: 'none',
                            borderRadius: 16,
                            padding: isMobile ? '10px 16px' : '11px 18px',
                            background: entriesLocked ? '#b0bec5' : entriesTournamentSolid,
                            color: '#fff',
                            fontSize: isMobile ? 14 : 14,
                            fontWeight: 900,
                            cursor: entriesLocked ? 'not-allowed' : 'pointer',
                            boxShadow: entriesLocked ? 'none' : '0 14px 28px rgba(9, 34, 51, 0.22)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            whiteSpace: 'nowrap',
                            opacity: entriesLocked ? 0.7 : 1,
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 14} />
                          Edit Picks
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={entriesLocked ? undefined : openMyEntriesEditor}
                        disabled={entriesLocked}
                        style={{
                          border: 'none',
                          borderRadius: 12,
                          padding: isMobile ? '6px 10px' : '11px 18px',
                          background: entriesLocked ? '#b0bec5' : entriesTournamentSolid,
                          color: '#fff',
                          fontSize: isMobile ? 12 : 14,
                          fontWeight: 900,
                          cursor: entriesLocked ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                          opacity: entriesLocked ? 0.7 : 1,
                        }}
                      >
                        <Pencil size={12} />
                        Make Picks
                      </button>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', position: 'relative' }}>
                    {myEntriesMenuOpen ? (
                      <button
                        type="button"
                        aria-label="Close entry options"
                        onClick={() => setMyEntriesMenuOpen(false)}
                        style={{
                          position: 'fixed',
                          inset: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'default',
                          padding: 0,
                          margin: 0,
                          zIndex: 5,
                        }}
                      />
                    ) : null}
                    <button
                      onClick={() => setMyEntriesMenuOpen((current) => !current)}
                      style={{
                        border: entriesTournamentId === 'open' ? `1px solid ${entriesTournamentSolid}` : '1px solid #d7e0e8',
                        borderRadius: 10,
                        width: isMobile ? 34 : 48,
                        height: isMobile ? 34 : 48,
                        background: entriesTournamentId === 'open' ? entriesTournamentSolid : '#fff',
                        color: entriesTournamentId === 'open' ? '#fff' : '#0f1720',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreVertical size={isMobile ? 14 : 18} />
                    </button>
                    {myEntriesMenuOpen ? (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: isMobile ? 34 : 48,
                          right: 0,
                          width: 240,
                          borderRadius: 16,
                          border: '1px solid #d7e0e8',
                          background: '#fff',
                          boxShadow: '0 18px 40px rgba(9, 34, 51, 0.14)',
                          padding: 8,
                          display: 'grid',
                          gap: 4,
                          zIndex: 10,
                        }}
                      >
                        <button
                          onClick={entriesLocked ? undefined : () => {
                            setMyEntriesMenuOpen(false);
                            openMyEntriesEditor();
                          }}
                          disabled={entriesLocked}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: entriesLocked ? '#9ba8b4' : '#0f1720',
                            fontSize: 15,
                            cursor: entriesLocked ? 'not-allowed' : 'pointer',
                            opacity: entriesLocked ? 0.6 : 1,
                          }}
                        >
                          <Pencil size={15} />
                          <span>{hasSubmittedRoster ? 'Edit Picks' : 'Make Picks'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setMyEntriesMenuOpen(false);
                            setMyEntriesDetailView('history');
                          }}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: '#0f1720',
                            fontSize: 15,
                            cursor: 'pointer',
                          }}
                        >
                          <History size={15} />
                          <span>View Pick History</span>
                        </button>
                        <button
                          onClick={() => {
                            setMyEntriesMenuOpen(false);
                            setAccountDisplayName(sessionUser.displayName);
                            setMyEntriesDetailView('rename');
                          }}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            background: '#fff',
                            padding: '12px 14px',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: '#0f1720',
                            fontSize: 15,
                            cursor: 'pointer',
                          }}
                        >
                          <CircleUserRound size={15} />
                          <span>Rename Entry</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {myEntriesDetailView === 'history' ? (
                  <div
                    style={{
                      marginTop: 20,
                      borderRadius: 18,
                      // For The Open the box blends with the section's yellow; the ✕ goes navy like Save Entry Name.
                      border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                      background: entriesTournamentId === 'open' ? '#F4BC41' : '#f8fbfd',
                      padding: 18,
                      display: 'grid',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1720' }}>Pick History</div>
                      <button
                        onClick={() => setMyEntriesDetailView('none')}
                        style={{ background: entriesTournamentId === 'open' ? headerSolid : 'rgba(0,0,0,0.06)', border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 10, cursor: 'pointer', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                      >✕</button>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {TOURNAMENTS.map((event) => {
                        const historyPlayers = (sessionUser.rosters[event.id] ?? []).map((id) => playersById[id]).filter(Boolean);
                        return (
                          <div
                            key={`history-${event.id}`}
                            style={{
                              borderRadius: 16,
                              border: '1px solid #dce6ee',
                              background: '#fff',
                              padding: 14,
                              display: 'grid',
                              gap: 10,
                            }}
                          >
                            {/* Header text with the tab logo just after it. Per-logo heights even out the very
                                different aspect ratios (wide Masters ribbon vs boxy PGA shield); the row is locked
                                at 22px and the logo overdraws into the card's padding so the card doesn't grow. */}
                            {(() => {
                              const logoH = ({ players: 40, masters: 25, pga: 42, 'us-open': 30, open: 30 } as Record<string, number>)[event.id] ?? 30;
                              const logoY = ({ masters: -5 } as Record<string, number>)[event.id] ?? 0; // fine-tune vertical alignment per logo
                              return (
                                <div style={{ height: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{PICK_HISTORY_NAMES[event.id] ?? event.name}</div>
                                  {TOURNAMENT_TAB_LOGOS[event.id] && (
                                    <img src={TOURNAMENT_TAB_LOGOS[event.id]} alt={event.name} style={{ height: logoH, width: 'auto', objectFit: 'contain', margin: `${(22 - logoH) / 2}px 0`, transform: logoY ? `translateY(${logoY}px)` : undefined, flexShrink: 0 }} />
                                  )}
                                </div>
                              );
                            })()}
                            {historyPlayers.length > 0 ? (
                              // Mobile: 3-per-row grid (a 6-man roster is exactly two rows). Desktop: pills flow
                              // side by side and wrap naturally, so there's no dead space between grid columns.
                              <div style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 } : { display: 'flex', flexWrap: 'wrap', gap: '10px 12px' }}>
                                {historyPlayers.map((player) => {
                                  const bubblePalette: Record<string, { bg: string; text: string }> = {
                                    players:  { bg: '#dce6f5', text: '#173b63' },
                                    masters:  { bg: '#d5eade', text: '#2c6449' },
                                    'us-open':{ bg: '#fde8e8', text: '#BE3436' },
                                    pga:      { bg: '#f5edd8', text: '#7a6a3e' },
                                    open:     { bg: '#dce6f5', text: '#173b63' },
                                  };
                                  const { bg, text } = bubblePalette[event.id] ?? { bg: '#e8f3ff', text: '#2f5f96' };
                                  const displayName = isMobile ? (player.name.split(' ').pop() ?? player.name) : player.name;
                                  return (
                                    <span
                                      key={`history-player-${event.id}-${player.id}`}
                                      onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'stats', event.id)}
                                      style={{
                                        borderRadius: 999,
                                        background: bg,
                                        color: text,
                                        padding: isMobile ? '4px 8px 4px 4px' : '6px 18px 6px 6px',
                                        fontSize: isMobile ? 12 : 14,
                                        fontWeight: 800,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: isMobile ? 6 : 8,
                                        cursor: 'pointer',
                                        minWidth: 0,
                                      }}
                                    >
                                      <img
                                        src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                                        alt={player.name}
                                        style={{ width: isMobile ? 22 : 30, height: isMobile ? 22 : 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#fff' }}
                                      />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ color: '#6b7b88', fontSize: 14 }}>No submitted roster saved for this event yet.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {myEntriesDetailView === 'rename' ? (
                  <div
                    style={{
                      marginTop: 20,
                      borderRadius: 18,
                      // For The Open the box blends with the section's yellow; the ✕ goes navy like Save Entry Name.
                      border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                      background: entriesTournamentId === 'open' ? '#F4BC41' : '#f8fbfd',
                      padding: 18,
                      display: 'grid',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1720' }}>Rename Entry</div>
                      <button
                        onClick={() => setMyEntriesDetailView('none')}
                        style={{ background: entriesTournamentId === 'open' ? headerSolid : 'rgba(0,0,0,0.06)', border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 10, cursor: 'pointer', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                      >✕</button>
                    </div>
                    <input
                      value={accountDisplayName}
                      onChange={(event) => setAccountDisplayName(event.target.value)}
                      placeholder="Display name"
                      style={{ ...fieldStyle(), maxWidth: 420 }}
                    />
                    <div>
                      <button
                        onClick={handleUpdateOwnDisplayName}
                        disabled={accountBusy}
                        style={{
                          border: 'none',
                          borderRadius: 14,
                          padding: '12px 18px',
                          background: headerSolid,
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: accountBusy ? 'wait' : 'pointer',
                        }}
                      >
                        Save Entry Name
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : sessionUser && entriesPreFieldView ? (
              <section
                style={{
                  background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                  borderRadius: 24,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                    <button
                      onClick={closeMyEntriesEditor}
                      aria-label="Back"
                      style={{ border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 999, background: entriesTournamentId === 'open' ? headerSolid : '#fff', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <ArrowLeft size={isMobile ? 14 : 20} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 26, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.55fr) minmax(320px, 0.85fr)',
                    gap: 28,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 20 }}>
                    <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: 20, overflow: 'hidden', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                      <div
                        style={{
                          padding: isMobile ? 12 : isLandscapePhone ? '12px 22px 22px' : 22,
                          position: 'relative',
                          background: entriesTournamentId === 'open' ? '#F4BC41' : '#f7f9fb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: isMobile || isLandscapePhone ? 'flex-start' : 'center',
                          flexWrap: 'wrap',
                          borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #d7e0e8',
                        }}
                      >
                        <div style={{ flexBasis: isLandscapePhone ? '100%' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18 }}>
                            <div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>{entriesTournamentDisplayName}</div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>Tournament Field</div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginTop: 8,
                              color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79',
                            }}
                          >
                            <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                            <span style={{ fontSize: isMobile ? 12 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                          </div>
                        </div>
                        {TOURNAMENT_EVENT_LOGOS[entriesTournamentId] && (
                          <img src={TOURNAMENT_EVENT_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={eventLogoStyle(entriesTournamentId, isMobile, isLandscapePhone)} />
                        )}
                        <label
                          style={{
                            minWidth: isMobile ? 140 : 280,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #d7e0e8',
                            borderRadius: 14,
                            background: '#fff',
                            padding: '0 14px',
                          }}
                        >
                          <Search size={18} color="#6b7b88" />
                          <input
                            value={entriesPlayerSearch}
                            onChange={(event) => setEntriesPlayerSearch(event.target.value)}
                            placeholder="Search"
                            style={{
                              border: 'none',
                              outline: 'none',
                              width: '100%',
                              padding: isMobile ? '10px 0' : '12px 0',
                              fontSize: isMobile ? 16 : 15,
                              background: 'transparent',
                              color: '#0f1720',
                            }}
                          />
                          {entriesPlayerSearch && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEntriesPlayerSearch(''); }}
                              style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                              aria-label="Clear search"
                            >
                              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                            </button>
                          )}
                        </label>
                      </div>

                      <div style={{ maxHeight: isMobile ? 540 : 722, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px', padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #e6edf1', position: 'sticky', top: 0, background: entriesTournamentId === 'open' ? headerSolid : '#f7f9fb', zIndex: 1 }}>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', textAlign: 'center' }}>OWGR</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>Player</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720' }}>Salary</div>
                          <div></div>
                        </div>
                        <div style={{ padding: isMobile ? '20px 16px' : '32px 24px' }}>
                          <div style={{ background: entriesWarningPalette.bg, borderRadius: 14, padding: isMobile ? '16px 16px' : '22px 24px', textAlign: 'left', color: entriesWarningPalette.text, fontSize: isMobile ? 13.5 : 15, fontWeight: 700, lineHeight: 1.6 }}>
                            *Picks cannot be entered until the tournament field has been finalized and world golf rankings/player odds have been updated for the week (usually by late Monday morning, the week of the tournament).
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside style={{ display: 'grid', gap: 18 }}>
                    <div
                      style={{
                        borderRadius: 16,
                        border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #dce6ee',
                        padding: '22px 26px',
                        background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 13 : 18, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 28 : 44, lineHeight: 1, fontWeight: 900, color: '#198754' }}>
                        ${SALARY_CAP.toLocaleString()}
                      </div>
                      <div style={{ marginTop: 12, color: '#0f1720', fontSize: isMobile ? 12 : 15 }}>
                        Avg Rem./Player: ${Math.round(SALARY_CAP / REQUIRED_GOLFERS).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    <div style={{ display: 'grid', gap: isMobile ? 16 : 14 }}>
                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => (
                        <div
                          key={`placeholder-slot-${index + 1}`}
                          style={{
                            borderRadius: 14,
                            border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                            background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                            padding: isMobile ? '16px 16px' : '16px 18px',
                          }}
                        >
                          <div style={{ fontSize: isMobile ? 17 : 18, color: entriesTournamentId === 'open' ? '#000000' : '#556572' }}>Golfer #{index + 1}</div>
                        </div>
                      ))}
                    </div>

                    <input
                      value={tieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setTieBreakInput(val);
                      }}
                      placeholder={`Enter tiebreak value* (Par = ${TOURNAMENT_TOTAL_PAR[selectedTournament] ?? '?'})`}
                      inputMode="numeric"
                      maxLength={3}
                      style={{
                        ...fieldStyle(),
                      }}
                    />
                    <button
                      disabled
                      style={{
                        width: 170,
                        border: 'none',
                        borderRadius: 14,
                        padding: '14px 18px',
                        background: '#dfe5eb',
                        color: '#566675',
                        fontSize: 15,
                        fontWeight: 900,
                        cursor: 'not-allowed',
                      }}
                    >
                      Submit Roster
                    </button>
                    <div style={{ color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79', fontSize: 13, lineHeight: 1.65 }}>
                      * - The tiebreak value is your predicted total score for the winning golfer of this tournament.
                      Use their total strokes, NOT score to par. Example: Enter {(TOURNAMENT_TOTAL_PAR[entriesTournamentId] ?? 288) - 14} (NOT -14)
                    </div>
                  </aside>
                </div>
              </section>
            ) : sessionUser ? (
              <section
                style={{
                  background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                  borderRadius: 24,
                  padding: isMobile ? 14 : 22,
                  boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                    <button
                      onClick={closeMyEntriesEditor}
                      aria-label="Back"
                      style={{ border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8', borderRadius: 999, background: entriesTournamentId === 'open' ? headerSolid : '#fff', color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', width: isMobile ? 32 : 44, height: isMobile ? 32 : 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <ArrowLeft size={isMobile ? 14 : 20} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 26, color: '#0f1720' }}>Pick Sheet for {userLabel}</h2>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.45fr) minmax(320px, 0.8fr)',
                    gap: 22,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: 20, overflow: 'hidden', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                      <div
                        style={{
                          padding: isMobile ? 12 : isLandscapePhone ? '12px 22px 22px' : 22,
                          position: 'relative',
                          background: entriesTournamentId === 'open' ? '#F4BC41' : '#f7f9fb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: isMobile || isLandscapePhone ? 'flex-start' : 'center',
                          flexWrap: 'wrap',
                          borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #d7e0e8',
                        }}
                      >
                        <div style={{ flexBasis: isLandscapePhone ? '100%' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18 }}>
                            <div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>{entriesTournamentDisplayName}</div>
                              <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>Tournament Field</div>
                            </div>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginTop: 8,
                              color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79',
                            }}
                          >
                            <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                            <span style={{ fontSize: isMobile ? 12 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                          </div>
                        </div>
                        {TOURNAMENT_EVENT_LOGOS[entriesTournamentId] && (
                          <img src={TOURNAMENT_EVENT_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={eventLogoStyle(entriesTournamentId, isMobile, isLandscapePhone)} />
                        )}
                        <label
                          style={{
                            minWidth: isMobile ? 140 : 280,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #d7e0e8',
                            borderRadius: 14,
                            background: '#fff',
                            padding: '0 14px',
                          }}
                        >
                          <Search size={18} color="#6b7b88" />
                          <input
                            value={entriesPlayerSearch}
                            onChange={(event) => setEntriesPlayerSearch(event.target.value)}
                            placeholder="Search"
                            style={{
                              border: 'none',
                              outline: 'none',
                              width: '100%',
                              padding: isMobile ? '10px 0' : '12px 0',
                              fontSize: isMobile ? 16 : 15,
                              background: 'transparent',
                              color: '#0f1720',
                            }}
                          />
                          {entriesPlayerSearch && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEntriesPlayerSearch(''); }}
                              style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                              aria-label="Clear search"
                            >
                              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                            </button>
                          )}
                        </label>
                      </div>

                      <div style={{ maxHeight: isMobile ? 540 : 722, overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px', padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #e6edf1', position: 'sticky', top: 0, background: entriesTournamentId === 'open' ? headerSolid : '#f7f9fb', zIndex: 1 }}>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', textAlign: 'center' }}>OWGR</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>Player</div>
                          <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720' }}>Salary</div>
                          <div></div>
                        </div>
                        {salaryListMissing && (
                          <div style={{ padding: isMobile ? '20px 16px' : '32px 24px' }}>
                            <div style={{ background: entriesWarningPalette.bg, borderRadius: 14, padding: isMobile ? '16px 16px' : '22px 24px', textAlign: 'left', color: entriesWarningPalette.text, fontSize: isMobile ? 13.5 : 15, fontWeight: 700, lineHeight: 1.6 }}>
                              *Picks cannot be entered until the tournament field has been finalized and world golf rankings/player odds have been updated for the week (usually by late Monday morning, the week of the tournament).
                            </div>
                          </div>
                        )}
                        {filteredEntriesPlayers.map((player) => {
                          const disabled = entriesLocked || selectedRoster.length >= REQUIRED_GOLFERS || player.salary > salaryRemaining;

                          return (
                            <div
                              key={player.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px',
                                padding: isMobile ? '11px 12px' : '15px 20px',
                                borderBottom: entriesTournamentId === 'open' ? '1px solid rgba(0,0,0,0.12)' : '1px solid #e6edf1',
                                alignItems: 'center',
                                opacity: disabled ? 0.45 : 1,
                                background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                              }}
                            >
                              <div style={{ fontSize: isMobile ? 13 : 17, color: '#0f1720', textAlign: 'center' }}>{player.worldRank}</div>
                              <div onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season')} style={{ fontSize: isMobile ? 13 : 17, fontWeight: 600, color: '#0f1720', paddingLeft: isMobile ? 8 : 12, cursor: 'pointer' }}>
                                {(() => { const customSplit = isMobile ? MOBILE_CUSTOM_SPLITS[player.name] : undefined; const parts = player.name.split(' '); const first = customSplit ? customSplit[0] : parts.slice(0, -1).join(' '); const last = customSplit ? customSplit[1] : parts[parts.length - 1]; const forcedBreak = isMobile && MOBILE_TWO_LINE_NAMES.has(player.name); const infoBtn = <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season'); }} style={{ width: isMobile ? 11 : 15, height: isMobile ? 11 : 15, borderRadius: '50%', border: `${isMobile ? 1 : 1.5}px solid ${entriesTournamentId === 'open' ? '#000000' : '#9ca3af'}`, background: 'transparent', color: entriesTournamentId === 'open' ? '#000000' : '#9ca3af', fontSize: isMobile ? 7 : 9, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, touchAction: 'manipulation', verticalAlign: 'middle', marginLeft: isMobile ? 3 : 5, flexShrink: 0 }} aria-label={`View ${player.name} stats`}>i</button>; return (<>{first}{forcedBreak ? <br /> : (first ? ' ' : '')}<span style={{ whiteSpace: 'nowrap' }}>{last}{infoBtn}</span></>); })()}
                              </div>
                              <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, color: '#0f1720' }}>${player.salary.toLocaleString()}</div>
                              <button
                                onClick={() => togglePlayer(player.id)}
                                disabled={disabled}
                                style={{
                                  width: isMobile ? 34 : 42,
                                  height: isMobile ? 34 : 42,
                                  borderRadius: 10,
                                  border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7dee6',
                                  background: entriesTournamentId === 'open' ? headerSolid : '#fff',
                                  color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                                  fontSize: isMobile ? 20 : 24,
                                  fontWeight: 400,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 18 }}>
                    <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: isMobile ? 18 : 14, padding: isMobile ? 16 : '12px 18px', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                      <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                      <div style={{ marginTop: 2, fontSize: isMobile ? 30 : 34, fontWeight: 900, color: '#1f8d4e' }}>${salaryRemaining.toLocaleString()}</div>
                      <div style={{ marginTop: isMobile ? 8 : 4, fontSize: isMobile ? 12 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#31424f' }}>
                        Avg Rem./Player: ${averageRemainingPerPlayer.toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
                      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                      {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => {
                        const golfer = orderedRosterPlayers[index];
                        return (
                          <div
                            key={`entries-roster-slot-${index}`}
                            style={{
                              border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                              borderRadius: isMobile ? 14 : 14,
                              background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                              minHeight: isMobile ? 100 : undefined,
                              height: isMobile ? undefined : 96,
                              display: 'flex',
                              overflow: 'hidden',
                            }}
                          >
                              {golfer ? (
                                <>
                                  <div style={{ width: isMobile ? 90 : 88, flexShrink: 0, alignSelf: 'stretch', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', overflow: 'hidden', position: 'relative' }}>
                                    <img
                                      src={playerPhotoSrc(golfer.name, golfer.pgaTourId, golfer.photoUrl)} data-fb={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)} onError={photoOnError}
                                      alt={golfer.name}
                                      className="roster-card-photo"
                                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(entriesTournamentId === 'open' ? { mixBlendMode: 'normal' as const } : {}) }}
                                    />
                                  </div>
                                  <div style={{ flex: 1, padding: isMobile ? '8px 14px' : '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                      <div onClick={() => openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }, 'season')} style={{ fontSize: isMobile ? 18 : 19, fontWeight: 800, color: '#0f1720', cursor: 'pointer' }}>
                                        {(() => { const customSplit = isMobile ? MOBILE_CUSTOM_SPLITS[golfer.name] : undefined; const parts = golfer.name.split(' '); const first = customSplit ? customSplit[0] : parts.slice(0, -1).join(' '); const last = customSplit ? customSplit[1] : parts[parts.length - 1]; const forcedBreak = isMobile && MOBILE_TWO_LINE_NAMES.has(golfer.name); const infoBtn = <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }, 'season'); }} style={{ width: isMobile ? 17 : 17, height: isMobile ? 17 : 17, borderRadius: '50%', border: `${isMobile ? 1.5 : 1.5}px solid ${entriesTournamentId === 'open' ? '#000000' : '#9ca3af'}`, background: 'transparent', color: entriesTournamentId === 'open' ? '#000000' : '#9ca3af', fontSize: isMobile ? 11 : 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, touchAction: 'manipulation', verticalAlign: 'middle', marginLeft: isMobile ? 5 : 6, flexShrink: 0 }} aria-label={`View ${golfer.name} stats`}>i</button>; return (<>{first}{forcedBreak ? <br /> : (first ? ' ' : '')}<span style={{ whiteSpace: 'nowrap' }}>{last}{infoBtn}</span></>); })()}
                                      </div>
                                      <div style={{ marginTop: isMobile ? 3 : 2, fontSize: isMobile ? 15 : 15, color: entriesTournamentId === 'open' ? '#000000' : '#607282' }}>
                                        Salary: <span style={{ fontWeight: 800, color: salaryColor }}>${golfer.salary.toLocaleString()}</span>
                                      </div>
                                      <div style={{ marginTop: isMobile ? 2 : 1, fontSize: isMobile ? 14 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#607282' }}>
                                        World Rank: <span style={{ fontWeight: 700, color: '#0f1720' }}>{golfer.worldRank}</span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => togglePlayer(golfer.id)}
                                      style={{
                                        width: isMobile ? 34 : 30,
                                        height: isMobile ? 34 : 30,
                                        borderRadius: 8,
                                        border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7dee6',
                                        background: entriesTournamentId === 'open' ? '#dc2626' : '#fff',
                                        color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                                        fontSize: isMobile ? 20 : 18,
                                        fontWeight: 400,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      −
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div style={{ flex: 1, padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14 }}>
                                  <div style={{ width: isMobile ? 62 : 72, height: isMobile ? 62 : 72, borderRadius: 6, background: entriesTournamentId === 'open' ? '#e8a830' : '#e8eef4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <CircleUserRound size={isMobile ? 32 : 40} color={entriesTournamentId === 'open' ? '#000000' : '#a0b0be'} />
                                  </div>
                                  <div style={{ fontSize: isMobile ? 16 : 18, color: entriesTournamentId === 'open' ? '#000000' : '#50616f', fontWeight: 600 }}>Golfer #{index + 1}</div>
                                </div>
                              )}
                          </div>
                        );
                      })}

                      <input
                        value={tieBreakInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setTieBreakInput(val);
                        }}
                        placeholder={`Enter tiebreak value* (Par = ${TOURNAMENT_TOTAL_PAR[selectedTournament] ?? '?'})`}
                        inputMode="numeric"
                        maxLength={3}
                        style={{ ...fieldStyle(), marginTop: 4 }}
                      />

                      {saveMessage ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            borderRadius: 14,
                            background: '#eef4ff',
                            color: '#2f5f96',
                            padding: '12px 14px',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>{saveMessage}</span>
                        </div>
                      ) : null}

                      <button
                        onClick={() => canSave && setShowRosterConfirm(true)}
                        style={{
                          width: 'fit-content',
                          border: 'none',
                          borderRadius: 14,
                          padding: '12px 18px',
                          background: canSave ? entriesTournamentBg : '#cbd5df',
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 900,
                          cursor: canSave ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        Submit Roster
                      </button>
                      <div style={{ color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79', fontSize: 13, lineHeight: 1.65 }}>
                        * - The tiebreak value is your predicted total score for the winning golfer of this tournament.
                        Use their total strokes, NOT score to par. Example: Enter {(TOURNAMENT_TOTAL_PAR[entriesTournamentId] ?? 288) - 14} (NOT -14)
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </main>
        )}

        {mainTab === 'Details' && (
          <main style={{ marginTop: isMobile ? 12 : 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: isMobile ? 10 : 16, alignItems: isMobile ? 'start' : 'stretch' }}>

              <div style={{ display: 'contents' }}>

                {/* ── Card 1: How It Works ── */}
                <section style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}`, gridColumn: isMobile ? undefined : '1', gridRow: isMobile ? undefined : '2', order: 2 }}>
                  <div style={{ padding: isMobile ? 14 : 22 }}>
                    <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: headerSolid, marginBottom: isMobile ? 10 : 14 }}>How It Works</div>
                    <div style={{ display: 'grid', gap: 0 }}>
                      {([
                        <>For each major tournament and The Players Championship, members select <strong>6 golfers</strong>. Each golfer has a salary assigned based on their odds to win.</>,
                        <>Participants have a fixed salary cap of <strong>$50,000</strong> to build their 6-player roster.</>,
                        <>Golfers <strong>can be picked more than once per season.</strong> Points are awarded hole-by-hole plus tournament standings. Cut players receive <strong>−10 pts.</strong></>,
                        <>All <strong>6 golfers</strong> on your roster contribute to your total score.</>,
                        <><strong>1st, 2nd, and 3rd place pay out.</strong> Amounts vary based on the size of the pool field.</>,
                        <>Complete breakdown of tiebreak rules can be found <span onClick={() => setShowTiebreakerRules(true)} style={{ textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontWeight: 700 }}>here</span>.</>,
                      ] as const).map((text, i, arr) => (
                        <div key={i} style={{ borderLeft: `3px solid ${headerSolid}`, paddingLeft: isMobile ? 10 : 14, paddingTop: isMobile ? 7 : 9, paddingBottom: isMobile ? 7 : 9, marginLeft: 2, borderBottom: i < arr.length - 1 ? (selectedTournament === 'open' ? '1px solid rgba(0,0,0,0.08)' : '1px solid #f0f3f6') : 'none', fontSize: isMobile ? 12 : 14, color: selectedTournament === 'open' ? '#000000' : '#374151', lineHeight: 1.55 }}>
                          {text}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── Card 2: Entry & Contact ── */}
                <section style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}`, gridColumn: isMobile ? undefined : '1', gridRow: isMobile ? undefined : '1', order: 1 }}>
                  <div style={{ padding: isMobile ? '12px 14px 0' : '16px 22px 0' }}>
                    <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: headerSolid, marginBottom: isMobile ? 10 : 14 }}>Join the Pool</div>
                  </div>
                  {isFounderPool ? (
                  <div style={{ padding: isMobile ? '0 14px 14px' : '0 22px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isMobile ? 6 : 10 }}>
                    <div style={{ border: selectedTournament === 'open' ? '1.5px solid #000000' : '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 8px' : '10px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#f0f6ff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', letterSpacing: '0.07em' }}>Entry Fee</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 20 : 30, fontWeight: 900, color: selectedTournament === 'open' ? '#000000' : '#173b63' }}>$30</div>
                    </div>
                    <div style={{ border: selectedTournament === 'open' ? '1.5px solid #000000' : '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 8px' : '10px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#f0f6ff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', letterSpacing: '0.07em' }}>Venmo</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 13 : 16, fontWeight: 800, color: selectedTournament === 'open' ? '#000000' : '#173b63' }}>@claytont743</div>
                    </div>
                    <div style={{ border: selectedTournament === 'open' ? '1.5px solid #000000' : '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 8px' : '10px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#f0f6ff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', letterSpacing: '0.07em' }}>Questions</div>
                      <div style={{ marginTop: 4, fontSize: isMobile ? 12 : 15, fontWeight: 800, color: selectedTournament === 'open' ? '#000000' : '#173b63' }}>Clayton Tucker</div>
                      <div style={{ fontSize: isMobile ? 11 : 13, color: selectedTournament === 'open' ? headerSolid : '#5b6b79', marginTop: 2 }}>
                        {isMobile ? (
                          <a href="tel:+13256658299" style={{ color: selectedTournament === 'open' ? headerSolid : '#3d95ce', textDecoration: 'none', fontWeight: 600 }}>(325) 665-8299</a>
                        ) : '(325) 665-8299'}
                      </div>
                    </div>
                  </div>
                  ) : (
                  <div style={{ padding: isMobile ? '0 14px 14px' : '0 22px 22px' }}>
                    <div style={{ border: '1px solid #dce8f5', borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 10px' : '10px 14px', background: '#fff' }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.07em' }}>Questions? Ask your commissioner</div>
                      {(pool?.commissioners ?? []).map((c) => (
                        <div key={c.id} style={{ marginTop: 6 }}>
                          <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: '#173b63' }}>{c.name}</div>
                          <a href={`mailto:${c.email}`} style={{ fontSize: isMobile ? 12 : 13, color: '#3d95ce', textDecoration: 'none', fontWeight: 600 }}>{c.email}</a>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </section>

              </div>{/* end left column */}

              {/* ── Card 3: Scoring System (right column) ── */}
              {(() => {
                const posColor = selectedTournament === 'masters' ? '#2c6449' : '#173b63';
                const isGoldTheme = selectedTournament === 'open';
                const sectionHeaderBg = selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'pga' || selectedTournament === 'us-open' || selectedTournament === 'open') ? '#173b63' : '#f0f4f8';
                const sectionHeaderColor = sectionHeaderBg === '#f0f4f8' ? '#607282' : '#fff';
                const group = (title: string, items: Array<[string, string, boolean?]>) => (
                  <div style={{ background: isGoldTheme ? '#F4BC41' : '#fff', borderRadius: 10, border: '1.5px solid #000000', overflow: 'hidden', marginBottom: 7 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: sectionHeaderColor, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 10px 4px', background: sectionHeaderBg }}>{title}</div>
                    {items.map(([label, pts, neg], i) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', borderBottom: i < items.length - 1 ? (isGoldTheme ? '1px solid rgba(0,0,0,0.08)' : '1px solid #f0f3f6') : 'none' }}>
                        <span style={{ fontWeight: 600, fontSize: isMobile ? 11 : 12, color: '#000000' }}>{label}</span>
                        <span style={{ fontWeight: 800, fontSize: isMobile ? 12 : 13, color: neg ? '#cc2944' : posColor }}>{pts}</span>
                      </div>
                    ))}
                  </div>
                );
                return (
                  <section style={{ background: isGoldTheme ? '#F4BC41' : '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}`, gridColumn: isMobile ? undefined : '2', gridRow: isMobile ? undefined : '1 / 3', order: 3 }}>
                    <div style={{ padding: isMobile ? '12px 14px 0' : '16px 22px 0' }}>
                      <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: headerSolid, marginBottom: isMobile ? 10 : 14 }}>Scoring System</div>
                    </div>
                    <div style={{ padding: isMobile ? '0 14px 14px' : '0 22px 22px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 6 : 10, alignItems: 'start' }}>
                        <div>
                          {group('Strokes', [['Triple+', '−5 pts', true], ['Double', '−3 pts', true], ['Bogey', '−1 pts', true], ['Par', '+.5 pts'], ['Birdie', '+3 pts'], ['Eagle', '+8 pts'], ['Hole in One', '+10 pts'], ['Albatross', '+13 pts']])}
                          {group('Bonuses', [['3 Birdie Streak', '+4 pts'], ['No Bogey Rnd', '+5 pts'], ['Tourn Low Rnd', '+6 pts']])}
                          {group('Round Leaders', [['Rnd 1 Leader', '+5 pts'], ['Rnd 2 Leader', '+5 pts'], ['Rnd 3 Leader', '+5 pts']])}
                        </div>
                        <div>
                          {group('Finishing Position', [['🥇 1st Place', '+40 pts'], ['🥈 2nd Place', '+25 pts'], ['🥉 3rd Place', '+20 pts'], ['4th Place', '+18 pts'], ['5th Place', '+16 pts'], ['6th Place', '+14 pts'], ['7th Place', '+12 pts'], ['8th Place', '+10 pts'], ['9th Place', '+9 pts'], ['10th Place', '+8 pts'], ['11–15th', '+7 pts'], ['16–20th', '+6 pts'], ['21–25th', '+5 pts'], ['26–30th', '+3 pts'], ['31–40th', '+1 pt'], ['Missed Cut', '−10 pts', true]])}
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })()}

            </div>
          </main>
        )}

        {mainTab === 'Reports' && (
          <main style={{ marginTop: isMobile ? 12 : 24 }}>
            <section ref={reportTopRef} style={{ scrollMarginTop: 12, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(9,34,51,0.08)', borderTop: `3px solid ${headerSolid}` }}>
              <div style={{ padding: isMobile ? 18 : 28 }}>
                {selectedReport === 'Player Pick Summary' ? (() => {
                  const ppsControls = (
                    <div style={{ display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', alignItems: 'flex-end', gap: isMobile ? 7 : 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: isMobile ? '1.5 1 92px' : '0 0 220px' }}>
                        <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Tournament</label>
                        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
                          <select
                            value={ppsTournament}
                            onChange={(e) => { const v = e.target.value as TournamentId | 'all' | ''; setPpsTournament(v); if (v === 'all') setPpsSortBy('Picked'); }}
                            style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: isMobile ? '10px 24px 10px 8px' : '10px 34px 10px 12px', fontSize: isMobile ? 12 : 14, fontWeight: 700, color: ppsTournament === 'all' ? '#0f1720' : (ppsTournament ? 'transparent' : '#94a3b8'), WebkitTextFillColor: ppsTournament === 'all' ? '#0f1720' : (ppsTournament ? 'transparent' : '#94a3b8'), cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: isMobile ? 'right 8px center' : 'right 10px center' }}
                          >
                            <option value="" disabled style={{ color: '#94a3b8', WebkitTextFillColor: '#94a3b8' }}>Select tournament</option>
                            {REPORT_TOURNAMENTS.map((t) => (
                              <option key={t.id} value={t.id} style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>{t.label}</option>
                            ))}
                            <option value="all" style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>All</option>
                          </select>
                          {ppsTournament && ppsTournament !== 'all' && TOURNAMENT_TAB_LOGOS[ppsTournament] && (
                            <span style={{ position: 'absolute', left: 12, right: 34, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none' }}>
                              <img src={TOURNAMENT_TAB_LOGOS[ppsTournament]} alt={REPORT_TOURNAMENTS.find((t) => t.id === ppsTournament)?.label ?? ''} style={{ height: REPORT_DROPDOWN_LOGO_H[ppsTournament], width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: isMobile ? '1.15 1 84px' : '0 0 200px' }}>
                        <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Sort By</label>
                        <select
                          value={ppsSortBy}
                          disabled={ppsTournament === 'all'}
                          onChange={(e) => setPpsSortBy(e.target.value as 'Picked' | 'Salary' | '')}
                          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: ppsTournament === 'all' ? '#f1f5f9' : '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: isMobile ? '10px 22px 10px 8px' : '10px 34px 10px 12px', fontSize: isMobile ? 12 : 14, fontWeight: 700, color: ppsSortBy ? '#0f1720' : '#94a3b8', opacity: ppsTournament === 'all' ? 0.6 : 1, cursor: ppsTournament === 'all' ? 'not-allowed' : 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: isMobile ? 'right 7px center' : 'right 8px center' }}
                        >
                          <option value="" disabled>Select sort</option>
                          <option value="Picked">Times Picked</option>
                          <option value="Salary">Salary</option>
                        </select>
                      </div>
                      {reportYearSelect}
                    </div>
                  );
                  return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Player Pick Summary</div>
                      {!isMobile && ppsControls}
                    </div>
                    {isMobile && <div style={{ marginTop: 14 }}>{ppsControls}</div>}

                    {/* Results — horizontal pick-count bars */}
                    {ppsResult && (() => {
                      const isAll = ppsResult.tournament === 'all';
                      const maxCount = ppsResult.rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
                      const tLabel = REPORT_TOURNAMENTS.find((t) => t.id === ppsResult.tournament)?.label ?? '';
                      // Privacy gate: a single tournament's picks stay hidden until it starts.
                      if (!isAll && !picksRevealedForYear(ppsResult.tournament, reportYear)) {
                        return <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>Picks for {tLabel} are hidden until the tournament begins.</div>;
                      }
                      const barColor = ppsResult.tournament === 'all' ? PPS_ALL_BAR_GRADIENT : REPORT_TOURNAMENT_SOLID[ppsResult.tournament];
                      const CUT_MARKS = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                      if (ppsResult.rows.length === 0) {
                        return <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79' }}>{isAll ? 'No picks have been recorded yet.' : `No picks were recorded for ${tLabel}.`}</div>;
                      }
                      const q = ppsSearch.trim().toLowerCase();
                      const filtered = q ? ppsResult.rows.filter((r) => r.name.toLowerCase().includes(q)) : ppsResult.rows;
                      const tallyColor = ppsResult.tournament === 'all' ? '#2f93bf' : REPORT_TOURNAMENT_SOLID[ppsResult.tournament];
                      return (
                        <div style={{ marginTop: isMobile ? 16 : 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 8 : 12, flexWrap: 'nowrap', marginBottom: isMobile ? 14 : 18 }}>
                            <div style={{ fontSize: isMobile ? 13.5 : 15.5, fontWeight: 800, color: '#0f1720', whiteSpace: 'nowrap', flexShrink: 0 }}>Total Players Picked: <span style={{ color: tallyColor }}>{ppsResult.rows.length}</span></div>
                            <div style={{ position: 'relative', flex: isMobile ? '1 1 auto' : '0 0 auto', minWidth: 0 }}>
                              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                              <input value={ppsSearch} onChange={(e) => setPpsSearch(e.target.value)} placeholder="Search player" style={{ width: isMobile ? '100%' : 230, boxSizing: 'border-box', padding: '9px 30px 9px 32px', borderRadius: 10, border: '1px solid #cdd9e5', fontSize: isMobile ? 16 : 13.5, fontWeight: 600, color: '#0f1720', outline: 'none' }} />
                              {ppsSearch && <button onClick={() => setPpsSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>}
                            </div>
                          </div>
                          {filtered.length === 0 ? (
                            <div style={{ fontSize: 14, color: '#5b6b79' }}>No players match your search.</div>
                          ) : (
                          <div style={{ display: 'grid', gap: isMobile ? 12 : 14 }}>
                            {filtered.map((r) => {
                              const pct = Math.max(20, Math.round((r.count / maxCount) * (isMobile ? 100 : 82)));
                              const isCut = CUT_MARKS.has(String(r.position).toUpperCase());
                              const flagSrc = getPlayerFlag(r.name) ? getFlagSrc(r.name) : null;
                              const abbr = getCountryLabel(r.name) || null;
                              return (
                                <div key={r.id} onClick={() => { if (ppsResult.tournament === 'all') setPpsAllPlayerPopup({ id: r.id, name: r.name, pgaTourId: r.pgaTourId, photoUrl: r.photoUrl }); else setPpsPickPopup({ id: r.id, name: r.name, tournament: ppsResult.tournament }); }} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 9 : 12, cursor: 'pointer' }}>
                                  <img
                                    src={playerPhotoSrc(r.name, r.pgaTourId, r.photoUrl)} data-fb={r.photoUrl ?? pgaPhoto(r.pgaTourId)} onError={photoOnError}
                                    alt={r.name}
                                    style={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #dce8f5', flexShrink: 0, background: '#eef2f6' }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, lineHeight: 1.15 }}>
                                      <span style={{ width: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>{flagSrc && <img src={flagSrc} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: '1px solid #d1d9e0' }} />}</span>
                                      {abbr && <span style={{ flexShrink: 0, marginLeft: 2, fontSize: isMobile ? 10 : 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.02em' }}>{abbr}</span>}
                                      <span style={{ minWidth: 0, marginLeft: abbr ? 4 : 6, fontSize: isMobile ? 13 : 14.5, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                    </div>
                                    {!isAll && (
                                      <div style={{ fontSize: isMobile ? 10 : 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: isCut ? '#dc2626' : '#9aa7b4', margin: '2px 0 6px' }}>{isCut ? 'Missed Cut' : `Finished ${formatLeaderboardPosition(r.position)}`}</div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: isAll ? 6 : 0 }}>
                                      <div style={{ width: `${pct}%`, minWidth: isMobile ? 82 : 96, maxWidth: 'calc(100% - 34px)', height: isMobile ? 24 : 26, borderRadius: 6, background: barColor, display: 'flex', alignItems: 'center', paddingLeft: 9, flexShrink: 0 }}>
                                        {!isAll && <span style={{ fontSize: isMobile ? 11.5 : 12.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{r.salary ? `$${r.salary.toLocaleString()}` : '—'}</span>}
                                      </div>
                                      <span style={{ flexShrink: 0, fontSize: isMobile ? 13 : 14, fontWeight: 800, color: '#0f1720', whiteSpace: 'nowrap' }}>{r.count}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                  );
                })() : selectedReport === 'Pool Member Pick History' ? (() => {
                  const entriesSorted = poolEntries.slice().sort((a, b) => a.name.localeCompare(b.name));
                  const entry = poolEntries.find((e) => e.id === pmphEntryId) ?? null;
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Pool Member Pick History</div>
                        {!isMobile && (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 240 }}>
                              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Pool Member</label>
                              <select
                                value={pmphEntryId}
                                onChange={(e) => setPmphEntryId(e.target.value)}
                                style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmphEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                              >
                                <option value="" disabled>Select pool member</option>
                                {entriesSorted.map((e) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                            </div>
                            {reportYearSelect}
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Pool Member</label>
                            <select
                              value={pmphEntryId}
                              onChange={(e) => setPmphEntryId(e.target.value)}
                              style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmphEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                            >
                              <option value="" disabled>Select pool member</option>
                              {entriesSorted.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          {reportYearSelect}
                        </div>
                      )}
                      {entry && (
                        <div style={{ display: 'grid', gap: 12, marginTop: isMobile ? 18 : 24 }}>
                          {TOURNAMENTS.map((event) => {
                            const historyPlayers = (entry.rosters[event.id] ?? []).map((id) => playersById[id]).filter(Boolean);
                            return (
                              <div
                                key={`pmph-${event.id}`}
                                style={{ borderRadius: 16, border: '1px solid #dce6ee', background: '#fff', padding: 14, display: 'grid', gap: 10 }}
                              >
                                {(() => {
                                  const logoH = ({ players: 40, masters: 25, pga: 42, 'us-open': 30, open: 30 } as Record<string, number>)[event.id] ?? 30;
                                  const logoY = ({ masters: -5 } as Record<string, number>)[event.id] ?? 0;
                                  return (
                                    <div style={{ height: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{ fontSize: 16, fontWeight: 900, color: '#0f1720' }}>{PICK_HISTORY_NAMES[event.id] ?? event.name}</div>
                                      {TOURNAMENT_TAB_LOGOS[event.id] && (
                                        <img src={TOURNAMENT_TAB_LOGOS[event.id]} alt={event.name} style={{ height: logoH, width: 'auto', objectFit: 'contain', margin: `${(22 - logoH) / 2}px 0`, transform: logoY ? `translateY(${logoY}px)` : undefined, flexShrink: 0 }} />
                                      )}
                                    </div>
                                  );
                                })()}
                                {!picksRevealedForYear(event.id, reportYear) ? (
                                  <div style={{ color: '#6b7b88', fontSize: 14, lineHeight: 1.5 }}>Picks are hidden until this tournament begins.</div>
                                ) : historyPlayers.length > 0 ? (
                                  <div style={isMobile ? { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 } : { display: 'flex', flexWrap: 'wrap', gap: '10px 12px' }}>
                                    {historyPlayers.map((player) => {
                                      const bubblePalette: Record<string, { bg: string; text: string }> = {
                                        players: { bg: '#dce6f5', text: '#173b63' },
                                        masters: { bg: '#d5eade', text: '#2c6449' },
                                        'us-open': { bg: '#fde8e8', text: '#BE3436' },
                                        pga: { bg: '#f5edd8', text: '#7a6a3e' },
                                        open: { bg: '#dce6f5', text: '#173b63' },
                                      };
                                      const { bg, text } = bubblePalette[event.id] ?? { bg: '#e8f3ff', text: '#2f5f96' };
                                      const displayName = isMobile ? (player.name.split(' ').pop() ?? player.name) : player.name;
                                      return (
                                        <span
                                          key={`pmph-player-${event.id}-${player.id}`}
                                          onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'stats', event.id)}
                                          style={{ borderRadius: 999, background: bg, color: text, padding: isMobile ? '4px 8px 4px 4px' : '6px 18px 6px 6px', fontSize: isMobile ? 12 : 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: isMobile ? 6 : 8, cursor: 'pointer', minWidth: 0 }}
                                        >
                                          <img
                                            src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                                            alt={player.name}
                                            style={{ width: isMobile ? 22 : 30, height: isMobile ? 22 : 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#fff' }}
                                          />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ color: '#6b7b88', fontSize: 14 }}>No submitted roster saved for this event yet.</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })() : selectedReport === 'Pool Member Pick Summary' ? (() => {
                  const entriesSorted = poolEntries.slice().sort((a, b) => a.name.localeCompare(b.name));
                  const entry = poolEntries.find((e) => e.id === pmpsEntryId) ?? null;
                  const agg = new Map<number, { count: number; tournaments: TournamentId[] }>();
                  if (entry) {
                    for (const { id: tid } of REPORT_TOURNAMENTS) {
                      if (!picksRevealedForYear(tid, reportYear)) continue; // upcoming tournaments' picks stay hidden until they start
                      for (const pid of entry.rosters[tid] ?? []) {
                        const cur = agg.get(pid) ?? { count: 0, tournaments: [] };
                        cur.count += 1;
                        cur.tournaments.push(tid);
                        agg.set(pid, cur);
                      }
                    }
                  }
                  const rows = Array.from(agg.entries())
                    .map(([pid, v]) => {
                      const p = playerDirectory.get(pid);
                      return p ? { id: pid, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, count: v.count, tournaments: v.tournaments } : null;
                    })
                    .filter((r): r is NonNullable<typeof r> => r !== null)
                    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
                  const totalPicks = rows.reduce((s, r) => s + r.count, 0);
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Pool Member Pick Summary</div>
                        {!isMobile && (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 240 }}>
                              <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Entry</label>
                              <select
                                value={pmpsEntryId}
                                onChange={(e) => setPmpsEntryId(e.target.value)}
                                style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmpsEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                              >
                                <option value="" disabled>Select entry</option>
                                {entriesSorted.map((e) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                            </div>
                            {reportYearSelect}
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Entry</label>
                            <select
                              value={pmpsEntryId}
                              onChange={(e) => setPmpsEntryId(e.target.value)}
                              style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pmpsEntryId ? '#0f1720' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                            >
                              <option value="" disabled>Select entry</option>
                              {entriesSorted.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          {reportYearSelect}
                        </div>
                      )}
                      {entry && (rows.length === 0 ? (
                        <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79' }}>{entry.name} hasn&rsquo;t made any picks yet this season.</div>
                      ) : (
                        <div style={{ marginTop: isMobile ? 18 : 24 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#5b6b79', marginBottom: 12 }}>
                            {rows.length} {rows.length === 1 ? 'golfer' : 'golfers'} · {totalPicks} total picks across the season
                          </div>
                          <div style={{ display: 'grid', gap: isMobile ? 12 : 14 }}>
                            {rows.map((r) => {
                              const flagSrc = getPlayerFlag(r.name) ? getFlagSrc(r.name) : null;
                              return (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 9 : 12 }}>
                                  <img
                                    src={playerPhotoSrc(r.name, r.pgaTourId, r.photoUrl)} data-fb={r.photoUrl ?? pgaPhoto(r.pgaTourId)} onError={photoOnError}
                                    alt={r.name}
                                    style={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #dce8f5', flexShrink: 0, background: '#eef2f6' }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                      {flagSrc && <img src={flagSrc} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: '1px solid #d1d9e0', flexShrink: 0 }} />}
                                      <span style={{ fontSize: isMobile ? 13 : 14.5, fontWeight: 800, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11.5, fontWeight: 800, color: '#173b63', background: '#eaf1f9', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{r.count}× picked</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                      {REPORT_TOURNAMENTS.filter((t) => r.tournaments.includes(t.id)).map((t) => {
                                        const chip = REPORT_TOURNAMENT_CHIP[t.id];
                                        return (
                                          <span key={t.id} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.03em', color: chip.fg, background: chip.bg, borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap' }}>{chip.short}</span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })() : selectedReport === 'Player Performance Summary' ? (() => {
                  const tColor = ppfTournament === 'pga' ? '#B09963' : ppfTournament === 'masters' ? '#2c6449' : ppfTournament === 'us-open' ? '#BE3436' : '#173b63';
                  // The Open dresses the leaderboard body (everything below the navy header row) in its gold.
                  const isOpen = ppfTournament === 'open';
                  const openGold = '#F4BC41';
                  const cutLine = ppfTournament ? (feeds[ppfTournament]?.projectedCut ?? null) : null;
                  const q = ppfSearch.trim().toLowerCase();
                  const filtered = q ? ppfRows.filter((r) => r.name.toLowerCase().includes(q)) : ppfRows;
                  const dirMul = ppfSortDir === 'asc' ? 1 : -1;
                  const sorted = [...filtered].sort((a, b) => {
                    if (ppfSortKey === 'finish') return (a.posRank - b.posRank) * dirMul || (a.scoreNum - b.scoreNum) || a.name.localeCompare(b.name);
                    const av = a[ppfSortKey] as number;
                    const bv = b[ppfSortKey] as number;
                    return (av - bv) * dirMul || (a.posRank - b.posRank) || a.name.localeCompare(b.name);
                  });
                  const setSort = (key: typeof ppfSortKey) => {
                    if (ppfSortKey === key) setPpfSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                    else { setPpfSortKey(key); setPpfSortDir(key === 'finish' ? 'asc' : 'desc'); }
                  };
                  const arrow = (key: typeof ppfSortKey) => (ppfSortKey === key ? (ppfSortDir === 'asc' ? ' ▲' : ' ▼') : '');
                  const CUT_MARK = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
                  // The cut line for a completed tournament isn't in the feed's projectedCut (only populated
                  // live). Derive it the way you'd read it off a leaderboard: one stroke better than the best
                  // score among players who MISSED the cut (e.g. first miss at +5 → cut line +4). Fall back to
                  // the worst made-cut score if there are no missed-cut players in the field.
                  const isCutRow = (r: { madeCut: boolean; position: string }) => CUT_MARK.has(String(r.position).toUpperCase()) || !r.madeCut;
                  const missedCutScoreNums = ppfRows.filter((r) => isCutRow(r) && r.scoreNum !== 9999 && Number.isFinite(r.scoreNum)).map((r) => r.scoreNum);
                  const madeCutScoreNums = ppfRows.filter((r) => !isCutRow(r) && r.scoreNum !== 9999 && Number.isFinite(r.scoreNum)).map((r) => r.scoreNum);
                  const derivedCutNum = missedCutScoreNums.length
                    ? Math.min(...missedCutScoreNums) - 1
                    : (madeCutScoreNums.length ? Math.max(...madeCutScoreNums) : null);
                  const cutLineLabel = cutLine ?? (derivedCutNum === null ? null : derivedCutNum === 0 ? 'E' : derivedCutNum > 0 ? `+${derivedCutNum}` : String(derivedCutNum));
                  const sortableTh = (label: string, key: typeof ppfSortKey, title: string) => (
                    <th title={title} onClick={() => setSort(key)} style={{ padding: '9px 7px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor }}>{label}{arrow(key)}</th>
                  );
                  const plainTh = (label: string, title: string) => (
                    <th title={title} style={{ padding: '9px 7px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor }}>{label}</th>
                  );
                  const numCell = (v: number) => (v ? v : <span style={{ color: isOpen ? '#000' : '#c3cdd8' }}>–</span>);
                  const tournamentBlock = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxWidth: isMobile ? undefined : 320, flex: isMobile ? '1 1 130px' : '0 0 240px', minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Tournament</label>
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
                        <select
                          value={ppfTournament}
                          onChange={(e) => { setPpfTournament(e.target.value as TournamentId | ''); setPpfSearch(''); setPpfSortKey('finish'); setPpfSortDir('asc'); setPpfSelectedRow(null); }}
                          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: ppfTournament ? 'transparent' : '#94a3b8', WebkitTextFillColor: ppfTournament ? 'transparent' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                        >
                          <option value="" disabled style={{ color: '#94a3b8', WebkitTextFillColor: '#94a3b8' }}>Select tournament</option>
                          {REPORT_TOURNAMENTS.map((t) => (
                            <option key={t.id} value={t.id} style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>{t.label}</option>
                          ))}
                        </select>
                        {ppfTournament && TOURNAMENT_TAB_LOGOS[ppfTournament] && (
                          <span style={{ position: 'absolute', left: 12, right: 34, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none' }}>
                            <img src={TOURNAMENT_TAB_LOGOS[ppfTournament]} alt={REPORT_TOURNAMENTS.find((t) => t.id === ppfTournament)?.label ?? ''} style={{ height: REPORT_DROPDOWN_LOGO_H[ppfTournament], width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                  return (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12 }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Player Performance Summary</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 8 : 12, flex: isMobile ? '1 1 100%' : '0 0 auto', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
                          {tournamentBlock}
                          {isMobile && reportYearSelect}
                          {ppfTournament && (
                            <div style={{ position: 'relative', flex: isMobile ? '1 1 92px' : '0 0 auto', minWidth: isMobile ? 88 : 130 }}>
                              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                              <input
                                value={ppfSearch}
                                onChange={(e) => setPpfSearch(e.target.value)}
                                placeholder="Search"
                                style={{ width: isMobile ? '100%' : 230, boxSizing: 'border-box', padding: '9px 30px 9px 32px', borderRadius: 10, border: '1px solid #cdd9e5', fontSize: isMobile ? 16 : 13.5, fontWeight: 600, color: '#0f1720', outline: 'none' }}
                              />
                              {ppfSearch && (
                                <button onClick={() => setPpfSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
                              )}
                            </div>
                          )}
                          {!isMobile && reportYearSelect}
                        </div>
                      </div>
                      {ppfTournament && (
                        sorted.length === 0 ? (
                          <div style={{ marginTop: 20, fontSize: 14, color: '#5b6b79' }}>{q ? 'No players match your search.' : 'No field data available for this tournament yet.'}</div>
                        ) : (
                          <div style={{ marginTop: isMobile ? 16 : 22 }}>
                            <div ref={ppfScrollRef} style={{ overflow: 'auto', maxHeight: isMobile ? '68vh' : '72vh', WebkitOverflowScrolling: 'touch', border: '1px solid #d1dae3', borderRadius: 10, background: isOpen ? openGold : undefined }}>
                              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: isMobile ? 11.5 : 12 }}>
                                <thead>
                                  <tr style={{ background: tColor, color: '#fff', textAlign: 'center', fontSize: isMobile ? 10 : 11 }}>
                                    <th title="Finishing position" style={{ padding: '9px 7px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor, width: 44, minWidth: 44 }}>POS</th>
                                    <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, background: tColor, width: isMobile ? 172 : 200, minWidth: isMobile ? 172 : 200 }}>PLAYER</th>
                                    {sortableTh('SCORE', 'finish', 'Score to par (sorts by finish)')}
                                    {sortableTh('PARS', 'par', 'Pars')}
                                    {sortableTh('BIRD', 'birdie', 'Birdies')}
                                    {sortableTh('EAG', 'eagle', 'Eagles')}
                                    {sortableTh('BOG', 'bogey', 'Bogeys')}
                                    {sortableTh('DBL', 'double', 'Double bogeys')}
                                    {sortableTh('TRP', 'triple', 'Triple bogeys or worse')}
                                    {plainTh('ACE', 'Hole-in-ones')}
                                    {plainTh('3BST', '3-birdie streaks')}
                                    {plainTh('NBR', 'No-bogey rounds')}
                                    {plainTh('LOW', 'Tournament low round')}
                                    {plainTh('R1', 'Round 1 leader')}
                                    {plainTh('R2', 'Round 2 leader')}
                                    {plainTh('R3', 'Round 3 leader')}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sorted.map((r, i) => {
                                    const rowIsCut = (row: typeof r) => CUT_MARK.has(String(row.position).toUpperCase()) || !row.madeCut;
                                    const isCut = rowIsCut(r);
                                    const leaderMark = (on: boolean) => on ? <span style={{ color: '#0f7a3d', fontWeight: 900 }}>✓</span> : <span style={{ color: isOpen ? '#000' : '#c3cdd8' }}>–</span>;
                                    const rowFlag = getPlayerFlag(r.name) ? getFlagSrc(r.name) : null;
                                    // In the default finish sort the field is grouped made-cut → missed-cut, so drop a
                                    // cut-line divider at the boundary (first cut player, just below the last to make it).
                                    const showCutLine = ppfSortKey === 'finish' && !q && isCut && i > 0 && !rowIsCut(sorted[i - 1]);
                                    const isSelected = ppfSelectedRow === r.name;
                                    const rowHighlight = ppfTournament === 'masters' ? '#dcfce7' : ppfTournament === 'open' ? '#93c5fd' : '#dbeafe';
                                    const rowBg = isSelected ? rowHighlight : (isOpen ? openGold : (i % 2 === 0 ? '#fff' : '#f7fafc'));
                                    return (
                                      <Fragment key={`${r.name}-${i}`}>
                                      {showCutLine && (
                                        <tr>
                                          <td colSpan={16} style={{ padding: 0, background: isOpen ? openGold : '#fff' }}>
                                            <div style={{ position: 'sticky', left: 0, width: ppfViewportW || '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
                                              <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#111827', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>CUT LINE{cutLineLabel ? `: ${cutLineLabel}` : ''}</span>
                                              <div style={{ flex: 1, height: 2, background: '#111827' }} />
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                      <tr onClick={() => setPpfSelectedRow((prev) => prev === r.name ? null : r.name)} style={{ background: rowBg, borderTop: isOpen ? '1px solid rgba(0,0,0,0.12)' : '1px solid #eef2f6', textAlign: 'center', color: isOpen ? '#000' : '#0f1720', cursor: 'pointer' }}>
                                        <td style={{ padding: '8px 7px', fontWeight: 700, whiteSpace: 'nowrap', color: isCut ? '#dc2626' : (isOpen ? '#000' : '#0f1720'), width: 44, minWidth: 44 }}>{isCut ? 'CUT' : formatLeaderboardPosition(r.position)}</td>
                                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, width: isMobile ? 172 : 200, minWidth: isMobile ? 172 : 200, maxWidth: isMobile ? 172 : 200 }}>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ width: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>{rowFlag && <img src={rowFlag} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: isOpen ? '0.5px solid #000' : '1px solid #d1d9e0' }} />}</span>
                                            <span style={{ whiteSpace: 'normal', lineHeight: 1.2, minWidth: 0 }}>{r.name}</span>
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 7px', fontWeight: 800, whiteSpace: 'nowrap', color: r.scoreNum < 0 ? '#dc2626' : '#0f1720' }}>{r.scoreDisplay}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.par)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.birdie)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.eagle)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.bogey)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.double)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.triple)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.ace)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.streak)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.bogeyFree)}</td>
                                        <td style={{ padding: '8px 7px' }}>{numCell(r.lowRound)}</td>
                                        <td style={{ padding: '8px 7px' }}>{leaderMark(r.r1)}</td>
                                        <td style={{ padding: '8px 7px' }}>{leaderMark(r.r2)}</td>
                                        <td style={{ padding: '8px 7px' }}>{leaderMark(r.r3)}</td>
                                      </tr>
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      )}
                    </>
                  );
                })() : selectedReport === 'Pool Standings History' ? (() => {
                  const tournamentBlock = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: isMobile ? '1 1 120px' : '0 0 240px', minWidth: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Tournament</label>
                      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
                        <select
                          value={pshTournament}
                          onChange={(e) => { const t = e.target.value as TournamentId | ''; setPshTournament(t); if (t) openTournamentHistory(t, pshYear); else setHistoryPopup(null); }}
                          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: pshTournament ? 'transparent' : '#94a3b8', WebkitTextFillColor: pshTournament ? 'transparent' : '#94a3b8', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                        >
                          <option value="" disabled style={{ color: '#94a3b8', WebkitTextFillColor: '#94a3b8' }}>Select tournament</option>
                          {REPORT_TOURNAMENTS.map((t) => (
                            <option key={t.id} value={t.id} style={{ color: '#0f1720', WebkitTextFillColor: '#0f1720' }}>{t.label}</option>
                          ))}
                        </select>
                        {pshTournament && TOURNAMENT_TAB_LOGOS[pshTournament] && (
                          <span style={{ position: 'absolute', left: 12, right: 34, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none' }}>
                            <img src={TOURNAMENT_TAB_LOGOS[pshTournament]} alt={REPORT_TOURNAMENTS.find((t) => t.id === pshTournament)?.label ?? ''} style={{ height: REPORT_DROPDOWN_LOGO_H[pshTournament], width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                  const yearBlock = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: isMobile ? '0 0 116px' : '0 0 160px' }}>
                      <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b6b79' }}>Year</label>
                      <select
                        value={String(pshYear)}
                        onChange={(e) => { const y = Number(e.target.value); setPshYear(y); if (pshTournament) openTournamentHistory(pshTournament, y); }}
                        style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: '#fff', border: '1px solid #cdd9e5', borderRadius: 10, padding: '10px 34px 10px 12px', fontSize: 14, fontWeight: 700, color: '#0f1720', cursor: 'pointer', backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%235b6b79\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                      >
                        {[...POOL_SEASONS].sort((a, b) => b - a).map((yr) => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>
                  );
                  const pshLoaded = !!pshTournament && historyPopup?.tournament === pshTournament;
                  const pshRows = pshLoaded ? (historyPopup?.data?.standings ?? []) : [];
                  const pshLoading = pshLoaded && !!historyPopup?.loading;
                  const pshLoadedYear = historyPopup?.year;
                  const pshHeaderSolid = pshTournament ? REPORT_TOURNAMENT_SOLID[pshTournament] : '#173b63';
                  const pshPayouts = (pshLoaded ? historyPopup?.data?.payouts : null) ?? (pshTournament ? pool?.payouts?.[pshTournament] : null) ?? null;
                  const pshMedal = (place: number) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : null);
                  const pshPayoutFor = (place: number) => (place === 1 ? pshPayouts?.first : place === 2 ? pshPayouts?.second : place === 3 ? pshPayouts?.third : undefined);
                  const pshIsOpen = pshTournament === 'open';
                  const pshDivider = (pshTournament === 'players' || pshTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef';
                  const pshTh: React.CSSProperties = { padding: isMobile ? '10px 6px' : '10px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#fff' };
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: isMobile ? 10 : 14, rowGap: 12, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>Pool Standings History</div>
                        {!isMobile && (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                            {tournamentBlock}
                            {yearBlock}
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14 }}>
                          {tournamentBlock}
                          {yearBlock}
                        </div>
                      )}
                      {pshLoaded ? (
                        pshLoading ? (
                          <div style={{ marginTop: isMobile ? 20 : 26, fontSize: 14, color: '#5b6b79' }}>Loading {pshLoadedYear} standings…</div>
                        ) : pshRows.length === 0 ? (
                          <div style={{ marginTop: isMobile ? 20 : 26, fontSize: 14, color: '#5b6b79', lineHeight: 1.5 }}>No banked standings for the {pshLoadedYear} season yet.</div>
                        ) : (
                          <div style={{ marginTop: isMobile ? 18 : 24, border: '1px solid #d1dae3', borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: pshIsOpen ? '#F4BC41' : '#fff' }}>
                              <thead>
                                <tr style={{ background: pshHeaderSolid }}>
                                  <th style={{ ...pshTh, textAlign: 'center' }}>RANK</th>
                                  <th style={{ ...pshTh, textAlign: 'left' }}>ENTRY</th>
                                  <th style={{ ...pshTh, textAlign: 'center' }}>POINTS</th>
                                  <th style={{ ...pshTh, textAlign: 'center' }}>TIEBREAK</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pshRows.map((r, i) => {
                                  const clickable = (r.golfers?.length ?? 0) > 0;
                                  return (
                                    <tr key={i} onClick={clickable ? () => setHistoryRoster(r) : undefined} style={{ borderTop: pshDivider, cursor: clickable ? 'pointer' : 'default' }}>
                                      <td style={{ textAlign: 'center', padding: isMobile ? '9px 5px' : '9px 8px', fontSize: 13, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{r.place}</td>
                                      <td style={{ padding: isMobile ? '9px 6px' : '9px 12px', fontSize: 13, color: '#0f1720', fontWeight: r.place <= 3 ? 800 : 500 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                          <span style={{ whiteSpace: 'nowrap' }}>{r.name}</span>
                                          {pshMedal(r.place) && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                              <span style={{ fontSize: 15 }}>{pshMedal(r.place)}</span>
                                              {typeof pshPayoutFor(r.place) === 'number' && (
                                                <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#0f7a3d' }}>(${pshPayoutFor(r.place)!.toLocaleString()})</span>
                                              )}
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'center', padding: isMobile ? '9px 6px' : '9px 8px', fontSize: 13, fontWeight: 700, color: '#0f1720', whiteSpace: 'nowrap' }}>{r.points % 1 === 0 ? r.points : r.points.toFixed(1)}</td>
                                      <td style={{ textAlign: 'center', padding: isMobile ? '9px 6px' : '9px 8px', fontSize: 13, fontWeight: 600, color: pshIsOpen ? '#000' : '#5b6b79', whiteSpace: 'nowrap' }}>{r.tieBreak}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : null}
                    </>
                  );
                })() : selectedReport ? (
                  <>
                    <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#000000' }}>{selectedReport}</div>
                    <div style={{ marginTop: 10, fontSize: isMobile ? 13 : 15, color: '#5b6b79', lineHeight: 1.55 }}>
                      This report is coming soon.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 900, color: '#0f1720' }}>Choose a report</div>
                    <div style={{ marginTop: 10, fontSize: isMobile ? 13 : 15, color: '#5b6b79', lineHeight: 1.55 }}>
                      Use the <strong>Reports</strong> menu above to pick a summary to view.
                    </div>
                    <div style={{ marginTop: 16, display: 'grid', gap: 8, maxWidth: 360 }}>
                      {REPORT_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setSelectedReport(opt)}
                          style={{ textAlign: 'left', background: '#f0f6ff', border: '1px solid #dce8f5', borderRadius: 12, padding: '12px 16px', fontSize: isMobile ? 13 : 14, fontWeight: 700, color: '#173b63', cursor: 'pointer' }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          </main>
        )}

        {mainTab === 'Commissioner Hub' && (
          <main style={{ marginTop: isMobile ? 12 : 24, display: 'grid', gap: isMobile ? 12 : 20 }}>
            {commissionerConsoleView === 'dashboard' ? (
              <>
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? '9px 14px' : '15px 22px',
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: isMobile ? 6 : 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                    Pool Status
                  </div>
                  {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                    <img src={TOURNAMENT_TAB_LOGOS[tournament.id]} alt={tournament.name} style={{ height: isMobile ? (tournament.id === 'players' ? 58 : 40) : (tournament.id === 'players' ? 76 : 56), maxWidth: isMobile ? (tournament.id === 'players' ? 220 : 150) : (tournament.id === 'players' ? 300 : 220), objectFit: 'contain' }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setLeagueModalOpen(true)}
                  style={{
                    padding: isMobile ? '7px 15px' : '9px 18px',
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 800,
                    borderRadius: 9,
                    border: '1px solid #e2e8ef',
                    background: '#fff',
                    color: '#173b63',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Leagues
                </button>
                <button
                  onClick={() => void handleLogout()}
                  disabled={authBusy}
                  style={{
                    padding: isMobile ? '7px 15px' : '9px 18px',
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 800,
                    borderRadius: 9,
                    border: '1px solid #e2e8ef',
                    background: '#fff',
                    color: '#5b6b79',
                    cursor: authBusy ? 'not-allowed' : 'pointer',
                    opacity: authBusy ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  Sign Out
                </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: isMobile ? 8 : 14,
                  gridAutoRows: '1fr', // equal-height rows so all four status boxes match
                }}
              >
                <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 12 : 18, padding: isMobile ? 10 : 16, background: '#f8fbfd', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Data source
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: isMobile ? 12 : 16 }}>
                    {/* ESPN then PGA Tour just to its right, PGA sized bigger (near-square badge vs wide ESPN).
                        Heights kept modest so this box doesn't drive the equal-height grid taller. */}
                    <img src="/espn-logo.png" alt="ESPN" style={{ height: isMobile ? 26 : 34, maxHeight: '100%', width: 'auto', objectFit: 'contain', display: 'block' }} />
                    <img src="/pga-tour-logo.png" alt="PGA Tour" style={{ height: isMobile ? 38 : 46, maxHeight: '100%', width: 'auto', objectFit: 'contain', display: 'block' }} />
                  </div>
                </div>
                <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 12 : 18, padding: isMobile ? 10 : 16, background: '#f8fbfd' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Last sync
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 13 : 18, fontWeight: 800 }}>{formatRefresh(feed?.fetchedAt ?? null).replace(/^Updated /, '')}</div>
                </div>
                <button
                  onClick={handleToggleLineupLock}
                  disabled={!canManagePool || commissionerBusy}
                  style={{
                    border: `1.5px solid ${locked ? '#e7a3a3' : '#a8d3ba'}`,
                    borderRadius: isMobile ? 12 : 18,
                    padding: isMobile ? 10 : 16,
                    background: locked ? '#fbf1f1' : '#f1f8f4',
                    textAlign: 'left',
                    cursor: !canManagePool || commissionerBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Lineup lock
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: locked ? '#c0271f' : '#1f7a46', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: isMobile ? 8 : 9, height: isMobile ? 8 : 9, borderRadius: '50%', background: locked ? '#dc2626' : '#2d7a4f', flexShrink: 0 }} />
                    {locked ? 'Locked' : 'Unlocked'}
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 11 : 13, color: '#5b6b79' }}>
                    {locked ? 'Click to unlock roster editing' : 'Click to lock roster editing'}
                  </div>
                </button>
                <button
                  onClick={handleTogglePicksOpen}
                  disabled={!canManagePool || commissionerBusy}
                  style={{
                    border: `1.5px solid ${pool?.picksOpen?.[selectedTournament] ? '#a8d3ba' : '#e7a3a3'}`,
                    borderRadius: isMobile ? 12 : 18,
                    padding: isMobile ? 10 : 16,
                    background: pool?.picksOpen?.[selectedTournament] ? '#f1f8f4' : '#fbf1f1',
                    textAlign: 'left',
                    cursor: !canManagePool || commissionerBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>
                    Player picks
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 14 : 18, fontWeight: 800, color: pool?.picksOpen?.[selectedTournament] ? '#1f7a46' : '#c0271f', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: isMobile ? 8 : 9, height: isMobile ? 8 : 9, borderRadius: '50%', background: pool?.picksOpen?.[selectedTournament] ? '#2d7a4f' : '#dc2626', flexShrink: 0 }} />
                    {pool?.picksOpen?.[selectedTournament] ? 'Open' : 'Closed'}
                  </div>
                  <div style={{ marginTop: isMobile ? 4 : 8, fontSize: isMobile ? 11 : 13, color: '#5b6b79' }}>
                    {pool?.picksOpen?.[selectedTournament] ? 'Click to hide pick sheet' : 'Click to show pick sheet'}
                  </div>
                </button>
              </div>

              {isAppAdmin ? (
              <>
              {/* Standings view — an independent pre-tournament / results toggle for EACH tournament,
                  since these aren't tied to the tab you're viewing. */}
              <div style={{ marginTop: isMobile ? 14 : 20 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', marginBottom: isMobile ? 8 : 10 }}>
                  Standings view — per tournament
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))', gap: isMobile ? 8 : 12 }}>
                  {(() => {
                    void preTournamentTick; // re-read module maps when any override changes
                    return TOURNAMENTS.map((t) => {
                      const isPre = shouldShowPreTournamentView(t, new Date(nowTick));
                      const busy = preTournamentBusy === t.id;
                      const logo = TOURNAMENT_TAB_LOGOS[t.id];
                      return (
                        <button
                          key={t.id}
                          onClick={() => savePreTournamentOverride(t.id, !isPre)}
                          disabled={!canManagePool || busy}
                          style={{
                            border: `1.5px solid ${isPre ? '#a9c2e0' : '#d9e2ea'}`,
                            borderRadius: isMobile ? 11 : 14,
                            padding: isMobile ? '8px 10px' : '9px 12px',
                            background: isPre ? '#eef4fb' : '#f7f9fb',
                            textAlign: 'left',
                            cursor: !canManagePool || busy ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <span style={{ width: isMobile ? 82 : 74, height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {logo && <img src={logo} alt={t.name} style={{ maxHeight: t.id === 'open' ? 36 : 44, maxWidth: t.id === 'open' ? 62 : (isMobile ? 82 : 74), objectFit: 'contain', display: 'block' }} />}
                          </span>
                          <div style={{ minWidth: 0, flex: 1, fontSize: isMobile ? 13.5 : 13, fontWeight: 800, color: isPre ? '#234d80' : '#3a4a58', display: 'flex', alignItems: 'center', gap: isMobile ? 7 : 6, whiteSpace: 'nowrap' }}>
                            <span style={{ width: isMobile ? 10 : 8, height: isMobile ? 10 : 8, borderRadius: '50%', background: isPre ? '#234d80' : '#94a3b8', flexShrink: 0 }} />
                            {isPre ? 'Pre-tournament' : 'Results'}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
              </>
              ) : null}

            </section>

            {/* Pool data tools — commissioner-only pages for the pick list + DP World ranks */}
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79', marginBottom: 14 }}>Pool Data Tools</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 8 : 12 }}>
                {isAppAdmin ? (
                <a
                  href="/commissioner-salary"
                  style={{ textDecoration: 'none', border: '1px solid #cdd9e1', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px', background: '#fff', color: '#0f1720', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12 }}
                >
                  <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: '#0f7a3d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                    <DollarSign size={isMobile ? 18 : 22} color="#fff" />
                    <img
                      src="/dollar-sign.png"
                      alt="Salary pick list"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#0f1720' }}>Full Field & Salary Pick List</div>
                    <div style={{ marginTop: 2, fontSize: isMobile ? 11 : 12, color: '#5b6b79' }}>Upload full field + salaries + OWGRs</div>
                  </div>
                </a>
                ) : null}
                {isAppAdmin ? (
                <a
                  href="/commissioner-dpworld"
                  style={{ textDecoration: 'none', border: '1px solid #cdd9e1', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px', background: '#fff', color: '#0f1720', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12 }}
                >
                  <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: '#3a1a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                    <Globe size={isMobile ? 18 : 22} color="#fff" />
                    <img
                      src="/dp-world-tour-logo.png"
                      alt="DP World Tour"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#0f1720' }}>DP World Rankings</div>
                    <div style={{ marginTop: 2, fontSize: isMobile ? 11 : 12, color: '#5b6b79' }}>Update Race to Dubai list</div>
                  </div>
                </a>
                ) : null}
                <button
                  onClick={() => { setCommissionerRosterMemberId(null); setCommissionerMemberSearch(''); setShowAddMemberForm(false); setCommissionerConsoleView('members'); }}
                  style={{ textAlign: 'left', border: '1px solid #cdd9e1', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px', background: '#fff', color: '#0f1720', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12 }}
                >
                  <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: entriesTournamentBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={isMobile ? 18 : 22} />
                  </div>
                  <div>
                    <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#0f1720' }}>Member Management</div>
                    <div style={{ marginTop: 2, fontSize: isMobile ? 11 : 12, color: '#5b6b79' }}>Full member listing &amp; participation</div>
                  </div>
                </button>
                {isAppAdmin ? (
                <button
                  onClick={() => {
                    const current = lockTimeOverrides[entriesTournamentId] ?? TOURNAMENT_META[entriesTournamentId]?.lockAtUtc;
                    setPoolLockInput(current ? utcToCentralInput(current) : '');
                    setPoolLockMsg('');
                    setPoolLockModalOpen(true);
                  }}
                  style={{ textAlign: 'left', border: '1px solid #cdd9e1', borderRadius: 12, padding: isMobile ? '12px 14px' : '14px 16px', background: '#fff', color: '#0f1720', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12 }}
                >
                  <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: entriesTournamentSolid, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Lock size={isMobile ? 18 : 22} />
                  </div>
                  <div>
                    <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#0f1720' }}>Pool Lock Time</div>
                    <div style={{ marginTop: 2, fontSize: isMobile ? 11 : 12, color: '#5b6b79' }}>Set Round 1 first tee time</div>
                  </div>
                </button>
                ) : null}
              </div>
            </section>

            {/* ── Pool Lock Time modal ─────────────────────────────────────── */}
            {poolLockModalOpen && (
              <div
                onClick={() => setPoolLockModalOpen(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 900 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(430px, calc(100vw - 32px))', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                  <div style={{ background: entriesTournamentSolid, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>Pool Lock Time</div>
                    {TOURNAMENT_TAB_LOGOS[entriesTournamentId] && (
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[entriesTournamentId] ?? TOURNAMENT_TAB_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={{ height: entriesTournamentId === 'pga' ? 60 : entriesTournamentId === 'players' ? 52 : entriesTournamentId === 'open' ? 40 : entriesTournamentId === 'masters' ? undefined : 36, width: entriesTournamentId === 'masters' ? 120 : undefined, margin: entriesTournamentId === 'pga' ? '-12px 0' : entriesTournamentId === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button onClick={() => setPoolLockModalOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                  <div style={{ padding: 20, display: 'grid', gap: 12 }}>
                    <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>
                      Round 1 first tee time for <b>{entriesTournament.name}</b>, in <b>Central time</b>. At exactly this moment picks lock and the standings switch to the live leaderboard.
                    </div>
                    {(() => {
                      const overrideIso = lockTimeOverrides[entriesTournamentId];
                      const effective = overrideIso ?? TOURNAMENT_META[entriesTournamentId]?.lockAtUtc;
                      if (!effective) return null;
                      const label = new Date(effective).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                      return (
                        <div style={{ border: '1.5px solid #d1dae3', borderRadius: 10, padding: '10px 12px', background: '#f4f7fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', boxSizing: 'border-box' }}>
                          <div>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.06em' }}>Current lock time</div>
                            <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: '#0f1720', marginTop: 2 }}>{label} CST</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '4px 10px', background: overrideIso ? '#15803d' : '#1e4d8c', color: '#ffffff', flexShrink: 0, whiteSpace: 'nowrap' }}>{overrideIso ? 'Set Manually' : 'Auto set'}</span>
                        </div>
                      );
                    })()}
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79', letterSpacing: '0.06em' }}>Set a new lock time (Central)</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="datetime-local"
                          value={poolLockInput}
                          onChange={(e) => setPoolLockInput(e.target.value)}
                          style={{ border: '1.5px solid #d1dae3', borderRadius: 10, padding: '10px 40px 10px 12px', fontSize: 14, fontWeight: 600, color: '#0f1720', width: '100%', boxSizing: 'border-box', minWidth: 0, minHeight: 44, background: '#fff', WebkitAppearance: 'none', appearance: 'none', textAlign: 'left' }}
                        />
                        {/* iOS renders no picker affordance — overlay a calendar icon so the box reads as tappable */}
                        {isMobile && (
                          <Calendar size={18} color="#5b6b79" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        )}
                      </div>
                    </label>
                    <button
                      onClick={() => void savePoolLockTime(false)}
                      disabled={!canManagePool || poolLockBusy || !poolLockInput}
                      style={{ border: 'none', borderRadius: 12, padding: '12px 16px', background: entriesTournamentSolid, color: '#fff', fontWeight: 900, cursor: (!canManagePool || poolLockBusy || !poolLockInput) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || poolLockBusy || !poolLockInput) ? 0.5 : 1 }}
                    >
                      Save lock time
                    </button>
                    {lockTimeOverrides[entriesTournamentId] && (
                      <button
                        onClick={() => void savePoolLockTime(true)}
                        disabled={!canManagePool || poolLockBusy}
                        style={{ border: '1.5px solid #d1dae3', borderRadius: 12, padding: '11px 16px', background: '#fff', color: '#374151', fontWeight: 700, cursor: (!canManagePool || poolLockBusy) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || poolLockBusy) ? 0.5 : 1 }}
                      >
                        Clear — use automatic schedule
                      </button>
                    )}
                    {poolLockMsg && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: poolLockMsg.startsWith('Saved') || poolLockMsg.startsWith('Cleared') ? '#16a34a' : '#dc2626' }}>{poolLockMsg}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pool management tools — each opens a centered modal; actions confirm before applying */}
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79', marginBottom: 14 }}>Pool Management Tools</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? 10 : 14 }}>
                {[
                  { key: 'payouts' as const, title: 'Tournament Payouts', sub: 'Set 1st / 2nd / 3rd place amounts', Icon: Trophy },
                  { key: 'markStatus' as const, title: 'Mark WD / DQ / MDF', sub: "Override a player's status", Icon: AlertCircle },
                  { key: 'roundLeader' as const, title: 'Round Leader Tools', sub: 'Clear a mis-captured round leader', Icon: RefreshCw },
                  { key: 'tiebreak' as const, title: 'Tiebreak Score', sub: 'Enter / override total strokes', Icon: Save },
                ].filter((t) => isAppAdmin || t.key === 'payouts' || t.key === 'tiebreak').map((t) => {
                  const Icon = t.Icon;
                  return (
                  <button
                    key={t.key}
                    onClick={() => { setPoolToolConfirm(null); setPoolToolModal(t.key); }}
                    disabled={!canManagePool}
                    style={{ textAlign: 'left', border: '1px solid #e6edf1', borderRadius: 16, padding: isMobile ? '12px 14px' : '16px 18px', background: 'linear-gradient(180deg, #ffffff 0%, #f7fafc 100%)', boxShadow: '0 6px 18px rgba(9, 34, 51, 0.06)', cursor: canManagePool ? 'pointer' : 'not-allowed', opacity: canManagePool ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: isMobile ? 11 : 13 }}
                  >
                    <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 10, background: entriesTournamentBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={isMobile ? 18 : 22} />
                    </div>
                    <div>
                      <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: '#0f1720' }}>{t.title}</div>
                      <div style={{ marginTop: 2, fontSize: isMobile ? 11 : 12, color: '#5b6b79' }}>{t.sub}</div>
                    </div>
                  </button>
                  );
                })}
              </div>
            </section>

            {/* ── Tool modal (centered) ─────────────────────────────────── */}
            {poolToolModal !== null && (
              <div
                onClick={() => { setPoolToolModal(null); setPoolToolConfirm(null); }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 900 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 40px - var(--safe-y))', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)' }}>
                  <div style={{ background: entriesTournamentSolid, borderRadius: '18px 18px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, minWidth: 0 }}>
                      {poolToolModal === 'payouts' ? 'Tournament Payouts' : poolToolModal === 'tiebreak' ? 'Tiebreak Score' : poolToolModal === 'roundLeader' ? 'Round Leader Tools' : 'Mark WD / DQ / MDF'}
                    </div>
                    {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[tournament.id] ?? TOURNAMENT_TAB_LOGOS[tournament.id]} alt={tournament.name} style={{ height: tournament.id === 'pga' ? 60 : tournament.id === 'players' ? 52 : tournament.id === 'open' ? 40 : tournament.id === 'masters' ? undefined : 36, width: tournament.id === 'masters' ? 120 : undefined, margin: tournament.id === 'pga' ? '-12px 0' : tournament.id === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button onClick={() => { setPoolToolModal(null); setPoolToolConfirm(null); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                  <div style={{ padding: 20, display: 'grid', gap: 14 }}>

                    {poolToolModal === 'payouts' && (
                      <>
                        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>Set the 1st, 2nd, and 3rd place payout amounts for the upcoming or active tournament.</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          {([['1st place', 'first'], ['2nd place', 'second'], ['3rd place', 'third']] as const).map(([label, key]) => (
                            <label key={key} style={{ display: 'grid', gap: 6 }}>
                              <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>{label}</span>
                              <input type="number" min="0" step="1" value={payoutForm[key]} onChange={(e) => setPayoutForm((c) => ({ ...c, [key]: e.target.value }))} placeholder="0" style={fieldStyle()} />
                            </label>
                          ))}
                        </div>
                        <button
                          onClick={() => setPoolToolConfirm({ title: 'Save payouts?', message: `Save payouts for ${commissionerTournamentLabel} — 1st: ${payoutForm.first || 0}, 2nd: ${payoutForm.second || 0}, 3rd: ${payoutForm.third || 0}?`, confirmLabel: 'Save payouts', onConfirm: () => { void handleSavePayouts(); setPoolToolModal(null); setPoolToolConfirm(null); } })}
                          disabled={!canManagePool || commissionerBusy}
                          style={{ border: 'none', borderRadius: 12, padding: '12px 16px', background: entriesTournamentSolid, color: '#fff', fontWeight: 900, cursor: (!canManagePool || commissionerBusy) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || commissionerBusy) ? 0.5 : 1 }}
                        >
                          Save payouts
                        </button>
                        {(commissionerError || commissionerSuccess) && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: commissionerError ? '#dc2626' : '#16a34a' }}>{commissionerError || commissionerSuccess}</div>
                        )}
                      </>
                    )}

                    {poolToolModal === 'tiebreak' && (
                      <>
                        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>Tiebreak resolves automatically once the tournament ends. Use this override only if the winner isn&apos;t in the player pool.</div>
                        {commissionerAutoDetected != null ? (
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 8, padding: '8px 12px' }}>Auto-detected: {commissionerAutoDetected} strokes</div>
                        ) : commissionerTournamentWinnerScore != null ? (
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', background: '#dbeafe', borderRadius: 8, padding: '8px 12px' }}>Manual override active: {commissionerTournamentWinnerScore} strokes</div>
                        ) : null}
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>{tiebreakResolved != null ? 'Override score' : 'Total strokes (e.g. 274)'}</span>
                          <input type="number" min="200" max="400" step="1" value={winnerScoreInput} onChange={(e) => setWinnerScoreInput(e.target.value)} placeholder="e.g. 274" style={fieldStyle()} />
                        </label>
                        <button
                          onClick={() => {
                            const score = Number(winnerScoreInput);
                            if (!Number.isFinite(score) || score < 200 || score > 400) { setCommissionerError('Enter a valid total stroke count (200–400).'); return; }
                            setPoolToolConfirm({ title: 'Save winner’s score?', message: `Set the ${commissionerTournamentLabel} tiebreak winner’s score to ${score} strokes?`, confirmLabel: 'Save score', onConfirm: () => { void handleSaveWinnerScore(); setPoolToolModal(null); setPoolToolConfirm(null); } });
                          }}
                          disabled={!canManagePool || commissionerBusy || !winnerScoreInput.trim()}
                          style={{ border: 'none', borderRadius: 12, padding: '12px 16px', background: entriesTournamentSolid, color: '#fff', fontWeight: 900, cursor: (!canManagePool || commissionerBusy || !winnerScoreInput.trim()) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || commissionerBusy || !winnerScoreInput.trim()) ? 0.5 : 1 }}
                        >
                          Save score
                        </button>
                        {(commissionerError || commissionerSuccess) && (
                          <div style={{ fontSize: 13, fontWeight: 600, color: commissionerError ? '#dc2626' : '#16a34a' }}>{commissionerError || commissionerSuccess}</div>
                        )}
                      </>
                    )}

                    {poolToolModal === 'roundLeader' && (
                      <>
                        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>If a round leader was incorrectly captured (e.g. during a suspension), clear it here. It will be re-captured automatically when the round officially ends.</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[1, 2, 3].map((rnd) => (
                            <button
                              key={rnd}
                              onClick={() => setPoolToolConfirm({ title: `Clear Round ${rnd} Leader?`, message: `This removes the Round ${rnd} leader bonus for whoever currently holds it. It will be re-captured automatically when the round officially ends.`, confirmLabel: 'Yes, clear', danger: true, onConfirm: () => { void handleClearRoundLeader(rnd); setPoolToolModal(null); setPoolToolConfirm(null); } })}
                              disabled={!canManagePool || clearLeaderBusy}
                              style={{ border: '1.5px solid #dc2626', borderRadius: 10, padding: '10px 14px', background: '#fff', color: '#dc2626', fontWeight: 800, fontSize: 13, cursor: (!canManagePool || clearLeaderBusy) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || clearLeaderBusy) ? 0.5 : 1 }}
                            >
                              Clear Rnd {rnd} Leader
                            </button>
                          ))}
                        </div>
                        {clearLeaderMsg && (<div style={{ fontSize: 13, fontWeight: 600, color: clearLeaderMsg.includes('cleared') ? '#16a34a' : '#dc2626' }}>{clearLeaderMsg}</div>)}
                      </>
                    )}

                    {poolToolModal === 'markStatus' && (
                      <>
                        <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.5 }}>Override the API when ESPN hasn&apos;t updated a player&apos;s status. Enter the player name as it appears in the pool (e.g. &quot;Jason Day&quot;). Accents are ignored.</div>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 800, color: '#5b6b79' }}>Player name</span>
                          <input type="text" value={playerStatusInput} onChange={(e) => setPlayerStatusInput(e.target.value)} placeholder="e.g. Jason Day" style={fieldStyle()} />
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(['WD', 'DQ', 'MDF'] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => { const nm = playerStatusInput.trim(); if (!nm) return; const label = status === 'MDF' ? 'MDF (Made Cut, Did Not Finish)' : status; setPoolToolConfirm({ title: `Mark ${status}?`, message: `Mark "${nm}" as ${label} for ${commissionerTournamentLabel}? This overrides the ESPN data immediately.`, confirmLabel: `Mark ${status}`, danger: true, onConfirm: () => { void handleMarkPlayerStatus(status); setPoolToolModal(null); setPoolToolConfirm(null); } }); }}
                              disabled={!canManagePool || playerStatusBusy || !playerStatusInput.trim()}
                              style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: entriesTournamentSolid, color: '#fff', fontWeight: 800, fontSize: 14, cursor: (!canManagePool || playerStatusBusy || !playerStatusInput.trim()) ? 'not-allowed' : 'pointer', opacity: (!canManagePool || playerStatusBusy || !playerStatusInput.trim()) ? 0.5 : 1 }}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                        {playerStatusMsg && (<div style={{ fontSize: 13, fontWeight: 600, color: playerStatusMsg.includes('marked') ? '#16a34a' : '#dc2626' }}>{playerStatusMsg}</div>)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Confirmation modal (on top of the tool modal) ───────────── */}
            {poolToolConfirm !== null && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1100 }} onClick={() => setPoolToolConfirm(null)}>
                <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(360px, calc(100vw - 32px))', background: '#fff', borderRadius: 18, padding: '26px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.28)', textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1720', marginBottom: 10 }}>{poolToolConfirm.title}</div>
                  <div style={{ fontSize: 13, color: '#5b6b79', lineHeight: 1.55, marginBottom: 22 }}>{poolToolConfirm.message}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setPoolToolConfirm(null)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid #d1dae3', background: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                    <button onClick={() => poolToolConfirm.onConfirm()} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: entriesTournamentSolid, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{poolToolConfirm.confirmLabel}</button>
                  </div>
                </div>
              </div>
            )}

            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap', marginBottom: isMobile ? 10 : 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>
                  Pick Submissions
                </div>
                {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                  <img src={TOURNAMENT_TAB_LOGOS[tournament.id]} alt={tournament.name} style={{ height: isMobile ? (tournament.id === 'players' ? 58 : 40) : (tournament.id === 'players' ? 76 : 56), maxWidth: isMobile ? (tournament.id === 'players' ? 220 : 150) : (tournament.id === 'players' ? 300 : 220), objectFit: 'contain' }} />
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: isMobile ? 10 : 20,
                }}
              >
                <div
                  style={{
                    flex: '1 1 0',
                    border: '1px solid #d7e0e8',
                    borderRadius: isMobile ? 12 : 20,
                    padding: isMobile ? 10 : 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: isMobile ? 6 : 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 900, color: '#0f1720' }}>Submitted Picks</div>
                    <button
                      onClick={() => setCommissionerPicksSort((s) => (s === 'alpha' ? 'newest' : 'alpha'))}
                      style={{ background: entriesTournamentSolid, border: 'none', borderRadius: 999, padding: isMobile ? '4px 9px' : '5px 12px', cursor: 'pointer', fontSize: isMobile ? 10 : 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}
                    >
                      {commissionerPicksSort === 'alpha' ? 'A–Z' : 'Newest'}
                    </button>
                  </div>
                  {submittedCommissionerMembers.length > 0 ? (
                    submittedCommissionerMembers.map((member) => (
                      <button
                        key={`submitted-${member.id}`}
                        onClick={() => setSubmittedRosterMemberId(member.id)}
                        style={{ borderRadius: 10, background: '#fff', border: 'none', padding: isMobile ? '6px 8px' : '12px 14px', color: '#0f1720', fontWeight: 700, fontSize: isMobile ? 12 : 14, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                      >
                        {member.displayName}
                      </button>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88', fontSize: isMobile ? 11 : 14 }}>No registered members have submitted picks yet.</div>
                  )}
                </div>

                <div
                  style={{
                    flex: '1 1 0',
                    border: '1px solid #d7e0e8',
                    borderRadius: isMobile ? 12 : 20,
                    padding: isMobile ? 10 : 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: isMobile ? 6 : 12,
                  }}
                >
                  <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 900, color: '#0f1720' }}>Still Need Picks</div>
                  {pendingCommissionerMembers.length > 0 ? (
                    pendingCommissionerMembers.map((member) => (
                      <div
                        key={`pending-${member.id}`}
                        style={{ borderRadius: 10, background: '#fff', padding: isMobile ? '6px 8px' : '12px 14px', color: '#0f1720', fontWeight: 700, fontSize: isMobile ? 12 : 14 }}
                      >
                        {member.displayName}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#6b7b88', fontSize: isMobile ? 11 : 14 }}>Everyone with a registered account has submitted picks.</div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Pick Popularity: how many teams picked each player ── */}
            {(() => {
              const counts = new Map<number, number>();
              for (const member of commissionerMembers) {
                for (const pid of member.rosters[entriesTournamentId] ?? []) {
                  counts.set(pid, (counts.get(pid) ?? 0) + 1);
                }
              }
              const rows = [...counts.entries()]
                .map(([pid, count]) => ({ player: playersById[pid], count }))
                .filter((r): r is { player: (typeof playersById)[number]; count: number } => !!r.player)
                .sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name));
              const maxCount = rows[0]?.count ?? 0;
              return (
                <section style={{ background: '#fff', borderRadius: 24, padding: isMobile ? 14 : 22, boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)' }}>
                  <button
                    onClick={() => setPickPopularityOpen((v) => !v)}
                    style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left' }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>Pick Popularity</div>
                      <div style={{ marginTop: 2, fontSize: isMobile ? 11 : 12, color: '#8a99a6' }}>
                        {rows.length > 0 ? `${rows.length} player${rows.length === 1 ? '' : 's'} picked across ${submittedCommissionerMembers.length} submitted team${submittedCommissionerMembers.length === 1 ? '' : 's'}` : 'No picks submitted yet'}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: '#5b6b79', flexShrink: 0 }}>{pickPopularityOpen ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {pickPopularityOpen && rows.length > 0 && (
                    <div style={{ marginTop: isMobile ? 12 : 16, display: 'grid', gap: isMobile ? 7 : 8 }}>
                      {rows.map(({ player, count }) => (
                        <div key={`pop-${player.id}`} style={{ display: 'grid', gridTemplateColumns: isMobile ? '24px 108px 1fr 22px' : '28px 170px 1fr 30px', alignItems: 'center', gap: isMobile ? 6 : 10 }}>
                          <img
                            src={playerPhotoSrc(player.name, player.pgaTourId, player.photoUrl)} data-fb={player.photoUrl ?? pgaPhoto(player.pgaTourId)} onError={photoOnError}
                            alt={player.name}
                            onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank })}
                            style={{ width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, borderRadius: '50%', objectFit: 'cover', background: '#f0f4f8', flexShrink: 0, cursor: 'pointer' }}
                          />
                          <span
                            onClick={() => setPickPopularityPlayer({ id: player.id, name: player.name })}
                            style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          >
                            {player.name}
                          </span>
                          <div style={{ background: '#eef2f6', borderRadius: 999, height: isMobile ? 10 : 12, overflow: 'hidden' }}>
                            <div style={{ width: `${maxCount > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 0}%`, height: '100%', background: entriesTournamentSolid, borderRadius: 999 }} />
                          </div>
                          <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: entriesTournamentSolid, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })()}

            {/* ── Picked-by popup: which entries selected this player ── */}
            {(() => {
              if (!pickPopularityPlayer) return null;
              const pickedBy = commissionerMembers
                .filter((m) => (m.rosters[entriesTournamentId] ?? []).includes(pickPopularityPlayer.id))
                .map((m) => m.displayName)
                .sort((a, b) => a.localeCompare(b));
              return (
                <div
                  onClick={() => setPickPopularityPlayer(null)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 150 }}
                >
                  <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(380px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 40px - var(--safe-y))', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: entriesTournamentSolid, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: 15, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickPopularityPlayer.name}</div>
                        </div>
                        {getFlagSrc(pickPopularityPlayer.name) && (() => {
                          // Long names (e.g. Bryson DeChambeau) would push an inline abbreviation off
                          // the edge — stack it under the flag for those; keep it beside the flag
                          // for everyone else. The flag always centers on the name line.
                          const stackedLabel = pickPopularityPlayer.name.length > 14;
                          return (
                            <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <img src={getFlagSrc(pickPopularityPlayer.name)} alt={getCountryLabel(pickPopularityPlayer.name)} style={{ width: 26, height: 17, objectFit: 'cover', borderRadius: 3, display: 'block' }} />
                              <span style={stackedLabel
                                ? { position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 2, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }
                                : { fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                              >{getCountryLabel(pickPopularityPlayer.name)}</span>
                            </div>
                          );
                        })()}
                      </div>
                      {TOURNAMENT_TAB_LOGOS[entriesTournamentId] && (
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                          <img src={KNOCKOUT_TAB_LOGOS[entriesTournamentId] ?? TOURNAMENT_TAB_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={{ height: entriesTournamentId === 'pga' ? 60 : entriesTournamentId === 'players' ? 52 : entriesTournamentId === 'open' ? 40 : entriesTournamentId === 'masters' ? undefined : 36, width: entriesTournamentId === 'masters' ? 120 : undefined, margin: entriesTournamentId === 'pga' ? '-12px 0' : entriesTournamentId === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                        </div>
                      )}
                      <button onClick={() => setPickPopularityPlayer(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                    </div>
                    <div style={{ padding: isMobile ? 14 : 16, display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0 }}>
                      {pickedBy.length > 0 ? pickedBy.map((name) => (
                        <div key={`picked-by-${name}`} style={{ padding: '10px 14px', borderRadius: 12, background: '#f4f7fa', fontSize: 14, fontWeight: 700, color: '#0f1720' }}>
                          {name}
                        </div>
                      )) : (
                        <div style={{ color: '#6b7b88', fontSize: 13 }}>No entries have this player.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Submitted roster popup (player info popup stacks above at z 200) ── */}
            {(() => {
              if (!submittedRosterMemberId) return null;
              const member = commissionerMembers.find((m) => m.id === submittedRosterMemberId);
              if (!member) return null;
              const roster = (member.rosters[entriesTournamentId] ?? [])
                .map((id) => playersById[id])
                .filter(Boolean)
                .sort((a, b) => b.salary - a.salary);
              const leftOver = SALARY_CAP - roster.reduce((sum, p) => sum + p.salary, 0);
              return (
                <div
                  onClick={() => setSubmittedRosterMemberId(null)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 150 }}
                >
                  <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 40px - var(--safe-y))', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: entriesTournamentSolid, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, minWidth: 0 }}>{member.displayName}</div>
                      {TOURNAMENT_TAB_LOGOS[tournament.id] && (
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
                          <img src={KNOCKOUT_TAB_LOGOS[tournament.id] ?? TOURNAMENT_TAB_LOGOS[tournament.id]} alt={tournament.name} style={{ height: tournament.id === 'pga' ? 60 : tournament.id === 'players' ? 52 : tournament.id === 'open' ? 40 : tournament.id === 'masters' ? undefined : 36, width: tournament.id === 'masters' ? 120 : undefined, margin: tournament.id === 'pga' ? '-12px 0' : tournament.id === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                        </div>
                      )}
                      <button onClick={() => setSubmittedRosterMemberId(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                    </div>
                    <div style={{ padding: isMobile ? 14 : 18, display: 'grid', gap: 8, overflowY: 'auto', minHeight: 0 }}>
                      {roster.length > 0 ? roster.map((p) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #e2e8ef', borderRadius: 12, background: '#f8fbfd', overflow: 'hidden', minHeight: isMobile ? 56 : 62 }}>
                          <div style={{ width: isMobile ? 62 : 70, flexShrink: 0, alignSelf: 'stretch', background: '#fff', overflow: 'hidden', position: 'relative' }}>
                            <img
                              src={playerPhotoSrc(p.name, p.pgaTourId, p.photoUrl)} data-fb={p.photoUrl ?? pgaPhoto(p.pgaTourId)} onError={photoOnError}
                              alt={p.name}
                              className="roster-card-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: isMobile ? '8px 12px' : '8px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: '#0f1720' }}>{p.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: p.id, name: p.name, pgaTourId: p.pgaTourId, photoUrl: p.photoUrl, worldRank: p.worldRank }); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1, touchAction: 'manipulation' }}>&#9432;</button>
                            </div>
                            <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: entriesTournamentSolid, flexShrink: 0 }}>${p.salary.toLocaleString()}</span>
                          </div>
                        </div>
                      )) : (
                        <div style={{ color: '#6b7b88', fontSize: 13 }}>No roster found for this tournament.</div>
                      )}
                      {roster.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid #e2e8ef', paddingTop: 10, marginTop: 2 }}>
                          <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: '#5b6b79' }}>Left Over: <span style={{ color: leftOver < 0 ? '#dc2626' : '#16a34a' }}>${leftOver.toLocaleString()}</span></span>
                          <button
                            onClick={() => { commissionerEditReturnRef.current = { view: commissionerConsoleView, memberId: member.id }; setSubmittedRosterMemberId(null); openCommissionerMemberPicks(member.id); }}
                            style={{ border: 'none', borderRadius: 10, padding: '9px 22px', background: entriesTournamentSolid, color: '#fff', fontWeight: 800, fontSize: isMobile ? 13 : 14, cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
              </>
            ) : commissionerConsoleView === 'members' ? (
            <section
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: isMobile ? 14 : 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'grid',
                gap: isMobile ? 10 : 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 10 : 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
                  <button
                    onClick={() => { setCommissionerConsoleView('dashboard'); setShowAddMemberForm(false); }}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 999,
                      background: '#fff',
                      width: isMobile ? 32 : 44,
                      height: isMobile ? 32 : 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <ArrowLeft size={isMobile ? 14 : 20} />
                  </button>
                  <div>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 34, color: '#0f1720' }}>Member Management</h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMemberForm((current) => !current)}
                  style={{
                    border: 'none',
                    borderRadius: 14,
                    padding: isMobile ? '8px 12px' : '12px 18px',
                    background: entriesTournamentSolid,
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: isMobile ? 12 : 14,
                    cursor: 'pointer',
                  }}
                >
                  {showAddMemberForm ? 'Close Add Members' : 'Add Members'}
                </button>
              </div>

              {showAddMemberForm ? (
                <div
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 20,
                    padding: 18,
                    background: '#f8fbfd',
                    display: 'grid',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1720' }}>Add a new member</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <input
                      value={memberCreateForm.displayName}
                      onChange={(event) => setMemberCreateForm({ ...memberCreateForm, displayName: event.target.value })}
                      placeholder="Display name"
                      style={fieldStyle()}
                    />
                    <input
                      value={memberCreateForm.email}
                      onChange={(event) => setMemberCreateForm({ ...memberCreateForm, email: event.target.value })}
                      placeholder="Email"
                      style={fieldStyle()}
                    />
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showMemberPassword ? 'text' : 'password'}
                        value={memberCreateForm.password}
                        onChange={(event) => setMemberCreateForm({ ...memberCreateForm, password: event.target.value })}
                        placeholder="Password"
                        style={{ ...fieldStyle(), paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowMemberPassword((v) => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7b88', display: 'flex', alignItems: 'center' }}
                      >
                        {showMemberPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={handleCreateMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentSolid,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Create member
                    </button>
                  </div>
                </div>
              ) : null}

              {commissionerError ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 16,
                    background: '#fff5f5',
                    color: '#a61b1b',
                    border: '1px solid #fecaca',
                    padding: '14px 16px',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{commissionerError}</span>
                </div>
              ) : null}

              {commissionerSuccess ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 16,
                    background: '#eef4ff',
                    color: '#2f5f96',
                    border: '1px solid #c7d8ee',
                    padding: '14px 16px',
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{commissionerSuccess}</span>
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: isMobile ? 8 : 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: '#31424f' }}>
                  {commissionerMembers.length} Active Members
                </div>
                <div
                  style={{
                    minWidth: isMobile ? 0 : 280,
                    maxWidth: 360,
                    flex: isMobile ? '1 1 auto' : '1 1 280px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid #d7e0e8',
                    borderRadius: 12,
                    background: '#fff',
                    padding: isMobile ? '8px 10px' : '12px 14px',
                  }}
                >
                  <Search size={isMobile ? 14 : 18} color="#6b7b88" />
                  <input
                    value={commissionerMemberSearch}
                    onChange={(event) => setCommissionerMemberSearch(event.target.value)}
                    placeholder="Search"
                    style={{ ...fieldStyle(), border: 'none', outline: 'none', padding: 0, fontSize: isMobile ? 16 : 15 }}
                  />
                  {commissionerMemberSearch && (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setCommissionerMemberSearch(''); }}
                      style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                      aria-label="Clear search"
                    >
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                    </button>
                  )}
                </div>
              </div>

              <div style={{ border: '1px solid #e6edf1', borderRadius: isMobile ? 14 : 22, overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', background: '#fff' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '140px 190px 100px 46px' : 'minmax(220px, 1.1fr) minmax(260px, 1.25fr) minmax(180px, 0.8fr) 90px',
                    gap: isMobile ? 8 : 16,
                    padding: isMobile ? '8px 12px' : '18px 22px',
                    background: '#f8fbfd',
                    color: '#5b6b79',
                    fontSize: isMobile ? 10 : 13,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  {(['displayName', 'email'] as const).map((col) => (
                    <div
                      key={col}
                      style={{
                        display: 'flex',
                        justifyContent: (!isMobile && col === 'email') ? 'center' : 'flex-start',
                        ...(isMobile && col === 'displayName' ? { position: 'sticky', left: 0, background: '#f8fbfd', zIndex: 2 } : {}),
                      }}
                    >
                      <button
                        onClick={() => setCommissionerMemberSort((prev) => ({
                          column: col,
                          direction: prev.column === col && prev.direction === 'asc' ? 'desc' : 'asc',
                        }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#5b6b79', fontSize: isMobile ? 10 : 13, fontWeight: 800, textTransform: 'uppercase' }}
                      >
                        {col === 'displayName' ? 'Display Name' : 'Email'}
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 1 }}>
                          <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === col && commissionerMemberSort.direction === 'asc' ? 1 : 0.3 }}>▲</span>
                          <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === col && commissionerMemberSort.direction === 'desc' ? 1 : 0.3 }}>▼</span>
                        </span>
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      onClick={() => setCommissionerMemberSort((prev) => ({
                        column: 'tournamentCount',
                        direction: prev.column === 'tournamentCount' && prev.direction === 'asc' ? 'desc' : 'asc',
                      }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#5b6b79', fontSize: isMobile ? 9 : 13, fontWeight: 800, textTransform: 'uppercase', textAlign: 'center' }}
                    >
                      # of Tourn. Submitted Picks
                      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, gap: 1 }}>
                        <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === 'tournamentCount' && commissionerMemberSort.direction === 'asc' ? 1 : 0.3 }}>▲</span>
                        <span style={{ fontSize: isMobile ? 8 : 10, opacity: commissionerMemberSort.column === 'tournamentCount' && commissionerMemberSort.direction === 'desc' ? 1 : 0.3 }}>▼</span>
                      </span>
                    </button>
                  </div>
                  <div style={{ textAlign: 'center', ...(isMobile ? { position: 'sticky', right: 0, background: '#f8fbfd', zIndex: 2 } : {}) }}>Edit</div>
                </div>

                {commissionerBusy && commissionerMembers.length === 0 ? (
                  <div style={{ padding: isMobile ? 14 : 24, color: '#6b7b88', fontSize: isMobile ? 12 : 14 }}>Loading members...</div>
                ) : filteredCommissionerMembers.length === 0 ? (
                  <div style={{ padding: isMobile ? 14 : 24, color: '#6b7b88', fontSize: isMobile ? 12 : 14 }}>No members matched your search.</div>
                ) : (
                  filteredCommissionerMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '140px 190px 100px 46px' : 'minmax(220px, 1.1fr) minmax(260px, 1.25fr) minmax(180px, 0.8fr) 90px',
                        gap: isMobile ? 8 : 16,
                        padding: isMobile ? '10px 12px' : '20px 22px',
                        borderTop: '1px solid #e6edf1',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 800, color: '#0f1720', display: 'flex', alignItems: 'center', gap: 6, ...(isMobile ? { position: 'sticky', left: 0, background: '#fff', zIndex: 1, paddingRight: 4 } : {}) }}>
                        {member.displayName}
                        {(pool?.commissioners ?? []).some((c) => c.id === member.id) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#2d5e94', color: '#fff', borderRadius: 4, width: isMobile ? 16 : 20, height: isMobile ? 16 : 20, fontSize: isMobile ? 10 : 12, fontWeight: 900, flexShrink: 0 }}>C</span>
                        )}
                      </div>
                      <div style={{ fontSize: isMobile ? 11 : 15, color: '#31424f', textAlign: isMobile ? 'left' : 'center' }}>{member.email}</div>
                      <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: '#0f1720', textAlign: 'center' }}>
                        {TOURNAMENTS.filter((event) => (member.rosters[event.id] ?? []).length > 0).length}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', ...(isMobile ? { position: 'sticky', right: 0, background: '#fff', zIndex: 1 } : {}) }}>
                        <button
                          onClick={() => openCommissionerMemberModal(member.id)}
                          style={{
                            border: '1px solid #d7e0e8',
                            borderRadius: isMobile ? 10 : 14,
                            background: '#fff',
                            width: isMobile ? 34 : 48,
                            height: isMobile ? 34 : 48,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={isMobile ? 13 : 18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
            ) : commissionerConsoleView === 'member-picks' ? (
            <section
              style={{
                background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                borderRadius: 24,
                padding: 22,
                boxShadow: '0 18px 40px rgba(9, 34, 51, 0.08)',
                display: 'grid',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const ret = commissionerEditReturnRef.current;
                    commissionerEditReturnRef.current = null;
                    setCommissionerConsoleView(ret ? ret.view : 'members');
                    if (ret) setSubmittedRosterMemberId(ret.memberId);
                    setCommissionerRosterMemberId(null);
                  }}
                  style={{
                    border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: entriesTournamentId === 'open' ? headerSolid : '#fff',
                    color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 28, color: '#0f1720' }}>
                  Pick Sheet for {commissionerRosterMember?.displayName ?? 'Member'}
                </h2>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.45fr) minmax(320px, 0.8fr)',
                  gap: 22,
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: 20, overflow: 'hidden', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                    <div
                      style={{
                        padding: isMobile ? 12 : isLandscapePhone ? '12px 22px 22px' : 22,
                        position: 'relative',
                        background: entriesTournamentId === 'open' ? '#F4BC41' : '#f7f9fb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: isMobile || isLandscapePhone ? 'flex-start' : 'center',
                        flexWrap: 'wrap',
                        borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #d7e0e8',
                      }}
                    >
                      <div style={{ flexBasis: isLandscapePhone ? '100%' : undefined }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18 }}>
                          <div>
                            <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>{entriesTournamentDisplayName}</div>
                            <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#0f1720' }}>Tournament Field</div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginTop: 8,
                            color: entriesTournamentId === 'open' ? '#000000' : '#5b6b79',
                          }}
                        >
                          <span style={{ fontSize: isMobile ? 13 : 16, fontWeight: 500 }}>{entriesTournamentCourseName}</span>
                          <span style={{ fontSize: isMobile ? 12 : 14, fontStyle: 'italic' }}>Par: {entriesTournamentPar}</span>
                        </div>
                      </div>
                      {TOURNAMENT_EVENT_LOGOS[entriesTournamentId] && (
                        <img src={TOURNAMENT_EVENT_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={eventLogoStyle(entriesTournamentId, isMobile, isLandscapePhone)} />
                      )}
                      <label
                        style={{
                          minWidth: isMobile ? 140 : 280,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          border: '1px solid #d7e0e8',
                          borderRadius: 14,
                          background: '#fff',
                          padding: '0 14px',
                        }}
                      >
                        <Search size={18} color="#6b7b88" />
                        <input
                          value={commissionerPlayerSearch}
                          onChange={(event) => setCommissionerPlayerSearch(event.target.value)}
                          placeholder="Search"
                          style={{
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            padding: isMobile ? '10px 0' : '12px 0',
                            fontSize: isMobile ? 16 : 15,
                            background: 'transparent',
                            color: '#0f1720',
                          }}
                        />
                        {commissionerPlayerSearch && (
                          <button
                            onMouseDown={(e) => { e.preventDefault(); setCommissionerPlayerSearch(''); }}
                            style={{ background: '#9ca3af', border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0, touchAction: 'manipulation' }}
                            aria-label="Clear search"
                          >
                            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✕</span>
                          </button>
                        )}
                      </label>
                    </div>

                    <div style={{ maxHeight: isMobile ? 540 : 722, overflowY: 'auto' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px', padding: isMobile ? '8px 12px' : '10px 20px', borderBottom: entriesTournamentId === 'open' ? `1px solid ${headerSolid}` : '1px solid #e6edf1', position: 'sticky', top: 0, background: entriesTournamentId === 'open' ? headerSolid : '#f7f9fb', zIndex: 1 }}>
                        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', textAlign: 'center' }}>OWGR</div>
                        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720', paddingLeft: isMobile ? 8 : 12 }}>Player</div>
                        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720' }}>Salary</div>
                        <div></div>
                      </div>
                      {salaryListMissing && (
                        <div style={{ padding: isMobile ? '20px 16px' : '32px 24px' }}>
                          <div style={{ background: entriesWarningPalette.bg, borderRadius: 14, padding: isMobile ? '16px 16px' : '22px 24px', textAlign: 'left', color: entriesWarningPalette.text, fontSize: isMobile ? 13.5 : 15, fontWeight: 700, lineHeight: 1.6 }}>
                            *Picks cannot be entered until the tournament field has been finalized and world golf rankings/player odds have been updated for the week (usually by late Monday morning, the week of the tournament).
                          </div>
                        </div>
                      )}
                      {filteredCommissionerPlayers.map((player) => {
                        const isDisabled = commissionerRosterSelection.length >= REQUIRED_GOLFERS || player.salary > commissionerSalaryRemaining;

                        return (
                          <div
                            key={`commissioner-player-${player.id}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: isMobile ? '62px 1fr 84px 44px' : '92px 1fr 155px 50px',
                              padding: isMobile ? '11px 12px' : '15px 20px',
                              borderBottom: entriesTournamentId === 'open' ? '1px solid rgba(0,0,0,0.12)' : '1px solid #e6edf1',
                              alignItems: 'center',
                              opacity: isDisabled ? 0.45 : 1,
                              background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                            }}
                          >
                            <div style={{ fontSize: isMobile ? 13 : 17, color: '#0f1720', textAlign: 'center' }}>{player.worldRank}</div>
                            <div onClick={() => openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season')} style={{ fontSize: isMobile ? 13 : 17, fontWeight: 600, color: '#0f1720', paddingLeft: isMobile ? 8 : 12, cursor: 'pointer' }}>
                              {(() => { const customSplit = isMobile ? MOBILE_CUSTOM_SPLITS[player.name] : undefined; const parts = player.name.split(' '); const first = customSplit ? customSplit[0] : parts.slice(0, -1).join(' '); const last = customSplit ? customSplit[1] : parts[parts.length - 1]; const forcedBreak = isMobile && MOBILE_TWO_LINE_NAMES.has(player.name); const infoBtn = <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: player.id, name: player.name, pgaTourId: player.pgaTourId, photoUrl: player.photoUrl, worldRank: player.worldRank }, 'season'); }} style={{ width: isMobile ? 11 : 15, height: isMobile ? 11 : 15, borderRadius: '50%', border: `${isMobile ? 1 : 1.5}px solid ${entriesTournamentId === 'open' ? '#000000' : '#9ca3af'}`, background: 'transparent', color: entriesTournamentId === 'open' ? '#000000' : '#9ca3af', fontSize: isMobile ? 7 : 9, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, touchAction: 'manipulation', verticalAlign: 'middle', marginLeft: isMobile ? 3 : 5, flexShrink: 0 }} aria-label={`View ${player.name} stats`}>i</button>; return (<>{first}{forcedBreak ? <br /> : (first ? ' ' : '')}<span style={{ whiteSpace: 'nowrap' }}>{last}{infoBtn}</span></>); })()}
                            </div>
                            <div style={{ fontSize: isMobile ? 13 : 17, fontWeight: 700, color: '#0f1720' }}>${player.salary.toLocaleString()}</div>
                            <button
                              onClick={() => toggleCommissionerRosterPlayer(player.id)}
                              disabled={isDisabled}
                              style={{
                                width: isMobile ? 34 : 42,
                                height: isMobile ? 34 : 42,
                                borderRadius: 10,
                                border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7dee6',
                                background: entriesTournamentId === 'open' ? headerSolid : '#fff',
                                color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                                fontSize: isMobile ? 20 : 24,
                                fontWeight: 400,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={{ border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8', borderRadius: isMobile ? 18 : 14, padding: isMobile ? 16 : '12px 18px', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff' }}>
                    <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 900, color: '#0f1720' }}>Remaining Salary:</div>
                    <div style={{ marginTop: 2, fontSize: isMobile ? 30 : 34, fontWeight: 900, color: '#1f8d4e' }}>${commissionerSalaryRemaining.toLocaleString()}</div>
                    <div style={{ marginTop: isMobile ? 8 : 4, fontSize: isMobile ? 12 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#31424f' }}>
                      Avg Rem./Player: ${commissionerAverageRemainingPerPlayer.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: isMobile ? 10 : 12 }}>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0f1720' }}>Your Roster</div>

                    <div style={{ fontSize: isMobile ? 12 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#607282', marginTop: -4 }}>
                      Click the plus sign to add a golfer or the minus sign to remove them.
                    </div>

                    {Array.from({ length: REQUIRED_GOLFERS }, (_, index) => {
                      const golfer = commissionerOrderedRosterPlayers[index];
                      return (
                        <div
                          key={`commissioner-roster-slot-${index}`}
                          style={{
                            border: entriesTournamentId === 'open' ? '1px solid #e0a92e' : '1px solid #d7e0e8',
                            borderRadius: isMobile ? 14 : 14,
                            background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff',
                            minHeight: isMobile ? 100 : undefined,
                            height: isMobile ? undefined : 96,
                            display: 'flex',
                            overflow: 'hidden',
                          }}
                        >
                            {golfer ? (
                              <>
                                <div style={{ width: isMobile ? 90 : 88, flexShrink: 0, alignSelf: 'stretch', background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', overflow: 'hidden', position: 'relative' }}>
                                  <img
                                    src={playerPhotoSrc(golfer.name, golfer.pgaTourId, golfer.photoUrl)} data-fb={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)} onError={photoOnError}
                                    alt={golfer.name}
                                    className="roster-card-photo"
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(entriesTournamentId === 'open' ? { mixBlendMode: 'normal' as const } : {}) }}
                                  />
                                </div>
                                <div style={{ flex: 1, padding: isMobile ? '8px 14px' : '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                  <div>
                                    <div onClick={() => openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }, 'season')} style={{ fontSize: isMobile ? 18 : 19, fontWeight: 800, color: '#0f1720', cursor: 'pointer' }}>
                                      {(() => { const customSplit = isMobile ? MOBILE_CUSTOM_SPLITS[golfer.name] : undefined; const parts = golfer.name.split(' '); const first = customSplit ? customSplit[0] : parts.slice(0, -1).join(' '); const last = customSplit ? customSplit[1] : parts[parts.length - 1]; const forcedBreak = isMobile && MOBILE_TWO_LINE_NAMES.has(golfer.name); const infoBtn = <button onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }, 'season'); }} style={{ width: isMobile ? 17 : 17, height: isMobile ? 17 : 17, borderRadius: '50%', border: `${isMobile ? 1.5 : 1.5}px solid ${entriesTournamentId === 'open' ? '#000000' : '#9ca3af'}`, background: 'transparent', color: entriesTournamentId === 'open' ? '#000000' : '#9ca3af', fontSize: isMobile ? 11 : 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, touchAction: 'manipulation', verticalAlign: 'middle', marginLeft: isMobile ? 5 : 6, flexShrink: 0 }} aria-label={`View ${golfer.name} stats`}>i</button>; return (<>{first}{forcedBreak ? <br /> : (first ? ' ' : '')}<span style={{ whiteSpace: 'nowrap' }}>{last}{infoBtn}</span></>); })()}
                                    </div>
                                    <div style={{ marginTop: isMobile ? 3 : 2, fontSize: isMobile ? 15 : 15, color: entriesTournamentId === 'open' ? '#000000' : '#607282' }}>
                                      Salary: <span style={{ fontWeight: 800, color: salaryColor }}>${golfer.salary.toLocaleString()}</span>
                                    </div>
                                    <div style={{ marginTop: isMobile ? 2 : 1, fontSize: isMobile ? 14 : 13, color: entriesTournamentId === 'open' ? '#000000' : '#607282' }}>
                                      World Rank: <span style={{ fontWeight: 700, color: '#0f1720' }}>{golfer.worldRank}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleCommissionerRosterPlayer(golfer.id)}
                                    style={{
                                      width: isMobile ? 34 : 30,
                                      height: isMobile ? 34 : 30,
                                      borderRadius: 8,
                                      border: entriesTournamentId === 'open' ? 'none' : '1px solid #d7dee6',
                                      background: entriesTournamentId === 'open' ? '#dc2626' : '#fff',
                                      color: entriesTournamentId === 'open' ? '#ffffff' : '#0f1720',
                                      fontSize: isMobile ? 20 : 18,
                                      fontWeight: 400,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    −
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div style={{ flex: 1, padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 14 }}>
                                <div style={{ width: isMobile ? 62 : 72, height: isMobile ? 62 : 72, borderRadius: 6, background: entriesTournamentId === 'open' ? '#e8a830' : '#e8eef4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <CircleUserRound size={isMobile ? 32 : 40} color={entriesTournamentId === 'open' ? '#000000' : '#a0b0be'} />
                                </div>
                                <div style={{ fontSize: isMobile ? 16 : 18, color: entriesTournamentId === 'open' ? '#000000' : '#50616f', fontWeight: 600 }}>Golfer #{index + 1}</div>
                              </div>
                            )}
                        </div>
                      );
                    })}

                    <input
                      value={commissionerTieBreakInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setCommissionerTieBreakInput(val);
                      }}
                      placeholder={`Enter tiebreak value* (Par = ${TOURNAMENT_TOTAL_PAR[selectedTournament] ?? '?'})`}
                      inputMode="numeric"
                      maxLength={3}
                      style={{ ...fieldStyle(), marginTop: 4 }}
                    />

                    <button
                      onClick={handleSaveCommissionerRoster}
                      disabled={!canSaveCommissionerRoster || commissionerBusy}
                      style={{
                        marginTop: 4,
                        width: 'fit-content',
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 18px',
                        background: canSaveCommissionerRoster ? entriesTournamentBg : '#f2f4f6',
                        color: canSaveCommissionerRoster ? '#fff' : '#98a3ad',
                        boxShadow: 'none',
                        fontWeight: 900,
                        cursor: !canSaveCommissionerRoster || commissionerBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Submit Roster
                    </button>

                    <div style={{ fontSize: 13, color: entriesTournamentId === 'open' ? '#000000' : '#607282', marginTop: 4 }}>
                      * - The tiebreak value is your predicted total score for the winning golfer of this tournament. Use their total strokes, NOT score to par. Example: Enter {(TOURNAMENT_TOTAL_PAR[entriesTournamentId] ?? 288) - 14} (NOT -14)
                    </div>
                  </div>
                </div>
              </div>
            </section>
            ) : null}
          </main>
        )}

        {commissionerMemberModalOpen && selectedCommissionerMember ? (
          <div
            onClick={() => setCommissionerMemberModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(520px, 100%)',
                background: '#fff',
                borderRadius: 24,
                padding: 24,
                boxShadow: '0 24px 60px rgba(9, 34, 51, 0.2)',
                display: 'grid',
                gap: 18,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#5b6b79' }}>Member options</div>
                  <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900, color: '#0f1720' }}>
                    {selectedCommissionerMember.displayName}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 15, color: '#607282' }}>{selectedCommissionerMember.email}</div>
                </div>
                <button
                  onClick={() => setCommissionerMemberModalOpen(false)}
                  style={{
                    border: '1px solid #d7e0e8',
                    borderRadius: 999,
                    background: '#fff',
                    width: 40,
                    height: 40,
                    fontSize: 20,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>

              {commissionerMemberModalView === 'menu' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <button
                    onClick={() => setCommissionerMemberModalView('displayName')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Display Name
                  </button>
                  {/* A member's sign-in email is theirs; only the app admin can change it here. */}
                  {isAppAdmin ? (
                  <button
                    onClick={() => setCommissionerMemberModalView('email')}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Email
                  </button>
                  ) : null}
                  {(() => {
                    const memberIsCommissioner = (pool?.commissioners ?? []).some((c) => c.id === selectedCommissionerMember.id);
                    return (
                      <button
                        onClick={() => void handleToggleCommissionerRole(selectedCommissionerMember.id, !memberIsCommissioner)}
                        disabled={commissionerBusy}
                        style={{
                          border: '1px solid #d7e0e8',
                          borderRadius: 16,
                          background: '#fff',
                          padding: '16px 18px',
                          textAlign: 'left',
                          fontWeight: 800,
                          cursor: commissionerBusy ? 'wait' : 'pointer',
                        }}
                      >
                        {memberIsCommissioner ? 'Remove Commissioner Role' : 'Make Commissioner'}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => openCommissionerMemberPicks(selectedCommissionerMember.id)}
                    style={{
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#eef8fb',
                      padding: '16px 18px',
                      textAlign: 'left',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Manage or Submit Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmClearPicks')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fcd9a0',
                      borderRadius: 16,
                      background: '#fff8ee',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a06000',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Clear Picks
                  </button>
                  <button
                    onClick={() => setCommissionerMemberModalView('confirmDelete')}
                    disabled={commissionerBusy}
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: 16,
                      background: '#fff5f5',
                      padding: '16px 18px',
                      textAlign: 'left',
                      color: '#a61b1b',
                      fontWeight: 800,
                      cursor: commissionerBusy ? 'wait' : 'pointer',
                    }}
                  >
                    Delete Member
                  </button>
                </div>
              ) : commissionerMemberModalView === 'displayName' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <input
                    value={memberEditForm.displayName}
                    onChange={(event) => setMemberEditForm({ ...memberEditForm, displayName: event.target.value })}
                    placeholder="Display name"
                    style={fieldStyle()}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentBg,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Display Name
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmClearPicks' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to clear picks for <strong>{selectedCommissionerMember?.displayName}</strong>? Their submitted roster will be removed for this tournament.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearCommissionerMemberPicks}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a06000',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Clear
                    </button>
                  </div>
                </div>
              ) : commissionerMemberModalView === 'confirmDelete' ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ fontSize: 15, color: '#0f1720' }}>
                    Are you sure you want to delete <strong>{selectedCommissionerMember?.displayName}</strong>? This cannot be undone.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: '#a61b1b',
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      border: '1px solid #d7e0e8',
                      borderRadius: 16,
                      background: '#fff',
                      padding: '0 14px',
                    }}
                  >
                    <Mail size={18} color="#607282" />
                    <input
                      value={memberEditForm.email}
                      onChange={(event) => setMemberEditForm({ ...memberEditForm, email: event.target.value })}
                      placeholder="Email"
                      style={{ ...fieldStyle(), border: 'none', paddingLeft: 0, paddingRight: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCommissionerMemberModalView('menu')}
                      style={{ border: '1px solid #d7e0e8', borderRadius: 14, background: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommissionerMember}
                      disabled={commissionerBusy}
                      style={{
                        border: 'none',
                        borderRadius: 14,
                        padding: '12px 16px',
                        background: entriesTournamentBg,
                        color: '#fff',
                        fontWeight: 900,
                        cursor: commissionerBusy ? 'wait' : 'pointer',
                      }}
                    >
                      Save Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeStandingEntry ? (
          <div
            onClick={() => {
              setShowPointsSystem(false);
              setActiveStandingGolferId(null);
              setActiveStandingEntryId(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 50,
            }}
          >
            <div
              ref={entryBreakdownRef}
              onClick={(event) => event.stopPropagation()}
              className="breakdown-modal entry-breakdown-modal"
              style={{
                width: 'min(520px, calc(100vw - 32px))',
                maxHeight: 'calc(100vh - 32px - var(--safe-y))',
                background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa',
                borderRadius: 20,
                boxShadow: '0 24px 60px rgba(9,34,51,0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ fontSize: isMobile ? 18 : 21, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{activeStandingEntry.name}</div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                      onClick={() => { setShowPointsSystem(false); setActiveStandingGolferId(null); setActiveStandingEntryId(null); }}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })()}
              <div style={{ padding: isMobile ? '14px 14px 16px' : '16px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {activeStandingEntry.golfers.length > 0 ? (
                  activeStandingGolfers.map((golfer, index) => {
                    const isActiveGolfer = activeStandingGolferId === golfer.id;

                    return (
                    <button
                      key={golfer.id}
                      onClick={() => setActiveStandingGolferId(golfer.id)}
                      style={{
                        width: '100%',
                        border: selectedTournament === 'open' ? '1px solid #000000' : '1px solid #e2e8ef',
                        borderRadius: 12,
                        padding: 0,
                        background: selectedTournament === 'open' ? (isActiveGolfer ? '#e8a830' : '#F4BC41') : isActiveGolfer ? '#eef4ff' : '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        overflow: 'hidden',
                        minHeight: isMobile ? 85 : 100,
                        boxShadow: '0 2px 6px rgba(9,34,51,0.05)',
                      }}
                    >
                      {isMobile ? (
                        <>
                          <div onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }); }} style={{ width: 86, flexShrink: 0, alignSelf: 'stretch', position: 'relative', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', cursor: 'pointer' }}>
                            <img
                              src={playerPhotoSrc(golfer.name, golfer.pgaTourId, golfer.photoUrl)} data-fb={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)} onError={photoOnError}
                              alt={golfer.name}
                              className="breakdown-golfer-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(selectedTournament === 'open' ? { mixBlendMode: 'normal' as const } : {}) }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', background: selectedTournament === 'open' ? '#F4BC41' : 'transparent' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="breakdown-golfer-name" style={{ fontSize: 16, fontWeight: 800, color: selectedTournament === 'open' ? '#1a1a1a' : '#0f1720' }}>
                                <span>{golfer.name}</span>
                              </div>
                              <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span>Salary: ${golfer.salary.toLocaleString()}</span>
                                {!(golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ') && <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>}
                              </div>
                              {golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ' ? (
                                <>
                                  <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: isMobile ? 12 : 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <span>Total: {golfer.originalScore ?? '--'}</span>
                                    <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>
                                  </div>
                                  <button
                                    className="breakdown-golfer-subtext"
                                    onClick={(e) => { e.stopPropagation(); setCutScorecardGolfer({ name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl }); setCutScorecardData(null); setCutScorecardLoading(true); fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=2`).then(r => r.json()).then(setCutScorecardData).catch(() => setCutScorecardData(null)).finally(() => setCutScorecardLoading(false)); }}
                                    style={{ background: '#cc2944', border: '1.5px solid #7b1a13', borderRadius: 999, padding: isMobile ? '3.5px 8.5px' : '1px 6px', cursor: 'pointer', marginTop: 2, fontSize: isMobile ? 9 : 8, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', boxShadow: '0 2px 8px rgba(150,30,30,0.45)', textTransform: 'uppercase' }}
                                  >{golfer.score === 'WD' ? 'WITHDREW' : golfer.score === 'DQ' ? 'DISQUALIFIED' : golfer.score === 'MDF' ? 'MDF' : 'MISSED CUT'}</button>
                                </>
                              ) : (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>Total: {golfer.holesRemaining === 72 ? '—' : golfer.score}</span>
                                  <span>Position: {golfer.holesRemaining === 72 ? '—' : formatPosition(golfer.position)}</span>
                                </div>
                              )}
                              {golfer.score !== 'CUT' && golfer.score !== 'MDF' && golfer.score !== 'WD' && golfer.score !== 'DQ' && (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setScorecardGolferName(golfer.name);
                                      setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                      setScorecardGolferTeeTime(golfer.teeTime);
                                      setScorecardGolferThru(golfer.thru);
                                      setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                      setScorecardData(null);
                                      setScorecardLoading(true);
                                      fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=${currentRoundLabel.replace('Round ', '')}`)
                                        .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'open' ? '#1a1a1a' : '#173b63', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none', verticalAlign: 'middle' }}
                                  >
                                    <span style={{ fontWeight: 900, fontSize: isMobile ? 11 : 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#c8860a' }}>{currentRoundLabel}:</span>{' '}<span style={{ color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontWeight: 400 }}>{golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime ? formatTeeTime(golfer.teeTime) : formatCurrentRoundScore(golfer.currentRoundScore ?? undefined, golfer.score)}</span>
                                  </button>
                                  {!(golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime) && <span>Thru: {golfer.thru}{golfer.backNineStart && golfer.thru !== '--' && golfer.thru !== 'F' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: 40, flexShrink: 0 }}>
                              <div className="breakdown-golfer-points" style={{ fontSize: 22, fontWeight: 900, color: golfer.points < 0 ? '#dc2626' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'players' ? '#c8860a' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#173b63' }}>{formatPointValue(golfer.points)}</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div onClick={(e) => { e.stopPropagation(); openPlayerPopup({ id: golfer.id, name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl, worldRank: golfer.worldRank }); }} style={{ width: 76, flexShrink: 0, alignSelf: 'stretch', position: 'relative', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', cursor: 'pointer' }}>
                            <img
                              src={playerPhotoSrc(golfer.name, golfer.pgaTourId, golfer.photoUrl)} data-fb={golfer.photoUrl ?? pgaPhoto(golfer.pgaTourId)} onError={photoOnError}
                              alt={golfer.name}
                              className="breakdown-golfer-photo"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...(selectedTournament === 'open' ? { mixBlendMode: 'normal' as const } : {}) }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', background: selectedTournament === 'open' ? '#F4BC41' : 'transparent' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="breakdown-golfer-name" style={{ fontSize: 14, fontWeight: 800, color: selectedTournament === 'open' ? '#1a1a1a' : '#0f1720' }}>
                                <span>{golfer.name}</span>
                              </div>
                              <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span>Salary: ${golfer.salary.toLocaleString()}</span>
                                {!(golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ') && <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>}
                              </div>
                              {golfer.score === 'CUT' || golfer.score === 'MDF' || golfer.score === 'WD' || golfer.score === 'DQ' ? (
                                <>
                                  <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: isMobile ? 12 : 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <span>Total: {golfer.originalScore ?? '--'}</span>
                                    <span>Picked: {standings.reduce((sum, entry) => sum + entry.golfers.filter((g) => g.id === golfer.id).length, 0)}</span>
                                  </div>
                                  <button
                                    className="breakdown-golfer-subtext"
                                    onClick={(e) => { e.stopPropagation(); setCutScorecardGolfer({ name: golfer.name, pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl }); setCutScorecardData(null); setCutScorecardLoading(true); fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=2`).then(r => r.json()).then(setCutScorecardData).catch(() => setCutScorecardData(null)).finally(() => setCutScorecardLoading(false)); }}
                                    style={{ background: '#cc2944', border: '1.5px solid #7b1a13', borderRadius: 999, padding: isMobile ? '3.5px 8.5px' : '1px 6px', cursor: 'pointer', marginTop: 2, fontSize: isMobile ? 9 : 8, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', boxShadow: '0 2px 8px rgba(150,30,30,0.45)', textTransform: 'uppercase' }}
                                  >{golfer.score === 'WD' ? 'WITHDREW' : golfer.score === 'DQ' ? 'DISQUALIFIED' : golfer.score === 'MDF' ? 'MDF' : 'MISSED CUT'}</button>
                                </>
                              ) : (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#6b7b88', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                  <span>Total: {golfer.holesRemaining === 72 ? '—' : golfer.score}</span>
                                  <span>Position: {golfer.holesRemaining === 72 ? '—' : formatPosition(golfer.position)}</span>
                                </div>
                              )}
                              {golfer.score !== 'CUT' && golfer.score !== 'MDF' && golfer.score !== 'WD' && golfer.score !== 'DQ' && (
                                <div className="breakdown-golfer-subtext" style={{ marginTop: 2, color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontSize: 11, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setScorecardGolferName(golfer.name);
                                      setScorecardGolferPhoto({ pgaTourId: golfer.pgaTourId, photoUrl: golfer.photoUrl });
                                      setScorecardGolferTeeTime(golfer.teeTime);
                                      setScorecardGolferThru(golfer.thru);
                                      setScorecardGolferBackNineStart(golfer.backNineStart ?? false);
                                      setScorecardData(null);
                                      setScorecardLoading(true);
                                      fetch(`/api/scorecard?tournamentId=${tournament.id}&playerName=${encodeURIComponent(golfer.name)}&round=${currentRoundLabel.replace('Round ', '')}`)
                                        .then(r => r.json()).then(setScorecardData).catch(() => setScorecardData(null)).finally(() => setScorecardLoading(false));
                                    }}
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'open' ? '#1a1a1a' : '#173b63', fontWeight: 700, fontSize: 'inherit', textDecoration: 'none', verticalAlign: 'middle' }}
                                  >
                                    <span style={{ fontWeight: 900, fontSize: isMobile ? 11 : 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#c8860a' }}>{currentRoundLabel}:</span>{' '}<span style={{ color: selectedTournament === 'open' ? '#1a1a1a' : '#50616f', fontWeight: 400 }}>{golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime ? formatTeeTime(golfer.teeTime) : formatCurrentRoundScore(golfer.currentRoundScore ?? undefined, golfer.score)}</span>
                                  </button>
                                  {!(golfer.thru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS' && golfer.teeTime) && <span>Thru: {golfer.thru}{golfer.backNineStart && golfer.thru !== '--' && golfer.thru !== 'F' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', minWidth: 40, flexShrink: 0 }}>
                              <div className="breakdown-golfer-points" style={{ fontSize: 18, fontWeight: 900, color: golfer.points < 0 ? '#dc2626' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'players' ? '#c8860a' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#173b63' }}>{formatPointValue(golfer.points)}</div>
                            </div>
                          </div>
                        </>
                      )}
                    </button>
                  )})
                ) : (
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid #e2e8ef',
                      background: '#fff',
                      padding: 18,
                      color: '#50616f',
                      boxShadow: '0 2px 6px rgba(9,34,51,0.05)',
                    }}
                  >
                    No lineup has been saved for this team yet.
                  </div>
                )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 12, border: selectedTournament === 'open' ? '1px solid #000000' : '1px solid #e2e8ef', padding: isMobile ? '12px 14px' : '12px 16px', boxShadow: '0 2px 6px rgba(9,34,51,0.05)' }}>
                <div style={{ color: selectedTournament === 'masters' ? '#2e7d32' : '#173b63', fontSize: 14, fontWeight: 600 }}>
                  Total Holes Rem: <strong style={{ color: '#000' }}>{activeStandingEntry.holesRemaining}</strong>
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#0f1720' }}>
                  <span style={{ color: selectedTournament === 'masters' ? '#2e7d32' : '#173b63' }}>Total:</span> <span style={{ color: '#000' }}>{formatPointValue(activeStandingEntry.rosterPoints)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        {activeStandingGolfer ? (
          <div
            onClick={(e) => {
              const rect = entryBreakdownRef.current?.getBoundingClientRect();
              setShowPointsSystem(false);
              if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                setActiveStandingGolferId(null);
              } else {
                setActiveStandingGolferId(null);
                setActiveStandingEntryId(null);
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 32, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="breakdown-modal scoring-breakdown-modal"
              style={{
                width: 'min(480px, 100%)',
                maxHeight: 'calc(100vh - 40px - var(--safe-y))',
                background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa',
                borderRadius: 20,
                boxShadow: '0 24px 60px rgba(9,34,51,0.35)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Colored header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={activeStandingGolfer.name} flagSrc={getPlayerFlag(activeStandingGolfer.name) ? getFlagSrc(activeStandingGolfer.name) : null} abbr={getCountryLabel(activeStandingGolfer.name) || null} base={fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).stacked} />{getPlayerFlag(activeStandingGolfer.name) && <>{(PGA_CLUB_PROFESSIONALS.has(activeStandingGolfer.name) || clubProKeys.has(canonicalNameKey(activeStandingGolfer.name))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: selectedTournament !== 'open' ? 'center' : undefined }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(activeStandingGolfer.name, getCountryLabel(activeStandingGolfer.name), 480, isMobile ? 36 : 44, selectedTournament, isMobile).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                      onClick={() => { setShowPointsSystem(false); setActiveStandingGolferId(null); }}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, alignSelf: selectedTournament !== 'open' ? 'center' : undefined }}
                    >✕</button>
                  </div>
                );
              })()}

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Pars', activeStandingGolfer.scoreBreakdown.statLine.par, activeStandingGolfer.scoreBreakdown.statLine.par * SCORING_RULES.par],
                  ['Birdies', activeStandingGolfer.scoreBreakdown.statLine.birdie, activeStandingGolfer.scoreBreakdown.statLine.birdie * SCORING_RULES.birdie],
                  ['Eagles', activeStandingGolfer.scoreBreakdown.statLine.eagle, activeStandingGolfer.scoreBreakdown.statLine.eagle * SCORING_RULES.eagle],
                  ['Albatrosses', activeStandingGolfer.scoreBreakdown.statLine.albatross, activeStandingGolfer.scoreBreakdown.statLine.albatross * SCORING_RULES.albatross],
                  ['Aces', activeStandingGolfer.scoreBreakdown.statLine.holeInOne, activeStandingGolfer.scoreBreakdown.statLine.holeInOne * SCORING_RULES.holeInOne],
                  ['Bogeys', activeStandingGolfer.scoreBreakdown.statLine.bogey, activeStandingGolfer.scoreBreakdown.statLine.bogey * SCORING_RULES.bogey],
                  ['Double Bogeys', activeStandingGolfer.scoreBreakdown.statLine.doubleBogey, activeStandingGolfer.scoreBreakdown.statLine.doubleBogey * SCORING_RULES.doubleBogey],
                  ['Triple Bogey+', activeStandingGolfer.scoreBreakdown.statLine.tripleOrWorse, activeStandingGolfer.scoreBreakdown.statLine.tripleOrWorse * SCORING_RULES.tripleOrWorse],
                  ['3 Birdie Streaks', activeStandingGolfer.scoreBreakdown.statLine.threeBirdieStreaks, activeStandingGolfer.scoreBreakdown.statLine.threeBirdieStreaks * SCORING_RULES.threeBirdieStreak],
                  ['No Bogey Rnds', activeStandingGolfer.scoreBreakdown.statLine.bogeyFreeRounds, activeStandingGolfer.scoreBreakdown.statLine.bogeyFreeRounds * SCORING_RULES.bogeyFreeRound],
                  ['Tourn Low Rnd', activeStandingGolfer.scoreBreakdown.statLine.lowRounds, activeStandingGolfer.scoreBreakdown.statLine.lowRounds * SCORING_RULES.tourneyLowRound],
                  ['Rnd 1 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.first ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.first ? SCORING_RULES.firstRoundLeader : 0],
                  ['Rnd 2 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.second ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.second ? SCORING_RULES.secondRoundLeader : 0],
                  ['Rnd 3 Leader', activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.third ? 1 : 0, activeStandingGolfer.scoreBreakdown.roundLeadersAwarded.third ? SCORING_RULES.thirdRoundLeader : 0],
                ]
                  .filter(([, count]) => Number(count) > 0)
                  .concat([
                    ['Leaderboard Place', activeStandingGolfer.position, activeStandingGolfer.scoreBreakdown.madeCut === false ? activeStandingGolfer.scoreBreakdown.cutPenaltyPoints : activeStandingGolfer.scoreBreakdown.placementPoints] as const,
                    ['Total', '', activeStandingGolfer.points] as const,
                  ])
                  .map(([label, count, points]) => (
                  <div
                    key={String(label)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1.3fr) minmax(100px, 0.7fr) minmax(80px, 0.7fr)',
                      gap: 8,
                      alignItems: 'center',
                      border: selectedTournament === 'open' ? '1px solid #000000' : selectedTournament === 'players' ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e6edf1',
                      borderRadius: 10,
                      padding: '8px 12px',
                      background: String(label) === 'Total' ? (selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63') : selectedTournament === 'open' && !showFutureTournamentView ? '#F4BC41' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: String(label) === 'Total' ? '#ffffff' : '#0f1720' }}>{label}</div>
                    <div style={{ color: selectedTournament === 'open' ? '#000000' : (selectedTournament === 'players') ? '#4a5568' : '#6b7b88', fontSize: 12 }}>
                      {label === 'Leaderboard Place'
                        ? `Position: ${ordinal(String(count))}`
                        : ['Tourn Low Rnd', 'Rnd 1 Leader', 'Rnd 2 Leader', 'Rnd 3 Leader', 'Total'].includes(String(label))
                        ? ''
                        : `Count: ${String(count)}`}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: String(label) === 'Total' ? '#ffffff' : Number(points) < 0 ? '#cc2944' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'players' ? '#c8860a' : (selectedTournament === 'us-open' || selectedTournament === 'open' || selectedTournament === 'pga') ? '#1e4d8c' : '#173b63' }}>
                      {formatPointValue(Number(points))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {showPointsSystem ? (
          <div
            onClick={(e) => {
              const rect = entryBreakdownRef.current?.getBoundingClientRect();
              if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                setShowPointsSystem(false);
              } else {
                setShowPointsSystem(false);
                setActiveStandingGolferId(null);
                setActiveStandingEntryId(null);
              }
            }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 95 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(500px, 100%)', maxHeight: 'calc(100vh - 40px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                const posColor = selectedTournament === 'masters' ? '#2c6449' : '#173b63';
                const isGoldTheme = selectedTournament === 'open';
                const sectionHeaderBg = selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'masters' ? '#2c6449' : (selectedTournament === 'pga' || selectedTournament === 'us-open' || selectedTournament === 'open') ? '#173b63' : '#f0f4f8';
                const sectionHeaderColor = sectionHeaderBg === '#f0f4f8' ? '#607282' : '#fff';
                const group = (title: string, items: Array<[string, string, boolean?]>) => (
                  <div style={{ background: isGoldTheme ? '#F4BC41' : '#fff', borderRadius: 10, border: '1.5px solid #000000', overflow: 'hidden', marginBottom: 7 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: sectionHeaderColor, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 10px 4px', background: sectionHeaderBg }}>{title}</div>
                    {items.map(([label, pts, neg], i) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', borderBottom: i < items.length - 1 ? (isGoldTheme ? '1px solid rgba(0,0,0,0.08)' : '1px solid #f0f3f6') : 'none' }}>
                        <span style={{ fontWeight: 600, fontSize: isMobile ? 11 : 12, color: '#000000' }}>{label}</span>
                        <span style={{ fontWeight: 800, fontSize: isMobile ? 12 : 13, color: neg ? '#cc2944' : posColor }}>{pts}</span>
                      </div>
                    ))}
                  </div>
                );
                return (
                  <>
                    <div style={{ background: hBg, padding: isMobile ? '14px 16px 12px' : '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Points System</div>
                      {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                        <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                        </div>
                      )}
                      <button onClick={() => setShowPointsSystem(false)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '10px 12px 16px' : '12px 16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isMobile ? 6 : 10, alignItems: 'start' }}>
                        <div>
                          {group('Strokes', [['Triple+', '−5 pts', true], ['Double', '−3 pts', true], ['Bogey', '−1 pts', true], ['Par', '+.5 pts'], ['Birdie', '+3 pts'], ['Eagle', '+8 pts'], ['Hole in One', '+10 pts'], ['Albatross', '+13 pts']])}
                          {group('Bonuses', [['3 Birdie Streak', '+4 pts'], ['No Bogey Rnd', '+5 pts'], ['Tourn Low Rnd', '+6 pts']])}
                          {group('Round Leaders', [['Rnd 1 Leader', '+5 pts'], ['Rnd 2 Leader', '+5 pts'], ['Rnd 3 Leader', '+5 pts']])}
                        </div>
                        <div>
                          {group('Finishing Position', [['🥇 1st Place', '+40 pts'], ['🥈 2nd Place', '+25 pts'], ['🥉 3rd Place', '+20 pts'], ['4th Place', '+18 pts'], ['5th Place', '+16 pts'], ['6th Place', '+14 pts'], ['7th Place', '+12 pts'], ['8th Place', '+10 pts'], ['9th Place', '+9 pts'], ['10th Place', '+8 pts'], ['11–15th', '+7 pts'], ['16–20th', '+6 pts'], ['21–25th', '+5 pts'], ['26–30th', '+3 pts'], ['31–40th', '+1 pt'], ['Missed Cut', '−10 pts', true]])}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}

        {/* Scorecard popup */}
        {scorecardGolferName ? (
          <div
            onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); setShowPreviousRounds(false); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 80 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored tournament header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                const roundColor = selectedTournament === 'masters' ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#0f1720' : selectedTournament === 'open' ? '#F4BC41' : '#173b63';
                const teeTimeColor = (selectedTournament === 'us-open' || selectedTournament === 'open') ? '#fff' : '#0f1720';
                return (
                  <div style={{ background: hBg, display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
                    {/* Name + round/score + close */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: isMobile ? '10px 14px' : '12px 18px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: !scorecardGolferName ? 19 : fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1, display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={scorecardGolferName ?? ''} flagSrc={scorecardGolferName && getPlayerFlag(scorecardGolferName) ? getFlagSrc(scorecardGolferName) : null} abbr={scorecardGolferName ? (getCountryLabel(scorecardGolferName) || null) : null} base={!scorecardGolferName ? 19 : fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).fontSize} min={isMobile ? 13 : 15} allowStack={false} initialStacked={false} />{scorecardGolferName && getPlayerFlag(scorecardGolferName) && <></>}</div>
                        {(() => {
                          const playerNotStarted = scorecardGolferThru === '--' && selectedTournamentStatus?.label === 'IN PROGRESS';
                          const prevRoundsBtn = (hasPrev: boolean) => hasPrev ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowPreviousRounds(true); }}
                              style={{ background: selectedTournament === 'masters' ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', border: selectedTournament === 'masters' ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', borderRadius: 999, padding: isMobile ? '2.5px 7.5px' : '3px 8px', cursor: 'pointer', color: selectedTournament === 'masters' ? '#2c6449' : '#fff', fontWeight: 800, fontSize: isMobile ? 8 : 9, letterSpacing: '0.06em', boxShadow: selectedTournament === 'masters' ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)', textTransform: 'uppercase' }}
                            >
                              Previous Rounds
                            </button>
                          ) : null;
                          if (playerNotStarted && scorecardGolferTeeTime) {
                            const roundNum = parseInt(currentRoundLabel.replace('Round ', '')) || 1;
                            const hasPrev = scorecardData?.rounds.some(r => r.round < roundNum && r.holes.length > 0) ?? false;
                            return (
                              <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                Round {roundNum}
                                <span style={{ fontWeight: 400, color: teeTimeColor, fontSize: isMobile ? 10 : 11 }}>{formatTeeTime(scorecardGolferTeeTime)}</span>
                                {prevRoundsBtn(hasPrev)}
                              </div>
                            );
                          }
                          if (scorecardData && scorecardData.rounds.length > 0) {
                            const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                            const hasPrev = scorecardData.rounds.some(r => r.round < rnd.round && r.holes.length > 0);
                            if (!rnd) return null;
                            if (rnd.score != null && rnd.score !== '') {
                              return (
                                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  Round {rnd.round}
                                  <span style={{ fontWeight: 600, color: '#fff', fontSize: isMobile ? 10 : 11 }}>Score: {rnd.score}{scorecardGolferBackNineStart && scorecardGolferThru !== '--' ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>
                                  {prevRoundsBtn(hasPrev)}
                                  {scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', marginTop: -8, marginBottom: -8, flexShrink: 0 }} />}
                                </div>
                              );
                            }
                            if (hasPrev) {
                              return (
                                <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: roundColor, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                  Round {rnd.round}
                                  {prevRoundsBtn(true)}
                                  {scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', marginTop: -8, marginBottom: -8, flexShrink: 0 }} />}
                                </div>
                              );
                            }
                            return null;
                          }
                          return null;
                        })()}
                      </div>
                      {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 28 : 36, selectedTournament, isMobile, true, 32).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                        onClick={() => { setScorecardGolferName(null); setScorecardData(null); setScorecardGolferTeeTime(null); setScorecardGolferThru(null); setScorecardGolferBackNineStart(false); setShowPreviousRounds(false); }}
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                      >✕</button>
                    </div>
                  </div>
                );
              })()}

              {/* Scorecard body */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '12px 12px 16px' : '16px 20px 20px', overflowX: 'auto' }}>
              {scorecardLoading ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Loading scorecard…</div>
              ) : !scorecardData || scorecardData.rounds.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>
                  Scorecard data is not yet available for this round.
                </div>
              ) : (() => {
                // Show only the current (latest) round that has hole data
                const rnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                const front = rnd.holes.filter(h => h.hole <= 9);
                const back  = rnd.holes.filter(h => h.hole >= 10);
                const frontPar    = front.reduce((s, h) => s + (h.par || 0), 0);
                const backPar     = back.reduce((s,  h) => s + (h.par || 0), 0);
                const allScoresNull = rnd.holes.every(h => h.score == null);
                const frontScore  = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                const backScore   = allScoresNull ? 0 : back.reduce((s,  h) => s + (h.score ?? 0), 0);
                const totalScore  = frontScore + backScore;

                const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';

                const isGoldTab = selectedTournament === 'open';
                const baseCell: React.CSSProperties = {
                  border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap',
                  ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }),
                };
                const labelCell: React.CSSProperties = {
                  ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase',
                  background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151',
                };
                const isMastersTournament = selectedTournament === 'masters';
                const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                const subtotalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder,
                };
                const holeHeaderCell: React.CSSProperties = {
                  ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12,
                };
                const subtotalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder,
                };
                const totalHeaderCell: React.CSSProperties = {
                  ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder,
                };

                const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;

                // Standard golf scorecard notation applied to each hole score
                const badge = (score: number, par: number): React.CSSProperties => {
                  const base: React.CSSProperties = {
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, boxSizing: 'border-box', fontSize: 13,
                  };
                  if (!score || !par) return base;
                  const diff = score - par;
                  const r = '#dc2626'; // red — under par
                  const k = '#0f1720'; // dark — over par
                  const g = isGoldTab ? '#F4BC41' : '#fff';    // gap between rings
                  // hole-in-one or eagle → 2 circles (checked before albatross so HIO on par-4 = 2 circles)
                  if (score === 1 || diff === -2)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                  // albatross → 3 circles
                  if (diff <= -3)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                  // birdie → 1 circle
                  if (diff === -1)
                    return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                  // bogey → 1 square
                  if (diff === 1)
                    return { ...base, border: `2px solid ${k}` };
                  // double bogey → 2 squares
                  if (diff === 2)
                    return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                  // triple bogey or worse → 3 squares (slightly tighter rings so they fit within the cell)
                  if (diff >= 3)
                    return { ...base, border: `1.5px solid ${k}`, boxShadow: `0 0 0 1.5px ${g},0 0 0 3px ${k},0 0 0 4.5px ${g},0 0 0 6px ${k}` };
                  return base; // par — no decoration
                };

                return (
                  <div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                        <thead>
                          <tr>
                            <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                            {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                            <th style={subtotalHeaderCell}>Front</th>
                            {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                            <th style={subtotalHeaderCell}>Back</th>
                            <th style={totalHeaderCell}>TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={labelCell}>Par</td>
                            {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                            <td style={subtotalCell}>{frontPar || '--'}</td>
                            {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                            <td style={subtotalCell}>{backPar || '--'}</td>
                            <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                          </tr>
                          <tr>
                            <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                            {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                            <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                            {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                            <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                            <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {rnd.holes.length === 0 && (
                      <div style={{ color: '#607282', fontSize: 14, marginTop: 12 }}>
                        Round {rnd.round} score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score ?? '--'}
                      </div>
                    )}
                  </div>
                );
              })()}
              </div>
              </div>
            </div>
          </div>
        ) : null}

        {showPreviousRounds && scorecardData && scorecardGolferName && (
          <div
            onClick={() => setShowPreviousRounds(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={scorecardGolferName ?? ''} flagSrc={scorecardGolferName && getPlayerFlag(scorecardGolferName) ? getFlagSrc(scorecardGolferName) : null} abbr={scorecardGolferName ? (getCountryLabel(scorecardGolferName) || null) : null} base={fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).stacked} />{scorecardGolferName && getPlayerFlag(scorecardGolferName) && <>{scorecardGolferName && (PGA_CLUB_PROFESSIONALS.has(scorecardGolferName) || clubProKeys.has(canonicalNameKey(scorecardGolferName))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(scorecardGolferName ?? '', scorecardGolferName ? getCountryLabel(scorecardGolferName) : null, 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                      onClick={() => setShowPreviousRounds(false)}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })()}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '14px 14px 20px' : '16px 20px 24px', overflowX: 'auto' }}>
                {(() => {
                  const currentRnd = [...scorecardData.rounds].reverse().find(r => r.holes.length > 0) ?? scorecardData.rounds[scorecardData.rounds.length - 1];
                  const prevRnds = scorecardData.rounds.filter(r => r.round < currentRnd.round && r.holes.length > 0).sort((a, b) => b.round - a.round);
                  const allRnds = [currentRnd, ...prevRnds];

                  const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                  const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';
                  const isGoldTab = selectedTournament === 'open';
                  const isMastersTournament = selectedTournament === 'masters';
                  const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                  const baseCell: React.CSSProperties = { border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap', ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }) };
                  const labelCell: React.CSSProperties = { ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151' };
                  const subtotalCell: React.CSSProperties = { ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalCell: React.CSSProperties = { ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder };
                  const holeHeaderCell: React.CSSProperties = { ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12 };
                  const subtotalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder };
                  const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;
                  const badge = (score: number, par: number): React.CSSProperties => {
                    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, boxSizing: 'border-box', fontSize: 13 };
                    if (!score || !par) return base;
                    const diff = score - par;
                    const r = '#dc2626'; const k = '#0f1720'; const g = isGoldTab ? '#F4BC41' : '#fff';
                    if (score === 1 || diff === -2) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                    if (diff <= -3) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                    if (diff === -1) return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                    if (diff === 1) return { ...base, border: `2px solid ${k}` };
                    if (diff === 2) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                    if (diff >= 3) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k},0 0 0 6px ${g},0 0 0 8px ${k}` };
                    return base;
                  };

                  return allRnds.map(rnd => {
                    const front = rnd.holes.filter(h => h.hole <= 9);
                    const back = rnd.holes.filter(h => h.hole >= 10);
                    const frontPar = front.reduce((s, h) => s + (h.par || 0), 0);
                    const backPar = back.reduce((s, h) => s + (h.par || 0), 0);
                    const allScoresNull = rnd.holes.every(h => h.score == null);
                    const frontScore = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                    const backScore = allScoresNull ? 0 : back.reduce((s, h) => s + (h.score ?? 0), 0);
                    const totalScore = frontScore + backScore;
                    return (
                      <div key={rnd.round} style={{ marginBottom: 24 }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: isMastersTournament ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#1e4d8c' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', color: isMastersTournament ? '#2c6449' : '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', border: isMastersTournament ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'us-open' ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: isMastersTournament ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(14,45,100,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>Round {rnd.round}</span>
                          {rnd.score != null && rnd.score !== '' && <span style={{ fontWeight: 600, color: '#0f1720', fontSize: 12 }}>Score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score}{rnd.holes[0]?.hole >= 10 ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                            <thead>
                              <tr>
                                <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                                {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Front</th>
                                {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Back</th>
                                <th style={totalHeaderCell}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={labelCell}>Par</td>
                                {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{frontPar || '--'}</td>
                                {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{backPar || '--'}</td>
                                <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                              </tr>
                              <tr>
                                <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                                {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                                {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                                <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              </div>
            </div>
          </div>
        )}

        {cutScorecardGolfer && (
          <div
            onClick={() => { setCutScorecardGolfer(null); setCutScorecardData(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(1140px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              {/* Colored header */}
              {(() => {
                const hBg = selectedTournament === 'pga' ? '#B09963' : selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : '#173b63';
                return (
                  <div style={{ background: hBg, padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}><HeaderNameFlag name={cutScorecardGolfer.name} flagSrc={getPlayerFlag(cutScorecardGolfer.name) ? getFlagSrc(cutScorecardGolfer.name) : null} abbr={getCountryLabel(cutScorecardGolfer.name) || null} base={fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).fontSize} min={isMobile ? 13 : 15} allowStack={true} initialStacked={fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).stacked} />{getPlayerFlag(cutScorecardGolfer.name) && <>{(PGA_CLUB_PROFESSIONALS.has(cutScorecardGolfer.name) || clubProKeys.has(canonicalNameKey(cutScorecardGolfer.name))) && <img src="/pga-seal-gold.png" alt="PGA" style={{ marginLeft: 6, height: 38, verticalAlign: 'middle', display: 'inline-block', objectFit: 'contain' }} />}</>}</div>
                    </div>
                    {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                      <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 38 : 48) : selectedTournament === 'players' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 34 : 42) : selectedTournament === 'open' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 30 : 40) : selectedTournament === 'masters' ? undefined : (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 24 : 30), width: selectedTournament === 'masters' ? (fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96) : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: fitPopupHeader(cutScorecardGolfer.name, getCountryLabel(cutScorecardGolfer.name), 1140, isMobile ? 36 : 44, selectedTournament, isMobile, false, 32).shrinkLogo ? 74 : 96, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                      </div>
                    )}
                    <button
                      onClick={() => { setCutScorecardGolfer(null); setCutScorecardData(null); }}
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                    >✕</button>
                  </div>
                );
              })()}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ padding: isMobile ? '14px 14px 20px' : '16px 20px 24px', overflowX: 'auto' }}>
                {cutScorecardLoading ? (
                  <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Loading scorecard…</div>
                ) : !cutScorecardData || cutScorecardData.rounds.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#607282', padding: '32px 0', fontSize: 15 }}>Scorecard data is not yet available.</div>
                ) : (() => {
                  const rounds = cutScorecardData.rounds.filter(r => r.holes.length > 0 && r.round <= 2 && r.holes.some(h => h.score != null && h.score !== 0 && String(h.label) !== '')).sort((a, b) => b.round - a.round);
                  if (rounds.length === 0) return <div style={{ color: '#607282', fontSize: 14, padding: '16px 0' }}>No scorecard data available.</div>;
                  const border = selectedTournament === 'open' ? '1px solid #000000' : '1px solid #d1d9e0';
                  const thickBorder = selectedTournament === 'open' ? '2px solid #000000' : '2px solid #9ab0c4';
                  const isGoldTab = selectedTournament === 'open';
                  const isMastersTournament = selectedTournament === 'masters';
                  const isRedTotalTournament = selectedTournament === 'us-open' || selectedTournament === 'pga';
                  const baseCell: React.CSSProperties = { border, padding: '6px 4px', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap', ...(isGoldTab ? { background: '#F4BC41' } : { background: '#fff' }) };
                  const labelCell: React.CSSProperties = { ...baseCell, textAlign: 'left', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', background: isGoldTab ? '#F4BC41' : '#fff', paddingLeft: 10, letterSpacing: '0.03em', minWidth: 66, color: '#374151' };
                  const subtotalCell: React.CSSProperties = { ...baseCell, fontWeight: 800, background: isMastersTournament ? '#dcfce7' : '#e8f0f8', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalCell: React.CSSProperties = { ...baseCell, fontWeight: 900, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', color: '#fff', borderLeft: thickBorder };
                  const holeHeaderCell: React.CSSProperties = { ...baseCell, fontWeight: 700, background: '#0f1720', color: '#fff', fontSize: 12 };
                  const subtotalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#2c6449' : '#2f5f96', borderLeft: thickBorder, borderRight: thickBorder };
                  const totalHeaderCell: React.CSSProperties = { ...holeHeaderCell, background: isMastersTournament ? '#1a3d2b' : isRedTotalTournament ? '#1e3a5f' : '#1e3a5f', borderLeft: thickBorder };
                  const fmt = (n: number) => n > 0 ? `+${n}` : n === 0 ? 'E' : `${n}`;
                  const badge = (score: number, par: number): React.CSSProperties => {
                    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, boxSizing: 'border-box', fontSize: 13 };
                    if (!score || !par) return base;
                    const diff = score - par;
                    const r = '#dc2626'; const k = '#0f1720'; const g = isGoldTab ? '#F4BC41' : '#fff';
                    if (score === 1 || diff === -2) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r}` };
                    if (diff <= -3) return { ...base, borderRadius: '50%', border: `2px solid ${r}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${r},0 0 0 6px ${g},0 0 0 8px ${r}` };
                    if (diff === -1) return { ...base, borderRadius: '50%', border: `2px solid ${r}` };
                    if (diff === 1) return { ...base, border: `2px solid ${k}` };
                    if (diff === 2) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k}` };
                    if (diff >= 3) return { ...base, border: `2px solid ${k}`, boxShadow: `0 0 0 2px ${g},0 0 0 4px ${k},0 0 0 6px ${g},0 0 0 8px ${k}` };
                    return base;
                  };
                  return rounds.map(rnd => {
                    const front = rnd.holes.filter(h => h.hole <= 9);
                    const back = rnd.holes.filter(h => h.hole >= 10);
                    const frontPar = front.reduce((s, h) => s + (h.par || 0), 0);
                    const backPar = back.reduce((s, h) => s + (h.par || 0), 0);
                    const allScoresNull = rnd.holes.every(h => h.score == null);
                    const frontScore = allScoresNull ? 0 : front.reduce((s, h) => s + (h.score ?? 0), 0);
                    const backScore = allScoresNull ? 0 : back.reduce((s, h) => s + (h.score ?? 0), 0);
                    const totalScore = frontScore + backScore;
                    return (
                      <div key={rnd.round} style={{ marginBottom: 24 }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: isMastersTournament ? '#F3E44D' : selectedTournament === 'players' ? '#E0AB43' : selectedTournament === 'us-open' ? '#1e4d8c' : selectedTournament === 'open' ? '#c0392b' : '#1e3a5f', color: isMastersTournament ? '#2c6449' : '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', border: isMastersTournament ? '1.5px solid #c8b800' : selectedTournament === 'players' ? '1.5px solid #a07010' : selectedTournament === 'us-open' ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : '1.5px solid #0f2448', boxShadow: isMastersTournament ? '0 2px 8px rgba(180,150,0,0.45)' : selectedTournament === 'players' ? '0 2px 8px rgba(180,140,0,0.4)' : selectedTournament === 'us-open' ? '0 2px 8px rgba(14,45,100,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : '0 2px 8px rgba(14,45,100,0.4)' }}>Round {rnd.round}</span>
                          {rnd.score != null && rnd.score !== '' && <span style={{ fontWeight: 600, color: '#0f1720', fontSize: 12 }}>Score: {typeof rnd.score === 'number' ? fmt(rnd.score) : rnd.score}{rnd.holes[0]?.hole >= 10 ? <sup style={{ fontSize: '0.9em', verticalAlign: '0.1em' }}>*</sup> : null}</span>}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
                            <thead>
                              <tr>
                                <th style={{ ...labelCell, background: '#0f1720', color: '#fff' }}>HOLE</th>
                                {front.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Front</th>
                                {back.map(h => <th key={h.hole} style={holeHeaderCell}>{h.hole}</th>)}
                                <th style={subtotalHeaderCell}>Back</th>
                                <th style={totalHeaderCell}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={labelCell}>Par</td>
                                {front.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{frontPar || '--'}</td>
                                {back.map(h => <td key={h.hole} style={baseCell}>{h.par || '--'}</td>)}
                                <td style={subtotalCell}>{backPar || '--'}</td>
                                <td style={totalCell}>{(frontPar + backPar) || '--'}</td>
                              </tr>
                              <tr>
                                <td style={{ ...labelCell, background: isGoldTab ? '#F4BC41' : '#fff' }}>Score</td>
                                {front.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && frontScore > 0 ? frontScore : '--'}</td>
                                {back.map(h => <td key={h.hole} style={{ ...baseCell, padding: '7px 7px' }}>{h.score != null ? <span style={badge(h.score, h.par)}>{h.label}</span> : null}</td>)}
                                <td style={subtotalCell}>{!allScoresNull && backScore > 0 ? backScore : '--'}</td>
                                <td style={totalCell}>{!allScoresNull && totalScore > 0 ? totalScore : '--'}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              </div>
            </div>
          </div>
        )}

        {reportsMenuOpen && reportsMenuRect && (() => {
          const menuW = 244;
          const vw = typeof window !== 'undefined' ? window.innerWidth : 9999;
          const left = Math.max(8, Math.min(reportsMenuRect.left, vw - menuW - 8));
          const accent = REPORT_TOURNAMENT_SOLID[selectedTournament];
          const hexToRgba = (hex: string, a: number) => {
            const h = hex.replace('#', '');
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${a})`;
          };
          const accentSoft = hexToRgba(accent, 0.09);
          const accentHover = hexToRgba(accent, 0.55);
          const reportIcon = (opt: ReportType) => {
            const p = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
            switch (opt) {
              case 'Player Pick Summary':
                return <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
              case 'Pool Member Pick History':
                return <svg {...p}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
              case 'Pool Member Pick Summary':
                return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
              case 'Player Performance Summary':
                return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
              case 'Pool Standings History':
                return <svg {...p}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
              default:
                return null;
            }
          };
          return (
            <>
              <div onClick={() => setReportsMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200 }} />
              <div style={{ position: 'fixed', top: reportsMenuRect.top + 4, left, width: menuW, zIndex: 1201, background: '#fff', border: '1px solid #d1dae3', borderRadius: 12, boxShadow: '0 18px 40px -6px rgba(9,34,51,0.30), 0 4px 10px rgba(9,34,51,0.10)', overflow: 'hidden' }}>
                <div style={{ height: 4, background: accent }} />
                {REPORT_OPTIONS.map((opt, i) => {
                  const isSel = selectedReport === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setSelectedReport(opt); setReportsMenuOpen(false); handleMainTabChange('Reports'); }}
                      onMouseEnter={(e) => { if (!isSel) { e.currentTarget.style.background = accentSoft; e.currentTarget.style.boxShadow = `inset 3px 0 0 ${accentHover}`; } }}
                      onMouseLeave={(e) => { if (!isSel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: isSel ? accentSoft : 'transparent', border: 'none', borderTop: i === 0 ? 'none' : '1px solid #eef2f6', boxShadow: isSel ? `inset 3px 0 0 ${accent}` : 'none', padding: '12px 14px', fontSize: 12.5, fontWeight: 700, color: '#0f1720', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ width: 15, height: 15, flex: '0 0 15px', color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{reportIcon(opt)}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}

        {ppsAllPlayerPopup && (() => {
          const player = ppsAllPlayerPopup;
          const close = () => setPpsAllPlayerPopup(null);
          // Only reveal per-major counts for tournaments that have started/concluded.
          const rows = REPORT_TOURNAMENTS.filter((t) => picksRevealedForYear(t.id, reportYear)).map((t) => ({
            t,
            count: poolEntries.filter((e) => (e.rosters[t.id] ?? []).includes(player.id)).length,
          }));
          const maxC = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
          const total = rows.reduce((s, r) => s + r.count, 0);
          const flagSrc = getPlayerFlag(player.name) ? getFlagSrc(player.name) : null;
          return (
            <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(500px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: '#0f1720', padding: '0 14px 0 18px', height: 72, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>
                      <HeaderNameFlag name={player.name} flagSrc={flagSrc} abbr={getCountryLabel(player.name) || null} base={isMobile ? 15 : 16.5} min={isMobile ? 11.5 : 15} allowStack={true} initialStacked={false} />
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 3 }}>{total} total {total === 1 ? 'pick' : 'picks'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <img src="/golf-majors-pool-logo-v11.png" alt="Golf Majors Pool" style={{ height: 72, width: isMobile ? 122 : 152, objectFit: 'cover', objectPosition: 'center', display: 'block', flexShrink: 0 }} />
                    <button onClick={close} style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ padding: '6px 0', overflowY: 'auto' }}>
                  {rows.map(({ t, count }, i) => {
                    const pct = count > 0 ? Math.max(16, Math.round((count / maxC) * 78)) : 0;
                    return (
                      <div key={t.id} onClick={count > 0 ? () => setPpsPickPopup({ id: player.id, name: player.name, tournament: t.id }) : undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: count > 0 ? 'pointer' : 'default', padding: isMobile ? '11px 14px' : '12px 18px', borderTop: i === 0 ? 'none' : '1px solid #eef2f6' }}>
                        <span style={{ width: isMobile ? 82 : 92, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {TOURNAMENT_TAB_LOGOS[t.id] && <img src={TOURNAMENT_TAB_LOGOS[t.id]} alt={t.label} style={{ height: (t.id === 'players' || t.id === 'pga') ? 38 : t.id === 'masters' ? 30 : 26, maxWidth: isMobile ? 82 : 92, objectFit: 'contain', display: 'block' }} />}
                        </span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{ width: `${pct}%`, minWidth: count > 0 ? (isMobile ? 40 : 46) : 8, height: isMobile ? 22 : 24, borderRadius: 6, background: count > 0 ? REPORT_TOURNAMENT_SOLID[t.id] : '#e2e8f0', flexShrink: 0 }} />
                          <span style={{ flexShrink: 0, fontSize: isMobile ? 13 : 14, fontWeight: 800, color: count > 0 ? '#0f1720' : '#94a3b8', whiteSpace: 'nowrap' }}>{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {ppsPickPopup && (() => {
          const T = ppsPickPopup.tournament;
          const headerColor = REPORT_TOURNAMENT_SOLID[T];
          const logo = KNOCKOUT_TAB_LOGOS[T] ?? TOURNAMENT_TAB_LOGOS[T];
          const entriesPicked = poolEntries
            .filter((e) => (e.rosters[T] ?? []).includes(ppsPickPopup.id))
            .map((e) => e.name)
            .sort((a, b) => a.localeCompare(b));
          const close = () => setPpsPickPopup(null);
          const flagSrc = getPlayerFlag(ppsPickPopup.name) ? getFlagSrc(ppsPickPopup.name) : null;
          return (
            <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: headerColor, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap' }}>
                    <HeaderNameFlag name={ppsPickPopup.name} flagSrc={flagSrc} abbr={getCountryLabel(ppsPickPopup.name) || null} base={isMobile ? 15 : 16} min={isMobile ? 11.5 : 14} allowStack={true} initialStacked={false} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {logo && (
                      <img src={logo} alt="" style={{ height: T === 'pga' ? 52 : T === 'players' ? 46 : T === 'open' ? 36 : T === 'masters' ? undefined : 32, width: T === 'masters' ? 104 : undefined, margin: T === 'pga' ? '-10px 0' : T === 'players' ? '-7px 0' : undefined, maxWidth: 104, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                    )}
                    <button onClick={close} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ padding: '9px 0', overflowY: 'auto' }}>
                  {!picksRevealedForYear(T, reportYear) ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#5b6b79', fontSize: 14, lineHeight: 1.5 }}>Picks are hidden until the tournament begins.</div>
                  ) : (
                    <>
                      <div style={{ padding: '0 18px 8px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                        {entriesPicked.length} {entriesPicked.length === 1 ? 'entry' : 'entries'}
                      </div>
                      {entriesPicked.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#5b6b79', fontSize: 14 }}>No entries picked this player.</div>
                      ) : entriesPicked.map((n, i) => (
                        <div key={i} style={{ padding: '11px 18px', borderTop: '1px solid #eef2f6', fontSize: 14, fontWeight: 600, color: '#0f1720' }}>{n}</div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {historyRoster && historyPopup && (() => {
          const histTournament = historyPopup.tournament;
          const histHeaderSolid = REPORT_TOURNAMENT_SOLID[histTournament];
          const closeRoster = () => setHistoryRoster(null);
          const CUT_SET = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);
          const rosterGolfers = historyRoster.golfers ? [...historyRoster.golfers].sort((a, b) => b.points - a.points) : [];
          const isOpenHist = histTournament === 'open';
          const histGold = '#F4BC41';
          const histDivider = (histTournament === 'players' || histTournament === 'open') ? '1px solid rgba(0,0,0,0.1)' : '1px solid #e2e8ef';
          return (
            <div onClick={closeRoster} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(560px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                <div style={{ background: histHeaderSolid, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: isMobile ? 15 : 16, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{historyRoster.name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {(KNOCKOUT_TAB_LOGOS[histTournament] ?? TOURNAMENT_TAB_LOGOS[histTournament]) && (
                      <img src={KNOCKOUT_TAB_LOGOS[histTournament] ?? TOURNAMENT_TAB_LOGOS[histTournament]} alt="" style={{ height: histTournament === 'pga' ? 52 : histTournament === 'players' ? 46 : histTournament === 'open' ? 36 : histTournament === 'masters' ? undefined : 32, width: histTournament === 'masters' ? 104 : undefined, margin: histTournament === 'pga' ? '-10px 0' : histTournament === 'players' ? '-7px 0' : undefined, maxWidth: 104, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                    )}
                    <button onClick={closeRoster} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', background: isOpenHist ? histGold : undefined }}>
                  {rosterGolfers.length === 0 ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#5b6b79', fontSize: 13.5, lineHeight: 1.5 }}>No roster was saved for this entry.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f3f6f9' }}>
                          <th style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>GOLFER</th>
                          <th style={{ textAlign: 'center', padding: '9px 6px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>SALARY</th>
                          <th style={{ textAlign: 'center', padding: '9px 6px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>POS</th>
                          <th style={{ textAlign: 'center', padding: '9px 8px', fontSize: 11, fontWeight: 700, color: '#5b6b79', letterSpacing: '0.04em' }}>POINTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rosterGolfers.map((g, i) => {
                          const cut = CUT_SET.has(String(g.score).toUpperCase()) || String(g.position).toUpperCase() === 'CUT';
                          const flagSrc = getPlayerFlag(g.name) ? getFlagSrc(g.name) : null;
                          const abbr = getCountryLabel(g.name) || null;
                          return (
                            <tr key={i} style={{ borderTop: histDivider }}>
                              <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: '#0f1720' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
                                  <span style={{ width: 20, marginRight: 5, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                                    {flagSrc && <img src={flagSrc} alt="" style={{ width: 20, height: 13, objectFit: 'cover', borderRadius: 2, border: isOpenHist ? '0.5px solid #000' : '1px solid #d1d9e0' }} />}
                                  </span>
                                  <span style={{ width: 24, flexShrink: 0, fontSize: 10, fontWeight: 700, color: isOpenHist ? '#1e3a5f' : '#94a3b8' }}>{abbr || ''}</span>
                                  <span style={{ marginLeft: 8 }}>{g.name}</span>
                                </span>
                              </td>
                              <td style={{ textAlign: 'center', padding: '9px 6px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: '#374151' }}>{g.salary ? `$${g.salary.toLocaleString()}` : '—'}</td>
                              <td style={{ textAlign: 'center', padding: '9px 6px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: '#374151' }}>{cut ? <span style={{ display: 'inline-block', background: '#dc2626', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>CUT</span> : (g.position || '—')}</td>
                              <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: g.points < 0 ? '#dc2626' : '#0f1720' }}>{g.points % 1 === 0 ? g.points : g.points.toFixed(1)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {showTiebreakerRules && (
          <div
            onClick={() => setShowTiebreakerRules(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, calc(100vw - 32px))', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
              <div style={{ background: headerSolid, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '0.01em' }}>Tiebreaker Rules</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {(KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]) && (
                    <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt="" style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                  )}
                  <button onClick={() => setShowTiebreakerRules(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>&#10005;</button>
                </div>
              </div>
              <div style={{ padding: isMobile ? '16px 18px 20px' : '20px 24px 24px', overflowY: 'auto' }}>
                <div style={{ fontSize: isMobile ? 13 : 14, color: selectedTournament === 'open' ? '#000000' : '#374151', lineHeight: 1.6, marginBottom: 16 }}>
                  Final standings are ranked by <strong>total points</strong>. When two or more entries are tied on points, the tie is broken in the order below — each step is used only if the previous one leaves them still tied.
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {([
                    ['Closest Tiebreaker Prediction', <>Each entry submits a predicted score — the winning golfer&rsquo;s 4-round <strong>total strokes</strong> (not score to par). Whoever&rsquo;s prediction lands <strong>closest to the champion&rsquo;s actual total strokes</strong> wins. Example: if the champion finishes at 274, a guess of 272 (off by 2) beats a guess of 277 (off by 3).</>],
                    ['Picked the Champion', <>If still tied — because the predictions were equally close, or exactly the same — the entry that had the <strong>tournament&rsquo;s winning golfer</strong> on their roster wins. If both entries had the champion, or neither did, move on.</>],
                    ['Fewest Missed Cuts', <>The entry with the <strong>fewest golfers who missed the cut</strong> wins the tiebreak.</>],
                    ['Best Individual Golfers', <>Compare each entry&rsquo;s <strong>highest-scoring golfer</strong> by points. If those are equal, compare the second-highest, then the third-highest, and so on down the roster until one entry&rsquo;s golfer out-points the other&rsquo;s at the same spot.</>],
                  ] as const).map(([title, body], i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: headerSolid, color: '#fff', fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: isMobile ? 13.5 : 14.5, fontWeight: 800, color: '#0f1720', marginBottom: 3 }}>{title}</div>
                        <div style={{ fontSize: isMobile ? 12.5 : 13.5, color: selectedTournament === 'open' ? '#1a1a1a' : '#4b5563', lineHeight: 1.55 }}>{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showBonusPoints && (() => {
          type BonusCat = {
            label: string;
            pts: number;
            showCount: boolean;
            filter: (p: typeof players[number]) => boolean;
            count: (p: typeof players[number]) => number;
          };
          const closeBonusPoints = () => { setShowBonusPoints(false); setExpandedBonusCategories(new Set()); setBonusInfoPopup(null); };
          const pickedPlayers = players.filter((p) => pickedPlayerIds.has(p.id));

          const alwaysOpenCats: BonusCat[] = [
            {
              label: 'Tourn Low Rnd',
              pts: SCORING_RULES.tourneyLowRound,
              showCount: false,
              filter: (p) => (p.scoreBreakdown.statLine.lowRounds ?? 0) > 0,
              count: () => 0,
            },
            {
              label: 'Round 1 Leader',
              pts: SCORING_RULES.firstRoundLeader,
              showCount: false,
              filter: (p) => !!p.scoreBreakdown.roundLeadersAwarded?.first,
              count: () => 0,
            },
            ...((feed?.currentRound ?? 1) >= 2 ? [{
              label: 'Round 2 Leader',
              pts: SCORING_RULES.secondRoundLeader,
              showCount: false,
              filter: (p: typeof players[number]) => !!p.scoreBreakdown.roundLeadersAwarded?.second,
              count: () => 0,
            }] : []),
            ...((feed?.currentRound ?? 1) >= 3 ? [{
              label: 'Round 3 Leader',
              pts: SCORING_RULES.thirdRoundLeader,
              showCount: false,
              filter: (p: typeof players[number]) => !!p.scoreBreakdown.roundLeadersAwarded?.third,
              count: () => 0,
            }] : []),
          ];

          const collapsibleCats: BonusCat[] = [
            {
              label: '3 Birdie Streaks',
              pts: SCORING_RULES.threeBirdieStreak,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.threeBirdieStreaks ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.threeBirdieStreaks ?? 0,
            },
            {
              label: 'No Bogey Rounds',
              pts: SCORING_RULES.bogeyFreeRound,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.bogeyFreeRounds ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.bogeyFreeRounds ?? 0,
            },
            {
              label: 'Eagles',
              pts: SCORING_RULES.eagle,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.eagle ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.eagle ?? 0,
            },
            {
              label: 'Hole in One',
              pts: SCORING_RULES.holeInOne,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.holeInOne ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.holeInOne ?? 0,
            },
            {
              label: 'Albatross',
              pts: SCORING_RULES.albatross,
              showCount: true,
              filter: (p) => (p.scoreBreakdown.statLine.albatross ?? 0) > 0,
              count: (p) => p.scoreBreakdown.statLine.albatross ?? 0,
            },
          ];

          // Small flag + country code left of a player name — same style as the stat
          // leaderboard popup rows (14x20 bordered flag, 9px code).
          const bonusFlag = (name: string) => (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6, width: 50, flexShrink: 0, verticalAlign: 'middle' }}>
              {getFlagSrc(name) ? <>
                <img src={getFlagSrc(name)} alt="" style={{ height: 14, width: 20, objectFit: 'cover', borderRadius: 2, border: selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #d1d9e0', flexShrink: 0, display: 'block' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: selectedTournament === 'open' ? '#173b63' : '#9ca3af', letterSpacing: '0.05em', width: 22, display: 'inline-block' }}>{getCountryLabel(name)}</span>
              </> : null}
            </span>
          );
          const renderPlayerList = (cat: BonusCat) => {
            const earners = pickedPlayers.filter(cat.filter).sort((a, b) => cat.count(b) - cat.count(a));
            if (earners.length === 0) return <div style={{ fontSize: 12, color: selectedTournament === 'open' ? '#000000' : '#607282', fontStyle: 'italic', padding: '2px 0 4px' }}>None selected in pool apply</div>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 4 }}>
                {earners.map((p) => (
                  <div key={p.id} style={{ fontSize: 13, color: selectedTournament === 'open' ? '#000000' : '#2a3d50', fontWeight: 600 }}>
                    {bonusFlag(p.name)}{p.name}{cat.showCount ? <span style={{ color: selectedTournament === 'open' ? '#173b63' : '#607282', fontWeight: 500 }}> ({cat.count(p)})</span> : null}
                  </div>
                ))}
              </div>
            );
          };

          const lowRawScore = feed?.tournamentLowRoundScore ?? null;
          // Discard implausible values (e.g. partial-round data stored during a suspension bug)
          const validLowRawScore = lowRawScore !== null && lowRawScore >= 58 ? lowRawScore : null;
          const coursePar = feed?.coursePar ?? 72;
          const lowToPar = validLowRawScore !== null ? validLowRawScore - coursePar : null;
          const lowToParLabel = lowToPar === null ? '' : lowToPar === 0 ? ' (E)' : lowToPar < 0 ? ` (${lowToPar})` : ` (+${lowToPar})`;
          // Full-field bonus achievements not covered by pool picks — shown via info icons
          // that open a popup listing full names with the round(s), e.g. "Jackson Suber (R1)".
          const pickedBonusKeys = new Set(pickedPlayers.map((p) => canonicalNameKey(applyNameAlias(p.name))));
          const fieldBonus = feed?.fieldBonusEvents ?? {};
          const unpickedBonusFor = (key: string) => (fieldBonus[key] ?? []).filter((e) => !pickedBonusKeys.has(canonicalNameKey(applyNameAlias(e.name)))).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
          const BONUS_FIELD_KEYS: Record<string, string> = { 'Tourn Low Rnd': 'lowRound', 'Round 1 Leader': 'round1Leader', 'Round 2 Leader': 'round2Leader', 'Round 3 Leader': 'round3Leader', '3 Birdie Streaks': 'threeBirdieStreaks', 'No Bogey Rounds': 'bogeyFreeRounds', 'Eagles': 'eagles', 'Hole in One': 'holeInOne', 'Albatross': 'albatross' };
          const bpColor = selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : selectedTournament === 'open' ? '#c0392b' : '#1e4d8c';
          const catHeaderColor = selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#1e4d8c' : '#173b63';
          const bpHeaderBg = selectedTournament === 'masters' ? '#2c6449' : selectedTournament === 'us-open' ? '#BE3436' : selectedTournament === 'pga' ? '#B09963' : '#173b63';

          return (
            <div
              onClick={closeBonusPoints}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 90 }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ width: 'min(520px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', overflowY: 'auto', background: selectedTournament === 'open' ? '#F4BC41' : '#f4f7fa', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)' }}
              >
                {/* Solid color header */}
                <div style={{ background: bpHeaderBg, borderRadius: '20px 20px 0 0', padding: isMobile ? '16px 18px 14px' : '18px 22px 16px', position: 'sticky', top: 0, zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: isMobile ? 18 : 21, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Bonus Points</div>
                    <button onClick={() => setShowPointsSystem(true)} style={{ marginTop: 6, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.6)', borderRadius: 7, cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 9px', lineHeight: 1, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      Points System <span style={{ fontSize: 10, opacity: 0.8 }}>›</span>
                    </button>
                  </div>
                  {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                    <div style={{ flexShrink: 0, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt={tournament.fullName} style={{ height: selectedTournament === 'pga' ? 60 : selectedTournament === 'players' ? 52 : selectedTournament === 'open' ? 40 : selectedTournament === 'masters' ? undefined : 36, width: selectedTournament === 'masters' ? 120 : undefined, margin: selectedTournament === 'pga' ? '-12px 0' : selectedTournament === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                    </div>
                  )}
                  <button onClick={closeBonusPoints} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, marginLeft: 12 }}>✕</button>
                </div>

                <div style={{ padding: isMobile ? '14px 14px 6px' : '16px 18px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Leader category cards — 2-column grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                    {alwaysOpenCats.map((cat) => {
                      const isLowRnd = cat.label === 'Tourn Low Rnd';
                      const earners = pickedPlayers.filter(cat.filter);
                      const hasEarners = earners.length > 0;
                      return (
                        <div key={cat.label} style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 12, border: selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #e2e8ef', padding: '12px 14px', boxShadow: '0 2px 6px rgba(9,34,51,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingBottom: 8, marginBottom: 8, borderBottom: (isMobile && selectedTournament === 'open') ? '0.75px solid #000000' : (isMobile && selectedTournament === 'players') ? '1px solid #f0f4f7' : selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #edf1f6' }}>
                            <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: catHeaderColor, textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3 }}>
                              {isLowRnd && isMobile ? 'Tournament Low Round' : cat.label}{isLowRnd && lowToParLabel ? <span style={{ color: (lowToPar !== null && lowToPar < 0) ? '#c0392b' : '#6b7b88', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>{lowToParLabel}</span> : null}{(() => { const fieldKey = BONUS_FIELD_KEYS[cat.label]; const unpicked = fieldKey ? unpickedBonusFor(fieldKey) : []; if (unpicked.length === 0) return null; return <button onClick={() => setBonusInfoPopup({ title: cat.label, entries: unpicked })} style={{ background: 'none', border: 'none', padding: '0 0 0 3px', cursor: 'pointer', fontSize: 14, color: '#000000', lineHeight: 1, verticalAlign: 'middle', touchAction: 'manipulation' }}>ⓘ</button>; })()}
                            </div>
                          </div>
                          {hasEarners ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {earners.map((p) => (
                                <div key={p.id} style={{ fontSize: 13, color: selectedTournament === 'open' ? '#000000' : '#0f1720', fontWeight: 700 }}>
                                  {bonusFlag(p.name)}{p.name}
                                  {isLowRnd && p.lowRoundIds?.length ? (
                                    <span style={{ color: selectedTournament === 'open' ? '#173b63' : '#607282', fontWeight: 500, fontSize: 11 }}>{' '}({p.lowRoundIds.map(r => `R${r}`).join(', ')})</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: selectedTournament === 'open' ? '#000000' : '#b0bec8', fontStyle: 'italic' }}>None selected in pool apply</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Section divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 2px' }}>
                    <div style={{ flex: 1, height: 1, background: selectedTournament === 'open' ? '#000000' : '#c8d3dc' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: selectedTournament === 'open' ? '#000000' : '#5f7180', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Individual Achievements</span>
                    <div style={{ flex: 1, height: 1, background: selectedTournament === 'open' ? '#000000' : '#c8d3dc' }} />
                  </div>

                  {/* Collapsible achievement rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {collapsibleCats.map((cat) => {
                      const isOpen = expandedBonusCategories.has(cat.label);
                      const earnerCount = pickedPlayers.filter(cat.filter).length;
                      const hasEarners = earnerCount > 0;
                      return (
                        <div key={cat.label} style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#f7f9fb', borderRadius: 12, border: selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #e2e8ef', overflow: 'hidden' }}>
                          <button
                            onClick={() => setExpandedBonusCategories((prev) => {
                              const next = new Set(prev);
                              if (next.has(cat.label)) next.delete(cat.label); else next.add(cat.label);
                              return next;
                            })}
                            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '10px 12px' : '11px 14px', background: selectedTournament === 'open' ? '#F4BC41' : '#fff', border: 'none', borderBottom: isOpen ? ((isMobile && selectedTournament === 'open') ? '0.75px solid #000000' : (isMobile && selectedTournament === 'players') ? '1px solid #f0f4f7' : selectedTournament === 'open' ? '0.5px solid #000000' : '1px solid #edf1f6') : '1px solid transparent', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent', transition: 'border-color 0.2s ease' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: catHeaderColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.label}</div>
                              {(() => {
                                const fieldKey = BONUS_FIELD_KEYS[cat.label];
                                const unpicked = fieldKey ? unpickedBonusFor(fieldKey) : [];
                                if (unpicked.length === 0) return null;
                                return <span onClick={(e) => { e.stopPropagation(); setBonusInfoPopup({ title: cat.label, entries: unpicked, showCounts: true }); }} style={{ fontSize: 14, color: '#000000', lineHeight: 1, cursor: 'pointer', touchAction: 'manipulation' }}>ⓘ</span>;
                              })()}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              {hasEarners ? (
                                <span style={{ fontSize: 11, fontWeight: 800, color: selectedTournament === 'masters' ? '#2c6449' : '#fff', background: (selectedTournament === 'us-open' || selectedTournament === 'pga') ? '#173b63' : selectedTournament === 'open' ? '#c0392b' : selectedTournament === 'masters' ? '#F3E44D' : '#E0AB43', borderRadius: 999, padding: '1px 8px', minWidth: 22, textAlign: 'center', border: (selectedTournament === 'us-open' || selectedTournament === 'pga') ? '1.5px solid #0f2d6b' : selectedTournament === 'open' ? '1.5px solid #7b1a13' : selectedTournament === 'masters' ? '1.5px solid #c8b800' : '1.5px solid #a07010', boxShadow: (selectedTournament === 'us-open' || selectedTournament === 'pga') ? '0 2px 8px rgba(14,45,100,0.4)' : selectedTournament === 'open' ? '0 2px 8px rgba(160,40,30,0.4)' : selectedTournament === 'masters' ? '0 2px 8px rgba(180,150,0,0.45)' : '0 2px 8px rgba(180,140,0,0.4)' }}>{earnerCount}</span>
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 600, color: selectedTournament === 'open' ? '#000000' : '#b0bec8' }}>0</span>
                              )}
                              <span style={{ fontSize: 10, color: selectedTournament === 'open' ? '#173b63' : '#607282', lineHeight: 1, transition: 'transform 0.2s ease', display: 'inline-block', transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>▲</span>
                            </div>
                          </button>
                          <div style={{ maxHeight: isOpen ? '600px' : '0', overflow: 'hidden', transition: 'max-height 0.25s ease' }}>
                            <div style={{ padding: '0 14px 12px', borderTop: selectedTournament === 'open' ? 'none' : '1px solid #eaf0f5' }}>
                              {renderPlayerList(cat)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {bonusInfoPopup && (
                    <div onClick={() => setBonusInfoPopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 120 }}>
                      <div onClick={(e) => e.stopPropagation()} style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 14, width: 'min(320px, 100%)', boxShadow: '0 18px 44px rgba(9,34,51,0.35)', overflow: 'hidden' }}>
                        <div style={{ background: bpHeaderBg, padding: '10px 12px 10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{bonusInfoPopup.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {TOURNAMENT_TAB_LOGOS[selectedTournament] && (
                              <img src={KNOCKOUT_TAB_LOGOS[selectedTournament] ?? TOURNAMENT_TAB_LOGOS[selectedTournament]} alt="" style={{ height: selectedTournament === 'pga' ? 34 : selectedTournament === 'players' ? 30 : selectedTournament === 'open' ? 26 : selectedTournament === 'masters' ? undefined : 22, width: selectedTournament === 'masters' ? 64 : undefined, maxWidth: 72, objectFit: 'contain', display: 'block' }} />
                            )}
                            <button onClick={() => setBonusInfoPopup(null)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, cursor: 'pointer', color: '#fff', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✕</button>
                          </div>
                        </div>
                        <div style={{ padding: '12px 16px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {bonusInfoPopup.entries.map((en) => (
                              <div key={en.name} style={{ fontSize: 13, fontWeight: 700, color: '#0f1720' }}>
                                {bonusFlag(en.name)}{en.name} <span style={{ color: selectedTournament === 'open' ? '#173b63' : '#607282', fontWeight: 600 }}>({bonusInfoPopup.showCounts ? (en.count ?? en.rounds.length) : en.rounds.map((r) => `R${r}`).join(', ')})</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 10, fontSize: 11, color: selectedTournament === 'open' ? '#000000' : '#8a99a5', fontStyle: 'italic' }}>None of these players selected in the pool</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {statLeaderboardModal !== null && (() => {
          const fullH = typeof window !== 'undefined' ? window.innerHeight : 800;
          const vpH = Math.min(visualVpHeight ?? fullH, fullH);
          const kbH = fullH - vpH; // keyboard height (0 when no keyboard)
          const kbUp = kbH > 80;
          const searchQ = statLbSearch.trim().toLowerCase();
          const allEntries = statLeaderboardModal.entries ?? [];
          // Default: top 15. Searching: all matches.
          const visibleEntries = searchQ ? allEntries.filter(e => e.name.toLowerCase().includes(searchQ)) : allEntries.slice(0, 15);
          const HEADER_H = 118;
          const ROW_H = 40;
          // Critical: add kbH as bottom padding on the backdrop so flex-end anchors
          // to the top of the keyboard, not the bottom of the window (which is behind keyboard).
          const kbPad = kbUp ? kbH + 8 : 0;
          // List maxHeight fills visible space above keyboard minus header and top margin.
          const listMaxH = kbUp
            ? Math.max(120, vpH - HEADER_H)
            : Math.floor(fullH * 0.65);
          // Only snap modal to bottom (near keyboard) when actively searching and results fit above keyboard.
          const estimatedListH = Math.min(visibleEntries.length * ROW_H + 18, listMaxH);
          const estimatedModalH = estimatedListH + HEADER_H;
          const snapToBottom = kbUp && !!searchQ && estimatedModalH <= (vpH - 16);
          const alignItems = !kbUp ? 'center' : snapToBottom ? 'flex-end' : 'flex-start';
          const padding = !kbUp ? '24px' : `4px 16px ${kbPad}px`;
          return (
          <div onClick={() => { setStatLeaderboardModal(null); setStatLbSearch(''); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.72)', display: 'flex', alignItems, justifyContent: 'center', padding, zIndex: 400 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
              <div style={{ background: '#0f1720', padding: '12px 18px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#607282', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>{statLeaderboardModal.subtitle}</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{statLeaderboardModal.label}</div>
                    {statLeaderboardModal.tourAvg && <div style={{ fontSize: 11, fontWeight: 500, color: '#8fa3b1', marginTop: 2 }}>{statLeaderboardModal.avgLabel ?? 'Tour Avg'}: <span style={{ fontWeight: 700, color: '#b8cad6' }}>{statLeaderboardModal.tourAvg}</span></div>}
                  </div>
                  <button onClick={() => { setStatLeaderboardModal(null); setStatLbSearch(''); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 999, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>×</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search player..."
                    value={statLbSearch}
                    onChange={(e) => setStatLbSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: `4px ${statLbSearch ? 26 : 8}px 4px 8px`, fontSize: 16, border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, outline: 'none', color: '#0f1720', background: '#fff' }}
                  />
                  {statLbSearch && (
                    <button onMouseDown={(e) => { e.preventDefault(); setStatLbSearch(''); }} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#607282', fontSize: 15, lineHeight: 1, padding: 2 }}>×</button>
                  )}
                </div>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: `${listMaxH}px`, padding: '6px 0 12px' }}>
                {statLeaderboardModal.entries === null ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
                ) : statLeaderboardModal.entries.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No data available</div>
                ) : (() => {
                  const allEntries = statLeaderboardModal.entries!;
                  const searchQ = statLbSearch.trim().toLowerCase();
                  const entries = searchQ ? allEntries.filter(e => e.name.toLowerCase().includes(searchQ)) : allEntries;
                  const tourAvgNum = statLeaderboardModal.tourAvg ? parseFloat(statLeaderboardModal.tourAvg.replace('%', '')) : NaN;
                  const lowerIsBetter = ['scoringAverage', 'puttAverage'].includes(statLeaderboardModal.statKey);
                  let dividerIdx = -1;
                  if (!isNaN(tourAvgNum)) {
                    for (let di = 0; di < entries.length; di++) {
                      const v = parseFloat(entries[di].value.replace('%', ''));
                      if (!isNaN(v) && (lowerIsBetter ? v > tourAvgNum : v < tourAvgNum)) { dividerIdx = di; break; }
                    }
                  }
                  const rows: React.ReactNode[] = [];
                  entries.forEach((entry, i) => {
                    const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase();
                    const isSelected = !!statLeaderboardModal.playerName && normName(entry.name) === normName(statLeaderboardModal.playerName);
                    const rankColor = '#9ca3af';
                    if (i === dividerIdx) {
                      rows.push(
                        <div key="tour-avg-divider" style={{ display: 'flex', alignItems: 'center', padding: '5px 18px 5px 5px', background: '#f0f4f8', borderTop: '2px solid #0f1720', borderBottom: '2px solid #0f1720' }}>
                          <div style={{ flex: 1, height: 1, background: '#0f1720', opacity: 0.15 }} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#0f1720', padding: '0 10px', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{statLeaderboardModal.avgLabel ?? 'Tour Avg'}: {statLeaderboardModal.tourAvg}</span>
                          <div style={{ flex: 1, height: 1, background: '#0f1720', opacity: 0.15 }} />
                        </div>
                      );
                    }
                    rows.push(
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', padding: '9px 18px 9px 5px', borderBottom: i < entries.length - 1 ? `1px solid ${isSelected ? '#c0392b' : '#f0f4f8'}` : 'none', background: isSelected ? '#c0392b' : 'transparent', borderLeft: isSelected ? '4px solid #8b0000' : '4px solid transparent' }}>
                        {/* Rank — right-aligned so units digit always lines up (9 aligns with 0 in 10) */}
                        <div style={{ width: 26, fontSize: 12, fontWeight: 800, color: isSelected ? 'rgba(255,255,255,0.7)' : rankColor, flexShrink: 0, textAlign: 'right', marginRight: 6, paddingTop: 1, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}>{entry.rank}</div>
                        {/* Flag + country — fixed width so player name always starts at same X */}
                        <div style={{ width: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, paddingTop: 1 }}>
                          {getFlagSrc(entry.name) ? (
                            <>
                              <img src={getFlagSrc(entry.name)} alt="" style={{ height: 14, width: 20, objectFit: 'cover', borderRadius: 2, border: `1px solid ${isSelected ? 'rgba(255,255,255,0.4)' : '#d1d9e0'}`, flexShrink: 0 }} />
                              <span style={{ fontSize: 9, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,0.75)' : '#9ca3af', letterSpacing: '0.05em', width: 22, display: 'inline-block' }}>{getCountryLabel(entry.name)}</span>
                            </>
                          ) : null}
                        </div>
                        {/* Player name — wraps to second line if long; white on red if selected */}
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : '#0f1720', minWidth: 0, wordBreak: 'break-word', lineHeight: 1.3 }}>{entry.name}</span>
                        {/* Value — tabular nums + fixed width so every digit lines up vertically */}
                        <div style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#fff' : '#0f1720', flexShrink: 0, width: 68, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"', paddingTop: 1 }}>{entry.value}</div>
                      </div>
                    );
                  });
                  return rows;
                })()}
              </div>
            </div>
          </div>
          );
        })()}

        {winsListPopup !== null && (
          <div
            onClick={() => setWinsListPopup(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 300 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
            >
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #0f1720, #1f2d3a)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{winsListPopup.title}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#8fa3b1', marginTop: 2 }}>{winsListPopup.playerName} · {winsListPopup.wins.length} {winsListPopup.wins.length === 1 ? 'win' : 'wins'}</div>
                </div>
                <button
                  onClick={() => setWinsListPopup(null)}
                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
                  aria-label="Close"
                >×</button>
              </div>
              {/* Win list — grouped by year, with major wins tinted in their tournament color */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {(() => {
                  // Group consecutive wins by year (the list is already sorted newest-first).
                  const groups: { year: string; wins: typeof winsListPopup.wins }[] = [];
                  for (const w of winsListPopup.wins) {
                    const last = groups[groups.length - 1];
                    if (last && last.year === w.year) last.wins.push(w);
                    else groups.push({ year: w.year, wins: [w] });
                  }
                  return groups.map((g) => (
                    <div key={g.year}>
                      {/* Year header band */}
                      <div style={{ background: '#eef2f6', padding: '5px 18px', fontSize: 11.5, fontWeight: 800, color: '#56657a', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8ef' }}>{g.year || '—'}</div>
                      {g.wins.map((w, i) => {
                        const theme = majorTint(w.tournament);
                        return (
                          <div key={`${w.tournament}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '11px 18px', background: theme ? theme.bg : '#fff', borderBottom: '1px solid #eef2f6' }}>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: 'block', fontSize: 13.5, color: theme ? theme.text : '#0f1720', fontWeight: 700 }}>{w.tournament || '—'}</span>
                              {w.course && <span style={{ display: 'block', fontSize: 11, color: theme ? theme.text : '#6b7c8c', opacity: theme ? 0.75 : 1, fontWeight: 500, marginTop: 1 }}>{w.course}</span>}
                            </span>
                            {w.toPar && <span style={{ flexShrink: 0, fontSize: 13, color: theme ? theme.text : '#475569', fontWeight: 800 }}>{w.toPar}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {pickHistoryPlayerPopup !== null && (
          <div
            onClick={() => setPickHistoryPlayerPopup(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 200 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(440px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px - var(--safe-y))', background: '#fff', borderRadius: 20, boxShadow: '0 24px 60px rgba(9,34,51,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {/* Header — vertically center the name/flag when the player has no rank bubbles */}
              {(() => {
                const hasBubbles = (pickHistoryPlayerPopup.owgrRank ?? pickHistoryPlayerPopup.player.worldRank) != null
                  || pickHistoryPlayerPopup.fedexRank != null
                  || pickHistoryPlayerPopup.dpWorldRank != null;
                return (
              <div style={{ background: '#0f1720', borderRadius: '20px 20px 0 0', padding: '14px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: hasBubbles ? 'flex-start' : 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* Name + flag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{pickHistoryPlayerPopup.player.name}</div>
                    {getPlayerFlag(pickHistoryPlayerPopup.player.name) && <>
                      <img src={getFlagSrc(pickHistoryPlayerPopup.player.name)} alt="" style={{ height: 16, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 12 }}>{getCountryLabel(pickHistoryPlayerPopup.player.name)}</span>
                    </>}
                    {/* PGA club professionals (not touring pros): PGA seal directly right of the country code.
                        Flagged either by the static set or automatically from the commissioner's upload. */}
                    {(PGA_CLUB_PROFESSIONALS.has(pickHistoryPlayerPopup.player.name) || clubProKeys.has(canonicalNameKey(pickHistoryPlayerPopup.player.name))) && (
                      // Rendered larger than the name row, but negative vertical margins keep its layout
                      // footprint at ~22px so the header height doesn't grow (overflow sits in the padding).
                      <img src="/pga-seal-gold.png" alt="PGA" style={{ height: 38, objectFit: 'contain', flexShrink: 0, marginTop: -8, marginBottom: -8 }} />
                    )}
                  </div>
                  {/* Ranking bubbles */}
                  {hasBubbles && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                    {(pickHistoryPlayerPopup.owgrRank ?? pickHistoryPlayerPopup.player.worldRank) != null && (
                      <div style={{ background: '#fff', borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ color: '#0f1720', fontWeight: 800, fontSize: 11 }}>World Rank: {pickHistoryPlayerPopup.owgrRank ?? pickHistoryPlayerPopup.player.worldRank}</span>
                      </div>
                    )}
                    {pickHistoryPlayerPopup.fedexRank != null && (
                      <div style={{ background: '#7c3aed', borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>Fed</span>
                        <span style={{ color: '#fb923c', fontWeight: 800, fontSize: 11 }}>Ex</span>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>: {pickHistoryPlayerPopup.fedexRank}</span>
                      </div>
                    )}
                    {pickHistoryPlayerPopup.dpWorldRank != null && (
                      <div style={{ background: '#6EB487', borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>DP World:</span>
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>{pickHistoryPlayerPopup.dpWorldRank}</span>
                      </div>
                    )}
                  </div>
                  )}
                </div>
                <button
                  onClick={() => setPickHistoryPlayerPopup(null)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, cursor: 'pointer', color: '#fff', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                >✕</button>
              </div>
                );
              })()}

              {/* Tab bar — segmented control so each tab reads as a clickable button */}
              <div style={{ display: 'flex', gap: 5, background: '#fff', borderBottom: '1.5px solid #e2e8ef', padding: '8px 8px', flexShrink: 0 }}>
                {(['bio', 'stats', 'season', 'career'] as const).map((tab) => {
                  const careerTabLabel: Record<string, string> = {
                    players: 'Players Career',
                    masters: 'Masters Career',
                    pga: 'PGA Champ Career',
                    'us-open': 'U.S. Open Career',
                    open: 'The Open Career',
                  };
                  const label = tab === 'stats'
                    // Until the tournament starts only season-long stats exist, so say "Season Stats";
                    // once underway/finished the tab is "Stats" with a Tournament/Season toggle inside.
                    ? (pickHistoryPlayerPopup.statsContext !== 'tournament' || careerTournamentId === 'us-open' || careerTournamentId === 'open' ? 'Season Stats' : 'Stats')
                    : tab === 'season' ? 'Season Results' : tab === 'bio' ? 'Bio' : (careerTabLabel[careerTournamentId] ?? 'Major Career');
                  const isActive = pickHistoryView === tab;
                  // The far-right "Career" tab shows the tournament's logo (same as the main standings
                  // tournament tabs) instead of text. Keep it on a white chip so the colored logo stays
                  // legible; selection is shown via the border + shadow rather than a dark fill.
                  const careerLogo = tab === 'career' ? TOURNAMENT_TAB_LOGOS[careerTournamentId] : undefined;
                  const careerLogoHeight = CAREER_TAB_LOGO_HEIGHTS[careerTournamentId] ?? 32;
                  return (
                    <button
                      key={tab}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setPickHistoryView(tab as 'stats' | 'season' | 'career' | 'bio');
                        if (tab === 'career' && pickHistoryPlayerPopup.careerResults === null && !pickHistoryPlayerPopup.careerResultsLoading) {
                          setPickHistoryPlayerPopup((prev) => prev ? { ...prev, careerResultsLoading: true } : null);
                          try {
                            const data = await readJson<{ results: { year: number; course: string; position: string }[] | null }>(`/api/player-career?name=${encodeURIComponent(pickHistoryPlayerPopup.player.name)}&tournamentId=${careerTournamentId}`, { cache: 'no-store' });
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, careerResults: data.results, careerResultsLoading: false } : null);
                          } catch {
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, careerResultsLoading: false } : null);
                          }
                        }
                        if (tab === 'bio' && pickHistoryPlayerPopup.playerBio === null && !pickHistoryPlayerPopup.playerBioLoading) {
                          setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBioLoading: true } : null);
                          try {
                            const bioParams = new URLSearchParams({ name: pickHistoryPlayerPopup.player.name });
                            if (pickHistoryPlayerPopup.player.pgaTourId) bioParams.set('pgaTourId', String(pickHistoryPlayerPopup.player.pgaTourId));
                            const data = await readJson<{ bio: { height: string | null; weight: string | null; dob: string | null; age: number | null; birthPlace: string | null; college: string | null; collegeConfirmedAbsent: boolean; swing: string | null; turnedPro: number | null; pgaTourDebut: number | null; careerStarts: number | null; cutsMade: number | null; careerWins: number | null; majorStarts: number | null; majorCutsMade: number | null; majorWins: number | null; careerEarnings: string | null; pgaTourWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; majorWinsList: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null }; espnPhotoUrl?: string | null; pgaPhotoUrl?: string | null; updatedAt?: string | null }>(`/api/player-bio?${bioParams.toString()}`, { cache: 'no-store' });
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBio: data.bio, playerBioLoading: false, espnPhotoUrl: data.espnPhotoUrl ?? null, pgaPhotoUrl: data.pgaPhotoUrl ?? null, bioFetchedAt: data.updatedAt ?? null } : null);
                          } catch {
                            setPickHistoryPlayerPopup((prev) => prev ? { ...prev, playerBioLoading: false } : null);
                          }
                        }
                      }}
                      style={{ flex: 1, height: 33, boxSizing: 'border-box', border: isActive ? '1px solid #0f1720' : '1px solid #d8e0e8', borderRadius: 8, background: isActive ? '#fff' : '#f4f7fa', padding: careerLogo ? '0 4px' : '0 3px', fontSize: 'clamp(8.5px, 2.2vw, 11px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isActive ? 800 : 600, color: isActive ? '#0f1720' : '#5a6a7a', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.01em', boxShadow: isActive ? '0 1px 4px rgba(15,23,32,0.28)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {careerLogo
                        ? <img src={careerLogo} alt={label} style={{ height: careerLogoHeight, maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                        : label}
                    </button>
                  );
                })}
              </div>

              {/* Body */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px 20px', background: '#f4f7fa', borderRadius: '0 0 20px 20px' }}>
                {pickHistoryView === 'bio' && (() => {
                  const bio = pickHistoryPlayerPopup.playerBio;
                  const loading = pickHistoryPlayerPopup.playerBioLoading;
                  // Photo: use the same synchronous source as the lists (PGA-only pins -> PGA;
                  // manual upload wins; else ESPN headshot; else PGA). Available on first paint, so
                  // the photo is correct immediately and never swaps after the bio loads.
                  const photoPlayer = pickHistoryPlayerPopup.player;
                  const pgaDefault = pgaPhoto(photoPlayer.pgaTourId);
                  const syncPhoto = playerPhotoSrc(photoPlayer.name, photoPlayer.pgaTourId, photoPlayer.photoUrl);
                  // When the synchronous source has no real photo for this player (it falls back to
                  // the blank PGA silhouette) and they aren't intentionally pinned to the PGA photo,
                  // use the live ESPN-by-name headshot the bio API resolved. This restores photos for
                  // non-pool players (e.g. Masters legends) without a flash for everyone else.
                  const noRealSyncPhoto = syncPhoto === pgaDefault && !PGA_PHOTO_ONLY.has(photoPlayer.name);
                  // For non-pool players (pgaTourId 0) the bio API resolves a real PGA Tour headshot
                  // (pgaPhotoUrl) from its own id map — use it when the synchronous source is the blank
                  // silhouette, and as the on-error fallback when the ESPN headshot 404s.
                  const bioPgaPhoto = pickHistoryPlayerPopup.pgaPhotoUrl;
                  const photoSrc = noRealSyncPhoto
                    ? (pickHistoryPlayerPopup.espnPhotoUrl ?? bioPgaPhoto ?? syncPhoto)
                    : syncPhoto;
                  const photoFallback = (noRealSyncPhoto ? bioPgaPhoto : null) ?? photoPlayer.photoUrl ?? pgaDefault;
                  const topRows: { label: string; value: string | number | null; italic?: boolean }[] = [
                    { label: 'DOB', value: bio?.dob ? `${bio.dob}${bio.age != null ? ` (${bio.age})` : ''}` : null },
                    { label: 'Birthplace', value: bio?.birthPlace ?? null },
                    { label: 'Height', value: bio?.height ?? null },
                    { label: 'Weight', value: bio?.weight ?? null },
                    { label: 'Swing', value: bio?.swing ?? null },
                    { label: 'College', value: bio?.college ? formatCollege(bio.college) : null, italic: !bio?.college && (bio?.collegeConfirmedAbsent ?? false) },
                  ];
                  // Career rows are split into logically grouped cards so the PGA Tour trio and the
                  // Major trio each read as their own unit (Turned Pro / Career Earnings are the
                  // standalone bookends). Each group renders as its own outlined card with a small gap.
                  type BioBottomRow = { label: string; value: string | number | null; wins?: { tournament: string; year: string; course: string | null; toPar: string | null }[] | null; amateur?: boolean };
                  // Amateurs (flagged from the commissioner's "(a)" upload markers) show a red "AMATEUR"
                  // in place of a Turned Pro year — BUT only while they have no turn-pro year. A turn-pro
                  // year is the authoritative signal that they've gone pro (ESPN publishes it, or a bio
                  // override sets it), so the moment one exists the field auto-flips from AMATEUR to the
                  // year with no re-upload or manual step.
                  const isAmateur = amateurKeys.has(canonicalNameKey(pickHistoryPlayerPopup.player.name)) && bio?.turnedPro == null;
                  // A player with no PGA Tour starts (ESPN returns no career-starts figure) has never
                  // played a PGA Tour event — show 0 across the PGA Tour trio instead of dashes. Only
                  // once the bio has actually loaded; while loading (bio null) they stay as dashes.
                  const noPgaCareer = bio != null && (bio.careerStarts == null || bio.careerStarts === 0);
                  const bottomGroups: BioBottomRow[][] = [
                    [
                      isAmateur
                        ? { label: 'Turned Pro', value: 'AMATEUR', amateur: true }
                        : { label: 'Turned Pro', value: bio?.turnedPro ?? null },
                    ],
                    [
                      { label: 'PGA Tour Starts', value: noPgaCareer ? 0 : bio?.careerStarts ?? null },
                      { label: 'Cuts Made', value: noPgaCareer ? 0 : bio?.cutsMade ?? null },
                      { label: 'PGA Tour Wins', value: noPgaCareer ? 0 : (bio?.careerWins ?? null), wins: bio?.pgaTourWinsList ?? null },
                    ],
                    [
                      { label: 'Major Starts', value: bio?.majorStarts ?? null },
                      { label: 'Cuts Made', value: bio?.majorCutsMade ?? null },
                      { label: 'Major Wins', value: bio?.majorWins ?? null, wins: bio?.majorWinsList ?? null },
                    ],
                    [
                      { label: 'Career Earnings', value: bio?.careerEarnings ?? null },
                    ],
                  ];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {/* Top section: photo left, personal info right */}
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e2e8ef', marginBottom: 10 }}>
                        {/* Photo column */}
                        <div style={{ flexShrink: 0, width: 125, background: '#e8edf2', display: 'flex', alignItems: 'stretch' }}>
                          <img
                            src={photoSrc}
                            data-fb={photoFallback}
                            alt={photoPlayer.name}
                            style={{ width: 125, objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                            onError={photoOnError}
                          />
                        </div>
                        {/* Personal info rows */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1.5px solid #e2e8ef' }}>
                          {topRows.map((row, i) => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: i < topRows.length - 1 ? '1px solid #e2e8ef' : 'none', flex: 1 }}>
                              <span style={{ fontSize: 12, color: '#5a6a7a', fontWeight: 600 }}>{row.label}</span>
                              {loading
                                ? <span style={{ width: 90, height: 11, borderRadius: 4, background: '#e2e8ef', marginLeft: 6, display: 'inline-block' }} />
                                : row.italic
                                  ? <span style={{ fontSize: 11, color: '#9aabb8', fontStyle: 'italic', textAlign: 'right', marginLeft: 6 }}>*Did not attend college</span>
                                  : <span style={{ fontSize: 12, color: row.value != null ? '#0f1720' : '#b0bec5', fontWeight: 700, textAlign: 'right', marginLeft: 6 }}>{row.value != null ? String(row.value) : '—'}</span>
                              }
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Bottom rows: full width, split into grouped cards (PGA Tour vs Majors vs bookends) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {bottomGroups.map((group, gi) => (
                          <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e2e8ef' }}>
                            {group.map((row, i) => {
                              // A Wins row is tappable when we have the per-win detail (count > 0).
                              const clickable = !loading && !!row.wins && row.wins.length > 0;
                              return (
                              <div
                                key={row.label}
                                onClick={clickable ? () => setWinsListPopup({ title: row.label, playerName: photoPlayer.name, wins: row.wins! }) : undefined}
                                role={clickable ? 'button' : undefined}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: i < group.length - 1 ? '1px solid #e2e8ef' : 'none', cursor: clickable ? 'pointer' : 'default' }}
                              >
                                <span style={{ fontSize: 13, color: '#5a6a7a', fontWeight: 600 }}>{row.label}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {/* Eye/info icon (same affordance as the leaderboard popup triggers), to the
                                      LEFT so the number stays right-aligned with the other rows. */}
                                  {clickable && (
                                    <span style={{ fontSize: isMobile ? 14 : 15, color: '#607282', lineHeight: 1 }} aria-label={`View ${row.label}`}>ⓘ</span>
                                  )}
                                  <span style={{ fontSize: 13, color: row.amateur ? '#d32f2f' : row.value != null ? '#0f1720' : '#b0bec5', fontWeight: row.amateur ? 800 : 700, letterSpacing: row.amateur ? 0.5 : undefined }}>{row.value != null ? String(row.value) : '—'}</span>
                                </span>
                              </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      {(() => {
                        const times = [pickHistoryPlayerPopup.bioFetchedAt, pickHistoryPlayerPopup.rankingsChangedAt].filter(Boolean) as string[];
                        const ts = times.length ? times.slice().sort()[times.length - 1] : null;
                        return ts && !loading ? (
                          <div style={{ fontSize: 10, color: '#a0adb8', textAlign: 'center', marginTop: 8 }}>
                            Last updated: {new Date(ts).toLocaleString()}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  );
                })()}
                {pickHistoryView === 'stats' && (() => {
                  const isTournCtx = pickHistoryPlayerPopup.statsContext === 'tournament';
                  // The Open publishes no per-event advanced stats (ESPN 404s, PGA feed empty), so
                  // like the US Open it shows Season stats only with no Tournament/Season toggle.
                  const seasonOnlyTab = careerTournamentId === 'us-open' || careerTournamentId === 'open';
                  const showSubToggle = isTournCtx && !seasonOnlyTab;
                  const s = careerTournamentId === 'open'
                    ? pickHistoryPlayerPopup.playerSeasonStats
                    : showSubToggle && statsSubView === 'season'
                    ? pickHistoryPlayerPopup.playerSeasonStats
                    : pickHistoryPlayerPopup.playerStats;
                  const espnRounds = isTournCtx
                    ? (pickHistoryPlayerPopup.playerStats?.rounds ?? []).map((score, i) => ({ round: i + 1, score }))
                    : [];
                  const rounds = isTournCtx
                    ? (pickHistoryPlayerPopup.playerRounds?.length ? pickHistoryPlayerPopup.playerRounds : espnRounds)
                    : [];
                  const isTournView = !seasonOnlyTab && ((showSubToggle && statsSubView === 'tournament') || (!showSubToggle && isTournCtx));
                  const avgs = isTournView
                    ? { ...pickHistoryPlayerPopup.statAverages, ...pickHistoryPlayerPopup.fieldAverages }
                    : pickHistoryPlayerPopup.statAverages ?? {};
                  const avgLabel = isTournView ? 'Field Avg' : 'Tour Avg';
                  const distributions = pickHistoryPlayerPopup.fieldDistributions ?? {};
                  const tournRanks = pickHistoryPlayerPopup.statRanks ?? {};
                  const rawSeasonStatRanks = pickHistoryPlayerPopup.seasonStatRanks ?? {};
                  // Season view ranks come ONLY from the season fetch (rawSeasonStatRanks). We fall
                  // back to tournRanks ONLY when the main fetch was itself season context
                  // (!isTournCtx) — there tournRanks legitimately holds season ranks. In a live
                  // tournament popup (isTournCtx), tournRanks holds TOURNAMENT ranks, so we must NOT
                  // borrow them, or a player with no season ranks (LIV / non-qualified) would show
                  // his tournament SG ranks in the season view.
                  const seasonRanks = isTournView
                    ? tournRanks
                    : (Object.keys(rawSeasonStatRanks).length > 0 ? rawSeasonStatRanks : (isTournCtx ? {} : tournRanks));
                  function ordinal(n: string | number): string {
                    const num = parseInt(String(n));
                    if (isNaN(num)) return String(n);
                    const v = num % 100;
                    const suffix = (v >= 11 && v <= 13) ? 'th' : ['th','st','nd','rd','th'][Math.min(num % 10, 4)];
                    return `${num}${suffix}`;
                  }
                  // Compute rank from sorted field distribution (best-first array)
                  function getFieldRank(key: string, rawValue: string | null): string | null {
                    if (!rawValue) return null;
                    const dist = distributions[key];
                    if (!dist || dist.length < 5) return null;
                    const playerVal = parseFloat(rawValue.replace('%', ''));
                    if (isNaN(playerVal)) return null;
                    const lowerIsBetter = key === 'scoringAverage' || key === 'puttAverage';
                    const betterCount = dist.filter((v) => lowerIsBetter ? v < playerVal : v > playerVal).length;
                    return String(betterCount + 1);
                  }
                  const SG_KEYS = new Set(['sgTotal','sgTeeToGreen','sgOffTee','sgApproach','sgAroundGreen','sgPutting']);
                  // Hide SG ranks for cut players when Round 3 has started
                  const feedPlayer = feed?.fullLeaderboard?.find((p) => p.name === pickHistoryPlayerPopup.player.name)
                    ?? (feed?.players ?? []).find((p) => p.canonicalName === pickHistoryPlayerPopup.player.name);
                  const playerMissedCut = feedPlayer?.score === 'CUT' || feedPlayer?.position === 'CUT'
                    || feedPlayer?.score === 'MDF' || feedPlayer?.position === 'MDF';
                  const hideSgRanks = isTournView && roundTwoComplete && playerMissedCut;
                  function getRank(key: string, rawValue: string | null): string | null {
                    if (hideSgRanks && SG_KEYS.has(key)) return null;
                    if (isTournView) {
                      // Tournament leaderboard list position (from the API) is the source of truth for
                      // BOTH course and SG, so the card matches the popup exactly. For course stats,
                      // fall back to the field-distribution rank only if the leaderboard rank is absent
                      // (e.g. its cache is cold). SG has no fallback. No season ranks here.
                      const r = tournRanks[key] ?? null;
                      if (r) return ordinal(r);
                      if (SG_KEYS.has(key)) return null;
                      const fieldRank = getFieldRank(key, rawValue);
                      return fieldRank ? ordinal(fieldRank) : null;
                    }
                    // Season view: pure season PGA Tour ranks
                    const r = seasonRanks[key] ?? null;
                    return r ? ordinal(r) : null;
                  }
                  const courseStatCells: { label: string; value: string; avgKey?: string; rankKey?: string }[] = [];
                  const sgStatCells: { label: string; value: string; rankKey?: string }[] = [];
                  if (s?.drivingDistance) courseStatCells.push({ label: 'Drive Distance', value: s.drivingDistance, avgKey: 'drivingDistance', rankKey: 'drivingDistance' });
                  if (s?.drivingAccuracy) courseStatCells.push({ label: 'Drive Accuracy', value: s.drivingAccuracy, avgKey: 'drivingAccuracy', rankKey: 'drivingAccuracy' });
                  if (s?.gir) courseStatCells.push({ label: 'Greens in Reg', value: s.gir, avgKey: 'gir', rankKey: 'gir' });
                  if (s?.scrambling) courseStatCells.push({ label: 'Scrambling', value: s.scrambling, avgKey: 'scrambling', rankKey: 'scrambling' });
                  if (s?.sandSaves) courseStatCells.push({ label: 'Sand Saves', value: s.sandSaves, avgKey: 'sandSaves', rankKey: 'sandSaves' });
                  if (s?.puttAverage) courseStatCells.push({ label: 'Putts/Green', value: s.puttAverage, avgKey: 'puttAverage', rankKey: 'puttAverage' });
                  if (showSubToggle && statsSubView === 'tournament') {
                    if (s?.proximity) courseStatCells.push({ label: 'Proximity', value: s.proximity });
                  }
                  if (s?.sgTotal) sgStatCells.push({ label: 'Total', value: s.sgTotal, rankKey: 'sgTotal' });
                  if (s?.sgTeeToGreen) sgStatCells.push({ label: 'Tee to Green', value: s.sgTeeToGreen, rankKey: 'sgTeeToGreen' });
                  if (s?.sgOffTee) sgStatCells.push({ label: 'Off the Tee', value: s.sgOffTee, rankKey: 'sgOffTee' });
                  if (s?.sgApproach) sgStatCells.push({ label: 'Approach', value: s.sgApproach, rankKey: 'sgApproach' });
                  if (s?.sgAroundGreen) sgStatCells.push({ label: 'Around Green', value: s.sgAroundGreen, rankKey: 'sgAroundGreen' });
                  if (s?.sgPutting) sgStatCells.push({ label: 'Putting', value: s.sgPutting, rankKey: 'sgPutting' });
                  const statCells = [...courseStatCells, ...sgStatCells];
                  const subToggle = showSubToggle ? (
                    <div key="stats-subtoggle" style={{ display: 'flex', background: '#e8edf2', borderRadius: 8, padding: 3, marginBottom: 10, justifySelf: 'start' }}>
                      {(['tournament', 'season'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setStatsSubView(v)}
                          style={{ padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', transition: 'all 0.15s', background: statsSubView === v ? '#fff' : 'transparent', color: statsSubView === v ? '#0f1720' : '#607282', boxShadow: statsSubView === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                        >
                          {v === 'tournament' ? 'Tournament' : 'Season'}
                        </button>
                      ))}
                    </div>
                  ) : null;
                  if (pickHistoryPlayerPopup.playerStatsLoading) {
                    return (
                      <div key="stats-loading" style={{ display: 'grid', gap: 10 }}>
                        {subToggle}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          {[0,1,2,3].map((i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px', textAlign: 'center' }}>
                              <div className="ph-skeleton" style={{ height: 9, width: 22, marginBottom: 4, borderRadius: 3, margin: '0 auto 4px' }} />
                              <div className="ph-skeleton" style={{ height: 14, width: 28, borderRadius: 3, margin: '0 auto' }} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {[0,1,2,3,4,5].map((i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px' }}>
                              <div className="ph-skeleton" style={{ height: 9, width: 48, marginBottom: 4, borderRadius: 3 }} />
                              <div className="ph-skeleton" style={{ height: 13, width: 60, borderRadius: 3 }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (statCells.length === 0) {
                    return <div key="stats-empty" style={{ display: 'grid', gap: 0 }}>{subToggle}<div style={{ textAlign: 'center', color: '#607282', padding: '20px 0', fontSize: 14 }}>No stats available for this {isTournCtx && statsSubView === 'tournament' ? 'tournament' : 'season'}.</div></div>;
                  }
                  return (
                    <div key="stats-loaded" style={{ display: 'grid', gap: 10 }}>
                      {subToggle}
                      {courseStatCells.length > 0 && (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {courseStatCells.map(({ label, value, avgKey, rankKey }) => {
                              const avg = avgKey ? avgs[avgKey] : undefined;
                              const rank = rankKey ? getRank(rankKey, value) : null;
                              return (
                                <div key={label} onClick={() => { if (rankKey) { const lbEventId = TOURNAMENT_ESPN_EVENT_IDS[careerTournamentId]; const url = isTournView && lbEventId ? `/api/tournament-stat-leaderboard?statKey=${rankKey}&eventId=${lbEventId}` : `/api/stat-leaderboard?statKey=${rankKey}`; const subtitle = isTournView ? 'Tournament Leaders' : 'Season Leaders'; setStatLeaderboardModal({ label, statKey: rankKey, subtitle, tourAvg: null, avgLabel: isTournView ? 'Field Avg' : 'Tour Avg', playerName: pickHistoryPlayerPopup?.player.name ?? null, entries: null }); fetch(url).then(r => r.json()).then(d => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, tourAvg: d.fieldAvg ?? d.tourAvg ?? null, entries: d.entries ?? [] } : prev)).catch(() => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, entries: [] } : prev)); } }} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px', cursor: rankKey ? 'pointer' : 'default' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1720' }}>
                                    {value}{rank && <span style={{ fontSize: 10, fontWeight: 600, color: '#607282', marginLeft: 4 }}>({rank})</span>}
                                  </div>
                                  {avg && <div style={{ fontSize: 9, color: '#a0adb8', marginTop: 3 }}>{avgLabel}: {avg}</div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {sgStatCells.length > 0 && !(careerTournamentId === 'masters' && isTournView) && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Strokes Gained</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {sgStatCells.map(({ label, value, rankKey }) => {
                              const rank = rankKey ? getRank(rankKey, value) : null;
                              return (
                                <div key={label} onClick={() => { if (rankKey) { const lbEventId = TOURNAMENT_ESPN_EVENT_IDS[careerTournamentId]; const url = isTournView && lbEventId ? `/api/tournament-stat-leaderboard?statKey=${rankKey}&eventId=${lbEventId}` : `/api/stat-leaderboard?statKey=${rankKey}`; const subtitle = isTournView ? 'Tournament Leaders' : 'Season Leaders'; setStatLeaderboardModal({ label: `Strokes Gained: ${label}`, statKey: rankKey, subtitle, tourAvg: null, avgLabel: isTournView ? 'Field Avg' : 'Tour Avg', playerName: pickHistoryPlayerPopup?.player.name ?? null, entries: null }); fetch(url).then(r => r.json()).then(d => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, tourAvg: isTournView ? null : (d.fieldAvg ?? d.tourAvg ?? null), entries: d.entries ?? [] } : prev)).catch(() => setStatLeaderboardModal(prev => prev?.statKey === rankKey ? { ...prev, entries: [] } : prev)); } }} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ef', padding: '8px 10px', cursor: rankKey ? 'pointer' : 'default' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1720' }}>
                                    {value}{rank && <span style={{ fontSize: 10, fontWeight: 600, color: '#607282', marginLeft: 4 }}>({rank})</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const ts = isTournView ? pickHistoryPlayerPopup.tournamentStatsFetchedAt : pickHistoryPlayerPopup.seasonStatsFetchedAt;
                        return ts ? (
                          <div style={{ fontSize: 10, color: '#a0adb8', textAlign: 'center', marginTop: 4 }}>
                            Last updated: {new Date(ts).toLocaleString()}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  );
                })()}
                {pickHistoryView === 'season' && (
                  pickHistoryPlayerPopup.fullResultsLoading ? (
                    <div key="full-loading" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      <div className="ph-skeleton" style={{ height: 13, width: 160, marginBottom: 4 }} />
                      {Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: '1px solid #e2e8ef', background: '#fff', gap: 10 }}>
                          <div style={{ flex: 1, display: 'grid', gap: 5 }}>
                            <div className="ph-skeleton" style={{ height: 12, width: `${90 + (i % 3) * 30}px` }} />
                            <div className="ph-skeleton" style={{ height: 10, width: `${60 + (i % 4) * 20}px` }} />
                          </div>
                          <div className="ph-skeleton" style={{ height: 18, width: 32, borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  ) : !pickHistoryPlayerPopup.fullResults || pickHistoryPlayerPopup.fullResults.length === 0 ? (
                    <div key="full-empty" className="ph-fade-in" style={{ textAlign: 'center', color: '#607282', padding: '30px 0', fontSize: 14 }}>No PGA, DP World or LIV starts this season.</div>
                  ) : (
                    <div key="full-loaded" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      {(() => {
                        const pgaResults = pickHistoryPlayerPopup.fullResults!.filter((r) => r.tour === 'pga' || !r.tour);
                        const livResults = pickHistoryPlayerPopup.fullResults!.filter((r) => r.tour === 'liv');
                        const eurResults = pickHistoryPlayerPopup.fullResults!.filter((r) => r.tour === 'eur');
                        type FullResult = { tournament: string; date: string; course: string; position: string; tour: 'pga' | 'liv' | 'eur' };
                        const renderCard = (r: FullResult, i: number) => {
                          const isCut = r.position === 'CUT' || r.position === 'WD' || r.position === 'MDF' || r.position === 'DQ';
                          const majorBadge = majorTint(r.tournament);
                          const displayTournament = r.tournament === 'The Open' ? 'The Open Championship' : r.tournament;
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: majorBadge ? `1px solid ${majorBadge.bg}` : '1px solid #e2e8ef', background: majorBadge ? majorBadge.bg : '#fff', gap: 10 }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: majorBadge ? majorBadge.text : '#0f1720', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTournament}</div>
                                <div style={{ fontSize: 11, color: majorBadge ? majorBadge.text : '#7a8c99', marginTop: 1, opacity: majorBadge ? 0.75 : 1 }}>{r.date}{r.course ? ` · ${r.course}` : ''}</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 16, fontWeight: 900, color: isCut ? '#cc2944' : (majorBadge ? majorBadge.text : '#0f1720'), lineHeight: 1 }}>{r.position}</div>
                              </div>
                            </div>
                          );
                        };
                        const hasAny = pgaResults.length > 0 || livResults.length > 0 || eurResults.length > 0;
                        if (!hasAny) {
                          return <div style={{ textAlign: 'center', color: '#607282', padding: '30px 0', fontSize: 14 }}>No PGA, DP World or LIV starts this season.</div>;
                        }
                        return (
                          <>
                            {pgaResults.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 2 }}>2026 PGA Tour Results</div>
                                {pgaResults.map(renderCard)}
                              </>
                            )}
                            {livResults.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 2, marginTop: pgaResults.length > 0 ? 10 : 0 }}>2026 LIV Golf Results</div>
                                {livResults.map(renderCard)}
                              </>
                            )}
                            {eurResults.length > 0 && (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 2, marginTop: (pgaResults.length > 0 || livResults.length > 0) ? 10 : 0 }}>2025-26 DP World Tour Results</div>
                                {eurResults.map(renderCard)}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )
                )}
                {pickHistoryView === 'career' && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7a8c99', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 10 }}>
                    {TOURNAMENT_CAREER_RESULTS_HEADER[careerTournamentId] ?? 'Career Results'}
                  </div>
                )}
                {pickHistoryView === 'career' && (
                  pickHistoryPlayerPopup.careerResultsLoading ? (
                    <div key="career-loading" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      <div className="ph-skeleton" style={{ height: 13, width: 140, marginBottom: 4 }} />
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: '1px solid #e2e8ef', background: '#fff', gap: 10 }}>
                          <div style={{ flex: 1, display: 'grid', gap: 5 }}>
                            <div className="ph-skeleton" style={{ height: 12, width: 36 }} />
                            <div className="ph-skeleton" style={{ height: 10, width: 120 }} />
                          </div>
                          <div className="ph-skeleton" style={{ height: 18, width: 32, borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  ) : pickHistoryPlayerPopup.careerResults === null ? (
                    <div key="career-empty" className="ph-fade-in" style={{ textAlign: 'center', color: '#607282', padding: '30px 0', fontSize: 14 }}>Has not competed in {TOURNAMENTS.find((t) => t.id === careerTournamentId)?.name ?? 'this tournament'}</div>
                  ) : (
                    <div key="career-loaded" className="ph-fade-in" style={{ display: 'grid', gap: 6 }}>
                      {pickHistoryPlayerPopup.careerResults.map((r, i) => {
                        const isCut = r.position === 'CUT' || r.position === 'WD' || r.position === 'MDF' || r.position === 'DQ';
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderRadius: 10, border: '1px solid #e2e8ef', background: '#fff', gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#0f1720' }}>{r.year}</div>
                              <div style={{ fontSize: 11, color: '#7a8c99', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.course}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 16, fontWeight: 900, color: isCut ? '#cc2944' : '#0f1720', lineHeight: 1 }}>{r.position}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {showRosterConfirm && (
          <div
            onClick={() => setShowRosterConfirm(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, width: '100%', maxWidth: 380, boxShadow: '0 18px 48px rgba(9,34,51,0.25)', overflow: 'hidden', maxHeight: 'calc(100vh - 40px - var(--safe-y))', display: 'flex', flexDirection: 'column' }}
            >
              {/* Coloured header */}
              <div style={{ background: entriesTournamentBg, padding: '16px 20px 14px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: hasSubmittedRoster ? 'center' : 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Confirm Your Roster</div>
                  {!hasSubmittedRoster && (
                    <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.01em' }}>Pool Entry Fee: $30</div>
                  )}
                </div>
                {TOURNAMENT_TAB_LOGOS[entriesTournamentId] && (
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={KNOCKOUT_TAB_LOGOS[entriesTournamentId] ?? TOURNAMENT_TAB_LOGOS[entriesTournamentId]} alt={entriesTournament.name} style={{ height: entriesTournamentId === 'pga' ? 60 : entriesTournamentId === 'players' ? 52 : entriesTournamentId === 'open' ? 40 : entriesTournamentId === 'masters' ? undefined : 36, width: entriesTournamentId === 'masters' ? 120 : undefined, margin: entriesTournamentId === 'pga' ? '-12px 0' : entriesTournamentId === 'players' ? '-8px 0' : undefined, maxWidth: 120, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '14px 18px 18px', overflowY: 'auto' }}>
                {/* Roster list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
                  {orderedRosterPlayers.map((player) => (
                    <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                      <span style={{ fontWeight: 700, color: '#0f1720' }}>{player.name}</span>
                      <span style={{ fontWeight: 600, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', fontVariantNumeric: 'tabular-nums' }}>${player.salary.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: entriesTournamentId === 'open' ? '1px solid #8a8f96' : '1px solid #e8edf2', marginBottom: 10 }} />

                {/* Salary summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Salary used</span>
                  <span style={{ fontWeight: 700, color: '#0f1720', fontVariantNumeric: 'tabular-nums' }}>${salaryUsed.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Remaining</span>
                  <span style={{ fontWeight: 700, color: salaryRemaining < 0 ? '#dc2626' : '#0f1720', fontVariantNumeric: 'tabular-nums' }}>${salaryRemaining.toLocaleString()}</span>
                </div>

                <div style={{ borderTop: entriesTournamentId === 'open' ? '1px solid #8a8f96' : '1px solid #e8edf2', marginBottom: 10 }} />

                {/* Tiebreaker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 16 }}>
                  <span style={{ color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Your tiebreaker</span>
                  <span style={{ fontWeight: 700, color: '#0f1720' }}>{tieBreakInput} <span style={{ fontWeight: 400, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#8a99a6' }}>(par {TOURNAMENT_TOTAL_PAR[entriesTournamentId] ?? '—'})</span></span>
                </div>

                {/* Explanation for the Submit & Pay flow */}
                {!hasSubmittedRoster && (
                  <div style={{ fontSize: 11.5, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79', lineHeight: 1.5, marginBottom: 10 }}>
                    *Hitting <b>Submit &amp; Pay</b>{' '}submits your roster and automatically opens Venmo to @claytont743 to pay the pool entry fee. The $30 amount and what it&apos;s for are auto-populated for you.
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  {!hasSubmittedRoster ? (
                    <>
                      <button
                        onClick={async () => {
                          // Venmo opens ONLY after the roster save is confirmed — a failed save
                          // (expired session, network blip) must never send someone off to pay.
                          const saved = await handleSave();
                          setShowRosterConfirm(false);
                          if (!saved) return; // saveMessage shows the error on the pick sheet
                          setShowSubmitToast(true);
                          setTimeout(() => {
                            setShowSubmitToast(false);
                            window.location.href = `venmo://paycharge?txn=pay&recipients=claytont743&amount=30&note=${encodeURIComponent('⛳')}`;
                          }, 2000);
                        }}
                        style={{ flex: 1, border: 'none', borderRadius: 12, padding: '13px 0', background: entriesTournamentBg, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
                      >
                        Submit &amp; Pay
                      </button>
                      <button
                        onClick={() => setShowRosterConfirm(false)}
                        style={{ flex: 1, border: entriesTournamentId === 'open' ? 'none' : '2px solid #dfe5eb', borderRadius: 12, padding: '13px 0', background: entriesTournamentId === 'open' ? '#dce6f5' : '#fff', color: entriesTournamentId === 'open' ? '#173b63' : '#374151', fontSize: 15, fontWeight: entriesTournamentId === 'open' ? 800 : 700, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setShowRosterConfirm(false); void handleSave(); }}
                        style={{ flex: 1, border: 'none', borderRadius: 12, padding: '13px 0', background: entriesTournamentBg, color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer' }}
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => setShowRosterConfirm(false)}
                        style={{ flex: 1, border: entriesTournamentId === 'open' ? 'none' : '2px solid #dfe5eb', borderRadius: 12, padding: '13px 0', background: entriesTournamentId === 'open' ? '#dce6f5' : '#fff', color: entriesTournamentId === 'open' ? '#173b63' : '#374151', fontSize: 15, fontWeight: entriesTournamentId === 'open' ? 800 : 700, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showSubmitToast && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: entriesTournamentId === 'open' ? '#F4BC41' : '#fff', borderRadius: 18, padding: '24px 28px', boxShadow: '0 18px 48px rgba(9,34,51,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={30} color="#1f8d4e" />
              <span style={{ fontSize: 17, fontWeight: 900, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#0f1720' }}>
                Roster successfully submitted!
                <span style={{ display: 'block', marginTop: 4, fontSize: 14, fontWeight: 700, color: entriesTournamentId === 'open' ? entriesTournamentBg : '#5b6b79' }}>Now opening Venmo…</span>
              </span>
            </div>
          </div>
        )}

        {showSubmittedPicksPopup && (
          <div
            onClick={() => { setShowSubmittedPicksPopup(false); setSubmittedPicksSort('alpha'); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(9,34,51,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: selectedTournament === 'open' ? '#F4BC41' : '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 18px 48px rgba(9,34,51,0.25)', maxHeight: 'calc(100vh - 80px - var(--safe-y))', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#0f1720' }}>Submitted Picks ({submittedEntries.length})</div>
                <button
                  onClick={() => setSubmittedPicksSort((s) => (s === 'alpha' ? 'newest' : 'alpha'))}
                  style={{ marginLeft: 'auto', marginRight: 8, background: selectedTournament === 'open' ? '#173b63' : '#f0f4f8', border: 'none', borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: selectedTournament === 'open' ? '#fff' : '#5b6b79' }}
                >
                  {submittedPicksSort === 'alpha' ? 'A–Z' : 'Newest'}
                </button>
                <button
                  onClick={() => { setShowSubmittedPicksPopup(false); setSubmittedPicksSort('alpha'); }}
                  style={{ background: selectedTournament === 'open' ? '#173b63' : '#f0f4f8', border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, color: selectedTournament === 'open' ? '#fff' : '#5b6b79' }}
                >✕</button>
              </div>
              <div style={{ overflowY: 'auto', display: 'grid', gap: 8 }}>
                {[...submittedEntries].sort((a, b) => {
                  if (submittedPicksSort === 'alpha') return a.name.localeCompare(b.name);
                  const ta = a.rosterSubmittedAt?.[entriesTournamentId] ?? '';
                  const tb = b.rosterSubmittedAt?.[entriesTournamentId] ?? '';
                  if (ta !== tb) return tb.localeCompare(ta); // newest first; missing stamps sink
                  return a.name.localeCompare(b.name);
                }).map((entry) => (
                  <div key={entry.id} style={{ padding: '10px 14px', borderRadius: 12, background: selectedTournament === 'open' ? '#173b63' : '#f4f7fa', fontSize: 15, fontWeight: 700, color: selectedTournament === 'open' ? '#fff' : '#0f1720' }}>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        </>
        ) : null}

      </div>
    </div>
  );
}
