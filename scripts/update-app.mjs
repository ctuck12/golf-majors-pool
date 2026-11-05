// Ships the app's screens to every installed copy through Capgo (no App Store review):
//   npm run update:app                       → build + upload to the "production" channel
//   npm run update:app -- --comment "text"   → with a note shown in the Capgo dashboard
// Phones download it in the background and switch to it the next time the app opens.
// Native changes (new plugins, icon, permissions) still need a new build from Xcode.
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Each update needs a unique version above the installed app's version (MARKETING_VERSION in
// Xcode, e.g. 1.0): use that plus a timestamp, e.g. 1.0.202611051432. Nothing is written to disk.
const pbxproj = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
const marketing = pbxproj.match(/MARKETING_VERSION = ([0-9.]+);/)?.[1] ?? '1.0';
const [major = '1', minor = '0'] = marketing.split('.');
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const bundle = `${major}.${minor}.${stamp}`;

const commentIndex = process.argv.indexOf('--comment');
const comment = commentIndex > -1 ? process.argv[commentIndex + 1] : undefined;

execSync('node scripts/build-mobile.mjs --no-sync', { stdio: 'inherit' });

// --delta: phones download only the files that changed since their current version, not the whole
// ~50 MB bundle (most of it is images that rarely change).
const args = ['capgo', 'bundle', 'upload', '--channel', 'production', '--bundle', bundle, '--delta'];
if (comment) args.push('--comment', comment);
console.log(`\nUploading ${bundle} to Capgo (channel: production)…`);
execFileSync('npx', args, { stdio: 'inherit' });
console.log(`\nDone. Phones get ${bundle} the next time the app is opened (sometimes the open after that).`);
