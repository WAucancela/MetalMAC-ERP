/**
 * BOMTable — Tabla editable de materiales de un BOM.
 *
 * Funcionalidades:
 * - Agrega / elimina líneas
 * - Muestra cantidadConMerma calculada en tiempo real
 * - Muestra costo estimado por línea (si se pasa precioMaterial)
 * - Sección de operaciones (LASER, SOLDADURA, etc.)
 * - Al guardar llama useGuardarBOM y muestra toast
 */

'use client';

import { useState, useCallback } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { Trash2, Plus, Save, Loader2 } from 'lucide-react';

import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { BOMSchema, type BOMInput } from '@/lib/validations/produccion.schema';
import { useGuardarBOM } from '@/hooks/useBOM';

// ── Tipos locales ──────────────────────────────────────────────────────────────

interface MaterialOpcion {
  id: string;
  nombre: string;
  codigo: string;
  precioUnitario?: number;
}

interface UnidadOpcion {
  id: string;
  nombre: string;
  simbolo: string;
}

interface BOMTableProps {
  productoId: string;
  initialData?: BOMInput;
  materiales: MaterialOpcion[];
  unidades: UnidadOpcion[];
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function BOMTable({ productoId, initialData, materiales, unidades }: BOMTableProps) {
  const guardarBOM = useGuardarBOM(productoId);

  const { control, register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<BOMInput>({
      resolver: zodResolver(BOMSchema),
      defaultValues: initialData ?? { lineas: [], operaciones: [] },
    });

  const { fields: lineas, append: appendLinea, remove: removeLinea } =
    useFieldArray({ control, name: 'lineas' });

  const { fields: ops, append: appendOp, remove: removeOp } =
    useFieldArray({ control, name: 'operaciones' });

  const watchLineas = watch('lineas');
  const watchOps    = watch('operaciones');

  // Costo estimado por línea (cantidad × merma × precio)
  const costoLinea = useCallback(
    (idx: number) => {
      const l = watchLineas?.[idx];
      if (!l?.materialId || !l.cantidadBase || !l.factorMerma) return null;
      const mat = materiales.find((m) => m.id === l.materialId);
      if (!mat?.precioUnitario) return null;
      return new Decimal(l.cantidadBase)
        .times(l.factorMerma)
        .times(mat.precioUnitario)
        .toDecimalPlaces(2)
        .toNumber();
    },
    [watchLineas, materiales],
  );

  // Costo total operaciones
  const costoOps = watchOps?.reduce(
    (acc, op) => acc + (op.minutos ?? 0) * (op.costoPorMinuto ?? 0),
    0,
  ) ?? 0;

  // Total BOM
  const totalBOM = (watchLineas ?? []).reduce((acc, _, i) => acc + (costoLinea(i) ?? 0), 0) + costoOps;

  const onSubmit = async (data: BOMInput) => {
    try {
      await guardarBOM.mutateAsync(data);
      toast.success('BOM guardado correctamente');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al guardar BOM');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Materiales ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Materiales</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => appendLinea({ materialId: '', cantidadBase: 1, factorMerma: 1, unidadId: '', notas: '' })}
          >
            <Plus className="mr-1 h-3 w-3" /> Agregar material
          </Button>
        </div>

        {errors.lineas?.root && (
          <p className="text-xs text-red-500">{errors.lineas.root.message}</p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="w-24">Cant. Base</TableHead>
              <TableHead className="w-24">Factor Merma</TableHead>
              <TableHead className="w-28">Cant. c/Merma</TableHead>
              <TableHead className="w-32">Unidad</TableHead>
              <TableHead className="w-28 text-right">Costo est.</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Sin materiales — agrega al menos uno.
                </TableCell>
              </TableRow>
            )}
            {lineas.map((field, idx) => {
              const cantBase   = Number(watchLineas?.[idx]?.cantidadBase ?? 1);
              const merma      = Number(watchLineas?.[idx]?.factorMerma ?? 1);
              const cantMerma  = new Decimal(cantBase).times(merma).toDecimalPlaces(4).toNumber();
              const costo      = costoLinea(idx);

              return (
                <TableRow key={field.id}>
                  {/* Material */}
                  <TableCell>
                    <select
                      {...register(`lineas.${idx}.materialId`)}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                    >
                      <option value="">Seleccionar…</option>
                      {materiales.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.codigo} — {m.nombre}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  {/* Cantidad base */}
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      className="h-8 text-sm"
                      {...register(`lineas.${idx}.cantidadBase`, { valueAsNumber: true })}
                    />
                  </TableCell>
                  {/* Factor merma */}
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min={1}
                      max={3}
                      className="h-8 text-sm"
                      {...register(`lineas.${idx}.factorMerma`, { valueAsNumber: true })}
                    />
                  </TableCell>
                  {/* Calculada */}
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {cantMerma}
                  </TableCell>
                  {/* Unidad */}
                  <TableCell>
                    <select
                      {...register(`lineas.${idx}.unidadId`)}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                    >
                      <option value="">—</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.simbolo}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  {/* Costo */}
                  <TableCell className="text-right text-sm tabular-nums">
                    {costo !== null ? `$${costo.toFixed(2)}` : '—'}
                  </TableCell>
                  {/* Eliminar */}
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLinea(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Operaciones ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Operaciones</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => appendOp({ tipo: 'ENSAMBLE', minutos: 0, costoPorMinuto: 0 })}
          >
            <Plus className="mr-1 h-3 w-3" /> Agregar operación
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-28">Minutos</TableHead>
              <TableHead className="w-32">$/min</TableHead>
              <TableHead className="w-28 text-right">Costo</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ops.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                  Sin operaciones
                </TableCell>
              </TableRow>
            )}
            {ops.map((field, idx) => {
              const mins = Number(watchOps?.[idx]?.minutos ?? 0);
              const cpm  = Number(watchOps?.[idx]?.costoPorMinuto ?? 0);
              return (
                <TableRow key={field.id}>
                  <TableCell>
                    <select
                      {...register(`operaciones.${idx}.tipo`)}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                    >
                      {(['LASER', 'SOLDADURA', 'DOBLADO', 'ENSAMBLE'] as const).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="h-8 text-sm"
                      {...register(`operaciones.${idx}.minutos`, { valueAsNumber: true })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 text-sm"
                      {...register(`operaciones.${idx}.costoPorMinuto`, { valueAsNumber: true })}
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    ${(mins * cpm).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeOp(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm">
          Costo total estimado:{' '}
          <span className="font-semibold tabular-nums">${totalBOM.toFixed(2)}</span>
        </p>
        <Button type="submit" disabled={guardarBOM.isPending}>
          {guardarBOM.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Guardar BOM</>
          )}
        </Button>
      </div>
    </form>
  );
}
