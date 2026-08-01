/**
 * /produccion/[id] — Detalle de una Orden de Producción
 *
 * Muestra:
 * - Header con código, estado, fechas, costo
 * - Tabla de materiales reservados
 * - Botones de acción: Iniciar → EN_PROCESO / Completar / Cancelar
 * - Notas
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronLeft, Play, CheckCheck, XCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EstadoOrdenBadge } from '@/components/produccion/EstadoOrdenBadge';
import { useOrden, useActualizarEstadoOrden } from '@/hooks/useOrdenes';

function parseDate(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  return new Date(ts);
}

export default function OrdenDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useOrden(id);
  const actualizarEstado = useActualizarEstadoOrden(id);

  async function transicion(estado: 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA') {
    try {
      await actualizarEstado.mutateAsync({ estado });
      toast.success(
        estado === 'EN_PROCESO' ? 'Orden iniciada — materiales reservados'
        : estado === 'COMPLETADA' ? 'Orden completada — materiales consumidos'
        : 'Orden cancelada — materiales liberados',
      );
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar estado');
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

  if (!data) return <p className="text-sm text-muted-foreground">Orden no encontrada.</p>;

  const orden = data;
  const fechaEntrega  = parseDate(orden.fechaEntrega);
  const fechaCreacion = parseDate(orden.creadoEn);
  const materialesReservados: any[] = orden.materialesReservados ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/produccion"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold font-mono">{orden.codigo}</h1>
        <EstadoOrdenBadge estado={orden.estado} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Producto',      value: orden.producto?.nombre ?? orden.productoId },
          { label: 'Cantidad',      value: String(orden.cantidad) },
          { label: 'Fecha entrega', value: fechaEntrega ? format(fechaEntrega, 'dd MMM yyyy', { locale: es }) : '—' },
          { label: 'Costo estimado', value: orden.costoEstimado > 0 ? `$${orden.costoEstimado.toFixed(2)}` : '—' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Acciones */}
      <div className="flex gap-3 flex-wrap">
        {orden.estado === 'BORRADOR' && (
          <>
            <Button
              onClick={() => transicion('EN_PROCESO')}
              disabled={actualizarEstado.isPending}
            >
              {actualizarEstado.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Play className="mr-2 h-4 w-4" />}
              Iniciar producción
            </Button>
            <Button
              variant="outline"
              onClick={() => transicion('CANCELADA')}
              disabled={actualizarEstado.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          </>
        )}
        {orden.estado === 'EN_PROCESO' && (
          <>
            <Button
              onClick={() => transicion('COMPLETADA')}
              disabled={actualizarEstado.isPending}
            >
              {actualizarEstado.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <CheckCheck className="mr-2 h-4 w-4" />}
              Marcar como completada
            </Button>
            <Button
              variant="destructive"
              onClick={() => transicion('CANCELADA')}
              disabled={actualizarEstado.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" /> Cancelar y liberar materiales
            </Button>
          </>
        )}
      </div>

      {/* Materiales reservados */}
      {materialesReservados.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Materiales reservados</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="w-36 text-right">Cantidad reservada</TableHead>
                <TableHead className="w-28 text-right">Precio unit.</TableHead>
                <TableHead className="w-28 text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialesReservados.map((m: any) => (
                <TableRow key={m.materialId}>
                  <TableCell className="text-sm">{m.nombre ?? m.materialId}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {m.cantidadReservada?.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {m.precioUnitario != null ? `$${m.precioUnitario.toFixed(4)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {m.cantidadReservada != null && m.precioUnitario != null
                      ? `$${(m.cantidadReservada * m.precioUnitario).toFixed(2)}`
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Notas */}
      {orden.notas && (
        <div className="rounded-md border p-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Notas</p>
          <p className="text-sm">{orden.notas}</p>
        </div>
      )}

      {/* Metadata */}
      <p className="text-xs text-muted-foreground">
        Creado el {fechaCreacion ? format(fechaCreacion, "dd MMM yyyy 'a las' HH:mm", { locale: es }) : '—'}
      </p>
    </div>
  );
}
