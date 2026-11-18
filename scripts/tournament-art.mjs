// The tournament-logo switch. The app shows the tournaments' logos from public/. A backup set with
// the SAME file names, pixel sizes and formats lives in public/tournament-art-alt/. Setting
// TOURNAMENT_ART=alternate when building copies the backup set over the originals for that build
// only (nothing is committed), so every tab, header and card keeps its size, on the website and in
// the app alike.
//
//   Website: Vercel → Settings → Environment Variables → TOURNAMENT_ART = alternate → Redeploy.
//            (Delete the variable and redeploy to go back.)
//   iPhone:  TOURNAMENT_ART=alternate npm run update:app   (or npm run build:mobile for Xcode)
//
// Runs before every `npm run build` (prebuild) and from scripts/build-mobile.mjs. Without the
// variable it does nothing. To replace the backup art, drop new files into
// public/tournament-art-alt/ under the same names, at the same pixel sizes.
import { copyFileSync, existsSync } from 'node:fs';
import { imageSize } from './image-size.mjs';

export const TOURNAMENT_ART_FILES = [
  'knockout-masters.png', 'knockout-open.png', 'knockout-pga.png', 'knockout-players.png', 'knockout-us-open.png',
  'masters-heading-logo.png', 'masters-map-logo.png', 'masters-tab-logo.png',
  'open-o-logo.png', 'open-tab-logo.png',
  'pga-frisco-2027-logo.png', 'pga-seal-gold.png', 'pga-tab-logo.png',
  'players-golfer-logo.png', 'players-tab-logo.webp', 'players-trophy.png',
  'the-masters-card-logo.png', 'the-open-card-logo.png', 'the-players-championship-logo.png', 'tpc.webp',
  'us-open-pebble-beach-2027-logo.png', 'us-open-tab-logo.png', 'us-open-trophy-logo.png',
];

export function applyTournamentArt() {
  const mode = process.env.TOURNAMENT_ART ?? 'official';
  if (mode !== 'alternate') return;
  const problems = [];
  for (const file of TOURNAMENT_ART_FILES) {
    const from = `public/tournament-art-alt/${file}`;
    const to = `public/${file}`;
    if (!existsSync(from)) { problems.push(`missing backup: ${from}`); continue; }
    const a = imageSize(from);
    const b = imageSize(to);
    if (a && b && (a.width !== b.width || a.height !== b.height)) {
      problems.push(`${file}: backup is ${a.width}×${a.height}, original is ${b.width}×${b.height}`);
    }
  }
  if (problems.length) {
    // Stop the build rather than ship logos that would change size or go missing.
    console.error(`Tournament art switch: not applied.\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  for (const file of TOURNAMENT_ART_FILES) copyFileSync(`public/tournament-art-alt/${file}`, `public/${file}`);
  console.log(`Tournament art switch: using the backup set (${TOURNAMENT_ART_FILES.length} images).`);
}

if (import.meta.url === `file://${process.argv[1]}`) applyTournamentArt();
