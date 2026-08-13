/**
 * /inventario — Lista de materiales con stock en tiempo real.
 * Filtros: tipo, búsqueda por texto, solo alertas.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMateriales } from '@/hooks/useInventario';
import { StockBadge } from '@/components/inventario/StockBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, AlertTriangle } from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';

const TIPO_LABELS: Record<string, string> = {
  PLANCHA:    'Plancha',
  TUBO:       'Tubo',
  PERFIL:     'Perfil',
  VARILLA:    'Varilla',
  CONSUMIBLE: 'Consumible',
};

export default function InventarioPage() {
  const [q,    setQ]    = useState('');
  const [tipo, setTipo] = useState<string>('');

  const { data: materiales, isLoading, isError } = useMateriales({
    q:    q || undefined,
    tipo: tipo || undefined,
    activo: true,
  });

  const alertas = materiales?.filter(
    (m) => m.stock && m.stock.cantidadDisponible < m.stock.cantidadMinima,
  ) ?? [];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventario</h1>
          <p className="text-sm text-muted-foreground">Catálogo de materiales y stock actual</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            href="/api/reportes/inventario?format=csv"
            filename="inventario.csv"
          />
          <Button asChild>
            <Link href="/inventario/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo material
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas de stock bajo */}
      {alertas.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{alertas.length} material{alertas.length > 1 ? 'es' : ''}</span>
            {' '}bajo stock mínimo:{' '}
            {alertas.slice(0, 3).map((m) => m.nombre).join(', ')}
            {alertas.length > 3 && ` y ${alertas.length - 3} más`}.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card">
        <Table className="[&_th]:h-9 [&_td]:py-2">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-36">Código</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
              <TableHead className="w-24">Grado</TableHead>
              <TableHead className="w-40">Stock disponible</TableHead>
              <TableHead className="w-28 text-right">Costo unit.</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-red-500">
                  Error al cargar materiales. Intenta de nuevo.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && materiales?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No se encontraron materiales.
                </TableCell>
              </TableRow>
            )}
            {materiales?.map((m) => (
              <TableRow key={m.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {m.codigoInterno}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{m.nombre}</div>
                  {m.descripcion && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{m.descripcion}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {TIPO_LABELS[m.tipo] ?? m.tipo}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.grado}</TableCell>
                <TableCell>
                  {m.stock ? (
                    <StockBadge
                      disponible={m.stock.cantidadDisponible}
                      minima={m.stock.cantidadMinima}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin stock</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  ${m.costoUnitario.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/inventario/${m.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
