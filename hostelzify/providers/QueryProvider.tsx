'use client';

import { useState, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute deduplication/freshness window
            gcTime: 5 * 60 * 1000, // 5 minutes cache retention
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
