/**
 * /contabilidad/facturas-compra/[id] — Detalle de una factura de compra.
 *
 * Muestra: cabecera (proveedor, número, fecha, estado), líneas,
 * retenciones y botones para cambiar estado (PENDIENTE → PROCESADA / ANULADA).
 */
'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useFactura, useActualizarEstadoFactura } from '@/hooks/useFacturas';
import { useProveedor } from '@/hooks/useProveedores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

type EstadoFactura = 'PENDIENTE' | 'PROCESADA' | 'ANULADA';

const ESTADO_BADGE: Record<EstadoFactura, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' }> = {
  PENDIENTE: { label: 'Pendiente', variant: 'secondary' },
  PROCESADA: { label: 'Procesada', variant: 'default' },
  ANULADA:   { label: 'Anulada',   variant: 'destructive' },
};

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  return null;
}

function formatDate(ts: unknown): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return format(d, 'dd/MM/yyyy', { locale: es });
}

function formatUSD(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return `$${Number(n).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`;
}

export default function FacturaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: factura, isLoading, isError } = useFactura(id);
  const { data: proveedorData } = useProveedor(factura?.proveedorId ?? '');
  const { mutateAsync: actualizarEstado } = useActualizarEstadoFactura();

  const proveedor = proveedorData?.proveedor;

  const handleEstado = async (nuevoEstado: EstadoFactura) => {
    const label = ESTADO_BADGE[nuevoEstado].label.toLowerCase();
    if (!confirm(`¿Marcar esta factura como ${label}?`)) return;
    try {
      await actualizarEstado({ id, estado: nuevoEstado });
      toast.success(`Factura marcada como ${label}`);
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
          <Link href="/contabilidad/facturas-compra">Volver</Link>
        </Button>
      </div>
    );
  }

  const estado = factura.estado as EstadoFactura;
  const badgeInfo = ESTADO_BADGE[estado] ?? { label: estado, variant: 'secondary' as const };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contabilidad/facturas-compra">
              <ArrowLeft className="mr-1 h-4 w-4" /> Volver
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-zinc-900">
                {factura.numeroFactura}
              </h1>
              <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
            </div>
            <p className="text-sm text-zinc-500">
              Factura de compra · SRI Ecuador
            </p>
          </div>
        </div>

        {/* Acciones de estado */}
        <div className="flex gap-2">
          {estado === 'PENDIENTE' && (
            <>
              <Button
                size="sm"
                onClick={() => handleEstado('PROCESADA')}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Marcar procesada
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleEstado('ANULADA')}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Anular
              </Button>
            </>
          )}
          {factura.xmlUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={factura.xmlUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-4 w-4" />
                XML
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Cabecera — 2 columnas */}
      <div className="grid grid-cols-2 gap-4">
        {/* Datos de la factura */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Datos del comprobante
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Número</dt>
              <dd className="font-medium">{factura.numeroFactura}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Fecha emisión</dt>
              <dd>{formatDate(factura.fechaEmision)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Clave acceso SRI</dt>
              <dd className="font-mono text-xs truncate max-w-[160px]" title={factura.claveAcceso}>
                {factura.claveAcceso?.slice(0, 12)}…
              </dd>
            </div>
          </dl>
        </div>

        {/* Proveedor */}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Proveedor
          </h2>
          {proveedor ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Razón social</dt>
                <dd className="font-medium">{proveedor.razonSocial}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">RUC</dt>
                <dd className="font-mono">{proveedor.ruc}</dd>
              </div>
              {proveedor.nombreComercial && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Nombre comercial</dt>
                  <dd>{proveedor.nombreComercial}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-zinc-400">
              ID: <span className="font-mono">{factura.proveedorId}</span>
            </p>
          )}
        </div>
      </div>

      {/* Líneas */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-700">
            Líneas de la factura ({factura.lineas?.length ?? 0})
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código proveedor</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">P. unitario</TableHead>
              <TableHead className="text-right">Descuento</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead>Material ERP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(factura.lineas ?? []).map((linea, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{linea.codigoProveedor}</TableCell>
                <TableCell>{linea.descripcion}</TableCell>
                <TableCell className="text-right">{linea.cantidad}</TableCell>
                <TableCell className="text-right">{formatUSD(linea.precioUnitario)}</TableCell>
                <TableCell className="text-right">
                  {linea.descuento > 0 ? formatUSD(linea.descuento) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium">{formatUSD(linea.subtotal)}</TableCell>
                <TableCell>
                  {linea.materialId ? (
                    <Link
                      href={`/inventario/${linea.materialId}`}
                      className="text-xs text-blue-600 hover:underline font-mono"
                    >
                      {linea.materialId}
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400">Sin mapear</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totales */}
        <div className="border-t border-zinc-100 px-5 py-4">
          <div className="ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal sin IVA</span>
              <span>{formatUSD(factura.subtotalSinIva)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">IVA (15%)</span>
              <span>{formatUSD(factura.iva)}</span>
            </div>
            {(factura.retenciones ?? []).length > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Retenciones</span>
                <span>
                  −{formatUSD(factura.retenciones.reduce((a, r) => a + r.valor, 0))}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t border-zinc-200 pt-2">
              <span>Total</span>
              <span>{formatUSD(factura.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Retenciones (si las hay) */}
      {(factura.retenciones ?? []).length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-700">Retenciones</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Valor retenido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factura.retenciones.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell className="text-right">{formatUSD(r.base)}</TableCell>
                  <TableCell className="text-right">{r.porcentaje}%</TableCell>
                  <TableCell className="text-right font-medium">{formatUSD(r.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
