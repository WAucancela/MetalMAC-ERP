/**
 * Layout para páginas de autenticación (/login, etc.)
 * Sin Sidebar — fondo neutro centrado.
 */
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      {children}
    </div>
  );
}
