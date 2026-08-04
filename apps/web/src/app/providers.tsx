'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { PageTransitionProvider } from '@/lib/page-transition';
import { ApiError } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Every screen stays fresh on its own, without a manual reload — background refetches
            // don't flip `isLoading` back to true, so as long as loading skeletons key off
            // `isLoading` (not `isFetching`) this never causes a visible flash. Individual queries
            // can still override this (e.g. a shorter interval while a payment is pending).
            refetchInterval: 30_000,
            refetchIntervalInBackground: false,
            // Every deploy briefly recreates the `api` container — a request landing in that ~10-30s
            // window sees a 502/network failure, not a real error. The default 3 retries (~7s of
            // backoff) gives up before the container is back, which is what made a page look like it
            // "lost its data" or "didn't load" right after a deploy — the data was never gone, the
            // request just stopped retrying too early. A genuine 4xx (bad request, not found,
            // forbidden) won't fix itself on retry, so those fail fast instead of wasting time.
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return failureCount < 6;
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <PageTransitionProvider>{children}</PageTransitionProvider>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
