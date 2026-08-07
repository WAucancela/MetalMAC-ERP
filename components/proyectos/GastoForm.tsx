'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

import { GastoSchema, type GastoInput } from '@/lib/validations/proyectos.schema';
import { useCrearGasto } from '@/hooks/useGastos';

const CATEGORIAS = [
  { value: 'MATERIALES',    label: 'Materiales' },
  { value: 'MANO_DE_OBRA',  label: 'Mano de Obra' },
  { value: 'MAQUINARIA',    label: 'Maquinaria' },
  { value: 'TRANSPORTE',    label: 'Transporte' },
  { value: 'SUBCONTRATO',   label: 'Subcontrato' },
  { value: 'ADMINISTRATIVO',label: 'Administrativo' },
  { value: 'OTRO',          label: 'Otro' },
  // 'PRODUCCION' se excluye a propósito: la genera automáticamente el sistema
  // al completar una OP con proyecto asociado (ver ordenes-produccion/[id]/route.ts),
  // no es una categoría para cargar a mano.
] as const;

interface Props {
  proyectoId: string;
  onSuccess?: () => void;
}

export function GastoForm({ proyectoId, onSuccess }: Props) {
  const crearGasto = useCrearGasto();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GastoInput>({
    resolver: zodResolver(GastoSchema),
    defaultValues: { proyectoId, categoria: 'MATERIALES' },
  });

  const onSubmit = async (data: GastoInput) => {
    try {
      await crearGasto.mutateAsync(data);
      toast.success('Gasto registrado');
      reset({ proyectoId, categoria: 'MATERIALES' });
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al registrar gasto');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register('proyectoId')} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <select
            {...register('categoria')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Monto (USD)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            {...register('monto', { valueAsNumber: true })}
          />
          {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <Input {...register('descripcion')} placeholder="Compra de perfiles 2x2 galvanizados" />
        {errors.descripcion && <p className="text-xs text-red-500">{errors.descripcion.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input type="date" {...register('fecha')} />
          {errors.fecha && <p className="text-xs text-red-500">{errors.fecha.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>ID Factura (opcional)</Label>
          <Input placeholder="ID en sistema" {...register('facturaId', { setValueAs: (v) => v || null })} />
        </div>
      </div>

      <Button type="submit" disabled={crearGasto.isPending} size="sm">
        {crearGasto.isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando…</>
          : 'Registrar Gasto'}
      </Button>
    </form>
  );
}
