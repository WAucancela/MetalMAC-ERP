/**
 * MarcarEmitidaForm — Fase 1: pega el número de factura y la clave de acceso que
 * devolvió el portal "Facturación en línea" del SRI para dejar la factura como EMITIDA
 * dentro del ERP. No genera ni firma nada — solo registra lo que ya se emitió por fuera.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

import { MarcarEmitidaSchema, type MarcarEmitidaInput } from '@/lib/validations/ventas.schema';
import { useMarcarEmitidaFacturaVenta } from '@/hooks/useFacturasVenta';

interface Props {
  facturaId: string;
  onEmitida?: () => void;
}

export function MarcarEmitidaForm({ facturaId, onEmitida }: Props) {
  const [abierto, setAbierto] = useState(false);
  const marcarEmitida = useMarcarEmitidaFacturaVenta(facturaId);

  const { register, handleSubmit, formState: { errors } } = useForm<MarcarEmitidaInput>({
    resolver: zodResolver(MarcarEmitidaSchema),
  });

  const onSubmit = async (data: MarcarEmitidaInput) => {
    try {
      await marcarEmitida.mutateAsync(data);
      toast.success('Factura marcada como emitida');
      setAbierto(false);
      onEmitida?.();
    } catch (e: any) {
      toast.error(e.message ?? 'Error al marcar la factura como emitida');
    }
  };

  if (!abierto) {
    return <Button size="sm" onClick={() => setAbierto(true)}>Marcar como emitida</Button>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-md border p-4">
      <p className="text-xs text-muted-foreground">
        Pegá el número y la clave de acceso que te dio el portal del SRI al emitir esta factura.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="numeroFactura">Número de factura</Label>
        <Input id="numeroFactura" placeholder="001-001-000000123" {...register('numeroFactura')} />
        {errors.numeroFactura && <p className="text-xs text-red-500">{errors.numeroFactura.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="claveAcceso">Clave de acceso (49 dígitos)</Label>
        <Input id="claveAcceso" className="font-mono" {...register('claveAcceso')} />
        {errors.claveAcceso && <p className="text-xs text-red-500">{errors.claveAcceso.message}</p>}
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={marcarEmitida.isPending}>
          {marcarEmitida.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…</>
            : 'Confirmar emisión'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
