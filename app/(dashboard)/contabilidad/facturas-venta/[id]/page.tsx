/**
 * /contabilidad/facturas-venta/[id] — Detalle de una factura de venta (Fase 1).
 */
'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, XCircle, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useFacturaVenta, useAnularFacturaVenta, useEmitirFacturaVenta } from '@/hooks/useFacturasVenta';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MarcarEmitidaForm } from '@/components/contabilidad/MarcarEmitidaForm';
import type { FacturaVenta } from '@/types/metalmac.types';

type Estado = FacturaVenta['estado'];

const ESTADO_BADGE: Record<Estado, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' }> = {
  BORRADOR: { label: 'Borrador', variant: 'secondary' },
  EMITIDA:  { label: 'Emitida',  variant: 'default' },
  ANULADA:  { label: 'Anulada',  variant: 'destructive' },
};

function formatUSD(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return `$${Number(n).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`;
}

export default function FacturaVentaDetallePage() {
  const { id } = useParams<{ id: string }>();

  const { data: factura, isLoading, isError } = useFacturaVenta(id);
  const { mutateAsync: anular, isPending: anulando } = useAnularFacturaVenta();
  const { mutateAsync: emitir, isPending: emitiendo } = useEmitirFacturaVenta(id);

  const handleAnular = async () => {
    if (!confirm('¿Anular esta factura de venta?')) return;
    try {
      await anular(id);
      toast.success('Factura anulada');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleEmitir = async () => {
    if (!confirm('¿Emitir esta factura electrónicamente ante el SRI? Esto genera y firma el XML, lo envía, y espera la autorización — no se puede deshacer.')) return;
    try {
      const resultado = await emitir();
      if (resultado.sriEstado === 'EN_PROCESO') {
        toast.info(resultado.mensaje ?? 'El SRI todavía no autorizó el comprobante — volvé a intentar en unos minutos.');
        return;
      }
      const ambienteTexto = resultado.ambiente === 'PRUEBAS' ? ' (ambiente de pruebas)' : '';
      const emailTexto = resultado.emailEnviado ? ' y se envió por email al cliente' : '';
      toast.success(`Factura ${resultado.numeroFactura} autorizada por el SRI${emailTexto}${ambienteTexto}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !factura) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">No se pudo cargar la factura.</p>
        <Button variant="outline" asChild>
          <Link href="/contabilidad/facturas-venta">Volver</Link>
        </Button>
      </div>
    );
  }

  const badgeInfo = ESTADO_BADGE[factura.estado];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contabilidad/facturas-venta">
              <ArrowLeft className="mr-1 h-4 w-4" /> Volver
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {factura.numeroFactura || 'Factura sin emitir'}
              </h1>
              <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Factura de venta
              {factura.proyectoId && (
                <> · <Link href={`/proyectos/${factura.proyectoId}`} className="text-blue-600 hover:underline">Ver proyecto</Link></>
              )}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-start gap-2">
          {factura.estado === 'BORRADOR' && (
            <>
              <Button size="sm" onClick={handleEmitir} disabled={emitiendo}>
                {emitiendo
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Emitiendo…</>
                  : <><Zap className="mr-1.5 h-4 w-4" /> Emitir electrónicamente</>}
              </Button>
              <MarcarEmitidaForm facturaId={id} />
            </>
          )}
          {factura.estado !== 'ANULADA' && (
            <Button size="sm" variant="destructive" onClick={handleAnular} disabled={anulando}>
              <XCircle className="mr-1.5 h-4 w-4" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* Cabecera — 2 columnas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Datos del comprobante
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Número</dt>
              <dd className="font-medium">{factura.numeroFactura || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Fecha emisión</dt>
              <dd>{format(new Date(factura.fechaEmision), 'dd MMM yyyy', { locale: es })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Clave acceso SRI</dt>
              <dd className="font-mono text-xs truncate max-w-[160px]" title={factura.claveAcceso ?? undefined}>
                {factura.claveAcceso ? `${factura.claveAcceso.slice(0, 12)}…` : '—'}
              </dd>
            </div>
            {factura.sriEstado && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Estado SRI</dt>
                <dd className="font-medium">{factura.sriEstado}</dd>
              </div>
            )}
          </dl>
          {factura.sriMensaje && (
            <p className="text-xs text-red-600 bg-red-50 rounded-md p-2 mt-2">{factura.sriMensaje}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cliente
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nombre</dt>
              <dd className="font-medium">{factura.clienteNombre}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">RUC / cédula</dt>
              <dd className="font-mono">{factura.clienteRuc}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate max-w-[180px]">{factura.clienteEmail || '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Líneas */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Líneas de la factura ({factura.lineas?.length ?? 0})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">P. unitario</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead>Orden de producción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(factura.lineas ?? []).map((linea, i) => (
              <TableRow key={i}>
                <TableCell>{linea.descripcion}</TableCell>
                <TableCell className="text-right">{linea.cantidad}</TableCell>
                <TableCell className="text-right">{formatUSD(linea.precioUnitario)}</TableCell>
                <TableCell className="text-right font-medium">{formatUSD(linea.subtotal)}</TableCell>
                <TableCell>
                  {linea.ordenProduccionId ? (
                    <Link
                      href={`/produccion/${linea.ordenProduccionId}`}
                      className="text-xs text-blue-600 hover:underline font-mono"
                    >
                      {linea.ordenProduccionId}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="border-t border-border px-5 py-4">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal sin IVA</span>
              <span>{formatUSD(factura.subtotalSinIva)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA (15%)</span>
              <span>{formatUSD(factura.iva)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t border-border pt-2">
              <span>Total</span>
              <span>{formatUSD(factura.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
