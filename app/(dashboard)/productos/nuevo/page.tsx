/**
 * /productos/nuevo — Formulario para crear un nuevo producto.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { ProductoSchema, type ProductoInput } from '@/lib/validations/produccion.schema';
import { useCrearProducto } from '@/hooks/useProductos';
import { useUnidades } from '@/hooks/useInventario';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function NuevoProductoPage() {
  const router = useRouter();
  const { mutateAsync: crearProducto } = useCrearProducto();
  const { data: unidades = [] } = useUnidades();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductoInput>({
    resolver: zodResolver(ProductoSchema),
    defaultValues: {
      tipo:        'PRODUCTO_TERMINADO',
      precioVenta: 0,
      activo:      true,
      descripcion: '',
    },
  });

  const onSubmit = async (data: ProductoInput) => {
    setSaving(true);
    try {
      const result = await crearProducto(data);
      toast.success('Producto creado correctamente');
      // Redirigir al detalle para poder definir el BOM
      router.push(`/productos/${result.id ?? result.data?.id}`);
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al crear producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/productos">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nuevo Producto</h1>
          <p className="text-sm text-muted-foreground">
            Completa los datos básicos. Después podrás definir el BOM.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <h2 className="text-sm font-medium text-foreground">Información general</h2>

          {/* Código */}
          <div className="space-y-1.5">
            <Label htmlFor="codigo">Código interno *</Label>
            <Input
              id="codigo"
              placeholder="PT-001"
              {...register('codigo')}
            />
            {errors.codigo && (
              <p className="text-xs text-red-500">{errors.codigo.message}</p>
            )}
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              placeholder="Poste metálico 6m"
              {...register('nombre')}
            />
            {errors.nombre && (
              <p className="text-xs text-red-500">{errors.nombre.message}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <textarea
              id="descripcion"
              rows={3}
              placeholder="Descripción detallada del producto..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none"
              {...register('descripcion')}
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select
              defaultValue="PRODUCTO_TERMINADO"
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
            {errors.tipo && (
              <p className="text-xs text-red-500">{errors.tipo.message}</p>
            )}
          </div>

          {/* Unidad de venta */}
          <div className="space-y-1.5">
            <Label>Unidad de venta *</Label>
            <Select onValueChange={(v) => setValue('unidadVenta', v)}>
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
            {errors.unidadVenta && (
              <p className="text-xs text-red-500">{errors.unidadVenta.message}</p>
            )}
          </div>

          {/* Precio de venta */}
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
            {errors.precioVenta && (
              <p className="text-xs text-red-500">{errors.precioVenta.message}</p>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" asChild>
            <Link href="/productos">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Guardando…' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
