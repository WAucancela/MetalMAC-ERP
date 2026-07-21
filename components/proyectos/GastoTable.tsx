'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge }  from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEliminarGasto } from '@/hooks/useGastos';

const CATEGORIA_LABELS: Record<string, string> = {
  MATERIALES:     'Materiales',
  MANO_DE_OBRA:   'Mano de Obra',
  MAQUINARIA:     'Maquinaria',
  TRANSPORTE:     'Transporte',
  SUBCONTRATO:    'Subcontrato',
  ADMINISTRATIVO: 'Administrativo',
  OTRO:           'Otro',
};

interface Gasto {
  id: string;
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: { seconds: number } | string;
  facturaId?: string | null;
}

interface Props {
  proyectoId: string;
  gastos: Gasto[];
}

function toDate(ts: Gasto['fecha']): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  return new Date((ts as any).seconds * 1000);
}

export function GastoTable({ proyectoId, gastos }: Props) {
  const eliminar = useEliminarGasto(proyectoId);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleEliminar(id: string) {
    if (confirmId !== id) { setConfirmId(id); return; }
    try {
      await eliminar.mutateAsync(id);
      toast.success('Gasto eliminado');
      setConfirmId(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Agrupar por categoría
  const porCategoria = gastos.reduce<Record<string, Gasto[]>>((acc, g) => {
    const cat = g.categoria ?? 'OTRO';
    return { ...acc, [cat]: [...(acc[cat] ?? []), g] };
  }, {});

  const totalGeneral = gastos.reduce((s, g) => s + (g.monto ?? 0), 0);

  if (gastos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No hay gastos registrados aún.</p>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(porCategoria).map(([cat, items]) => {
        const subtotal = items.reduce((s, g) => s + (g.monto ?? 0), 0);
        return (
          <div key={cat} className="space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {CATEGORIA_LABELS[cat] ?? cat}
              </h4>
              <span className="text-xs font-semibold tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead className="w-28 text-right">Monto</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="text-sm">
                      {g.descripcion}
                      {g.facturaId && (
                        <Badge variant="outline" className="ml-2 text-[10px]">Factura</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {toDate(g.fecha)
                        ? format(toDate(g.fecha)!, 'dd MMM yyyy', { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      ${g.monto.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant={confirmId === g.id ? 'destructive' : 'ghost'}
                        className="h-7 w-7"
                        disabled={eliminar.isPending}
                        onClick={() => handleEliminar(g.id)}
                        title={confirmId === g.id ? 'Click para confirmar' : 'Eliminar'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
      <div className="flex justify-end border-t pt-3">
        <p className="text-sm font-semibold">
          Total gastado: <span className="tabular-nums">${totalGeneral.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}
