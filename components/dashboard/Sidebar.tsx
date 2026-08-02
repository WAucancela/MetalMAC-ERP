'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  Package, Truck, FileText, Factory, FolderOpen, ShoppingCart, Receipt,
  LayoutDashboard, ChevronRight, Boxes, LogOut, Settings,
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
  { href: '/contabilidad/facturas-compra', label: 'Facturas Compra',  icon: FileText },
  { href: '/contabilidad/facturas-venta',  label: 'Facturas Venta',   icon: Receipt },
  { href: '/proyectos',                    label: 'Proyectos',        icon: FolderOpen },
  { href: '/configuracion',                label: 'Configuración',    icon: Settings, roles: ['GERENTE'] },
];

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
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900">
          <span className="text-xs font-bold text-white">M</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-zinc-900">
          MetalMAC
        </span>
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
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge !== null && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
              {active && <ChevronRight className="h-3 w-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer — usuario + cerrar sesión */}
      <div className="border-t border-zinc-200 p-4 space-y-2">
        {user && (
          <p className="truncate text-xs text-zinc-500 px-1">{user.email}</p>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Cerrar sesión</span>
        </button>
        <p className="text-[10px] text-zinc-400 text-center">MetalMAC ERP · Sprint 6</p>
      </div>
    </aside>
  );
}
