/**
 * RegistrarPagoForm — form inline para registrar un pago (compra) o cobro
 * (venta) sobre una factura. La mutación concreta (pago vs cobro) la maneja
 * quien use este componente — acá solo se arma el formulario.
 */

'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { RegistrarPagoSchema, type RegistrarPagoInput } from '@/lib/validations/finanzas.schema';
import { useCuentasBancarias } from '@/hooks/useBancos';

const SIN_CUENTA = '__sin_cuenta__';

interface Props {
  saldoMaximo: number;
  isPending: boolean;
  onSubmit: (data: RegistrarPagoInput) => void | Promise<void>;
  onCancelar: () => void;
}

export function RegistrarPagoForm({ saldoMaximo, isPending, onSubmit, onCancelar }: Props) {
  const { data: cuentas } = useCuentasBancarias();

  const { register, handleSubmit, control, formState: { errors } } = useForm<RegistrarPagoInput>({
    resolver: zodResolver(RegistrarPagoSchema),
    defaultValues: { monto: saldoMaximo, fecha: new Date().toISOString().slice(0, 10) },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Monto (máx. ${saldoMaximo.toFixed(2)})</Label>
          <Input type="number" min={0.01} step="0.01" className="h-8" {...register('monto', { valueAsNumber: true })} />
          {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input type="date" className="h-8" {...register('fecha')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Método de pago</Label>
          <Input placeholder="Transferencia, efectivo..." className="h-8" {...register('metodoPago')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Referencia</Label>
          <Input placeholder="N° transferencia/cheque" className="h-8" {...register('referencia')} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Cuenta bancaria (opcional)</Label>
        <Controller
          name="cuentaBancariaId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? SIN_CUENTA}
              onValueChange={(v) => field.onChange(v === SIN_CUENTA ? null : v)}
            >
              <SelectTrigger className="h-8"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_CUENTA}>Sin asignar (no genera movimiento bancario)</SelectItem>
                {(cuentas ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.banco} — {c.numeroCuenta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  );
}
