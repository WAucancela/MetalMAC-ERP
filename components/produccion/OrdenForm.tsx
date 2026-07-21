/**
 * OrdenForm — Formulario para crear una nueva Orden de Producción.
 *
 * Flujo:
 * 1. Seleccionar producto (filtra solo PRODUCTO_TERMINADO + activo)
 * 2. Ingresar cantidad y fecha de entrega
 * 3. Muestra validación de stock en tiempo real al elegir producto + cantidad
 * 4. Submit → POST /api/ordenes-produccion → redirige a detalle de la OP
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

import { CrearOrdenSchema, type CrearOrdenInput } from '@/lib/validations/produccion.schema';
import { useProductos } from '@/hooks/useProductos';
import { useCrearOrden } from '@/hooks/useOrdenes';
import { useAuth } from '@/hooks/useAuth';

// ── Componente ─────────────────────────────────────────────────────────────────

export function OrdenForm() {
  const router    = useRouter();
  const crearOrden = useCrearOrden();
  const { token } = useAuth();

  const { data: productos = [], isLoading: loadingProductos } = useProductos({
    tipo: 'PRODUCTO_TERMINADO',
    activo: true,
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CrearOrdenInput>({
    resolver: zodResolver(CrearOrdenSchema),
    defaultValues: { cantidad: 1, notas: '' },
  });

  const productoId = watch('productoId');
  const cantidad   = watch('cantidad');

  // Validación de stock contra el BOM — llamada al API
  const [stockState, setStockState] = useState<
    'idle' | 'checking' | 'ok' | 'insuficiente'
  >('idle');
  const [faltantes, setFaltantes] = useState<{ materialId: string; nombre?: string; faltante: number }[]>([]);

  useEffect(() => {
    if (!token || !productoId || !cantidad || cantidad < 1) {
      setStockState('idle');
      return;
    }

    setStockState('checking');
    const controller = new AbortController();

    // Llamar al endpoint de detalle de producto con ?validarStock=cantidad
    fetch(`/api/productos/${productoId}?validarStock=${cantidad}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.validacion?.valido === false) {
          setStockState('insuficiente');
          setFaltantes(json.validacion.faltantes ?? []);
        } else {
          setStockState('ok');
          setFaltantes([]);
        }
      })
      .catch(() => setStockState('idle'));

    return () => controller.abort();
  }, [token, productoId, cantidad]);

  const onSubmit = async (data: CrearOrdenInput) => {
    if (stockState === 'insuficiente') {
      toast.error('No hay stock suficiente para iniciar esta orden.');
      return;
    }
    try {
      const result = await crearOrden.mutateAsync(data);
      toast.success(`Orden ${result.codigo} creada`);
      router.push(`/produccion/${result.id}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear orden');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">

      {/* Producto */}
      <div className="space-y-1.5">
        <Label htmlFor="productoId">Producto</Label>
        {loadingProductos ? (
          <p className="text-sm text-muted-foreground">Cargando productos…</p>
        ) : (
          <select
            id="productoId"
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
        {errors.productoId && (
          <p className="text-xs text-red-500">{errors.productoId.message}</p>
        )}
      </div>

      {/* Cantidad */}
      <div className="space-y-1.5">
        <Label htmlFor="cantidad">Cantidad</Label>
        <Input
          id="cantidad"
          type="number"
          min={1}
          step={1}
          {...register('cantidad', { valueAsNumber: true })}
        />
        {errors.cantidad && (
          <p className="text-xs text-red-500">{errors.cantidad.message}</p>
        )}
      </div>

      {/* Validación de stock en tiempo real */}
      {stockState === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando disponibilidad de materiales…
        </div>
      )}
      {stockState === 'ok' && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          Stock disponible para {cantidad} unidades
        </div>
      )}
      {stockState === 'insuficiente' && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Stock insuficiente — materiales faltantes:
          </div>
          <ul className="ml-6 text-xs text-amber-700 space-y-0.5 list-disc">
            {faltantes.map((f) => (
              <li key={f.materialId}>
                {f.nombre ?? f.materialId}: faltan {f.faltante.toFixed(4)} unidades
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fecha de entrega */}
      <div className="space-y-1.5">
        <Label htmlFor="fechaEntrega">Fecha de entrega</Label>
        <Input
          id="fechaEntrega"
          type="date"
          {...register('fechaEntrega')}
        />
        {errors.fechaEntrega && (
          <p className="text-xs text-red-500">{errors.fechaEntrega.message}</p>
        )}
      </div>

      {/* Proyecto (opcional) */}
      <div className="space-y-1.5">
        <Label htmlFor="proyectoId">Proyecto (opcional)</Label>
        <Input
          id="proyectoId"
          placeholder="ID del proyecto"
          {...register('proyectoId')}
        />
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas</Label>
        <textarea
          id="notas"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          {...register('notas')}
        />
      </div>

      <Button
        type="submit"
        disabled={crearOrden.isPending || stockState === 'insuficiente'}
        className="w-full"
      >
        {crearOrden.isPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</>
          : 'Crear Orden de Producción'}
      </Button>
    </form>
  );
}
