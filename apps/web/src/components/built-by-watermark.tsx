'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const DEFAULT_TEXT = 'Built by Hamzone Technologies';

/** Platform-wide watermark, shown on every page. Fetches its own text client-side (falls back to
 * the built-in default while loading/on error) so it works the same regardless of which page/layout
 * it's mounted under. Positions itself responsively — bottom-right on wide screens where it can't
 * collide with page content, centered at the very bottom on narrow screens where a corner overlay
 * is more likely to sit on top of something tappable. */
export function BuiltByWatermark() {
  const [text, setText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    apiFetch<{ builtByText: string | null }>('/public/branding')
      .then((data) => setText(data.builtByText || DEFAULT_TEXT))
      .catch(() => undefined);
  }, []);

  return (
    <p className="pointer-events-none fixed inset-x-0 bottom-1 z-[200] select-none text-center text-[10px] font-medium text-slate-400/80 sm:inset-x-auto sm:bottom-2 sm:right-2 sm:text-[11px]">
      {text}
    </p>
  );
}
