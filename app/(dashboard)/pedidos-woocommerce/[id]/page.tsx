/**
 * /pedidos-woocommerce/[id] — Detalle de un pedido de tallermac.com
 *
 * Muestra la cabecera del pedido y cada línea; las líneas sin convertir muestran el
 * formulario de conversión a Orden de Producción, las ya convertidas enlazan a la OP.
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
import { usePedidoWooCommerce, useActualizarEstadoPedido } from '@/hooks/usePedidosWooCommerce';
import { ConvertirLineaForm } from '@/components/pedidos-woocommerce/ConvertirLineaForm';
import type { EstadoRevisionPedido } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoRevisionPedido, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDIENTE:    'default',
  EN_REVISION:  'secondary',
  CONVERTIDO:   'outline',
  RECHAZADO:    'destructive',
};

export default function PedidoWooCommerceDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: pedido, isLoading } = usePedidoWooCommerce(id);
  const actualizarEstado = useActualizarEstadoPedido(id);

  async function marcar(estadoRevision: 'EN_REVISION' | 'RECHAZADO') {
    try {
      await actualizarEstado.mutateAsync({ estadoRevision });
      toast.success(estadoRevision === 'EN_REVISION' ? 'Pedido marcado en revisión' : 'Pedido rechazado');
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/pedidos-woocommerce"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold font-mono">#{pedido.numeroPedido}</h1>
        <Badge variant={ESTADO_VARIANT[pedido.estadoRevision]}>
          {pedido.estadoRevision.replace('_', ' ')}
        </Badge>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Cliente',        value: pedido.clienteNombre || '—' },
          { label: 'Email',          value: pedido.clienteEmail || '—' },
          { label: 'Total',          value: `${pedido.moneda} ${pedido.total.toFixed(2)}` },
          { label: 'Estado WooCommerce', value: pedido.wcStatus },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Acciones a nivel de pedido */}
      {pedido.estadoRevision === 'PENDIENTE' && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => marcar('EN_REVISION')} disabled={actualizarEstado.isPending}>
            Marcar en revisión
          </Button>
          <Button variant="destructive" onClick={() => marcar('RECHAZADO')} disabled={actualizarEstado.isPending}>
            Rechazar pedido
          </Button>
        </div>
      )}

      {/* Líneas */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Líneas del pedido</h2>
        {pedido.lineas.map((linea) => (
          <div key={linea.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{linea.nombreProducto}</p>
                <p className="text-xs text-muted-foreground">
                  SKU: {linea.sku || 's/n'} · Cantidad: {linea.cantidad}
                </p>
              </div>
              {linea.ordenProduccionId && (
                <Badge variant="outline">Convertida</Badge>
              )}
            </div>

            {linea.ordenProduccionId ? (
              <Link
                href={`/produccion/${linea.ordenProduccionId}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Ver Orden de Producción →
              </Link>
            ) : (
              <ConvertirLineaForm pedidoId={pedido.id} linea={linea} />
            )}
          </div>
        ))}
      </div>

      {/* Metadata */}
      <p className="text-xs text-muted-foreground">
        Recibido el {format(new Date(pedido.recibidoEn), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
      </p>
    </div>
  );
}
