/**
 * /contabilidad/cotizaciones/[id] — detalle de una cotización.
 * Acciones según estado: BORRADOR -> enviar por email o eliminar;
 * ENVIADA/VENCIDA -> marcar aprobada/rechazada; APROBADA sin proyecto -> convertir
 * a Proyecto. PDF descargable siempre.
 */
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, Send, Check, X, Trash2, Loader2, FolderPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExportButton } from '@/components/ui/ExportButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import {
  useCotizacion, useEnviarCotizacion, useCambiarEstadoCotizacion, useEliminarCotizacion, useConvertirCotizacion,
} from '@/hooks/useCotizaciones';
import { ConvertirCotizacionSchema, type ConvertirCotizacionInput } from '@/lib/validations/cotizaciones.schema';
import type { Cotizacion, EstadoCotizacion } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoCotizacion, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  BORRADOR:  'secondary',
  ENVIADA:   'outline',
  APROBADA:  'default',
  RECHAZADA: 'destructive',
  VENCIDA:   'destructive',
};

/** Modal de conversión — precarga nombre/presupuesto desde la cotización, editable. */
function ConvertirAProyectoDialog({ cotizacion, onClose }: { cotizacion: Cotizacion; onClose: () => void }) {
  const router = useRouter();
  const convertir = useConvertirCotizacion(cotizacion.id);

  const { register, handleSubmit, formState: { errors } } = useForm<ConvertirCotizacionInput>({
    resolver: zodResolver(ConvertirCotizacionSchema),
    defaultValues: {
      nombre: `${cotizacion.clienteNombre} — ${cotizacion.numero}`,
      fechaInicio: new Date().toISOString().slice(0, 10),
      presupuesto: cotizacion.total,
    },
  });

  const onSubmit = async (data: ConvertirCotizacionInput) => {
    try {
      const res = await convertir.mutateAsync(data);
      toast.success(`Proyecto ${res.proyectoCodigo} creado`);
      onClose();
      router.push(`/proyectos/${res.proyectoId}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al convertir la cotización');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convertir a proyecto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre del proyecto</Label>
            <Input {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha de inicio</Label>
              <Input type="date" {...register('fechaInicio')} />
              {errors.fechaInicio && <p className="text-xs text-red-500">{errors.fechaInicio.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Presupuesto (USD)</Label>
              <Input type="number" min={0.01} step="0.01" {...register('presupuesto', { valueAsNumber: true })} />
              {errors.presupuesto && <p className="text-xs text-red-500">{errors.presupuesto.message}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={convertir.isPending}>
              {convertir.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Crear proyecto'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CotizacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: cotizacion, isLoading } = useCotizacion(id);

  const enviar = useEnviarCotizacion(id);
  const cambiarEstado = useCambiarEstadoCotizacion(id);
  const eliminar = useEliminarCotizacion();
  const [convirtiendo, setConvirtiendo] = useState(false);

  const handleEnviar = async () => {
    try {
      await enviar.mutateAsync();
      toast.success('Cotización enviada por email');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al enviar');
    }
  };

  const handleCambiarEstado = async (estado: 'APROBADA' | 'RECHAZADA') => {
    try {
      await cambiarEstado.mutateAsync(estado);
      toast.success(estado === 'APROBADA' ? 'Marcada como aprobada' : 'Marcada como rechazada');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar');
    }
  };

  const handleEliminar = async () => {
    if (!confirm('¿Eliminar esta cotización? No se puede deshacer.')) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success('Cotización eliminada');
      router.push('/contabilidad/cotizaciones');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al eliminar');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!cotizacion) {
    return <p className="text-sm text-muted-foreground">Cotización no encontrada.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contabilidad/cotizaciones"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold font-mono">{cotizacion.numero}</h1>
        <Badge variant={ESTADO_VARIANT[cotizacion.estado]}>{cotizacion.estado}</Badge>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <ExportButton
          href={`/api/cotizaciones/${id}/pdf`}
          label="Descargar PDF"
          filename={`${cotizacion.numero}.pdf`}
        />
        {cotizacion.estado === 'BORRADOR' && (
          <>
            <Button onClick={handleEnviar} disabled={enviar.isPending}>
              {enviar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar por email
            </Button>
            <Button variant="outline" className="text-destructive" onClick={handleEliminar} disabled={eliminar.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          </>
        )}
        {(cotizacion.estado === 'ENVIADA' || cotizacion.estado === 'VENCIDA') && (
          <>
            <Button onClick={() => handleCambiarEstado('APROBADA')} disabled={cambiarEstado.isPending}>
              <Check className="mr-2 h-4 w-4" /> Marcar aprobada
            </Button>
            <Button variant="outline" onClick={() => handleCambiarEstado('RECHAZADA')} disabled={cambiarEstado.isPending}>
              <X className="mr-2 h-4 w-4" /> Marcar rechazada
            </Button>
          </>
        )}
        {cotizacion.estado === 'APROBADA' && !cotizacion.proyectoId && (
          <Button onClick={() => setConvirtiendo(true)}>
            <FolderPlus className="mr-2 h-4 w-4" /> Convertir a proyecto
          </Button>
        )}
      </div>

      {/* Datos generales */}
      <div className="rounded-lg border p-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="font-medium">{cotizacion.clienteNombre}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="font-medium">{cotizacion.clienteEmail || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">WhatsApp</p>
          <p className="font-medium">{cotizacion.clienteWhatsapp || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Proyecto vinculado</p>
          {cotizacion.proyectoId ? (
            <Link href={`/proyectos/${cotizacion.proyectoId}`} className="font-medium text-blue-600 hover:underline">Ver proyecto</Link>
          ) : (
            <p className="font-medium">—</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fecha de emisión</p>
          <p className="font-medium">{format(parseISO(cotizacion.fechaEmision), 'dd MMM yyyy', { locale: es })}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Válida hasta</p>
          <p className="font-medium">{format(parseISO(cotizacion.fechaVencimiento), 'dd MMM yyyy', { locale: es })}</p>
        </div>
        {cotizacion.emailEnviadoEn && (
          <div>
            <p className="text-xs text-muted-foreground">Enviada el</p>
            <p className="font-medium">{format(parseISO(cotizacion.emailEnviadoEn), 'dd MMM yyyy HH:mm', { locale: es })}</p>
          </div>
        )}
        {cotizacion.vecesRecordado > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Recordatorios enviados</p>
            <p className="font-medium">{cotizacion.vecesRecordado}</p>
          </div>
        )}
      </div>

      {/* Líneas */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Ítems</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-24">Cantidad</TableHead>
              <TableHead className="w-28 text-right">P. Unitario</TableHead>
              <TableHead className="w-28 text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cotizacion.lineas.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{l.descripcion}</TableCell>
                <TableCell className="text-sm">{l.cantidad}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">${l.precioUnitario.toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">${l.subtotal.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal sin IVA</span><span className="tabular-nums">${cotizacion.subtotalSinIva.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IVA (15%)</span><span className="tabular-nums">${cotizacion.iva.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold text-base"><span>Total</span><span className="tabular-nums">${cotizacion.total.toFixed(2)}</span></div>
          </div>
        </div>
      </div>

      {cotizacion.notas && (
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Notas</p>
          <p className="text-sm whitespace-pre-wrap">{cotizacion.notas}</p>
        </div>
      )}

      {convirtiendo && (
        <ConvertirAProyectoDialog cotizacion={cotizacion} onClose={() => setConvirtiendo(false)} />
      )}
    </div>
  );
}
