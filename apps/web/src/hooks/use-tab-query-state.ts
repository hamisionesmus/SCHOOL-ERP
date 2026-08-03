'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Remembers which tab is active in the URL's `?tab=` param, so a refresh (or a shared link) lands
 * back on the same tab instead of always resetting to the default. Uses `history.replaceState`
 * directly rather than `next/navigation`'s router — that keeps this a plain client-side read/write
 * with no `useSearchParams()` Suspense-boundary requirement, since these pages are otherwise
 * statically rendered and don't need a full Next navigation for a same-page tab switch.
 *
 * State always starts at `defaultTab` (matching what the server-rendered shell shows) and only
 * syncs from the URL inside a `useEffect` — reading `window.location` during the initial render
 * would make the client's first paint diverge from the static server-rendered HTML and trigger a
 * hydration mismatch.
 */
export function useTabQueryState<T extends string>(validTabs: readonly T[], defaultTab: T) {
  const [tab, setTabState] = useState<T>(defaultTab);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && (validTabs as readonly string[]).includes(fromUrl) && fromUrl !== defaultTab) {
      setTabState(fromUrl as T);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = useCallback((next: T) => {
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState(null, '', url);
  }, []);

  return [tab, setTab] as const;
}
