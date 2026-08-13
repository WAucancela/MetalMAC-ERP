/**
 * /contabilidad/caja-chica — saldo y movimientos de caja chica
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { CajaMovimientoSchema, type CajaMovimientoInput } from '@/lib/validations/caja.schema';
import { useCajaChica, useCrearMovimientoCaja } from '@/hooks/useCajaChica';
import { useCentrosCosto } from '@/hooks/useCentrosCosto';

const SIN_CENTRO = '__sin_centro__';

function NuevoMovimientoCajaForm({ onCreado }: { onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const crear = useCrearMovimientoCaja();
  const { data: centros } = useCentrosCosto({ activo: true });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CajaMovimientoInput>({
    resolver: zodResolver(CajaMovimientoSchema),
    defaultValues: { tipo: 'EGRESO', fecha: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async (data: CajaMovimientoInput) => {
    try {
      await crear.mutateAsync(data);
      toast.success('Movimiento registrado');
      reset({ tipo: 'EGRESO', fecha: new Date().toISOString().slice(0, 10) });
      setAbierto(false);
      onCreado();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al registrar el movimiento');
    }
  };

  if (!abierto) {
    return <Button onClick={() => setAbierto(true)}><Plus className="mr-2 h-4 w-4" /> Nuevo movimiento</Button>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <select {...register('tipo')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="INGRESO">Ingreso (reposición de fondo)</option>
            <option value="EGRESO">Egreso (gasto menor)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Monto (USD)</Label>
          <Input type="number" min={0.01} step="0.01" {...register('monto', { valueAsNumber: true })} />
          {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Concepto</Label>
        <Input {...register('concepto')} placeholder="Compra de insumos de limpieza" />
        {errors.concepto && <p className="text-xs text-red-500">{errors.concepto.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <Input type="date" {...register('fecha')} />
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

      <div className="flex gap-2">
        <Button type="submit" disabled={crear.isPending}>
          {crear.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}

export default function CajaChicaPage() {
  const { data: movimientos, isLoading, refetch } = useCajaChica();
  const saldo = (movimientos ?? []).reduce((s, m) => s + (m.tipo === 'INGRESO' ? m.monto : -m.monto), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contabilidad"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Caja chica</h1>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground">Saldo actual</p>
        <p className="text-2xl font-semibold tabular-nums">${saldo.toFixed(2)}</p>
      </div>

      <NuevoMovimientoCajaForm onCreado={() => refetch()} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !movimientos || movimientos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay movimientos de caja.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-24">Tipo</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="w-28 text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-sm">{format(parseISO(m.fecha), 'dd MMM yyyy', { locale: es })}</TableCell>
                <TableCell>
                  <Badge variant={m.tipo === 'INGRESO' ? 'default' : 'secondary'}>{m.tipo}</Badge>
                </TableCell>
                <TableCell className="text-sm">{m.concepto}</TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">
                  {m.tipo === 'INGRESO' ? '+' : '-'}${m.monto.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
