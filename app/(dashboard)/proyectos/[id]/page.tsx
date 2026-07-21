'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Pencil, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ResumenPresupuesto } from '@/components/proyectos/ResumenPresupuesto';
import { GastoTable }        from '@/components/proyectos/GastoTable';
import { GastoForm }         from '@/components/proyectos/GastoForm';
import { ProyectoForm }      from '@/components/proyectos/ProyectoForm';

import { useProyecto, useEliminarProyecto } from '@/hooks/useProyectos';

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

export default function ProyectoDetallePage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const { data, isLoading } = useProyecto(id);
  const eliminar  = useEliminarProyecto();

  const [showGastoForm, setShowGastoForm] = useState(false);
  const [editMode, setEditMode]           = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Proyecto no encontrado.</p>;

  const { proyecto, gastos = [], costoReal, ordenesProduccion = [] } = data;
  const fechaInicio = tsToDate(proyecto.fechaInicio);
  const fechaFin    = tsToDate(proyecto.fechaFin);

  async function handleCancelar() {
    if (!confirm('¿Cancelar este proyecto?')) return;
    try {
      await eliminar.mutateAsync(id);
      toast.success('Proyecto cancelado');
      router.push('/proyectos');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/proyectos"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{proyecto.nombre}</h1>
            <Badge variant="secondary">{proyecto.codigo}</Badge>
            <Badge>{proyecto.estado?.replace('_', ' ')}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cliente: {proyecto.cliente}
            {fechaInicio && ` · Inicio: ${format(fechaInicio, 'dd MMM yyyy', { locale: es })}`}
            {fechaFin    && ` · Fin: ${format(fechaFin, 'dd MMM yyyy', { locale: es })}`}
          </p>
          {proyecto.descripcion && (
            <p className="text-sm mt-2 text-muted-foreground">{proyecto.descripcion}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {editMode ? 'Cancelar edición' : 'Editar'}
          </Button>
          {proyecto.estado !== 'CANCELADO' && proyecto.estado !== 'COMPLETADO' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={handleCancelar}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancelar proyecto
            </Button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="rounded-lg border p-6">
          <h2 className="text-sm font-semibold mb-4">Editar proyecto</h2>
          <ProyectoForm
            mode="edit"
            proyectoId={id}
            defaultValues={{
              nombre: proyecto.nombre,
              descripcion: proyecto.descripcion,
              cliente: proyecto.cliente,
              presupuesto: proyecto.presupuesto,
              estado: proyecto.estado,
            }}
            onSuccess={() => setEditMode(false)}
          />
        </div>
      )}

      {/* Presupuesto */}
      <div className="rounded-lg border p-6 space-y-3">
        <h2 className="text-sm font-semibold">Presupuesto</h2>
        <ResumenPresupuesto
          presupuesto={proyecto.presupuesto ?? 0}
          costoReal={costoReal ?? 0}
          costoEstimado={proyecto.costoEstimado}
        />
      </div>

      {/* OPs vinculadas */}
      {ordenesProduccion.length > 0 && (
        <div className="rounded-lg border p-6 space-y-2">
          <h2 className="text-sm font-semibold">Órdenes de Producción vinculadas</h2>
          <div className="flex flex-wrap gap-2">
            {ordenesProduccion.map((opId: string) => (
              <Link
                key={opId}
                href={`/produccion/${opId}`}
                className="text-xs font-mono bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded transition-colors"
              >
                {opId}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Gastos */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Gastos del Proyecto</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowGastoForm(!showGastoForm)}
          >
            {showGastoForm
              ? <><ChevronUp className="mr-1.5 h-3.5 w-3.5" /> Ocultar</>
              : <><Plus className="mr-1.5 h-3.5 w-3.5" /> Registrar gasto</>}
          </Button>
        </div>

        {showGastoForm && (
          <div className="rounded-md border bg-muted/40 p-4">
            <GastoForm
              proyectoId={id}
              onSuccess={() => setShowGastoForm(false)}
            />
          </div>
        )}

        <GastoTable proyectoId={id} gastos={gastos} />
      </div>
    </div>
  );
}
