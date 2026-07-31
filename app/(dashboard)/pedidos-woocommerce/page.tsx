'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePedidosWooCommerce } from '@/hooks/usePedidosWooCommerce';
import type { EstadoRevisionPedido } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoRevisionPedido, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDIENTE:    'default',
  EN_REVISION:  'secondary',
  CONVERTIDO:   'outline',
  RECHAZADO:    'destructive',
};

const ESTADOS: Array<{ value: EstadoRevisionPedido | ''; label: string }> = [
  { value: '',             label: 'Todos' },
  { value: 'PENDIENTE',    label: 'Pendientes' },
  { value: 'EN_REVISION',  label: 'En revisión' },
  { value: 'CONVERTIDO',   label: 'Convertidos' },
  { value: 'RECHAZADO',    label: 'Rechazados' },
];

export default function PedidosWooCommercePage() {
  const [estadoRevision, setEstadoRevision] = useState<EstadoRevisionPedido | ''>('PENDIENTE');
  const { data: pedidos = [], isLoading } = usePedidosWooCommerce(
    estadoRevision ? { estadoRevision } : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos Web</h1>
          <p className="text-sm text-muted-foreground">Pedidos recibidos de tallermac.com pendientes de revisión</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            onClick={() => setEstadoRevision(e.value)}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${
              estadoRevision === e.value
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
      ) : pedidos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay pedidos en este estado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-32">Total</TableHead>
              <TableHead className="w-40">Recibido</TableHead>
              <TableHead className="w-32">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/pedidos-woocommerce/${p.id}`} className="font-mono text-sm font-medium hover:underline">
                    #{p.numeroPedido}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.lineas.length} línea(s)</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{p.clienteNombre || '—'}</p>
                  <p className="text-xs text-muted-foreground">{p.clienteEmail}</p>
                </TableCell>
                <TableCell className="text-sm">{p.moneda} {p.total.toFixed(2)}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(p.recibidoEn), 'dd MMM yyyy HH:mm', { locale: es })}
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[p.estadoRevision]}>
                    {p.estadoRevision.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
