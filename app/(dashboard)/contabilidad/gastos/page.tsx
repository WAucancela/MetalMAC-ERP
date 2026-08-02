/**
 * /contabilidad/gastos — Gastos generales (con o sin proyecto asociado).
 * Reusa el mismo schema/endpoint/hook que los gastos embebidos en el detalle
 * de proyecto (GastoSchema, useGastos/useCrearGasto, /api/gastos) — solo la
 * presentación es distinta acá (listado plano filtrable, no agrupado).
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { GastoSchema, type GastoInput } from '@/lib/validations/proyectos.schema';
import { useGastos, useCrearGasto } from '@/hooks/useGastos';
import { useCentrosCosto } from '@/hooks/useCentrosCosto';

const CATEGORIAS = [
  { value: 'MATERIALES',     label: 'Materiales' },
  { value: 'MANO_DE_OBRA',   label: 'Mano de Obra' },
  { value: 'MAQUINARIA',     label: 'Maquinaria' },
  { value: 'TRANSPORTE',     label: 'Transporte' },
  { value: 'SUBCONTRATO',    label: 'Subcontrato' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'OTRO',           label: 'Otro' },
] as const;

const SIN_CENTRO = '__sin_centro__';

function NuevoGastoGeneralForm({ onCreado }: { onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const crear = useCrearGasto();
  const { data: centros } = useCentrosCosto({ activo: true });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<GastoInput>({
    resolver: zodResolver(GastoSchema),
    defaultValues: { categoria: 'ADMINISTRATIVO', fecha: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async (data: GastoInput) => {
    try {
      await crear.mutateAsync(data);
      toast.success('Gasto registrado');
      reset({ categoria: 'ADMINISTRATIVO', fecha: new Date().toISOString().slice(0, 10) });
      setAbierto(false);
      onCreado();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al registrar gasto');
    }
  };

  if (!abierto) {
    return (
      <Button onClick={() => setAbierto(true)}>
        <Plus className="mr-2 h-4 w-4" /> Nuevo gasto
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
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
              <Select
                value={field.value ?? SIN_CENTRO}
                onValueChange={(v) => field.onChange(v === SIN_CENTRO ? null : v)}
              >
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
        <Input {...register('descripcion')} placeholder="Servicio de internet del taller" />
        {errors.descripcion && <p className="text-xs text-red-500">{errors.descripcion.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Monto (USD)</Label>
          <Input type="number" min={0} step="0.01" placeholder="0.00" {...register('monto', { valueAsNumber: true })} />
          {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input type="date" {...register('fecha')} />
          {errors.fecha && <p className="text-xs text-red-500">{errors.fecha.message}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={crear.isPending}>
          {crear.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar gasto'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}

export default function GastosGeneralesPage() {
  const [centroCostoId, setCentroCostoId] = useState<string>('');
  const { data: centros } = useCentrosCosto({ activo: true });
  const { data: gastos, isLoading, refetch } = useGastos(
    centroCostoId ? { centroCostoId } : undefined,
  );

  const total = (gastos ?? []).reduce((s: number, g: any) => s + g.monto, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contabilidad"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Gastos</h1>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <NuevoGastoGeneralForm onCreado={() => refetch()} />
        <Select value={centroCostoId || '__todos__'} onValueChange={(v) => setCentroCostoId(v === '__todos__' ? '' : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por centro de costo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos__">Todos los centros de costo</SelectItem>
            {(centros ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !gastos || gastos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay gastos registrados con este filtro.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Fecha</TableHead>
                <TableHead className="w-36">Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-28">Proyecto</TableHead>
                <TableHead className="w-28 text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gastos.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell className="text-sm">
                    {format(new Date(g.fecha), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm">{g.categoria}</TableCell>
                  <TableCell className="text-sm">{g.descripcion}</TableCell>
                  <TableCell>
                    {g.proyectoId
                      ? <Link href={`/proyectos/${g.proyectoId}`} className="text-xs text-blue-600 hover:underline">Ver</Link>
                      : <Badge variant="secondary" className="text-[10px]">General</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    ${g.monto.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t pt-3">
            <p className="text-sm font-semibold">
              Total: <span className="tabular-nums">${total.toFixed(2)}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
