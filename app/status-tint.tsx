'use client';

import { useEffect } from 'react';

// When a popup is open, the strip behind the iPhone clock and Dynamic Island darkens with the rest of
// the screen. On the website that strip isn't part of the page: Safari paints it from the page's
// background color (and, where supported, the theme-color tag), so it stayed light grey behind the
// popup's dark backdrop. While any popup backdrop is on screen (every one is a fixed overlay with a
// 7px blur), both are switched to the backdrop's color over the page, and put back when it closes.

const PAGE = '#e8edf3';
const DIMMED = '#5e6771'; // rgba(9, 20, 34, 0.62) over the page background

function setThemeColor(color: string | null) {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-status-tint]');
  if (color === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = 'theme-color';
    tag.dataset.statusTint = '1';
    document.head.appendChild(tag);
  }
  tag.content = color;
}

export function StatusTint() {
  useEffect(() => {
    let dimmed = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      const open = !!document.querySelector('[style*="backdrop-filter: blur(7px)"], [style*="-webkit-backdrop-filter: blur(7px)"]');
      if (open === dimmed) return;
      dimmed = open;
      const color = open ? DIMMED : PAGE;
      document.documentElement.style.background = color;
      document.body.style.background = color;
      setThemeColor(open ? DIMMED : null);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    update();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      document.documentElement.style.background = '';
      document.body.style.background = '';
      setThemeColor(null);
    };
  }, []);
  return null;
}
