// Country lookups for player flags: the 3-letter codes golf feeds use (PGA Tour's countryFlag,
// Olympic-style: USA, ENG, RSA, KOR…) and plain country names (ESPN's flag alt text) mapped to
// the flag image codes in /public/flags (ISO 3166-1 alpha-2, plus gb-eng/gb-sct/gb-wls/gb-nir).

export const CODE3_TO_FLAG: Record<string, string> = {
  USA: 'us', ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls', NIR: 'gb-nir', GBR: 'gb', IRL: 'ie',
  AUS: 'au', NZL: 'nz', RSA: 'za', ZAF: 'za', CAN: 'ca', MEX: 'mx', PUR: 'pr', PRI: 'pr',
  KOR: 'kr', JPN: 'jp', CHN: 'cn', TPE: 'tw', TWN: 'tw', HKG: 'hk', IND: 'in', THA: 'th',
  PHI: 'ph', PHL: 'ph', MAS: 'my', MYS: 'my', SGP: 'sg', SIN: 'sg', INA: 'id', IDN: 'id',
  VIE: 'vn', VNM: 'vn', BAN: 'bd', BGD: 'bd', PAK: 'pk', SRI: 'lk', LKA: 'lk', FIJ: 'fj', FJI: 'fj',
  SWE: 'se', NOR: 'no', DEN: 'dk', DNK: 'dk', FIN: 'fi', ISL: 'is', GER: 'de', DEU: 'de',
  ESP: 'es', FRA: 'fr', ITA: 'it', POR: 'pt', PRT: 'pt', NED: 'nl', NLD: 'nl', BEL: 'be',
  AUT: 'at', SUI: 'ch', CHE: 'ch', POL: 'pl', CZE: 'cz', SVK: 'sk', SLO: 'si', SVN: 'si',
  CRO: 'hr', HRV: 'hr', HUN: 'hu', ROU: 'ro', BUL: 'bg', BGR: 'bg', GRE: 'gr', GRC: 'gr',
  TUR: 'tr', RUS: 'ru', UKR: 'ua', LTU: 'lt', LAT: 'lv', LVA: 'lv', EST: 'ee', LUX: 'lu',
  MON: 'mc', MCO: 'mc', AND: 'ad', ISR: 'il', UAE: 'ae', ARE: 'ae', KSA: 'sa', SAU: 'sa',
  EGY: 'eg', MAR: 'ma', ZIM: 'zw', ZWE: 'zw', ZAM: 'zm', ZMB: 'zm', NAM: 'na', KEN: 'ke',
  ARG: 'ar', CHI: 'cl', CHL: 'cl', COL: 'co', VEN: 've', PAR: 'py', PRY: 'py', PER: 'pe',
  ECU: 'ec', URU: 'uy', URY: 'uy', BRA: 'br', DOM: 'do', CRC: 'cr', CRI: 'cr', GUA: 'gt',
  GTM: 'gt', PAN: 'pa', JAM: 'jm', BAH: 'bs', BHS: 'bs', BAR: 'bb', BRB: 'bb', TTO: 'tt',
  BER: 'bm', BMU: 'bm', CAY: 'ky', CYM: 'ky',
};

// The 3-letter label shown next to a flag, by flag code (first code listed above wins).
export const FLAG_TO_CODE3: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [code3, flag] of Object.entries(CODE3_TO_FLAG)) if (!(flag in m)) m[flag] = code3;
  return m;
})();

const NAME_TO_FLAG: Record<string, string> = {
  'united states': 'us', 'united states of america': 'us', usa: 'us', 'u.s.a.': 'us', america: 'us',
  england: 'gb-eng', scotland: 'gb-sct', wales: 'gb-wls', 'northern ireland': 'gb-nir',
  'great britain': 'gb', 'united kingdom': 'gb', ireland: 'ie', 'republic of ireland': 'ie',
  australia: 'au', 'new zealand': 'nz', 'south africa': 'za', canada: 'ca', mexico: 'mx',
  'puerto rico': 'pr', 'south korea': 'kr', korea: 'kr', 'republic of korea': 'kr', 'korea, republic of': 'kr',
  japan: 'jp', china: 'cn', "people's republic of china": 'cn', taiwan: 'tw', 'chinese taipei': 'tw',
  'hong kong': 'hk', india: 'in', thailand: 'th', philippines: 'ph', malaysia: 'my', singapore: 'sg',
  indonesia: 'id', vietnam: 'vn', bangladesh: 'bd', pakistan: 'pk', 'sri lanka': 'lk', fiji: 'fj',
  sweden: 'se', norway: 'no', denmark: 'dk', finland: 'fi', iceland: 'is', germany: 'de',
  spain: 'es', france: 'fr', italy: 'it', portugal: 'pt', netherlands: 'nl', 'the netherlands': 'nl',
  holland: 'nl', belgium: 'be', austria: 'at', switzerland: 'ch', poland: 'pl', 'czech republic': 'cz',
  czechia: 'cz', slovakia: 'sk', slovenia: 'si', croatia: 'hr', hungary: 'hu', romania: 'ro',
  bulgaria: 'bg', greece: 'gr', turkey: 'tr', 'türkiye': 'tr', russia: 'ru', ukraine: 'ua',
  lithuania: 'lt', latvia: 'lv', estonia: 'ee', luxembourg: 'lu', monaco: 'mc', andorra: 'ad',
  israel: 'il', 'united arab emirates': 'ae', 'saudi arabia': 'sa', egypt: 'eg', morocco: 'ma',
  zimbabwe: 'zw', zambia: 'zm', namibia: 'na', kenya: 'ke', argentina: 'ar', chile: 'cl',
  colombia: 'co', venezuela: 've', paraguay: 'py', peru: 'pe', ecuador: 'ec', uruguay: 'uy',
  brazil: 'br', 'dominican republic': 'do', 'costa rica': 'cr', guatemala: 'gt', panama: 'pa',
  jamaica: 'jm', bahamas: 'bs', 'the bahamas': 'bs', barbados: 'bb', 'trinidad and tobago': 'tt',
  bermuda: 'bm', 'cayman islands': 'ky',
};

// A feed's country (a 3-letter code or a country name) as a flag code; '' when unknown.
export function flagCodeForCountry(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  const up = v.toUpperCase();
  if (CODE3_TO_FLAG[up]) return CODE3_TO_FLAG[up];
  return NAME_TO_FLAG[v.toLowerCase()] ?? '';
}
