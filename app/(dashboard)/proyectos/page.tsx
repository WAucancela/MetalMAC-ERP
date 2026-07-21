'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';

import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResumenPresupuesto } from '@/components/proyectos/ResumenPresupuesto';
import { useProyectos } from '@/hooks/useProyectos';

type EstadoProyecto = 'PLANIFICACION' | 'ACTIVO' | 'PAUSADO' | 'COMPLETADO' | 'CANCELADO';

const ESTADO_VARIANT: Record<EstadoProyecto, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PLANIFICACION: 'secondary',
  ACTIVO:        'default',
  PAUSADO:       'outline',
  COMPLETADO:    'outline',
  CANCELADO:     'destructive',
};

const ESTADOS: Array<{ value: EstadoProyecto | ''; label: string }> = [
  { value: '',              label: 'Todos' },
  { value: 'PLANIFICACION', label: 'Planificación' },
  { value: 'ACTIVO',        label: 'Activos' },
  { value: 'PAUSADO',       label: 'Pausados' },
  { value: 'COMPLETADO',    label: 'Completados' },
  { value: 'CANCELADO',     label: 'Cancelados' },
];

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

export default function ProyectosPage() {
  const [estado, setEstado] = useState<EstadoProyecto | ''>('ACTIVO');
  const { data: proyectos = [], isLoading } = useProyectos(estado ? { estado } : undefined);

  // KPIs globales de los proyectos visibles
  const totalPresupuesto = proyectos.reduce((s: number, p: any) => s + (p.presupuesto ?? 0), 0);
  const totalEjecutado   = proyectos.reduce((s: number, p: any) => s + (p.costoReal ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <Button asChild>
          <Link href="/proyectos/nuevo">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Proyecto
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      {!isLoading && proyectos.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Proyectos',        value: proyectos.length },
            { label: 'Presupuesto total', value: `$${totalPresupuesto.toFixed(2)}` },
            { label: 'Ejecutado total',  value: `$${totalEjecutado.toFixed(2)}` },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border p-4 text-center">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

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
      ) : proyectos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay proyectos.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/proyectos/nuevo">Crear primer proyecto</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre / Cliente</TableHead>
              <TableHead className="w-48">Presupuesto</TableHead>
              <TableHead className="w-28">Fecha inicio</TableHead>
              <TableHead className="w-28">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proyectos.map((p: any) => {
              const fecha = tsToDate(p.fechaInicio);
              return (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/proyectos/${p.id}`} className="font-mono text-sm font-medium hover:underline">
                      {p.codigo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.cliente}</p>
                  </TableCell>
                  <TableCell>
                    <ResumenPresupuesto
                      presupuesto={p.presupuesto ?? 0}
                      costoReal={p.costoReal ?? 0}
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {fecha ? format(fecha, 'dd MMM yyyy', { locale: es }) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_VARIANT[p.estado as EstadoProyecto] ?? 'secondary'}>
                      {p.estado?.replace('_', ' ')}
                    </Badge>
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
