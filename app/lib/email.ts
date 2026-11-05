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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
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
        <div style="background:#0a1628;border-radius:16px;padding:12px 16px;margin:0 0 24px;text-align:center">
          <img src="${appBaseUrl()}/email/logo-header.jpg" width="400" height="171" alt="Golf Majors Pool" style="display:block;width:100%;max-width:400px;height:auto;margin:0 auto;border:0">
        </div>
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
