// Transactional email through Resend's HTTP API (no SDK needed). Configured by two env vars:
// RESEND_API_KEY and EMAIL_FROM (e.g. "Golf Majors Pool <no-reply@yourdomain.com>").

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// Base URL for links in emails. Never taken from the request's Host header, which a caller controls.
export function appBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:3000';
}

// The logo at the top of every email: the image alone, its rounded corners built in. (A dark box
// around it turned into a pale frame in Gmail's dark mode, which lightens dark backgrounds.)
function emailHeader() {
  return `<img src="${appBaseUrl()}/email/logo-header-rounded.png" width="480" height="173" alt="Golf Majors Pool" style="display:block;width:100%;max-width:480px;height:auto;margin:0 auto 28px;border:0;outline:none;text-decoration:none">`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// Made-up accounts (the Demo League's sample members use @example.com) never get real email.
const isPlaceholderAddress = (address: string) => /@example\.(com|org|net)$/i.test(address.trim());

async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
  const to = input.to.split(',').map((a) => a.trim()).filter((a) => a && !isPlaceholderAddress(a));
  if (to.length === 0) return;
  input = { ...input, to: to.join(',') };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...input }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}

export async function sendPasswordResetEmail(input: { to: string; displayName: string; token: string }) {
  const link = `${appBaseUrl()}/?reset=${encodeURIComponent(input.token)}`;
  const name = escapeHtml(input.displayName);

  await sendEmail({
    to: input.to,
    subject: 'Reset your Golf Majors Pool password',
    text: [
      `Hi ${input.displayName},`,
      '',
      'Use this link to set a new password for Golf Majors Pool:',
      link,
      '',
      "The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.",
    ].join('\n'),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1720">
        ${emailHeader()}
        <h2 style="margin:0 0 16px">Reset your password</h2>
        <p>Hi ${name},</p>
        <p>Tap the button below to set a new password for Golf Majors Pool.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#315f95;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;display:inline-block">Set a new password</a>
        </p>
        <p style="font-size:13px;color:#5b6b79">The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>
      </div>`,
  });
}

// The 6-digit code a new account confirms its email with.
export async function sendVerificationCodeEmail(input: { to: string; displayName: string; code: string }) {
  const name = escapeHtml(input.displayName);
  await sendEmail({
    to: input.to,
    subject: `${input.code} is your Golf Majors Pool code`,
    text: [
      `Hi ${input.displayName},`,
      '',
      `Your Golf Majors Pool confirmation code is ${input.code}.`,
      '',
      "Enter it in the app to confirm your email. It expires in 30 minutes. If you didn't sign up, you can ignore this email.",
    ].join('\n'),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1720">
        ${emailHeader()}
        <h2 style="margin:0 0 16px">Confirm your email</h2>
        <p>Hi ${name},</p>
        <p>Enter this code in the app to confirm your email:</p>
        <p style="margin:20px 0;font-size:34px;font-weight:800;letter-spacing:8px;color:#173b63">${input.code}</p>
        <p style="font-size:13px;color:#5b6b79">It expires in 30 minutes. If you didn't sign up for Golf Majors Pool, you can ignore this email.</p>
      </div>`,
  });
}

// A plain operational alert to the app admins (live scoring down, then recovered).
export async function sendAdminAlertEmail(input: { to: string[]; subject: string; lines: string[] }) {
  await sendEmail({
    to: input.to.join(','),
    subject: input.subject,
    text: input.lines.join('\n'),
    html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;color:#0f1720">${input.lines
      .map((line) => `<p style="margin:0 0 10px">${escapeHtml(line)}</p>`)
      .join('')}</div>`,
  });
}

// A commissioner's nudge to their league: make your picks, or pay your entry fee.
export async function sendReminderEmail(input: {
  to: string;
  displayName: string;
  kind: 'pay' | 'picks';
  leagueName: string;
  tournamentName: string;
  entryFee: number;
  commissionerName: string;
}) {
  const first = input.displayName.split(' ')[0] || input.displayName;
  const fee = input.entryFee > 0 ? `$${Number.isInteger(input.entryFee) ? input.entryFee : input.entryFee.toFixed(2)} ` : '';
  const subject = input.kind === 'picks' ? `Your ${input.tournamentName} picks are due` : `Reminder: your ${input.tournamentName} entry fee`;
  const lines =
    input.kind === 'picks'
      ? [
          `Hi ${first},`,
          `Picks are open for ${input.tournamentName} in ${input.leagueName}, and you haven't made yours yet. Pick your 6 golfers in the app before the first tee time on Thursday.`,
        ]
      : [
          `Hi ${first},`,
          `Your ${input.tournamentName} picks are in for ${input.leagueName}, but your ${fee}entry fee hasn't been marked as paid yet. Open the app and pay from your entry, or tap "I already paid" if you have.`,
        ];
  const footer = `Sent by ${input.commissionerName}, your commissioner.`;
  const link = appBaseUrl();
  await sendEmail({
    to: input.to,
    subject,
    text: [...lines, link, footer].join('\n\n'),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1720">
        ${emailHeader()}
        ${lines.map((line) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(line)}</p>`).join('')}
        <p style="margin:24px 0">
          <a href="${link}" style="background:#315f95;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;display:inline-block">${input.kind === 'picks' ? 'Make my picks' : 'Open Golf Majors Pool'}</a>
        </p>
        <p style="font-size:13px;color:#5b6b79">${escapeHtml(footer)}</p>
      </div>`,
  });
}

// A commissioner whose league hasn't been renewed for the new season: members can't make picks
// or join until they do.
export async function sendRenewalReminderEmail(input: {
  to: string;
  displayName: string;
  leagueName: string;
  season: number;
  nextEventName: string | null;
  nextLockText: string | null;
  urgent: boolean;
}) {
  const first = input.displayName.split(' ')[0] || input.displayName;
  const subject = input.urgent && input.nextEventName
    ? `${input.leagueName} can't make ${input.nextEventName} picks yet`
    : `Renew ${input.leagueName} for the ${input.season} season`;
  const lines = [
    `Hi ${first},`,
    `${input.leagueName} needs its ${input.season} season pass. Until you renew it, your members can't make picks or join the league.`,
    input.nextEventName && input.nextLockText
      ? `${input.nextEventName} picks lock ${input.nextLockText}. Renewing takes a minute in the app: open the Admin tab and tap Renew.`
      : 'Renewing takes a minute in the app: open the Admin tab and tap Renew.',
    'One season pass covers every major left this season. Nothing renews automatically.',
  ];
  const link = appBaseUrl();
  await sendEmail({
    to: input.to,
    subject,
    text: [...lines, link].join('\n\n'),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f1720">
        ${emailHeader()}
        ${lines.map((line) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(line)}</p>`).join('')}
        <p style="margin:24px 0">
          <a href="${link}" style="background:#315f95;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px;display:inline-block">Renew ${escapeHtml(input.leagueName)}</a>
        </p>
      </div>`,
  });
}
