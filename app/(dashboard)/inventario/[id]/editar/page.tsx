/**
 * /inventario/[id]/editar — Formulario para editar un material existente.
 */
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UpdateMaterialSchema, type UpdateMaterialInput } from '@/lib/validations/inventario.schema';
import { useMaterial, useActualizarMaterial, useCategorias, useUnidades } from '@/hooks/useInventario';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

const TIPOS = [
  { value: 'PLANCHA',    label: 'Plancha (acero, inoxidable)' },
  { value: 'TUBO',       label: 'Tubo (cuadrado, rectangular)' },
  { value: 'PERFIL',     label: 'Perfil estructural (ángulo, canal, HEB)' },
  { value: 'VARILLA',    label: 'Varilla o barra' },
  { value: 'CONSUMIBLE', label: 'Consumible (electrodo, disco, pintura)' },
] as const;

const GRADOS = ['AISI 304', 'AISI 316', 'A36', 'A572', 'ASTM A53', 'Otro'];

export default function EditarMaterialPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError } = useMaterial(id);
  const { mutateAsync, isPending } = useActualizarMaterial(id);
  const { data: categorias = [] } = useCategorias();
  const { data: unidades = [] } = useUnidades();

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors },
  } = useForm<UpdateMaterialInput>({
    resolver: zodResolver(UpdateMaterialSchema),
  });

  const tipo = watch('tipo');

  // Precarga el formulario una vez que llega el material.
  useEffect(() => {
    if (!data?.material) return;
    const m = data.material;
    reset({
      codigoInterno: m.codigoInterno,
      nombre: m.nombre,
      descripcion: m.descripcion,
      tipo: m.tipo,
      categoriaId: m.categoriaId,
      grado: m.grado,
      unidadBaseId: m.unidadBaseId,
      costoUnitario: m.costoUnitario,
      especificaciones: m.especificaciones ?? {},
      activo: m.activo,
    });
  }, [data, reset]);

  const onSubmit = async (input: UpdateMaterialInput) => {
    try {
      await mutateAsync(input);
      toast.success('Material actualizado correctamente');
      router.push(`/inventario/${id}`);
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al actualizar material');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-muted-foreground">Material no encontrado.</p>
        <Button variant="outline" onClick={() => router.back()}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Editar material</h1>
          <p className="text-sm text-muted-foreground">{data.material.codigoInterno}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-lg border border-border bg-card p-6">

        {/* Identificación */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Identificación</legend>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Código interno <span className="text-red-500">*</span></Label>
              <Input placeholder="ACX-304-3MM-1220X2440" {...register('codigoInterno')} />
              {errors.codigoInterno && (
                <p className="text-xs text-red-500">{errors.codigoInterno.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo <span className="text-red-500">*</span></Label>
              <Select value={tipo} onValueChange={(v) => setValue('tipo', v as UpdateMaterialInput['tipo'])}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipo && <p className="text-xs text-red-500">{errors.tipo.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nombre <span className="text-red-500">*</span></Label>
            <Input placeholder="Plancha AISI 304 3mm 1220×2440" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea rows={2} placeholder="Detalles adicionales del material..." {...register('descripcion')} />
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* Clasificación */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Clasificación</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoría <span className="text-red-500">*</span></Label>
              <Select value={watch('categoriaId')} onValueChange={(v) => setValue('categoriaId', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoriaId && <p className="text-xs text-red-500">{errors.categoriaId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Unidad base <span className="text-red-500">*</span></Label>
              <Select value={watch('unidadBaseId')} onValueChange={(v) => setValue('unidadBaseId', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar unidad..." /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unidadBaseId && <p className="text-xs text-red-500">{errors.unidadBaseId.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Grado / norma</Label>
              <Select value={watch('grado') || undefined} onValueChange={(v) => setValue('grado', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar grado..." /></SelectTrigger>
                <SelectContent>
                  {GRADOS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Costo unitario (USD) <span className="text-red-500">*</span></Label>
              <Input
                type="number" step="0.01" min="0" placeholder="0.00"
                {...register('costoUnitario', { valueAsNumber: true })}
              />
              {errors.costoUnitario && (
                <p className="text-xs text-red-500">{errors.costoUnitario.message}</p>
              )}
            </div>
          </div>
        </fieldset>

        {/* Especificaciones dinámicas por tipo */}
        {tipo === 'PLANCHA' && (
          <>
            <hr className="border-border" />
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground">Especificaciones de plancha</legend>
              <div className="grid grid-cols-3 gap-4">
                {(['anchoMm', 'largoMm', 'espesorMm'] as const).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label>
                      {field === 'anchoMm' ? 'Ancho (mm)' : field === 'largoMm' ? 'Largo (mm)' : 'Espesor (mm)'}
                    </Label>
                    <Input
                      type="number" step="0.1" min="0"
                      {...register(`especificaciones.${field}` as never, { valueAsNumber: true })}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Peso kg/m²</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    {...register('especificaciones.pesoKgM2' as never, { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Acabado</Label>
                  <Input placeholder="2B, laminado en frío..." {...register('especificaciones.acabado' as never)} />
                </div>
              </div>
            </fieldset>
          </>
        )}

        {(tipo === 'TUBO' || tipo === 'PERFIL' || tipo === 'VARILLA') && (
          <>
            <hr className="border-border" />
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-foreground">Especificaciones</legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Longitud nominal (mm)</Label>
                  <Input
                    type="number" step="1" min="0"
                    {...register('especificaciones.longitudNominalMm' as never, { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Peso kg/m</Label>
                  <Input
                    type="number" step="0.001" min="0"
                    {...register('especificaciones.pesoKgM' as never, { valueAsNumber: true })}
                  />
                </div>
              </div>
            </fieldset>
          </>
        )}

        <hr className="border-border" />

        {/* Acciones */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}
