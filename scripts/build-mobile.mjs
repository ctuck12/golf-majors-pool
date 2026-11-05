// Builds the iPhone app's screens as static files in out/, then copies them into the iOS project.
//   npm run build:mobile            → build + `cap sync ios`
//   npm run build:mobile -- --no-sync
import { execSync } from 'node:child_process';

const run = (command, env = {}) =>
  execSync(command, { stdio: 'inherit', env: { ...process.env, ...env } });

run('npx next build', { BUILD_TARGET: 'mobile' });

if (!process.argv.includes('--no-sync')) {
  run('npx cap sync ios');
}
