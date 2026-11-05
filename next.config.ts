import type { NextConfig } from "next";

// `npm run build:mobile` sets BUILD_TARGET=mobile to build the iPhone app's screens as static files
// (out/). Only .tsx files count as routes there, which leaves out the API route handlers and
// proxy.ts (all .ts); the app calls the live site's API instead.
const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

const nextConfig: NextConfig = isMobileBuild
  ? {
      output: 'export',
      // The exported app goes to out/ (Capacitor's webDir) and never disturbs the website build in .next/.
      distDir: 'out',
      pageExtensions: ['tsx'],
      images: { unoptimized: true },
      env: {
        NEXT_PUBLIC_API_ORIGIN: process.env.NEXT_PUBLIC_API_ORIGIN ?? 'https://www.golfmajorspool.com',
      },
    }
  : {
      async headers() {
        return [
          {
            source: '/',
            headers: [
              {
                key: 'Cache-Control',
                value: 'no-store',
              },
            ],
          },
          {
            // The iPhone app calls the API from its own origin. No cookies cross origins (the app
            // signs in with a header token), so allowing any origin exposes nothing extra.
            source: '/api/:path*',
            headers: [
              { key: 'Access-Control-Allow-Origin', value: '*' },
              { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Session-Token, X-Client-Platform' },
              { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, PUT, DELETE, OPTIONS' },
            ],
          },
        ];
      },
    };

export default nextConfig;
