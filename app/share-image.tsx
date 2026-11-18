'use client';

import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

// Shareable graphics: a member's roster card and a standings image, drawn on a canvas in the
// app's navy and shared through the phone's share sheet (or saved). Every image carries the
// logo and golfmajorspool.com, so each share advertises the app.

const W = 1080;
const NAVY = '#0a1628';
const CARD = '#13233d';
const ACCENT = '#4fc3f7';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export type ShareRow = { left: string; label: string; sub?: string; right: string; highlight?: boolean };
export type ShareCardInput = { kicker: string; title: string; subtitle?: string; rows: ShareRow[]; footer?: string };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export async function drawShareCard(input: ShareCardInput): Promise<Blob> {
  const rowH = 104;
  const headerH = 470;
  const titleH = input.subtitle ? 190 : 140;
  const footerH = input.footer ? 210 : 150;
  const H = headerH + titleH + input.rows.length * (rowH + 14) + footerH;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  try {
    const logo = await loadImage('/email/logo-header.jpg');
    const lw = 960;
    ctx.drawImage(logo, (W - lw) / 2, 40, lw, (lw * logo.height) / logo.width);
  } catch {
    ctx.fillStyle = '#fff';
    ctx.font = `900 72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('GOLF MAJORS POOL', W / 2, 260);
  }

  let y = headerH;
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(input.kicker.toUpperCase(), W / 2, y);
  y += 72;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 60px ${FONT}`;
  ctx.fillText(fit(ctx, input.title, W - 120), W / 2, y);
  if (input.subtitle) {
    y += 56;
    ctx.fillStyle = '#b8c7d9';
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(fit(ctx, input.subtitle, W - 120), W / 2, y);
  }
  y = headerH + titleH;

  for (const row of input.rows) {
    roundRect(ctx, 60, y, W - 120, rowH, 22);
    ctx.fillStyle = row.highlight ? '#1d3a63' : CARD;
    ctx.fill();
    if (row.highlight) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(row.left, 92, y + 66);
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(fit(ctx, row.label, W - 520), 196, y + (row.sub ? 52 : 66));
    if (row.sub) {
      ctx.fillStyle = '#9fb3c8';
      ctx.font = `600 26px ${FONT}`;
      ctx.fillText(fit(ctx, row.sub, W - 520), 196, y + 86);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = ACCENT;
    ctx.font = `900 42px ${FONT}`;
    ctx.fillText(row.right, W - 92, y + 66);
    y += rowH + 14;
  }

  y += 40;
  ctx.textAlign = 'center';
  if (input.footer) {
    ctx.fillStyle = '#d6e2ee';
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(fit(ctx, input.footer, W - 120), W / 2, y + 10);
    y += 60;
  }
  ctx.fillStyle = ACCENT;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('Play along at golfmajorspool.com', W / 2, y + 30);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make the image.'))), 'image/png'));
}

// The preview: the image, Share (phone share sheet with the picture) and Save.
export function ShareImageModal({ input, fileName, onClose }: { input: ShareCardInput; fileName: string; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let made = '';
    drawShareCard(input)
      .then((b) => {
        if (cancelled) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not make the image.'));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // The card is drawn once when the preview opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: 'Golf Majors Pool ⛳ golfmajorspool.com' });
    } catch {
      // Cancelled.
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(9,20,34,0.82)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 100%)', maxHeight: 'calc(100svh - 32px - var(--safe-y))', overflowY: 'auto', background: '#fff', borderRadius: 20, padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0f1720' }}>Share</div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: '#eef2f6', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        {error ? <div style={{ color: '#a61b1b', fontSize: 14 }}>{error}</div> : null}
        {url ? <img src={url} alt="Share image" style={{ width: '100%', borderRadius: 12, display: 'block' }} /> : !error ? <div style={{ height: 300, display: 'grid', placeItems: 'center', color: '#5b6b79' }}>Making your image…</div> : null}
        {url ? (
          <div style={{ display: 'grid', gridTemplateColumns: canShareFile ? '1fr 1fr' : '1fr', gap: 8 }}>
            {canShareFile ? (
              <button type="button" onClick={() => void share()} style={{ border: 'none', borderRadius: 12, padding: '12px 14px', background: '#173b63', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Share2 size={17} /> Share
              </button>
            ) : null}
            <a href={url} download={fileName} style={{ borderRadius: 12, padding: '12px 14px', border: '1px solid #d7e0e8', color: '#0f1720', fontWeight: 800, fontSize: 15, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Download size={17} /> Save image
            </a>
          </div>
        ) : null}
        {url && !canShareFile ? <div style={{ fontSize: 12.5, color: '#6b7b88', textAlign: 'center' }}>On a phone you can also press and hold the image to save or share it.</div> : null}
      </div>
    </div>
  );
}
