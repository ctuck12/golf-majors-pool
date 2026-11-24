// Builds the iPhone app's screens as static files in out/, then copies them into the iOS project.
//   npm run build:mobile            → build + `cap sync ios`
//   npm run build:mobile -- --no-sync
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const run = (command, env = {}) =>
  execSync(command, { stdio: 'inherit', env: { ...process.env, ...env } });

run('npx next build', { BUILD_TARGET: 'mobile' });

// Leave out of the app bundle any image in public/ that no screen uses (old logo versions and the
// like stay on the website, where old emails and links may still point at them). Every phone
// downloads the bundle, so this keeps updates small. Folders whose files are picked by name at
// run time (flags, tournament lettering, player photos, email art) are always kept.
const KEEP_DIRS = ['flags', 'tab-wordmarks', 'player-photos', 'email', '_next'];
const SOURCE_DIRS = ['app', 'scripts'];
const sourceText = (() => {
  let text = readFileSync('capacitor.config.ts', 'utf8');
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|mjs|css|json)$/.test(name)) text += readFileSync(path, 'utf8');
    }
  };
  SOURCE_DIRS.forEach(walk);
  return text;
})();
let pruned = 0;
let prunedBytes = 0;
for (const name of readdirSync('public')) {
  const path = join('out', name);
  if (KEEP_DIRS.includes(name) || statSync(join('public', name)).isDirectory()) continue;
  if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(name) || sourceText.includes(basename(name))) continue;
  try {
    prunedBytes += statSync(path).size;
    rmSync(path);
    pruned++;
  } catch {
    // not in out/
  }
}
console.log(`Left ${pruned} unused images (${(prunedBytes / 1048576).toFixed(1)} MB) out of the app bundle.`);

if (!process.argv.includes('--no-sync')) {
  run('npx cap sync ios');
}
