/**
 * RegistrarDevolucionDialog — devolución parcial a proveedor sobre una factura
 * de compra ya PROCESADA. Elegís cuál de las líneas ya resueltas a material
 * devolver y cuánto; resta stock (DEVOLUCION_PROVEEDOR) sin anular el resto de
 * la factura. El server rechaza devolver más de lo que hay hoy disponible.
 */

'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useRegistrarDevolucion } from '@/hooks/useFacturas';
import type { FacturaCompra } from '@/types/metalmac.types';

interface Props {
  factura: FacturaCompra;
  onClose: () => void;
}

interface FormValues {
  materialId: string;
  cantidad: number;
}

export function RegistrarDevolucionDialog({ factura, onClose }: Props) {
  const registrar = useRegistrarDevolucion(factura.id);
  const [error, setError] = useState<string | null>(null);

  // Solo tiene sentido devolver líneas que efectivamente entraron a inventario.
  const lineasConMaterial = (factura.lineas ?? []).filter((l) => l.materialId);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { materialId: lineasConMaterial[0]?.materialId ?? '', cantidad: 1 },
  });

  const materialSeleccionado = watch('materialId');
  const lineaSeleccionada = lineasConMaterial.find((l) => l.materialId === materialSeleccionado);

  const onSubmit = async (data: FormValues) => {
    setError(null);
    try {
      await registrar.mutateAsync(data);
      toast.success('Devolución registrada');
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Error al registrar la devolución');
    }
  };

  if (lineasConMaterial.length === 0) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar devolución</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta factura no tiene líneas resueltas a un material de inventario — no hay nada que devolver.
          </p>
          <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar devolución a proveedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Material</Label>
            <Controller
              name="materialId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Elegir material" /></SelectTrigger>
                  <SelectContent>
                    {lineasConMaterial.map((l) => (
                      <SelectItem key={l.materialId} value={l.materialId as string}>
                        {l.descripcion} ({l.cantidadConvertida ?? l.cantidad} comprados)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cantidad a devolver</Label>
            <Input
              type="number" min={0.000001} step="any"
              {...register('cantidad', { valueAsNumber: true, required: true, min: 0.000001 })}
            />
            {errors.cantidad && <p className="text-xs text-red-500">Ingresá una cantidad mayor a 0</p>}
            {lineaSeleccionada && (
              <p className="text-xs text-muted-foreground">
                Se compraron {lineaSeleccionada.cantidadConvertida ?? lineaSeleccionada.cantidad} en esta factura —
                no podés devolver más de lo que hoy hay disponible en stock.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar devolución'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
