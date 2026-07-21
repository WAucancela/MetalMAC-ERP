'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

import { ProyectoSchema, type ProyectoInput } from '@/lib/validations/proyectos.schema';
import { useCrearProyecto, useActualizarProyecto } from '@/hooks/useProyectos';

interface Props {
  mode?: 'create' | 'edit';
  proyectoId?: string;
  defaultValues?: Partial<ProyectoInput>;
  onSuccess?: (id: string) => void;
}

export function ProyectoForm({ mode = 'create', proyectoId, defaultValues, onSuccess }: Props) {
  const router        = useRouter();
  const crear         = useCrearProyecto();
  const actualizar    = useActualizarProyecto(proyectoId ?? '');
  const isPending     = crear.isPending || actualizar.isPending;

  const { register, handleSubmit, formState: { errors } } = useForm<ProyectoInput>({
    resolver: zodResolver(ProyectoSchema),
    defaultValues: {
      estado: 'PLANIFICACION',
      ordenesProduccion: [],
      descripcion: '',
      fechaFin: null,
      ...defaultValues,
    },
  });

  const onSubmit = async (data: ProyectoInput) => {
    try {
      if (mode === 'create') {
        const result = await crear.mutateAsync(data);
        toast.success(`Proyecto ${result.codigo} creado`);
        onSuccess ? onSuccess(result.id) : router.push(`/proyectos/${result.id}`);
      } else {
        await actualizar.mutateAsync(data);
        toast.success('Proyecto actualizado');
        onSuccess?.(proyectoId!);
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Error al guardar proyecto');
    }
  };

  const ESTADOS = ['PLANIFICACION', 'ACTIVO', 'PAUSADO', 'COMPLETADO', 'CANCELADO'] as const;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label>Nombre</Label>
        <Input {...register('nombre')} placeholder="Proyecto Alumbrado Vía Perimetral" />
        {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Cliente</Label>
        <Input {...register('cliente')} placeholder="Municipio de Guayaquil" />
        {errors.cliente && <p className="text-xs text-red-500">{errors.cliente.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          {...register('descripcion')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Presupuesto (USD)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            {...register('presupuesto', { valueAsNumber: true })}
          />
          {errors.presupuesto && <p className="text-xs text-red-500">{errors.presupuesto.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Estado</Label>
          <select
            {...register('estado')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Fecha inicio</Label>
          <Input type="date" {...register('fechaInicio')} />
          {errors.fechaInicio && <p className="text-xs text-red-500">{errors.fechaInicio.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Fecha fin (opcional)</Label>
          <Input type="date" {...register('fechaFin', { setValueAs: (v) => v || null })} />
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>
          : mode === 'create' ? 'Crear Proyecto' : 'Guardar Cambios'}
      </Button>
    </form>
  );
}
