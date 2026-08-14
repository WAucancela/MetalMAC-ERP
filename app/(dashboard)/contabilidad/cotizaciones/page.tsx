/**
 * /contabilidad/cotizaciones — listado de cotizaciones
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { useCotizaciones } from '@/hooks/useCotizaciones';
import type { EstadoCotizacion } from '@/types/metalmac.types';

const ESTADO_VARIANT: Record<EstadoCotizacion, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  BORRADOR:  'secondary',
  ENVIADA:   'outline',
  APROBADA:  'default',
  RECHAZADA: 'destructive',
  VENCIDA:   'destructive',
};

const ESTADOS: Array<{ value: EstadoCotizacion | ''; label: string }> = [
  { value: '',          label: 'Todas' },
  { value: 'BORRADOR',  label: 'Borrador' },
  { value: 'ENVIADA',   label: 'Enviadas' },
  { value: 'APROBADA',  label: 'Aprobadas' },
  { value: 'RECHAZADA', label: 'Rechazadas' },
  { value: 'VENCIDA',   label: 'Vencidas' },
];

function formatUSD(n: number): string {
  return `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2 })}`;
}

export default function CotizacionesPage() {
  const [estado, setEstado] = useState<EstadoCotizacion | ''>('');
  const { data: cotizaciones = [], isLoading } = useCotizaciones(estado ? { estado } : {});

  const enviadas = cotizaciones.filter((c) => c.estado === 'ENVIADA').length;
  const totalAprobado = cotizaciones.filter((c) => c.estado === 'APROBADA').reduce((acc, c) => acc + c.total, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">Propuestas de precio a clientes, desde el catálogo de productos y materiales</p>
        </div>
        <Button asChild>
          <Link href="/contabilidad/cotizaciones/nueva"><Plus className="mr-2 h-4 w-4" /> Nueva cotización</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total aprobado</p>
          <p className="text-2xl font-bold">{formatUSD(totalAprobado)}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Esperando respuesta</p>
          <p className="text-2xl font-bold text-amber-600">{enviadas}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total cotizaciones</p>
          <p className="text-2xl font-bold">{cotizaciones.length}</p>
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
      ) : cotizaciones.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay cotizaciones en este estado.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cotizaciones.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/contabilidad/cotizaciones/${c.id}`} className="font-mono text-sm font-medium hover:underline">
                    {c.numero}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{c.clienteNombre}</TableCell>
                <TableCell className="text-sm">{format(parseISO(c.fechaEmision), 'dd MMM yyyy', { locale: es })}</TableCell>
                <TableCell className="text-sm">{format(parseISO(c.fechaVencimiento), 'dd MMM yyyy', { locale: es })}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatUSD(c.total)}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[c.estado]}>{c.estado}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
