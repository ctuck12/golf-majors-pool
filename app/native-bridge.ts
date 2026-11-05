import { Capacitor } from '@capacitor/core';

// Runs only inside the iPhone app (Capacitor); on the website it does nothing.
//
// The app's screens load from inside the app, so every `fetch('/api/...')` in the UI is sent to
// the live site instead, signed in with the session token the API hands the app at login (the
// website's cookie doesn't reach the app). The token is kept on the device until sign-out.

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'https://www.golfmajorspool.com';
const TOKEN_KEY = 'gmp-native-session-token';

export const isNativeApp = typeof window !== 'undefined' && Capacitor.isNativePlatform();

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable: the user just signs in again next launch.
  }
}

function installApiBridge() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('/api/')) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('X-Client-Platform', 'native');
    const token = readToken();
    if (token) headers.set('X-Session-Token', token);

    const response = await originalFetch(`${API_ORIGIN}${url}`, { ...init, headers, credentials: 'omit' });

    const path = url.split('?')[0];
    if (response.ok && /^\/api\/auth\/(login|register|reset-password)$/.test(path)) {
      // Save the new session before the UI makes its next request.
      const body = (await response.clone().json().catch(() => null)) as { sessionToken?: string } | null;
      if (body?.sessionToken) writeToken(body.sessionToken);
    } else if (path === '/api/auth/logout' || (response.ok && path === '/api/account' && init?.method === 'DELETE')) {
      writeToken(null);
    }

    return response;
  };
}

if (isNativeApp) {
  installApiBridge();
  // Room for the notch and home bar (see .native-app in globals.css).
  document.documentElement.classList.add('native-app');
  // Tell Capgo this build started fine, so a live update that breaks the app gets rolled back.
  void import('@capgo/capacitor-updater')
    .then(({ CapacitorUpdater }) => CapacitorUpdater.notifyAppReady())
    .catch(() => {});
}
