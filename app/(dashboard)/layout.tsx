/**
 * Layout principal del dashboard.
 * Todas las rutas bajo /(dashboard)/ heredan este layout.
 */
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center border-b border-border bg-card px-6">
          <h1 className="text-sm font-medium text-muted-foreground">
            MetalMAC — Sistema de Gestión
          </h1>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
