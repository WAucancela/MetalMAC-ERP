/**
 * /produccion — Lista de Órdenes de Producción
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/ui/ExportButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EstadoOrdenBadge } from '@/components/produccion/EstadoOrdenBadge';
import { useOrdenes, type OrdenResumen } from '@/hooks/useOrdenes';

const ESTADOS: Array<{ value: OrdenResumen['estado'] | ''; label: string }> = [
  { value: '',           label: 'Todos' },
  { value: 'BORRADOR',   label: 'Borrador' },
  { value: 'EN_PROCESO', label: 'En Proceso' },
  { value: 'COMPLETADA', label: 'Completadas' },
  { value: 'CANCELADA',  label: 'Canceladas' },
];

function parseDate(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  return new Date(ts);
}

export default function ProduccionPage() {
  const [estado, setEstado] = useState<OrdenResumen['estado'] | ''>('');
  const { data: ordenes = [], isLoading } = useOrdenes(
    estado ? { estado } : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Órdenes de Producción</h1>
        <div className="flex items-center gap-2">
          <ExportButton
            href={`/api/reportes/produccion?format=csv&desde=${new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10)}&hasta=${new Date().toISOString().slice(0,10)}`}
            label="Exportar CSV (30d)"
            filename="produccion.csv"
          />
          <Button asChild variant="outline">
            <Link href="/produccion/operarios">
              <Users className="mr-2 h-4 w-4" /> Operarios
            </Link>
          </Button>
          <Button asChild>
            <Link href="/produccion/nueva">
              <Plus className="mr-2 h-4 w-4" /> Nueva Orden
            </Link>
          </Button>
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="flex gap-2 flex-wrap">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            onClick={() => setEstado(e.value as any)}
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
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : ordenes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay órdenes de producción.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/produccion/nueva">Crear primera orden</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="w-20">Cantidad</TableHead>
              <TableHead>Fecha entrega</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-28 text-right">Costo est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenes.map((op) => {
              const fecha = parseDate(op.fechaEntrega);
              return (
                <TableRow key={op.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/produccion/${op.id}`} className="font-mono text-sm font-medium hover:underline">
                      {op.codigo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{op.productoId}</TableCell>
                  <TableCell className="tabular-nums">{op.cantidad}</TableCell>
                  <TableCell className="text-sm">
                    {fecha ? format(fecha, 'dd MMM yyyy', { locale: es }) : '—'}
                  </TableCell>
                  <TableCell>
                    <EstadoOrdenBadge estado={op.estado} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {op.costoEstimado > 0 ? `$${op.costoEstimado.toFixed(2)}` : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
