/**
 * Providers globales del cliente.
 * Se importan en app/layout.tsx dentro de <body>.
 *
 * - QueryClientProvider: React Query (TanStack)
 * - Toaster:             Notificaciones (sonner)
 */
'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: ReactNode }) {
  // Crear el QueryClient dentro del componente para evitar compartir estado
  // entre múltiples requests en SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:            30_000,
            retry:                1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast:       'rounded-lg border border-zinc-200 shadow-md',
            title:       'text-sm font-medium text-zinc-900',
            description: 'text-xs text-zinc-500',
          },
        }}
      />
    </QueryClientProvider>
  );
}
