/**
 * CrearGastoDesdeFacturaDialog — registra un Gasto a partir de una factura de
 * compra que no es de materiales (combustible, servicios, etc.). No todas las
 * facturas de compra tienen líneas mapeables a inventario — esto le da un
 * destino contable (aparece en /contabilidad/gastos, reportes, centro de costo)
 * sin forzar un mapeo a material que no corresponde.
 */

'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { GastoSchema, type GastoInput } from '@/lib/validations/proyectos.schema';
import { useCrearGasto } from '@/hooks/useGastos';
import { useCentrosCosto } from '@/hooks/useCentrosCosto';
import type { FacturaCompra } from '@/types/metalmac.types';

const CATEGORIAS = [
  { value: 'TRANSPORTE',     label: 'Transporte / Combustible' },
  { value: 'MATERIALES',     label: 'Materiales' },
  { value: 'MANO_DE_OBRA',   label: 'Mano de Obra' },
  { value: 'MAQUINARIA',     label: 'Maquinaria' },
  { value: 'SUBCONTRATO',    label: 'Subcontrato' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'PRODUCCION',     label: 'Producción' },
  { value: 'OTRO',           label: 'Otro' },
] as const;

const SIN_CENTRO = '__sin_centro__';

interface Props {
  factura: FacturaCompra;
  onClose: () => void;
}

export function CrearGastoDesdeFacturaDialog({ factura, onClose }: Props) {
  const crear = useCrearGasto();
  const { data: centros } = useCentrosCosto({ activo: true });

  const { register, handleSubmit, control, formState: { errors } } = useForm<GastoInput>({
    resolver: zodResolver(GastoSchema),
    defaultValues: {
      categoria: 'TRANSPORTE',
      descripcion: `Factura ${factura.numeroFactura}`,
      monto: factura.total,
      fecha: factura.fechaEmision,
      proveedorId: factura.proveedorId,
      facturaId: factura.id,
      proyectoId: null,
      centroCostoId: null,
      ordenId: null,
      comprobante: null,
    },
  });

  const onSubmit = async (data: GastoInput) => {
    try {
      await crear.mutateAsync(data);
      toast.success('Gasto registrado');
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al registrar el gasto');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar como gasto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Label>Centro de costo (opcional)</Label>
              <Controller
                name="centroCostoId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? SIN_CENTRO} onValueChange={(v) => field.onChange(v === SIN_CENTRO ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_CENTRO}>Sin asignar</SelectItem>
                      {(centros ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input {...register('descripcion')} />
            {errors.descripcion && <p className="text-xs text-red-500">{errors.descripcion.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Monto (USD)</Label>
              <Input type="number" min={0.01} step="0.01" {...register('monto', { valueAsNumber: true })} />
              {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" {...register('fecha')} />
              {errors.fecha && <p className="text-xs text-red-500">{errors.fecha.message}</p>}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Queda vinculado a esta factura (proveedor y N° de comprobante) para trazabilidad.
          </p>

          <div className="flex gap-2">
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar gasto'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
