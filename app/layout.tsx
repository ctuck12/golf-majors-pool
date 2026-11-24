import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Golf Majors Pool',
  description: 'Season-long majors golf pool',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Golf Majors Pool',
  },
  icons: {
    icon: [
      { url: '/golf-circle-icon.png', type: 'image/png' },
    ],
    shortcut: '/golf-circle-icon.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Tapping a text box never zooms the page. The app is drawn slightly scaled down on phones
  // (globals.css), which makes iPhone Safari zoom into inputs and push the right side off screen;
  // maximum-scale stops that auto-zoom. On the website people can still pinch-zoom (iOS ignores the
  // limit for pinching); the iPhone app build also turns pinch-zoom off and draws behind the notch
  // (globals.css pads .native-app back into the safe area).
  maximumScale: 1,
  ...(process.env.BUILD_TARGET === 'mobile'
    ? { viewportFit: 'cover' as const, userScalable: false }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
