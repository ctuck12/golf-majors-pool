'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// A pop-up header title that always stays on one line: it starts at `size` and shrinks the text
// until it fits the space left beside the GMP badge and close button (down to `min`).
export function FitTitle({ children, size = 17, min = 12 }: { children: ReactNode; size?: number; min?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(size);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let next = size;
      el.style.fontSize = `${next}px`;
      while (next > min && el.scrollWidth > el.clientWidth + 0.5) {
        next -= 0.5;
        el.style.fontSize = `${next}px`;
      }
      setFontSize(next);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, size, min]);

  return (
    <div ref={ref} style={{ flex: 1, minWidth: 0, color: '#fff', fontSize, fontWeight: 900, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
