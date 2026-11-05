import type { CapacitorConfig } from '@capacitor/cli';

// iPhone app shell. Its screens come from `npm run build:mobile` (out/); data comes from the live
// site's API (see app/native-bridge.ts). Capgo ships screen updates without an App Store review.
const config: CapacitorConfig = {
  appId: 'com.golfmajorspool.app',
  appName: 'Golf Majors Pool',
  webDir: 'out',
  backgroundColor: '#edf3fb',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
    },
  },
};

export default config;
