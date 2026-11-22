import type { CSSProperties } from 'react';

// The Golf Majors Pool mark for colored popup headers: the flag circle with "GMP" beside it,
// centered on the circle. Sized by height; the width follows the image (about 2.3 : 1).
const ASPECT = 696 / 300;

export function GmpBadge({ height, style }: { height: number; style?: CSSProperties }) {
  const h = Math.round(height);
  const w = Math.round(h * ASPECT);
  return <img src="/gmp-badge.png" alt="Golf Majors Pool" width={w} height={h} style={{ display: 'block', flexShrink: 0, width: w, height: h, ...style }} />;
}
