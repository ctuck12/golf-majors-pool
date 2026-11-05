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
  // The iPhone app build draws behind the notch (globals.css pads .native-app back into the safe
  // area) and keeps a fixed zoom, so tapping a text box never zooms the screen like a web page.
  // The website keeps the defaults.
  ...(process.env.BUILD_TARGET === 'mobile'
    ? { viewportFit: 'cover' as const, maximumScale: 1, userScalable: false }
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
