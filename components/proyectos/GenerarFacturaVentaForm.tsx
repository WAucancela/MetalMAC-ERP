/**
 * GenerarFacturaVentaForm — crea una factura de venta en BORRADOR ligada a un proyecto
 * (Fase 1: solo registro, la emisión electrónica real todavía se hace por fuera del ERP).
 */

'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

import { FacturaVentaSchema, type FacturaVentaInput } from '@/lib/validations/ventas.schema';
import { useCrearFacturaVenta } from '@/hooks/useFacturasVenta';

interface Props {
  proyectoId: string;
  clienteNombreSugerido?: string;
  onSuccess?: (id: string) => void;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export function GenerarFacturaVentaForm({ proyectoId, clienteNombreSugerido, onSuccess }: Props) {
  const crear = useCrearFacturaVenta();

  const { register, control, handleSubmit, formState: { errors } } = useForm<FacturaVentaInput>({
    resolver: zodResolver(FacturaVentaSchema),
    defaultValues: {
      proyectoId,
      clienteNombre: clienteNombreSugerido ?? '',
      clienteRuc: '',
      clienteEmail: '',
      fechaEmision: hoyISO(),
      lineas: [{ descripcion: '', cantidad: 1, precioUnitario: 0, ordenProduccionId: null }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineas' });

  const onSubmit = async (data: FacturaVentaInput) => {
    try {
      const result = await crear.mutateAsync(data);
      toast.success('Factura de venta creada en borrador');
      onSuccess?.(result.id);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear la factura');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Input {...register('clienteNombre')} placeholder="Nombre o razón social" />
          {errors.clienteNombre && <p className="text-xs text-red-500">{errors.clienteNombre.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>RUC / cédula</Label>
          <Input {...register('clienteRuc')} placeholder="1234567890" />
          {errors.clienteRuc && <p className="text-xs text-red-500">{errors.clienteRuc.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Email del cliente</Label>
          <Input type="email" {...register('clienteEmail')} placeholder="cliente@empresa.com" />
          {errors.clienteEmail && <p className="text-xs text-red-500">{errors.clienteEmail.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Fecha de emisión</Label>
          <Input type="date" {...register('fechaEmision')} />
          {errors.fechaEmision && <p className="text-xs text-red-500">{errors.fechaEmision.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Líneas</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ descripcion: '', cantidad: 1, precioUnitario: 0, ordenProduccionId: null })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar línea
          </Button>
        </div>

        {fields.map((field, i) => (
          <div key={field.id} className="grid grid-cols-[1fr_5rem_7rem_auto] gap-2 items-start">
            <div>
              <Input {...register(`lineas.${i}.descripcion`)} placeholder="Descripción" />
              {errors.lineas?.[i]?.descripcion && (
                <p className="text-xs text-red-500">{errors.lineas[i]?.descripcion?.message}</p>
              )}
            </div>
            <Input
              type="number" min={0} step="0.01"
              {...register(`lineas.${i}.cantidad`, { valueAsNumber: true })}
              placeholder="Cant."
            />
            <Input
              type="number" min={0} step="0.01"
              {...register(`lineas.${i}.precioUnitario`, { valueAsNumber: true })}
              placeholder="P. unit."
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={fields.length === 1}
              onClick={() => remove(i)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {errors.lineas?.root && <p className="text-xs text-red-500">{errors.lineas.root.message}</p>}
      </div>

      <Button type="submit" disabled={crear.isPending} size="sm">
        {crear.isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</>
          : 'Crear factura en borrador'}
      </Button>
    </form>
  );
}
