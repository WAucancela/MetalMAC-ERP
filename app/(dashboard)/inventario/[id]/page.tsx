/**
 * /inventario/[id] — Detalle de material + stock + historial de movimientos.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMaterial } from '@/hooks/useInventario';
import { MovimientoForm } from '@/components/inventario/MovimientoForm';
import { StockBadge } from '@/components/inventario/StockBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Pencil, TrendingUp, TrendingDown } from 'lucide-react';

const TIPO_MOV_COLOR: Record<string, string> = {
  ENTRADA:         'bg-emerald-100 text-emerald-700',
  SALIDA:          'bg-red-100 text-red-700',
  AJUSTE_POSITIVO: 'bg-blue-100 text-blue-700',
  AJUSTE_NEGATIVO: 'bg-orange-100 text-orange-700',
  RESERVA:         'bg-purple-100 text-purple-700',
  LIBERACION:      'bg-teal-100 text-teal-700',
  MERMA:           'bg-muted text-muted-foreground',
  DEVOLUCION:      'bg-sky-100 text-sky-700',
};

const TIPO_MOV_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE_POSITIVO: 'Ajuste +',
  AJUSTE_NEGATIVO: 'Ajuste -', RESERVA: 'Reserva', LIBERACION: 'Liberación',
  MERMA: 'Merma', DEVOLUCION: 'Devolución',
};

export default function MaterialDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useMaterial(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-muted-foreground">Material no encontrado.</p>
        <Button variant="outline" onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  const { material, stock, movimientos } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="font-mono text-xs text-muted-foreground">{material.codigoInterno}</p>
            <h1 className="text-2xl font-semibold text-foreground">{material.nombre}</h1>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/inventario/${id}/editar`}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Registrar movimiento
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Registrar movimiento</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <MovimientoForm
                materialId={material.id}
                onSuccess={() => { setSheetOpen(false); refetch(); }}
              />
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {/* Tarjetas de stock */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Disponible"
          value={stock?.cantidadDisponible ?? 0}
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          color="text-emerald-700"
        />
        <StatCard
          label="Reservado"
          value={stock?.cantidadReservada ?? 0}
          icon={<TrendingDown className="h-4 w-4 text-purple-500" />}
          color="text-purple-700"
        />
        <StatCard
          label="Stock mínimo"
          value={stock?.cantidadMinima ?? 0}
          icon={null}
          color="text-muted-foreground"
          extra={
            stock ? (
              <StockBadge
                disponible={stock.cantidadDisponible}
                minima={stock.cantidadMinima}
              />
            ) : null
          }
        />
      </div>

      {/* Especificaciones */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Especificaciones</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          <SpecRow label="Tipo"      value={material.tipo} />
          <SpecRow label="Grado"     value={material.grado || '—'} />
          <SpecRow label="Costo/u."  value={`$${material.costoUnitario.toFixed(2)}`} />
          <SpecRow label="Ubicación" value={stock?.ubicacion || '—'} />
          {material.descripcion && (
            <div className="col-span-full">
              <dt className="text-xs text-muted-foreground">Descripción</dt>
              <dd className="mt-0.5 text-sm text-foreground">{material.descripcion}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Historial de movimientos */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Últimos 20 movimientos</h2>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Stock anterior</TableHead>
                <TableHead className="text-right">Stock posterior</TableHead>
                <TableHead>Referencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Sin movimientos registrados.
                  </TableCell>
                </TableRow>
              )}
              {movimientos.map((mov) => {
                const esEntrada = ['ENTRADA','AJUSTE_POSITIVO','LIBERACION','DEVOLUCION'].includes(mov.tipo);
                const fecha = (mov.fecha as unknown as { seconds: number }).seconds
                  ? new Date((mov.fecha as unknown as { seconds: number }).seconds * 1000)
                  : new Date();

                return (
                  <TableRow key={mov.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fecha.toLocaleDateString('es-EC', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_MOV_COLOR[mov.tipo] ?? 'bg-muted text-muted-foreground'}`}>
                        {TIPO_MOV_LABEL[mov.tipo] ?? mov.tipo}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm font-medium ${esEntrada ? 'text-emerald-600' : 'text-red-600'}`}>
                      {esEntrada ? '+' : '-'}{mov.cantidad.toLocaleString('es-EC', { maximumFractionDigits: 3 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {mov.stockAnterior.toLocaleString('es-EC', { maximumFractionDigits: 3 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-foreground font-medium">
                      {mov.stockPosterior.toLocaleString('es-EC', { maximumFractionDigits: 3 })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{mov.numeroReferencia}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label, value, icon, color, extra,
}: {
  label: string; value: number; icon: React.ReactNode;
  color: string; extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>
        {value.toLocaleString('es-EC', { maximumFractionDigits: 2 })}
      </p>
      {extra && <div className="mt-2">{extra}</div>}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
