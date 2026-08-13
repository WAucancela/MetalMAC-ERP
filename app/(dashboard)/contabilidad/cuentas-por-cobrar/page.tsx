/**
 * /contabilidad/cuentas-por-cobrar — facturas de venta EMITIDAS con saldo pendiente
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButton } from '@/components/ui/ExportButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AntiguedadBadge } from '@/components/contabilidad/AntiguedadBadge';
import { RegistrarPagoForm } from '@/components/contabilidad/RegistrarPagoForm';
import { useCuentasPorCobrar, useRegistrarCobroVenta, type CuentaPorCobrar } from '@/hooks/useCuentasPorCobrar';
import type { RegistrarPagoInput } from '@/lib/validations/finanzas.schema';

function FilaCuentaPorCobrar({ cuenta }: { cuenta: CuentaPorCobrar }) {
  const [abierto, setAbierto] = useState(false);
  const registrar = useRegistrarCobroVenta(cuenta.id);

  async function handleSubmit(data: RegistrarPagoInput) {
    try {
      await registrar.mutateAsync(data);
      toast.success('Cobro registrado');
      setAbierto(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al registrar el cobro');
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-sm">{cuenta.numeroFactura || '—'}</TableCell>
        <TableCell className="text-sm">{cuenta.clienteNombre}</TableCell>
        <TableCell className="text-sm">
          {cuenta.fechaVencimiento ? format(parseISO(cuenta.fechaVencimiento), 'dd MMM yyyy', { locale: es }) : '—'}
        </TableCell>
        <TableCell><AntiguedadBadge bucket={cuenta.antiguedad} /></TableCell>
        <TableCell className="text-right tabular-nums text-sm font-medium">${cuenta.saldo.toFixed(2)}</TableCell>
        <TableCell className="text-right">
          <Button size="sm" variant="outline" onClick={() => setAbierto((v) => !v)}>
            Registrar cobro
          </Button>
        </TableCell>
      </TableRow>
      {abierto && (
        <TableRow>
          <TableCell colSpan={6}>
            <RegistrarPagoForm
              saldoMaximo={cuenta.saldo}
              isPending={registrar.isPending}
              onSubmit={handleSubmit}
              onCancelar={() => setAbierto(false)}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function CuentasPorCobrarPage() {
  const { data: cuentas, isLoading } = useCuentasPorCobrar();
  const total = (cuentas ?? []).reduce((s, c) => s + c.saldo, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/contabilidad"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold">Cuentas por cobrar</h1>
        </div>
        <ExportButton href="/api/reportes/cuentas-por-cobrar?format=csv" filename="cuentas_por_cobrar.csv" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !cuentas || cuentas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay facturas de venta con saldo pendiente.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="w-32">Vencimiento</TableHead>
                <TableHead className="w-40">Antigüedad</TableHead>
                <TableHead className="w-28 text-right">Saldo</TableHead>
                <TableHead className="w-32 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuentas.map((cuenta) => (
                <FilaCuentaPorCobrar key={cuenta.id} cuenta={cuenta} />
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t pt-3">
            <p className="text-sm font-semibold">
              Total pendiente: <span className="tabular-nums">${total.toFixed(2)}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
