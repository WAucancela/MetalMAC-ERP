/**
 * /contabilidad/bancos/[id] — movimientos de una cuenta bancaria + conciliación manual
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
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

import { MovimientoBancarioSchema, type MovimientoBancarioInput } from '@/lib/validations/bancos.schema';
import {
  useCuentasBancarias, useMovimientosBancarios, useCrearMovimientoBancario, useConciliarMovimiento,
} from '@/hooks/useBancos';

function NuevoMovimientoForm({ cuentaId, onCreado }: { cuentaId: string; onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const crear = useCrearMovimientoBancario(cuentaId);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MovimientoBancarioInput>({
    resolver: zodResolver(MovimientoBancarioSchema),
    defaultValues: { tipo: 'DEPOSITO', fecha: new Date().toISOString().slice(0, 10), descripcion: '' },
  });

  const onSubmit = async (data: MovimientoBancarioInput) => {
    try {
      await crear.mutateAsync(data);
      toast.success('Movimiento registrado');
      reset({ tipo: 'DEPOSITO', fecha: new Date().toISOString().slice(0, 10), descripcion: '' });
      setAbierto(false);
      onCreado();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al registrar el movimiento');
    }
  };

  if (!abierto) {
    return <Button onClick={() => setAbierto(true)}><Plus className="mr-2 h-4 w-4" /> Nuevo movimiento manual</Button>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <select {...register('tipo')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="DEPOSITO">Depósito</option>
            <option value="RETIRO">Retiro</option>
            <option value="AJUSTE">Ajuste</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Monto (USD)</Label>
          <Input type="number" min={0.01} step="0.01" {...register('monto', { valueAsNumber: true })} />
          {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Descripción</Label>
        <Input {...register('descripcion')} placeholder="Transferencia recibida de..." />
      </div>
      <div className="space-y-1.5">
        <Label>Fecha</Label>
        <Input type="date" {...register('fecha')} />
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

export default function CuentaBancariaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: cuentas } = useCuentasBancarias();
  const { data: movimientos, isLoading, refetch } = useMovimientosBancarios(id);
  const conciliar = useConciliarMovimiento(id);

  const cuenta = cuentas?.find((c) => c.id === id);

  async function toggleConciliado(movId: string, actual: boolean) {
    try {
      await conciliar.mutateAsync({ id: movId, conciliado: !actual });
    } catch (e: any) {
      toast.error(e.message ?? 'Error al actualizar el movimiento');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contabilidad/bancos"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{cuenta ? `${cuenta.banco} — ${cuenta.numeroCuenta}` : 'Cuenta bancaria'}</h1>
          {cuenta && <p className="text-sm text-muted-foreground">Saldo: ${cuenta.saldo.toFixed(2)}</p>}
        </div>
      </div>

      <NuevoMovimientoForm cuentaId={id} onCreado={() => refetch()} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !movimientos || movimientos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay movimientos en esta cuenta.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead className="w-36">Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-28 text-right">Monto</TableHead>
              <TableHead className="w-28 text-right">Conciliado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientos.map((m) => {
              const esIngreso = m.tipo === 'DEPOSITO' || m.tipo === 'COBRO_CLIENTE';
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{format(new Date(m.fecha), 'dd MMM yyyy', { locale: es })}</TableCell>
                  <TableCell><Badge variant="secondary">{m.tipo}</Badge></TableCell>
                  <TableCell className="text-sm">{m.descripcion || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {esIngreso ? '+' : '-'}${m.monto.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={m.conciliado ? 'default' : 'outline'}
                      disabled={conciliar.isPending}
                      onClick={() => toggleConciliado(m.id, m.conciliado)}
                    >
                      {m.conciliado ? 'Conciliado' : 'Marcar'}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
