'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { PageTransitionProvider } from '@/lib/page-transition';

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
