/**
 * /inventario/nuevo — Formulario para crear un material.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateMaterialSchema, type CreateMaterialInput } from '@/lib/validations/inventario.schema';
import { useCrearMaterial } from '@/hooks/useInventario';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

export default function NuevoMaterialPage() {
  const router = useRouter();
  const { mutateAsync, isPending } = useCrearMaterial();

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<CreateMaterialInput>({
    resolver: zodResolver(CreateMaterialSchema),
    defaultValues: { activo: true, costoUnitario: 0, especificaciones: {} },
  });

  const tipo = watch('tipo');

  const onSubmit = async (data: CreateMaterialInput) => {
    try {
      const result = await mutateAsync(data);
      toast.success('Material creado correctamente');
      router.push(`/inventario/${(result as { id: string }).id}`);
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al crear material');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Nuevo material</h1>
          <p className="text-sm text-zinc-500">Complete los datos del material a registrar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6">

        {/* Identificación */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-700">Identificación</legend>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Código interno <span className="text-red-500">*</span></Label>
              <Input
                placeholder="ACX-304-3MM-1220X2440"
                {...register('codigoInterno')}
              />
              {errors.codigoInterno && (
                <p className="text-xs text-red-500">{errors.codigoInterno.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo <span className="text-red-500">*</span></Label>
              <Select onValueChange={(v) => setValue('tipo', v as CreateMaterialInput['tipo'])}>
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
            <Textarea
              rows={2}
              placeholder="Detalles adicionales del material..."
              {...register('descripcion')}
            />
          </div>
        </fieldset>

        <hr className="border-zinc-100" />

        {/* Clasificación */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-zinc-700">Clasificación</legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Grado / norma</Label>
              <Select onValueChange={(v) => setValue('grado', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar grado..." /></SelectTrigger>
                <SelectContent>
                  {GRADOS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Costo unitario (USD) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
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
            <hr className="border-zinc-100" />
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-zinc-700">Especificaciones de plancha</legend>
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
            <hr className="border-zinc-100" />
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-zinc-700">Especificaciones</legend>
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

        <hr className="border-zinc-100" />

        {/* Acciones */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : 'Crear material'}
          </Button>
        </div>
      </form>
    </div>
  );
}
