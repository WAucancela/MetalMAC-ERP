/**
 * MapearMaterialPopover — resuelve manualmente una línea de factura de compra
 * "sin mapear" a un material del inventario. Mismo Popover+Command de búsqueda
 * que el MaterialCombobox de BOMTable, más unidad del proveedor y factor de
 * conversión (la equivalencia que queda guardada para la próxima factura).
 */

'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Link2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { useMateriales, useUnidades } from '@/hooks/useInventario';
import { useMapearLineaFactura } from '@/hooks/useFacturas';

interface Props {
  facturaId: string;
  lineaId: string;
}

export function MapearMaterialPopover({ facturaId, lineaId }: Props) {
  const [open, setOpen] = useState(false);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [unidadProveedorId, setUnidadProveedorId] = useState<string>('');
  const [factorConversion, setFactorConversion] = useState<string>('1');

  const { data: materiales } = useMateriales({ activo: true });
  const { data: unidades } = useUnidades();
  const mapear = useMapearLineaFactura(facturaId);

  const seleccionado = materiales?.find((m) => m.id === materialId);

  const handleGuardar = async () => {
    if (!materialId) { toast.error('Elegí un material'); return; }
    if (!unidadProveedorId) { toast.error('Elegí la unidad del proveedor'); return; }
    const factor = Number(factorConversion);
    if (!(factor > 0)) { toast.error('El factor de conversión debe ser mayor a 0'); return; }

    try {
      await mapear.mutateAsync({ lineaId, materialId, unidadProveedorId, factorConversion: factor });
      toast.success('Línea mapeada — la próxima factura de este proveedor con este código se resuelve sola');
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Error al mapear la línea');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Link2 className="mr-1 h-3 w-3" /> Mapear
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 p-3" align="start">
        <div className="space-y-1.5">
          <Label className="text-xs">Material</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                className="flex w-full items-center justify-between gap-1 rounded border border-input bg-background px-2 py-1.5 text-sm"
              >
                <span className={cn('truncate text-left', !seleccionado && 'text-muted-foreground')}>
                  {seleccionado ? `${seleccionado.codigoInterno} — ${seleccionado.nombre}` : 'Buscar material…'}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command filter={(itemValue, search) => (itemValue.includes(search.toLowerCase()) ? 1 : 0)}>
                <CommandInput placeholder="Buscar por código o nombre…" />
                <CommandList>
                  <CommandEmpty>Sin resultados.</CommandEmpty>
                  <CommandGroup>
                    {(materiales ?? []).map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.codigoInterno} ${m.nombre}`.toLowerCase()}
                        onSelect={() => setMaterialId(m.id)}
                      >
                        <Check className={cn('mr-2 h-4 w-4', m.id === materialId ? 'opacity-100' : 'opacity-0')} />
                        <span className="font-mono text-xs text-muted-foreground mr-2">{m.codigoInterno}</span>
                        {m.nombre}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Unidad del proveedor</Label>
            <Select value={unidadProveedorId} onValueChange={setUnidadProveedorId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Elegir…" /></SelectTrigger>
              <SelectContent>
                {(unidades ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.simbolo} — {u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Factor conversión</Label>
            <Input
              type="number" step="any" min={0.000001}
              className="h-8 text-xs"
              value={factorConversion}
              onChange={(e) => setFactorConversion(e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cuántas unidades base del material equivalen a 1 unidad del proveedor. Dejalo en 1 si son la misma unidad.
        </p>

        <Button size="sm" className="w-full" onClick={handleGuardar} disabled={mapear.isPending}>
          {mapear.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Guardar mapeo
        </Button>
      </PopoverContent>
    </Popover>
  );
}
