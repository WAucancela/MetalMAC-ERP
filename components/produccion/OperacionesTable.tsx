/**
 * OperacionesTable — sección "Operaciones" del detalle de una OP.
 * Permite asignar un operario a cada operación del BOM (snapshot al iniciar la OP)
 * y marcarlas como completadas cargando los minutos reales trabajados.
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOperarios } from '@/hooks/useOperarios';
import { useAsignarOperario, useCompletarOperacion } from '@/hooks/useOrdenOperaciones';
import type { OrdenOperacion } from '@/types/metalmac.types';

const SIN_ASIGNAR = '__sin_asignar__';

interface Props {
  ordenId: string;
  operaciones: OrdenOperacion[];
  editable: boolean; // true sólo si la OP está EN_PROCESO
}

export function OperacionesTable({ ordenId, operaciones, editable }: Props) {
  const { data: operarios } = useOperarios({ activo: true });
  const asignar = useAsignarOperario(ordenId);
  const completar = useCompletarOperacion(ordenId);
  const [completando, setCompletando] = useState<string | null>(null);
  const [minutosReales, setMinutosReales] = useState('');

  async function handleAsignar(opId: string, operarioId: string) {
    try {
      await asignar.mutateAsync({ opId, operarioId: operarioId === SIN_ASIGNAR ? null : operarioId });
    } catch (e: any) {
      toast.error(e.message ?? 'Error al asignar operario');
    }
  }

  async function handleCompletar(opId: string) {
    const minutos = Number(minutosReales);
    if (!Number.isFinite(minutos) || minutos < 0) {
      toast.error('Ingresá los minutos reales trabajados');
      return;
    }
    try {
      await completar.mutateAsync({ opId, minutosReales: minutos });
      toast.success('Operación completada');
      setCompletando(null);
      setMinutosReales('');
    } catch (e: any) {
      toast.error(e.message ?? 'Error al completar la operación');
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Operaciones</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Tipo</TableHead>
            <TableHead className="w-28 text-right">Minutos plan.</TableHead>
            <TableHead>Operario</TableHead>
            <TableHead className="w-32">Estado</TableHead>
            <TableHead className="w-56 text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operaciones.map((op) => (
            <TableRow key={op.id}>
              <TableCell className="text-sm">{op.tipoOperacionNombre ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{op.minutosPlanificados}</TableCell>
              <TableCell>
                <Select
                  value={op.operarioId ?? SIN_ASIGNAR}
                  onValueChange={(v) => handleAsignar(op.id, v)}
                  disabled={!editable || op.estado === 'COMPLETADA'}
                >
                  <SelectTrigger className="h-8 w-48 text-sm">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                    {(operarios ?? []).map((operario) => (
                      <SelectItem key={operario.id} value={operario.id}>{operario.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={op.estado === 'COMPLETADA' ? 'outline' : 'secondary'}>
                  {op.estado === 'COMPLETADA' ? 'Completada' : 'Pendiente'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {op.estado === 'COMPLETADA' ? (
                  <span className="text-xs text-muted-foreground">
                    {op.minutosReales != null ? `${op.minutosReales} min reales` : '—'}
                  </span>
                ) : editable && completando === op.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      placeholder="Min. reales"
                      value={minutosReales}
                      onChange={(e) => setMinutosReales(e.target.value)}
                      className="h-8 w-24 text-right text-sm"
                    />
                    <Button size="sm" className="h-8" disabled={completar.isPending} onClick={() => handleCompletar(op.id)}>
                      {completar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => { setCompletando(null); setMinutosReales(''); }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : editable ? (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setCompletando(op.id)}>
                    Completar
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
