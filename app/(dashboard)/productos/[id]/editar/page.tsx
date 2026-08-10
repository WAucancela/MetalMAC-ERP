/**
 * /productos/[id]/editar — Formulario para editar un producto existente.
 */
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { ProductoSchema, type ProductoInput } from '@/lib/validations/produccion.schema';
import { useProducto, useActualizarProducto } from '@/hooks/useProductos';
import { useUnidades } from '@/hooks/useInventario';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function EditarProductoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError } = useProducto(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !data?.producto) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-zinc-500">Producto no encontrado.</p>
        <Button variant="outline" onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  return <FormularioProducto id={id} producto={data.producto} />;
}

// Componente aparte que solo monta una vez el producto ya llegó — así el
// formulario arranca con los valores reales desde el primer render (con
// react-hook-form `useForm({ defaultValues })` en vez de `reset()` en un
// efecto posterior al mount). Los <Select> de shadcn/Radix no refrescan bien
// su texto visible cuando el `value` cambia recién después del primer render.
function FormularioProducto({ id, producto }: { id: string; producto: NonNullable<ReturnType<typeof useProducto>['data']>['producto'] }) {
  const router = useRouter();
  const { mutateAsync: actualizarProducto, isPending } = useActualizarProducto(id);
  const { data: unidades = [] } = useUnidades();

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<ProductoInput>({
    resolver: zodResolver(ProductoSchema),
    defaultValues: {
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      tipo: producto.tipo,
      unidadVenta: producto.unidadVenta,
      precioVenta: producto.precioVenta,
      activo: producto.activo,
    },
  });

  const tipo = watch('tipo');
  const unidadVenta = watch('unidadVenta');
  const activo = watch('activo');

  const onSubmit = async (input: ProductoInput) => {
    try {
      await actualizarProducto(input);
      toast.success('Producto actualizado correctamente');
      router.push(`/productos/${id}`);
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al actualizar producto');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/productos/${id}`}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Editar Producto</h1>
          <p className="text-sm text-zinc-500">{producto.codigo}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-medium text-zinc-700">Información general</h2>

          <div className="space-y-1.5">
            <Label htmlFor="codigo">Código interno *</Label>
            <Input id="codigo" placeholder="PT-001" {...register('codigo')} />
            {errors.codigo && <p className="text-xs text-red-500">{errors.codigo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" placeholder="Poste metálico 6m" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <textarea
              id="descripcion"
              rows={3}
              placeholder="Descripción detallada del producto..."
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 resize-none"
              {...register('descripcion')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setValue('tipo', v as ProductoInput['tipo'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCTO_TERMINADO">Producto Terminado</SelectItem>
                <SelectItem value="SEMIELABORADO">Semielaborado</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && <p className="text-xs text-red-500">{errors.tipo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Unidad de venta *</Label>
            <Select value={unidadVenta} onValueChange={(v) => setValue('unidadVenta', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar unidad..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNIDAD">Unidad</SelectItem>
                <SelectItem value="m²">m²</SelectItem>
                <SelectItem value="ml">ml (metro lineal)</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
                {unidades.map((u: { id: string; nombre: string; simbolo?: string }) => (
                  <SelectItem key={u.id} value={u.simbolo ?? u.nombre}>
                    {u.nombre} {u.simbolo ? `(${u.simbolo})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.unidadVenta && <p className="text-xs text-red-500">{errors.unidadVenta.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="precioVenta">Precio de venta (USD)</Label>
            <Input
              id="precioVenta"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('precioVenta', { valueAsNumber: true })}
            />
            {errors.precioVenta && <p className="text-xs text-red-500">{errors.precioVenta.message}</p>}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-3">
          <h2 className="text-sm font-medium text-zinc-700">Estado</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-300"
              checked={activo}
              onChange={(e) => setValue('activo', e.target.checked)}
            />
            Producto activo
          </label>
          <p className="text-xs text-zinc-500">
            Desmarcá esto para dejar de mostrarlo en listados y selectores (crear OP, BOM, facturas)
            sin borrar su historial. Podés volver a activarlo cuando quieras.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" asChild>
            <Link href={`/productos/${id}`}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
