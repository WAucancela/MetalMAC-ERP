/**
 * /contabilidad/bancos — catálogo de cuentas bancarias + saldo de cada una
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { CuentaBancariaSchema, type CuentaBancariaInput } from '@/lib/validations/bancos.schema';
import { useCuentasBancarias, useCrearCuentaBancaria } from '@/hooks/useBancos';

function NuevaCuentaBancariaForm({ onCreado }: { onCreado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const crear = useCrearCuentaBancaria();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CuentaBancariaInput>({
    resolver: zodResolver(CuentaBancariaSchema),
    defaultValues: { tipoCuenta: 'CORRIENTE', saldoInicial: 0, activo: true },
  });

  const onSubmit = async (data: CuentaBancariaInput) => {
    try {
      await crear.mutateAsync(data);
      toast.success('Cuenta bancaria creada');
      reset({ tipoCuenta: 'CORRIENTE', saldoInicial: 0, activo: true });
      setAbierto(false);
      onCreado();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear la cuenta bancaria');
    }
  };

  if (!abierto) {
    return <Button onClick={() => setAbierto(true)}><Plus className="mr-2 h-4 w-4" /> Nueva cuenta</Button>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Banco</Label>
          <Input {...register('banco')} placeholder="Banco Pichincha" />
          {errors.banco && <p className="text-xs text-red-500">{errors.banco.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Número de cuenta</Label>
          <Input {...register('numeroCuenta')} />
          {errors.numeroCuenta && <p className="text-xs text-red-500">{errors.numeroCuenta.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tipo de cuenta</Label>
          <select {...register('tipoCuenta')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="CORRIENTE">Corriente</option>
            <option value="AHORROS">Ahorros</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Saldo inicial (USD)</Label>
          <Input type="number" min={0} step="0.01" {...register('saldoInicial', { valueAsNumber: true })} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={crear.isPending}>
          {crear.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Crear cuenta'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}

export default function BancosPage() {
  const { data: cuentas, isLoading, refetch } = useCuentasBancarias();
  const totalSaldo = (cuentas ?? []).reduce((s, c) => s + c.saldo, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/contabilidad"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">Bancos</h1>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground">Saldo total en bancos</p>
        <p className="text-2xl font-semibold tabular-nums">${totalSaldo.toFixed(2)}</p>
      </div>

      <NuevaCuentaBancariaForm onCreado={() => refetch()} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !cuentas || cuentas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay cuentas bancarias registradas.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>N° cuenta</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
              <TableHead className="w-28 text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuentas.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="text-sm">
                  <Link href={`/contabilidad/bancos/${c.id}`} className="hover:underline font-medium">{c.banco}</Link>
                </TableCell>
                <TableCell className="font-mono text-sm">{c.numeroCuenta}</TableCell>
                <TableCell className="text-sm">{c.tipoCuenta}</TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">${c.saldo.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
