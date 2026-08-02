'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface NavigateOptions {
  /** Curtain color to fade to before navigating — pick the destination page's own background so
   * the swap underneath it is invisible. Defaults to the light dashboard/school background. */
  color?: string;
  replace?: boolean;
}

interface PageTransitionContextValue {
  navigate: (path: string, options?: NavigateOptions) => void;
}

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

const DEFAULT_COLOR = '#f8fafc';
const FADE_MS = 220;

/**
 * A full-viewport color curtain that lives in the root layout (so it survives the actual page
 * unmount/mount, unlike anything rendered inside a page). navigate() fades the curtain to the
 * destination's background color, swaps the route underneath while fully covered, then fades the
 * curtain away once the new page has mounted — turning an instant, jarring color swap (e.g. dark
 * login -> light dashboard) into a smooth crossfade instead.
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [overlay, setOverlay] = useState<{ color: string; visible: boolean }>({
    color: DEFAULT_COLOR,
    visible: false,
  });
  const pendingReveal = useRef(false);

  const navigate = useCallback(
    (path: string, options?: NavigateOptions) => {
      const color = options?.color ?? DEFAULT_COLOR;
      pendingReveal.current = true;
      setOverlay({ color, visible: true });
      window.setTimeout(() => {
        if (options?.replace) router.replace(path);
        else router.push(path);
      }, FADE_MS);
    },
    [router],
  );

  useEffect(() => {
    if (!pendingReveal.current) return;
    pendingReveal.current = false;
    // Small delay so the new page's first paint lands before we start uncovering it.
    const id = window.setTimeout(() => setOverlay((o) => ({ ...o, visible: false })), 20);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <PageTransitionContext.Provider value={{ navigate }}>
      {children}
      <div
        aria-hidden
        className={`fixed inset-0 z-[9999] transition-opacity duration-200 ease-in-out ${
          overlay.visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ backgroundColor: overlay.color }}
      />
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  const ctx = useContext(PageTransitionContext);
  if (!ctx) throw new Error('usePageTransition must be used within PageTransitionProvider');
  return ctx;
}
