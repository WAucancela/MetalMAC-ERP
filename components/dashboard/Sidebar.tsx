'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  Package, Truck, Factory, FolderOpen, ShoppingCart, Calculator,
  LayoutDashboard, ChevronRight, Boxes, LogOut, Settings, Sun, Moon,
} from 'lucide-react';
import { useAlertasStockBajo } from '@/hooks/useStock';
import { usePedidosWooCommerce } from '@/hooks/usePedidosWooCommerce';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  href:  string;
  label: string;
  icon:  LucideIcon;
  /** Si se define, el ítem sólo se muestra a estos roles (mismo check que la API correspondiente). */
  roles?: readonly string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',                             label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/inventario',                   label: 'Inventario',       icon: Package },
  { href: '/productos',                    label: 'Productos',        icon: Boxes },
  { href: '/produccion',                   label: 'Producción',       icon: Factory },
  { href: '/pedidos-woocommerce',          label: 'Pedidos Web',      icon: ShoppingCart, roles: ['GERENTE', 'PRODUCCION'] },
  { href: '/proveedores',                  label: 'Proveedores',      icon: Truck },
  { href: '/contabilidad',                 label: 'Contabilidad',     icon: Calculator, roles: ['GERENTE', 'CONTABILIDAD'] },
  { href: '/proyectos',                    label: 'Proyectos',        icon: FolderOpen },
  { href: '/configuracion',                label: 'Configuración',    icon: Settings, roles: ['GERENTE'] },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  // Evita el flash/desajuste de hidratación: `resolvedTheme` no existe hasta
  // que next-themes lee la preferencia real en el cliente.
  useEffect(() => setMontado(true), []);
  if (!montado) return <div className="h-8 w-8" />;

  const esOscuro = resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(esOscuro ? 'light' : 'dark')}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title={esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {esOscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: alertas } = useAlertasStockBajo();
  const { user, rol, signOut } = useAuth();
  // Sólo GERENTE/PRODUCCION pueden ver /pedidos-woocommerce (mismo check que la API) —
  // sin esto, cualquier otro rol dispararía un 403 en cada carga de página.
  const puedeVerPedidos = rol === 'GERENTE' || rol === 'PRODUCCION';
  const { data: pedidosPendientes } = usePedidosWooCommerce({
    estadoRevision: 'PENDIENTE',
    enabled: puedeVerPedidos,
  });

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const navItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(rol ?? ''));

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Logo — fondo blanco propio porque el archivo de marca no tiene transparencia */}
      <div className="flex flex-col items-center gap-1 border-b border-border px-6 py-5">
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <Image src="/logo.png" alt="MetalMAC" width={1088} height={960} className="h-14 w-auto" priority />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href);

          const badge =
            href === '/inventario' && alertas && alertas.length > 0
              ? alertas.length
              : href === '/pedidos-woocommerce' && pedidosPendientes && pedidosPendientes.length > 0
              ? pedidosPendientes.length
              : null;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {active && (
                <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-spark" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge !== null && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {badge}
                </span>
              )}
              {active && <ChevronRight className="h-3 w-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer — usuario + tema + cerrar sesión */}
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex items-center justify-between px-1">
          {user && (
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          )}
          <ThemeToggle />
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Cerrar sesión</span>
        </button>
        <p className="text-center text-[10px] text-muted-foreground/70">MetalMAC ERP · Sprint 6</p>
      </div>
    </aside>
  );
}
