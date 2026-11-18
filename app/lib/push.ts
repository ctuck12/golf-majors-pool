import http2 from 'node:http2';
import { sign } from 'node:crypto';
import redis from './redis';
import { deletePushTokens, pushTokensFor } from './pool-store';

// iPhone push notifications through Apple's push service (APNs), using a token-based (.p8) key.
// Configured by environment variables; until they're set, sending is skipped quietly:
//   APNS_KEY_ID       the key's ID (Apple Developer → Keys)
//   APNS_TEAM_ID      your Team ID
//   APNS_PRIVATE_KEY  the .p8 file's contents (newlines may be written as \n)
//   APNS_BUNDLE_ID    the app's bundle ID (default com.golfmajorspool.app)
//   APNS_ENV          "production" (TestFlight / App Store, the default) or "sandbox" (Xcode builds)

export type PushMessage = { title: string; body: string; data?: Record<string, string> };

export function isPushConfigured() {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);
}

let jwtCache: { token: string; at: number } | null = null;

// Apple accepts a provider token for up to an hour; it's refreshed every 50 minutes.
export function providerToken() {
  if (jwtCache && Date.now() - jwtCache.at < 50 * 60 * 1000) return jwtCache.token;
  const b64 = (value: object | Buffer) => (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString('base64url');
  const header = b64({ alg: 'ES256', kid: process.env.APNS_KEY_ID });
  const claims = b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const key = (process.env.APNS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  const token = `${header}.${claims}.${b64(signature)}`;
  jwtCache = { token, at: Date.now() };
  return token;
}

// Sends one message to device tokens. Returns how many were delivered; tokens Apple reports as
// no longer valid are removed.
export async function sendPushToTokens(tokens: string[], message: PushMessage): Promise<number> {
  if (!isPushConfigured() || tokens.length === 0) return 0;
  const host = process.env.APNS_ENV === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const topic = process.env.APNS_BUNDLE_ID || 'com.golfmajorspool.app';
  const payload = JSON.stringify({ aps: { alert: { title: message.title, body: message.body }, sound: 'default' }, ...(message.data ?? {}) });
  const client = http2.connect(host);
  client.on('error', () => {});
  const dead: string[] = [];
  let delivered = 0;
  try {
    const auth = `bearer ${providerToken()}`;
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ':method': 'POST',
              ':path': `/3/device/${token}`,
              authorization: auth,
              'apns-topic': topic,
              'apns-push-type': 'alert',
              'apns-priority': '10',
              'content-type': 'application/json',
            });
            let status = 0;
            let body = '';
            req.setEncoding('utf8');
            req.on('response', (headers) => { status = Number(headers[':status']); });
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              if (status === 200) delivered += 1;
              else if (status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(body)) dead.push(token);
              resolve();
            });
            req.on('error', () => resolve());
            req.setTimeout(10000, () => { req.close(); resolve(); });
            req.end(payload);
          }),
      ),
    );
  } finally {
    client.close();
  }
  if (dead.length) await deletePushTokens(dead).catch(() => {});
  return delivered;
}

export async function sendPushToUsers(userIds: string[], message: PushMessage): Promise<number> {
  if (!isPushConfigured() || userIds.length === 0) return 0;
  const tokens = await pushTokensFor([...new Set(userIds)]);
  return sendPushToTokens(tokens, message);
}

// Sends at most once per key (e.g. one "picks open" per league and event).
export async function sendPushOnce(key: string, ttlSeconds: number, userIds: string[], message: PushMessage) {
  if (!isPushConfigured() || userIds.length === 0) return 0;
  const first = await redis.set(`push-sent:${key}`, '1', 'EX', ttlSeconds, 'NX').catch(() => 'OK');
  if (first !== 'OK') return 0;
  return sendPushToUsers(userIds, message);
}
