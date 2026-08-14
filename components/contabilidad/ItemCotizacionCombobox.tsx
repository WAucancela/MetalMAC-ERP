/**
 * ItemCotizacionCombobox — buscador combinado de productos + materiales del
 * catálogo real para insertar como línea de una cotización. Mismo patrón que
 * el MaterialCombobox de BOMTable (Popover + Command con filtro en vivo), pero
 * acá el ítem elegido solo prellena la línea — a diferencia del BOM, la línea de
 * cotización sigue siendo texto libre editable después (no hay conversión de
 * stock que dependa de mantener el vínculo exacto).
 */

'use client';

import { useState } from 'react';
import { Search, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';

import type { ProductoResumen } from '@/hooks/useProductos';
import type { MaterialConStock } from '@/hooks/useInventario';

export interface ItemCatalogo {
  tipo: 'PRODUCTO' | 'MATERIAL';
  productoId: string | null;
  materialId: string | null;
  descripcion: string;
  precioUnitario: number;
}

interface Props {
  productos: ProductoResumen[];
  materiales: MaterialConStock[];
  onSelect: (item: ItemCatalogo) => void;
}

export function ItemCotizacionCombobox({ productos, materiales, onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Search className="mr-1.5 h-3.5 w-3.5" /> Agregar del catálogo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar producto o material…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup heading="Productos">
              {productos.map((p) => (
                <CommandItem
                  key={`producto-${p.id}`}
                  value={`${p.codigo} ${p.nombre}`.toLowerCase()}
                  onSelect={() => {
                    onSelect({
                      tipo: 'PRODUCTO',
                      productoId: p.id,
                      materialId: null,
                      descripcion: `${p.codigo} — ${p.nombre}`,
                      precioUnitario: p.precioVenta,
                    });
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span className="font-mono text-xs text-muted-foreground mr-2 shrink-0">{p.codigo}</span>
                  <span className="truncate">{p.nombre}</span>
                  <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">
                    ${p.precioVenta.toFixed(2)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Materiales">
              {materiales.map((m) => (
                <CommandItem
                  key={`material-${m.id}`}
                  value={`${m.codigoInterno} ${m.nombre}`.toLowerCase()}
                  onSelect={() => {
                    onSelect({
                      tipo: 'MATERIAL',
                      productoId: null,
                      materialId: m.id,
                      descripcion: `${m.codigoInterno} — ${m.nombre}`,
                      precioUnitario: m.costoUnitario,
                    });
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span className="font-mono text-xs text-muted-foreground mr-2 shrink-0">{m.codigoInterno}</span>
                  <span className="truncate">{m.nombre}</span>
                  <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">
                    ${m.costoUnitario.toFixed(2)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
