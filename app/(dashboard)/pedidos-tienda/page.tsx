'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePedidosTienda } from '@/hooks/usePedidosTienda';
import type { EstadoPedidoTienda } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoPedidoTienda, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDIENTE_CONTACTO: 'default',
  CONTACTADO:          'secondary',
  PAGADO:              'outline',
  ENTREGADO:           'outline',
  CANCELADO:           'destructive',
};

const ESTADOS: Array<{ value: EstadoPedidoTienda | ''; label: string }> = [
  { value: '',                   label: 'Todos' },
  { value: 'PENDIENTE_CONTACTO', label: 'Pendientes de contacto' },
  { value: 'CONTACTADO',         label: 'Contactados' },
  { value: 'PAGADO',             label: 'Pagados' },
  { value: 'ENTREGADO',          label: 'Entregados' },
  { value: 'CANCELADO',          label: 'Cancelados' },
];

export default function PedidosTiendaPage() {
  const [estado, setEstado] = useState<EstadoPedidoTienda | ''>('PENDIENTE_CONTACTO');
  const { data: pedidos = [], isLoading } = usePedidosTienda(
    estado ? { estado } : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos de Tienda</h1>
          <p className="text-sm text-muted-foreground">Pedidos de la Tienda de Muebles recibidos desde tallermac.com</p>
        </div>
      </div>

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
              <TableHead>Cliente</TableHead>
              <TableHead className="w-32">Total</TableHead>
              <TableHead className="w-40">Recibido</TableHead>
              <TableHead className="w-40">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/pedidos-tienda/${p.id}`} className="text-sm font-medium hover:underline">
                    {p.clienteNombre || '—'}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.clienteEmail} · {p.lineas.length} línea(s)</p>
                </TableCell>
                <TableCell className="text-sm">${p.total.toFixed(2)}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(p.creadoEn), 'dd MMM yyyy HH:mm', { locale: es })}
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[p.estado]}>{p.estado.replace('_', ' ')}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
