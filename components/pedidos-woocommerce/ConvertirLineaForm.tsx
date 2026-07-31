/**
 * ConvertirLineaForm — convierte una línea de un pedido WooCommerce en una Orden de
 * Producción. Modelado sobre components/produccion/OrdenForm.tsx (mismo picker de
 * producto, mismo patrón de envío/estado), con el producto pre-seleccionado si el SKU
 * de la línea ya matcheó contra un `productos.codigo` al ingerir el webhook.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

import { ConvertirLineaPedidoSchema, type ConvertirLineaPedidoInput } from '@/lib/validations/pedidos-woocommerce.schema';
import { useProductos } from '@/hooks/useProductos';
import { useConvertirLineaPedido } from '@/hooks/usePedidosWooCommerce';
import type { LineaPedidoWooCommerce } from '@/types/metalmac.types';

interface ConvertirLineaFormProps {
  pedidoId: string;
  linea: LineaPedidoWooCommerce;
  onConvertida?: (ordenId: string, codigo: string) => void;
}

export function ConvertirLineaForm({ pedidoId, linea, onConvertida }: ConvertirLineaFormProps) {
  const convertir = useConvertirLineaPedido(pedidoId, linea.id);
  const { data: productos = [], isLoading: loadingProductos } = useProductos({
    tipo: 'PRODUCTO_TERMINADO',
    activo: true,
  });

  const [abierto, setAbierto] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ConvertirLineaPedidoInput>({
    resolver: zodResolver(ConvertirLineaPedidoSchema),
    defaultValues: {
      productoId: linea.productoId ?? '',
      cantidad: Math.max(1, Math.round(linea.cantidad)),
      notas: `Pedido web ${pedidoId} — línea "${linea.nombreProducto}" (SKU ${linea.sku || 's/n'})`,
    },
  });

  const onSubmit = async (data: ConvertirLineaPedidoInput) => {
    try {
      const result = await convertir.mutateAsync(data);
      toast.success(`Orden ${result.codigo} creada`);
      onConvertida?.(result.ordenId, result.codigo);
      setAbierto(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al convertir línea');
    }
  };

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        Convertir a Orden de Producción
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
      <div className="space-y-1.5">
        <Label htmlFor={`producto-${linea.id}`}>Producto</Label>
        {loadingProductos ? (
          <p className="text-sm text-muted-foreground">Cargando productos…</p>
        ) : (
          <select
            id={`producto-${linea.id}`}
            {...register('productoId')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleccionar producto…</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </select>
        )}
        {linea.productoId && (
          <p className="text-xs text-muted-foreground">Pre-seleccionado por coincidencia de SKU ({linea.sku})</p>
        )}
        {errors.productoId && <p className="text-xs text-red-500">{errors.productoId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`cantidad-${linea.id}`}>Cantidad</Label>
          <Input
            id={`cantidad-${linea.id}`}
            type="number"
            min={1}
            step={1}
            {...register('cantidad', { valueAsNumber: true })}
          />
          {errors.cantidad && <p className="text-xs text-red-500">{errors.cantidad.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`fecha-${linea.id}`}>Fecha de entrega</Label>
          <Input id={`fecha-${linea.id}`} type="date" {...register('fechaEntrega')} />
          {errors.fechaEntrega && <p className="text-xs text-red-500">{errors.fechaEntrega.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`proyecto-${linea.id}`}>Proyecto (opcional)</Label>
        <Input id={`proyecto-${linea.id}`} placeholder="ID del proyecto" {...register('proyectoId')} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={convertir.isPending}>
          {convertir.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</>
            : 'Crear Orden de Producción'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
