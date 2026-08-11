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
import { ThemeProvider } from 'next-themes';

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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:       'rounded-lg border border-border bg-card shadow-md',
              title:       'text-sm font-medium text-card-foreground',
              description: 'text-xs text-muted-foreground',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
