/**
 * /pedidos-tienda/[id] — Detalle de un pedido de la Tienda de Muebles (tallermac.com)
 *
 * Sin pago en línea todavía: el equipo coordina pago y entrega a mano y va avanzando el
 * estado manualmente (CONTACTADO → PAGADO → ENTREGADO).
 */

'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { usePedidoTienda, useActualizarEstadoPedidoTienda } from '@/hooks/usePedidosTienda';
import type { EstadoPedidoTienda } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoPedidoTienda, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDIENTE_CONTACTO: 'default',
  CONTACTADO:          'secondary',
  PAGADO:              'outline',
  ENTREGADO:           'outline',
  CANCELADO:           'destructive',
};

type EstadoAccionable = 'CONTACTADO' | 'PAGADO' | 'ENTREGADO' | 'CANCELADO';

const SIGUIENTE_ESTADO: Partial<Record<EstadoPedidoTienda, { estado: EstadoAccionable; label: string }>> = {
  PENDIENTE_CONTACTO: { estado: 'CONTACTADO', label: 'Marcar como contactado' },
  CONTACTADO:          { estado: 'PAGADO', label: 'Marcar como pagado' },
  PAGADO:              { estado: 'ENTREGADO', label: 'Marcar como entregado' },
};

export default function PedidoTiendaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: pedido, isLoading } = usePedidoTienda(id);
  const actualizarEstado = useActualizarEstadoPedidoTienda(id);

  async function marcar(estado: EstadoAccionable) {
    try {
      await actualizarEstado.mutateAsync({ estado });
      toast.success('Pedido actualizado');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar pedido');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!pedido) return <p className="text-sm text-muted-foreground">Pedido no encontrado.</p>;

  const siguiente = SIGUIENTE_ESTADO[pedido.estado];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/pedidos-tienda"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">{pedido.clienteNombre}</h1>
        <Badge variant={ESTADO_VARIANT[pedido.estado]}>{pedido.estado.replace('_', ' ')}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Correo', value: pedido.clienteEmail || '—' },
          { label: 'Teléfono', value: pedido.clienteTelefono || '—' },
          { label: 'Total', value: `$${pedido.total.toFixed(2)}` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {siguiente && (
          <Button variant="outline" onClick={() => marcar(siguiente.estado)} disabled={actualizarEstado.isPending}>
            {siguiente.label}
          </Button>
        )}
        {pedido.estado !== 'CANCELADO' && pedido.estado !== 'ENTREGADO' && (
          <Button variant="destructive" onClick={() => marcar('CANCELADO')} disabled={actualizarEstado.isPending}>
            Cancelar pedido
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Líneas del pedido</h2>
        {pedido.lineas.map((linea) => (
          <div key={linea.id} className="rounded-lg border p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{linea.descripcion}</p>
              <p className="text-xs text-muted-foreground">
                Cantidad: {linea.cantidad} · Precio unitario: ${linea.precioUnitario.toFixed(2)}
              </p>
            </div>
            <p className="text-sm font-semibold">${linea.subtotal.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Recibido el {format(new Date(pedido.creadoEn), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
      </p>
    </div>
  );
}
