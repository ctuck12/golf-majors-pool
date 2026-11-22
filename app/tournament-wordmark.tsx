import type { CSSProperties } from 'react';

// Each major's name-only lettering (the official wordmark with the golfer, map, seal, trophy and
// jug taken out), as on the tournament tabs. `white` is the all-white copy for colored headers.
const WORDMARK_ASPECT: Record<string, number> = { players: 10.34, masters: 5.04, pga: 3.29, 'us-open': 4.27, open: 2.05 };

// The marks differ a lot in weight: PGA's heavy block letters read big, the thin one-line Players
// lettering reads small. These even them out inside the same box.
const WORDMARK_SCALE: Record<string, number> = { players: 1.15, masters: 1, pga: 0.8, 'us-open': 0.95, open: 1 };

export function wordmarkSrc(id: string, white = false) {
  return WORDMARK_ASPECT[id] ? `/tab-wordmarks/${white ? 'white/' : ''}${id}.png` : undefined;
}

// The drawn size of a wordmark fitted inside a width × height box.
// `overflow` lets a mark scaled up (Players) run a little past the box width: fine in the popup
// headers, which have room beside the name; elsewhere marks stay inside their box.
export function wordmarkSize(id: string, width: number, height: number, scale = 1, overflow = false) {
  const aspect = WORDMARK_ASPECT[id] ?? 3;
  const s = (WORDMARK_SCALE[id] ?? 1) * scale;
  const w = Math.min(overflow ? Infinity : width * scale, width * s, height * s * aspect);
  return { width: Math.round(w), height: Math.round(w / aspect) };
}

export function TournamentWordmark({ id, white = false, width, height, scale = 1, alt = '', style }: {
  id: string;
  white?: boolean;
  width: number;
  height: number;
  scale?: number;
  alt?: string;
  style?: CSSProperties;
}) {
  const src = wordmarkSrc(id, white);
  if (!src) return null;
  const size = wordmarkSize(id, width, height, scale, white);
  return <img src={src} alt={alt} width={size.width} height={size.height} style={{ display: 'block', flexShrink: 0, width: size.width, height: size.height, ...style }} />;
}
