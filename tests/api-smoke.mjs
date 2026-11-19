// API smoke tests: run against a fresh app (`next start`) backed by an empty Postgres + Redis.
// Used by .github/workflows/ci.yml; locally: BASE_URL=http://localhost:3000 node tests/api-smoke.mjs
//
// Covers the flows that would hurt most if they broke: sign-up and sign-in, leagues and join codes,
// one commissioner per league, Venmo and entry fees, saving picks, leaving a league, Past Results
// per league, admin-only tools and the sign-in attempt limit. (Email isn't configured in CI, so new
// accounts are confirmed straight away.)
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'ctuck12@gmail.com';
const jar = {};
let passed = 0;

async function call(who, path, method = 'GET', body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jar[who] ? { Cookie: jar[who] } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const cookie = res.headers.get('set-cookie');
  if (cookie) jar[who] = cookie.split(';')[0];
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function check(name, fn) {
  await fn();
  passed++;
  console.log(`ok  ${name}`);
}

const unique = Date.now().toString(36);
const email = (who) => `${who}-${unique}@example.com`;

await check('admin signs up and creates a free league', async () => {
  let r = await call('admin', '/api/auth/register', 'POST', { firstName: 'App', lastName: 'Admin', email: ADMIN_EMAIL, password: 'password123' });
  if (r.status !== 200) r = await call('admin', '/api/auth/login', 'POST', { email: ADMIN_EMAIL, password: 'password123' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('admin', '/api/leagues', 'POST', { name: `Smoke League ${unique}` });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.pool.role, 'commissioner');
  jar.code = r.json.pool.joinCode;
  jar.leagueId = r.json.pool.id;
});

await check('sign-up needs first and last name; joining by code works', async () => {
  let r = await call('x', '/api/auth/register', 'POST', { firstName: 'Only', lastName: '', email: email('x'), password: 'password123' });
  assert.equal(r.status, 400);
  r = await call('bob', '/api/auth/register', 'POST', { firstName: 'Bob', lastName: 'Birdie', email: email('bob'), password: 'password123', joinCode: jar.code });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.user.displayName, 'Bob Birdie');
  assert.equal(r.json.pool.id, jar.leagueId);
  assert.equal(r.json.pool.role, 'member');
  jar.bobId = r.json.user.id;
});

await check('members are kept out of commissioner and admin tools', async () => {
  assert.equal((await call('bob', '/api/commissioner/entry-fees', 'PATCH', { fees: { masters: 5 } })).status, 403);
  assert.equal((await call('bob', '/api/admin/leagues')).status, 401);
  assert.equal((await call('bob', '/api/commissioner/salary-overrides')).status, 403);
});

await check('Venmo and entry fees', async () => {
  let r = await call('admin', '/api/account/venmo', 'PATCH', { venmo: '@smoke-admin' });
  assert.equal(r.json.user.venmo, 'smoke-admin');
  r = await call('admin', '/api/commissioner/entry-fees', 'PATCH', { fees: { masters: 25 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('bob', '/api/auth/session');
  assert.equal(r.json.pool.entryFees.masters, 25);
  assert.equal(r.json.pool.venmo.handle, 'smoke-admin');
  r = await call('bob', '/api/account/venmo', 'PATCH', { declined: true });
  assert.equal(r.json.user.venmoDeclined, true);
});

await check('picks save for the current season', async () => {
  const r = await call('bob', '/api/roster', 'POST', { tournamentId: 'open', roster: [1, 2, 3, 4, 5, 6], tieBreak: 280 });
  if (r.status === 403) return; // the event is in progress or locked right now
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.user.rosters.open, [1, 2, 3, 4, 5, 6]);
});

await check('payout plan: checked, saved, and works out the amounts', async () => {
  let r = await call('admin', '/api/commissioner/payout-plan', 'PATCH', { plan: { places: [{ mode: 'percent', value: 60 }, { mode: 'percent', value: 30 }], roundTo: 5 } });
  assert.equal(r.status, 400, 'percentages must add up to 100 or leave "the rest"');
  assert.equal((await call('bob', '/api/commissioner/payout-plan', 'PATCH', { plan: null })).status, 403);
  const plan = { places: [{ mode: 'percent', value: 67.5 }, { mode: 'rest', value: 0 }, { mode: 'fee', value: 2 }], roundTo: 5 };
  r = await call('admin', '/api/commissioner/payout-plan', 'PATCH', { plan });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.pool.payoutPlan, plan);
  r = await call('admin', '/api/commissioner/entry-fees', 'PATCH', { fees: { masters: 25, open: 30 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('admin', '/api/auth/session');
  const info = r.json.pool.payoutInfo.open;
  assert.equal(info.pot, info.entries * 30);
  if (info.entries > 0) assert.equal(r.json.pool.payouts.open.third, Math.min(60, info.pot));
  // Exact amounts for one tournament override the plan, and can be cleared.
  r = await call('admin', '/api/commissioner/payouts', 'PATCH', { tournamentId: 'open', first: 100, second: 50, third: 0 });
  assert.equal(r.json.pool.payouts.open.first, 100);
  assert.equal(r.json.pool.payoutInfo.open.manual, true);
  r = await call('admin', '/api/commissioner/payouts', 'PATCH', { tournamentId: 'open', usePlan: true });
  assert.equal(r.json.pool.payoutInfo.open.manual, false);
  r = await call('admin', '/api/commissioner/entry-fees', 'PATCH', { paymentNote: 'Cash or Zelle' });
  assert.equal(r.json.pool.paymentNote, 'Cash or Zelle');
});

await check('entry fee tracking: member says paid, commissioner confirms', async () => {
  let r = await call('bob', '/api/entry-payments', 'POST', { tournamentId: 'masters', paid: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.pool.entryPayments.masters[jar.bobId], 'reported');
  r = await call('admin', '/api/auth/session');
  assert.equal(r.json.pool.entryPayments.masters[jar.bobId], 'reported');
  r = await call('admin', '/api/commissioner/entry-payments', 'PATCH', { tournamentId: 'masters', userId: jar.bobId, status: 'confirmed' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  // Taking back "I paid" doesn't undo the commissioner's confirmation.
  r = await call('bob', '/api/entry-payments', 'POST', { tournamentId: 'masters', paid: false });
  assert.equal(r.json.pool.entryPayments.masters[jar.bobId], 'confirmed');
  assert.equal((await call('bob', '/api/commissioner/entry-payments', 'PATCH', { tournamentId: 'masters', userId: jar.bobId, status: null })).status, 403);
  assert.equal((await call('bob', '/api/commissioner/reminders', 'POST', { tournamentId: 'masters', kind: 'pay' })).status, 403);
});

await check('push notification tokens register and unregister', async () => {
  const token = 'ab'.repeat(32);
  assert.equal((await call('bob', '/api/push/register', 'POST', { token: 'not-a-token' })).status, 400);
  assert.equal((await call('bob', '/api/push/register', 'POST', { token, platform: 'ios' })).status, 200);
  assert.equal((await call('bob', '/api/push/register', 'DELETE', { token })).status, 200);
  assert.equal((await call('nobody', '/api/push/register', 'POST', { token })).status, 401);
});

await check('one commissioner: hand over and back', async () => {
  let r = await call('admin', `/api/commissioner/members/${jar.bobId}`, 'PATCH', { role: 'commissioner' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('admin', '/api/auth/session');
  assert.equal(r.json.pool.role, 'member');
  assert.equal(r.json.pool.commissioners.length, 1);
  // Only the app admin opens picks and locks lineups (for every league at once).
  assert.equal((await call('bob', '/api/commissioner/lineup-lock', 'PATCH', { tournamentId: 'masters', picksOpen: true })).status, 403);
  assert.equal((await call('bob', '/api/commissioner/lineup-lock', 'PATCH', { tournamentId: 'masters', locked: true })).status, 403);
  const opened = await call('admin', '/api/commissioner/lineup-lock', 'PATCH', { tournamentId: 'masters', picksOpen: true });
  assert.equal(opened.status, 200, JSON.stringify(opened.json));
  assert.equal(opened.json.pool.picksOpen.masters, true);
  const closed = await call('admin', '/api/commissioner/lineup-lock', 'PATCH', { tournamentId: 'masters', picksOpen: false });
  assert.equal(closed.json.pool.picksOpen.masters, false);
  r = await call('bob', `/api/commissioner/members/${r.json.user.id}`, 'PATCH', { role: 'commissioner' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
});

await check('Past Results are kept per league', async () => {
  const standings = [{ place: 1, name: 'Bob Birdie', points: 100, holesRemaining: 0, tieBreak: 280, golfers: [] }];
  let r = await call('bob', '/api/standings-archive', 'POST', { tournamentId: 'masters', year: 2026, standings });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('bob', '/api/standings-archive?tournamentId=masters&year=2026');
  assert.equal(r.json.available, true);
  r = await call('carl', '/api/auth/register', 'POST', { firstName: 'Carl', lastName: 'Chip', email: email('carl'), password: 'password123' });
  assert.equal(r.status, 200);
  r = await call('carl', '/api/standings-archive?tournamentId=masters&year=2026');
  assert.notEqual(r.json?.available, true, "another league's results must not show");
});

await check('season championship and league history', async () => {
  const plan = { places: [{ mode: 'percent', value: 70 }, { mode: 'rest', value: 0 }], roundTo: 5 };
  let r = await call('admin', '/api/commissioner/season', 'PATCH', { fee: 20, plan });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.pool.seasonFee, 20);
  assert.deepEqual(r.json.pool.seasonPayoutPlan, plan);
  assert.equal((await call('bob', '/api/commissioner/season', 'PATCH', { fee: null, plan: null })).status, 403);
  r = await call('bob', '/api/standings-archive', 'POST', { tournamentId: 'pga', year: 2026, standings: [{ id: jar.bobId, place: 1, name: 'Bob Birdie', points: 90, holesRemaining: 0, tieBreak: 280, golfers: [] }] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('bob', '/api/league-history');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const pga = r.json.events.find((e) => e.tournamentId === 'pga' && e.season === 2026);
  assert.equal(pga.standings[0].id, jar.bobId, 'member ids are kept in Past Results');
  assert.ok(r.json.events.some((e) => e.tournamentId === 'masters'));
  assert.equal(pga.standings[0].golfers, undefined, 'history leaves out golfer detail');
});

await check('a member can leave; the commissioner must hand over first', async () => {
  let r = await call('admin', '/api/leagues/leave', 'POST', { leagueId: jar.leagueId });
  assert.equal(r.status, 400);
  r = await call('bob', '/api/leagues/leave', 'POST', { leagueId: jar.leagueId });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call('bob', '/api/auth/session');
  assert.equal(r.json.pool, null);
});

await check('failed sign-ins are limited', async () => {
  const target = email('bob');
  let last;
  for (let i = 0; i < 11; i++) last = await call('guess', '/api/auth/login', 'POST', { email: target, password: `wrong-${i}` });
  assert.equal(last.status, 429);
});

if (CRON_SECRET) {
  await check('the nightly Redis backup runs', async () => {
    const r = await call('cron', '/api/cron/backup-redis', 'GET', undefined, { Authorization: `Bearer ${CRON_SECRET}` });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  });
}

console.log(`\n${passed} checks passed`);
