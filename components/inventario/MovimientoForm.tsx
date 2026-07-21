'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMovimientoSchema, type CreateMovimientoInput } from '@/lib/validations/inventario.schema';
import { useRegistrarMovimiento } from '@/hooks/useInventario';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const TIPOS_MOVIMIENTO = [
  { value: 'ENTRADA',          label: 'Entrada de material' },
  { value: 'SALIDA',           label: 'Salida de material' },
  { value: 'AJUSTE_POSITIVO',  label: 'Ajuste positivo' },
  { value: 'AJUSTE_NEGATIVO',  label: 'Ajuste negativo' },
  { value: 'RESERVA',          label: 'Reservar para OP' },
  { value: 'LIBERACION',       label: 'Liberar reserva' },
  { value: 'MERMA',            label: 'Merma / scrap' },
  { value: 'DEVOLUCION',       label: 'Devolución a bodega' },
] as const;

const TIPOS_DOCUMENTO = [
  { value: 'FACTURA_COMPRA',    label: 'Factura de compra' },
  { value: 'ORDEN_PRODUCCION',  label: 'Orden de producción' },
  { value: 'AJUSTE_MANUAL',     label: 'Ajuste manual' },
] as const;

interface Props {
  materialId: string;
  onSuccess?: () => void;
}

export function MovimientoForm({ materialId, onSuccess }: Props) {
  const { mutateAsync, isPending } = useRegistrarMovimiento();

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors }, reset,
  } = useForm<CreateMovimientoInput>({
    resolver: zodResolver(CreateMovimientoSchema),
    defaultValues: {
      materialId,
      costoUnitario: 0,
      documentoTipo: 'AJUSTE_MANUAL',
    },
  });

  const onSubmit = async (data: CreateMovimientoInput) => {
    try {
      await mutateAsync(data);
      toast.success('Movimiento registrado correctamente');
      reset();
      onSuccess?.();
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al registrar movimiento');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Tipo de movimiento */}
      <div className="space-y-1.5">
        <Label>Tipo de movimiento</Label>
        <Select onValueChange={(v) => setValue('tipo', v as CreateMovimientoInput['tipo'])}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tipo..." />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_MOVIMIENTO.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.tipo && <p className="text-xs text-red-500">{errors.tipo.message}</p>}
      </div>

      {/* Cantidad + Costo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Cantidad</Label>
          <Input
            type="number"
            step="0.001"
            placeholder="0.000"
            {...register('cantidad', { valueAsNumber: true })}
          />
          {errors.cantidad && <p className="text-xs text-red-500">{errors.cantidad.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Costo unitario (USD)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('costoUnitario', { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Documento */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tipo documento</Label>
          <Select
            defaultValue="AJUSTE_MANUAL"
            onValueChange={(v) => setValue('documentoTipo', v as CreateMovimientoInput['documentoTipo'])}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>N° referencia</Label>
          <Input placeholder="REF-001" {...register('numeroReferencia')} />
          {errors.numeroReferencia && (
            <p className="text-xs text-red-500">{errors.numeroReferencia.message}</p>
          )}
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label>Notas <span className="text-zinc-400">(opcional)</span></Label>
        <Textarea rows={2} placeholder="Observaciones..." {...register('notas')} />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Registrando...' : 'Registrar movimiento'}
      </Button>
    </form>
  );
}
