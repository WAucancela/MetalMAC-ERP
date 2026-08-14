/**
 * /contabilidad — índice del módulo de contabilidad
 */

'use client';

import Link from 'next/link';
import {
  FileText, FileSignature, Receipt, ArrowDownToLine, ArrowUpFromLine, Wallet, Landmark, Boxes,
} from 'lucide-react';

const SECCIONES = [
  { href: '/contabilidad/cotizaciones',      icon: FileSignature,  titulo: 'Cotizaciones',       descripcion: 'Propuestas de precio a clientes, con seguimiento automático por email.' },
  { href: '/contabilidad/facturas-compra',   icon: FileText,        titulo: 'Facturas de Compra', descripcion: 'Facturas recibidas de proveedores.' },
  { href: '/contabilidad/facturas-venta',    icon: Receipt,         titulo: 'Facturas de Venta',  descripcion: 'Facturación electrónica a clientes.' },
  { href: '/contabilidad/cuentas-por-cobrar', icon: ArrowDownToLine, titulo: 'Cuentas por Cobrar',  descripcion: 'Saldos pendientes de clientes, con antigüedad.' },
  { href: '/contabilidad/cuentas-por-pagar', icon: ArrowUpFromLine, titulo: 'Cuentas por Pagar',   descripcion: 'Saldos pendientes con proveedores, con antigüedad.' },
  { href: '/contabilidad/gastos',            icon: Wallet,          titulo: 'Gastos',              descripcion: 'Gastos generales y de proyecto.' },
  { href: '/contabilidad/caja-chica',        icon: Wallet,          titulo: 'Caja Chica',          descripcion: 'Ingresos y egresos de caja chica.' },
  { href: '/contabilidad/bancos',            icon: Landmark,        titulo: 'Bancos',              descripcion: 'Cuentas bancarias, movimientos y conciliación.' },
  { href: '/contabilidad/centros-costo',     icon: Boxes,           titulo: 'Centros de Costo',    descripcion: 'Catálogo de centros de costo.' },
];

export default function ContabilidadPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Contabilidad</h1>
        <p className="text-sm text-muted-foreground">Facturación, cobros/pagos, gastos, caja y bancos.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECCIONES.map(({ href, icon: Icon, titulo, descripcion }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{titulo}</p>
              <p className="text-xs text-muted-foreground">{descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
