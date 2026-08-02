'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { PageTransitionProvider } from '@/lib/page-transition';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PageTransitionProvider>{children}</PageTransitionProvider>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
