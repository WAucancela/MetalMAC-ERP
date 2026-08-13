/**
 * FacturaTable.tsx — Tabla de facturas de compra con filtros y acciones de estado
 */

'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useFacturas, useActualizarEstadoFactura } from '@/hooks/useFacturas';
import { cn } from '@/lib/utils';
import type { FacturaCompra } from '@/types/metalmac.types';

// ─────────────────────────────────────────────
// Estado badge
// ─────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: FacturaCompra['estado'] }) {
  const map = {
    PENDIENTE:  { label: 'Pendiente',  icon: Clock,        class: 'text-amber-700 bg-amber-50' },
    PROCESADA:  { label: 'Procesada',  icon: CheckCircle2, class: 'text-green-700 bg-green-50' },
    ANULADA:    { label: 'Anulada',    icon: XCircle,      class: 'text-red-700 bg-red-50' },
  };
  const { label, icon: Icon, class: cls } = map[estado];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

interface FacturaTableProps {
  proveedorId?: string;
}

export default function FacturaTable({ proveedorId }: FacturaTableProps) {
  const [estadoFilter, setEstadoFilter] = useState<FacturaCompra['estado'] | 'TODOS'>('TODOS');

  const { data: facturas, isLoading } = useFacturas({
    proveedorId,
    estado: estadoFilter === 'TODOS' ? undefined : estadoFilter,
  });

  const actualizarEstado = useActualizarEstadoFactura();

  const handleProcesar = async (id: string) => {
    try {
      await actualizarEstado.mutateAsync({ id, estado: 'PROCESADA' });
      toast.success('Factura marcada como procesada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAnular = async (id: string) => {
    try {
      await actualizarEstado.mutateAsync({ id, estado: 'ANULADA' });
      toast.success('Factura anulada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtro */}
      <div className="flex items-center gap-2">
        <Select
          value={estadoFilter}
          onValueChange={(v) => setEstadoFilter(v as typeof estadoFilter)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="PENDIENTE">Pendientes</SelectItem>
            <SelectItem value="PROCESADA">Procesadas</SelectItem>
            <SelectItem value="ANULADA">Anuladas</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {facturas?.length ?? 0} facturas
        </p>
      </div>

      {/* Tabla */}
      {!facturas?.length ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p className="text-sm">No hay facturas registradas</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">IVA</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {facturas.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{f.numeroFactura}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.fechaEmision
                      ? format(parseISO(f.fechaEmision), 'dd MMM yyyy', { locale: es })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">${f.subtotalSinIva.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">${f.iva.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold">${f.total.toFixed(2)}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={f.estado} /></td>
                  <td className="px-4 py-3">
                    {f.estado === 'PENDIENTE' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-green-700 hover:text-green-800"
                          onClick={() => handleProcesar(f.id)}
                        >
                          Procesar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-600 hover:text-red-700"
                          onClick={() => handleAnular(f.id)}
                        >
                          Anular
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
