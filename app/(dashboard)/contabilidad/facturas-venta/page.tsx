/**
 * /contabilidad/facturas-venta — Fase 1: registro manual de ventas.
 *
 * No hay botón de "nueva factura" acá — se generan desde el detalle de un Proyecto
 * ("Generar factura de venta"), para que siempre queden ligadas a un proyecto.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFacturasVenta } from '@/hooks/useFacturasVenta';
import type { FacturaVenta } from '@/types/metalmac.types';

type Estado = FacturaVenta['estado'];

const ESTADO_VARIANT: Record<Estado, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  BORRADOR: 'secondary',
  EMITIDA:  'default',
  ANULADA:  'destructive',
};

const ESTADOS: Array<{ value: Estado | ''; label: string }> = [
  { value: '',         label: 'Todas' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'EMITIDA',  label: 'Emitidas' },
  { value: 'ANULADA',  label: 'Anuladas' },
];

function formatUSD(n: number): string {
  return `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2 })}`;
}

export default function FacturasVentaPage() {
  const [estado, setEstado] = useState<Estado | ''>('');
  const { data: facturas = [], isLoading } = useFacturasVenta(estado ? { estado } : {});

  const pendientes = facturas.filter((f) => f.estado === 'BORRADOR').length;
  const totalEmitido = facturas.filter((f) => f.estado === 'EMITIDA').reduce((acc, f) => acc + f.total, 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Facturas de Venta</h1>
        <p className="text-sm text-muted-foreground">
          Registro de ventas ligadas a proyectos — la emisión electrónica al SRI todavía se hace por fuera del ERP
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total emitido</p>
          <p className="text-2xl font-bold">{formatUSD(totalEmitido)}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pendientes de emitir</p>
          <p className="text-2xl font-bold text-amber-600">{pendientes}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total facturas</p>
          <p className="text-2xl font-bold">{facturas.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            onClick={() => setEstado(e.value)}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${
              estado === e.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-input hover:bg-muted'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : facturas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No hay facturas de venta en este estado. Generá una desde el detalle de un proyecto.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha emisión</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {facturas.map((f) => (
              <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/contabilidad/facturas-venta/${f.id}`} className="font-mono text-sm font-medium hover:underline">
                    {f.numeroFactura || '— sin emitir —'}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{f.clienteNombre}</p>
                  <p className="text-xs text-muted-foreground font-mono">{f.clienteRuc}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {format(parseISO(f.fechaEmision), 'dd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">{formatUSD(f.total)}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[f.estado]}>{f.estado}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
